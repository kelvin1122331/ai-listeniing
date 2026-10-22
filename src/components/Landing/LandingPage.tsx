"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Camera,
  Mic,
  MessageSquare,
  Moon,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Video,
} from "lucide-react";
import {
  AVATAR_PRESETS,
  COMPANION_MODES,
} from "@/constants/companionPresets";
import {
  AvatarCharacterId,
  AvatarExpression,
  CompanionConfig,
  CompanionMode,
} from "@/types/companion";
import { VISEME_SHAPES } from "@/services/LipSyncService";
import { VirtualAvatar } from "@/components/Avatar/VirtualAvatar";

interface LandingPageProps {
  config: CompanionConfig;
  onUpdateConfig: (partial: Partial<CompanionConfig>) => void;
  onStartConversation: (initialMessage?: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  config,
  onUpdateConfig,
  onStartConversation,
}) => {
  const [previewExpression, setPreviewExpression] =
    useState<AvatarExpression>("happy");
  const [quickMessage, setQuickMessage] = useState("");

  const isDark = config.theme === "dark";
  const activePreset =
    AVATAR_PRESETS.find((p) => p.id === config.avatarId) || AVATAR_PRESETS[0];

  const handleSelectCharacter = (id: AvatarCharacterId) => {
    const preset = AVATAR_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    onUpdateConfig({
      avatarId: preset.id,
      aiName: preset.name,
      voicePitch: preset.defaultPitch,
      voiceRate: preset.defaultRate,
    });
  };

  const handleQuickChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMessage.trim()) {
      onStartConversation();
      return;
    }
    onStartConversation(quickMessage.trim());
  };

  return (
    <div
      className={`min-h-screen w-full flex flex-col justify-between transition-colors duration-300 relative overflow-x-hidden ${
        isDark
          ? "bg-[#060913] text-slate-100"
          : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* Ambient Futuristic Background Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/4 w-[520px] h-[520px] rounded-full blur-[130px] opacity-25"
          style={{ background: activePreset.primaryColor }}
        />
        <div
          className="absolute bottom-[-180px] right-1/4 w-[480px] h-[480px] rounded-full blur-[140px] opacity-20"
          style={{ background: activePreset.secondaryColor }}
        />
      </div>

      {/* Top Navigation */}
      <header className="relative z-20 max-w-7xl w-full mx-auto px-4 sm:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
            <Sparkles className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
              AURA.AI
            </span>
            <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-sky-500/15 text-sky-400 border border-sky-500/30">
              Realtime Virtual Companion
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              onUpdateConfig({ theme: isDark ? "light" : "dark" })
            }
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              isDark
                ? "bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white"
                : "bg-white border-slate-200 text-slate-700 hover:text-slate-950"
            }`}
            title="Toggle Dark / Light Theme"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onStartConversation()}
            className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-lg shadow-sky-500/25 flex items-center gap-1.5 cursor-pointer"
          >
            <span>Start Conversation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 lg:py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Hero Copy & Interactive Controls */}
        <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-400 text-xs font-medium"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Multimodal AI • Voice, Vision & Lip-Sync Avatar</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]"
          >
            Talk to AI like{" "}
            <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
              it&apos;s really there.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={`text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            Chat, talk, and interact face-to-face with your AI companion.
            Speak naturally with real-time lip-sync, interrupt anytime, or turn
            on your camera to show objects and get instant visual answers.
          </motion.p>

          {/* Direct Quick Chat Input on Landing Page */}
          <form
            onSubmit={handleQuickChatSubmit}
            className={`max-w-xl mx-auto lg:mx-0 p-2 pl-4 rounded-2xl border backdrop-blur-xl shadow-xl flex items-center gap-2 transition-all ${
              isDark
                ? "bg-slate-900/90 border-slate-700/90 focus-within:border-sky-400"
                : "bg-white border-slate-300 focus-within:border-sky-500"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-sky-400 shrink-0" />
            <input
              type="text"
              value={quickMessage}
              onChange={(e) => setQuickMessage(e.target.value)}
              placeholder={`Ketik pesan langsung ke ${config.aiName} di sini...`}
              className="flex-1 bg-transparent text-xs sm:text-sm focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim</span>
            </button>
          </form>

          {/* Character Companion Selector */}
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-65">
              Choose Your AI Companion & Mode:
            </p>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = config.avatarId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectCharacter(preset.id)}
                    className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-sky-500/20 border-sky-400 text-sky-300 shadow-md"
                        : isDark
                          ? "bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700"
                          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: preset.primaryColor }}
                    />
                    <span>{preset.name}</span>
                    <span className="text-[10px] opacity-65 hidden sm:inline">
                      • {preset.roleTitle}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Companion Role Modes */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 pt-1">
              {COMPANION_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    onUpdateConfig({ companionMode: m.id as CompanionMode })
                  }
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                    config.companionMode === m.id
                      ? "bg-indigo-500/20 border-indigo-400 text-indigo-300"
                      : isDark
                        ? "bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-200"
                        : "bg-slate-100 border-slate-200 text-slate-600"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Primary CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-1"
          >
            <button
              type="button"
              onClick={() => onStartConversation()}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-sky-400 via-cyan-400 to-indigo-500 hover:from-sky-300 hover:to-indigo-400 text-slate-950 font-extrabold text-base shadow-xl shadow-sky-500/25 flex items-center justify-center gap-2.5 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <span>Start Conversation</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs opacity-75 px-3 py-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Private & Permission-Based Camera/Mic</span>
            </div>
          </motion.div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {[
              {
                icon: MessageSquare,
                title: "Contextual Chat",
                desc: "Text + full chat history",
              },
              {
                icon: Mic,
                title: "Realtime Voice",
                desc: "Barge-in & natural TTS",
              },
              {
                icon: Camera,
                title: "Camera Vision",
                desc: "Show objects & notes live",
              },
              {
                icon: Brain,
                title: "Smart Memory",
                desc: "Short & optional long-term memory",
              },
            ].map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className={`p-3.5 rounded-2xl border text-left backdrop-blur-md ${
                    isDark
                      ? "bg-slate-900/55 border-slate-800/80"
                      : "bg-white/80 border-slate-200/90"
                  }`}
                >
                  <Icon className="w-4 h-4 text-sky-400 mb-1.5" />
                  <h3 className="text-xs font-bold">{feat.title}</h3>
                  <p className="text-[11px] opacity-65 mt-0.5">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Interactive Avatar Preview Card */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div
            className={`w-full max-w-md rounded-3xl border p-4 sm:p-6 backdrop-blur-xl shadow-2xl relative ${
              isDark
                ? "bg-slate-900/65 border-slate-800/90"
                : "bg-white/85 border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                  Live Avatar Preview
                </span>
                <h2 className="text-base font-extrabold">
                  {activePreset.name} — {activePreset.roleTitle}
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                60 FPS Lip-Sync
              </span>
            </div>

            <VirtualAvatar
              preset={activePreset}
              aiName={config.aiName}
              conversationState="IDLE"
              expression={previewExpression}
              visemeFrame={VISEME_SHAPES.rest}
              audioLevel={0.18}
              customAvatarUrl={config.customAvatarUrl}
              subtitleText="Hi, I'm your AI companion. You can type, talk, or turn on your camera."
              isDark={isDark}
              onSelectExpression={setPreviewExpression}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-8 py-4 border-t border-slate-800/40 flex flex-col sm:flex-row items-center justify-between text-xs opacity-60 gap-2">
        <span>
          AURA Virtual Companion • Multimodal Voice, Vision & Lip-Sync Architecture
        </span>
        <span>Built with Next.js, TypeScript, Tailwind CSS & Framer Motion</span>
      </footer>
    </div>
  );
};
