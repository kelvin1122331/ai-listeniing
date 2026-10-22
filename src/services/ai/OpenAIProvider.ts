import {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  RealtimeSessionCallbacks,
} from "./AIProvider";
import { CameraSourceMode, CompanionConfig } from "@/types/companion";

/**
 * OpenAI Provider implementation conforming to the AIProvider interface.
 * Communicates via the server-side /api/chat route using encrypted server-stored credentials.
 */
export class OpenAIProvider implements AIProvider {
  readonly id = "openai";
  readonly displayName = "OpenAI Multimodal & Realtime API";

  async sendMessage(request: AIProviderRequest): Promise<AIProviderResponse> {
    const startTime = performance.now();

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "openai",
        message: request.message,
        recentHistory: request.recentHistory,
        conversationSummary: request.conversationSummary,
        config: request.config,
        longTermMemory: request.config.memoryEnabled
          ? request.longTermMemory
          : [],
        cameraActive: request.cameraActive,
        cameraSourceMode: request.cameraSourceMode,
        imageSnapshot: request.cameraActive ? request.imageSnapshot : undefined,
        visionSummary: request.cameraActive ? request.visionSummary : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error("Koneksi ke OpenAI API gagal. Silakan coba lagi.");
    }

    const data = await response.json();
    return {
      reply: data.reply || "Maaf, boleh diulangi sekali lagi?",
      expression: data.expression || "speaking",
      detectedLanguage: data.detectedLanguage || "id",
      providerName: data.provider || "OpenAI (gpt-4o-mini)",
      latencyMs: Math.round(performance.now() - startTime),
    };
  }

  async connectRealtimeSession(
    _config: CompanionConfig,
    callbacks: RealtimeSessionCallbacks
  ): Promise<boolean> {
    callbacks.onStatusChange("fallback");
    return false;
  }

  sendRealtimeAudioChunk(_pcm16Base64: string): void {}

  sendRealtimeVisionFrame(
    _jpegBase64: string,
    _sourceType: CameraSourceMode
  ): void {}

  interruptRealtimeResponse(): void {}

  disconnectRealtimeSession(): void {}
}
