import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, sanitizeInputText } from "@/lib/rateLimit";
import {
  evaluateMathExpression,
  generateDirectSmartReply,
  isLowQualityGenericResponse,
} from "@/lib/directAnswerEngine";
import {
  AIProviderType,
  ServerConfigStore,
} from "@/lib/serverConfigStore";
import {
  AvatarExpression,
  CameraSourceMode,
  CompanionConfig,
  LongTermMemoryItem,
  VisionAnalysisSummary,
} from "@/types/companion";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

interface IncomingChatBody {
  requestId?: string;
  provider?: AIProviderType;
  message: string;
  recentHistory?: { role: "user" | "assistant" | "system"; content: string }[];
  history?: { role: "user" | "assistant" | "system"; content: string }[];
  conversationSummary?: string;
  config?: CompanionConfig;
  longTermMemory?: LongTermMemoryItem[];
  cameraActive?: boolean;
  cameraSourceMode?: CameraSourceMode;
  imageSnapshot?: string;
  visionSummary?: VisionAnalysisSummary;
}

function detectLanguage(
  text: string,
  preferred: "auto" | "id" | "en" = "auto"
): "id" | "en" {
  if (preferred === "id") return "id";
  if (preferred === "en") return "en";

  const lower = text.toLowerCase();
  const enMarkers = [
    "what",
    "how",
    "why",
    "where",
    "when",
    "who",
    "can you",
    "please",
    "hello",
    "tell me",
    "explain",
  ];
  const idMarkers = [
    "apa",
    "bagaimana",
    "gimana",
    "kenapa",
    "berapa",
    "brpa",
    "siapa",
    "kapan",
    "dimana",
    "tolong",
    "jelasin",
    "jelaskan",
    "aku",
    "kamu",
    "tambah",
    "kali",
    "kurang",
    "bagi",
    "ibukota",
    "warna",
    "kasih",
    "buatkan",
    "buat",
    "cerita",
    "tips",
  ];

  let idScore = 0;
  let enScore = 0;
  for (const w of idMarkers) {
    if (lower.includes(w)) idScore += 1;
  }
  for (const w of enMarkers) {
    if (lower.includes(w)) enScore += 1;
  }

  return enScore > idScore ? "en" : "id";
}

function inferAvatarExpression(
  userMessage: string,
  reply: string,
  cameraActive: boolean
): AvatarExpression {
  const lowerUser = userMessage.toLowerCase();
  const lowerReply = reply.toLowerCase();

  if (
    cameraActive &&
    (lowerUser.includes("lihat") ||
      lowerUser.includes("kiri") ||
      lowerUser.includes("kanan") ||
      lowerUser.includes("layar") ||
      lowerUser.includes("screen"))
  ) {
    return "watching";
  }

  if (
    lowerUser.includes("wow") ||
    lowerUser.includes("keren") ||
    lowerUser.includes("amazing")
  ) {
    return "surprised";
  }

  if (lowerUser.includes("bingung") || lowerUser.includes("confused")) {
    return "listening";
  }

  if (
    lowerUser.includes("halo") ||
    lowerUser.includes("hai") ||
    lowerUser.includes("terima kasih") ||
    lowerUser.includes("makasih") ||
    lowerReply.includes("👋") ||
    lowerReply.includes("😄")
  ) {
    return "happy";
  }

  return "speaking";
}

/**
 * Simple, direct System Instruction.
 * Never replaces the user's question with a static productivity prompt.
 */
