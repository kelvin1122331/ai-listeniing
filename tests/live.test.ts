import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_COMPANION_CONFIG } from "@/constants/companionPresets";
import { GeminiProvider } from "@/services/ai/GeminiProvider";
const server = vi.hoisted(() => ({ key: "private-master-key" }));
vi.mock("@/lib/serverConfigStore", () => ({ ServerConfigStore: {
  getPublicCompanionConfig: () => ({ systemSettings: { enableVoice: true }, voiceSettings: { voiceEnabled: true } }),
  getDecryptedProviderConfig: () => ({ apiKey: server.key, provider: "gemini", realtimeModel: "test-live" }),
} }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: () => ({ allowed: true }) }));
import { POST } from "@/app/api/gemini/session/route";
class FakeSocket {
  static OPEN = 1; static CLOSING = 2; static last: FakeSocket;
  readyState = 0; onopen: (() => void) | null = null;
  onclose: (() => void) | null = null; onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => Promise<void>) | null = null;
  sent: unknown[] = [];
  constructor(public url: string) { FakeSocket.last = this; }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  open() { this.readyState = 1; this.onopen?.(); }
  close() { this.readyState = 3; this.onclose?.(); }
  async message(data: unknown) { await this.onmessage?.({ data: JSON.stringify(data) }); }
}
const callbacks = () => ({ onStatusChange: vi.fn(), onTranscriptUpdate: vi.fn(), onAudioChunk: vi.fn(), onAvatarStateChange: vi.fn(), onInterrupted: vi.fn(), onError: vi.fn() });
beforeEach(() => { vi.stubGlobal("WebSocket", FakeSocket); server.key = "private-master-key"; });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("ephemeral session", () => {
  it("returns a one-use token without exposing the master key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ name: "auth_tokens/temporary" })));
    const res = await POST(new NextRequest("http://localhost/api/gemini/session", { method: "POST" }));
    const data = await res.json();
    expect(JSON.stringify(data)).not.toContain(server.key);
    expect(data.wsUrl).toContain("access_token=auth_tokens%2Ftemporary");
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.uses).toBe(1); expect(body.liveConnectConstraints.model).toBe("models/test-live");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
  it("does not claim live availability when token creation fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 403 })));
    expect((await (await POST(new NextRequest("http://localhost/api/gemini/session", { method: "POST" }))).json()).liveAvailable).toBe(false);
  });
});
describe("Gemini Live wire protocol", () => {
  async function start() {
    FakeSocket.last = undefined as unknown as FakeSocket;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ liveAvailable: true, wsUrl: "wss://test", liveModel: "test-live" })));
    const provider = new GeminiProvider(), cb = callbacks();
    const result = provider.connectRealtimeSession(DEFAULT_COMPANION_CONFIG, cb);
    await vi.waitFor(() => expect(FakeSocket.last).toBeDefined());
    return { provider, cb, result, ws: FakeSocket.last };
  }
  it("waits for setupComplete, sends PCM/video, and assembles final transcripts", async () => {
    const { provider, cb, result, ws } = await start();
    ws.open(); expect(cb.onStatusChange).not.toHaveBeenCalledWith("connected");
    provider.sendRealtimeAudioChunk("AAAA"); expect(ws.sent).toHaveLength(1);
    await ws.message({ setupComplete: {} }); expect(await result).toBe(true);
    provider.sendRealtimeAudioChunk("AAAA"); provider.sendRealtimeVisionFrame("data:image/jpeg;base64,YWJj", "webcam");
    expect(ws.sent[1]).toEqual({ realtimeInput: { audio: { data: "AAAA", mimeType: "audio/pcm;rate=16000" } } });
    expect(ws.sent[2]).toEqual({ realtimeInput: { video: { data: "YWJj", mimeType: "image/jpeg" } } });
    await ws.message({ serverContent: { inputTranscription: { text: "Hai" }, outputTranscription: { text: "Halo " } } });
    await ws.message({ serverContent: { outputTranscription: { text: "kamu." }, turnComplete: true } });
    expect(cb.onTranscriptUpdate).toHaveBeenCalledWith("Halo kamu.", true, "assistant");
    expect(cb.onTranscriptUpdate).toHaveBeenCalledWith("Hai", true, "user"); provider.disconnectRealtimeSession();
  });
  it("settles early close and explicit cancellation without hanging or reconnecting", async () => {
    const first = await start(); first.ws.close(); expect(await first.result).toBe(false);
    FakeSocket.last = undefined as unknown as FakeSocket;
    const second = await start(); second.provider.disconnectRealtimeSession(); expect(await second.result).toBe(false);
    expect(second.cb.onStatusChange).toHaveBeenLastCalledWith("disconnected");
  });
});
