import {
  AvatarExpression,
  CameraSourceMode,
  CompanionConfig,
  ConversationState,
  GeminiLiveConnectionStatus,
  LongTermMemoryItem,
  VisionAnalysisSummary,
} from "@/types/companion";

export interface AIProviderRequest {
  requestId?: string;
  message: string;
  recentHistory: { role: "user" | "assistant" | "system"; content: string }[];
  conversationSummary?: string;
  config: CompanionConfig;
  longTermMemory: LongTermMemoryItem[];
  cameraActive: boolean;
  cameraSourceMode?: CameraSourceMode;
  imageSnapshot?: string;
  visionSummary?: VisionAnalysisSummary;
}

export interface AIProviderResponse {
  reply: string;
  expression: AvatarExpression;
  detectedLanguage: "id" | "en";
  providerName: string;
  latencyMs: number;
  audioBase64?: string;
  tokenOptimizationInfo?: {
    historySummarized: boolean;
    frameIncluded: boolean;
    modelUsed: string;
  };
}

export interface RealtimeSessionCallbacks {
  onStatusChange: (status: GeminiLiveConnectionStatus) => void;
  onTranscriptUpdate: (
    text: string,
    isFinal: boolean,
    role: "user" | "assistant"
  ) => void;
  onAudioChunk: (pcm16Base64: string, amplitude: number) => void;
  onAvatarStateChange: (
    state: ConversationState,
    expression: AvatarExpression
  ) => void;
  onInterrupted: () => void;
  onError: (friendlyMessage: string) => void;
}

/**
 * Core AI Provider abstraction.
 * Allows switching or adding future AI providers without modifying UI components.
 * Active primary implementation: GeminiProvider (Google AI Studio / Gemini API & Gemini Live API).
 */
export interface AIProvider {
  readonly id: string;
  readonly displayName: string;

  /**
   * Sends a text, voice transcript, or multimodal vision/screen-share request to the AI provider.
   */
  sendMessage(request: AIProviderRequest): Promise<AIProviderResponse>;

  /**
   * Initiates a low-latency realtime bidirectional voice/vision session (e.g. Gemini Live API WebSocket).
   * Returns true if realtime WebSocket connected, or false if falling back to HTTP/WebSpeech pipeline.
   */
  connectRealtimeSession(
    config: CompanionConfig,
    callbacks: RealtimeSessionCallbacks
  ): Promise<boolean>;

  /**
   * Streams a realtime PCM16 audio chunk from the user's microphone to the live session.
   */
  sendRealtimeAudioChunk(pcm16Base64: string): void;

  /**
   * Sends a sampled & compressed JPEG frame (camera or screen share) to the active live session.
   */
  sendRealtimeVisionFrame(
    jpegBase64: string,
    sourceType: CameraSourceMode
  ): void;

  /**
   * Triggers immediate barge-in interruption when user starts speaking while AI is responding.
   */
  interruptRealtimeResponse(): void;

  /**
   * Cleanly closes the realtime session.
   */
  disconnectRealtimeSession(): void;
}
