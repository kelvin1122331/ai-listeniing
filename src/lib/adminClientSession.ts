"use client";

/**
 * In-memory holder for the server-issued signed HMAC admin session token
 * and initial dashboard state.
 * Ensures Admin Panel works 100% reliably inside reverse-proxied cross-origin preview iframes
 * where third-party cookies or Authorization headers may be stripped by the proxy.
 */
let inMemoryAdminToken: string | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedAdminState: any = null;

export function setAdminSessionToken(token: string | null): void {
  inMemoryAdminToken = token;
  if (typeof window !== "undefined") {
    try {
      if (token) {
        window.sessionStorage.setItem("aura_admin_hmac_token", token);
      } else {
        window.sessionStorage.removeItem("aura_admin_hmac_token");
        cachedAdminState = null;
      }
    } catch {
      // Ignore storage restrictions in strict iframe modes
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setCachedAdminState(state: any): void {
  cachedAdminState = state;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCachedAdminState(): any {
  return cachedAdminState;
}

export function getAdminSessionToken(): string | null {
  if (inMemoryAdminToken) return inMemoryAdminToken;
  if (typeof window !== "undefined") {
    try {
      const stored = window.sessionStorage.getItem("aura_admin_hmac_token");
      if (stored) {
        inMemoryAdminToken = stored;
        return stored;
      }
    } catch {
      // Ignore
    }
  }
  return null;
}

/**
 * Multi-transport fetch wrapper for /api/admin/* endpoints.
 * Attaches X-Admin-Token header, _adminToken query param, Authorization Bearer header, and cookies.
 */
export async function adminFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = getAdminSessionToken();
  const headers = new Headers(init.headers || {});
  let url = input;

  if (token) {
    headers.set("X-Admin-Token", token);
    headers.set("Authorization", `Bearer ${token}`);
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}_adminToken=${encodeURIComponent(token)}`;
  }

  return fetch(url, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
}
