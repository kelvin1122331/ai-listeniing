"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowUp, Camera, Check, ChevronDown, Copy, Download, MessageSquare, Mic, Monitor, Moon, Plus, Settings, Square, Sun, Volume2, VolumeX, X, AlertCircle } from "lucide-react";
import { AVATAR_PRESETS } from "@/constants/companionPresets";
import { ChatMessage, CompanionConfig, ConversationState, AvatarExpression, LongTermMemoryItem, UserProfile } from "@/types/companion";
import { AIService } from "@/services/AIService";
import { MemoryService } from "@/services/MemoryService";
import { CapturedFramePayload } from "@/services/VisionService";
import { VirtualAvatar } from "@/components/Avatar/VirtualAvatar";
import { CameraPreview, CameraHandle } from "@/components/CameraController/CameraPreview";
import { useVoiceSession } from "@/components/VoiceController/useVoiceSession";
import { SettingsModal } from "@/components/Settings/SettingsModal";

interface Props {
  config: CompanionConfig; onUpdateConfig: (value: Partial<CompanionConfig>) => void;
  userProfile: UserProfile; onUpdateProfile: (value: Partial<UserProfile>) => void;
  onEndSession: () => void; initialPrompt?: string | null; onClearInitialPrompt?: () => void;
}
interface PublicConfig {
  configured: boolean; activeProvider: string; models: { textModel: string };
  systemSettings: { maintenanceMode: boolean; enableVoice: boolean; enableCamera: boolean; enableScreenSharing: boolean; enableMemory: boolean };
  voiceSettings: { voiceEnabled: boolean };
}
const time = () => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const makeMessage = (role: "user" | "assistant", content: string, source: ChatMessage["source"] = "text"): ChatMessage => ({ id: crypto.randomUUID(), role, content, source, timestamp: time() });

