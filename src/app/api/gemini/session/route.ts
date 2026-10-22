import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { ServerConfigStore } from "@/lib/serverConfigStore";
import { NO_STORE, rejectCrossOrigin } from "@/lib/http";

export async function POST(req: NextRequest) {
  const rejected = rejectCrossOrigin(req);
  if (rejected) return rejected;
  const limit = checkRateLimit("live:" + (req.headers.get("x-forwarded-for")?.split(",")[0] || "local"), 10);
  if (!limit.allowed) return NextResponse.json({ error: "Terlalu banyak permintaan sesi suara." }, { status: 429, headers: NO_STORE });
  const settings = ServerConfigStore.getPublicCompanionConfig();
  if (settings.systemSettings.maintenanceMode || !settings.systemSettings.enableVoice || !settings.voiceSettings.voiceEnabled) return NextResponse.json({ liveAvailable: false }, { headers: NO_STORE });
  const cfg = ServerConfigStore.getDecryptedProviderConfig();
  if (cfg.provider !== "gemini" || !cfg.apiKey) return NextResponse.json({ liveAvailable: false }, { headers: NO_STORE });
  try {
    const expiresAt = Date.now() + 30 * 60_000;
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
      body: JSON.stringify({ uses: 1, expireTime: new Date(expiresAt).toISOString(), newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(), liveConnectConstraints: { model: "models/" + cfg.realtimeModel.replace(/^models\//, "") } }),
    });
    if (!res.ok) return NextResponse.json({ liveAvailable: false, error: "Gemini Live belum tersedia. Input suara browser dapat digunakan." }, { headers: NO_STORE });
    const token = await res.json();
    if (typeof token.name !== "string" || !token.name) throw new Error("Missing token");
    return NextResponse.json({ liveAvailable: true, liveModel: cfg.realtimeModel, expiresAt, wsUrl: "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=" + encodeURIComponent(token.name) }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ liveAvailable: false, error: "Koneksi suara langsung gagal. Gunakan input suara browser atau chat." }, { headers: NO_STORE });
  }
}
