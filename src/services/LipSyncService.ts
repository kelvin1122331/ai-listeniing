import { VisemeShape } from "@/types/companion";

export interface VisemeFrame {
  viseme: VisemeShape;
  openness: number; // 0.0 (closed) to 1.0 (wide open)
  width: number; // -0.5 (rounded/puckered) to 0.5 (wide smile/spread)
  jawDrop: number; // 0.0 to 1.0
}

export const VISEME_SHAPES: Record<VisemeShape, VisemeFrame> = {
  rest: { viseme: "rest", openness: 0.04, width: 0.0, jawDrop: 0.02 },
  A: { viseme: "A", openness: 0.88, width: 0.18, jawDrop: 0.85 },
  E: { viseme: "E", openness: 0.56, width: 0.36, jawDrop: 0.48 },
  I: { viseme: "I", openness: 0.38, width: 0.45, jawDrop: 0.32 },
  O: { viseme: "O", openness: 0.76, width: -0.35, jawDrop: 0.72 },
  U: { viseme: "U", openness: 0.44, width: -0.45, jawDrop: 0.42 },
  M: { viseme: "M", openness: 0.02, width: 0.06, jawDrop: 0.04 },
  F: { viseme: "F", openness: 0.22, width: 0.14, jawDrop: 0.18 },
  S: { viseme: "S", openness: 0.26, width: 0.32, jawDrop: 0.2 },
};

export class LipSyncService {
  /**
   * Converts a character or phoneme cluster into a target VisemeShape.
   */
  static charToViseme(char: string): VisemeShape {
    const c = char.toLowerCase();
    if (c === "a") return "A";
    if (c === "e") return "E";
    if (c === "i" || c === "y") return "I";
    if (c === "o") return "O";
    if (c === "u" || c === "w") return "U";
    if (c === "m" || c === "b" || c === "p") return "M";
    if (c === "f" || c === "v") return "F";
    if (
      c === "s" ||
      c === "z" ||
      c === "c" ||
      c === "t" ||
      c === "d" ||
      c === "k" ||
      c === "g" ||
      c === "j" ||
      c === "r" ||
      c === "l" ||
      c === "n"
    ) {
      return "S";
    }
    return "rest";
  }

  /**
   * Precomputes a timeline of viseme shapes from a text string to synchronize
   * with speech synthesis boundaries and elapsed time.
   */
  static buildVisemeTimeline(
    text: string,
    speechRate = 1.0
  ): { timeMs: number; frame: VisemeFrame }[] {
    const clean = text.replace(/[*_#`~]/g, "").trim();
    if (!clean) return [{ timeMs: 0, frame: VISEME_SHAPES.rest }];

    const timeline: { timeMs: number; frame: VisemeFrame }[] = [];
    const msPerChar = Math.max(38, Math.round(58 / speechRate));
    let elapsed = 0;

    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      if (ch === "." || ch === "!" || ch === "?") {
        timeline.push({ timeMs: elapsed, frame: VISEME_SHAPES.rest });
        elapsed += msPerChar * 4.5;
      } else if (ch === "," || ch === ";" || ch === ":") {
        timeline.push({ timeMs: elapsed, frame: VISEME_SHAPES.rest });
        elapsed += msPerChar * 2.5;
      } else if (ch === " ") {
        timeline.push({
          timeMs: elapsed,
          frame: {
            viseme: "rest",
            openness: 0.12,
            width: 0.05,
            jawDrop: 0.1,
          },
        });
        elapsed += msPerChar * 0.85;
      } else {
        const viseme = this.charToViseme(ch);
        timeline.push({
          timeMs: elapsed,
          frame: VISEME_SHAPES[viseme],
        });
        elapsed += msPerChar;
      }
    }

    timeline.push({ timeMs: elapsed, frame: VISEME_SHAPES.rest });
    return timeline;
  }

  /**
   * Audio Amplitude & Spectral Lip-Sync Fallback (Section 8):
   * When direct phoneme/viseme markers are unavailable (e.g. raw Gemini Live PCM audio stream),
   * derives natural VisemeFrame shapes directly from audio amplitude and harmonic variation.
   */
  static amplitudeToVisemeFrame(
    amplitude: number,
    spectralRatio = 0.5
  ): VisemeFrame {
    const clampedAmp = Math.max(0, Math.min(1, amplitude));
    if (clampedAmp < 0.06) {
      return VISEME_SHAPES.rest;
    }
    if (clampedAmp < 0.16) {
      return VISEME_SHAPES.M;
    }
    if (clampedAmp < 0.32) {
      return spectralRatio > 0.55 ? VISEME_SHAPES.S : VISEME_SHAPES.F;
    }
    if (clampedAmp < 0.58) {
      return spectralRatio > 0.5 ? VISEME_SHAPES.E : VISEME_SHAPES.U;
    }
    if (clampedAmp < 0.78) {
      return spectralRatio > 0.48 ? VISEME_SHAPES.O : VISEME_SHAPES.I;
    }
    return {
      viseme: "A",
      openness: Math.min(0.95, clampedAmp * 1.05),
      width: (spectralRatio - 0.5) * 0.4,
      jawDrop: Math.min(0.92, clampedAmp),
    };
  }

  /**
   * Smoothly interpolates between two VisemeFrames for natural, non-robotic mouth motion.
   */
  static interpolateFrame(
    current: VisemeFrame,
    target: VisemeFrame,
    smoothing = 0.32
  ): VisemeFrame {
    return {
      viseme: target.viseme,
      openness:
        current.openness + (target.openness - current.openness) * smoothing,
      width: current.width + (target.width - current.width) * smoothing,
      jawDrop: current.jawDrop + (target.jawDrop - current.jawDrop) * smoothing,
    };
  }
}
