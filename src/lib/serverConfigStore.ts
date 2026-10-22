import crypto from "crypto";
import fs from "fs";
import path from "path";

export type AIProviderType = "gemini" | "openai" | "custom";

export interface ProviderEncryptedConfigRow {
  id: string;
  provider: AIProviderType;
  api_key_encrypted: string;
  text_model: string;
  realtime_model: string;
  vision_model: string;
  voice_model: string;
  transcription_model: string;
  speech_model: string;
  base_url: string;
  updated_at: string;
}

export interface ProviderPublicConfigView {
  id: string;
  provider: AIProviderType;
  hasApiKey: boolean;
  maskedApiKey: string;
  text_model: string;
  realtime_model: string;
  vision_model: string;
  voice_model: string;
  transcription_model: string;
  speech_model: string;
  base_url: string;
  updated_at: string;
}

export interface AdminVoiceSettings {
  voiceEnabled: boolean;
  defaultVoice: string;
  realtimeVoiceModel: string;
  audioQuality: "standard" | "high" | "ultra_low_latency";
  interruptibleVoice: boolean;
  noiseSuppression: boolean;
}

export interface AdminVisionSettings {
  cameraVisionEnabled: boolean;
  liveVisionEnabled: boolean;
  presetMode: "low_usage" | "balanced" | "high_responsiveness";
  frameSamplingIntervalSec: number;
  imageQuality: number; // 0.3 to 1.0
  imageCompression: boolean;
}

export interface AdminSystemSettings {
  maintenanceMode: boolean;
  enableRegistration: boolean;
  enableMemory: boolean;
  enableCamera: boolean;
  enableVoice: boolean;
  enableScreenSharing: boolean;
  enableWakeWord: boolean;
}

export interface UsageLogEntry {
  id: string;
  timestamp: string;
  provider: AIProviderType;
  model: string;
  type: "text" | "voice" | "vision";
  latencyMs: number;
  status: "success" | "error";
}

export interface ServerUsageStats {
  totalRequests: number;
  textRequests: number;
  voiceSessions: number;
  visionRequests: number;
  errors: number;
  totalLatencyMs: number;
  averageLatencyMs: number;
  recentLogs: UsageLogEntry[];
}

interface PersistedServerStore {
  activeProvider: AIProviderType;
  ai_configuration: Record<AIProviderType, ProviderEncryptedConfigRow>;
  voiceSettings: AdminVoiceSettings;
  visionSettings: AdminVisionSettings;
  systemSettings: AdminSystemSettings;
  usageStats: ServerUsageStats;
}

const STORAGE_DIR = path.join(process.cwd(), ".data");
const STORAGE_FILE = path.join(STORAGE_DIR, "ai_configuration.enc.json");

/**
 * Derives a 32-byte AES-256 key from server environment secret.
 */
function getEncryptionKey(): Buffer {
  const rawSecret =
    process.env.CONFIG_ENCRYPTION_KEY ||
    process.env.ADMIN_SESSION_SECRET ||
    "aura_aes256_gcm_master_key_32bytes!";
  return crypto.createHash("sha256").update(rawSecret).digest();
}

/**
 * Encrypts a plaintext API key using AES-256-GCM before storing on disk/database.
 */
