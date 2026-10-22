"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CameraOff,
  ScanEye,
  Sparkles,
  Monitor,
  Layers,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  CAMERA_QUICK_PROMPTS,
  DEMO_CAMERA_SCENES,
  SCREEN_SHARE_QUICK_PROMPTS,
} from "@/constants/companionPresets";
import {
  CameraSourceMode,
  VisionAnalysisSummary,
} from "@/types/companion";
import { VisionService } from "@/services/VisionService";
import { AIService } from "@/services/AIService";

interface CameraPreviewProps {
  isCameraActive: boolean;
  cameraSourceMode: CameraSourceMode;
  setCameraSourceMode: (mode: CameraSourceMode) => void;
  selectedDemoSceneId: string;
  setSelectedDemoSceneId: (id: string) => void;
  selectedCameraDeviceId: string;
  sampleIntervalSec: number;
  adaptiveSampling: boolean;
  latestVisionSummary: VisionAnalysisSummary | null;
  onFrameCaptured: (base64: string, summary: VisionAnalysisSummary) => void;
  onQuickAskVision: (question: string) => void;
  onCloseCamera: () => void;
  onCameraError: (errMsg: string) => void;
  isDark: boolean;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  isCameraActive,
  cameraSourceMode,
  setCameraSourceMode,
  selectedDemoSceneId,
  setSelectedDemoSceneId,
  selectedCameraDeviceId,
  sampleIntervalSec,
  adaptiveSampling,
  latestVisionSummary,
  onFrameCaptured,
  onQuickAskVision,
  onCloseCamera,
  onCameraError,
  isDark,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [webcamNotice, setWebcamNotice] = useState<string | null>(null);

  const currentDemoScene =
    DEMO_CAMERA_SCENES.find((s) => s.id === selectedDemoSceneId) ||
    DEMO_CAMERA_SCENES[0];

