export type ConversationState =
  | "IDLE"
  | "LISTENING"
  | "PROCESSING"
  | "SPEAKING"
  | "WATCHING"
  | "INTERRUPTED";

export type AvatarExpression =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "watching"
  | "interrupted"
  | "happy"
  | "confused"
  | "surprised"
  | "neutral";

export type VisemeShape = "A" | "E" | "I" | "O" | "U" | "M" | "F" | "S" | "rest";

export type PersonalityPreset =
  | "friendly"
  | "witty"
  | "empathetic"
  | "mentor"
  | "tutor"
  | "assistant"
  | "gaming";

export type SpeakingStyle =
  | "casual"
  | "warm"
  | "direct"
  | "playful"
  | "analytical";

export type PreferredLanguage = "auto" | "id" | "en";

export type ResponseLength = "concise" | "balanced" | "detailed";

export type AvatarCharacterId = "aura" | "luna" | "kai" | "nova" | "custom";

export type CompanionMode =
  | "companion"
  | "tutor"
  | "assistant"
  | "gaming"
  | "language_tutor";

export type GeminiLiveConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "fallback";

export interface AvatarPreset {
  id: AvatarCharacterId;
  name: string;
  roleTitle: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  skinTone: string;
  skinShadow: string;
  hairColor: string;
  eyeColor: string;
  lipColor: string;
  defaultVoiceGender: "female" | "male";
  defaultPitch: number;
  defaultRate: number;
  hairStyle: "cyber_bob" | "flowing_long" | "neo_crop" | "synth_waves";
}

export interface CompanionConfig {
  aiName: string;
  personality: PersonalityPreset;
  speakingStyle: SpeakingStyle;
  preferredLanguage: PreferredLanguage;
  voiceURI: string;
  voicePitch: number;
  voiceRate: number;
  speakerVolume: number;
  avatarId: AvatarCharacterId;
  customAvatarUrl: string | null;
  companionMode: CompanionMode;
  responseLength: ResponseLength;
  humorLevel: number; // 0 to 100
  memoryEnabled: boolean;
  theme: "dark" | "light";
  autoSpeak: boolean;
  bargeInEnabled: boolean;
  cameraSampleIntervalSec: number;
  adaptiveSampling: boolean;
  geminiModel: string;
  useGeminiLiveVoice: boolean;
  selectedMicrophoneId: string;
  selectedCameraId: string;
}

export interface SpatialRegionsSummary {
  leftRegion: string;
  centerRegion: string;
  rightRegion: string;
}

export interface VisionAnalysisSummary {
  sceneLabel: string;
  dominantColors: string[];
  brightness: "dark" | "balanced" | "bright";
  detectedObjects: string[];
  spatialRegions?: SpatialRegionsSummary;
  extractedText?: string;
  sourceType?: "webcam" | "screen" | "demo_scene";
  frameDeltaScore?: number; // 0.0 to 1.0 indicating how much frame changed since last sample
  confidence: number;
  capturedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  expression?: AvatarExpression;
  source?: "text" | "voice" | "vision" | "screen";
  imageSnapshot?: string; // Compressed base64 thumbnail for current turn context
  visionAnalysis?: VisionAnalysisSummary;
}

export interface LongTermMemoryItem {
  id: string;
  category: "identity" | "preference" | "interest" | "goal" | "fact";
  content: string;
  createdAt: string;
}

export interface UserProfile {
  name: string;
  bio: string;
  role: string;
  preferredGreeting: string;
  avatarInitials: string;
}

export type CameraSourceMode = "webcam" | "screen" | "demo_scene";

export interface DemoCameraScene {
  id: string;
  title: string;
  titleId: string;
  description: string;
  objects: string[];
  spatialRegions: SpatialRegionsSummary;
  sampleText?: string;
  suggestedQuestionId: string;
  suggestedQuestionEn: string;
}
