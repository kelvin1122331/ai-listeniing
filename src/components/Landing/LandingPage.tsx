"use client";
import { useEffect, useState } from "react";
import { ArrowRight, MessageSquare, Mic, Camera, Moon, Sun, ArrowUpRight } from "lucide-react";
import { CompanionConfig } from "@/types/companion";
import { AVATAR_PRESETS } from "@/constants/companionPresets";
import { VirtualAvatar } from "@/components/Avatar/VirtualAvatar";
import { VISEME_SHAPES } from "@/services/LipSyncService";

interface Props { config: CompanionConfig; onUpdateConfig: (config: Partial<CompanionConfig>) => void; onStartConversation: (message?: string) => void; }
export function LandingPage({ config, onUpdateConfig, onStartConversation }: Props) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("Memeriksa layanan");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/config/public", { signal: controller.signal, cache: "no-store" }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => setStatus(data.systemSettings?.maintenanceMode ? "Dalam pemeliharaan" : data.configured ? "Layanan siap" : "Perlu konfigurasi API")).catch(() => { if (!controller.signal.aborted) setStatus("Layanan belum terhubung"); });
    return () => controller.abort();
  }, []);
  const preset = AVATAR_PRESETS.find(p => p.id === config.avatarId) || AVATAR_PRESETS[0];
  return <div className="aura-app landing" data-theme={config.theme}>
    <header className="site-header"><a className="brand" href="/" aria-label="Beranda AURA"><span className="brand-mark">a</span>aura<span className="brand-dot">.</span></a><div className="header-actions"><span className="service-label"><i />{status}</span><button className="icon-button" onClick={() => onUpdateConfig({ theme: config.theme === "dark" ? "light" : "dark" })} aria-label="Ganti tema">{config.theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}</button><a className="text-link" href="/admin">Admin <ArrowUpRight size={15} /></a></div></header>
    <main className="landing-main">
      <section className="hero-copy">
        <p className="eyebrow"><span className="short-line" />RUANG UNTUK BERPIKIR BERSAMA</p>
        <h1>Percakapan kecil.<br /><em>Kemungkinan</em><br />yang luas.</h1>
        <p className="hero-description">Teman untuk bertukar ide, belajar hal baru, atau sekadar bercerita. Ketik, bicara, dan bagikan apa yang kamu lihat.</p>
        <form className="landing-composer" onSubmit={e => { e.preventDefault(); onStartConversation(prompt.trim() || undefined); }}>
          <label className="sr-only" htmlFor="first-message">Pesan pertama</label>
          <input id="first-message" value={prompt} maxLength={12000} onChange={e => setPrompt(e.target.value)} placeholder="Apa yang sedang kamu pikirkan?" />
          <button className="primary-button" type="submit">Mulai ngobrol <ArrowRight size={17} /></button>
        </form>
        <div className="suggestions" aria-label="Ide percakapan">{["Bantu kembangkan ideku", "Latihan bahasa Inggris", "Aku ingin bercerita"].map(text => <button key={text} onClick={() => onStartConversation(text)}>{text}<ArrowUpRight size={13} /></button>)}</div>
      </section>
      <section className="hero-companion" aria-label="Pilih teman percakapan">
        <div className="companion-topline"><span>TEMAN PERCAKAPANMU</span><span className="small-tag">01 / 04</span></div>
        <div className="hero-avatar"><VirtualAvatar preset={preset} aiName={config.aiName} conversationState="IDLE" expression="happy" visemeFrame={VISEME_SHAPES.rest} audioLevel={0} customAvatarUrl={config.customAvatarUrl} isDark={config.theme === "dark"} /></div>
        <div className="companion-intro"><h2>Halo, aku {config.aiName}.</h2><p>Senang bisa menemani harimu.</p></div>
        <div className="character-picker" aria-label="Karakter">{AVATAR_PRESETS.map(p => <button key={p.id} aria-pressed={config.avatarId === p.id} onClick={() => onUpdateConfig({ avatarId: p.id, aiName: p.name, voicePitch: p.defaultPitch, voiceRate: p.defaultRate, customAvatarUrl: null })}>{p.name}</button>)}</div>
      </section>
    </main>
    <section className="feature-strip" aria-label="Cara berinteraksi">{[
      { Icon: MessageSquare, title: "Mulai dari satu pesan", text: "Ide, pertanyaan, atau cerita sehari-hari." },
      { Icon: Mic, title: "Bicara dengan leluasa", text: "Percakapan suara dengan kontrol di tanganmu." },
      { Icon: Camera, title: "Bagikan sudut pandang", text: "Tanyakan isi kamera atau layar yang dibagikan." },
    ].map(({ Icon, title, text }, i) => <div key={title}><span className="feature-number">0{i + 1}</span><Icon size={21} /><h3>{title}</h3><p>{text}</p></div>)}</section>
    <footer className="site-footer"><span>AURA · Teman berpikir, setiap hari.</span><span>Kamera dan mikrofon aktif saat kamu memilihnya.</span></footer>
  </div>;
}
