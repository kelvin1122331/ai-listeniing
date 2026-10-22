"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Camera,
  Check,
  Mic,
  Moon,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserCheck,
  Volume2,
  X,
} from "lucide-react";
import {
  AVATAR_PRESETS,
  COMPANION_MODES,
} from "@/constants/companionPresets";
import {
  CompanionConfig,
  LongTermMemoryItem,
  PersonalityPreset,
  PreferredLanguage,
  ResponseLength,
  SpeakingStyle,
} from "@/types/companion";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CompanionConfig;
  onUpdateConfig: (partial: Partial<CompanionConfig>) => void;
  availableVoices: SpeechSynthesisVoice[];
  longTermMemories: LongTermMemoryItem[];
  onClearConversation: () => void;
  onClearSavedMemory: () => void;
  onDeleteMemoryItem: (id: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  availableVoices,
  longTermMemories,
  onClearConversation,
  onClearSavedMemory,
  onDeleteMemoryItem,
}) => {
  const [activeTab, setActiveTab] = useState<
    "persona" | "voice_avatar" | "devices" | "memory"
  >("persona");
  const [clearedToast, setClearedToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const isDark = config.theme === "dark";

  const showNotice = (msg: string) => {
    setClearedToast(msg);
    setTimeout(() => setClearedToast(null), 2600);
  };

  const handleCustomAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onUpdateConfig({
          avatarId: "custom",
          customAvatarUrl: reader.result,
        });
        showNotice("Custom avatar berhasil diunggah!");
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className={`relative z-10 w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
            isDark
              ? "bg-slate-900 border-slate-800 text-slate-100"
              : "bg-white border-slate-200 text-slate-900"
          }`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-6 py-4 border-b ${
              isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">
                  Companion Settings & System Config
                </h2>
                <p className="text-xs opacity-65">
                  Kustomisasi kepribadian, suara, avatar, perangkat, dan memori AI
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-800/50 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div
            className={`flex items-center gap-1 px-6 pt-3 border-b overflow-x-auto ${
              isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
            }`}
          >
            {[
              { id: "persona", label: "Personality & Mode", icon: Sparkles },
              { id: "voice_avatar", label: "Avatar & Voice", icon: UserCheck },
              { id: "devices", label: "Audio, Camera & Theme", icon: Camera },
              { id: "memory", label: "Memory & History", icon: Brain },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
                    active
                      ? "border-sky-400 text-sky-400"
                      : "border-transparent opacity-65 hover:opacity-100"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Toast Notification */}
          {clearedToast && (
            <div className="mx-6 mt-3 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{clearedToast}</span>
            </div>
          )}

          {/* Tab Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === "persona" && (
              <div className="space-y-5">
                {/* AI Name & Language */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                      AI Name
                    </label>
                    <input
                      type="text"
                      value={config.aiName}
                      onChange={(e) =>
                        onUpdateConfig({ aiName: e.target.value })
                      }
                      placeholder="AURA"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                        isDark
                          ? "bg-slate-800 border-slate-700 text-white"
                          : "bg-slate-50 border-slate-300 text-slate-900"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                      Preferred Language
                    </label>
                    <select
                      value={config.preferredLanguage}
                      onChange={(e) =>
                        onUpdateConfig({
                          preferredLanguage: e.target
                            .value as PreferredLanguage,
                        })
                      }
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                        isDark
                          ? "bg-slate-800 border-slate-700 text-white"
                          : "bg-slate-50 border-slate-300 text-slate-900"
                      }`}
                    >
                      <option value="auto">
                        Otomatis (Sesuaikan Bahasa User ID/EN)
                      </option>
                      <option value="id">Bahasa Indonesia</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>

                {/* Companion Mode (Future-ready modes) */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-2">
                    AI Companion Role / Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {COMPANION_MODES.map((m) => {
                      const selected = config.companionMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            onUpdateConfig({ companionMode: m.id })
                          }
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            selected
                              ? "bg-sky-500/15 border-sky-400 text-sky-300"
                              : isDark
                                ? "bg-slate-800/60 border-slate-700/70 hover:border-slate-600"
                                : "bg-slate-50 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{m.label}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/20 text-sky-400">
                              {m.badge}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-70 mt-1">
                            {m.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Personality & Speaking Style */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                      Personality
                    </label>
                    <select
                      value={config.personality}
                      onChange={(e) =>
                        onUpdateConfig({
                          personality: e.target.value as PersonalityPreset,
                        })
                      }
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm ${
                        isDark
                          ? "bg-slate-800 border-slate-700 text-white"
                          : "bg-slate-50 border-slate-300 text-slate-900"
                      }`}
                    >
                      <option value="friendly">
                        Ramah, Santai & Natural (Default)
                      </option>
                      <option value="witty">Cerdas, Humoris & Ekspresif</option>
                      <option value="empathetic">
                        Empatik, Hangat & Pendengar Baik
                      </option>
                      <option value="mentor">Tech & Career Mentor</option>
                      <option value="tutor">Sabar & Edukatif (Tutor)</option>
                      <option value="assistant">
                        Cepat, Fokus & Produktif
                      </option>
                      <option value="gaming">Gaming Co-Pilot Seru</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                      Speaking Style
                    </label>
                    <select
                      value={config.speakingStyle}
                      onChange={(e) =>
                        onUpdateConfig({
                          speakingStyle: e.target.value as SpeakingStyle,
                        })
                      }
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm ${
                        isDark
                          ? "bg-slate-800 border-slate-700 text-white"
                          : "bg-slate-50 border-slate-300 text-slate-900"
                      }`}
                    >
                      <option value="casual">
                        Casual & Natural (Tidak Kaku)
                      </option>
                      <option value="warm">Warm & Supportive</option>
                      <option value="direct">Crisp & To-the-Point</option>
                      <option value="playful">Playful & Energetic</option>
                      <option value="analytical">
                        Thoughtful & Analytical
                      </option>
                    </select>
                  </div>
                </div>

                {/* Response Length & Humor Level */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                      Response Length
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        ["concise", "balanced", "detailed"] as ResponseLength[]
                      ).map((len) => (
                        <button
                          key={len}
                          type="button"
                          onClick={() =>
                            onUpdateConfig({ responseLength: len })
                          }
                          className={`py-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
                            config.responseLength === len
                              ? "bg-sky-500 text-slate-950 border-sky-400"
                              : isDark
                                ? "bg-slate-800 border-slate-700 text-slate-300"
                                : "bg-slate-100 border-slate-200 text-slate-700"
                          }`}
                        >
                          {len}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider opacity-75">
                        Humor Level
                      </label>
                      <span className="text-xs font-mono text-sky-400">
                        {config.humorLevel}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={config.humorLevel}
                      onChange={(e) =>
                        onUpdateConfig({ humorLevel: Number(e.target.value) })
                      }
                      className="w-full accent-sky-400"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "voice_avatar" && (
              <div className="space-y-5">
                {/* Select Avatar Character Preset */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-2">
                    Select Virtual Human Avatar
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {AVATAR_PRESETS.map((preset) => {
                      const selected =
                        config.avatarId === preset.id &&
                        !config.customAvatarUrl;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            onUpdateConfig({
                              avatarId: preset.id,
                              customAvatarUrl: null,
                              aiName: preset.name,
                              voicePitch: preset.defaultPitch,
                              voiceRate: preset.defaultRate,
                            })
                          }
                          className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                            selected
                              ? "bg-sky-500/15 border-sky-400"
                              : isDark
                                ? "bg-slate-800/70 border-slate-700/80 hover:border-slate-600"
                                : "bg-slate-50 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div
                            className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-slate-950 shadow-md"
                            style={{
                              background: `linear-gradient(135deg, ${preset.primaryColor}, ${preset.secondaryColor})`,
                            }}
                          >
                            {preset.name[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">
                                {preset.name}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950/40 text-sky-300">
                                {preset.roleTitle}
                              </span>
                            </div>
                            <p className="text-[11px] opacity-70 mt-1">
                              {preset.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Avatar Upload (Section 22 Future-ready feature) */}
                <div
                  className={`p-4 rounded-2xl border flex items-center justify-between ${
                    isDark
                      ? "bg-slate-800/40 border-slate-700/70"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div>
                    <h4 className="text-xs font-bold">
                      Custom Avatar Portrait Upload
                    </h4>
                    <p className="text-[11px] opacity-65">
                      Unggah foto/karakter sendiri atau gunakan 3D/Vector Neural Rig bawaan
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {config.customAvatarUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateConfig({
                            avatarId: "aura",
                            customAvatarUrl: null,
                          })
                        }
                        className="px-3 py-1.5 rounded-xl text-xs bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                      >
                        Reset
                      </button>
                    )}
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCustomAvatarUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Voice Synthesis Configuration */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                      AI Voice Engine (Text-to-Speech)
                    </label>
                    <select
                      value={config.voiceURI}
                      onChange={(e) =>
                        onUpdateConfig({ voiceURI: e.target.value })
                      }
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm ${
                        isDark
                          ? "bg-slate-800 border-slate-700 text-white"
                          : "bg-slate-50 border-slate-300 text-slate-900"
                      }`}
                    >
                      <option value="auto">
                        Auto-Match Natural Voice (Indonesian / English)
                      </option>
                      {availableVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Speaker Volume</span>
                        <span className="font-mono text-sky-400">
                          {Math.round(config.speakerVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={config.speakerVolume}
                        onChange={(e) =>
                          onUpdateConfig({
                            speakerVolume: Number(e.target.value),
                          })
                        }
                        className="w-full accent-sky-400"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Speaking Speed</span>
                        <span className="font-mono text-sky-400">
                          {config.voiceRate.toFixed(2)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.8}
                        max={1.3}
                        step={0.05}
                        value={config.voiceRate}
                        onChange={(e) =>
                          onUpdateConfig({ voiceRate: Number(e.target.value) })
                        }
                        className="w-full accent-sky-400"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Voice Pitch</span>
                        <span className="font-mono text-sky-400">
                          {config.voicePitch.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.8}
                        max={1.3}
                        step={0.05}
                        value={config.voicePitch}
                        onChange={(e) =>
                          onUpdateConfig({ voicePitch: Number(e.target.value) })
                        }
                        className="w-full accent-sky-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "devices" && (
              <div className="space-y-5">
                {/* Theme Selector (Dark Futuristic vs Light Futuristic) */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-2">
                    Visual Theme
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => onUpdateConfig({ theme: "dark" })}
                      className={`flex items-center justify-center gap-2 p-3.5 rounded-2xl border text-xs font-semibold transition-all ${
                        config.theme === "dark"
                          ? "bg-sky-500/20 border-sky-400 text-sky-300"
                          : "bg-slate-800/40 border-slate-700 opacity-70"
                      }`}
                    >
                      <Moon className="w-4 h-4" />
                      <span>Dark Futuristic (Default)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateConfig({ theme: "light" })}
                      className={`flex items-center justify-center gap-2 p-3.5 rounded-2xl border text-xs font-semibold transition-all ${
                        config.theme === "light"
                          ? "bg-sky-500/20 border-sky-500 text-sky-700"
                          : "bg-slate-100 border-slate-300 text-slate-700 opacity-70"
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      <span>Light Clean Glass</span>
                    </button>
                  </div>
                </div>

                {/* Voice & Barge-In Toggles */}
                <div className="space-y-3">
                  <div
                    className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                      isDark
                        ? "bg-slate-800/60 border-slate-700/70"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Volume2 className="w-4 h-4 text-sky-400" />
                      <div>
                        <p className="text-xs font-bold">
                          Auto-Speak AI Responses (Realtime Voice + Lip-Sync)
                        </p>
                        <p className="text-[11px] opacity-65">
                          AI otomatis berbicara dengan suara natural & sinkronisasi mulut
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.autoSpeak}
                      onChange={(e) =>
                        onUpdateConfig({ autoSpeak: e.target.checked })
                      }
                      className="w-4 h-4 accent-sky-400"
                    />
                  </div>

                  <div
                    className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                      isDark
                        ? "bg-slate-800/60 border-slate-700/70"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Mic className="w-4 h-4 text-emerald-400" />
                      <div>
                        <p className="text-xs font-bold">
                          Voice Interruption / Barge-In
                        </p>
                        <p className="text-[11px] opacity-65">
                          Jika kamu mulai bicara saat AI berbicara, AI otomatis berhenti & mendengarkanmu
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.bargeInEnabled}
                      onChange={(e) =>
                        onUpdateConfig({ bargeInEnabled: e.target.checked })
                      }
                      className="w-4 h-4 accent-sky-400"
                    />
                  </div>
                </div>

                {/* Camera Frame Sampling Interval & Gemini Optimization */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider opacity-75">
                      Gemini Vision Frame Sampling Interval
                    </label>
                    <span className="text-xs font-mono text-sky-400">
                      Every {config.cameraSampleIntervalSec} seconds
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    step={1}
                    value={config.cameraSampleIntervalSec}
                    onChange={(e) =>
                      onUpdateConfig({
                        cameraSampleIntervalSec: Number(e.target.value),
                      })
                    }
                    className="w-full accent-sky-400"
                  />
                  <p className="text-[11px] opacity-60 mt-1">
                    Menggunakan adaptive frame sampling & image compression agar efisien dan hemat kuota Gemini API.
                  </p>
                </div>

                {/* Adaptive Frame Sampling & Gemini Model Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div
                    className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                      isDark
                        ? "bg-slate-800/60 border-slate-700/70"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold">Adaptive Frame Sampling</p>
                      <p className="text-[10px] opacity-65">
                        Hanya kirim frame kamera/screen jika ada perubahan visual
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.adaptiveSampling ?? true}
                      onChange={(e) =>
                        onUpdateConfig({ adaptiveSampling: e.target.checked })
                      }
                      className="w-4 h-4 accent-sky-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider opacity-75 mb-1">
                      Google Gemini Model
                    </label>
                    <select
                      value={config.geminiModel || "gemini-2.0-flash"}
                      onChange={(e) =>
                        onUpdateConfig({ geminiModel: e.target.value })
                      }
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${
                        isDark
                          ? "bg-slate-800 border-slate-700 text-white"
                          : "bg-slate-50 border-slate-300 text-slate-900"
                      }`}
                    >
                      <option value="gemini-2.0-flash">
                        gemini-2.0-flash (Multimodal Fast)
                      </option>
                      <option value="gemini-1.5-flash">
                        gemini-1.5-flash (Balanced)
                      </option>
                      <option value="gemini-1.5-pro">
                        gemini-1.5-pro (Deep Reasoning)
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "memory" && (
              <div className="space-y-5">
                {/* Memory ON / OFF Toggle */}
                <div
                  className={`flex items-center justify-between p-4 rounded-2xl border ${
                    config.memoryEnabled
                      ? "bg-emerald-500/10 border-emerald-500/40"
                      : isDark
                        ? "bg-slate-800/60 border-slate-700"
                        : "bg-slate-100 border-slate-300"
                  }`}
                >
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Brain className="w-4 h-4 text-emerald-400" />
                      <span>
                        Long-Term Preference Memory:{" "}
                        {config.memoryEnabled ? "ON" : "OFF"}
                      </span>
                    </h3>
                    <p className="text-xs opacity-70 mt-0.5">
                      Menyimpan preferensi, nama panggilan, dan topik favorit secara aman hanya jika diaktifkan. Tidak pernah menyimpan data sensitif.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateConfig({ memoryEnabled: !config.memoryEnabled })
                    }
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      config.memoryEnabled
                        ? "bg-emerald-500 text-slate-950"
                        : "bg-slate-700 text-slate-200"
                    }`}
                  >
                    {config.memoryEnabled ? "Memory ON" : "Memory OFF"}
                  </button>
                </div>

                {/* Saved Long-Term Memory Facts */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider opacity-75">
                      Saved Memory Facts ({longTermMemories.length})
                    </h4>
                  </div>

                  {longTermMemories.length === 0 ? (
                    <div
                      className={`p-4 rounded-2xl border text-center text-xs opacity-65 ${
                        isDark
                          ? "bg-slate-800/40 border-slate-800"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      Belum ada memori jangka panjang yang disimpan. Coba perkenalkan namamu atau ceritakan hobimu di chat!
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {longTermMemories.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs ${
                            isDark
                              ? "bg-slate-800/70 border-slate-700/70"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 text-[10px] uppercase font-mono">
                              {item.category}
                            </span>
                            <span>{item.content}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onDeleteMemoryItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Clear Conversation & Clear Saved Memory Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClearConversation();
                      showNotice("Riwayat percakapan sesi ini berhasil dibersihkan.");
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Conversation History</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClearSavedMemory();
                      showNotice("Seluruh memori tersimpan berhasil dihapus.");
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Saved Memory</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className={`flex items-center justify-between px-6 py-3.5 border-t ${
              isDark ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50"
            }`}
          >
            <span className="text-[11px] opacity-60">
              Privasi Terlindungi • Kamera & Mikrofon Hanya Aktif Dengan Izin
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              Simpan & Tutup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
