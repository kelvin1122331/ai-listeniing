import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminSessionToken, verifyAdminCredentials, verifyAdminSessionToken } from "@/lib/adminAuth";
import { encryptSecret, decryptSecret } from "@/lib/serverConfigStore";
afterEach(() => vi.unstubAllEnvs());
describe("server secrets", () => {
  it("has no built-in admin credentials", () => {
    vi.stubEnv("ADMIN_USERNAME", ""); vi.stubEnv("ADMIN_PASSWORD", "");
    expect(verifyAdminCredentials("admin", "anything")).toBe(false);
  });
  it("preserves password whitespace and requires configured secrets", () => {
    vi.stubEnv("ADMIN_USERNAME", "owner"); vi.stubEnv("ADMIN_PASSWORD", "  long passphrase  ");
    expect(verifyAdminCredentials("owner", "  long passphrase  ")).toBe(true);
    expect(verifyAdminCredentials("owner", "long passphrase")).toBe(false);
    vi.stubEnv("ADMIN_SESSION_SECRET", ""); expect(() => createAdminSessionToken("owner")).toThrow();
  });
  it("validates signed session tokens and rejects tampering, extra segments, and expired tokens", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "a".repeat(40));
    const { token } = createAdminSessionToken("owner");
    expect(verifyAdminSessionToken(token).valid).toBe(true);
    expect(verifyAdminSessionToken(token + ".extra").valid).toBe(false);
    expect(verifyAdminSessionToken("x" + token).valid).toBe(false);
    vi.useFakeTimers(); vi.advanceTimersByTime(13 * 60 * 60 * 1000);
    expect(verifyAdminSessionToken(token).valid).toBe(false); vi.useRealTimers();
  });
  it("encrypts keys with random nonces, authenticates ciphertext, and requires a private secret", () => {
    vi.stubEnv("CONFIG_ENCRYPTION_KEY", "private-encryption-key".repeat(3));
    const a = encryptSecret("test-api-key"), b = encryptSecret("test-api-key");
    expect(a).not.toContain("test-api-key"); expect(a).not.toBe(b); expect(decryptSecret(a)).toBe("test-api-key");
    expect(decryptSecret(a.slice(0, -4) + "ffff")).toBe("");
    vi.stubEnv("CONFIG_ENCRYPTION_KEY", ""); vi.stubEnv("ADMIN_SESSION_SECRET", "");
    expect(() => encryptSecret("key")).toThrow();
  });
});
