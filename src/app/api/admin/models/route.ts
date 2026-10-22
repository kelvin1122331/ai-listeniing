import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { AIProviderType, ServerConfigStore } from "@/lib/serverConfigStore";

const CATALOG_MODELS: Record<
  AIProviderType,
  {
    textModels: string[];
    realtimeModels: string[];
    visionModels: string[];
    transcriptionModels: string[];
    speechModels: string[];
  }
> = {
  gemini: {
    textModels: [
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
    ],
    realtimeModels: [
      "models/gemini-2.0-flash-exp",
      "models/gemini-2.0-flash-live-001",
    ],
    visionModels: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
    transcriptionModels: ["gemini-2.0-flash", "gemini-1.5-flash"],
    speechModels: ["Aoede (Gemini Live)", "Puck (Gemini Live)", "Charon (Gemini Live)", "Kore (Gemini Live)"],
  },
  openai: {
    textModels: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
    realtimeModels: [
      "gpt-4o-realtime-preview",
      "gpt-4o-mini-realtime-preview",
    ],
    visionModels: ["gpt-4o-mini", "gpt-4o"],
    transcriptionModels: ["whisper-1", "gpt-4o-transcribe"],
    speechModels: ["tts-1", "tts-1-hd", "gpt-4o-mini-tts"],
  },
  custom: {
    textModels: [
      "custom-multimodal-v1",
      "llama-3.3-70b-instruct",
      "qwen-2.5-vl-72b",
    ],
    realtimeModels: ["custom-realtime-v1", "webrtc-voice-stream-v1"],
    visionModels: ["custom-vision-v1", "qwen-2.5-vl-72b"],
    transcriptionModels: ["custom-stt-v1", "faster-whisper-large-v3"],
    speechModels: ["custom-tts-v1", "kokoro-82m-voice"],
  },
};

export async function GET(req: NextRequest) {
  const session = verifyAdminRequest(req);
  if (!session.authenticated) {
    return NextResponse.json(
      { error: "Unauthorized admin request." },
      { status: 401 }
    );
  }

  const provider = (req.nextUrl.searchParams.get("provider") ||
    "gemini") as AIProviderType;
  const saved = ServerConfigStore.getDecryptedProviderConfig(provider);
  const catalog = CATALOG_MODELS[provider] || CATALOG_MODELS.gemini;

  // Attempt dynamic model listing from provider if API key is present
  if (provider === "gemini" && saved.apiKey) {
    try {
      const res = await fetch(
        `${saved.baseUrl || "https://generativelanguage.googleapis.com/v1beta"}/models?key=${encodeURIComponent(
          saved.apiKey
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models)) {
          const liveNames = data.models
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((m: any) => String(m.name || "").replace(/^models\//, ""))
            .filter((n: string) => n.startsWith("gemini-"));
          if (liveNames.length > 0) {
            return NextResponse.json({
              provider,
              source: "live_api",
              models: {
                ...catalog,
                textModels: Array.from(
                  new Set([...liveNames, ...catalog.textModels])
                ),
                visionModels: Array.from(
                  new Set([...liveNames, ...catalog.visionModels])
                ),
              },
            });
          }
        }
      }
    } catch {
      // Fallback to verified catalog
    }
  }

  return NextResponse.json({
    provider,
    source: "provider_catalog",
    models: catalog,
    refreshedAt: new Date().toISOString(),
  });
}
