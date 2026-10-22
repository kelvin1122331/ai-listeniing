"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LipSyncService,
  VisemeFrame,
  VISEME_SHAPES,
} from "@/services/LipSyncService";
import { AIService } from "@/services/AIService";
import {
  AvatarExpression,
  CompanionConfig,
  ConversationState,
  GeminiLiveConnectionStatus,
} from "@/types/companion";

interface UseVoiceSessionOptions {
  config: CompanionConfig;
  conversationState: ConversationState;
  setConversationState: (state: ConversationState) => void;
  setExpression: (expr: AvatarExpression) => void;
  onUserSpeechFinal: (transcript: string) => void;
  onLiveAssistantTranscript?: (text: string, isFinal: boolean) => void;
}

export function useVoiceSession({
  config,
  conversationState,
  setConversationState,
  setExpression,
  onUserSpeechFinal,
  onLiveAssistantTranscript,
}: UseVoiceSessionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isAiMuted, setIsAiMuted] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [visemeFrame, setVisemeFrame] = useState<VisemeFrame>(
    VISEME_SHAPES.rest
  );
  const [audioLevel, setAudioLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] =
    useState<GeminiLiveConnectionStatus>("disconnected");
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const lipSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentVisemeRef = useRef<VisemeFrame>(VISEME_SHAPES.rest);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);

  // Load browser TTS voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  /**
   * Plays raw 24kHz PCM16 base64 audio returned by Gemini Live API
   * and drives LipSyncService.amplitudeToVisemeFrame.
   */
  const playGeminiLivePcmChunk = useCallback(
    (pcm16Base64: string, amplitude: number) => {
      if (isAiMuted || config.speakerVolume <= 0) return;

      const targetViseme = LipSyncService.amplitudeToVisemeFrame(
        amplitude,
        0.4 + Math.random() * 0.3
      );
      const smoothed = LipSyncService.interpolateFrame(
        currentVisemeRef.current,
        targetViseme,
        0.42
      );
      currentVisemeRef.current = smoothed;
      setVisemeFrame(smoothed);
      setAudioLevel(amplitude);

      try {
        const AudioCtx =
          window.AudioContext ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).webkitAudioContext;
        if (!AudioCtx) return;

        if (!playbackAudioCtxRef.current) {
          playbackAudioCtxRef.current = new AudioCtx({ sampleRate: 24000 });
        }
        const ctx = playbackAudioCtxRef.current;
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }

        const binary = atob(pcm16Base64);
        const sampleCount = Math.floor(binary.length / 2);
        const audioBuffer = ctx.createBuffer(1, sampleCount, 24000);
        const channelData = audioBuffer.getChannelData(0);

        for (let i = 0; i < sampleCount; i++) {
          const low = binary.charCodeAt(i * 2);
          const high = binary.charCodeAt(i * 2 + 1);
          let int16 = (high << 8) | low;
          if (int16 >= 0x8000) int16 -= 0x10000;
          channelData[i] = (int16 / 32768) * config.speakerVolume;
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
      } catch {
        // Ignore audio decoding issues
      }
    },
    [config.speakerVolume, isAiMuted]
  );

  // Initialize / Reconnect Gemini Live API session
  const connectGeminiLive = useCallback(async () => {
    await AIService.connectRealtimeLiveSession(config, {
      onStatusChange: (status) => {
        setLiveStatus(status);
      },
      onTranscriptUpdate: (text, isFinal, role) => {
        if (role === "assistant" && onLiveAssistantTranscript) {
          onLiveAssistantTranscript(text, isFinal);
        }
      },
      onAudioChunk: (pcm16Base64, amplitude) => {
        playGeminiLivePcmChunk(pcm16Base64, amplitude);
      },
      onAvatarStateChange: (state, expr) => {
        setConversationState(state);
        setExpression(expr);
      },
      onInterrupted: () => {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        currentVisemeRef.current = VISEME_SHAPES.rest;
        setVisemeFrame(VISEME_SHAPES.rest);
        setAudioLevel(0);
      },
      onError: (friendlyMessage) => {
        setMicError(friendlyMessage);
      },
    });
  }, [
    config,
    onLiveAssistantTranscript,
    playGeminiLivePcmChunk,
    setConversationState,
    setExpression,
  ]);

  useEffect(() => {
    connectGeminiLive();
    return () => {
      AIService.disconnectRealtimeSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Immediately stops the AI from speaking (Barge-In / Stop button).
   */
  const stopSpeaking = useCallback(
    (markInterrupted = false) => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      activeUtteranceRef.current = null;
      if (lipSyncIntervalRef.current) {
        clearInterval(lipSyncIntervalRef.current);
        lipSyncIntervalRef.current = null;
      }
      AIService.interruptRealtimeResponse();
      currentVisemeRef.current = VISEME_SHAPES.rest;
      setVisemeFrame(VISEME_SHAPES.rest);
      setAudioLevel(0);

      if (markInterrupted) {
        setConversationState("INTERRUPTED");
        setExpression("interrupted");
      } else if (conversationState === "SPEAKING") {
        setConversationState("IDLE");
        setExpression("idle");
      }
    },
    [conversationState, setConversationState, setExpression]
  );

  /**
   * Speaks AI response aloud using clean browser Text-to-Speech while driving
   * the phoneme/viseme Lip-Sync engine.
   */
  const speakText = useCallback(
    (text: string, lang: "id" | "en" = "id", forceSpeak = false) => {
      if (lipSyncIntervalRef.current) {
        clearInterval(lipSyncIntervalRef.current);
        lipSyncIntervalRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
      }

      if (
        !forceSpeak &&
        (isAiMuted || config.speakerVolume <= 0 || !config.autoSpeak)
      ) {
        setConversationState("IDLE");
        setVisemeFrame(VISEME_SHAPES.rest);
        setAudioLevel(0);
        return;
      }

      // Clean markdown symbols so TTS reads sentences naturally
      const cleanText = text
        .replace(/[*_#>`~]/g, "")
        .replace(/\[.*?\]/g, "")
        .replace(/\n+/g, ". ")
        .trim();

      if (!cleanText) {
        setConversationState("IDLE");
        return;
      }

      setConversationState("SPEAKING");

      const timeline = LipSyncService.buildVisemeTimeline(
        cleanText,
        config.voiceRate
      );
      const totalDurationMs =
        timeline[timeline.length - 1]?.timeMs || cleanText.length * 55;
      const startTime = performance.now();

      // Start Lip-Sync & Audio Visualizer Loop
      lipSyncIntervalRef.current = setInterval(() => {
        const elapsed = performance.now() - startTime;
        if (elapsed >= totalDurationMs) {
          if (lipSyncIntervalRef.current) {
            clearInterval(lipSyncIntervalRef.current);
            lipSyncIntervalRef.current = null;
          }
          currentVisemeRef.current = VISEME_SHAPES.rest;
          setVisemeFrame(VISEME_SHAPES.rest);
          setAudioLevel(0);
          setConversationState("IDLE");
          return;
        }

        let target = VISEME_SHAPES.rest;
        for (let i = timeline.length - 1; i >= 0; i--) {
          if (elapsed >= timeline[i].timeMs) {
            target = timeline[i].frame;
            break;
          }
        }

        const simulatedAmp = Math.min(
          1,
          Math.max(0.12, target.openness * 0.9 + Math.random() * 0.15)
        );
        const ampFallbackFrame =
          target.viseme === "rest"
            ? LipSyncService.amplitudeToVisemeFrame(simulatedAmp * 0.35)
            : target;

        const smoothed = LipSyncService.interpolateFrame(
          currentVisemeRef.current,
          ampFallbackFrame,
          0.38
        );
        currentVisemeRef.current = smoothed;
        setVisemeFrame(smoothed);
        setAudioLevel(simulatedAmp);
      }, 45);

      // Speak via clean Web Speech API
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.resume();
          const utterance = new SpeechSynthesisUtterance(cleanText);
          activeUtteranceRef.current = utterance;

          utterance.lang = lang === "id" ? "id-ID" : "en-US";
          utterance.volume = config.speakerVolume;
          utterance.rate = config.voiceRate;
          utterance.pitch = config.voicePitch;

          const voices = window.speechSynthesis.getVoices();
          if (config.voiceURI && config.voiceURI !== "auto") {
            const matched = voices.find((v) => v.voiceURI === config.voiceURI);
            if (matched) utterance.voice = matched;
          } else {
            const langPrefix = lang === "id" ? "id" : "en";
            const naturalVoice = voices.find((v) =>
              v.lang.toLowerCase().startsWith(langPrefix)
            );
            if (naturalVoice) utterance.voice = naturalVoice;
          }

          utterance.onend = () => {
            activeUtteranceRef.current = null;
            if (lipSyncIntervalRef.current) {
              clearInterval(lipSyncIntervalRef.current);
              lipSyncIntervalRef.current = null;
            }
            currentVisemeRef.current = VISEME_SHAPES.rest;
            setVisemeFrame(VISEME_SHAPES.rest);
            setAudioLevel(0);
            setConversationState("IDLE");
          };

          utterance.onerror = () => {
            activeUtteranceRef.current = null;
          };

          window.speechSynthesis.speak(utterance);
        } catch {
          // Lip-sync timeline interval continues smoothly
        }
      }
    },
    [
      config.autoSpeak,
      config.speakerVolume,
      config.voicePitch,
      config.voiceRate,
      config.voiceURI,
      isAiMuted,
      setConversationState,
    ]
  );

  /**
   * Starts microphone audio capture, Barge-In interruption detection,
   * and Web Speech / Gemini Live audio streaming.
   */
  const startListening = useCallback(async () => {
    setMicError(null);

    if (isMicMuted) {
      setMicError(
        "Microphone sedang di-mute. Unmute terlebih dahulu untuk berbicara."
      );
      return;
    }

    if (conversationState === "SPEAKING") {
      stopSpeaking(true);
    }

    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    ) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio:
            config.selectedMicrophoneId &&
            config.selectedMicrophoneId !== "default"
              ? { deviceId: { exact: config.selectedMicrophoneId } }
              : true,
        });
        micStreamRef.current = stream;

        const AudioCtx =
          window.AudioContext ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const updateMicLevel = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length / 255;
            const normLevel = Math.min(1, avg * 2.5);
            setAudioLevel(normLevel);

            if (
              normLevel > 0.35 &&
              config.bargeInEnabled &&
              typeof window !== "undefined" &&
              window.speechSynthesis?.speaking
            ) {
              stopSpeaking(true);
            }

            micAnimFrameRef.current = requestAnimationFrame(updateMicLevel);
          };
          updateMicLevel();
        }
      } catch {
        setMicError(
          "Izin mikrofon ditolak atau tidak tersedia. Kamu tetap bisa mengetik pesan di bawah."
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).SpeechRecognition ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionAPI) {
      setIsListening(true);
      setConversationState("LISTENING");
      setExpression("listening");
      setMicError(
        "Web Speech API tidak tersedia di browser ini. Gunakan tombol 'Quick Voice' atau ketik pesan di bawah!"
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang =
        config.preferredLanguage === "en" ? "en-US" : "id-ID";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setConversationState("LISTENING");
        setExpression("listening");
        setInterimTranscript("");
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interim = "";
        let finalText = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcript;
          } else {
            interim += transcript;
          }
        }

        if ((interim || finalText) && config.bargeInEnabled) {
          if (
            typeof window !== "undefined" &&
            window.speechSynthesis?.speaking
          ) {
            stopSpeaking(true);
          }
        }

        if (interim) {
          setInterimTranscript(interim);
        }

        if (finalText.trim()) {
          setInterimTranscript("");
          setIsListening(false);
          onUserSpeechFinal(finalText.trim());
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed") {
          setMicError(
            "Akses microphone ditolak oleh browser. Kamu tetap bisa lanjut menggunakan chat teks."
          );
        }
        setIsListening(false);
        setConversationState("IDLE");
      };

      recognition.onend = () => {
        setIsListening(false);
        if (micAnimFrameRef.current) {
          cancelAnimationFrame(micAnimFrameRef.current);
        }
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
        }
        setAudioLevel(0);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setMicError(
        "Voice input gagal diinisialisasi. Silakan gunakan tombol 'Quick Voice' atau kolom chat."
      );
      setIsListening(false);
      setConversationState("IDLE");
    }
  }, [
    config.bargeInEnabled,
    config.preferredLanguage,
    config.selectedMicrophoneId,
    conversationState,
    isMicMuted,
    onUserSpeechFinal,
    setConversationState,
    setExpression,
    stopSpeaking,
  ]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }
    if (micAnimFrameRef.current) {
      cancelAnimationFrame(micAnimFrameRef.current);
      micAnimFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript("");
    setAudioLevel(0);
    if (
      conversationState === "LISTENING" ||
      conversationState === "INTERRUPTED"
    ) {
      setConversationState("IDLE");
    }
  }, [conversationState, setConversationState]);

  useEffect(() => {
    return () => {
      if (lipSyncIntervalRef.current) clearInterval(lipSyncIntervalRef.current);
      if (micAnimFrameRef.current)
        cancelAnimationFrame(micAnimFrameRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isListening,
    isMicMuted,
    setIsMicMuted,
    isAiMuted,
    setIsAiMuted,
    interimTranscript,
    visemeFrame,
    audioLevel,
    micError,
    setMicError,
    liveStatus,
    reconnectGeminiLive: connectGeminiLive,
    availableVoices,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
  };
}
