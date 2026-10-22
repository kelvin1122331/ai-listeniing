"use client";
import { useState } from "react";
import { ArrowLeft, LockKeyhole } from "lucide-react";
interface Props { isOpen: boolean; onClose: () => void; onLoginSuccess: (name: string) => void; isDark?: boolean; }
export function AdminLoginModal({ isOpen, onClose, onLoginSuccess }: Props) {
  const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  if (!isOpen) return null;
  return <main className="admin-login">
    <button className="text-link" onClick={onClose}><ArrowLeft size={15} />Kembali ke AURA</button>
    <div className="login-card"><LockKeyhole size={25} /><p className="eyebrow">AKSES PENGELOLA</p><h1>Selamat datang kembali.</h1><p>Kelola koneksi AI dan pengaturan aplikasi.</p>
      <form onSubmit={async e => {
        e.preventDefault(); if (loading) return; setLoading(true); setError("");
        try {
          const res = await fetch("/api/admin/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }), signal: AbortSignal.timeout(15_000) });
          const data = await res.json(); if (!res.ok) throw new Error(data.error || "Login gagal.");
          setPassword(""); onLoginSuccess(data.username);
        } catch (err) { setError(err instanceof Error ? err.message : "Login gagal. Coba lagi."); }
        finally { setLoading(false); }
      }}>
        <label className="field">Username<input autoComplete="username" value={username} required maxLength={120} onChange={e => setUsername(e.target.value)} /></label>
        <label className="field">Password<input type="password" autoComplete="current-password" value={password} required maxLength={500} onChange={e => setPassword(e.target.value)} /></label>
        {error && <div className="notice error-notice" role="alert">{error}</div>}
        <button className="primary-button" type="submit" disabled={loading}>{loading ? "Memverifikasi…" : "Masuk ke pengaturan"}</button>
      </form>
    </div>
  </main>;
}
