"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award,
  Brain,
  CheckCircle2,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { UserProfile } from "@/types/companion";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdateProfile: (partial: Partial<UserProfile>) => void;
  messagesCount: number;
  memoriesCount: number;
  isDark: boolean;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
  messagesCount,
  memoriesCount,
  isDark,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className={`relative z-10 w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden ${
            isDark
              ? "bg-slate-900 border-slate-800 text-slate-100"
              : "bg-white border-slate-200 text-slate-900"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">User Profile</h2>
                <p className="text-xs opacity-65">
                  Identitas & preferensi interaksi personalmu
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800/60 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Avatar Badge */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-lg font-bold text-white shadow-lg">
                {profile.name.slice(0, 2).toUpperCase() || "EX"}
              </div>
              <div>
                <h3 className="text-sm font-bold">{profile.name}</h3>
                <p className="text-xs text-sky-400">{profile.role}</p>
                <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> Verified Companion Session
                </span>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">
                  Your Name / Nickname
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) =>
                    onUpdateProfile({
                      name: e.target.value,
                      avatarInitials: e.target.value.slice(0, 2).toUpperCase(),
                    })
                  }
                  className={`w-full px-3.5 py-2 rounded-xl border text-sm ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-white"
                      : "bg-slate-50 border-slate-300 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">
                  Role / Occupation
                </label>
                <input
                  type="text"
                  value={profile.role}
                  onChange={(e) => onUpdateProfile({ role: e.target.value })}
                  className={`w-full px-3.5 py-2 rounded-xl border text-sm ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-white"
                      : "bg-slate-50 border-slate-300 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">
                  Short Bio / Current Interests
                </label>
                <textarea
                  rows={2}
                  value={profile.bio}
                  onChange={(e) => onUpdateProfile({ bio: e.target.value })}
                  className={`w-full px-3.5 py-2 rounded-xl border text-sm resize-none ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-white"
                      : "bg-slate-50 border-slate-300 text-slate-900"
                  }`}
                />
              </div>
            </div>

            {/* Session Stats */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div
                className={`p-3 rounded-2xl border ${
                  isDark
                    ? "bg-slate-800/50 border-slate-700/70"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs text-sky-400 font-semibold">
                  <Award className="w-3.5 h-3.5" />
                  <span>Messages Sent</span>
                </div>
                <p className="text-lg font-bold mt-1">{messagesCount}</p>
              </div>

              <div
                className={`p-3 rounded-2xl border ${
                  isDark
                    ? "bg-slate-800/50 border-slate-700/70"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                  <Brain className="w-3.5 h-3.5" />
                  <span>Memory Facts</span>
                </div>
                <p className="text-lg font-bold mt-1">{memoriesCount}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] opacity-65 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                End-to-end session privacy: Kamera dan rekaman audio tidak pernah disimpan secara permanen.
              </span>
            </div>
          </div>

          <div className="px-6 py-3.5 border-t border-slate-800/60 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs"
            >
              Selesai
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
