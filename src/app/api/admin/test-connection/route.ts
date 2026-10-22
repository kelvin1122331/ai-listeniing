import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { ServerConfigStore } from "@/lib/serverConfigStore";
import { NO_STORE, rejectCrossOrigin, providerError } from "@/lib/http";
import { providerFormSchema } from "@/lib/providerValidation";
export async function POST(req: NextRequest) {
  const rejected = rejectCrossOrigin(req); if (rejected) return rejected;
  if (!verifyAdminRequest(req).authenticated) return NextResponse.json({ error: "Sesi admin berakhir." }, { status: 401, headers: NO_STORE });
  const started = Date.now();
  try {
    const parsed = providerFormSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Konfigurasi model atau alamat API tidak valid." }, { status: 400, headers: NO_STORE });
    const body = parsed.data; const saved = ServerConfigStore.getDecryptedProviderConfig(body.provider);
    const key = body.apiKey || saved.apiKey; const model = (body.textModel || saved.textModel).replace(/^models\//, "");
    if (!key) return NextResponse.json({ error: "API key belum diisi. Koneksi belum dapat diuji." }, { status: 400, headers: NO_STORE });
    const base = (body.baseUrl || saved.baseUrl).replace(/\/$/, "");
    const gemini = body.provider === "gemini";
    const res = await fetch(gemini ? base + "/models/" + encodeURIComponent(model) + ":generateContent" : base + "/chat/completions", {
      method: "POST", signal: AbortSignal.timeout(30_000), cache: "no-store",
      headers: { "Content-Type": "application/json", ...(gemini ? { "x-goog-api-key": key } : { Authorization: "Bearer " + key }) },
      body: JSON.stringify(gemini ? { contents: [{ role: "user", parts: [{ text: "Reply only with OK." }] }], generationConfig: { maxOutputTokens: 256 } } : { model, messages: [{ role: "user", content: "Reply only with OK." }], max_tokens: 128 }),
    });
    if (!res.ok) return NextResponse.json({ error: providerError(res.status).message }, { status: 502, headers: NO_STORE });
    const data = await res.json();
    const text = gemini ? data.candidates?.[0]?.content?.parts?.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || "").join("") : data.choices?.[0]?.message?.content;
    if (!text?.trim()) return NextResponse.json({ error: "Penyedia dapat dihubungi tetapi respons model kosong." }, { status: 502, headers: NO_STORE });
    return NextResponse.json({ success: true, message: "Koneksi berhasil. Model mengembalikan respons.", latencyMs: Date.now() - started }, { headers: NO_STORE });
  } catch { return NextResponse.json({ error: "Koneksi gagal atau melewati batas waktu. Periksa API key, model, dan alamat API." }, { status: 502, headers: NO_STORE }); }
}
