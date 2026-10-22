import {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  RealtimeSessionCallbacks,
} from "./AIProvider";
import { CameraSourceMode, CompanionConfig } from "@/types/companion";

/**
 * Primary AI Provider implementation powered by Google AI Studio / Gemini API
 * and Gemini Live Multimodal API (BidiGenerateContent).
 */
export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly displayName = "Google Gemini Multimodal & Live API";

  private ws: WebSocket | null = null;
  private callbacks: RealtimeSessionCallbacks | null = null;
  private activeConfig: CompanionConfig | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 2;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lastSentFrameSignature = "";

  /**
   * Sends a text, voice, camera vision, or screen-share request to the server-side
   * Gemini API endpoint (/api/chat).
   * Applies usage optimizations: summarized history + adaptive frame attachment.
   */
  async sendMessage(request: AIProviderRequest): Promise<AIProviderResponse> {
    const startTime = performance.now();

    // Usage Optimization: Determine whether we need to attach the base64 image frame
    const lowerMsg = request.message.toLowerCase();
    const isExplicitVisualQuery =
      lowerMsg.includes("pegang") ||
      lowerMsg.includes("benda") ||
      lowerMsg.includes("tulisan") ||
      lowerMsg.includes("baca") ||
      lowerMsg.includes("kiri") ||
      lowerMsg.includes("kanan") ||
      lowerMsg.includes("tengah") ||
      lowerMsg.includes("gambar") ||
      lowerMsg.includes("kamera") ||
      lowerMsg.includes("layar") ||
      lowerMsg.includes("screen") ||
      lowerMsg.includes("lihat") ||
      lowerMsg.includes("apa ini") ||
      lowerMsg.includes("ini apa") ||
      lowerMsg.includes("what") ||
      lowerMsg.includes("hold") ||
      lowerMsg.includes("read") ||
      lowerMsg.includes("left") ||
      lowerMsg.includes("right") ||
      lowerMsg.includes("show");

    const frameDelta = request.visionSummary?.frameDeltaScore ?? 1;
    const shouldIncludeFrame =
      request.cameraActive &&
      Boolean(request.imageSnapshot) &&
      (!request.config.adaptiveSampling ||
        isExplicitVisualQuery ||
        frameDelta > 0.08);

    const requestId =
      request.requestId ||
      `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const requestPayload = {
      requestId,
      provider: "gemini",
      message: request.message,
      recentHistory: request.recentHistory,
      conversationSummary: request.conversationSummary,
      config: request.config,
      longTermMemory: request.config.memoryEnabled
        ? request.longTermMemory
        : [],
      cameraActive: request.cameraActive,
      cameraSourceMode: request.cameraSourceMode,
      imageSnapshot: shouldIncludeFrame ? request.imageSnapshot : undefined,
      visionSummary: request.cameraActive ? request.visionSummary : undefined,
    };

    if (process.env.NODE_ENV !== "production") {
      console.log("USER INPUT:\n", request.message);
      console.log("REQUEST ID:\n", requestId);
      console.log("GEMINI REQUEST SENT:\n", true);
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      let friendlyErr = "Maaf, respons AI gagal dibuat. Coba lagi.";
      try {
        const errData = await response.json();
        if (errData?.error) friendlyErr = errData.error;
      } catch {
        // Use default friendly message
      }
      throw new Error(friendlyErr);
    }

    const data = await response.json();
    const latencyMs = Math.round(performance.now() - startTime);

    if (process.env.NODE_ENV !== "production") {
      console.log("GEMINI RAW RESPONSE:\n", data.rawModelOutput ?? data.reply);
      console.log("PARSED RESPONSE:\n", data.reply);
      console.log("FINAL UI RESPONSE:\n", data.reply);
    }

    // Also forward sampled frame to Gemini Live WebSocket if connected
    if (
      shouldIncludeFrame &&
      request.imageSnapshot &&
      this.ws &&
      this.ws.readyState === WebSocket.OPEN
    ) {
      this.sendRealtimeVisionFrame(
        request.imageSnapshot,
        request.cameraSourceMode || "webcam"
      );
    }

    return {
      reply: data.reply || "Maaf, boleh diulangi sekali lagi?",
      expression: data.expression || "speaking",
      detectedLanguage: data.detectedLanguage || "id",
      providerName: data.provider || "Google Gemini 2.0 Flash",
      latencyMs,
      audioBase64: data.audioBase64,
      tokenOptimizationInfo: {
        historySummarized: Boolean(request.conversationSummary),
        frameIncluded: shouldIncludeFrame,
        modelUsed: data.modelUsed || request.config.geminiModel || "gemini-2.0-flash",
      },
    };
  }

  /**
   * Connects to Gemini Live API (BidiGenerateContent WebSocket) using a server-issued ephemeral session.
   * Automatically falls back to hybrid Gemini REST + WebSpeech if Live WebSocket is unavailable.
   */
  async connectRealtimeSession(
    config: CompanionConfig,
    callbacks: RealtimeSessionCallbacks
  ): Promise<boolean> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }

    this.activeConfig = config;
    this.callbacks = callbacks;

    if (!config.useGeminiLiveVoice) {
      callbacks.onStatusChange("fallback");
      return false;
    }

    try {
      callbacks.onStatusChange("connecting");
      const res = await fetch("/api/gemini/session", { method: "POST" });
      if (!res.ok) {
        callbacks.onStatusChange("fallback");
        return false;
      }

      const sessionInfo = await res.json();
      if (!sessionInfo.liveAvailable || !sessionInfo.wsUrl) {
        callbacks.onStatusChange("fallback");
        return false;
      }

      return await this.openGeminiLiveWebSocket(
        sessionInfo.wsUrl,
        sessionInfo.liveModel || "models/gemini-2.0-flash-exp",
        config,
        callbacks
      );
    } catch {
      callbacks.onStatusChange("fallback");
      return false;
    }
  }

  private openGeminiLiveWebSocket(
    wsUrl: string,
    liveModel: string,
    config: CompanionConfig,
    callbacks: RealtimeSessionCallbacks
  ): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(wsUrl);
        this.ws = ws;

        const timeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            callbacks.onStatusChange("fallback");
            resolve(false);
          }
        }, 4500);

        ws.onopen = () => {
          clearTimeout(timeout);

          // Send Gemini Live BidiGenerateContent setup payload
          const voiceName =
            config.avatarId === "kai" ? "Puck" : "Aoede";
          const setupPayload = {
            setup: {
              model: liveModel.startsWith("models/")
                ? liveModel
                : `models/${liveModel}`,
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName,
                    },
                  },
                },
              },
              systemInstruction: {
                parts: [
                  {
                    text: `You are ${config.aiName}, a helpful conversational AI assistant. Answer the user's actual question or request directly. Do not merely repeat, acknowledge, or paraphrase the user's message. Only ask a clarifying question when necessary. For simple questions, answer briefly. For complex questions, provide useful detail. Adapt naturally to the user's language and conversational style.`,
                  },
                ],
              },
            },
          };

          ws.send(JSON.stringify(setupPayload));
          callbacks.onStatusChange("connected");
          resolve(true);
        };

        ws.onmessage = async (event) => {
          try {
            const rawText =
              event.data instanceof Blob
                ? await event.data.text()
                : String(event.data);
            const msg = JSON.parse(rawText);

            // Check for Barge-In Interruption from Gemini Live server
            if (msg?.serverContent?.interrupted) {
              callbacks.onInterrupted();
              callbacks.onAvatarStateChange("INTERRUPTED", "interrupted");
              return;
            }

            const parts = msg?.serverContent?.modelTurn?.parts;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                if (part.text) {
                  callbacks.onTranscriptUpdate(
                    part.text,
                    Boolean(msg?.serverContent?.turnComplete),
                    "assistant"
                  );
                }
                if (
                  part.inlineData?.data &&
                  part.inlineData?.mimeType?.startsWith("audio/")
                ) {
                  const amp = this.computePcmBase64Amplitude(
                    part.inlineData.data
                  );
                  callbacks.onAvatarStateChange("SPEAKING", "speaking");
                  callbacks.onAudioChunk(part.inlineData.data, amp);
                }
              }
            }

            if (msg?.serverContent?.turnComplete) {
              callbacks.onAvatarStateChange("IDLE", "idle");
            }
          } catch {
            // Ignore malformed frame
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          callbacks.onStatusChange("fallback");
          resolve(false);
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          if (
            this.reconnectAttempts < this.maxReconnectAttempts &&
            this.activeConfig
          ) {
            this.reconnectAttempts += 1;
            callbacks.onStatusChange("reconnecting");
            this.reconnectTimer = setTimeout(() => {
              if (this.activeConfig && this.callbacks) {
                this.connectRealtimeSession(this.activeConfig, this.callbacks);
              }
            }, 1500 * this.reconnectAttempts);
          } else {
            callbacks.onStatusChange("fallback");
          }
        };
      } catch {
        callbacks.onStatusChange("fallback");
        resolve(false);
      }
    });
  }

  /**
   * Sends realtime PCM16 audio chunk to Gemini Live API.
   */
  sendRealtimeAudioChunk(pcm16Base64: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const payload = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "audio/pcm;rate=16000",
            data: pcm16Base64,
          },
        ],
      },
    };
    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Sends a compressed JPEG frame from camera or screen share to Gemini Live API.
   * Uses signature deduplication so identical static frames are not sent repeatedly.
   */
  sendRealtimeVisionFrame(
    jpegBase64: string,
    _sourceType: CameraSourceMode
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const cleanBase64 = jpegBase64.replace(/^data:image\/\w+;base64,/, "");
    const signature = `${cleanBase64.length}:${cleanBase64.slice(100, 180)}`;
    if (signature === this.lastSentFrameSignature) {
      return; // Adaptive deduplication: skip identical frame
    }
    this.lastSentFrameSignature = signature;

    const payload = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "image/jpeg",
            data: cleanBase64,
          },
        ],
      },
    };
    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Interrupts Gemini Live generation when user barges in.
   */
  interruptRealtimeResponse(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.callbacks) {
        this.callbacks.onInterrupted();
        this.callbacks.onAvatarStateChange("INTERRUPTED", "interrupted");
      }
      // Sending clientContent with turnComplete:true interrupts ongoing model output in Gemini Live API
      this.ws.send(
        JSON.stringify({
          clientContent: {
            turns: [],
            turnComplete: true,
          },
        })
      );
    }
  }

  /**
   * Closes Gemini Live session cleanly.
   */
  disconnectRealtimeSession(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.activeConfig = null;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
    if (this.callbacks) {
      this.callbacks.onStatusChange("disconnected");
    }
  }

  /**
   * Computes normalized RMS amplitude (0.0 - 1.0) from a base64 PCM16 audio chunk
   * for fallback/direct audio lip-sync when phoneme timing isn't provided.
   */
  private computePcmBase64Amplitude(base64Pcm: string): number {
    try {
      const binary = atob(base64Pcm);
      const len = binary.length;
      if (len < 4) return 0.25;
      let sumSq = 0;
      const sampleCount = Math.floor(len / 2);
      const step = Math.max(1, Math.floor(sampleCount / 64));
      let counted = 0;

      for (let i = 0; i < len - 1; i += step * 2) {
        const low = binary.charCodeAt(i);
        const high = binary.charCodeAt(i + 1);
        let sample = (high << 8) | low;
        if (sample >= 0x8000) sample -= 0x10000;
        const norm = sample / 32768;
        sumSq += norm * norm;
        counted++;
      }

      const rms = Math.sqrt(sumSq / Math.max(1, counted));
      return Math.min(1, Math.max(0.08, rms * 3.2));
    } catch {
      return 0.35;
    }
  }
}
