import {
  AvatarExpression,
  CameraSourceMode,
  ChatMessage,
  CompanionConfig,
  LongTermMemoryItem,
  VisionAnalysisSummary,
} from "@/types/companion";
import { AIProvider, RealtimeSessionCallbacks } from "./ai/AIProvider";
import { AIProviderManager, ManagedProviderId } from "./ai/AIProviderManager";
import { MemoryService } from "./MemoryService";

export interface AIChatResponsePayload {
  reply: string;
  expression: AvatarExpression;
  detectedLanguage: "id" | "en";
  provider: string;
  latencyMs: number;
  audioBase64?: string;
}

/**
 * Frontend AI Service Facade.
 * Delegates all intelligence, voice, and vision operations to AIProviderManager
 * (supporting GeminiProvider, OpenAIProvider, and CustomProvider).
 */
export class AIService {
  static getProvider(): AIProvider {
    return AIProviderManager.getActiveProvider();
  }

  static setActiveProviderById(providerId: ManagedProviderId): void {
    AIProviderManager.setActiveProvider(providerId);
  }

  static async syncProviderFromBackend() {
    return AIProviderManager.syncFromBackend();
  }

  /**
   * Sends a multimodal message (Text, Voice transcript, Camera frame, or Screen Share frame)
   * through the currently active AIProvider with summarized context optimization.
   */
  static async sendMessage(params: {
    requestId?: string;
    message: string;
    messagesHistory: ChatMessage[];
    config: CompanionConfig;
    longTermMemory: LongTermMemoryItem[];
    cameraActive: boolean;
    cameraSourceMode?: CameraSourceMode;
    imageSnapshot?: string;
    visionSummary?: VisionAnalysisSummary;
  }): Promise<AIChatResponsePayload> {
    const { recentHistory, conversationSummary } =
      MemoryService.buildOptimizedContextWithSummary(params.messagesHistory, 6);

    const provider = AIProviderManager.getActiveProvider();
    const result = await provider.sendMessage({
      requestId: params.requestId,
      message: params.message,
      recentHistory,
      conversationSummary,
      config: params.config,
      longTermMemory: params.longTermMemory,
      cameraActive: params.cameraActive,
      cameraSourceMode: params.cameraSourceMode,
      imageSnapshot: params.imageSnapshot,
      visionSummary: params.visionSummary,
    });

    return {
      reply: result.reply,
      expression: result.expression,
      detectedLanguage: result.detectedLanguage,
      provider: result.providerName,
      latencyMs: result.latencyMs,
      audioBase64: result.audioBase64,
    };
  }

  static async connectRealtimeLiveSession(
    config: CompanionConfig,
    callbacks: RealtimeSessionCallbacks
  ): Promise<boolean> {
    return AIProviderManager.getActiveProvider().connectRealtimeSession(
      config,
      callbacks
    );
  }

  static sendRealtimeAudioChunk(pcm16Base64: string): void {
    AIProviderManager.getActiveProvider().sendRealtimeAudioChunk(pcm16Base64);
  }

  static sendRealtimeVisionFrame(
    jpegBase64: string,
    sourceType: CameraSourceMode
  ): void {
    AIProviderManager.getActiveProvider().sendRealtimeVisionFrame(
      jpegBase64,
      sourceType
    );
  }

  static interruptRealtimeResponse(): void {
    AIProviderManager.getActiveProvider().interruptRealtimeResponse();
  }

  static disconnectRealtimeSession(): void {
    AIProviderManager.getActiveProvider().disconnectRealtimeSession();
  }
}
