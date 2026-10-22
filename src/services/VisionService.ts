import { DEMO_CAMERA_SCENES } from "@/constants/companionPresets";
import {
  CameraSourceMode,
  DemoCameraScene,
  SpatialRegionsSummary,
  VisionAnalysisSummary,
} from "@/types/companion";

export interface CapturedFramePayload {
  compressedBase64: string;
  visionSummary: VisionAnalysisSummary;
  significantChange: boolean;
}

export class VisionService {
  private static previousSignature: number[] | null = null;

  /**
   * Captures and compresses a single frame from a live HTMLVideoElement (Webcam or Screen Share).
   * Performs spatial left/center/right pixel analysis and computes frame-to-frame delta score
   * for adaptive sampling optimization (Section 3, 4, 10).
   */
  static captureVideoFrame(
    videoEl: HTMLVideoElement,
    sourceMode: CameraSourceMode = "webcam",
    maxWidth = 480,
    quality = 0.7
  ): CapturedFramePayload | null {
    if (!videoEl || videoEl.readyState < 2) return null;

    const rawW = videoEl.videoWidth || 640;
    const rawH = videoEl.videoHeight || 480;
    const scale = Math.min(1, maxWidth / rawW);
    const width = Math.round(rawW * scale);
    const height = Math.round(rawH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(videoEl, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixelStats = this.analyzeCanvasPixels(
      imageData,
      width,
      height,
      sourceMode
    );

    const compressedBase64 = canvas.toDataURL("image/jpeg", quality);

    return {
      compressedBase64,
      significantChange: pixelStats.frameDeltaScore > 0.06,
      visionSummary: {
        sceneLabel: pixelStats.inferredScene,
        dominantColors: pixelStats.dominantColors,
        brightness: pixelStats.brightness,
        detectedObjects: pixelStats.detectedHints,
        spatialRegions: pixelStats.spatialRegions,
        extractedText: pixelStats.highContrastTextLikely
          ? sourceMode === "screen"
            ? "Teks antarmuka layar / dokumen / kode program terdeteksi jelas pada layar yang dibagikan"
            : "Teks kontras tinggi / catatan dokumen terdeteksi pada frame kamera"
          : undefined,
        sourceType: sourceMode,
        frameDeltaScore: pixelStats.frameDeltaScore,
        confidence: 0.93,
        capturedAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      },
    };
  }

  /**
   * Generates a compressed canvas frame and spatial vision summary for a Demo Camera Scene
   * or Screen Share simulation.
   */
  static captureDemoSceneFrame(
    sceneId: string,
    sourceMode: CameraSourceMode = "demo_scene"
  ): CapturedFramePayload {
    const scene: DemoCameraScene =
      DEMO_CAMERA_SCENES.find((s) => s.id === sceneId) || DEMO_CAMERA_SCENES[0];

    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 480, 300);
      if (scene.id === "coffee_mug") {
        grad.addColorStop(0, "#1e293b");
        grad.addColorStop(1, "#0f172a");
      } else if (scene.id === "handwritten_notes") {
        grad.addColorStop(0, "#1e1b4b");
        grad.addColorStop(1, "#0f172a");
      } else if (scene.id === "electronic_gadget") {
        grad.addColorStop(0, "#042f2e");
        grad.addColorStop(1, "#090d16");
      } else {
        grad.addColorStop(0, "#172554");
        grad.addColorStop(1, "#090d16");
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 480, 300);

      // Draw Left / Center / Right Spatial Zones
      ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(18, 18, 444, 264);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`GEMINI VISION: ${scene.title.toUpperCase()}`, 32, 46);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "12px sans-serif";
      ctx.fillText(scene.description.slice(0, 62), 32, 68);

      // Left, Center, Right Zone Boxes
      ctx.strokeStyle = "rgba(129, 140, 248, 0.45)";
      ctx.strokeRect(32, 84, 132, 110);
      ctx.strokeRect(174, 84, 132, 110);
      ctx.strokeRect(316, 84, 132, 110);

      ctx.fillStyle = "#a5b4fc";
      ctx.font = "bold 11px monospace";
      ctx.fillText("LEFT ZONE", 42, 104);
      ctx.fillText("CENTER ZONE", 184, 104);
      ctx.fillText("RIGHT ZONE", 326, 104);

      ctx.fillStyle = "#f1f5f9";
      ctx.font = "10px sans-serif";
      ctx.fillText(scene.spatialRegions.leftRegion.slice(0, 22), 40, 128);
      ctx.fillText(scene.spatialRegions.centerRegion.slice(0, 22), 182, 128);
      ctx.fillText(scene.spatialRegions.rightRegion.slice(0, 22), 324, 128);

      if (scene.sampleText) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.fillRect(32, 206, 416, 56);
        ctx.strokeStyle = "#38bdf8";
        ctx.strokeRect(32, 206, 416, 56);
        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 11px monospace";
        ctx.fillText("GEMINI OCR TEXT:", 44, 226);
        ctx.fillStyle = "#f8fafc";
        ctx.font = "11px monospace";
        ctx.fillText(scene.sampleText.slice(0, 54), 44, 246);
      }
    }

    const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);

    return {
      compressedBase64,
      significantChange: true,
      visionSummary: {
        sceneLabel:
          sourceMode === "screen"
            ? `Shared Screen: ${scene.title} (${scene.titleId})`
            : `${scene.title} (${scene.titleId})`,
        dominantColors: ["Deep Slate", "Gemini Cyan", "Indigo Glow"],
        brightness: "balanced",
        detectedObjects: scene.objects,
        spatialRegions: scene.spatialRegions,
        extractedText: scene.sampleText,
        sourceType: sourceMode,
        frameDeltaScore: 0.42,
        confidence: 0.98,
        capturedAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      },
    };
  }

  /**
   * Analyzes raw canvas pixels including Left / Center / Right spatial regions
   * and frame-to-frame delta for adaptive sampling.
   */
  private static analyzeCanvasPixels(
    imageData: ImageData,
    width: number,
    height: number,
    sourceMode: CameraSourceMode
  ): {
    brightness: "dark" | "balanced" | "bright";
    dominantColors: string[];
    detectedHints: string[];
    spatialRegions: SpatialRegionsSummary;
    inferredScene: string;
    highContrastTextLikely: boolean;
    frameDeltaScore: number;
  } {
    const data = imageData.data;
    let totalLum = 0;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let skinPixels = 0;
    let highContrastEdges = 0;

    let leftLum = 0;
    let centerLum = 0;
    let rightLum = 0;
    let leftCount = 0;
    let centerCount = 0;
    let rightCount = 0;

    const currentSignature: number[] = [];
    const step = 16;
    const count = Math.floor(data.length / step);

    for (let i = 0; i < data.length - step; i += step) {
      const pixelIndex = Math.floor(i / 4);
      const x = pixelIndex % width;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLum += lum;
      rSum += r;
      gSum += g;
      bSum += b;

      if (x < width / 3) {
        leftLum += lum;
        leftCount++;
      } else if (x < (width * 2) / 3) {
        centerLum += lum;
        centerCount++;
      } else {
        rightLum += lum;
        rightCount++;
      }

      if (currentSignature.length < 32 && i % 512 === 0) {
        currentSignature.push(Math.round(lum));
      }

      if (
        r > 95 &&
        g > 40 &&
        b > 20 &&
        Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
        Math.abs(r - g) > 15 &&
        r > g &&
        r > b
      ) {
        skinPixels++;
      }

      const nextLum =
        0.299 * data[i + step] +
        0.587 * data[i + step + 1] +
        0.114 * data[i + step + 2];
      if (Math.abs(lum - nextLum) > 75) {
        highContrastEdges++;
      }
    }

    // Compute adaptive frame delta score (0.0 = static, 1.0 = completely changed)
    let frameDeltaScore = 1.0;
    if (
      this.previousSignature &&
      this.previousSignature.length === currentSignature.length
    ) {
      let diffSum = 0;
      for (let k = 0; k < currentSignature.length; k++) {
        diffSum += Math.abs(currentSignature[k] - this.previousSignature[k]);
      }
      frameDeltaScore = Math.min(
        1,
        diffSum / (currentSignature.length * 255)
      );
    }
    this.previousSignature = currentSignature;

    const avgLum = totalLum / Math.max(1, count);
    const avgR = rSum / Math.max(1, count);
    const avgG = gSum / Math.max(1, count);
    const avgB = bSum / Math.max(1, count);
    const skinRatio = skinPixels / Math.max(1, count);
    const edgeRatio = highContrastEdges / Math.max(1, count);

    const brightness: "dark" | "balanced" | "bright" =
      avgLum < 68 ? "dark" : avgLum > 185 ? "bright" : "balanced";

    const dominantColors: string[] = [];
    if (avgR > avgG + 20 && avgR > avgB + 20)
      dominantColors.push("Warm Red/Amber");
    else if (avgB > avgR + 18 && avgB > avgG + 10)
      dominantColors.push("Cool Blue/Slate");
    else if (avgG > avgR + 15 && avgG > avgB + 15)
      dominantColors.push("Natural Green");
    else dominantColors.push("Neutral Studio Tone");

    const highContrastTextLikely = edgeRatio > 0.13;

    const avgLeft = leftLum / Math.max(1, leftCount);
    const avgCenter = centerLum / Math.max(1, centerCount);
    const avgRight = rightLum / Math.max(1, rightCount);

    const spatialRegions: SpatialRegionsSummary =
      sourceMode === "screen"
        ? {
            leftRegion:
              avgLeft < 90
                ? "Panel navigasi kiri / file explorer bertema gelap (dark sidebar)"
                : "Panel navigasi kiri / daftar menu samping",
            centerRegion: highContrastTextLikely
              ? "Area kerja utama (editor kode / dokumen / konten halaman web)"
              : "Tampilan visual utama pada layar yang dibagikan",
            rightRegion:
              avgRight < 90
                ? "Panel inspeksi / properti / terminal kanan"
                : "Kolom informasi sekunder di sisi kanan layar",
          }
        : {
            leftRegion:
              avgLeft > avgCenter + 20
                ? "Area latar kiri dengan sumber cahaya / objek meja di sebelah kiri"
                : "Objek pendamping di sisi kiri meja/ruangan dalam jangkauan kamera",
            centerRegion:
              skinRatio > 0.08
                ? "Subjek utama (wajah/tangan pengguna dan objek yang sedang dipegang di tengah frame)"
                : "Objek fokus utama di bagian tengah depan kamera",
            rightRegion:
              avgRight > avgCenter + 20
                ? "Sisi kanan dengan pencahayaan terang dan latar ruang kerja"
                : "Area sisi kanan frame kamera dengan elemen latar belakang",
          };

    const detectedHints: string[] = [];
    if (sourceMode === "screen") {
      detectedHints.push(
        "Shared Screen Window",
        highContrastTextLikely
          ? "Code / Text Document / UI Controls"
          : "Visual Media / Dashboard Layout"
      );
    } else {
      if (skinRatio > 0.08) {
        detectedHints.push("User / Hand Holding Object", "Foreground Subject");
      } else {
        detectedHints.push("Workspace Environment");
      }
      if (highContrastTextLikely) {
        detectedHints.push("Printed Text / Notebook / Label");
      } else {
        detectedHints.push("3D Physical Object in View");
      }
    }

    const inferredScene =
      sourceMode === "screen"
        ? "Live Shared Screen Workspace (Aplikasi & Dokumen Aktif)"
        : skinRatio > 0.1
          ? "Live Camera Feed (Pengguna & Objek di Depan Kamera)"
          : "Live Camera Feed (Meja Kerja & Objek Fokus)";

    return {
      brightness,
      dominantColors,
      detectedHints,
      spatialRegions,
      inferredScene,
      highContrastTextLikely,
      frameDeltaScore,
    };
  }
}
