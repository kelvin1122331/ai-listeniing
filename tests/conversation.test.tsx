// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COMPANION_CONFIG, DEFAULT_USER_PROFILE } from "@/constants/companionPresets";
const service = vi.hoisted(() => ({ sendMessage: vi.fn() }));
vi.mock("@/services/AIService", () => ({ AIService: service }));
vi.mock("@/components/VoiceController/useVoiceSession", () => ({ useVoiceSession: () => ({
  isListening: false, isAiMuted: false, setIsAiMuted: vi.fn(), interimTranscript: "", visemeFrame: { viseme: "rest", openness: 0, width: 0, jawDrop: 0 },
  audioLevel: 0, micError: null, setMicError: vi.fn(), liveStatus: "disconnected", availableVoices: [],
  startListening: vi.fn(), stopListening: vi.fn(), speakText: vi.fn(), stopSpeaking: vi.fn(),
}) }));
import { MainConversationView } from "@/components/Companion/MainConversationView";
const config = { ...DEFAULT_COMPANION_CONFIG, autoSpeak: false };
function mount() {
  return render(<MainConversationView config={config} onUpdateConfig={vi.fn()} userProfile={DEFAULT_USER_PROFILE} onUpdateProfile={vi.fn()} onEndSession={vi.fn()} />);
}
function send(text = "Pertanyaan saya") {
  fireEvent.change(screen.getByLabelText("Pesan untuk AURA"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Kirim pesan" }));
}
beforeEach(() => {
  window.sessionStorage.clear(); window.localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ configured: true, activeProvider: "gemini", systemSettings: { enableMemory: true } })));
  service.sendMessage.mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("conversation interactions", () => {
  it("renders a real answer as formatted Markdown, preserves multiline input, and clears the composer", async () => {
    service.sendMessage.mockResolvedValue({ reply: "**Jawaban**\n\n1. Satu\n2. Dua", detectedLanguage: "id", expression: "happy" });
    mount(); send("Baris satu\nBaris dua");
    await waitFor(() => expect(screen.getByText("Jawaban").tagName).toBe("STRONG"));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect((screen.getByLabelText("Pesan untuk AURA") as HTMLTextAreaElement).value).toBe("");
    expect(service.sendMessage.mock.calls[0][0].message).toBe("Baris satu\nBaris dua");
  });
  it("retries a failed turn without duplicating the user's message", async () => {
    service.sendMessage.mockRejectedValueOnce(new Error("Kuota tercapai")).mockResolvedValueOnce({ reply: "Sekarang berhasil", expression: "speaking", detectedLanguage: "id" });
    mount(); send("Pertanyaan unik");
    await screen.findByText("Kuota tercapai");
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    await screen.findByText("Sekarang berhasil");
    expect(screen.getAllByText("Pertanyaan unik")).toHaveLength(2); // Sidebar title + one message.
    expect(service.sendMessage).toHaveBeenCalledTimes(2);
    expect(service.sendMessage.mock.calls[1][0].messagesHistory).toEqual([]);
  });
  it("ignores responses arriving after the conversation was cleared", async () => {
    let finish!: (value: unknown) => void;
    service.sendMessage.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    mount(); send("Pesan lama");
    fireEvent.click(screen.getAllByRole("button", { name: "Percakapan baru" })[0]);
    await act(async () => finish({ reply: "Jawaban lama", expression: "speaking" }));
    expect(screen.queryByText("Jawaban lama")).toBeNull();
    expect(screen.queryByText("Pesan lama")).toBeNull();
    expect(service.sendMessage.mock.calls[0][0].signal.aborted).toBe(true);
  });
  it("prevents duplicate sends and aborts an in-flight request on unmount", async () => {
    service.sendMessage.mockImplementation(() => new Promise(() => {}));
    const view = mount(); send(); fireEvent.keyDown(screen.getByLabelText("Pesan untuk AURA"), { key: "Enter" });
    expect(service.sendMessage).toHaveBeenCalledTimes(1);
    view.unmount(); expect(service.sendMessage.mock.calls[0][0].signal.aborted).toBe(true);
  });
  it("opens settings, changes tabs, and renders memory controls", async () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Buka pengaturan" }));
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
    fireEvent.click(screen.getByRole("tab", { name: "Memori" }));
    expect(screen.getByRole("checkbox", { name: /Ingat preferensiku/ })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Tutup pengaturan" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
