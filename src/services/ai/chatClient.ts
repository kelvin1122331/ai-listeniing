import { AIProviderRequest, AIProviderResponse } from "./AIProvider";

export async function sendChatRequest(request: AIProviderRequest): Promise<AIProviderResponse> {
  const started = performance.now();
  const response = await fetch("/api/chat", {
    method: "POST", cache: "no-store",
    signal: request.signal ? AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]) : AbortSignal.timeout(55_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: request.requestId, message: request.message,
      recentHistory: request.recentHistory.filter(h => h.role !== "system"),
      conversationSummary: request.conversationSummary,
      config: { ...request.config, customAvatarUrl: null },
      longTermMemory: request.config.memoryEnabled ? request.longTermMemory : [],
      cameraActive: request.cameraActive, cameraSourceMode: request.cameraSourceMode,
      imageSnapshot: request.cameraActive ? request.imageSnapshot : undefined,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Layanan AI tidak dapat dihubungi. Coba lagi.");
  if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("Respons AI kosong. Coba lagi.");
  return { reply: data.reply, expression: data.expression || "speaking", detectedLanguage: data.detectedLanguage || "id", providerName: data.provider, latencyMs: Math.round(performance.now() - started) };
}
