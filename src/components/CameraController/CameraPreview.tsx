"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Camera, Monitor, X } from "lucide-react";
import { VisionService, CapturedFramePayload } from "@/services/VisionService";
import { AIService } from "@/services/AIService";

export interface CameraHandle { capture(): CapturedFramePayload | null; }
interface Props {
  source: "webcam" | "screen"; deviceId: string; sampleIntervalSec: number;
  onFrame: (frame: CapturedFramePayload) => void; onClose: () => void; onError: (message: string) => void;
}
export const CameraPreview = forwardRef<CameraHandle, Props>(function CameraPreview(props, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const callbacks = useRef(props); callbacks.current = props;
  const [ready, setReady] = useState(false);
  const capture = () => video.current ? VisionService.captureVideoFrame(video.current, props.source, props.source === "screen" ? 1280 : 960, 0.8) : null;
  useImperativeHandle(ref, () => ({ capture }));
  useEffect(() => {
    let cancelled = false; let stream: MediaStream | null = null;
    setReady(false);
    async function start() {
      try {
        if (!navigator.mediaDevices) throw new Error("Media tidak tersedia");
        if (props.source === "screen") {
          if (!navigator.mediaDevices.getDisplayMedia) throw new Error("Berbagi layar tidak didukung");
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        } else {
          stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, ...(props.deviceId !== "default" ? { deviceId: { exact: props.deviceId } } : { facingMode: "user" }) }, audio: false });
        }
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        stream.getVideoTracks().forEach(track => { track.onended = () => { callbacks.current.onClose(); }; });
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
      } catch (error) {
        if (cancelled) return;
        const denied = error instanceof DOMException && ["NotAllowedError", "AbortError"].includes(error.name);
        callbacks.current.onError(props.source === "screen" ? denied ? "Berbagi layar dibatalkan. Pilih layar untuk membagikannya." : "Berbagi layar tidak tersedia di browser ini." : denied ? "Izin kamera ditolak. Izinkan kamera di browser untuk menggunakannya." : "Kamera tidak dapat diakses. Periksa perangkat dan pengaturan kamera.");
        callbacks.current.onClose();
      }
    }
    void start();
    return () => { cancelled = true; stream?.getTracks().forEach(track => { track.onended = null; track.stop(); }); };
  }, [props.source, props.deviceId]);
  useEffect(() => {
    if (!ready) return;
    const sample = () => {
      if (!video.current) return;
      const payload = VisionService.captureVideoFrame(video.current, props.source, props.source === "screen" ? 1280 : 960, 0.8);
      if (payload) { callbacks.current.onFrame(payload); AIService.sendRealtimeVisionFrame(payload.compressedBase64, props.source); }
    };
    sample();
    const timer = setInterval(sample, Math.max(1000, props.sampleIntervalSec * 1000));
    return () => clearInterval(timer);
  }, [ready, props.sampleIntervalSec, props.source]);
  return <section className="camera-preview" aria-label={props.source === "screen" ? "Pratinjau layar" : "Pratinjau kamera"}>
    <div className="camera-heading"><span>{props.source === "screen" ? <Monitor size={15} /> : <Camera size={15} />}{props.source === "screen" ? "Layar dibagikan" : "Kamera aktif"}</span><button className="icon-button" aria-label="Tutup pratinjau" onClick={props.onClose}><X size={16} /></button></div>
    <video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} className={props.source === "webcam" ? "mirrored" : ""} />
    <p>{ready ? "Gambar terbaru disertakan saat kamu mengirim pesan." : "Menyiapkan pratinjau…"}</p>
  </section>;
});
