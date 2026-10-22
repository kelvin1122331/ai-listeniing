import { ChatMessage, LongTermMemoryItem } from "@/types/companion";

const LONG_TERM_MEMORY_STORAGE_KEY = "aura_companion_long_term_memory_v1";
const CONVERSATION_STORAGE_KEY = "aura_companion_short_term_history_v4";

/**
 * Checks if a text snippet contains sensitive data (passwords, card numbers, keys, etc.)
 * that must never be saved to memory without consent.
 */
function containsSensitiveData(text: string): boolean {
  const sensitivePatterns = [
    /\b(?:\d[ -]*?){13,16}\b/, // Credit card / long numeric IDs
    /\bpassword\s*[:=]/i,
    /\bkata\s*sandi\s*[:=]/i,
    /\bapi[_-]?key\b/i,
    /\bsecret[_-]?key\b/i,
    /\bpin\s*[:=]\s*\d{4,8}/i,
    /\bnik\s*[:=]?\s*\d{16}\b/i,
  ];
  return sensitivePatterns.some((pattern) => pattern.test(text));
}

export class MemoryService {
  /**
   * Loads saved long-term memory facts from local storage.
   */
  static getLongTermMemories(): LongTermMemoryItem[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(LONG_TERM_MEMORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Saves long-term memory items when memory is enabled.
   */
  static saveLongTermMemories(items: LongTermMemoryItem[]): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        LONG_TERM_MEMORY_STORAGE_KEY,
        JSON.stringify(items.slice(0, 40))
      );
    } catch {
      // Ignore storage quota errors
    }
  }

  /**
   * Clears all saved long-term memories.
   */
  static clearLongTermMemory(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(LONG_TERM_MEMORY_STORAGE_KEY);
    } catch {
      // Ignore errors
    }
  }

  /**
   * Loads short-term session history.
   */
  static getShortTermHistory(): ChatMessage[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.sessionStorage.getItem(CONVERSATION_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Persists short-term conversation context for the active session (without storing camera snapshots permanently).
   */
  static saveShortTermHistory(messages: ChatMessage[]): void {
    if (typeof window === "undefined") return;
    try {
      // Strip raw base64 camera frames so camera images are NEVER stored permanently by default
      const sanitizedMessages = messages.slice(-30).map((msg) => ({
        ...msg,
        imageSnapshot: undefined,
      }));
      window.sessionStorage.setItem(
        CONVERSATION_STORAGE_KEY,
        JSON.stringify(sanitizedMessages)
      );
    } catch {
      // Ignore sessionStorage errors
    }
  }

  /**
   * Clears short-term session conversation history.
   */
  static clearShortTermHistory(): void {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(CONVERSATION_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }

  /**
   * Extracts non-sensitive user preferences, name, and interests from a user message
   * when Long-Term Memory is enabled.
   */
  static extractMemoryFromUserMessage(
    message: string,
    existingItems: LongTermMemoryItem[]
  ): LongTermMemoryItem[] {
    if (!message || containsSensitiveData(message)) {
      return existingItems;
    }

    const newFacts: Omit<LongTermMemoryItem, "id" | "createdAt">[] = [];

    // Name patterns (Indonesian & English)
    const nameMatch = message.match(
      /(?:nama\s+saya|namaku|panggil\s+aku|my\s+name\s+is|call\s+me)\s+([A-Za-zÀ-ÿ]{2,25})/i
    );
    if (nameMatch?.[1]) {
      newFacts.push({
        category: "identity",
        content: `User's preferred name is ${nameMatch[1]}`,
      });
    }

    // Preference / Like patterns
    const likeMatch = message.match(
      /(?:aku\s+suka|saya\s+suka|hobi\s+aku|i\s+really\s+like|i\s+love|my\s+favorite\s+is)\s+([^.,!?]{3,60})/i
    );
    if (likeMatch?.[1]) {
      newFacts.push({
        category: "preference",
        content: `Likes / enjoys: ${likeMatch[1].trim()}`,
      });
    }

    // Goal / Working on patterns
    const goalMatch = message.match(
      /(?:aku\s+sedang\s+belajar|aku\s+lagi\s+kerjain|i\s+am\s+working\s+on|i'm\s+learning)\s+([^.,!?]{3,65})/i
    );
    if (goalMatch?.[1]) {
      newFacts.push({
        category: "goal",
        content: `Currently working on / learning: ${goalMatch[1].trim()}`,
      });
    }

    // Role / Profession patterns
    const roleMatch = message.match(
      /(?:aku\s+seorang|pekerjaanku|i\s+work\s+as\s+a|i\s+am\s+a)\s+([A-Za-z\s]{3,35})/i
    );
    if (roleMatch?.[1]) {
      newFacts.push({
        category: "fact",
        content: `Background / role: ${roleMatch[1].trim()}`,
      });
    }

    if (newFacts.length === 0) return existingItems;

    const updated = [...existingItems];
    for (const candidate of newFacts) {
      const alreadyExists = updated.some(
        (item) => item.content.toLowerCase() === candidate.content.toLowerCase()
      );
      if (!alreadyExists) {
        updated.unshift({
          id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          category: candidate.category,
          content: candidate.content,
          createdAt: new Date().toISOString(),
        });
      }
    }

    this.saveLongTermMemories(updated);
    return updated;
  }

  /**
   * Formats short-term context window for AI requests without mutating user message text.
   */
  static buildShortTermContext(
    messages: ChatMessage[],
    maxTurns = 8
  ): { role: "user" | "assistant" | "system"; content: string }[] {
    return messages.slice(-maxTurns).map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * Usage Optimization (Section 10):
   * Instead of sending the entire conversation history on long conversations,
   * summarizes older turns into a compact summary and sends only the latest `recentWindow` messages.
   */
  static buildOptimizedContextWithSummary(
    messages: ChatMessage[],
    recentWindow = 6
  ): {
    recentHistory: { role: "user" | "assistant" | "system"; content: string }[];
    conversationSummary?: string;
  } {
    if (messages.length <= recentWindow) {
      return {
        recentHistory: this.buildShortTermContext(messages, recentWindow),
        conversationSummary: undefined,
      };
    }

    const olderMessages = messages.slice(0, messages.length - recentWindow);
    const recentMessages = messages.slice(-recentWindow);

    const userTopics = olderMessages
      .filter((m) => m.role === "user")
      .slice(-6)
      .map((m) => m.content.slice(0, 70))
      .join(" | ");

    const lastAiPoint = [...olderMessages]
      .reverse()
      .find((m) => m.role === "assistant")
      ?.content.slice(0, 110);

    const conversationSummary = `Earlier conversation summary (${olderMessages.length} turns): User discussed [${userTopics || "general greeting"}]. Last assistant point: "${lastAiPoint || "welcomed user"}".`;

    return {
      recentHistory: this.buildShortTermContext(recentMessages, recentWindow),
      conversationSummary,
    };
  }
}