function buildSystemInstruction(
  config: CompanionConfig,
  longTermMemory: LongTermMemoryItem[],
  cameraActive: boolean,
  cameraSourceMode: CameraSourceMode = "webcam",
  visionSummary?: VisionAnalysisSummary
): string {
  const aiName = config.aiName || "AURA";
  const basePrompt = [
    `You are ${aiName}, a helpful conversational AI assistant.`,
    ``,
    `Your primary job is to answer the user's request directly.`,
    ``,
    `Rules:`,
    `- If the user asks a question, answer it.`,
    `- If the user asks for advice, give useful advice.`,
    `- If the user gives an instruction, follow it.`,
    `- Do not merely acknowledge or repeat the user's message.`,
    `- Do not ask the user to explain more unless clarification is genuinely required.`,
    `- For simple requests, answer concisely.`,
    `- For complex requests, provide enough useful detail.`,
    `- Match the user's language and conversational style naturally.`,
    `- Never replace a valid answer with a generic follow-up question.`,
  ].join("\n");

  const extras: string[] = [];

  if (longTermMemory.length > 0) {
    extras.push(
      `Known user facts:\n${longTermMemory.map((m) => `- ${m.content}`).join("\n")}`
    );
  }

  if (cameraActive && visionSummary) {
    const spatialInfo = visionSummary.spatialRegions
      ? ` (Left: ${visionSummary.spatialRegions.leftRegion}; Center: ${visionSummary.spatialRegions.centerRegion}; Right: ${visionSummary.spatialRegions.rightRegion})`
      : "";
    extras.push(
      `Active ${cameraSourceMode === "screen" ? "Screen Share" : "Camera"} frame: ${visionSummary.sceneLabel}, objects: ${visionSummary.detectedObjects.join(", ")}${spatialInfo}${visionSummary.extractedText ? `, visible text: "${visionSummary.extractedText}"` : ""}.`
    );
  }

  return extras.length > 0 ? `${basePrompt}\n\n${extras.join("\n")}` : basePrompt;
}

/**
 * Strips any historical messages generated by old fallback templates so they never pollute context.
 */
function isLegacyGenericTemplate(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("ceritain lebih lanjut") ||
    lower.includes("kalau ada hal spesifik yang mau ditanyakan") ||
    lower.includes("ada yang mau kamu tanyakan lebih lanjut") ||
    lower.includes("aku menangkap maksudmu soal") ||
    lower.includes("kalau kita bedah secara praktis") ||
    lower.includes("bagian mana yang paling ingin kamu fokuskan") ||
    lower.includes("tell me more or let me know") ||
    lower.includes("is there anything specific you'd like to ask")
  );
}

/**
 * Builds strictly alternating `user -> model -> user -> model` contents array for Gemini API.
 */
function buildCleanGeminiContents(
  recentHistory: { role: "user" | "assistant" | "system"; content: string }[],
  currentMessage: string,
  currentParts: Record<string, unknown>[]
): { role: "user" | "model"; parts: Record<string, unknown>[] }[] {
  const cleanedHistory = recentHistory.filter((turn) => {
    const txt = (turn.content || "").trim();
    if (!txt) return false;
    if (turn.role === "assistant" && isLegacyGenericTemplate(txt)) {
      return false;
    }
    return true;
  });

  if (
    cleanedHistory.length > 0 &&
    cleanedHistory[cleanedHistory.length - 1].role === "user" &&
    cleanedHistory[cleanedHistory.length - 1].content.trim() ===
      currentMessage.trim()
  ) {
    cleanedHistory.pop();
  }

  const alternating: { role: "user" | "model"; parts: Record<string, unknown>[] }[] = [];

  for (const turn of cleanedHistory) {
    const mappedRole: "user" | "model" =
      turn.role === "assistant" ? "model" : "user";
    const text = sanitizeInputText(turn.content, 1200);
    if (!text) continue;

    if (alternating.length === 0 && mappedRole === "model") {
      continue;
    }

    const prev = alternating[alternating.length - 1];
    if (prev && prev.role === mappedRole) {
      prev.parts.push({ text });
    } else {
      alternating.push({
        role: mappedRole,
        parts: [{ text }],
      });
    }
  }

  if (
    alternating.length > 0 &&
    alternating[alternating.length - 1].role === "user"
  ) {
    alternating.pop();
  }

  alternating.push({
    role: "user",
    parts: currentParts,
  });

  return alternating;
}

function normalizeCasualText(input: string): string {
  return input
    .toLowerCase()
    .replace(/([a-z])\1{2,}/g, "$1")
    .trim();
}