export function encryptSecret(plaintext: string): string {
  const clean = plaintext.trim();
  if (!clean) return "";
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(clean, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an AES-256-GCM encrypted API key on the server.
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload || !encryptedPayload.includes(":")) return "";
  try {
    const [ivHex, tagHex, dataHex] = encryptedPayload.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");
    const encrypted = Buffer.from(dataHex, "hex");
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

/**
 * Masks an API key so the full secret is NEVER sent back to the frontend.
 * Example: AIzaSy**************8Hx
 */
export function maskApiKey(plaintext: string): string {
  const clean = plaintext.trim();
  if (!clean) return "";
  if (clean.length <= 9) {
    return `${clean.slice(0, 2)}********${clean.slice(-1)}`;
  }
  const prefix = clean.slice(0, 6);
  const suffix = clean.slice(-3);
  return `${prefix}**************${suffix}`;
}

function createInitialStore(): PersistedServerStore {
  const now = new Date().toISOString();
  const envGeminiKey = process.env.GEMINI_API_KEY?.trim() || "";
  const envOpenAiKey = process.env.OPENAI_API_KEY?.trim() || "";
  const envCustomKey = process.env.CUSTOM_API_KEY?.trim() || "";

  return {
    activeProvider: "gemini",
    ai_configuration: {
      gemini: {
        id: "cfg_gemini_01",
        provider: "gemini",
        api_key_encrypted: envGeminiKey ? encryptSecret(envGeminiKey) : "",
        text_model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
        realtime_model:
          process.env.GEMINI_LIVE_MODEL || "models/gemini-2.0-flash-exp",
        vision_model: "gemini-2.0-flash",
        voice_model: "Aoede (Gemini Live)",
        transcription_model: "gemini-2.0-flash",
        speech_model: "gemini-2.0-flash-exp",
        base_url: "https://generativelanguage.googleapis.com/v1beta",
        updated_at: now,
      },
      openai: {
        id: "cfg_openai_01",
        provider: "openai",
        api_key_encrypted: envOpenAiKey ? encryptSecret(envOpenAiKey) : "",
        text_model: "gpt-4o-mini",
        realtime_model: "gpt-4o-realtime-preview",
        vision_model: "gpt-4o-mini",
        voice_model: "alloy",
        transcription_model: "whisper-1",
        speech_model: "tts-1",
        base_url: "https://api.openai.com/v1",
        updated_at: now,
      },
      custom: {
        id: "cfg_custom_01",
        provider: "custom",
        api_key_encrypted: envCustomKey ? encryptSecret(envCustomKey) : "",
        text_model: "custom-multimodal-v1",
        realtime_model: "custom-realtime-v1",
        vision_model: "custom-vision-v1",
        voice_model: "custom-voice-default",
        transcription_model: "custom-stt-v1",
        speech_model: "custom-tts-v1",
        base_url:
          process.env.CUSTOM_BASE_URL || "https://api.example.com/v1",
        updated_at: now,
      },
    },
    voiceSettings: {
      voiceEnabled: true,
      defaultVoice: "Aoede",
      realtimeVoiceModel: "models/gemini-2.0-flash-exp",
      audioQuality: "ultra_low_latency",
      interruptibleVoice: true,
      noiseSuppression: true,
    },
    visionSettings: {
      cameraVisionEnabled: true,
      liveVisionEnabled: true,
      presetMode: "balanced",
      frameSamplingIntervalSec: 4,
      imageQuality: 0.72,
      imageCompression: true,
    },
    systemSettings: {
      maintenanceMode: false,
      enableRegistration: true,
      enableMemory: true,
      enableCamera: true,
      enableVoice: true,
      enableScreenSharing: true,
      enableWakeWord: false,
    },
    usageStats: {
      totalRequests: 0,
      textRequests: 0,
      voiceSessions: 0,
      visionRequests: 0,
      errors: 0,
      totalLatencyMs: 0,
      averageLatencyMs: 0,
      recentLogs: [],
    },
  };
}

// Global singleton in-memory cache backed by encrypted disk file
const globalForStore = globalThis as unknown as {
  __auraServerStore?: PersistedServerStore;
};

function loadStore(): PersistedServerStore {
  if (globalForStore.__auraServerStore) {
    return globalForStore.__auraServerStore;
  }

  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, "utf8");
      const parsed = JSON.parse(raw) as PersistedServerStore;
      globalForStore.__auraServerStore = parsed;
      return parsed;
    }
  } catch {
    // Fallback to fresh store
  }

  const initial = createInitialStore();
  globalForStore.__auraServerStore = initial;
  persistStore(initial);
  return initial;
}

