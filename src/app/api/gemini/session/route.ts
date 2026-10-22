import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { ServerConfigStore } from "@/lib/serverConfigStore";

/**
 * Provides ephemeral session configuration for Gemini Live API (BidiGenerateContent)
 * reading from encrypted ServerConfigStore without hardcoding any API key in frontend source code.
 */
export async function POST(req: NextRequest) {
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous-client";
  const rateStatus = checkRateLimit(clientIp);
  if (!rateStatus.allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan sesi. Coba lagi sebentar." },
      { status: 429 }
    );
  }

  const geminiCfg = ServerConfigStore.getDecryptedProviderConfig("gemini");
  const geminiKey = geminiCfg.apiKey;
  const liveModel =
    geminiCfg.realtimeModel || "models/gemini-2.0-flash-exp";
  const standardModel = geminiCfg.textModel || "gemini-2.0-flash";

  if (!geminiKey) {
    return NextResponse.json({
      liveAvailable: false,
      mode: "gemini-server-route",
      model: standardModel,
      liveModel,
      message:
        "Using server-side Gemini multimodal route with hybrid WebSpeech/Audio lip-sync.",
    });
  }

  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(
    geminiKey
  )}`;

  return NextResponse.json({
    liveAvailable: true,
    mode: "gemini-live-bidi",
    model: standardModel,
    liveModel,
    wsUrl,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
}
