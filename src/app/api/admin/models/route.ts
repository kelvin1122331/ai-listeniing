import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { ServerConfigStore, AIProviderType } from "@/lib/serverConfigStore";
import { NO_STORE } from "@/lib/http";
export async function GET(req: NextRequest) {
  if (!verifyAdminRequest(req).authenticated) return NextResponse.json({ error: "Sesi admin berakhir." }, { status: 401, headers: NO_STORE });
  const provider = req.nextUrl.searchParams.get("provider") || "gemini";
  if (!["gemini", "openai", "custom"].includes(provider)) return NextResponse.json({ error: "Penyedia tidak valid." }, { status: 400, headers: NO_STORE });
  const cfg = ServerConfigStore.getDecryptedProviderConfig(provider as AIProviderType);
  const defaults = provider === "gemini" ? ["gemini-3.8-flash", "gemini-3.6-flash"] : [cfg.textModel];
  if (provider === "gemini" && cfg.apiKey) {
    try {
      const res = await fetch(cfg.baseUrl.replace(/\/$/, "") + "/models?pageSize=1000", { headers: { "x-goog-api-key": cfg.apiKey }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const models = (data.models || []).filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent")).map((m: { name: string }) => m.name.replace(/^models\//, ""));
      return NextResponse.json({ source: "live_api", models: { textModels: models } }, { headers: NO_STORE });
    } catch { return NextResponse.json({ error: "Model gagal dimuat dari Gemini. Periksa API key dan koneksi." }, { status: 502, headers: NO_STORE }); }
  }
  return NextResponse.json({ source: "catalog", models: { textModels: defaults } }, { headers: NO_STORE });
}
