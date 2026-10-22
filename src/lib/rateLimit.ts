interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Server-side token bucket / sliding window rate limiter for API routes.
 */
export function checkRateLimit(
  identifier: string,
  maxRequests = Number(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || 60),
  windowMs = 60_000
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  maxRequests = Number.isFinite(maxRequests) && maxRequests > 0 ? Math.floor(maxRequests) : 60;
  if (rateLimitStore.size > 10_000) {
    for (const [key, value] of rateLimitStore) if (value.resetAt <= now) rateLimitStore.delete(key);
    if (rateLimitStore.size > 10_000) rateLimitStore.delete(rateLimitStore.keys().next().value!);
  }
  const existing = rateLimitStore.get(identifier);

  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetInMs: windowMs,
    };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: Math.max(0, existing.resetAt - now),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - existing.count,
    resetInMs: Math.max(0, existing.resetAt - now),
  };
}

/**
 * Validates and sanitizes incoming text payloads to prevent injection or oversized inputs.
 */
export function sanitizeInputText(input: unknown, maxLength = 4000): string {
  if (typeof input !== "string") return "";
  return input
    // Remove only non-printing controls; preserve newlines, tabs, and user text.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}
