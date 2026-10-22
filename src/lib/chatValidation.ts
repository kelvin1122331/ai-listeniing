import { z } from "zod";
import { DEFAULT_COMPANION_CONFIG } from "@/constants/companionPresets";

export const companionConfigSchema = z.object({
  aiName: z.string().trim().min(1).max(40),
  personality: z.enum(["friendly", "witty", "empathetic", "mentor", "tutor", "assistant", "gaming"]),
  speakingStyle: z.enum(["casual", "warm", "direct", "playful", "analytical"]),
  preferredLanguage: z.enum(["auto", "id", "en"]),
  voiceURI: z.string().max(500),
  voicePitch: z.number().min(0.5).max(2),
  voiceRate: z.number().min(0.5).max(2),
  speakerVolume: z.number().min(0).max(1),
  avatarId: z.enum(["aura", "luna", "kai", "nova", "custom"]),
  customAvatarUrl: z.string().max(2_000_000).regex(/^data:image\/(png|jpeg|webp);base64,/).nullable(),
  companionMode: z.enum(["companion", "tutor", "assistant", "gaming", "language_tutor"]),
  responseLength: z.enum(["concise", "balanced", "detailed"]),
  humorLevel: z.number().min(0).max(100),
  memoryEnabled: z.boolean(), theme: z.enum(["dark", "light"]),
  autoSpeak: z.boolean(), bargeInEnabled: z.boolean(),
  cameraSampleIntervalSec: z.number().min(1).max(30),
  adaptiveSampling: z.boolean(), geminiModel: z.string().max(120),
  useGeminiLiveVoice: z.boolean(),
  selectedMicrophoneId: z.string().max(500), selectedCameraId: z.string().max(500),
});

export const chatBodySchema = z.object({
  requestId: z.string().max(120).optional(),
  message: z.string().trim().min(1).max(12_000),
  recentHistory: z.array(z.object({
    role: z.enum(["user", "assistant"]), content: z.string().max(16_000),
  })).max(24).default([]),
  conversationSummary: z.string().max(4000).optional(),
  config: companionConfigSchema.partial().default({}),
  longTermMemory: z.array(z.object({ content: z.string().max(300) })).max(40).default([]),
  cameraActive: z.boolean().default(false),
  cameraSourceMode: z.enum(["webcam", "screen", "demo_scene"]).default("webcam"),
  imageSnapshot: z.string().max(3_000_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/).optional(),
});

export function restoreConfig(value: unknown) {
  const result = companionConfigSchema.safeParse({ ...DEFAULT_COMPANION_CONFIG, ...(value && typeof value === "object" ? value : {}) });
  return result.success ? result.data : DEFAULT_COMPANION_CONFIG;
}
