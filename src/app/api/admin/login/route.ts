import { NextRequest, NextResponse } from "next/server";
import {
  attachAdminCookie,
  checkLoginRateLimit,
  clearLoginFailures,
  createAdminSessionToken,
  recordLoginFailure,
  verifyAdminCredentials,
} from "@/lib/adminAuth";
import { sanitizeInputText } from "@/lib/rateLimit";
import { ServerConfigStore } from "@/lib/serverConfigStore";
import { NO_STORE, rejectCrossOrigin } from "@/lib/http";

export async function POST(req: NextRequest) {
  const rejected = rejectCrossOrigin(req);
  if (rejected) return rejected;
  if (!process.env.ADMIN_USERNAME || (process.env.ADMIN_PASSWORD?.length || 0) < 12 || (process.env.ADMIN_SESSION_SECRET?.length || 0) < 32) return NextResponse.json({ error: "Login admin belum dikonfigurasi. Atur ADMIN_USERNAME, ADMIN_PASSWORD (minimal 12 karakter), dan ADMIN_SESSION_SECRET (minimal 32 karakter) di server." }, { status: 503, headers: NO_STORE });
  try {
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "anonymous-admin-ip";

    const rateCheck = checkLoginRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan login gagal. Coba lagi dalam ${rateCheck.retryAfterSec} detik.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const username = sanitizeInputText(body.username, 120);
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username atau password salah." },
        { status: 401 }
      );
    }

    const isValid = verifyAdminCredentials(username, password);
    if (!isValid) {
      recordLoginFailure(clientIp);
      return NextResponse.json(
        { error: "Username atau password salah." },
        { status: 401 }
      );
    }

    clearLoginFailures(clientIp);
    const { token, expiresAt } = createAdminSessionToken(username);

    const res = NextResponse.json({
      authenticated: true,
      username,
      expiresAt,
      initialState: ServerConfigStore.getAdminDashboardState(),
    }, { headers: NO_STORE });

    attachAdminCookie(res, token, expiresAt);
    return res;
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memverifikasi login." },
      { status: 500 }
    );
  }
}