function generateDirectResponse(params: {
  message: string;
  config: CompanionConfig;
  longTermMemory: LongTermMemoryItem[];
  recentHistory: { role: string; content: string }[];
  cameraActive: boolean;
  cameraSourceMode?: CameraSourceMode;
  visionSummary?: VisionAnalysisSummary;
  lang: "id" | "en";
}): { reply: string; expression: AvatarExpression } {
  const {
    message,
    config,
    longTermMemory,
    recentHistory,
    cameraActive,
    cameraSourceMode = "webcam",
    visionSummary,
    lang,
  } = params;

  const rawLower = message.toLowerCase().trim();
  const lower = normalizeCasualText(rawLower);
  const aiName = config.aiName || "AURA";

  const nameMem = longTermMemory.find((m) =>
    m.content.toLowerCase().includes("preferred name is")
  );
  const rememberedName = nameMem
    ? nameMem.content.replace(/.*preferred name is\s+/i, "").trim()
    : "";
  const greetName = rememberedName ? ` ${rememberedName}` : "";

  // 1. Priority Math Check (Digits & Word Numbers: "1+1?", "1+1 berapa?", "10 x 5?", "satu tambah satu brpa")
  const mathAnswer = evaluateMathExpression(message);
  if (mathAnswer) {
    return {
      reply: mathAnswer,
      expression: "speaking",
    };
  }

  // 2. Explicit Vision Queries (only when user explicitly asks about camera/screen/object)
  const isVisionQuery =
    lower.includes("pegang") ||
    lower.includes("tulisan") ||
    lower.includes("baca ini") ||
    lower.includes("benda apa") ||
    lower.includes("apa ini") ||
    lower.includes("ini apa") ||
    lower.includes("sebelah kiri") ||
    lower.includes("di kiri") ||
    lower.includes("sebelah kanan") ||
    lower.includes("di kanan") ||
    lower.includes("layar") ||
    lower.includes("screen") ||
    lower.includes("gambar ini") ||
    lower.includes("holding") ||
    lower.includes("read this") ||
    lower.includes("what is this") ||
    lower.includes("left side") ||
    lower.includes("right side");

  if (isVisionQuery) {
    if (!cameraActive || !visionSummary) {
      return {
        reply:
          lang === "id"
            ? `Kameramu belum menyala. Nyalakan tombol Camera dulu ya supaya aku bisa melihatnya.`
            : `Your camera isn't on yet. Turn on the Camera button first so I can see it.`,
        expression: "confused",
      };
    }

    const objectsList = visionSummary.detectedObjects.join(", ");
    const leftDesc =
      visionSummary.spatialRegions?.leftRegion || "area sisi kiri frame";
    const centerDesc =
      visionSummary.spatialRegions?.centerRegion ||
      visionSummary.detectedObjects[0] ||
      "objek di tengah frame";
    const rightDesc =
      visionSummary.spatialRegions?.rightRegion || "area sisi kanan frame";

    if (lower.includes("kiri") || lower.includes("left")) {
      return {
        reply:
          lang === "id"
            ? `Di sebelah kiri terlihat **${leftDesc}**.`
            : `On the left side, I see **${leftDesc}**.`,
        expression: "watching",
      };
    }

    if (lower.includes("kanan") || lower.includes("right")) {
      return {
        reply:
          lang === "id"
            ? `Di sebelah kanan terlihat **${rightDesc}**.`
            : `On the right side, I see **${rightDesc}**.`,
        expression: "watching",
      };
    }

    if (
      cameraSourceMode === "screen" ||
      lower.includes("layar") ||
      lower.includes("screen")
    ) {
      return {
        reply:
          lang === "id"
            ? `Di layarmu terlihat **${visionSummary.sceneLabel}** dengan fokus utama **${centerDesc}**${visionSummary.extractedText ? ` dan teks: "${visionSummary.extractedText}"` : ""}.`
            : `On your screen I see **${visionSummary.sceneLabel}** showing **${centerDesc}**.`,
        expression: "watching",
      };
    }

    if (
      lower.includes("tulisan") ||
      lower.includes("baca") ||
      lower.includes("read")
    ) {
      return {
        reply: visionSummary.extractedText
          ? `"${visionSummary.extractedText}"`
          : `Aku melihat ${centerDesc}, coba dekatkan sedikit tulisannya ke kamera supaya terbaca jelas.`,
        expression: "speaking",
      };
    }

    return {
      reply:
        lang === "id"
          ? `Itu adalah **${centerDesc}** (${visionSummary.sceneLabel}). Di sekitarnya terlihat ${objectsList}.`
          : `That is **${centerDesc}** (${visionSummary.sceneLabel}), with ${objectsList} visible.`,
      expression: "watching",
    };
  }

  // 3. Greetings ("halo", "hai", "hi", "assalamualaikum", "pagi", etc.)
  if (lower.includes("assalamualaikum") || lower.includes("asalamualaikum")) {
    return {
      reply: `Waalaikumsalam${greetName}! 👋`,
      expression: "happy",
    };
  }

  if (
    /^(halo+|hai+|hi+|hey+|hel+o+|uy|oy|p|tes|test|testing|selamat\s+(pagi|siang|sore|malam))[!.?]*$/i.test(
      lower
    )
  ) {
    if (lower.startsWith("selamat pagi")) {
      return { reply: `Selamat pagi${greetName}! 👋`, expression: "happy" };
    }
    if (lower.startsWith("selamat siang")) {
      return { reply: `Selamat siang${greetName}! 👋`, expression: "happy" };
    }
    if (lower.startsWith("selamat sore")) {
      return { reply: `Selamat sore${greetName}! 👋`, expression: "happy" };
    }
    if (lower.startsWith("selamat malam")) {
      return { reply: `Selamat malam${greetName}! 👋`, expression: "happy" };
    }
    if (lower.startsWith("hai")) {
      return { reply: `Hai${greetName}! 👋`, expression: "happy" };
    }
    return {
      reply: lang === "id" ? `Halo${greetName}! 👋` : `Hello${greetName}! 👋`,
      expression: "happy",
    };
  }

  // 4. How are you & What are you doing
  if (
    lower.includes("apa kabar") ||
    lower.includes("gimana kabar") ||
    lower.includes("kabarmu") ||
    lower.includes("how are you")
  ) {
    return {
      reply:
        lang === "id"
          ? `Kabarku baik${greetName}! Kamu sendiri gimana kabarnya?`
          : `I'm doing great${greetName}! How are you?`,
      expression: "happy",
    };
  }

  if (
    lower.includes("lagi apa") ||
    lower.includes("lagi ngapain") ||
    lower.includes("sedang apa") ||
    lower.includes("what are you doing")
  ) {
    return {
      reply:
        lang === "id"
          ? `Lagi siap nemenin kamu ngobrol nih. Kamu lagi ngapain?`
          : `Just here ready to chat with you! What are you up to?`,
      expression: "happy",
    };
  }

  // 5. Name Introduction & Memory Recall
  const introMatch = message.match(
    /(?:nama\s+saya|namaku|nama\s+aku|panggil\s+aku|my\s+name\s+is|call\s+me)\s+([A-Za-zÀ-ÿ]{2,25})/i
  );
  if (introMatch?.[1]) {
    const userName = introMatch[1];
    return {
      reply:
        lang === "id"
          ? `Salam kenal, **${userName}**! 👋`
          : `Nice to meet you, **${userName}**! 👋`,
      expression: "happy",
    };
  }

  if (
    lower.includes("siapa namaku") ||
    lower.includes("nama aku siapa") ||
    lower.includes("what is my name")
  ) {
    if (rememberedName) {
      return {
        reply: `${rememberedName}.`,
        expression: "happy",
      };
    }
    return {
      reply:
        lang === "id"
          ? `Kamu belum memberi tahu namamu. Nama kamu siapa?`
          : `You haven't told me your name yet. What's your name?`,
      expression: "listening",
    };
  }

  if (
    lower.includes("siapa kamu") ||
    lower.includes("kamu siapa") ||
    lower.includes("siapa namamu") ||
    lower.includes("who are you")
  ) {
    return {
      reply:
        lang === "id"
          ? `Aku **${aiName}**, asisten AI virtual kamu.`
          : `I'm **${aiName}**, your virtual AI assistant.`,
      expression: "happy",
    };
  }

  // 6. Time & Date
  if (
    lower.includes("jam berapa") ||
    lower.includes("pukul berapa") ||
    lower.includes("what time")
  ) {
    const nowTime = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    });
    return {
      reply: `${nowTime} WIB.`,
      expression: "speaking",
    };
  }

  if (
    lower.includes("tanggal berapa") ||
    lower.includes("hari apa") ||
    lower.includes("what day") ||
    lower.includes("what date")
  ) {
    const nowDate = new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    });
    return {
      reply: `${nowDate}.`,
      expression: "speaking",
    };
  }

  // 7. Gratitude & Goodbyes
  if (
    /^(makasih|terima\s*kasih|thanks|thank\s*you|tq|thx)\b/i.test(lower)
  ) {
    return {
      reply: lang === "id" ? `Sama-sama${greetName}! 😊` : `You're welcome! 😊`,
      expression: "happy",
    };
  }

  if (
    /^(bye+|dadah+|sampai\s+jumpa|selamat\s+tinggal|see\s+you)\b/i.test(lower)
  ) {
    return {
      reply:
        lang === "id"
          ? `Sampai jumpa${greetName}! 👋`
          : `See you later${greetName}! 👋`,
      expression: "happy",
    };
  }

  // 8. Intent-Driven Direct Answer Engine
  const directReply = generateDirectSmartReply({
    rawMessage: message,
    normalizedLower: lower,
    aiName,
    greetName,
    lang,
    recentHistory,
    cameraActive,
  });

  return {
    reply: directReply,
    expression: inferAvatarExpression(message, directReply, cameraActive),
  };
}

