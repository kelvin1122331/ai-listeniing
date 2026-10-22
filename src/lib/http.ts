import { NextRequest, NextResponse } from "next/server";
export const NO_STORE = { "Cache-Control": "no-store" };

export function rejectCrossOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host") || req.nextUrl.host;
  const scheme = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
  const expected = process.env.APP_ORIGIN || scheme + "://" + host;
  if (origin && origin !== expected) {
    return NextResponse.json({ error: "Asal permintaan tidak diizinkan." }, { status: 403, headers: NO_STORE });
  }
  return null;
}
export class ProviderError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function providerError(status: number): ProviderError {
  if (status === 401 || status === 403) return new ProviderError(502, "API key ditolak penyedia AI. Periksa key dan izin proyek di pengaturan admin.");
  if (status === 404) return new ProviderError(502, "Model AI tidak tersedia. Pilih model yang tersedia untuk API key ini di pengaturan admin.");
  if (status === 429) return new ProviderError(429, "Kuota atau batas permintaan AI tercapai. Tunggu sebentar atau periksa kuota proyek.");
  if (status === 503) return new ProviderError(503, "Model AI sedang padat atau sementara tidak tersedia. Tunggu sebentar lalu coba lagi, atau pilih model lain di pengaturan admin.");
  return new ProviderError(502, "Penyedia AI sedang bermasalah. Silakan coba lagi.");
}
