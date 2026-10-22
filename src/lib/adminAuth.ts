import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "aura_admin_session";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours expiration

interface FailedLoginRecord {
  failures: number;
  lockedUntil: number;
  lastAttempt: number;
}

const loginFailureStore = new Map<string, FailedLoginRecord>();

function getSessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    "aura_companion_hmac_secret_key_2026_v1"
  );
}

/**
 * Checks if a client IP is temporarily delayed/locked due to repeated failed login attempts.
 */
export function checkLoginRateLimit(clientIp: string): {
  allowed: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const record = loginFailureStore.get(clientIp);
  if (!record) return { allowed: true, retryAfterSec: 0 };

  if (record.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((record.lockedUntil - now) / 1000),
    };
  }

  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Records a failed login attempt and applies progressive temporary delay after multiple failures.
 */
export function recordLoginFailure(clientIp: string): void {
  const now = Date.now();
  const existing = loginFailureStore.get(clientIp) || {
    failures: 0,
    lockedUntil: 0,
    lastAttempt: now,
  };

  existing.failures += 1;
  existing.lastAttempt = now;

  if (existing.failures >= 5) {
    const delaySec = Math.min(30, (existing.failures - 4) * 5);
    existing.lockedUntil = now + delaySec * 1000;
  }

  loginFailureStore.set(clientIp, existing);
}

export function clearLoginFailures(clientIp: string): void {
  loginFailureStore.delete(clientIp);
}

/**
 * Timing-safe verification of Admin Username & Password on the backend.
 * Reads from ADMIN_USERNAME and ADMIN_PASSWORD environment variables.
 */
export function verifyAdminCredentials(
  usernameInput: string,
  passwordInput: string
): boolean {
  const expectedUser = (process.env.ADMIN_USERNAME || "admin").trim();
  const expectedPass = (process.env.ADMIN_PASSWORD || "kelvin5757").trim();

  const cleanUser = usernameInput.trim();
  const cleanPass = passwordInput.trim();

  const userBufA = Buffer.from(cleanUser);
  const userBufB = Buffer.from(expectedUser);
  const passBufA = Buffer.from(cleanPass);
  const passBufB = Buffer.from(expectedPass);

  const userMatch =
    userBufA.length === userBufB.length &&
    crypto.timingSafeEqual(userBufA, userBufB);
  const passMatch =
    passBufA.length === passBufB.length &&
    crypto.timingSafeEqual(passBufA, passBufB);

  return userMatch && passMatch;
}

/**
 * Creates a signed HMAC session token with expiration timestamp.
 */
export function createAdminSessionToken(username: string): {
  token: string;
  expiresAt: number;
} {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = JSON.stringify({
    sub: username,
    role: "admin",
    exp: expiresAt,
    iat: Date.now(),
  });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payloadB64)
    .digest("base64url");

  return {
    token: `${payloadB64}.${sig}`,
    expiresAt,
  };
}

/**
 * Verifies a signed HMAC admin session token.
 */
export function verifyAdminSessionToken(token: string | undefined | null): {
  valid: boolean;
  username?: string;
  expiresAt?: number;
} {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { valid: false };
  }

  try {
    const [payloadB64, sig] = token.trim().split(".");
    if (!payloadB64 || !sig) return { valid: false };

    const expectedSig = crypto
      .createHmac("sha256", getSessionSecret())
      .update(payloadB64)
      .digest("base64url");

    const sigBufA = Buffer.from(sig);
    const sigBufB = Buffer.from(expectedSig);
    if (
      sigBufA.length !== sigBufB.length ||
      !crypto.timingSafeEqual(sigBufA, sigBufB)
    ) {
      return { valid: false };
    }

    const decoded = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    );
    if (!decoded.exp || Date.now() > decoded.exp || decoded.role !== "admin") {
      return { valid: false };
    }

    return {
      valid: true,
      username: decoded.sub,
      expiresAt: decoded.exp,
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Multi-transport admin session verification:
 * Checks X-Admin-Token header, _adminToken query param, Authorization Bearer header, and httpOnly cookie.
 * Guarantees 100% compatibility across reverse proxies and cross-origin preview iframes.
 */
export function verifyAdminRequest(req: NextRequest): {
  authenticated: boolean;
  username?: string;
  expiresAt?: number;
} {
  const candidates: (string | undefined | null)[] = [
    req.headers.get("x-admin-token"),
    req.nextUrl.searchParams.get("_adminToken"),
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""),
    req.cookies.get(ADMIN_COOKIE_NAME)?.value,
  ];

  for (const candidate of candidates) {
    if (candidate) {
      const check = verifyAdminSessionToken(candidate);
      if (check.valid) {
        return {
          authenticated: true,
          username: check.username,
          expiresAt: check.expiresAt,
        };
      }
    }
  }

  return { authenticated: false };
}

/**
 * Attaches the httpOnly admin session cookie to a NextResponse.
 */
export function attachAdminCookie(
  res: NextResponse,
  token: string,
  expiresAt: number
): void {
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    expires: new Date(expiresAt),
  });
}

/**
 * Clears the httpOnly admin session cookie on logout.
 */
export function clearAdminCookie(res: NextResponse): void {
  res.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: 0,
  });
}
