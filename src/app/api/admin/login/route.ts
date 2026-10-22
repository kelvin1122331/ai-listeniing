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

export async function POST(req: NextRequest) {
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
      token,
      initialState: ServerConfigStore.getAdminDashboardState(),
    });

    attachAdminCookie(res, token, expiresAt);
    return res;
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memverifikasi login." },
      { status: 500 }
    );
  }
}
