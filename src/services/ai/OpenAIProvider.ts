import { AIProvider, AIProviderRequest, RealtimeSessionCallbacks } from "./AIProvider";
import { CameraSourceMode, CompanionConfig } from "@/types/companion";
import { sendChatRequest } from "./chatClient";
export class OpenAIProvider implements AIProvider {
  readonly id = "openai";
  readonly displayName = "OpenAI";
  sendMessage(request: AIProviderRequest) { return sendChatRequest(request); }
  async connectRealtimeSession(_config: CompanionConfig, callbacks: RealtimeSessionCallbacks) { callbacks.onStatusChange("fallback"); return false; }
  sendRealtimeAudioChunk(_data: string) {}
  sendRealtimeVisionFrame(_data: string, _source: CameraSourceMode) {}
  interruptRealtimeResponse() {}
  disconnectRealtimeSession() {}
}
