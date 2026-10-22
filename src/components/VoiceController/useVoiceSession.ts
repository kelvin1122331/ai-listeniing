"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AIService } from "@/services/AIService";
import { LipSyncService, VISEME_SHAPES, VisemeFrame } from "@/services/LipSyncService";
import { AvatarExpression, CompanionConfig, ConversationState, GeminiLiveConnectionStatus } from "@/types/companion";

interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; abort(): void;
}
interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string } } };
}
interface Options {
  conversationContext?: string;
  config: CompanionConfig; conversationState: ConversationState;
  setConversationState: (state: ConversationState) => void;
  setExpression: (expression: AvatarExpression) => void;
  onUserSpeechFinal: (text: string) => void;
  onLiveUserTranscript?: (text: string, final: boolean) => void;
  onLiveAssistantTranscript?: (text: string, final: boolean) => void;
}

export function useVoiceSession(options: Options) {
  const current = useRef(options); current.current = options;
  const alive = useRef(true);
  const [isListening, setIsListening] = useState(false);
  const [isAiMuted, setIsAiMuted] = useState(false);
  const muted = useRef(false); muted.current = isAiMuted;
  const [interimTranscript, setInterimTranscript] = useState("");
  const [visemeFrame, setVisemeFrame] = useState<VisemeFrame>(VISEME_SHAPES.rest);
  const [audioLevel, setAudioLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<GeminiLiveConnectionStatus>("disconnected");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const capture = useRef<{ stream: MediaStream; ctx: AudioContext; node: AudioWorkletNode } | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const epoch = useRef(0);
  const starting = useRef(false);
  const listening = useRef(false);
  const playback = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);
  const sources = useRef(new Set<AudioBufferSourceNode>());
  const nextAudioTime = useRef(0);
  const lipTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  const rest = useCallback(() => {
    if (!alive.current) return;
    setVisemeFrame(VISEME_SHAPES.rest); setAudioLevel(0);
    current.current.setConversationState(listening.current ? "LISTENING" : "IDLE");
    current.current.setExpression(listening.current ? "listening" : "idle");
  }, []);
  const stopPlayback = useCallback(() => {
    if (lipTimer.current) clearInterval(lipTimer.current);
    lipTimer.current = null;
    if (utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; }
    utterance.current = null;
    window.speechSynthesis?.cancel();
    for (const source of sources.current) { source.onended = null; try { source.stop(); } catch {} }
    sources.current.clear(); nextAudioTime.current = 0; rest();
  }, [rest]);
  const releaseInput = useCallback(() => {
    epoch.current++; starting.current = false; listening.current = false;
    if (recognition.current) {
      recognition.current.onend = null; recognition.current.onresult = null; recognition.current.onerror = null;
      recognition.current.abort(); recognition.current = null;
    }
    if (capture.current) {
      capture.current.node.port.onmessage = null;
      capture.current.node.disconnect();
      capture.current.stream.getTracks().forEach(t => t.stop());
      void capture.current.ctx.close().catch(() => {});
      capture.current = null;
    }
  }, []);
  const stopListening = useCallback(() => {
    releaseInput(); AIService.sendRealtimeAudioChunk("");
    AIService.disconnectRealtimeSession(); stopPlayback();
    if (alive.current) { setIsListening(false); setInterimTranscript(""); }
  }, [releaseInput, stopPlayback]);
  const stopSpeaking = useCallback((markInterrupted = false) => {
    stopPlayback(); AIService.interruptRealtimeResponse();
    if (markInterrupted && alive.current) {
      current.current.setExpression(listening.current ? "listening" : "interrupted");
    }
  }, [stopPlayback]);

  useEffect(() => {
    alive.current = true;
    const load = () => setAvailableVoices(window.speechSynthesis?.getVoices() || []);
    load(); window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => {
      alive.current = false; releaseInput(); AIService.disconnectRealtimeSession(); stopPlayback();
      window.speechSynthesis?.removeEventListener("voiceschanged", load);
      void playback.current?.close().catch(() => {}); playback.current = null; gain.current = null;
    };
  }, [releaseInput, stopPlayback]);

  useEffect(() => {
    if (gain.current) gain.current.gain.value = isAiMuted ? 0 : options.config.speakerVolume;
    if (isAiMuted || options.config.speakerVolume === 0) stopPlayback();
  }, [isAiMuted, options.config.speakerVolume, stopPlayback]);

  // Changing an input device or Live mode ends the current capture cleanly.
  useEffect(() => {
    stopListening();
  }, [options.config.selectedMicrophoneId, options.config.useGeminiLiveVoice, options.config.preferredLanguage, stopListening]);

  const playPcm = useCallback((base64: string) => {
    if (muted.current || !alive.current || current.current.config.speakerVolume <= 0) return;
    try {
      if (!playback.current) playback.current = new AudioContext({ sampleRate: 24000 });
      const ctx = playback.current;
      if (!gain.current) { gain.current = ctx.createGain(); gain.current.connect(ctx.destination); }
      gain.current.gain.value = current.current.config.speakerVolume;
      void ctx.resume();
      const bytes = atob(base64);
      const buffer = ctx.createBuffer(1, Math.floor(bytes.length / 2), 24000);
      const channel = buffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < channel.length; i++) {
        const int = (bytes.charCodeAt(i * 2 + 1) << 8) | bytes.charCodeAt(i * 2);
        channel[i] = (int >= 32768 ? int - 65536 : int) / 32768;
        sum += channel[i] * channel[i];
      }
      const amplitude = Math.min(1, Math.sqrt(sum / channel.length) * 3);
      const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(gain.current);
      sources.current.add(source);
      const start = Math.max(ctx.currentTime + 0.015, nextAudioTime.current);
      nextAudioTime.current = start + buffer.duration;
      current.current.setConversationState("SPEAKING"); current.current.setExpression("speaking");
      setAudioLevel(amplitude); setVisemeFrame(LipSyncService.amplitudeToVisemeFrame(amplitude));
      source.onended = () => { sources.current.delete(source); if (!sources.current.size) rest(); };
      source.start(start);
    } catch { setMicError("Audio tidak dapat diputar. Coba mulai ulang suara."); }
  }, [rest]);

  const connectGeminiLive = useCallback(async () => AIService.connectRealtimeLiveSession(current.current.config, {
    onStatusChange: status => {
      if (!alive.current) return;
      setLiveStatus(status);
      if (status === "fallback" && capture.current) {
        releaseInput(); setIsListening(false); stopPlayback();
        setMicError("Sesi suara terputus. Tekan mikrofon untuk menyambungkan kembali atau gunakan chat.");
      }
    },
    onTranscriptUpdate: (text, final, role) => {
      if (!alive.current) return;
      if (role === "assistant") current.current.onLiveAssistantTranscript?.(text, final);
      else { setInterimTranscript(final ? "" : text); current.current.onLiveUserTranscript?.(text, final); }
    },
    onAudioChunk: playPcm,
    onAvatarStateChange: (state, expression) => { if (alive.current) { current.current.setConversationState(state); current.current.setExpression(expression); } },
    onInterrupted: stopPlayback,
    onError: message => { if (alive.current) setMicError(message); },
  }, current.current.conversationContext), [playPcm, releaseInput, stopPlayback]);

  const startListening = useCallback(async () => {
    if (listening.current || starting.current) return;
    starting.current = true; const turn = ++epoch.current;
    setMicError(null); stopPlayback();
    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Mikrofon membutuhkan HTTPS atau localhost dan browser yang mendukung.");
      // Resume playback in the user's click gesture.
      if (!playback.current) playback.current = new AudioContext({ sampleRate: 24000 });
      await playback.current.resume();
      const config = current.current.config;
      stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true,
        ...(config.selectedMicrophoneId !== "default" ? { deviceId: { exact: config.selectedMicrophoneId } } : {}),
      } });
      if (turn !== epoch.current) { stream.getTracks().forEach(t => t.stop()); return; }
      const live = config.useGeminiLiveVoice ? await connectGeminiLive() : false;
      if (turn !== epoch.current) { stream.getTracks().forEach(t => t.stop()); return; }
      if (live) {
        const ctx = new AudioContext({ sampleRate: 16000 });
        try {
          await ctx.audioWorklet.addModule("/pcm-capture.js");
          if (turn !== epoch.current) { await ctx.close(); stream.getTracks().forEach(t => t.stop()); return; }
          const node = new AudioWorkletNode(ctx, "pcm-capture");
          const silent = ctx.createGain(); silent.gain.value = 0;
          ctx.createMediaStreamSource(stream).connect(node); node.connect(silent); silent.connect(ctx.destination);
          capture.current = { stream, ctx, node };
          node.port.onmessage = event => {
            const { buffer, level } = event.data as { buffer: ArrayBuffer; level: number };
            if (turn !== epoch.current) return;
            const bytes = new Uint8Array(buffer);
            let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
            AIService.sendRealtimeAudioChunk(btoa(binary));
            if (!sources.current.size) setAudioLevel(Math.min(1, level * 4));
          };
          await ctx.resume();
        } catch (err) { await ctx.close().catch(() => {}); throw err; }
      } else {
        stream.getTracks().forEach(t => t.stop()); stream = null;
        const browser = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
        const API = browser.SpeechRecognition || browser.webkitSpeechRecognition;
        if (!API) throw new Error("Input suara tidak didukung browser ini dan Gemini Live belum tersedia. Kamu tetap bisa mengetik.");
        const rec = new API(); recognition.current = rec;
        rec.lang = config.preferredLanguage === "en" ? "en-US" : "id-ID";
        rec.continuous = false; rec.interimResults = true;
        rec.onresult = event => {
          let final = "", interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) final += event.results[i][0].transcript;
            else interim += event.results[i][0].transcript;
          }
          setInterimTranscript(interim);
          if (final.trim()) { stopListening(); current.current.onUserSpeechFinal(final.trim()); }
        };
        rec.onerror = event => {
          stopListening();
          if (event.error !== "aborted") setMicError(event.error === "not-allowed" ? "Izin mikrofon ditolak. Izinkan mikrofon di browser atau gunakan chat." : event.error === "no-speech" ? "Belum terdengar suara. Tekan mikrofon untuk mencoba lagi." : "Input suara browser terputus. Coba lagi atau gunakan chat.");
        };
        rec.onend = () => { if (recognition.current === rec) stopListening(); };
        setLiveStatus("fallback"); rec.start();
      }
      starting.current = false; listening.current = true; setIsListening(true);
      current.current.setConversationState("LISTENING"); current.current.setExpression("listening");
    } catch (err) {
      stream?.getTracks().forEach(t => t.stop());
      if (turn !== epoch.current) return;
      stopListening();
      setMicError(err instanceof DOMException && err.name === "NotAllowedError" ? "Izin mikrofon ditolak. Izinkan mikrofon di browser atau gunakan chat." : err instanceof Error ? err.message : "Mikrofon tidak dapat dimulai.");
    }
  }, [connectGeminiLive, stopListening, stopPlayback]);

  const speakText = useCallback((text: string, lang: "id" | "en" = "id", forceSpeak = false) => {
    stopPlayback();
    const { config } = current.current;
    if (muted.current || config.speakerVolume <= 0 || (!config.autoSpeak && !forceSpeak)) return;
    if (!window.speechSynthesis) { setMicError("Pembacaan suara tidak tersedia di browser ini."); return; }
    const clean = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_#>`~]/g, "").trim();
    if (!clean) return;
    const speech = new SpeechSynthesisUtterance(clean);
    utterance.current = speech;
    speech.lang = lang === "id" ? "id-ID" : "en-US";
    speech.volume = config.speakerVolume; speech.rate = config.voiceRate; speech.pitch = config.voicePitch;
    const voices = window.speechSynthesis.getVoices();
    speech.voice = voices.find(v => v.voiceURI === config.voiceURI) || voices.find(v => v.lang.startsWith(lang)) || null;
    speech.onstart = () => {
      if (utterance.current !== speech) return;
      current.current.setConversationState("SPEAKING"); current.current.setExpression("speaking");
      const timeline = LipSyncService.buildVisemeTimeline(clean, config.voiceRate); const start = performance.now();
      lipTimer.current = setInterval(() => {
        const elapsed = performance.now() - start;
        const frame = [...timeline].reverse().find(f => f.timeMs <= elapsed)?.frame || VISEME_SHAPES.rest;
        setVisemeFrame(frame); setAudioLevel(frame.openness);
      }, 60);
    };
    speech.onend = () => { if (utterance.current === speech) { utterance.current = null; if (lipTimer.current) clearInterval(lipTimer.current); lipTimer.current = null; rest(); } };
    speech.onerror = () => { if (utterance.current === speech) { stopPlayback(); setMicError("Pembacaan suara gagal. Teks jawaban tetap tersedia."); } };
    window.speechSynthesis.speak(speech);
  }, [rest, stopPlayback]);

  return { isListening, isAiMuted, setIsAiMuted, interimTranscript, visemeFrame, audioLevel, micError, setMicError, liveStatus, reconnectGeminiLive: connectGeminiLive, availableVoices, startListening, stopListening, speakText, stopSpeaking };
}
