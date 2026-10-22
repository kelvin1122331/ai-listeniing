"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Camera,
  Mic,
  MessageSquare,
  Monitor,
  Send,
  Sparkles,
  Trash2,
  User,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { ChatMessage, ConversationState } from "@/types/companion";
import {
  CAMERA_QUICK_PROMPTS,
  GENERAL_QUICK_PROMPTS,
} from "@/constants/companionPresets";

interface ChatPanelProps {
  messages: ChatMessage[];
  aiName: string;
  conversationState: ConversationState;
  isCameraActive: boolean;
  isDark: boolean;
  isOpenMobile: boolean;
  autoSpeakEnabled: boolean;
  onToggleAutoSpeak: () => void;
  onCloseMobile: () => void;
  onSendMessage: (text: string) => void;
  onSelectQuickPrompt: (prompt: string) => void;
  onSpeakMessage: (text: string) => void;
  onClearHistory: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  aiName,
  conversationState,
  isCameraActive,
  isDark,
  isOpenMobile,
  autoSpeakEnabled,
  onToggleAutoSpeak,
  onCloseMobile,
  onSendMessage,
  onSelectQuickPrompt,
  onSpeakMessage,
  onClearHistory,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [panelInput, setPanelInput] = useState("");

  // Auto-scroll to latest message or typing indicator
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, conversationState]);

  const activeQuickPrompts = isCameraActive
    ? CAMERA_QUICK_PROMPTS
    : GENERAL_QUICK_PROMPTS;

  const handlePanelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!panelInput.trim() || conversationState === "PROCESSING") return;
    onSendMessage(panelInput.trim());
    setPanelInput("");
  };

  const renderChatContent = () => (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${
          isDark
            ? "border-slate-800/80 bg-slate-900/60"
            : "border-slate-200 bg-slate-50/80"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold tracking-wide uppercase">
              Live Chat & Voice
            </h2>
            <p className="text-[11px] opacity-60">
              {messages.length} pesan • Ketik & Jawab Suara
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Auto-Voice Reply Toggle Pill */}
          <button
            type="button"
            onClick={onToggleAutoSpeak}
            title="Aktifkan/Matikan Jawaban Suara Otomatis"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
              autoSpeakEnabled
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-slate-800 border-slate-700 text-slate-400"
            }`}
          >
            {autoSpeakEnabled ? (
              <>
                <Volume2 className="w-3 h-3 text-emerald-400" />
                <span>Suara ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3 h-3" />
                <span>Suara OFF</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClearHistory}
            title="Clear Conversation"
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              isDark
                ? "hover:bg-slate-800 text-slate-400 hover:text-rose-400"
                : "hover:bg-slate-200 text-slate-500 hover:text-rose-500"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Mobile Close Drawer Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-800/60 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${
                isUser ? "items-end" : "items-start"
              }`}
            >
              {/* Sender & Timestamp Meta */}
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] opacity-65">
                {isUser ? (
                  <>
                    {msg.source === "voice" && (
                      <span className="flex items-center gap-0.5 text-emerald-400 font-medium">
                        <Mic className="w-2.5 h-2.5" /> Voice
                      </span>
                    )}
                    {msg.source === "vision" && (
                      <span className="flex items-center gap-0.5 text-sky-400 font-medium">
                        <Camera className="w-2.5 h-2.5" /> Vision
                      </span>
                    )}
                    {msg.source === "screen" && (
                      <span className="flex items-center gap-0.5 text-indigo-400 font-medium">
                        <Monitor className="w-2.5 h-2.5" /> Screen
                      </span>
                    )}
                    <span>You</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                    <User className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-sky-400" />
                    <span className="font-semibold text-sky-400">{aiName}</span>
                    {msg.expression && (
                      <span className="px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 capitalize">
                        {msg.expression}
                      </span>
                    )}
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </>
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`relative max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                  isUser
                    ? "bg-gradient-to-br from-sky-500 to-indigo-600 text-white rounded-tr-xs"
                    : isDark
                      ? "bg-slate-800/90 border border-slate-700/70 text-slate-100 rounded-tl-xs"
                      : "bg-white border border-slate-200 text-slate-800 rounded-tl-xs"
                }`}
              >
                {msg.visionAnalysis && (
                  <div
                    className={`mb-2 px-2.5 py-1.5 rounded-xl text-[11px] flex items-center gap-2 ${
                      isUser
                        ? "bg-slate-950/30 text-sky-100 border border-white/15"
                        : "bg-sky-500/10 text-sky-300 border border-sky-500/20"
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5 shrink-0 text-sky-300" />
                    <div className="truncate">
                      <span className="font-semibold">Frame: </span>
                      <span>{msg.visionAnalysis.sceneLabel}</span>
                    </div>
                  </div>
                )}

                <div className="whitespace-pre-line">{msg.content}</div>

                {/* Play Voice Button on AI messages */}
                {!isUser && (
                  <div className="mt-2 pt-1.5 border-t border-slate-700/40 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => onSpeakMessage(msg.content)}
                      title="Dengarkan jawaban dengan suara AI"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-[11px] font-semibold text-sky-300 transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Dengarkan Suara</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Typing Indicator when AI is Processing */}
        {conversationState === "PROCESSING" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2"
          >
            <div
              className={`px-4 py-3 rounded-2xl rounded-tl-xs border flex items-center gap-2 ${
                isDark
                  ? "bg-slate-800/90 border-slate-700/70 text-slate-300"
                  : "bg-white border-slate-200 text-slate-700"
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" />
              </div>
              <span className="text-xs opacity-75">
                {aiName} sedang menyiapkan jawaban & suara...
              </span>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick Suggestion Chips */}
      <div
        className={`px-3 py-2 border-t ${
          isDark
            ? "border-slate-800/80 bg-slate-900/40"
            : "border-slate-200 bg-slate-50/70"
        }`}
      >
        <div className="flex items-center gap-1 mb-1.5 text-[10px] font-medium text-sky-400">
          <Sparkles className="w-3 h-3" />
          <span>
            {isCameraActive
              ? "Pertanyaan Vision Kamera:"
              : "Klik cepat atau ketik di bawah:"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {activeQuickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSelectQuickPrompt(prompt)}
              className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap border transition-all cursor-pointer ${
                isDark
                  ? "bg-slate-800/80 hover:bg-sky-500/20 border-slate-700/80 hover:border-sky-400/50 text-slate-300 hover:text-sky-200"
                  : "bg-white hover:bg-sky-50 border-slate-200 text-slate-700 hover:text-sky-700"
              }`}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Direct Chat Input Box inside ChatPanel (Works on Desktop Sidebar & Mobile Drawer!) */}
      <form
        onSubmit={handlePanelSubmit}
        className={`p-3 border-t flex items-center gap-2 ${
          isDark
            ? "border-slate-800 bg-slate-950/80"
            : "border-slate-200 bg-white"
        }`}
      >
        <input
          type="text"
          value={panelInput}
          onChange={(e) => setPanelInput(e.target.value)}
          placeholder={`Ketik pesan ke ${aiName}...`}
          className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${
            isDark
              ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
              : "bg-slate-50 border-slate-300 text-slate-900"
          }`}
        />
        <button
          type="submit"
          disabled={!panelInput.trim() || conversationState === "PROCESSING"}
          className="px-3.5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Kirim</span>
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Chat Column */}
      <aside
        className={`hidden lg:flex flex-col w-[380px] xl:w-[410px] h-full border-l backdrop-blur-xl transition-colors ${
          isDark
            ? "bg-slate-900/65 border-slate-800/80 text-slate-100"
            : "bg-white/80 border-slate-200 text-slate-900"
        }`}
      >
        {renderChatContent()}
      </aside>

      {/* Mobile Slide-Up Bottom Sheet Chat Panel */}
      <AnimatePresence>
        {isOpenMobile && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className={`lg:hidden fixed inset-x-0 bottom-0 z-50 h-[78vh] rounded-t-3xl border-t overflow-hidden shadow-2xl ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-slate-100"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              {renderChatContent()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