  // Manage real Webcam / Screen Share stream only when isCameraActive is true
  useEffect(() => {
    if (!isCameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return;
    }

    if (cameraSourceMode === "demo_scene") {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setWebcamNotice(null);
      const demoPayload = VisionService.captureDemoSceneFrame(
        selectedDemoSceneId,
        "demo_scene"
      );
      onFrameCaptured(
        demoPayload.compressedBase64,
        demoPayload.visionSummary
      );
      AIService.sendRealtimeVisionFrame(
        demoPayload.compressedBase64,
        "demo_scene"
      );
      return;
    }

    let cancelled = false;

    const startMediaStream = async () => {
      try {
        setWebcamNotice(null);
        let stream: MediaStream;

        if (
          cameraSourceMode === "screen" &&
          navigator.mediaDevices?.getDisplayMedia
        ) {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: 800, height: 500 },
          });
        } else if (navigator.mediaDevices?.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video:
              selectedCameraDeviceId && selectedCameraDeviceId !== "default"
                ? {
                    deviceId: { exact: selectedCameraDeviceId },
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                  }
                : {
                    facingMode: "user",
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                  },
            audio: false,
          });
        } else {
          throw new Error("MediaDevices API not available");
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Listen for user stopping screen share via browser bar
        stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            onCloseCamera();
          };
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        onCameraError(
          cameraSourceMode === "screen"
            ? "Screen Share dibatalkan atau tidak tersedia di browser ini. Beralih ke Gemini Vision Simulator."
            : "Kamera fisik tidak terdeteksi atau izin ditolak. Beralih otomatis ke Gemini Vision Simulator agar kamu tetap bisa menguji fitur Vision AI."
        );
        setWebcamNotice(
          "Mode Gemini Vision Simulator Aktif (Kamera/Screen fisik tidak tersedia)"
        );
        setCameraSourceMode("demo_scene");
      }
    };

    startMediaStream();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isCameraActive,
    cameraSourceMode,
    selectedCameraDeviceId,
    selectedDemoSceneId,
  ]);

  // Adaptive Frame Sampling (Section 3, 4, 10: Never send 30/60 FPS; sample periodically & check frame delta)
  useEffect(() => {
    if (!isCameraActive) return;

    const intervalMs = Math.max(2000, sampleIntervalSec * 1000);
    const timer = setInterval(() => {
      if (cameraSourceMode === "demo_scene") {
        const payload = VisionService.captureDemoSceneFrame(
          selectedDemoSceneId,
          "demo_scene"
        );
        onFrameCaptured(payload.compressedBase64, payload.visionSummary);
      } else if (videoRef.current) {
        const payload = VisionService.captureVideoFrame(
          videoRef.current,
          cameraSourceMode
        );
        if (payload) {
          if (!adaptiveSampling || payload.significantChange) {
            onFrameCaptured(payload.compressedBase64, payload.visionSummary);
            AIService.sendRealtimeVisionFrame(
              payload.compressedBase64,
              cameraSourceMode
            );
          }
        }
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [
    isCameraActive,
    cameraSourceMode,
    selectedDemoSceneId,
    sampleIntervalSec,
    adaptiveSampling,
    onFrameCaptured,
  ]);

  const handleManualSnapshot = () => {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 220);

    if (cameraSourceMode === "demo_scene") {
      const payload = VisionService.captureDemoSceneFrame(
        selectedDemoSceneId,
        "demo_scene"
      );
      onFrameCaptured(payload.compressedBase64, payload.visionSummary);
      AIService.sendRealtimeVisionFrame(
        payload.compressedBase64,
        "demo_scene"
      );
    } else if (videoRef.current) {
      const payload = VisionService.captureVideoFrame(
        videoRef.current,
        cameraSourceMode
      );
      if (payload) {
        onFrameCaptured(payload.compressedBase64, payload.visionSummary);
        AIService.sendRealtimeVisionFrame(
          payload.compressedBase64,
          cameraSourceMode
        );
      }
    }
  };

  if (!isCameraActive) return null;

  const activePrompts =
    cameraSourceMode === "screen"
      ? SCREEN_SHARE_QUICK_PROMPTS
      : CAMERA_QUICK_PROMPTS;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 16 }}
        className={`fixed md:absolute z-30 right-3 top-16 md:right-5 md:bottom-24 md:top-auto transition-all duration-300 rounded-2xl overflow-hidden border shadow-2xl backdrop-blur-xl ${
          isExpanded
            ? "w-[320px] sm:w-[375px]"
            : "w-[245px] sm:w-[290px]"
        } ${
          isDark
            ? "bg-slate-900/90 border-slate-700/80 text-slate-100"
            : "bg-white/95 border-slate-300 text-slate-900"
        }`}
      >
        {/* Top Bar of PiP Video Window */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 bg-slate-950/60 text-white">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
            <span className="text-[11px] font-semibold tracking-wide uppercase text-rose-300">
              {cameraSourceMode === "screen"
                ? "Screen Share Active"
                : "Gemini Vision Active"}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setCameraSourceMode(
                  cameraSourceMode === "webcam" ? "demo_scene" : "webcam"
                )
              }
              title="Switch Live Webcam / Vision Scene Simulator"
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-sky-400 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Minimize" : "Expand Vision Controls"}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              {isExpanded ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onCloseCamera}
              title="Turn Camera / Screen Share Off"
              className="p-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition-colors"
            >
              <CameraOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Video or Demo Scene Viewport */}
        <div className="relative w-full aspect-[16/10] bg-slate-950 overflow-hidden">
          {cameraSourceMode !== "demo_scene" ? (
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className={`w-full h-full object-cover ${
                cameraSourceMode === "webcam" ? "transform scale-x-[-1]" : ""
              }`}
            />
          ) : (
            <div className="w-full h-full p-3 flex flex-col justify-between bg-gradient-to-br from-slate-900 via-indigo-950/80 to-slate-950 text-left">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/40 text-[10px] font-mono text-sky-300">
                  GEMINI VISION SIM
                </span>
                <span className="text-[10px] font-mono text-emerald-400">
                  Adaptive ({sampleIntervalSec}s)
                </span>
              </div>

              <div className="my-auto py-1">
                <p className="text-xs font-semibold text-white">
                  {currentDemoScene.titleId}
                </p>
                <p className="text-[10px] text-slate-300 line-clamp-2 mt-0.5">
                  Kiri: {currentDemoScene.spatialRegions.leftRegion.slice(0, 38)}...
                </p>
                {currentDemoScene.sampleText && (
                  <div className="mt-1 px-2 py-0.5 rounded bg-slate-950/90 border border-indigo-500/40 font-mono text-[10px] text-indigo-200 truncate">
                    {currentDemoScene.sampleText}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {currentDemoScene.objects.slice(0, 3).map((obj) => (
                  <span
                    key={obj}
                    className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-mono text-emerald-300"
                  >
                    {obj}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isFlashing && (
            <div className="absolute inset-0 bg-white/80 pointer-events-none transition-opacity" />
          )}

          <div className="absolute inset-2 pointer-events-none border border-sky-400/25 rounded-lg" />

          {/* Bottom Overlay Action Bar inside Video */}
          <div className="absolute bottom-1.5 inset-x-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleManualSnapshot}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900/85 hover:bg-sky-500/30 text-[10px] font-medium text-sky-300 border border-sky-500/30 backdrop-blur-md transition-all"
            >
              <ScanEye className="w-3 h-3" />
              <span>Snapshot</span>
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setCameraSourceMode(
                    cameraSourceMode === "webcam" ? "demo_scene" : "webcam"
                  )
                }
                className="px-2 py-1 rounded-md bg-slate-900/85 text-[10px] text-slate-300 hover:text-white border border-slate-700/70 backdrop-blur-md"
              >
                {cameraSourceMode === "webcam" ? "Demo Scene" : "Webcam"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setCameraSourceMode(
                    cameraSourceMode === "screen" ? "webcam" : "screen"
                  )
                }
                title="Share Screen to Gemini Vision"
                className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] backdrop-blur-md ${
                  cameraSourceMode === "screen"
                    ? "bg-indigo-500/30 border-indigo-400 text-indigo-200 font-semibold"
                    : "bg-slate-900/85 border-slate-700/70 text-slate-300 hover:text-white"
                }`}
              >
                <Monitor className="w-3 h-3" />
                <span>Screen</span>
              </button>
            </div>
          </div>
        </div>

        {webcamNotice && (
          <div className="px-2.5 py-1 bg-amber-500/10 border-t border-amber-500/20 text-[10px] text-amber-300">
            {webcamNotice}
          </div>
        )}

        {/* Scene Switcher when in Demo Vision Simulator Mode */}
        {cameraSourceMode === "demo_scene" && (
          <div className="p-2 border-t border-slate-800/60 flex items-center gap-1 overflow-x-auto">
            {DEMO_CAMERA_SCENES.map((scene, idx) => (
              <button
                key={scene.id}
                type="button"
                onClick={() => setSelectedDemoSceneId(scene.id)}
                className={`px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all ${
                  selectedDemoSceneId === scene.id
                    ? "bg-sky-500 text-slate-950 font-semibold"
                    : "bg-slate-800/70 text-slate-300 hover:bg-slate-800"
                }`}
              >
                #{idx + 1} {scene.titleId.split(" ")[0]}
              </button>
            ))}
          </div>
        )}

        {/* Quick Vision Prompts ("Ini benda apa?", "Apa yang sedang aku pegang?", "Baca tulisan ini.", "Yang sebelah kiri itu apa?") */}
        <div className="p-2.5 border-t border-slate-800/60 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1 font-medium text-sky-400">
              <Sparkles className="w-3 h-3" />
              {cameraSourceMode === "screen"
                ? "Tanya Gemini tentang Layar:"
                : "Tanya Gemini tentang Kamera:"}
            </span>
            {latestVisionSummary && (
              <span className="font-mono text-[9px] opacity-75">
                {latestVisionSummary.capturedAt}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {activePrompts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  handleManualSnapshot();
                  onQuickAskVision(q);
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-medium border transition-all text-left ${
                  isDark
                    ? "bg-slate-800/80 hover:bg-sky-500/20 border-slate-700 hover:border-sky-400/50 text-slate-200"
                    : "bg-slate-100 hover:bg-sky-50 border-slate-200 text-slate-700"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
