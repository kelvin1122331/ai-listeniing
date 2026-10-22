import { AIProvider } from "./AIProvider";
import { GeminiProvider } from "./GeminiProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { CustomProvider } from "./CustomProvider";

export type ManagedProviderId = "gemini" | "openai" | "custom";

/**
 * Central manager for AI Providers (GeminiProvider, OpenAIProvider, CustomProvider).
 * Synchronizes the active provider from the server configuration without requiring UI changes.
 */
export class AIProviderManager {
  private static providers: Record<ManagedProviderId, AIProvider> = {
    gemini: new GeminiProvider(),
    openai: new OpenAIProvider(),
    custom: new CustomProvider(),
  };

  private static activeProviderId: ManagedProviderId = "gemini";

  static getActiveProvider(): AIProvider {
    return (
      this.providers[this.activeProviderId] || this.providers.gemini
    );
  }

  static getActiveProviderId(): ManagedProviderId {
    return this.activeProviderId;
  }

  static setActiveProvider(providerId: ManagedProviderId): AIProvider {
    if (this.providers[providerId]) {
      this.activeProviderId = providerId;
    }
    return this.getActiveProvider();
  }

  /**
   * Synchronizes the active provider and public system configuration from the backend.
   */
  static async syncFromBackend(): Promise<{
    activeProvider: ManagedProviderId;
    textModel: string;
    realtimeModel: string;
  } | null> {
    try {
      const res = await fetch("/api/config/public", { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      if (
        data?.activeProvider &&
        ["gemini", "openai", "custom"].includes(data.activeProvider)
      ) {
        this.activeProviderId = data.activeProvider as ManagedProviderId;
      }
      return {
        activeProvider: this.activeProviderId,
        textModel: data?.models?.textModel || "gemini-2.0-flash",
        realtimeModel:
          data?.models?.realtimeModel || "models/gemini-2.0-flash-exp",
      };
    } catch {
      return null;
    }
  }
}