function persistStore(store: PersistedServerStore): void {
  globalForStore.__auraServerStore = store;
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch {
    // Keep in-memory store if filesystem is read-only
  }
}

export class ServerConfigStore {
  /**
   * Returns masked public view of all provider configurations (never exposes full API keys).
   */
  static getAdminDashboardState() {
    const store = loadStore();

    const providersView: Record<AIProviderType, ProviderPublicConfigView> = {
      gemini: this.toPublicView(store.ai_configuration.gemini),
      openai: this.toPublicView(store.ai_configuration.openai),
      custom: this.toPublicView(store.ai_configuration.custom),
    };

    return {
      activeProvider: store.activeProvider,
      providers: providersView,
      voiceSettings: store.voiceSettings,
      visionSettings: store.visionSettings,
      systemSettings: store.systemSettings,
      usageStats: store.usageStats,
    };
  }

  /**
   * Returns safe public configuration for the main companion UI (no secrets or masked keys).
   */
  static getPublicCompanionConfig() {
    const store = loadStore();
    const activeRow = store.ai_configuration[store.activeProvider];

    return {
      activeProvider: store.activeProvider,
      models: {
        textModel: activeRow.text_model,
        realtimeModel: activeRow.realtime_model,
        visionModel: activeRow.vision_model,
        voiceModel: activeRow.voice_model,
      },
      voiceSettings: store.voiceSettings,
      visionSettings: store.visionSettings,
      systemSettings: store.systemSettings,
    };
  }

  /**
   * Server-only method: Retrieves decrypted credentials and endpoints for a provider.
   */
  static getDecryptedProviderConfig(provider?: AIProviderType): {
    provider: AIProviderType;
    apiKey: string;
    textModel: string;
    realtimeModel: string;
    visionModel: string;
    voiceModel: string;
    transcriptionModel: string;
    speechModel: string;
    baseUrl: string;
  } {
    const store = loadStore();
    const target = provider || store.activeProvider;
    const row = store.ai_configuration[target];
    let decryptedKey = decryptSecret(row.api_key_encrypted);

    // Fallback to environment variable if not overridden in store
    if (!decryptedKey) {
      if (target === "gemini") {
        decryptedKey = process.env.GEMINI_API_KEY?.trim() || "";
      } else if (target === "openai") {
        decryptedKey = process.env.OPENAI_API_KEY?.trim() || "";
      } else if (target === "custom") {
        decryptedKey = process.env.CUSTOM_API_KEY?.trim() || "";
      }
    }

    return {
      provider: target,
      apiKey: decryptedKey,
      textModel: row.text_model,
      realtimeModel: row.realtime_model,
      visionModel: row.vision_model,
      voiceModel: row.voice_model,
      transcriptionModel: row.transcription_model,
      speechModel: row.speech_model,
      baseUrl: row.base_url,
    };
  }

  /**
   * Updates active provider (`gemini`, `openai`, or `custom`).
   */
  static setActiveProvider(provider: AIProviderType) {
    const store = loadStore();
    store.activeProvider = provider;
    persistStore(store);
    return this.getAdminDashboardState();
  }

  /**
   * Saves configuration for a specific provider, encrypting the API key if a new one is provided.
   */
  static updateProviderConfig(params: {
    provider: AIProviderType;
    apiKey?: string; // Empty or omitted keeps existing key unless clearKey is true
    clearKey?: boolean;
    textModel?: string;
    realtimeModel?: string;
    visionModel?: string;
    voiceModel?: string;
    transcriptionModel?: string;
    speechModel?: string;
    baseUrl?: string;
    setAsActive?: boolean;
  }) {
    const store = loadStore();
    const row = store.ai_configuration[params.provider];

    if (params.clearKey) {
      row.api_key_encrypted = "";
    } else if (
      typeof params.apiKey === "string" &&
      params.apiKey.trim() !== "" &&
      !params.apiKey.includes("******")
    ) {
      row.api_key_encrypted = encryptSecret(params.apiKey.trim());
    }

    if (params.textModel !== undefined) row.text_model = params.textModel.trim();
    if (params.realtimeModel !== undefined)
      row.realtime_model = params.realtimeModel.trim();
    if (params.visionModel !== undefined)
      row.vision_model = params.visionModel.trim();
    if (params.voiceModel !== undefined)
      row.voice_model = params.voiceModel.trim();
    if (params.transcriptionModel !== undefined)
      row.transcription_model = params.transcriptionModel.trim();
    if (params.speechModel !== undefined)
      row.speech_model = params.speechModel.trim();
    if (params.baseUrl !== undefined) row.base_url = params.baseUrl.trim();
    row.updated_at = new Date().toISOString();

    if (params.setAsActive) {
      store.activeProvider = params.provider;
    }

    persistStore(store);
    return this.getAdminDashboardState();
  }

