"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Brain,
  Camera,
  CameraOff,
  MessageSquare,
  Mic,
  MicOff,
  Monitor,
  Moon,
  PhoneOff,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Square,
  Sun,
  User,
  Volume2,
  VolumeX,
  Wand2,
} from "lucide-react";
import {
  AVATAR_PRESETS,
  COMPANION_MODES,
  DEMO_CAMERA_SCENES,
} from "@/constants/companionPresets";
import {
  AvatarExpression,
  CameraSourceMode,
  ChatMessage,
  CompanionConfig,
  ConversationState,
  LongTermMemoryItem,
  UserProfile,
  VisionAnalysisSummary,
} from "@/types/companion";
import { AIService } from "@/services/AIService";
import { MemoryService } from "@/services/MemoryService";
import { VirtualAvatar } from "@/components/Avatar/VirtualAvatar";
import { CameraPreview } from "@/components/CameraController/CameraPreview";
import { ChatPanel } from "@/components/Chat/ChatPanel";
import { useVoiceSession } from "@/components/VoiceController/useVoiceSession";
import { SettingsModal } from "@/components/Settings/SettingsModal";
import { ProfileModal } from "@/components/Settings/ProfileModal";

interface MainConversationViewProps {
  config: CompanionConfig;
  onUpdateConfig: (partial: Partial<CompanionConfig>) => void;
  userProfile: UserProfile;
  onUpdateProfile: (partial: Partial<UserProfile>) => void;
  onEndSession: () => void;
  initialPrompt?: string | null;
  onClearInitialPrompt?: () => void;
}

const INITIAL_GREETING = "Halo! Aku AURA. Ada yang bisa aku bantu hari ini?";