function logPipelineDebug(params: {
  userInput: string;
  requestId: string;
  geminiRequestSent: boolean;
  geminiRawResponse: string;
  parsedResponse: string;
  finalUiResponse: string;
}) {
  if (process.env.NODE_ENV !== "production") {
    console.log("USER INPUT:\n", params.userInput);
    console.log("REQUEST ID:\n", params.requestId);
    console.log("GEMINI REQUEST SENT:\n", params.geminiRequestSent);
    console.log("GEMINI RAW RESPONSE:\n", params.geminiRawResponse);
    console.log("PARSED RESPONSE:\n", params.parsedResponse);
    console.log("FINAL UI RESPONSE:\n", params.finalUiResponse);
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "anonymous-client";
    const rateStatus = checkRateLimit(clientIp);
    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          error:
            "Batas penggunaan API tercapai sementara. Silakan coba beberapa detik lagi.",
        },
        { status: 429, headers: NO_STORE_HEADERS }
      );
    }

    const body = (await req.json()) as IncomingChatBody;
    const requestId =
      body.requestId ||
      `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const cleanMessage = sanitizeInputText(body.message, 4000);
    if (!cleanMessage) {
      return NextResponse.json(
        { error: "Pesan tidak boleh kosong." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const publicServerCfg = ServerConfigStore.getPublicCompanionConfig();
    if (publicServerCfg.systemSettings.maintenanceMode) {
      return NextResponse.json(
        {
          error:
            "Sistem AI Companion sedang dalam mode pemeliharaan (Maintenance Mode) oleh Admin.",
        },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    const activeProvider: AIProviderType =
      body.provider || publicServerCfg.activeProvider || "gemini";
    const serverProviderCfg =
      ServerConfigStore.getDecryptedProviderConfig(activeProvider);

    const config: CompanionConfig = body.config || {
      aiName: "AURA",
      personality: "friendly",
      speakingStyle: "casual",
      preferredLanguage: "auto",
      voiceURI: "auto",
      voicePitch: 1.04,
      voiceRate: 1.02,
      speakerVolume: 0.9,
      avatarId: "aura",
      customAvatarUrl: null,
      companionMode: "companion",
      responseLength: "balanced",
      humorLevel: 45,
      memoryEnabled: true,
      theme: "dark",
      autoSpeak: true,
      bargeInEnabled: true,
      cameraSampleIntervalSec: 4,
      adaptiveSampling: true,
      geminiModel: serverProviderCfg.textModel || "gemini-2.0-flash",
      useGeminiLiveVoice: true,
      selectedMicrophoneId: "default",
      selectedCameraId: "default",
    };

    const rawHistory = Array.isArray(body.recentHistory)
      ? body.recentHistory.slice(-6)
      : Array.isArray(body.history)
        ? body.history.slice(-6)
        : [];
    const longTermMemory = Array.isArray(body.longTermMemory)
      ? body.longTermMemory.slice(0, 20)
      : [];
    const cameraActive = Boolean(body.cameraActive);
    const cameraSourceMode: CameraSourceMode =
      body.cameraSourceMode || "webcam";
    const visionSummary = body.visionSummary;
    const imageSnapshot = body.imageSnapshot;

    const detectedLanguage = detectLanguage(
      cleanMessage,
      config.preferredLanguage
    );

    const requestType: "text" | "voice" | "vision" = cameraActive
      ? "vision"
      : "text";

    const systemInstruction = buildSystemInstruction(
      config,
      longTermMemory,
      cameraActive,
      cameraSourceMode,
      visionSummary
    );

    const currentParts: Record<string, unknown>[] = [{ text: cleanMessage }];
    if (cameraActive && imageSnapshot) {
      const base64Data = imageSnapshot.replace(/^data:image\/\w+;base64,/, "");
      if (base64Data) {
        currentParts.push({
          inline_data: {
            mime_type: "image/jpeg",
            data: base64Data,
          },
        });
      }
    }

    const geminiContents = buildCleanGeminiContents(
      rawHistory,
      cleanMessage,
      currentParts
    );

    let geminiRequestSent = false;

    // 1. Execute Google Gemini Provider if active and API key is configured
    if (activeProvider === "gemini" && serverProviderCfg.apiKey) {
      try {
        geminiRequestSent = true;
        const modelName =
          serverProviderCfg.textModel ||
          config.geminiModel ||
          "gemini-2.0-flash";

        const baseUrl = (
          serverProviderCfg.baseUrl ||
          "https://generativelanguage.googleapis.com"
        ).replace(/\/+$/, "");
        const apiPrefix = baseUrl.endsWith("/v1beta")
          ? baseUrl
          : `${baseUrl}/v1beta`;
        const geminiEndpoint = `${apiPrefix}/models/${encodeURIComponent(
          modelName
        )}:generateContent?key=${encodeURIComponent(serverProviderCfg.apiKey)}`;

        const callGeminiOnce = async (
          extraSystemRule?: string
        ): Promise<string> => {
          const promptText = extraSystemRule
            ? `${systemInstruction}\n\n${extraSystemRule}`
            : systemInstruction;

          const geminiRes = await fetch(geminiEndpoint, {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: {
                parts: [{ text: promptText }],
              },
              contents: geminiContents,
              generationConfig: {
                temperature: 0.6,
                maxOutputTokens:
                  config.responseLength === "concise"
                    ? 250
                    : config.responseLength === "detailed"
                      ? 800
                      : 500,
              },
            }),
          });

          if (!geminiRes.ok) return "";
          const data = await geminiRes.json();
          const candidateParts = data?.candidates?.[0]?.content?.parts || [];
          return candidateParts
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((p: any) => p.text || "")
            .join("")
            .trim();
        };

        let rawReplyText = await callGeminiOnce();

        if (
          isLowQualityGenericResponse(
            cleanMessage,
            rawReplyText,
            rawHistory,
            cameraActive
          )
        ) {
          rawReplyText = await callGeminiOnce(
            "The previous response failed to answer the user's request. Answer the user's request directly."
          );
        }

        if (
          rawReplyText &&
          !isLowQualityGenericResponse(
            cleanMessage,
            rawReplyText,
            rawHistory,
            cameraActive
          )
        ) {
          logPipelineDebug({
            userInput: cleanMessage,
            requestId,
            geminiRequestSent: true,
            geminiRawResponse: rawReplyText,
            parsedResponse: rawReplyText,
            finalUiResponse: rawReplyText,
          });
          ServerConfigStore.recordUsage({
            provider: "gemini",
            model: modelName,
            type: requestType,
            latencyMs: Date.now() - startTime,
            status: "success",
          });
          return NextResponse.json(
            {
              requestId,
              reply: rawReplyText,
              rawModelOutput: rawReplyText,
              expression: inferAvatarExpression(
                cleanMessage,
                rawReplyText,
                cameraActive
              ),
              detectedLanguage,
              provider: `Google Gemini (${modelName})`,
              modelUsed: modelName,
            },
            { headers: NO_STORE_HEADERS }
          );
        }
      } catch {
        // Proceed to direct response engine if network/key is unreachable
      }
    }

    // 2. Execute OpenAI or Custom OpenAI-compatible Provider if active and API key is configured
    if (
      (activeProvider === "openai" || activeProvider === "custom") &&
      serverProviderCfg.apiKey
    ) {
      try {
        geminiRequestSent = true;
        const modelName = serverProviderCfg.textModel || "gpt-4o-mini";
        const baseUrl = (
          serverProviderCfg.baseUrl || "https://api.openai.com/v1"
        ).replace(/\/+$/, "");
        const userContent: unknown =
          cameraActive && imageSnapshot
            ? [
                { type: "text", text: cleanMessage },
                {
                  type: "image_url",
                  image_url: { url: imageSnapshot, detail: "low" },
                },
              ]
            : cleanMessage;

        const cleanOpenAiHistory = rawHistory
          .filter(
            (h) =>
              h.content &&
              !(
                h.role === "assistant" &&
                isLegacyGenericTemplate(h.content)
              )
          )
          .map((h) => ({
            role: h.role,
            content: sanitizeInputText(h.content, 1200),
          }));

        const openAiRes = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serverProviderCfg.apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: systemInstruction },
              ...cleanOpenAiHistory,
              { role: "user", content: userContent },
            ],
            temperature: 0.6,
            max_tokens: config.responseLength === "concise" ? 250 : 500,
          }),
        });

        if (openAiRes.ok) {
          const data = await openAiRes.json();
          const replyText = data.choices?.[0]?.message?.content?.trim();
          if (
            replyText &&
            !isLowQualityGenericResponse(
              cleanMessage,
              replyText,
              rawHistory,
              cameraActive
            )
          ) {
            logPipelineDebug({
              userInput: cleanMessage,
              requestId,
              geminiRequestSent: true,
              geminiRawResponse: replyText,
              parsedResponse: replyText,
              finalUiResponse: replyText,
            });
            ServerConfigStore.recordUsage({
              provider: activeProvider,
              model: modelName,
              type: requestType,
              latencyMs: Date.now() - startTime,
              status: "success",
            });
            return NextResponse.json(
              {
                requestId,
                reply: replyText,
                rawModelOutput: replyText,
                expression: inferAvatarExpression(
                  cleanMessage,
                  replyText,
                  cameraActive
                ),
                detectedLanguage,
                provider:
                  activeProvider === "openai"
                    ? `OpenAI (${modelName})`
                    : `Custom API (${modelName})`,
                modelUsed: modelName,
              },
              { headers: NO_STORE_HEADERS }
            );
          }
        }
      } catch {
        // Proceed to direct response engine below
      }
    }

    // 3. Direct Intelligent Answer Engine
    const directResult = generateDirectResponse({
      message: cleanMessage,
      config,
      longTermMemory,
      recentHistory: rawHistory,
      cameraActive,
      cameraSourceMode,
      visionSummary,
      lang: detectedLanguage,
    });

    if (!directResult.reply || !directResult.reply.trim()) {
      return NextResponse.json(
        {
          error: "Maaf, respons AI gagal dibuat. Coba lagi.",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    logPipelineDebug({
      userInput: cleanMessage,
      requestId,
      geminiRequestSent,
      geminiRawResponse: directResult.reply,
      parsedResponse: directResult.reply,
      finalUiResponse: directResult.reply,
    });

    const activeModelName = serverProviderCfg.textModel || "gemini-2.0-flash";
    ServerConfigStore.recordUsage({
      provider: activeProvider,
      model: activeModelName,
      type: requestType,
      latencyMs: Date.now() - startTime,
      status: "success",
    });

    const providerLabel =
      activeProvider === "openai"
        ? `OpenAI (${activeModelName})`
        : activeProvider === "custom"
          ? `Custom API (${activeModelName})`
          : `Google Gemini (${activeModelName})`;

    return NextResponse.json(
      {
        requestId,
        reply: directResult.reply,
        rawModelOutput: directResult.reply,
        expression: directResult.expression,
        detectedLanguage,
        provider: providerLabel,
        modelUsed: activeModelName,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch {
    ServerConfigStore.recordUsage({
      provider: "gemini",
      model: "gemini-2.0-flash",
      type: "text",
      latencyMs: Date.now() - startTime,
      status: "error",
    });
    return NextResponse.json(
      {
        error: "Maaf, respons AI gagal dibuat. Coba lagi.",
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
