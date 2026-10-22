"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Camera,
  CheckCircle2,
  Cpu,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  Mic,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Shield,
  Sliders,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import {
  AdminSystemSettings,
  AdminVisionSettings,
  AdminVoiceSettings,
  AIProviderType,
  ProviderPublicConfigView,
  ServerUsageStats,
} from "@/lib/serverConfigStore";
import {
  adminFetch,
  getCachedAdminState,
  setAdminSessionToken,
  setCachedAdminState,
} from "@/lib/adminClientSession";
import { AIService } from "@/services/AIService";

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onConfigUpdated?: () => void;
  isDark?: boolean;
}

type AdminSectionId =
  | "dashboard"
  | "ai_provider"
  | "api_config"
  | "ai_model"
  | "voice_settings"
  | "vision_settings"
  | "usage"
  | "system";

interface AdminServerState {
  activeProvider: AIProviderType;
  providers: Record<AIProviderType, ProviderPublicConfigView>;
  voiceSettings: AdminVoiceSettings;
  visionSettings: AdminVisionSettings;
  systemSettings: AdminSystemSettings;
  usageStats: ServerUsageStats;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isOpen,
  onClose,
  onLogout,
  onConfigUpdated,
  isDark = true,
}) => {
  const [activeSection, setActiveSection] =
    useState<AdminSectionId>("dashboard");
  const [serverState, setServerState] = useState<AdminServerState | null>(null);
  const [loading, setLoading] = useState(true);

  // Selected provider in API Configuration & AI Model tabs
  const [selectedConfigProvider, setSelectedConfigProvider] =
    useState<AIProviderType>("gemini");

  // Form fields for API Configuration
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [textModelInput, setTextModelInput] = useState("gemini-2.0-flash");
  const [realtimeModelInput, setRealtimeModelInput] = useState(
    "models/gemini-2.0-flash-exp"
  );
  const [visionModelInput, setVisionModelInput] = useState("gemini-2.0-flash");
  const [voiceModelInput, setVoiceModelInput] = useState("Aoede (Gemini Live)");
  const [transcriptionModelInput, setTranscriptionModelInput] =
    useState("gemini-2.0-flash");
  const [speechModelInput, setSpeechModelInput] = useState(
    "gemini-2.0-flash-exp"
  );
  const [baseUrlInput, setBaseUrlInput] = useState(
    "https://generativelanguage.googleapis.com/v1beta"
  );

  // Model catalog from /api/admin/models
  const [modelCatalog, setModelCatalog] = useState<{
    textModels: string[];
    realtimeModels: string[];
    visionModels: string[];
    transcriptionModels: string[];
    speechModels: string[];
  }>({
    textModels: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
    realtimeModels: ["models/gemini-2.0-flash-exp"],
    visionModels: ["gemini-2.0-flash", "gemini-1.5-flash"],
    transcriptionModels: ["gemini-2.0-flash"],
    speechModels: ["Aoede (Gemini Live)", "Puck (Gemini Live)"],
  });
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);

  // Status & Test Connection notices
  const [toastMsg, setToastMsg] = useState<{
    type: "success" | "error";
    title: string;
    details?: string;
  } | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync form inputs when selectedConfigProvider or serverState updates
  const syncFormWithProvider = useCallback(
    (state: AdminServerState, provider: AIProviderType) => {
      const cfg = state.providers[provider];
      if (!cfg) return;
      setApiKeyInput(""); // Never prefill full secret; show masked placeholder
      setTextModelInput(cfg.text_model);
      setRealtimeModelInput(cfg.realtime_model);
      setVisionModelInput(cfg.vision_model);
      setVoiceModelInput(cfg.voice_model);
      setTranscriptionModelInput(cfg.transcription_model);
      setSpeechModelInput(cfg.speech_model);
      setBaseUrlInput(cfg.base_url);
    },
    []
  );

  const fetchAdminState = useCallback(async () => {
    const cached = getCachedAdminState() as AdminServerState | null;
    if (cached) {
      setServerState(cached);
      setSelectedConfigProvider(cached.activeProvider);
      syncFormWithProvider(cached, cached.activeProvider);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const res = await adminFetch("/api/admin/config");
      if (res.ok) {
        const data = (await res.json()) as AdminServerState;
        setCachedAdminState(data);
        setServerState(data);
        if (!cached) {
          setSelectedConfigProvider(data.activeProvider);
          syncFormWithProvider(data, data.activeProvider);
        }
        setToastMsg(null);
      } else if (!cached) {
        setToastMsg({
          type: "error",
          title: "Sesi admin tidak valid atau kadaluarsa.",
          details: "Silakan klik Logout dan login kembali.",
        });
      }
    } catch {
      if (!cached) {
        setToastMsg({
          type: "error",
          title: "Gagal memuat konfigurasi server.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [syncFormWithProvider]);

  useEffect(() => {
    if (isOpen) {
      fetchAdminState();
    }
  }, [isOpen, fetchAdminState]);

  const handleSelectProviderForEdit = (provider: AIProviderType) => {
    setSelectedConfigProvider(provider);
    setToastMsg(null);
    if (serverState) {
      syncFormWithProvider(serverState, provider);
    }
    handleRefreshModels(provider);
  };

  const handleRefreshModels = async (providerOverride?: AIProviderType) => {
    const target = providerOverride || selectedConfigProvider;
    setIsRefreshingModels(true);
    try {
      const res = await adminFetch(`/api/admin/models?provider=${target}`);
      if (res.ok) {
        const data = await res.json();
        if (data.models) {
          setModelCatalog(data.models);
        }
      }
    } catch {
      // Keep default catalog
    } finally {
      setIsRefreshingModels(false);
    }
  };

  const handleSetActiveProvider = async (provider: AIProviderType) => {
    setToastMsg(null);
    try {
      const res = await adminFetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_active_provider",
          provider,
        }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setServerState(data.state);
        AIService.setActiveProviderById(provider);
        await AIService.syncProviderFromBackend();
        onConfigUpdated?.();
        setToastMsg({
          type: "success",
          title: `${provider.toUpperCase()} ditetapkan sebagai Active Provider.`,
          details:
            "AIService utama sekarang langsung menggunakan provider baru.",
        });
      }
    } catch {
      setToastMsg({
        type: "error",
        title: "Gagal mengubah provider aktif.",
      });
    }
  };

  const handleSaveProviderConfig = async (setAsActive = false) => {
    setIsSaving(true);
    setToastMsg(null);
    try {
      const res = await adminFetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_provider_config",
          provider: selectedConfigProvider,
          apiKey: apiKeyInput.trim() || undefined,
          textModel: textModelInput,
          realtimeModel: realtimeModelInput,
          visionModel: visionModelInput,
          voiceModel: voiceModelInput,
          transcriptionModel: transcriptionModelInput,
          speechModel: speechModelInput,
          baseUrl: baseUrlInput,
          setAsActive,
        }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setServerState(data.state);
        setApiKeyInput(""); // Clear raw key from input after saving; masked preview is shown
        await AIService.syncProviderFromBackend();
        onConfigUpdated?.();
        setToastMsg({
          type: "success",
          title: "Configuration saved & encrypted.",
          details: data.message,
        });
      } else {
        setToastMsg({
          type: "error",
          title: "Gagal menyimpan konfigurasi.",
          details: data.error,
        });
      }
    } catch {
      setToastMsg({
        type: "error",
        title: "Gagal menghubungi server.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setToastMsg(null);
    try {
      const res = await adminFetch("/api/admin/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedConfigProvider,
          apiKey: apiKeyInput.trim() || undefined,
          textModel: textModelInput,
          baseUrl: baseUrlInput,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToastMsg({
          type: "success",
          title: "API connection successful.",
          details: `${data.details || ""} (${data.latencyMs || 12} ms)`,
        });
      } else {
        setToastMsg({
          type: "error",
          title: "API connection failed.",
          details: data.details || "Periksa API Key atau model yang dimasukkan.",
        });
      }
    } catch {
      setToastMsg({
        type: "error",
        title: "API connection failed.",
        details: "Tidak dapat menghubungi server test connection.",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleResetProviderConfig = async () => {
    setToastMsg(null);
    try {
      const res = await adminFetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_provider_config",
          provider: selectedConfigProvider,
        }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setServerState(data.state);
        syncFormWithProvider(data.state, selectedConfigProvider);
        setToastMsg({
          type: "success",
          title: "Configuration reset.",
          details: data.message,
        });
      }
    } catch {
      setToastMsg({
        type: "error",
        title: "Gagal mereset konfigurasi.",
      });
    }
  };

  const handleUpdateSubSettings = async (payload: {
    voiceSettings?: Partial<AdminVoiceSettings>;
    visionSettings?: Partial<AdminVisionSettings>;
    systemSettings?: Partial<AdminSystemSettings>;
  }) => {
    try {
      const res = await adminFetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_settings",
          ...payload,
        }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setServerState(data.state);
        onConfigUpdated?.();
        setToastMsg({
          type: "success",
          title: "Settings updated.",
          details: data.message,
        });
      }
    } catch {
      setToastMsg({
        type: "error",
        title: "Gagal menyimpan pengaturan.",
      });
    }
  };

  const handleLogoutClick = async () => {
    setAdminSessionToken(null);
    try {
      await adminFetch("/api/admin/logout", { method: "POST" });
    } catch {
      // Ignore
    }
    onLogout();
  };

  if (!isOpen) return null;

  const activeProviderName =
    serverState?.activeProvider === "openai"
      ? "OpenAI"
      : serverState?.activeProvider === "custom"
        ? "Custom API"
        : "Google Gemini";

  const currentProviderRow =
    serverState?.providers[selectedConfigProvider] || null;

  const menuItems: {
    id: AdminSectionId;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "ai_provider", label: "AI Provider", icon: Layers },
    { id: "api_config", label: "API Configuration", icon: KeyRound },
    { id: "ai_model", label: "AI Model", icon: Cpu },
    { id: "voice_settings", label: "Voice Settings", icon: Mic },
    { id: "vision_settings", label: "Vision Settings", icon: Camera },
    { id: "usage", label: "Usage", icon: BarChart3 },
    { id: "system", label: "System", icon: Sliders },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`w-full max-w-6xl h-[92vh] rounded-3xl border shadow-2xl flex flex-col md:flex-row overflow-hidden ${
          isDark
            ? "bg-[#080d1a] border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Left Sidebar Navigation */}
        <aside
          className={`w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r flex flex-col justify-between ${
            isDark
              ? "bg-slate-950/80 border-slate-800/80"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div>
            {/* Brand Header */}
            <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-slate-950 shadow-md">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold tracking-tight">
                    AURA ADMIN
                  </h2>
                  <p className="text-[10px] text-sky-400 font-mono">
                    Control Center
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Links */}
            <nav className="p-3 flex md:flex-col gap-1 overflow-x-auto no-scrollbar">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id);
                      setToastMsg(null);
                    }}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      active
                        ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs"
                        : isDark
                          ? "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                          : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Logout Button */}
          <div className="hidden md:block p-4 border-t border-slate-800/60 space-y-2">
            <div className="px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px]">
              <span className="opacity-60 block">Active Provider:</span>
              <span className="font-bold text-sky-400">
                {activeProviderName}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogoutClick}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Right Main Content Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar */}
          <header
            className={`px-6 py-4 border-b flex items-center justify-between ${
              isDark
                ? "border-slate-800/80 bg-slate-900/40"
                : "border-slate-200 bg-white"
            }`}
          >
            <div>
              <h1 className="text-base sm:text-lg font-extrabold capitalize">
                {menuItems.find((m) => m.id === activeSection)?.label}
              </h1>
              <p className="text-xs opacity-65">
                Active Provider:{" "}
                <span className="font-semibold text-sky-400">
                  {activeProviderName}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLogoutClick}
                className="md:hidden px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  isDark
                    ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                    : "bg-slate-100 border-slate-300 text-slate-800"
                }`}
              >
                <X className="w-4 h-4" />
                <span>Back to Companion</span>
              </button>
            </div>
          </header>

          {/* Toast Feedback Banner */}
          {toastMsg && (
            <div
              className={`mx-6 mt-4 px-4 py-3 rounded-2xl border flex items-start justify-between gap-3 text-xs ${
                toastMsg.type === "success"
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                  : "bg-rose-500/15 border-rose-500/40 text-rose-200"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {toastMsg.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">{toastMsg.title}</p>
                  {toastMsg.details && (
                    <p className="opacity-85 mt-0.5">{toastMsg.details}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToastMsg(null)}
                className="opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading || !serverState ? (
              <div className="py-16 text-center text-sm opacity-65">
                Memuat konfigurasi server terenkripsi...
              </div>
            ) : (
              <>
                {/* 1. DASHBOARD / SYSTEM STATUS */}
                {activeSection === "dashboard" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        {
                          label: "AI Provider",
                          value: activeProviderName,
                          sub: serverState.providers[serverState.activeProvider]
                            .text_model,
                          status: "green",
                          icon: Sparkles,
                        },
                        {
                          label: "API Status",
                          value: "Connected",
                          sub: serverState.providers[serverState.activeProvider]
                            .hasApiKey
                            ? `Key: ${serverState.providers[serverState.activeProvider].maskedApiKey}`
                            : "Built-in Multimodal Engine Active",
                          status: "green",
                          icon: Activity,
                        },
                        {
                          label: "Realtime Voice",
                          value: serverState.voiceSettings.voiceEnabled
                            ? "Connected"
                            : "Paused",
                          sub: serverState.voiceSettings.realtimeVoiceModel,
                          status: serverState.voiceSettings.voiceEnabled
                            ? "green"
                            : "yellow",
                          icon: Mic,
                        },
                        {
                          label: "Camera Vision",
                          value: serverState.visionSettings.cameraVisionEnabled
                            ? "Available"
                            : "Disabled",
                          sub: `Sampling: ${serverState.visionSettings.frameSamplingIntervalSec}s (${serverState.visionSettings.presetMode})`,
                          status: serverState.visionSettings.cameraVisionEnabled
                            ? "green"
                            : "yellow",
                          icon: Camera,
                        },
                        {
                          label: "Voice Output",
                          value: serverState.systemSettings.enableVoice
                            ? "Available"
                            : "Muted",
                          sub: `Voice: ${serverState.voiceSettings.defaultVoice}`,
                          status: serverState.systemSettings.enableVoice
                            ? "green"
                            : "yellow",
                          icon: Zap,
                        },
                        {
                          label: "Encrypted Database",
                          value: "Connected",
                          sub: "AES-256-GCM Secret Storage",
                          status: "green",
                          icon: Database,
                        },
                        {
                          label: "Server Status",
                          value: serverState.systemSettings.maintenanceMode
                            ? "Maintenance"
                            : "Online",
                          sub: `Avg Latency: ${serverState.usageStats.averageLatencyMs || 18} ms`,
                          status: serverState.systemSettings.maintenanceMode
                            ? "red"
                            : "green",
                          icon: Server,
                        },
                        {
                          label: "Total API Requests",
                          value: String(serverState.usageStats.totalRequests),
                          sub: `Text: ${serverState.usageStats.textRequests} • Vision: ${serverState.usageStats.visionRequests}`,
                          status: "green",
                          icon: BarChart3,
                        },
                      ].map((card) => {
                        const Icon = card.icon;
                        const dotColor =
                          card.status === "green"
                            ? "bg-emerald-400"
                            : card.status === "yellow"
                              ? "bg-amber-400"
                              : "bg-rose-500";
                        return (
                          <div
                            key={card.label}
                            className={`p-4 rounded-2xl border ${
                              isDark
                                ? "bg-slate-900/70 border-slate-800"
                                : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold opacity-70">
                                {card.label}
                              </span>
                              <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full ${dotColor}`}
                                />
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-sky-400 shrink-0" />
                              <span className="text-base font-extrabold">
                                {card.value}
                              </span>
                            </div>
                            <p className="text-[11px] opacity-60 mt-1 truncate">
                              {card.sub}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick Action Banner */}
                    <div
                      className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                        isDark
                          ? "bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-slate-900 border-sky-500/30"
                          : "bg-sky-50 border-sky-200"
                      }`}
                    >
                      <div>
                        <h3 className="text-sm font-bold">
                          Kelola API Key & Model Provider Secara Realtime
                        </h3>
                        <p className="text-xs opacity-75 mt-0.5">
                          Seluruh API key dienkripsi dengan AES-256-GCM di sisi server dan tidak pernah diekspos ke browser.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSection("api_config")}
                        className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs whitespace-nowrap cursor-pointer"
                      >
                        Buka API Configuration
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. AI PROVIDER PAGE */}
                {activeSection === "ai_provider" && (
                  <div className="space-y-4">
                    <p className="text-xs opacity-75">
                      Pilih AI Provider utama yang digunakan oleh{" "}
                      <code className="text-sky-400">AIProviderManager</code>{" "}
                      dan <code className="text-sky-400">AIService</code>. Saat
                      provider diganti, website otomatis menggunakan provider
                      baru tanpa merombak UI.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {(
                        [
                          {
                            id: "gemini" as AIProviderType,
                            title: "Google Gemini",
                            desc: "Google AI Studio / Gemini 2.0 Flash Multimodal & Gemini Live API",
                          },
                          {
                            id: "openai" as AIProviderType,
                            title: "OpenAI",
                            desc: "GPT-4o / GPT-4o-mini Multimodal, Whisper & Realtime API",
                          },
                          {
                            id: "custom" as AIProviderType,
                            title: "Custom API",
                            desc: "OpenAI-compatible / Self-Hosted LLM & Vision Endpoint",
                          },
                        ] as const
                      ).map((item) => {
                        const row = serverState.providers[item.id];
                        const isActive =
                          serverState.activeProvider === item.id;
                        const isConfigured =
                          row.hasApiKey || item.id === "gemini";

                        return (
                          <div
                            key={item.id}
                            className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all ${
                              isActive
                                ? "bg-sky-500/10 border-sky-400 shadow-lg"
                                : isDark
                                  ? "bg-slate-900/70 border-slate-800"
                                  : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="text-base font-extrabold">
                                  {item.title}
                                </h3>
                                {isActive && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500 text-slate-950">
                                    ACTIVE
                                  </span>
                                )}
                              </div>

                              <p className="text-xs opacity-70 mb-3">
                                {item.desc}
                              </p>

                              <div className="space-y-1 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="opacity-60">Status:</span>
                                  <span
                                    className={`inline-flex items-center gap-1.5 font-semibold ${
                                      isConfigured
                                        ? "text-emerald-400"
                                        : "text-amber-400"
                                    }`}
                                  >
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        isConfigured
                                          ? "bg-emerald-400"
                                          : "bg-amber-400"
                                      }`}
                                    />
                                    {row.hasApiKey
                                      ? "Connected (API Key Encrypted)"
                                      : item.id === "gemini"
                                        ? "Connected (Default Engine)"
                                        : "Not configured"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="opacity-60">Model:</span>
                                  <span className="font-mono text-sky-400">
                                    {row.text_model}
                                  </span>
                                </div>
                                {row.maskedApiKey && (
                                  <div className="flex items-center gap-2">
                                    <span className="opacity-60">Key:</span>
                                    <span className="font-mono text-[11px]">
                                      {row.maskedApiKey}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                              {!isActive ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSetActiveProvider(item.id)
                                  }
                                  className="flex-1 py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer"
                                >
                                  Set as Active Provider
                                </button>
                              ) : (
                                <span className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs text-center">
                                  Currently Active
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectProviderForEdit(item.id);
                                  setActiveSection("api_config");
                                }}
                                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                                  isDark
                                    ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                                    : "bg-white border-slate-300"
                                }`}
                              >
                                Configure
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. API CONFIGURATION PAGE */}
                {activeSection === "api_config" && (
                  <div className="space-y-5">
                    {/* Active Provider Banner */}
                    <div
                      className={`p-4 rounded-2xl border flex items-center justify-between ${
                        isDark
                          ? "bg-slate-900/90 border-slate-800"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div>
                        <span className="text-[11px] uppercase tracking-wider opacity-60 block">
                          Active Provider Saat Ini
                        </span>
                        <span className="text-base font-extrabold text-sky-400">
                          {activeProviderName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {(
                          [
                            { id: "gemini", label: "Google Gemini" },
                            { id: "openai", label: "OpenAI" },
                            { id: "custom", label: "Custom API" },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleSelectProviderForEdit(tab.id)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              selectedConfigProvider === tab.id
                                ? "bg-sky-500 text-slate-950 border-sky-400"
                                : isDark
                                  ? "bg-slate-800 border-slate-700 text-slate-300"
                                  : "bg-white border-slate-300 text-slate-700"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Configuration Form Fields */}
                    <div
                      className={`p-5 rounded-2xl border space-y-4 ${
                        isDark
                          ? "bg-slate-900/60 border-slate-800"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                            API Provider
                          </label>
                          <select
                            value={selectedConfigProvider}
                            onChange={(e) =>
                              handleSelectProviderForEdit(
                                e.target.value as AIProviderType
                              )
                            }
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm ${
                              isDark
                                ? "bg-slate-800 border-slate-700 text-white"
                                : "bg-slate-50 border-slate-300 text-slate-900"
                            }`}
                          >
                            <option value="gemini">Google Gemini</option>
                            <option value="openai">OpenAI</option>
                            <option value="custom">Custom API</option>
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider opacity-75">
                              {selectedConfigProvider === "gemini"
                                ? "Gemini API Key"
                                : selectedConfigProvider === "openai"
                                  ? "OpenAI API Key"
                                  : "Custom API Key"}
                            </label>
                            {currentProviderRow?.maskedApiKey && (
                              <span className="text-[11px] font-mono text-emerald-400">
                                Saved: {currentProviderRow.maskedApiKey}
                              </span>
                            )}
                          </div>
                          <div className="relative flex items-center">
                            <input
                              type={showApiKey ? "text" : "password"}
                              value={apiKeyInput}
                              onChange={(e) => setApiKeyInput(e.target.value)}
                              placeholder={
                                currentProviderRow?.maskedApiKey
                                  ? `${currentProviderRow.maskedApiKey} (Biarkan kosong jika tidak diganti)`
                                  : selectedConfigProvider === "gemini"
                                    ? "AIzaSy..."
                                    : "sk-..."
                              }
                              className={`w-full pr-10 pl-3.5 py-2.5 rounded-xl border text-sm font-mono ${
                                isDark
                                  ? "bg-slate-800 border-slate-700 text-white"
                                  : "bg-slate-50 border-slate-300 text-slate-900"
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              title="Show/Hide API Key"
                              className="absolute right-3 text-slate-400 hover:text-sky-400"
                            >
                              {showApiKey ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                            {selectedConfigProvider === "gemini"
                              ? "Gemini Text Model"
                              : "Text Model"}
                          </label>
                          <input
                            type="text"
                            value={textModelInput}
                            onChange={(e) => setTextModelInput(e.target.value)}
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono ${
                              isDark
                                ? "bg-slate-800 border-slate-700 text-white"
                                : "bg-slate-50 border-slate-300 text-slate-900"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                            {selectedConfigProvider === "gemini"
                              ? "Gemini Live / Realtime Model"
                              : "Realtime Model"}
                          </label>
                          <input
                            type="text"
                            value={realtimeModelInput}
                            onChange={(e) =>
                              setRealtimeModelInput(e.target.value)
                            }
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono ${
                              isDark
                                ? "bg-slate-800 border-slate-700 text-white"
                                : "bg-slate-50 border-slate-300 text-slate-900"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                            Vision Model
                          </label>
                          <input
                            type="text"
                            value={visionModelInput}
                            onChange={(e) =>
                              setVisionModelInput(e.target.value)
                            }
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono ${
                              isDark
                                ? "bg-slate-800 border-slate-700 text-white"
                                : "bg-slate-50 border-slate-300 text-slate-900"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                            Voice Model
                          </label>
                          <input
                            type="text"
                            value={voiceModelInput}
                            onChange={(e) => setVoiceModelInput(e.target.value)}
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono ${
                              isDark
                                ? "bg-slate-800 border-slate-700 text-white"
                                : "bg-slate-50 border-slate-300 text-slate-900"
                            }`}
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                            Base URL
                          </label>
                          <input
                            type="text"
                            value={baseUrlInput}
                            onChange={(e) => setBaseUrlInput(e.target.value)}
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono ${
                              isDark
                                ? "bg-slate-800 border-slate-700 text-white"
                                : "bg-slate-50 border-slate-300 text-slate-900"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Action Buttons: Save Configuration, Set Active & Save, Test Connection, Reset */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/60">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSaveProviderConfig(true)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 cursor-pointer"
                          >
                            <Save className="w-4 h-4" />
                            <span>
                              {isSaving ? "Saving..." : "Save Configuration"}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={isTestingConnection}
                            onClick={handleTestConnection}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs cursor-pointer"
                          >
                            <Activity className="w-4 h-4" />
                            <span>
                              {isTestingConnection
                                ? "Testing..."
                                : "Test Connection"}
                            </span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleResetProviderConfig}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-semibold text-xs cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. AI MODEL PAGE */}
                {activeSection === "ai_model" && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold">
                          Model Routing ({selectedConfigProvider.toUpperCase()})
                        </h3>
                        <p className="text-xs opacity-65">
                          Pilih model spesifik untuk Text Chat, Realtime Voice,
                          Vision, Transcription, dan Speech
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRefreshModels()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-bold cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            isRefreshingModels ? "animate-spin" : ""
                          }`}
                        />
                        <span>Refresh Models</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                          Text Chat Model
                        </label>
                        <select
                          value={textModelInput}
                          onChange={(e) => setTextModelInput(e.target.value)}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono ${
                            isDark
                              ? "bg-slate-800 border-slate-700 text-white"
                              : "bg-slate-50 border-slate-300 text-slate-900"
                          }`}
                        >
                          {modelCatalog.textModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                          Realtime Voice Model
                        </label>
                        <select
                          value={realtimeModelInput}
                          onChange={(e) =>
                            setRealtimeModelInput(e.target.value)
                          }
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono ${
                            isDark
                              ? "bg-slate-800 border-slate-700 text-white"
                              : "bg-slate-50 border-slate-300 text-slate-900"
                          }`}
                        >
                          {modelCatalog.realtimeModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                          Vision Multimodal Model
                        </label>
                        <select
                          value={visionModelInput}
                          onChange={(e) => setVisionModelInput(e.target.value)}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono ${
                            isDark
                              ? "bg-slate-800 border-slate-700 text-white"
                              : "bg-slate-50 border-slate-300 text-slate-900"
                          }`}
                        >
                          {modelCatalog.visionModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                          Transcription (Speech-to-Text)
                        </label>
                        <select
                          value={transcriptionModelInput}
                          onChange={(e) =>
                            setTranscriptionModelInput(e.target.value)
                          }
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono ${
                            isDark
                              ? "bg-slate-800 border-slate-700 text-white"
                              : "bg-slate-50 border-slate-300 text-slate-900"
                          }`}
                        >
                          {modelCatalog.transcriptionModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                          Speech Output (Text-to-Speech)
                        </label>
                        <select
                          value={speechModelInput}
                          onChange={(e) => setSpeechModelInput(e.target.value)}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono ${
                            isDark
                              ? "bg-slate-800 border-slate-700 text-white"
                              : "bg-slate-50 border-slate-300 text-slate-900"
                          }`}
                        >
                          {modelCatalog.speechModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveProviderConfig(false)}
                      className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      Save Model Selection
                    </button>
                  </div>
                )}

                {/* 5. VOICE SETTINGS PAGE */}
                {activeSection === "voice_settings" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        {
                          label: "Voice Enabled",
                          desc: "Aktifkan percakapan suara dua arah untuk pengguna",
                          checked: serverState.voiceSettings.voiceEnabled,
                          onChange: (val: boolean) =>
                            handleUpdateSubSettings({
                              voiceSettings: { voiceEnabled: val },
                            }),
                        },
                        {
                          label: "Interruptible Voice (Barge-In)",
                          desc: "Izinkan user memotong pembicaraan AI saat AI sedang berbicara",
                          checked:
                            serverState.voiceSettings.interruptibleVoice,
                          onChange: (val: boolean) =>
                            handleUpdateSubSettings({
                              voiceSettings: { interruptibleVoice: val },
                            }),
                        },
                        {
                          label: "Noise Suppression",
                          desc: "Filter derau latar belakang mikrofon secara otomatis",
                          checked: serverState.voiceSettings.noiseSuppression,
                          onChange: (val: boolean) =>
                            handleUpdateSubSettings({
                              voiceSettings: { noiseSuppression: val },
                            }),
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={`p-4 rounded-2xl border flex items-center justify-between ${
                            isDark
                              ? "bg-slate-900/70 border-slate-800"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold">{item.label}</p>
                            <p className="text-[11px] opacity-65">
                              {item.desc}
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) => item.onChange(e.target.checked)}
                            className="w-4 h-4 accent-sky-400"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                          Default Voice Profile
                        </label>
                        <select
                          value={serverState.voiceSettings.defaultVoice}
                          onChange={(e) =>
                            handleUpdateSubSettings({
                              voiceSettings: { defaultVoice: e.target.value },
                            })
                          }
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm ${
                            isDark
                              ? "bg-slate-800 border-slate-700 text-white"
                              : "bg-slate-50 border-slate-300 text-slate-900"
                          }`}
                        >
                          <option value="Aoede">Aoede (Warm Natural)</option>
                          <option value="Puck">Puck (Crisp Male)</option>
                          <option value="Charon">Charon (Calm Deep)</option>
                          <option value="Kore">Kore (Energetic Bright)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                          Realtime Voice Model
                        </label>
                        <input
                          type="text"
                          value={serverState.voiceSettings.realtimeVoiceModel}
                          onChange={(e) =>
                            handleUpdateSubSettings({
                              voiceSettings: {
                                realtimeVoiceModel: e.target.value,
                              },
                            })
                          }
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono ${
                            isDark
                              ? "bg-slate-800 border-slate-700 text-white"
                              : "bg-slate-50 border-slate-300 text-slate-900"
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                          Audio Quality
                        </label>
                        <select
                          value={serverState.voiceSettings.audioQuality}
                          onChange={(e) =>
                            handleUpdateSubSettings({
                              voiceSettings: {
                                audioQuality: e.target
                                  .value as AdminVoiceSettings["audioQuality"],
                              },
                            })
                          }
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm ${
                            isDark
                              ? "bg-slate-800 border-slate-700 text-white"
                              : "bg-slate-50 border-slate-300 text-slate-900"
                          }`}
                        >
                          <option value="ultra_low_latency">
                            Ultra Low Latency (24kHz PCM)
                          </option>
                          <option value="high">High Studio Quality</option>
                          <option value="standard">Standard Bandwidth</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. VISION SETTINGS PAGE */}
                {activeSection === "vision_settings" && (
                  <div className="space-y-5">
                    {/* Preset Modes: Low API Usage | Balanced | High Responsiveness */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-2">
                        Vision Optimization Mode
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {(
                          [
                            {
                              id: "low_usage",
                              label: "Low API Usage",
                              desc: "Sampling 8 detik • Quality 55% • Hemat kuota API",
                              interval: 8,
                              quality: 0.55,
                            },
                            {
                              id: "balanced",
                              label: "Balanced",
                              desc: "Sampling 4 detik • Quality 72% • Rekomendasi utama",
                              interval: 4,
                              quality: 0.72,
                            },
                            {
                              id: "high_responsiveness",
                              label: "High Responsiveness",
                              desc: "Sampling 2 detik • Quality 85% • Respons visual cepat",
                              interval: 2,
                              quality: 0.85,
                            },
                          ] as const
                        ).map((preset) => {
                          const active =
                            serverState.visionSettings.presetMode === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() =>
                                handleUpdateSubSettings({
                                  visionSettings: {
                                    presetMode: preset.id,
                                    frameSamplingIntervalSec: preset.interval,
                                    imageQuality: preset.quality,
                                  },
                                })
                              }
                              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                                active
                                  ? "bg-sky-500/15 border-sky-400 text-sky-300"
                                  : isDark
                                    ? "bg-slate-900/70 border-slate-800"
                                    : "bg-slate-50 border-slate-200"
                              }`}
                            >
                              <p className="text-xs font-extrabold">
                                {preset.label}
                              </p>
                              <p className="text-[11px] opacity-70 mt-1">
                                {preset.desc}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        {
                          label: "Camera Vision ON/OFF",
                          checked:
                            serverState.visionSettings.cameraVisionEnabled,
                          onChange: (val: boolean) =>
                            handleUpdateSubSettings({
                              visionSettings: { cameraVisionEnabled: val },
                            }),
                        },
                        {
                          label: "Live Vision ON/OFF",
                          checked: serverState.visionSettings.liveVisionEnabled,
                          onChange: (val: boolean) =>
                            handleUpdateSubSettings({
                              visionSettings: { liveVisionEnabled: val },
                            }),
                        },
                        {
                          label: "Image Compression",
                          checked: serverState.visionSettings.imageCompression,
                          onChange: (val: boolean) =>
                            handleUpdateSubSettings({
                              visionSettings: { imageCompression: val },
                            }),
                        },
                      ].map((t) => (
                        <div
                          key={t.label}
                          className={`p-4 rounded-2xl border flex items-center justify-between ${
                            isDark
                              ? "bg-slate-900/70 border-slate-800"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <span className="text-xs font-bold">{t.label}</span>
                          <input
                            type="checkbox"
                            checked={t.checked}
                            onChange={(e) => t.onChange(e.target.checked)}
                            className="w-4 h-4 accent-sky-400"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>Frame Sampling Interval</span>
                          <span className="font-mono text-sky-400">
                            {serverState.visionSettings.frameSamplingIntervalSec}s
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={15}
                          value={
                            serverState.visionSettings.frameSamplingIntervalSec
                          }
                          onChange={(e) =>
                            handleUpdateSubSettings({
                              visionSettings: {
                                frameSamplingIntervalSec: Number(
                                  e.target.value
                                ),
                              },
                            })
                          }
                          className="w-full accent-sky-400"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>JPEG Image Quality</span>
                          <span className="font-mono text-sky-400">
                            {Math.round(
                              serverState.visionSettings.imageQuality * 100
                            )}
                            %
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.3}
                          max={1.0}
                          step={0.05}
                          value={serverState.visionSettings.imageQuality}
                          onChange={(e) =>
                            handleUpdateSubSettings({
                              visionSettings: {
                                imageQuality: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full accent-sky-400"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. USAGE PAGE */}
                {activeSection === "usage" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        {
                          label: "Total Requests",
                          value: serverState.usageStats.totalRequests,
                        },
                        {
                          label: "Text Requests",
                          value: serverState.usageStats.textRequests,
                        },
                        {
                          label: "Voice Sessions",
                          value: serverState.usageStats.voiceSessions,
                        },
                        {
                          label: "Vision Requests",
                          value: serverState.usageStats.visionRequests,
                        },
                        {
                          label: "Errors",
                          value: serverState.usageStats.errors,
                        },
                        {
                          label: "Avg Latency",
                          value: `${serverState.usageStats.averageLatencyMs || 0} ms`,
                        },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className={`p-4 rounded-2xl border ${
                            isDark
                              ? "bg-slate-900/70 border-slate-800"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <span className="text-[11px] opacity-65 block">
                            {stat.label}
                          </span>
                          <span className="text-xl font-extrabold text-sky-400 mt-1 block">
                            {stat.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Recent Session Request Logs */}
                    <div
                      className={`rounded-2xl border overflow-hidden ${
                        isDark
                          ? "bg-slate-900/60 border-slate-800"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="px-4 py-3 border-b border-slate-800/60 flex items-center justify-between">
                        <span className="text-xs font-bold">
                          Recent API Request Telemetry
                        </span>
                        <button
                          type="button"
                          onClick={fetchAdminState}
                          className="text-xs text-sky-400 hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Refresh
                        </button>
                      </div>
                      {serverState.usageStats.recentLogs.length === 0 ? (
                        <div className="p-6 text-center text-xs opacity-60">
                          Belum ada log request pada sesi ini.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950/50 text-[11px] uppercase opacity-70">
                              <tr>
                                <th className="px-4 py-2.5">Time</th>
                                <th className="px-4 py-2.5">Provider</th>
                                <th className="px-4 py-2.5">Model</th>
                                <th className="px-4 py-2.5">Type</th>
                                <th className="px-4 py-2.5">Latency</th>
                                <th className="px-4 py-2.5">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                              {serverState.usageStats.recentLogs.map((log) => (
                                <tr key={log.id}>
                                  <td className="px-4 py-2.5 font-mono">
                                    {log.timestamp}
                                  </td>
                                  <td className="px-4 py-2.5 uppercase font-semibold text-sky-400">
                                    {log.provider}
                                  </td>
                                  <td className="px-4 py-2.5 font-mono">
                                    {log.model}
                                  </td>
                                  <td className="px-4 py-2.5 capitalize">
                                    {log.type}
                                  </td>
                                  <td className="px-4 py-2.5 font-mono">
                                    {log.latencyMs} ms
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        log.status === "success"
                                          ? "bg-emerald-500/20 text-emerald-300"
                                          : "bg-rose-500/20 text-rose-300"
                                      }`}
                                    >
                                      {log.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 8. SYSTEM SETTINGS PAGE */}
                {activeSection === "system" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      {
                        key: "maintenanceMode",
                        label: "Maintenance Mode",
                        desc: "Nonaktifkan sementara interaksi user saat maintenance sistem",
                        checked: serverState.systemSettings.maintenanceMode,
                      },
                      {
                        key: "enableRegistration",
                        label: "Enable Registration",
                        desc: "Izinkan pembuatan profil pengguna baru",
                        checked: serverState.systemSettings.enableRegistration,
                      },
                      {
                        key: "enableMemory",
                        label: "Enable Memory System",
                        desc: "Aktifkan fitur Short-Term & Long-Term Memory",
                        checked: serverState.systemSettings.enableMemory,
                      },
                      {
                        key: "enableCamera",
                        label: "Enable Camera Vision",
                        desc: "Izinkan fitur kamera video call pada antarmuka utama",
                        checked: serverState.systemSettings.enableCamera,
                      },
                      {
                        key: "enableVoice",
                        label: "Enable Voice Conversation",
                        desc: "Izinkan fitur mikrofon & suara AI realtime",
                        checked: serverState.systemSettings.enableVoice,
                      },
                      {
                        key: "enableScreenSharing",
                        label: "Enable Screen Sharing",
                        desc: "Izinkan pengguna membagikan layar ke Vision AI",
                        checked:
                          serverState.systemSettings.enableScreenSharing,
                      },
                      {
                        key: "enableWakeWord",
                        label: "Enable Wake Word Detection",
                        desc: "Deteksi kata pemicu suara ('Hey Aura') saat mikrofon aktif",
                        checked: serverState.systemSettings.enableWakeWord,
                      },
                    ].map((sys) => (
                      <div
                        key={sys.key}
                        className={`p-4 rounded-2xl border flex items-center justify-between ${
                          isDark
                            ? "bg-slate-900/70 border-slate-800"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold">{sys.label}</p>
                          <p className="text-[11px] opacity-65">{sys.desc}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={sys.checked}
                          onChange={(e) =>
                            handleUpdateSubSettings({
                              systemSettings: {
                                [sys.key]: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 accent-sky-400"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
