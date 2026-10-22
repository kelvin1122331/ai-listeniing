// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COMPANION_CONFIG } from "@/constants/companionPresets";
const service = vi.hoisted(() => ({ connectRealtimeLiveSession: vi.fn(), disconnectRealtimeSession: vi.fn(), sendRealtimeAudioChunk: vi.fn(), interruptRealtimeResponse: vi.fn() }));
vi.mock("@/services/AIService", () => ({ AIService: service }));
import { useVoiceSession } from "@/components/VoiceController/useVoiceSession";
const stopTrack = vi.fn();
let callbacks: Parameters<typeof service.connectRealtimeLiveSession>[1];
const started: number[] = [], stopped: unknown[] = [];
class FakeContext {
  state = "running"; currentTime = 10; sampleRate = 16000; destination = {};
  audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
  resume = vi.fn().mockResolvedValue(undefined); close = vi.fn().mockResolvedValue(undefined);
  createGain() { return { gain: { value: 1 }, connect: vi.fn() }; }
  createMediaStreamSource() { return { connect: vi.fn() }; }
  createBuffer(_channels: number, samples: number, rate: number) { return { duration: samples / rate, getChannelData: () => new Float32Array(samples) }; }
  createBufferSource() { const source = { connect: vi.fn(), start: (time: number) => started.push(time), stop: () => stopped.push(source), onended: null, buffer: null }; return source; }
}
class FakeWorklet { static last: FakeWorklet; port = { onmessage: null as null | ((event: { data: unknown }) => void) }; connect = vi.fn(); disconnect = vi.fn(); constructor() { FakeWorklet.last = this; } }
beforeEach(() => {
  vi.clearAllMocks(); started.length = 0; stopped.length = 0;
  vi.stubGlobal("AudioContext", FakeContext); vi.stubGlobal("AudioWorkletNode", FakeWorklet);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) } });
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel: vi.fn(), getVoices: () => [], addEventListener: vi.fn(), removeEventListener: vi.fn() } });
  service.connectRealtimeLiveSession.mockImplementation(async (_config, cb) => { callbacks = cb; cb.onStatusChange("connected"); return true; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const options = () => ({ config: DEFAULT_COMPANION_CONFIG, conversationState: "IDLE" as const, setConversationState: vi.fn(), setExpression: vi.fn(), onUserSpeechFinal: vi.fn() });
describe("microphone and playback lifecycle", () => {
  it("does not request a microphone or Live token merely by opening a conversation", () => {
    renderHook(() => useVoiceSession(options()));
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(service.connectRealtimeLiveSession).not.toHaveBeenCalled();
  });
  it("sends captured PCM, queues output chunks, and stops all audio and tracks", async () => {
    const { result, unmount } = renderHook(() => useVoiceSession(options()));
    await act(async () => { await result.current.startListening(); });
    expect(result.current.isListening).toBe(true);
    act(() => FakeWorklet.last.port.onmessage?.({ data: { buffer: new Int16Array([1000, -1000]).buffer, level: 0.2 } }));
    expect(service.sendRealtimeAudioChunk).toHaveBeenCalledWith(expect.any(String));
    const audio = btoa(String.fromCharCode(...new Uint8Array(new Int16Array(2400).buffer)));
    act(() => { callbacks.onAudioChunk(audio, 0.5); callbacks.onAudioChunk(audio, 0.5); });
    expect(started[1]).toBeCloseTo(started[0] + 0.1);
    act(() => result.current.stopListening());
    expect(stopped).toHaveLength(2); expect(stopTrack).toHaveBeenCalled(); expect(result.current.isListening).toBe(false); unmount();
  });
  it("releases a microphone granted after capture was cancelled", async () => {
    let grant!: (stream: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(() => new Promise(resolve => { grant = resolve; }));
    const { result } = renderHook(() => useVoiceSession(options()));
    let promise!: Promise<void>;
    act(() => { promise = result.current.startListening(); });
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    act(() => result.current.stopListening());
    await act(async () => { grant({ getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream); await promise; });
    expect(stopTrack).toHaveBeenCalled(); expect(service.connectRealtimeLiveSession).not.toHaveBeenCalled(); expect(result.current.isListening).toBe(false);
  });
  it("does not pretend to listen when both voice options are unavailable", async () => {
    service.connectRealtimeLiveSession.mockResolvedValue(false);
    const { result } = renderHook(() => useVoiceSession(options()));
    await act(async () => { await result.current.startListening(); });
    expect(result.current.isListening).toBe(false); expect(result.current.micError).toContain("tidak didukung"); expect(stopTrack).toHaveBeenCalled();
  });
});