  /**
   * Resets a provider's configuration back to default models.
   */
  static resetProviderConfig(provider: AIProviderType) {
    const store = loadStore();
    const defaults = createInitialStore().ai_configuration[provider];
    store.ai_configuration[provider] = {
      ...defaults,
      updated_at: new Date().toISOString(),
    };
    persistStore(store);
    return this.getAdminDashboardState();
  }

  /**
   * Updates Voice, Vision, or System Settings.
   */
  static updateSettings(partial: {
    voiceSettings?: Partial<AdminVoiceSettings>;
    visionSettings?: Partial<AdminVisionSettings>;
    systemSettings?: Partial<AdminSystemSettings>;
  }) {
    const store = loadStore();
    if (partial.voiceSettings) {
      store.voiceSettings = {
        ...store.voiceSettings,
        ...partial.voiceSettings,
      };
    }
    if (partial.visionSettings) {
      store.visionSettings = {
        ...store.visionSettings,
        ...partial.visionSettings,
      };
    }
    if (partial.systemSettings) {
      store.systemSettings = {
        ...store.systemSettings,
        ...partial.systemSettings,
      };
    }
    persistStore(store);
    return this.getAdminDashboardState();
  }

  /**
   * Records API usage metrics on the server.
   */
  static recordUsage(entry: {
    provider: AIProviderType;
    model: string;
    type: "text" | "voice" | "vision";
    latencyMs: number;
    status: "success" | "error";
  }) {
    const store = loadStore();
    const stats = store.usageStats;

    stats.totalRequests += 1;
    if (entry.type === "text") stats.textRequests += 1;
    if (entry.type === "voice") stats.voiceSessions += 1;
    if (entry.type === "vision") stats.visionRequests += 1;
    if (entry.status === "error") stats.errors += 1;

    stats.totalLatencyMs += Math.max(1, entry.latencyMs);
    stats.averageLatencyMs = Math.round(
      stats.totalLatencyMs / Math.max(1, stats.totalRequests)
    );

    stats.recentLogs.unshift({
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      ...entry,
    });
    stats.recentLogs = stats.recentLogs.slice(0, 25);

    persistStore(store);
  }

  private static toPublicView(
    row: ProviderEncryptedConfigRow
  ): ProviderPublicConfigView {
    let decrypted = decryptSecret(row.api_key_encrypted);
    if (!decrypted) {
      if (row.provider === "gemini")
        decrypted = process.env.GEMINI_API_KEY?.trim() || "";
      if (row.provider === "openai")
        decrypted = process.env.OPENAI_API_KEY?.trim() || "";
      if (row.provider === "custom")
        decrypted = process.env.CUSTOM_API_KEY?.trim() || "";
    }

    return {
      id: row.id,
      provider: row.provider,
      hasApiKey: Boolean(decrypted),
      maskedApiKey: decrypted ? maskApiKey(decrypted) : "",
      text_model: row.text_model,
      realtime_model: row.realtime_model,
      vision_model: row.vision_model,
      voice_model: row.voice_model,
      transcription_model: row.transcription_model,
      speech_model: row.speech_model,
      base_url: row.base_url,
      updated_at: row.updated_at,
    };
  }
}
