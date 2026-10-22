import { CameraSourceMode, VisionAnalysisSummary } from "@/types/companion";
export interface CapturedFramePayload {
  compressedBase64: string; significantChange: boolean; visionSummary: VisionAnalysisSummary;
}
export class VisionService {
  static captureVideoFrame(video: HTMLVideoElement, source: CameraSourceMode = "webcam", maxWidth = 960, quality = 0.8): CapturedFramePayload | null {
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d"); if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Capture metadata only. Object recognition and OCR belong to the vision model.
    return {
      compressedBase64: canvas.toDataURL("image/jpeg", quality), significantChange: true,
      visionSummary: { sceneLabel: source === "screen" ? "Tangkapan layar" : "Frame kamera", dominantColors: [], brightness: "balanced", detectedObjects: [], sourceType: source, frameDeltaScore: 1, confidence: 0, capturedAt: new Date().toISOString() },
    };
  }
}