export function MainConversationView({ config, onUpdateConfig, onEndSession, initialPrompt, onClearInitialPrompt }: Props) {
  const [state, setState] = useState<ConversationState>("IDLE");
  const [expression, setExpression] = useState<AvatarExpression>("happy");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const history = useRef<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const [failed, setFailed] = useState<{ text: string; history: ChatMessage[] } | null>(null);
  const [camera, setCamera] = useState<"webcam" | "screen" | null>(null);
  const cameraHandle = useRef<CameraHandle>(null);
  const frame = useRef<CapturedFramePayload | null>(null);
  const [memories, setMemories] = useState<LongTermMemoryItem[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backend, setBackend] = useState<PublicConfig | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const userLiveId = useRef<string | null>(null);
  const assistantLiveId = useRef<string | null>(null);
  const sendRef = useRef<(text: string) => void>(() => {});
  const commit = useCallback((next: ChatMessage[]) => {
    history.current = next; setMessages(next); MemoryService.saveShortTermHistory(next);
  }, []);
  const updateLive = useCallback((role: "user" | "assistant", text: string, final: boolean) => {
    const ref = role === "user" ? userLiveId : assistantLiveId;
    if (!ref.current) ref.current = crypto.randomUUID();
    const id = ref.current;
    const existing = history.current.find(m => m.id === id);
    const next = existing ? history.current.map(m => m.id === id ? { ...m, content: text } : m) : [...history.current, { ...makeMessage(role, text, "voice"), id }];
    commit(next);
    if (final) ref.current = null;
  }, [commit]);
  const voice = useVoiceSession({
    config, conversationState: state, setConversationState: setState, setExpression,
    conversationContext: JSON.stringify({ history: messages.slice(-12).map(m => ({ role: m.role, content: m.content.slice(0, 750) })), preferences: config.memoryEnabled && backend?.systemSettings?.enableMemory !== false ? memories.map(m => m.content) : [] }),
    onUserSpeechFinal: text => sendRef.current(text),
    onLiveUserTranscript: (text, final) => updateLive("user", text, final),
    onLiveAssistantTranscript: (text, final) => updateLive("assistant", text, final),
  });
  const preset = AVATAR_PRESETS.find(p => p.id === config.avatarId) || AVATAR_PRESETS[0];
  const cancel = useCallback(() => {
    pending.current?.abort(); pending.current = null; setBusy(false); setState("IDLE");
  }, []);
  const closeCamera = useCallback(() => { frame.current = null; setCamera(null); }, []);

  useEffect(() => {
    commit(MemoryService.getShortTermHistory()); setMemories(MemoryService.getLongTermMemories());
    const controller = new AbortController();
    fetch("/api/config/public", { signal: controller.signal, cache: "no-store" }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(setBackend).catch(() => { if (!controller.signal.aborted) setError("Status layanan belum dapat diperiksa. Coba muat ulang halaman."); });
    return () => { controller.abort(); pending.current?.abort(); pending.current = null; if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, [commit]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy, camera]);
  const initialHandled = useRef(false);
  useEffect(() => {
    if (!initialPrompt || initialHandled.current) return;
    const timer = setTimeout(() => { initialHandled.current = true; sendRef.current(initialPrompt); onClearInitialPrompt?.(); }, 150);
    return () => clearTimeout(timer);
  }, [initialPrompt, onClearInitialPrompt]);

  const send = useCallback(async (raw: string, retryHistory?: ChatMessage[]) => {
    const text = raw.trim(); if (!text || pending.current) return;
    if (text.length > 12000) { setError("Pesan maksimal 12.000 karakter."); return; }
    let snapshot: CapturedFramePayload | null = null;
    if (camera) {
      snapshot = cameraHandle.current?.capture() || frame.current;
      if (!snapshot) { setError("Tunggu pratinjau kamera atau layar tampil sebelum mengirim pesan."); return; }
    }
    voice.stopListening(); voice.stopSpeaking();
    userLiveId.current = null; assistantLiveId.current = null;
    const before = retryHistory || [...history.current];
    if (!retryHistory) commit([...before, makeMessage("user", text, camera === "screen" ? "screen" : camera ? "vision" : "text")]);
    setInput(""); setError(null); setFailed(null); setBusy(true); setState("PROCESSING"); setExpression("thinking");
    const controller = new AbortController(); pending.current = controller;
    let nextMemories = memories;
    if (config.memoryEnabled && backend?.systemSettings?.enableMemory !== false) {
      nextMemories = MemoryService.extractMemoryFromUserMessage(text, memories); setMemories(nextMemories);
    }
    try {
      const result = await AIService.sendMessage({
        signal: controller.signal, requestId: crypto.randomUUID(), message: text, messagesHistory: before,
        config, longTermMemory: nextMemories, cameraActive: !!camera, cameraSourceMode: camera || "webcam",
        imageSnapshot: snapshot?.compressedBase64,
      });
      if (pending.current !== controller || controller.signal.aborted) return;
      commit([...history.current, makeMessage("assistant", result.reply)]);
      setState("IDLE"); setExpression(result.expression);
      if (backend?.systemSettings?.enableVoice !== false && backend?.voiceSettings?.voiceEnabled !== false) voice.speakText(result.reply, result.detectedLanguage);
    } catch (err) {
      if (pending.current !== controller || controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Pesan gagal dikirim. Coba lagi.");
      setFailed({ text, history: before }); setState("IDLE"); setExpression("confused");
    } finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
  }, [backend, camera, commit, config, memories, voice]);
  sendRef.current = text => { void send(text); };
  const newConversation = () => {
    cancel(); voice.stopListening(); voice.stopSpeaking(); commit([]); setFailed(null); setError(null); setInput("");
    userLiveId.current = null; assistantLiveId.current = null;
  };
  const copyMessage = async (message: ChatMessage) => {
    try { await navigator.clipboard.writeText(message.content); setCopied(message.id); if (copyTimer.current) clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(null), 1800); }
    catch { setError("Teks belum dapat disalin. Pilih teks jawaban untuk menyalinnya."); }
  };
  const exportConversation = () => {
    const blob = new Blob([messages.map(m => (m.role === "user" ? "Kamu" : config.aiName) + " · " + m.timestamp + "\n" + m.content).join("\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "aura-percakapan.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const status = busy ? "Menyiapkan jawaban" : state === "SPEAKING" ? "Sedang berbicara" : voice.isListening ? "Mendengarkan" : "Siap menemanimu";
  const voiceEnabled = backend?.systemSettings?.enableVoice !== false && backend?.voiceSettings?.voiceEnabled !== false;
  return <div className="aura-app workspace" data-theme={config.theme}>
    <aside className="workspace-sidebar">
      <a className="brand" href="/" onClick={e => { e.preventDefault(); cancel(); voice.stopListening(); onEndSession(); }}><span className="brand-mark">a</span>aura<span className="brand-dot">.</span></a>
      <button className="new-chat" onClick={newConversation}><Plus size={18} />Percakapan baru</button>
      <div className="sidebar-section-label">RUANG PERCAKAPAN</div>
      <div className="sidebar-current"><MessageSquare size={17} /><span>{messages.find(m => m.role === "user")?.content.slice(0, 26) || "Cerita hari ini"}</span></div>
      <div className="sidebar-companion"><VirtualAvatar preset={preset} aiName={config.aiName} conversationState={state} expression={expression} visemeFrame={voice.visemeFrame} audioLevel={voice.audioLevel} customAvatarUrl={config.customAvatarUrl} isDark={config.theme === "dark"} /><h2>{config.aiName}</h2><p><span className={voice.isListening ? "status-dot active" : "status-dot"} />{status}</p></div>
      <div className="sidebar-bottom"><p>Ruang untuk ide, pertanyaan,<br />dan cerita yang berarti.</p><button onClick={() => { voice.stopListening(); setSettingsOpen(true); }}><Settings size={17} />Pengaturan</button><a href="/admin">Pengaturan admin</a></div>
    </aside>
    <main className="conversation-main">
      <header className="conversation-header"><div className="conversation-title"><button className="icon-button mobile-only" aria-label="Kembali ke beranda" onClick={() => { cancel(); voice.stopListening(); onEndSession(); }}><ArrowLeft size={20} /></button><div><h1>Percakapan <ChevronDown size={14} /></h1><p>{backend?.systemSettings?.maintenanceMode ? "Dalam pemeliharaan" : backend?.configured ? "Terhubung ke " + backend.activeProvider : "API belum dikonfigurasi"}</p></div></div><div className="header-actions"><button className="icon-button mobile-only" onClick={newConversation} aria-label="Percakapan baru"><Plus size={20} /></button><button className="icon-button" disabled={!messages.length} aria-label="Unduh percakapan" onClick={exportConversation}><Download size={18} /></button><button className="icon-button" onClick={() => onUpdateConfig({ theme: config.theme === "dark" ? "light" : "dark" })} aria-label="Ganti tema">{config.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button><button className="icon-button" onClick={() => { voice.stopListening(); setSettingsOpen(true); }} aria-label="Buka pengaturan"><Settings size={18} /></button></div></header>
      <div className="conversation-scroll">
        <div className="transcript">
          {!messages.length && <section className="conversation-empty"><span className="eyebrow">SELAMAT DATANG DI RUANGMU</span><h2>Mau cerita apa hari ini?</h2><p>Aku {config.aiName}. Kita bisa mulai dari hal sederhana.</p><div className="starter-grid">{["Bantu aku mengembangkan sebuah ide", "Jelaskan hal baru dengan sederhana", "Ayo latihan percakapan bahasa Inggris", "Aku ingin bercerita tentang hariku"].map((text, i) => <button key={text} onClick={() => void send(text)}><span>0{i + 1}</span>{text}<ArrowUp size={16} /></button>)}</div></section>}
          <div role="log" aria-label="Pesan percakapan" aria-live="polite" aria-relevant="additions text">
            {messages.map(message => <article key={message.id} className={"message message-" + message.role}>
              <div className="message-meta"><span className="message-avatar">{message.role === "user" ? "K" : "a"}</span><strong>{message.role === "user" ? "Kamu" : config.aiName}</strong><time>{message.timestamp}</time>{message.source === "vision" && <Camera size={13} />}{message.source === "screen" && <Monitor size={13} />}{message.source === "voice" && <Mic size={13} />}</div>
              <div className="message-body markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: props => <a {...props} target="_blank" rel="noopener noreferrer" />, img: () => null }}>{message.content}</ReactMarkdown></div>
              {message.role === "assistant" && <div className="message-actions"><button onClick={() => void copyMessage(message)} aria-label="Salin jawaban">{copied === message.id ? <Check size={14} /> : <Copy size={14} />}{copied === message.id ? "Tersalin" : "Salin"}</button>{voiceEnabled && <button onClick={() => voice.speakText(message.content, config.preferredLanguage === "en" ? "en" : "id", true)} aria-label="Bacakan jawaban"><Volume2 size={14} />Dengarkan</button>}</div>}
            </article>)}
          </div>
          {busy && <div className="thinking" role="status"><span className="thinking-dots"><i /><i /><i /></span>{config.aiName} sedang berpikir…</div>}
          {camera && <CameraPreview key={camera} ref={cameraHandle} source={camera} deviceId={config.selectedCameraId} sampleIntervalSec={config.cameraSampleIntervalSec} onFrame={value => { frame.current = value; }} onClose={closeCamera} onError={setError} />}
          <div ref={bottom} />
        </div>
      </div>
      <div className="composer-area">
        {(error || voice.micError) && <div className="notice error-notice" role="alert"><AlertCircle size={17} /><div>{error || voice.micError}{failed && <button className="text-link" onClick={() => void send(failed.text, failed.history)} disabled={busy}>Coba lagi</button>}</div><button className="icon-button" aria-label="Tutup pemberitahuan" onClick={() => { setError(null); voice.setMicError(null); }}><X size={16} /></button></div>}
        {voice.isListening && <div className="voice-notice" role="status"><span className="status-dot active" />{voice.interimTranscript || (voice.liveStatus === "connected" ? "Suara langsung aktif. Silakan bicara." : "Mendengarkan melalui pengenal suara browser…")}<button onClick={voice.stopListening}>Selesai</button></div>}
        {voice.liveStatus === "connecting" && <div className="voice-notice" role="status">Menghubungkan suara…<button onClick={voice.stopListening}>Batal</button></div>}
        <form className="chat-composer" onSubmit={e => { e.preventDefault(); void send(input); }}>
          <label htmlFor="message" className="sr-only">Pesan untuk {config.aiName}</label>
          <textarea id="message" rows={2} value={input} onChange={e => setInput(e.target.value)} maxLength={12000} placeholder={"Tulis pesan untuk " + config.aiName + "…"} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!busy) void send(input); } }} />
          <div className="composer-toolbar"><div className="composer-tools">
            <button type="button" className={voice.isListening ? "tool-button selected" : "tool-button"} aria-pressed={voice.isListening} disabled={busy || !voiceEnabled} aria-label={voice.isListening ? "Hentikan mikrofon" : "Mulai mikrofon"} onClick={() => voice.isListening ? voice.stopListening() : void voice.startListening()}><Mic size={18} /><span>Bicara</span></button>
            <button type="button" className={camera === "webcam" ? "tool-button selected" : "tool-button"} disabled={backend?.systemSettings?.enableCamera === false} aria-pressed={camera === "webcam"} aria-label="Kamera" onClick={() => { frame.current = null; setCamera(camera === "webcam" ? null : "webcam"); }}><Camera size={18} /><span>Kamera</span></button>
            <button type="button" className={camera === "screen" ? "tool-button selected" : "tool-button"} disabled={backend?.systemSettings?.enableScreenSharing === false} aria-pressed={camera === "screen"} aria-label="Bagikan layar" onClick={() => { frame.current = null; setCamera(camera === "screen" ? null : "screen"); }}><Monitor size={18} /><span>Layar</span></button>
            <button type="button" className="tool-button audio-toggle" aria-pressed={config.autoSpeak && !voice.isAiMuted} aria-label={config.autoSpeak && !voice.isAiMuted ? "Nonaktifkan balasan suara" : "Aktifkan balasan suara"} onClick={() => { const enabled = !config.autoSpeak || voice.isAiMuted; onUpdateConfig({ autoSpeak: enabled }); voice.setIsAiMuted(!enabled); if (!enabled) voice.stopSpeaking(); }}>{config.autoSpeak && !voice.isAiMuted ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          </div>{busy ? <button type="button" className="send-button" aria-label="Batalkan jawaban" onClick={cancel}><Square size={17} /></button> : state === "SPEAKING" && !input.trim() ? <button type="button" className="send-button" aria-label="Hentikan suara" onClick={() => voice.stopSpeaking(true)}><Square size={17} /></button> : <button type="submit" className="send-button" disabled={!input.trim()} aria-label="Kirim pesan"><ArrowUp size={21} /></button>}</div>
        </form>
        <p className="composer-footnote">AURA dapat keliru. Periksa kembali informasi yang penting.<span>Enter untuk kirim · Shift + Enter untuk baris baru</span></p>
      </div>
    </main>
    <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} config={config} onUpdateConfig={onUpdateConfig} availableVoices={voice.availableVoices} longTermMemories={memories} onClearConversation={newConversation} onClearSavedMemory={() => { MemoryService.clearLongTermMemory(); setMemories([]); }} onDeleteMemoryItem={id => { const next = memories.filter(m => m.id !== id); setMemories(next); MemoryService.saveLongTermMemories(next); }} />
  </div>;
}