export const MainConversationView: React.FC<MainConversationViewProps> = ({
  config,
  onUpdateConfig,
  userProfile,
  onUpdateProfile,
  onEndSession,
  initialPrompt,
  onClearInitialPrompt,
}) => {
  // Core Conversation State Machine: IDLE | LISTENING | PROCESSING | SPEAKING | WATCHING | INTERRUPTED
  const [conversationState, setConversationState] =
    useState<ConversationState>("IDLE");
  const [expression, setExpression] = useState<AvatarExpression>("happy");

  // Chat Messages & Input
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [subtitleText, setSubtitleText] = useState<string>(INITIAL_GREETING);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  // Camera / Screen Share / Vision State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraSourceMode, setCameraSourceMode] =
    useState<CameraSourceMode>("webcam");
  const [selectedDemoSceneId, setSelectedDemoSceneId] = useState<string>(
    DEMO_CAMERA_SCENES[0].id
  );
  const [latestFrameBase64, setLatestFrameBase64] = useState<
    string | undefined
  >(undefined);
  const [latestVisionSummary, setLatestVisionSummary] =
    useState<VisionAnalysisSummary | null>(null);

  // Memory State
  const [longTermMemories, setLongTermMemories] = useState<
    LongTermMemoryItem[]
  >([]);

  // UI Modals & Mobile Panels
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  const isDark = config.theme === "dark";
  const activePreset =
    AVATAR_PRESETS.find((p) => p.id === config.avatarId) || AVATAR_PRESETS[0];
  const activeModeObj =
    COMPANION_MODES.find((m) => m.id === config.companionMode) ||
    COMPANION_MODES[0];

  // Sync avatar expression with ConversationState & Camera Watching state
  useEffect(() => {
    if (conversationState === "LISTENING") {
      setExpression("listening");
    } else if (conversationState === "PROCESSING") {
      setExpression("thinking");
    } else if (conversationState === "INTERRUPTED") {
      setExpression("interrupted");
    } else if (conversationState === "WATCHING") {
      setExpression("watching");
    } else if (conversationState === "IDLE") {
      if (isCameraActive) {
        setExpression("watching");
      } else if (expression === "speaking") {
        setExpression("idle");
      }
    }
  }, [conversationState, isCameraActive, expression]);

  // Forward declare send handler for voice callback & track latest request ID to prevent race conditions
  const activeRequestIdRef = React.useRef<string>("");
  const handleSendMessageRef = React.useRef<
    (
      text: string,
      source?: "text" | "voice" | "vision" | "screen"
    ) => Promise<void>
  >(async () => {});

  // Initialize Voice Controller Hook (Gemini Live API + Web Speech STT/TTS + Barge-in + Amplitude Lip-Sync)
  const {
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
    reconnectGeminiLive,
    availableVoices,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
  } = useVoiceSession({
    config,
    conversationState,
    setConversationState,
    setExpression,
    onUserSpeechFinal: (transcript) => {
      handleSendMessageRef.current(transcript, "voice");
    },
    onLiveAssistantTranscript: (text, isFinal) => {
      setSubtitleText(text);
      if (isFinal && text.trim()) {
        setMessages((prev) => {
          const updated: ChatMessage[] = [
            ...prev,
            {
              id: `gemini_live_${Date.now()}`,
              role: "assistant",
              content: text.trim(),
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              expression: "speaking",
              source: "voice",
            },
          ];
          MemoryService.saveShortTermHistory(updated);
          return updated;
        });
      }
    },
  });

  // Load Short-Term & Long-Term Memory on mount + Speak Initial Greeting
  useEffect(() => {
    const savedLongTerm = MemoryService.getLongTermMemories();
    setLongTermMemories(savedLongTerm);

    const savedShortTerm = MemoryService.getShortTermHistory();
    if (savedShortTerm.length > 0) {
      setMessages(savedShortTerm);
    } else {
      const greetingMsg: ChatMessage = {
        id: "msg_greeting_init",
        role: "assistant",
        content: INITIAL_GREETING,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        expression: "happy",
        source: "text",
      };
      setMessages([greetingMsg]);
    }

    const timer = setTimeout(() => {
      if (initialPrompt && initialPrompt.trim()) {
        handleSendMessageRef.current(initialPrompt.trim(), "text");
        onClearInitialPrompt?.();
      } else {
        speakText(INITIAL_GREETING, "id", true);
      }
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Core Multimodal Message Handler via AIService -> GeminiProvider.
   */
  const handleSendMessage = useCallback(
    async (
      rawText: string,
      source: "text" | "voice" | "vision" | "screen" = "text"
    ) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;

      setApiError(null);
      setLastFailedPrompt(null);

      // Barge-in: if AI is currently speaking when user sends a message, interrupt immediately
      if (conversationState === "SPEAKING") {
        stopSpeaking(true);
      }

      const nowStr = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const resolvedSource =
        isCameraActive && source === "text"
          ? cameraSourceMode === "screen"
            ? "screen"
            : "vision"
          : source;

      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      activeRequestIdRef.current = requestId;

      const userMsg: ChatMessage = {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: "user",
        content: trimmed,
        timestamp: nowStr,
        source: resolvedSource,
        visionAnalysis: isCameraActive
          ? latestVisionSummary || undefined
          : undefined,
      };

      const historyBeforeCurrent = [...messages];
      setMessages((prev) => {
        const next = [...prev, userMsg];
        MemoryService.saveShortTermHistory(next);
        return next;
      });
      setInputText("");

      // Update Long-Term Memory if enabled
      let currentMemories = longTermMemories;
      if (config.memoryEnabled) {
        currentMemories = MemoryService.extractMemoryFromUserMessage(
          trimmed,
          longTermMemories
        );
        setLongTermMemories(currentMemories);
      }

      // Transition State Machine to PROCESSING (Gemini Thinking...)
      setConversationState("PROCESSING");
      setExpression("thinking");

      try {
        const aiResponse = await AIService.sendMessage({
          requestId,
          message: trimmed,
          messagesHistory: historyBeforeCurrent,
          config,
          longTermMemory: currentMemories,
          cameraActive: isCameraActive,
          cameraSourceMode,
          imageSnapshot: isCameraActive ? latestFrameBase64 : undefined,
          visionSummary: isCameraActive
            ? latestVisionSummary || undefined
            : undefined,
        });

        // Guard against async race condition: ignore if a newer request was already sent
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        const aiMsg: ChatMessage = {
          id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          role: "assistant",
          content: aiResponse.reply,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          expression: aiResponse.expression,
          source: "text",
        };

        setMessages((prev) => {
          const next = [...prev, aiMsg];
          MemoryService.saveShortTermHistory(next);
          return next;
        });

        setExpression(aiResponse.expression);
        setSubtitleText(aiResponse.reply);

        // Transition State Machine to SPEAKING and drive Lip-Sync + Voice
        speakText(aiResponse.reply, aiResponse.detectedLanguage, !isAiMuted);
      } catch (err) {
        if (activeRequestIdRef.current !== requestId) {
          return;
        }
        setConversationState("IDLE");
        setExpression("confused");
        setLastFailedPrompt(trimmed);
        setApiError(
          err instanceof Error
            ? err.message
            : "Maaf, respons AI gagal dibuat. Coba lagi."
        );
      }
    },
    [
      cameraSourceMode,
      config,
      conversationState,
      isAiMuted,
      isCameraActive,
      latestFrameBase64,
      latestVisionSummary,
      longTermMemories,
      messages,
      speakText,
      stopSpeaking,
    ]
  );

  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  const handleFrameCaptured = useCallback(
    (base64: string, summary: VisionAnalysisSummary) => {
      setLatestFrameBase64(base64);
      setLatestVisionSummary(summary);
    },
    []
  );

  const handleClearConversation = () => {
    stopSpeaking(false);
    MemoryService.clearShortTermHistory();
    const freshGreeting: ChatMessage = {
      id: `msg_reset_${Date.now()}`,
      role: "assistant",
      content: INITIAL_GREETING,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      expression: "happy",
    };
    setMessages([freshGreeting]);
    setSubtitleText(INITIAL_GREETING);
  };

  const handleClearSavedMemory = () => {
    MemoryService.clearLongTermMemory();
    setLongTermMemories([]);
  };

  const handleDeleteMemoryItem = (id: string) => {
    const filtered = longTermMemories.filter((m) => m.id !== id);
    setLongTermMemories(filtered);
    MemoryService.saveLongTermMemories(filtered);
  };

  const handleEndSessionClick = () => {
    stopSpeaking(false);
    stopListening();
    setIsCameraActive(false);
    onEndSession();
  };

  const handleSimulatedVoiceTurn = () => {
    const sampleVoicePrompts = isCameraActive
      ? [
          "Apa yang sedang aku pegang?",
          "Yang sebelah kiri itu apa?",
          "Baca tulisan ini.",
        ]
      : [
          "Halo Aura! Aku lagi pengen ngobrol santai nih, gimana kabarmu?",
          "Bantu aku brainstorming ide project AI dengan Gemini.",
          "Hey Aura, let's practice a quick English conversation!",
        ];
    const picked =
      sampleVoicePrompts[
        Math.floor(Math.random() * sampleVoicePrompts.length)
      ];
    handleSendMessage(picked, "voice");
  };

  const handleToggleCamera = () => {
    if (isCameraActive && cameraSourceMode !== "screen") {
      setIsCameraActive(false);
      setConversationState("IDLE");
    } else {
      setCameraSourceMode("webcam");
      setIsCameraActive(true);
      if (conversationState === "IDLE") {
        setConversationState("WATCHING");
        setExpression("watching");
      }
    }
  };

  const handleToggleScreenShare = () => {
    if (isCameraActive && cameraSourceMode === "screen") {
      setIsCameraActive(false);
      setConversationState("IDLE");
    } else {
      setCameraSourceMode("screen");
      setIsCameraActive(true);
      if (conversationState === "IDLE") {
        setConversationState("WATCHING");
        setExpression("watching");
      }
    }
  };

  return (
    <div
      className={`h-screen w-full flex flex-col overflow-hidden transition-colors duration-300 ${
        isDark
          ? "bg-[#060913] text-slate-100"
          : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* Top Navigation Bar */}
      <header
        className={`relative z-30 h-16 px-4 sm:px-6 border-b flex items-center justify-between backdrop-blur-xl ${
          isDark
            ? "bg-slate-950/75 border-slate-800/80"
            : "bg-white/85 border-slate-200"
        }`}
      >
        {/* Left: Logo & Active Gemini Companion Info */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleEndSessionClick}
            className="flex items-center gap-2.5 group text-left"
            title="Return to Landing Page"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md transition-transform group-hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${activePreset.primaryColor}, ${activePreset.secondaryColor})`,
              }}
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight">
                  {config.aiName}
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  {activeModeObj.label}
                </span>
                <span className="hidden lg:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  {config.geminiModel || "gemini-2.0-flash"}
                </span>
              </div>
              <p className="text-[10px] opacity-60 hidden sm:block">
                Google Gemini Multimodal •{" "}
                {liveStatus === "connected"
                  ? "Gemini Live Connected"
                  : liveStatus === "reconnecting"
                    ? "Reconnecting Live..."
                    : "Hybrid Realtime Active"}
              </p>
            </div>
          </button>
        </div>

        {/* Center/Right Hardware & Privacy Active Status Indicators */}
        <div className="flex items-center gap-2">
          {/* Microphone Active Indicator */}
          {isListening && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="hidden sm:inline">Microphone Active</span>
              <span className="sm:hidden">Mic ON</span>
            </div>
          )}

          {/* Camera / Screen Share Active Indicator */}
          {isCameraActive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="hidden sm:inline">
                {cameraSourceMode === "screen"
                  ? "Screen Share Active"
                  : "Camera Active"}
              </span>
              <span className="sm:hidden">
                {cameraSourceMode === "screen" ? "Screen ON" : "Cam ON"}
              </span>
            </div>
          )}

          {/* Memory Status Pill */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${
              config.memoryEnabled
                ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                : "bg-slate-800/60 border-slate-700 text-slate-400"
            }`}
            title="Configure Memory Settings"
          >
            <Brain className="w-3 h-3" />
            <span>Memory: {config.memoryEnabled ? "ON" : "OFF"}</span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() =>
              onUpdateConfig({ theme: isDark ? "light" : "dark" })
            }
            className={`p-2 rounded-xl border transition-colors ${
              isDark
                ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
                : "bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-950"
            }`}
            title="Toggle Dark / Light Mode"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
              isDark
                ? "bg-slate-900 border-slate-800 text-slate-200 hover:border-sky-500/50"
                : "bg-slate-100 border-slate-200 text-slate-800 hover:border-sky-500"
            }`}
          >
            <Settings className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Profile Button */}
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
              isDark
                ? "bg-slate-900 border-slate-800 text-slate-200 hover:border-indigo-500/50"
                : "bg-slate-100 border-slate-200 text-slate-800 hover:border-indigo-500"
            }`}
          >
            <User className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Profile</span>
          </button>
        </div>
      </header>

      {/* Main Content Area: Center Avatar Stage + Right Chat Column */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        <main className="flex-1 min-h-0 flex flex-col justify-between relative overflow-y-auto overflow-x-hidden px-3 py-2 sm:px-6 sm:py-3">
          {/* Error / Permission / Reconnect Notification Banner */}
          <div className="shrink-0 relative z-20 max-w-xl mx-auto w-full space-y-1.5">
            <AnimatePresence>
              {micError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs backdrop-blur-md"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{micError}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setMicError(null);
                        handleSimulatedVoiceTurn();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-bold text-[11px]"
                    >
                      Simulasi Suara
                    </button>
                    <button
                      type="button"
                      onClick={() => setMicError(null)}
                      className="text-xs opacity-70 hover:opacity-100 px-1"
                    >
                      ✕
                    </button>
                  </div>
                </motion.div>
              )}

              {apiError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs backdrop-blur-md"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{apiError}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        reconnectGeminiLive();
                        if (lastFailedPrompt) {
                          handleSendMessage(lastFailedPrompt, "text");
                        }
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-500 text-white font-semibold text-[11px]"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reconnect Gemini</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Centerpiece AI Virtual Avatar */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center relative py-1">
            <VirtualAvatar
              preset={activePreset}
              aiName={config.aiName}
              conversationState={conversationState}
              expression={expression}
              visemeFrame={visemeFrame}
              audioLevel={audioLevel}
              customAvatarUrl={config.customAvatarUrl}
              subtitleText={interimTranscript || subtitleText}
              isDark={isDark}
              onSelectExpression={setExpression}
            />
          </div>

          {/* User Camera / Screen Share Preview (PiP Window in Corner) */}
          <CameraPreview
            isCameraActive={isCameraActive}
            cameraSourceMode={cameraSourceMode}
            setCameraSourceMode={setCameraSourceMode}
            selectedDemoSceneId={selectedDemoSceneId}
            setSelectedDemoSceneId={setSelectedDemoSceneId}
            selectedCameraDeviceId={config.selectedCameraId}
            sampleIntervalSec={config.cameraSampleIntervalSec}
            adaptiveSampling={config.adaptiveSampling ?? true}
            latestVisionSummary={latestVisionSummary}
            onFrameCaptured={handleFrameCaptured}
            onQuickAskVision={(q) =>
              handleSendMessage(
                q,
                cameraSourceMode === "screen" ? "screen" : "vision"
              )
            }
            onCloseCamera={() => {
              setIsCameraActive(false);
              if (conversationState === "WATCHING") {
                setConversationState("IDLE");
                setExpression("idle");
              }
            }}
            onCameraError={(msg) => setMicError(msg)}
            isDark={isDark}
          />

          {/* Bottom Unified Control Bar (Always Visible Below Subtitle) */}
          <div className="shrink-0 relative z-20 max-w-2xl w-full mx-auto space-y-2 pt-2 pb-1">
            {/* Prominent Text Typing Input Row */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputText, "text");
              }}
              className={`flex items-center gap-2 p-1.5 pl-4 rounded-2xl border-2 backdrop-blur-xl shadow-xl transition-all ${
                isDark
                  ? "bg-slate-900/95 border-sky-500/40 focus-within:border-sky-400 shadow-sky-500/10"
                  : "bg-white/95 border-sky-400/60 focus-within:border-sky-500"
              }`}
            >
              <MessageSquare className="w-4 h-4 text-sky-400 shrink-0" />
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isCameraActive
                    ? cameraSourceMode === "screen"
                      ? `Ketik pertanyaan tentang layarmu ke ${config.aiName}...`
                      : `Ketik pertanyaan ke ${config.aiName}: "Ini benda apa?", "Baca tulisan ini"...`
                    : `Ketik pesan ke ${config.aiName} di sini lalu tekan Enter / Kirim...`
                }
                className="flex-1 bg-transparent text-xs sm:text-sm py-1.5 focus:outline-none"
              />

              {/* Stop AI Speaking / Barge-In Button */}
              {conversationState === "SPEAKING" && (
                <button
                  type="button"
                  onClick={() => stopSpeaking(true)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all cursor-pointer shrink-0"
                  title="Interrupt / Hentikan suara AI sekarang"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">Stop</span>
                </button>
              )}

              <button
                type="submit"
                disabled={
                  !inputText.trim() || conversationState === "PROCESSING"
                }
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-md shadow-sky-500/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim</span>
              </button>
            </form>

            {/* Primary Call Control Buttons Row */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              {/* 1. Microphone Button */}
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs border shadow-md transition-all cursor-pointer ${
                  isListening
                    ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-emerald-500/25 scale-105"
                    : isDark
                      ? "bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-100"
                      : "bg-white hover:bg-slate-100 border-slate-300 text-slate-800"
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{isListening ? "Listening..." : "Microphone"}</span>
              </button>

              {/* Mute Microphone Toggle */}
              <button
                type="button"
                onClick={() => {
                  const nextMute = !isMicMuted;
                  setIsMicMuted(nextMute);
                  if (nextMute && isListening) stopListening();
                }}
                title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isMicMuted
                    ? "bg-rose-500/20 border-rose-500/50 text-rose-300"
                    : isDark
                      ? "bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white"
                      : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                {isMicMuted ? (
                  <MicOff className="w-3.5 h-3.5" />
                ) : (
                  <Mic className="w-3.5 h-3.5 opacity-70" />
                )}
              </button>

              {/* Quick Voice Simulator Button */}
              <button
                type="button"
                onClick={handleSimulatedVoiceTurn}
                title="Test percakapan suara instan"
                className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  isDark
                    ? "bg-slate-900/80 hover:bg-sky-500/15 border-slate-800 hover:border-sky-500/40 text-sky-300"
                    : "bg-white hover:bg-sky-50 border-slate-200 text-sky-700"
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Quick Voice</span>
              </button>

              {/* 2. Camera Button */}
              <button
                type="button"
                onClick={handleToggleCamera}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs border shadow-md transition-all cursor-pointer ${
                  isCameraActive && cameraSourceMode !== "screen"
                    ? "bg-sky-500 text-slate-950 border-sky-400 shadow-sky-500/25"
                    : isDark
                      ? "bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-100"
                      : "bg-white hover:bg-slate-100 border-slate-300 text-slate-800"
                }`}
              >
                {isCameraActive && cameraSourceMode !== "screen" ? (
                  <>
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>Camera Off</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>Camera</span>
                  </>
                )}
              </button>

              {/* 3. Screen Share Button */}
              <button
                type="button"
                onClick={handleToggleScreenShare}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs border shadow-md transition-all cursor-pointer ${
                  isCameraActive && cameraSourceMode === "screen"
                    ? "bg-indigo-500 text-white border-indigo-400 shadow-indigo-500/25"
                    : isDark
                      ? "bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-100"
                      : "bg-white hover:bg-slate-100 border-slate-300 text-slate-800"
                }`}
                title="Bagikan layar ke Gemini Vision"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {isCameraActive && cameraSourceMode === "screen"
                    ? "Stop Screen"
                    : "Screen Share"}
                </span>
              </button>

              {/* 4. Mute AI Voice & Volume Control */}
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                  isDark
                    ? "bg-slate-900/80 border-slate-800"
                    : "bg-white border-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    const nextMuted = !isAiMuted;
                    setIsAiMuted(nextMuted);
                    if (nextMuted) stopSpeaking(false);
                  }}
                  title={isAiMuted ? "Unmute AI Voice" : "Mute AI Voice"}
                  className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                    isAiMuted ? "text-rose-400" : "text-sky-400"
                  }`}
                >
                  {isAiMuted ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden md:inline">
                    {isAiMuted ? "AI Muted" : "Mute AI"}
                  </span>
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isAiMuted ? 0 : config.speakerVolume}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setIsAiMuted(val === 0);
                    onUpdateConfig({ speakerVolume: val });
                  }}
                  title={`Volume: ${Math.round(config.speakerVolume * 100)}%`}
                  className="w-16 sm:w-20 accent-sky-400 hidden sm:block"
                />
              </div>

              {/* 5. Mobile Chat Drawer Trigger Button */}
              <button
                type="button"
                onClick={() => setIsMobileChatOpen(true)}
                className={`lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold ${
                  isDark
                    ? "bg-slate-900 border-slate-700 text-slate-200"
                    : "bg-white border-slate-300 text-slate-800"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                <span>Chat ({messages.length})</span>
              </button>

              {/* 6. End Session Button */}
              <button
                type="button"
                onClick={handleEndSessionClick}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 font-bold text-xs transition-all cursor-pointer"
                title="End Session"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">End Session</span>
              </button>
            </div>
          </div>
        </main>

        {/* Right Side Chat Panel */}
        <ChatPanel
          messages={messages}
          aiName={config.aiName}
          conversationState={conversationState}
          isCameraActive={isCameraActive}
          isDark={isDark}
          isOpenMobile={isMobileChatOpen}
          autoSpeakEnabled={!isAiMuted && config.autoSpeak}
          onToggleAutoSpeak={() => {
            const nextAuto = isAiMuted || !config.autoSpeak;
            setIsAiMuted(!nextAuto);
            onUpdateConfig({ autoSpeak: nextAuto });
            if (!nextAuto) stopSpeaking(false);
          }}
          onCloseMobile={() => setIsMobileChatOpen(false)}
          onSendMessage={(text) => handleSendMessage(text, "text")}
          onSelectQuickPrompt={(prompt) => handleSendMessage(prompt, "text")}
          onSpeakMessage={(text) => speakText(text, "id", true)}
          onClearHistory={handleClearConversation}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onUpdateConfig={onUpdateConfig}
        availableVoices={availableVoices}
        longTermMemories={longTermMemories}
        onClearConversation={handleClearConversation}
        onClearSavedMemory={handleClearSavedMemory}
        onDeleteMemoryItem={handleDeleteMemoryItem}
      />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={userProfile}
        onUpdateProfile={onUpdateProfile}
        messagesCount={messages.length}
        memoriesCount={longTermMemories.length}
        isDark={isDark}
      />
    </div>
  );
};
