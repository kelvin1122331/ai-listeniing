"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, LogOut, RefreshCw, Save, Activity } from "lucide-react";
import type { AIProviderType, ProviderPublicConfigView, AdminSystemSettings, AdminVoiceSettings, AdminVisionSettings, ServerUsageStats } from "@/lib/serverConfigStore";
interface State {
  activeProvider: AIProviderType; providers: Record<AIProviderType, ProviderPublicConfigView>;
  systemSettings: AdminSystemSettings; voiceSettings: AdminVoiceSettings; visionSettings: AdminVisionSettings; usageStats: ServerUsageStats;
}
interface Props { isOpen: boolean; onClose: () => void; onLogout: () => void; onConfigUpdated?: () => void; isDark?: boolean; }
export function AdminDashboard({ isOpen, onClose, onLogout, onConfigUpdated }: Props) {
  const [state, setState] = useState<State | null>(null); const [selected, setSelected] = useState<AIProviderType>("gemini");
  const [key, setKey] = useState(""); const [textModel, setTextModel] = useState(""); const [visionModel, setVisionModel] = useState(""); const [liveModel, setLiveModel] = useState(""); const [baseUrl, setBaseUrl] = useState("");
  const [notice, setNotice] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const load = async () => {
    setError("");
    try { const res = await fetch("/api/admin/config", { cache: "no-store" }); if (res.status === 401) { onLogout(); return; } if (!res.ok) throw new Error("Pengaturan gagal dimuat."); const next = await res.json(); setState(next); }
    catch (err) { setError(err instanceof Error ? err.message : "Pengaturan gagal dimuat."); }
  };
  useEffect(() => { if (isOpen) void load(); }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!state) return; const row = state.providers[selected];
    setKey(""); setTextModel(row.text_model); setVisionModel(row.vision_model); setLiveModel(row.realtime_model); setBaseUrl(row.base_url); setModels([]);
  }, [selected, state]);
  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(50_000) });
    const data = await res.json(); if (res.status === 401) onLogout(); if (!res.ok) throw new Error(data.error || data.details || data.message || "Permintaan gagal."); return data;
  };
  const action = async (callback: () => Promise<void>) => {
    if (busy) return; setBusy(true); setNotice(""); setError("");
    try { await callback(); } catch (err) { setError(err instanceof Error ? err.message : "Permintaan gagal."); } finally { setBusy(false); }
  };
  if (!isOpen) return null;
  return <div className="admin-shell">
    <header className="admin-header"><button className="text-link" onClick={onClose}><ArrowLeft size={16} />Kembali ke AURA</button><button className="secondary-button" disabled={busy} onClick={() => void action(async () => { await post("/api/admin/logout", {}); onLogout(); })}><LogOut size={15} />Keluar</button></header>
    <div className="admin-title"><span className="eyebrow">PENGATURAN APLIKASI</span><h1>Ruang kendali.</h1><p>Koneksi yang jelas. Pengaturan yang teratur.</p></div>
    {error && <div role="alert" className="notice error-notice">{error}</div>}{notice && <div role="status" className="notice">{notice}</div>}
    {!state ? <button className="secondary-button" onClick={() => void load()}><RefreshCw size={16} />Muat pengaturan</button> : <>
      <section className="admin-stats" aria-label="Penggunaan"><div><span>Total permintaan</span><strong>{state.usageStats.totalRequests}</strong></div><div><span>Berhasil</span><strong>{state.usageStats.totalRequests - state.usageStats.errors}</strong></div><div><span>Gagal</span><strong>{state.usageStats.errors}</strong></div><div><span>Rata-rata waktu</span><strong>{(state.usageStats.averageLatencyMs / 1000).toFixed(1)}<small> detik</small></strong></div></section>
      <div className="admin-grid">
        <section className="admin-card"><div className="admin-card-title"><h2>Koneksi AI</h2><span className="small-tag">Aktif: {state.activeProvider}</span></div>
          <form onSubmit={e => { e.preventDefault(); void action(async () => {
            const data = await post("/api/admin/config", { action: "save_provider_config", provider: selected, apiKey: key, textModel, visionModel, realtimeModel: liveModel, baseUrl, setAsActive: true });
            setState(data.state); setNotice("Konfigurasi disimpan. Penyedia ini sekarang aktif."); onConfigUpdated?.();
          }); }}>
            <label className="field">Penyedia AI<select value={selected} disabled={busy} onChange={e => { setSelected(e.target.value as AIProviderType); setNotice(""); }}><option value="gemini">Google Gemini</option><option value="openai">OpenAI</option><option value="custom">API kompatibel OpenAI</option></select></label>
            <label className="field">API key<input type="password" autoComplete="off" value={key} maxLength={500} onChange={e => setKey(e.target.value)} placeholder={state.providers[selected].hasApiKey ? "Key sudah tersimpan · kosongkan untuk mempertahankan" : "Masukkan API key"} /></label>
            <label className="field">Alamat API<input type="url" required value={baseUrl} maxLength={500} onChange={e => setBaseUrl(e.target.value)} /></label>
            <div className="field-pair"><label className="field">Model chat<input list="text-models" required value={textModel} maxLength={120} onChange={e => setTextModel(e.target.value)} /></label><label className="field">Model gambar<input list="text-models" required value={visionModel} maxLength={120} onChange={e => setVisionModel(e.target.value)} /></label></div>
            <datalist id="text-models">{models.map(m => <option key={m} value={m} />)}</datalist>
            {selected === "gemini" && <label className="field">Model suara langsung<input required value={liveModel} maxLength={120} onChange={e => setLiveModel(e.target.value)} /></label>}
            <p className="settings-description">Model harus tersedia untuk proyek dan API key ini. Pengujian menggunakan nilai di formulir dan dapat memakai kuota API.</p>
            <div className="admin-form-actions"><button className="primary-button" type="submit" disabled={busy}><Save size={15} />Simpan & aktifkan</button><button className="secondary-button" type="button" disabled={busy} onClick={() => void action(async () => { const result = await post("/api/admin/test-connection", { provider: selected, apiKey: key, textModel, baseUrl }); setNotice(result.message + " · " + result.latencyMs + " ms"); })}><Activity size={15} />Uji koneksi</button>
            <button className="text-link" type="button" disabled={busy} onClick={() => void action(async () => { const res = await fetch("/api/admin/models?provider=" + selected, { cache: "no-store" }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Daftar model gagal dimuat."); setModels(data.models.textModels); setNotice(data.source === "live_api" ? "Model tersedia sudah dimuat dari API." : "Daftar model bawaan dimuat. Periksa akses model dengan Uji koneksi."); })}>Muat daftar model</button></div>
          </form>
        </section>
        <section className="admin-card"><div className="admin-card-title"><h2>Ketersediaan fitur</h2></div><p className="settings-description">Perubahan berikut berlaku untuk aplikasi. Muat ulang percakapan setelah mengubahnya.</p>
          {([["enableVoice", "Percakapan suara"], ["enableCamera", "Kamera"], ["enableScreenSharing", "Berbagi layar"], ["enableMemory", "Memori preferensi"], ["maintenanceMode", "Mode pemeliharaan"]] as const).map(([key, title]) => <label className="setting-toggle" key={key}><strong>{title}</strong><input type="checkbox" checked={state.systemSettings[key]} disabled={busy} onChange={e => { const checked = e.target.checked; void action(async () => { const data = await post("/api/admin/config", { action: "update_settings", systemSettings: { [key]: checked } }); setState(data.state); setNotice("Pengaturan fitur disimpan."); }); }} /></label>)}
          <h3 className="admin-note-title">Penyimpanan server</h3><p className="settings-description">Pengaturan admin disimpan pada folder .data. Hosting tanpa disk persisten sebaiknya menggunakan environment variable untuk API key dan model. Statistik penggunaan bersifat lokal pada instance server ini.</p>
        </section>
      </div>
    </>}
  </div>;
}
