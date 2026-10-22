"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Lock, Shield, User, X } from "lucide-react";
import {
  setAdminSessionToken,
  setCachedAdminState,
} from "@/lib/adminClientSession";

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (username: string) => void;
  isDark?: boolean;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  isDark = true,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.authenticated) {
        setErrorMsg(data.error || "Username atau password salah.");
        setIsLoading(false);
        return;
      }

      if (data.token) {
        setAdminSessionToken(data.token);
      }
      if (data.initialState) {
        setCachedAdminState(data.initialState);
      }

      setUsername("");
      setPassword("");
      setIsLoading(false);
      onLoginSuccess(data.username || "admin");
    } catch {
      setErrorMsg("Gagal menghubungi server autentikasi. Coba lagi.");
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          className={`relative z-10 w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden ${
            isDark
              ? "bg-slate-900/95 border-slate-800 text-slate-100"
              : "bg-white border-slate-200 text-slate-900"
          }`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-6 py-4 border-b ${
              isDark
                ? "border-slate-800 bg-slate-950/60"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">Admin Authentication</h2>
                <p className="text-[11px] opacity-65">
                  Masuk untuk mengatur konfigurasi API & sistem AI
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800/60 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username admin"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                    isDark
                      ? "bg-slate-800/90 border-slate-700 text-white"
                      : "bg-slate-50 border-slate-300 text-slate-900"
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                    isDark
                      ? "bg-slate-800/90 border-slate-700 text-white"
                      : "bg-slate-50 border-slate-300 text-slate-900"
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                  isDark
                    ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-500 hover:from-sky-300 hover:to-indigo-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
              >
                {isLoading ? "Verifying..." : "Login"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
