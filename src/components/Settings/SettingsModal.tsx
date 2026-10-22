"use client";
import { useEffect, useRef, useState } from "react";
import { X, Trash2, SlidersHorizontal, AudioLines, Monitor, Brain } from "lucide-react";
import { AVATAR_PRESETS } from "@/constants/companionPresets";
import { CompanionConfig, LongTermMemoryItem } from "@/types/companion";
interface Props {
  isOpen: boolean; onClose: () => void; config: CompanionConfig;
  onUpdateConfig: (value: Partial<CompanionConfig>) => void;
  availableVoices: SpeechSynthesisVoice[]; longTermMemories: LongTermMemoryItem[];
  onClearConversation: () => void; onClearSavedMemory: () => void; onDeleteMemoryItem: (id: string) => void;
}
export function SettingsModal(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState("personal");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [notice, setNotice] = useState("");
  const { config: c, onUpdateConfig: update } = props;
  useEffect(() => {
    if (props.isOpen) dialog.current?.showModal(); else dialog.current?.close();
  }, [props.isOpen]);
  useEffect(() => {
    if (!props.isOpen) return;
    let cancelled = false;
    const load = () => navigator.mediaDevices?.enumerateDevices().then(result => { if (!cancelled) setDevices(result); }).catch(() => { if (!cancelled) setNotice("Daftar perangkat belum tersedia. Periksa izin browser."); });
    void load(); navigator.mediaDevices?.addEventListener("devicechange", load);
    return () => { cancelled = true; navigator.mediaDevices?.removeEventListener("devicechange", load); };
  }, [props.isOpen]);
  const toggle = (key: "autoSpeak" | "useGeminiLiveVoice" | "bargeInEnabled" | "memoryEnabled", title: string, description: string) => <label className="setting-toggle"><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={c[key]} onChange={e => update({ [key]: e.target.checked })} /></label>;
  return <dialog className="settings-dialog" ref={dialog} onCancel={props.onClose} onClick={e => { if (e.target === dialog.current) props.onClose(); }} aria-labelledby="settings-title">
    <div className="dialog-header"><div><span className="eyebrow">SESUAIKAN RUANGMU</span><h2 id="settings-title">Pengaturan</h2></div><button className="icon-button" onClick={props.onClose} aria-label="Tutup pengaturan"><X size={20} /></button></div>
    <div className="settings-tabs" role="tablist" aria-label="Bagian pengaturan">{[{ id: "personal", title: "Personal", Icon: SlidersHorizontal }, { id: "voice", title: "Suara", Icon: AudioLines }, { id: "devices", title: "Perangkat", Icon: Monitor }, { id: "memory", title: "Memori", Icon: Brain }].map(({ id, title, Icon }) => <button role="tab" id={"tab-" + id} aria-controls={"panel-" + id} aria-selected={tab === id} key={id} onClick={() => { setTab(id); setNotice(""); }}><Icon size={16} />{title}</button>)}</div>
    <div className="settings-content" role="tabpanel" id={"panel-" + tab} aria-labelledby={"tab-" + tab}>
      {tab === "personal" && <>
        <label className="field">Nama teman AI<input value={c.aiName} maxLength={40} onChange={e => update({ aiName: e.target.value })} onBlur={() => { if (!c.aiName.trim()) update({ aiName: "AURA" }); }} /></label>
        <label className="field">Karakter<select value={c.avatarId} onChange={e => { const p = AVATAR_PRESETS.find(p => p.id === e.target.value); if (p) update({ avatarId: p.id, aiName: p.name, voicePitch: p.defaultPitch, voiceRate: p.defaultRate, customAvatarUrl: null }); }}>{AVATAR_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}{c.avatarId === "custom" && <option value="custom">Avatar pribadi</option>}</select></label>
        <div className="field-pair"><label className="field">Kepribadian<select value={c.personality} onChange={e => update({ personality: e.target.value as CompanionConfig["personality"] })}>{Object.entries({ friendly: "Ramah", witty: "Humoris", empathetic: "Empatik", mentor: "Mentor", tutor: "Pengajar", assistant: "Asisten", gaming: "Teman bermain" }).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
        <label className="field">Gaya bicara<select value={c.speakingStyle} onChange={e => update({ speakingStyle: e.target.value as CompanionConfig["speakingStyle"] })}>{Object.entries({ casual: "Santai", warm: "Hangat", direct: "Langsung", playful: "Ceria", analytical: "Analitis" }).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label></div>
        <div className="field-pair"><label className="field">Bahasa<select value={c.preferredLanguage} onChange={e => update({ preferredLanguage: e.target.value as CompanionConfig["preferredLanguage"] })}><option value="auto">Ikuti percakapan</option><option value="id">Indonesia</option><option value="en">English</option></select></label>
        <label className="field">Panjang jawaban<select value={c.responseLength} onChange={e => update({ responseLength: e.target.value as CompanionConfig["responseLength"] })}><option value="concise">Ringkas</option><option value="balanced">Seimbang</option><option value="detailed">Mendetail</option></select></label></div>
        <label className="field">Tujuan percakapan<select value={c.companionMode} onChange={e => update({ companionMode: e.target.value as CompanionConfig["companionMode"] })}><option value="companion">Teman cerita</option><option value="assistant">Asisten harian</option><option value="tutor">Belajar bersama</option><option value="language_tutor">Latihan bahasa</option><option value="gaming">Teman bermain</option></select></label>
        <label className="field">Selera humor · {c.humorLevel}%<input type="range" min="0" max="100" value={c.humorLevel} onChange={e => update({ humorLevel: Number(e.target.value) })} /></label>
      </>}
      {tab === "voice" && <>
        {toggle("autoSpeak", "Bacakan balasan", "Jawaban chat dibacakan menggunakan suara browser.")}
        {toggle("useGeminiLiveVoice", "Percakapan suara langsung", "Gunakan Gemini Live jika tersedia. Input suara browser menjadi cadangan.")}
        {toggle("bargeInEnabled", "Izinkan menyela", "Gemini Live dapat berhenti menjawab saat kamu mulai berbicara.")}
        <label className="field">Suara browser<select value={c.voiceURI} onChange={e => update({ voiceURI: e.target.value })}><option value="auto">Otomatis mengikuti bahasa</option>{props.availableVoices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>)}</select></label>
        <label className="field">Volume · {Math.round(c.speakerVolume * 100)}%<input type="range" min="0" max="1" step="0.05" value={c.speakerVolume} onChange={e => update({ speakerVolume: Number(e.target.value) })} /></label>
        <label className="field">Kecepatan pembacaan · {c.voiceRate.toFixed(1)}×<input type="range" min="0.5" max="2" step="0.1" value={c.voiceRate} onChange={e => update({ voiceRate: Number(e.target.value) })} /></label>
        <label className="field">Nada suara browser · {c.voicePitch.toFixed(1)}<input type="range" min="0.5" max="2" step="0.1" value={c.voicePitch} onChange={e => update({ voicePitch: Number(e.target.value) })} /></label>
      </>}
      {tab === "devices" && <>
        <p className="settings-description">Perangkat akan diminta izinnya saat kamu menyalakan kamera atau mikrofon.</p>
        {(["audioinput", "videoinput"] as const).map(kind => <label key={kind} className="field">{kind === "audioinput" ? "Mikrofon untuk Gemini Live" : "Kamera"}<select value={kind === "audioinput" ? c.selectedMicrophoneId : c.selectedCameraId} onChange={e => update(kind === "audioinput" ? { selectedMicrophoneId: e.target.value } : { selectedCameraId: e.target.value })}><option value="default">Perangkat bawaan</option>{devices.filter(d => d.kind === kind && d.deviceId && d.deviceId !== "default").map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Perangkat " + (i + 1)}</option>)}</select></label>)}
        <p className="settings-description">Pengenal suara browser memakai mikrofon yang diatur pada browser.</p>
        <label className="field">Interval gambar untuk suara langsung · {c.cameraSampleIntervalSec} detik<input type="range" min="1" max="10" value={c.cameraSampleIntervalSec} onChange={e => update({ cameraSampleIntervalSec: Number(e.target.value) })} /></label>
        <p className="settings-description">Chat selalu memakai gambar terbaru saat pesan dikirim.</p>
      </>}
      {tab === "memory" && <>
        {toggle("memoryEnabled", "Ingat preferensiku", "Simpan nama, minat, dan tujuan di browser perangkat ini.")}
        <p className="settings-description">Riwayat chat disimpan sementara pada tab ini. Cuplikan kamera tidak disimpan dalam riwayat. Konteks percakapan dikirim ke penyedia AI untuk menjawab pesanmu.</p>
        <div className="memory-list">{props.longTermMemories.length ? props.longTermMemories.map(item => <div key={item.id}><p>{item.content}</p><button className="icon-button" aria-label={"Hapus memori " + item.content} onClick={() => props.onDeleteMemoryItem(item.id)}><Trash2 size={16} /></button></div>) : <p>Belum ada preferensi yang disimpan.</p>}</div>
        <button className="secondary-button danger" onClick={() => { props.onClearSavedMemory(); setNotice("Memori tersimpan sudah dihapus."); }}><Trash2 size={16} />Hapus semua memori</button>
        <button className="secondary-button" onClick={() => { props.onClearConversation(); setNotice("Percakapan sudah dibersihkan."); }}>Bersihkan percakapan</button>
      </>}
      {notice && <p className="notice" role="status">{notice}</p>}
    </div>
    <div className="dialog-footer"><span>Perubahan disimpan otomatis di perangkat ini.</span><button className="primary-button" onClick={props.onClose}>Selesai</button></div>
  </dialog>;
}
