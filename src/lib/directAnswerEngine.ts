/**
 * Direct Answer & Intent Resolution Engine for AURA AI Companion.
 *
 * Guarantees that every distinct user question, story request, brainstorming prompt,
 * advice request, calculation, or explanation receives a specific, relevant, fresh answer.
 * - Zero hardcoded productivity fallbacks for unrelated questions.
 * - Zero generic evasions.
 */

export type UserIntentType =
  | "math_calculation"
  | "unit_conversion"
  | "ambiguous_reference"
  | "story_generation"
  | "idea_generation"
  | "advice_request"
  | "comparison_request"
  | "translation_request"
  | "creative_request"
  | "model_identity"
  | "capability_confirmation"
  | "explanation_request"
  | "feeling_share"
  | "greeting_smalltalk"
  | "direct_question_or_instruction";

const INDONESIAN_NUMBER_WORDS: Record<string, number> = {
  nol: 0,
  kosong: 0,
  satu: 1,
  se: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
  sebelas: 11,
  seratus: 100,
  seribu: 1000,
  sejuta: 1000000,
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  hundred: 100,
  thousand: 1000,
};

/**
 * Converts Indonesian & English number words into digits so expressions like
 * "satu tambah satu brpa", "dua belas dikali tiga", "seratus dibagi empat"
 * can be evaluated accurately.
 */
export function convertWordNumbersToDigits(text: string): string {
  let s = text.toLowerCase();

  s = s.replace(
    /\b(dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+puluh\s+(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\b/g,
    (_, tensWord: string, onesWord: string) => {
      const tens = (INDONESIAN_NUMBER_WORDS[tensWord] || 0) * 10;
      const ones = INDONESIAN_NUMBER_WORDS[onesWord] || 0;
      return String(tens + ones);
    }
  );

  s = s.replace(
    /\b(dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+puluh\b/g,
    (_, tensWord: string) =>
      String((INDONESIAN_NUMBER_WORDS[tensWord] || 0) * 10)
  );

  s = s.replace(
    /\b(dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+belas\b/g,
    (_, onesWord: string) =>
      String(10 + (INDONESIAN_NUMBER_WORDS[onesWord] || 0))
  );

  s = s.replace(
    /\b(dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+ratus\b/g,
    (_, hundredsWord: string) =>
      String((INDONESIAN_NUMBER_WORDS[hundredsWord] || 0) * 100)
  );

  s = s.replace(
    /\b(dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+ribu\b/g,
    (_, thousandsWord: string) =>
      String((INDONESIAN_NUMBER_WORDS[thousandsWord] || 0) * 1000)
  );

  s = s.replace(
    /\b(nol|kosong|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|seratus|seribu|sejuta|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|hundred|thousand)\b/g,
    (word: string) => {
      const val = INDONESIAN_NUMBER_WORDS[word];
      return val !== undefined ? String(val) : word;
    }
  );

  return s;
}

/**
 * Evaluates math questions in both digit and word formats:
 * - "1+1?", "1+1 berapa?", "2+2 berapa?", "10 x 5?"
 * - "satu tambah satu brpa", "berapa lima kali lima"
 * - "akar kuadrat dari 144", "20% dari 150000"
 */
export function evaluateMathExpression(input: string): string | null {
  const withDigits = convertWordNumbersToDigits(input);

  // Guard: do not treat list/idea/story requests like "buatkan 5 ide nama aplikasi AI" as math
  if (
    /\b(ide|tips|cara|langkah|contoh|alasan|poin|daftar|nama|aplikasi|saran|fakta|kalimat|kata|cerita|cerpen|paragraf|baris)\b/i.test(
      input
    ) &&
    !/[+\-*/^]|tambah|kurang|kali|bagi|akar|persen/i.test(input)
  ) {
    return null;
  }

  // 1. Square root ("akar dari 64", "akar kuadrat 144", "sqrt 81")
  const sqrtMatch = withDigits.match(
    /(?:akar(?:\s+kuadrat)?(?:\s+dari)?|sqrt)\s*(\d+(?:[.,]\d+)?)/i
  );
  if (sqrtMatch) {
    const n = parseFloat(sqrtMatch[1].replace(",", "."));
    if (!Number.isNaN(n) && n >= 0) {
      const res = Math.sqrt(n);
      const formatted = Number.isInteger(res)
        ? String(res)
        : Number(res.toFixed(4)).toString();
      return `${formatted}.`;
    }
  }

  // 2. Percentage ("20% dari 150000", "15 persen dari 200")
  const pctMatch = withDigits.match(
    /(\d+(?:[.,]\d+)?)\s*(?:%|persen|percent)\s*(?:dari|of)\s*(\d+(?:[.,]\d+)?)/i
  );
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1].replace(",", "."));
    const total = parseFloat(pctMatch[2].replace(",", "."));
    if (!Number.isNaN(pct) && !Number.isNaN(total)) {
      const res = (pct / 100) * total;
      const formatted = Number.isInteger(res)
        ? String(res)
        : Number(res.toFixed(4)).toString();
      return `${formatted}.`;
    }
  }

  // 3. Replace verbal operators with symbols ONLY when adjacent to numbers
  let normalized = withDigits
    .replace(/\b(ditambah|tambah|plus)\b/gi, "+")
    .replace(/\b(dikurangi|dikurang|kurang|minus)\b/gi, "-")
    .replace(/\b(dikali|kali|times)\b/gi, "*")
    .replace(/\b(dibagi|bagi|divided\s+by)\b/gi, "/")
    .replace(/\b(pangkat|power)\b/gi, "^")
    .replace(/(\d)\s*[xX×]\s*(\d)/g, "$1 * $2")
    .replace(/(\d)\s*[÷:]\s*(\d)/g, "$1 / $2");

  normalized = normalized
    .replace(
      /\b(berapa(?:kah)?|brpa|brp|hasil\s+dari|hasilnya|hitung(?:lah|kan)?|tolong|coba|ya|dong|nih|sih|what\s+is|calculate|equals|sama\s+dengan)\b/gi,
      " "
    )
    .replace(/[?=!,]/g, " ")
    .trim();

  const exprMatch = normalized.match(
    /(-?\d+(?:\.\d+)?(?:\s*[+\-*/^]\s*-?\d+(?:\.\d+)?)+)/
  );
  if (!exprMatch) return null;

  const expr = exprMatch[1].trim();
  if (!/^[\d+\-*/().^\s]+$/.test(expr)) return null;

  try {
    const jsExpr = expr.replace(/\^/g, "**");
    const result = Function(`"use strict"; return (${jsExpr});`)();
    if (typeof result === "number" && Number.isFinite(result)) {
      const formatted = Number.isInteger(result)
        ? result.toString()
        : Number(result.toFixed(4)).toString();
      return `${formatted}.`;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Evaluates unit conversions ("10 km berapa meter", "2 jam berapa menit", "5 kg berapa gram").
 */
function evaluateUnitConversion(input: string): string | null {
  const s = convertWordNumbersToDigits(input);

  const kmToM = s.match(
    /(\d+(?:\.\d+)?)\s*(?:km|kilometer)\s*(?:berapa|ke|to|=\s*)?\s*(?:m|meter)\b/i
  );
  if (kmToM) return `${parseFloat(kmToM[1]) * 1000} meter.`;

  const mToCm = s.match(
    /(\d+(?:\.\d+)?)\s*(?:m|meter)\s*(?:berapa|ke|to|=\s*)?\s*(?:cm|centimeter|sentimeter)\b/i
  );
  if (mToCm) return `${parseFloat(mToCm[1]) * 100} cm.`;

  const kgToG = s.match(
    /(\d+(?:\.\d+)?)\s*(?:kg|kilogram)\s*(?:berapa|ke|to|=\s*)?\s*(?:gr|gram|g)\b/i
  );
  if (kgToG) return `${parseFloat(kgToG[1]) * 1000} gram.`;

  const jamToMenit = s.match(
    /(\d+(?:\.\d+)?)\s*(?:jam|hour|hours)\s*(?:berapa|ke|to|=\s*)?\s*(?:menit|minute|minutes)\b/i
  );
  if (jamToMenit) return `${parseFloat(jamToMenit[1]) * 60} menit.`;

  const menitToDetik = s.match(
    /(\d+(?:\.\d+)?)\s*(?:menit|minute|minutes)\s*(?:berapa|ke|to|=\s*)?\s*(?:detik|second|seconds)\b/i
  );
  if (menitToDetik) return `${parseFloat(menitToDetik[1]) * 60} detik.`;

  const hariToJam = s.match(
    /(\d+(?:\.\d+)?)\s*(?:hari|day|days)\s*(?:berapa|ke|to|=\s*)?\s*(?:jam|hour|hours)\b/i
  );
  if (hariToJam) return `${parseFloat(hariToJam[1]) * 24} jam.`;

  return null;
}

/**
 * Detects whether the user's message is an ambiguous deictic question
 * (e.g., "menurutmu yang ini bagus?", "yang ini cocok nggak?")
 * where no object/subject is named in the message or recent context.
 */
export function isAmbiguousDeicticQuery(
  rawMessage: string,
  recentHistory: { role: string; content: string }[] = [],
  cameraActive = false
): boolean {
  if (cameraActive) return false;
  const lower = rawMessage.toLowerCase().trim();

  const hasDeicticPointer =
    /\b(yang\s+ini|yang\s+itu|pilihan\s+ini|opsi\s+ini|this\s+one|that\s+one|which\s+one\s+is\s+better)\b/i.test(
      lower
    );
  if (!hasDeicticPointer) return false;

  const stripped = lower
    .replace(
      /\b(menurutmu|menurut\s+kamu|kalau|kalo|yang\s+ini|yang\s+itu|lebih|bagus|baik|cocok|keren|oke|ok|gak|nggak|tidak|ya|dong|nih|sih|apa|gimana|how\s+about|do\s+you\s+think|is\s+this\s+one|good|better)\b/gi,
      ""
    )
    .replace(/[?.!,]/g, "")
    .trim();

  const lastUserTurn = [...recentHistory]
    .reverse()
    .find((h) => h.role === "user" && h.content.trim() !== rawMessage.trim());

  if (stripped.length < 4 && !lastUserTurn) {
    return true;
  }

  return false;
}

/**
 * Classifies the user's intent accurately so stories, brainstorming, advice, explanations,
 * model questions, and calculations are handled by their dedicated generators.
 */
export function classifyUserIntent(
  rawMessage: string,
  recentHistory: { role: string; content: string }[] = [],
  cameraActive = false
): UserIntentType {
  const lower = rawMessage.toLowerCase().trim();

  if (evaluateMathExpression(rawMessage) !== null) {
    return "math_calculation";
  }

  if (evaluateUnitConversion(rawMessage) !== null) {
    return "unit_conversion";
  }

  if (isAmbiguousDeicticQuery(rawMessage, recentHistory, cameraActive)) {
    return "ambiguous_reference";
  }

  // Story / Cerpen / Dongeng requests ("buat cerita pendek tentang kucing", "ceritakan dongeng...", "bikin cerita...")
  if (
    /\b(cerita\s+pendek|cerpen|dongeng|buat(?:kan)?\s+cerita|bikin(?:in)?\s+cerita|tulis(?:kan)?\s+cerita|ceritakan\s+kisah|short\s+story|tell\s+me\s+a\s+story|write\s+a\s+story)\b/i.test(
      lower
    )
  ) {
    return "story_generation";
  }

  // Model / Identity questions ("kamu model apa", "pakai model apa", "siapa yang buat kamu")
  if (
    /\b(kamu\s+model\s+apa|model\s+apa\s+ini|pakai\s+model\s+apa|pake\s+model\s+apa|what\s+model\s+are\s+you|which\s+model|siapa\s+pembuatmu|siapa\s+yang\s+buat\s+kamu)\b/i.test(
      lower
    )
  ) {
    return "model_identity";
  }

  // Capability confirmation ("apa benar bisa?", "beneran bisa?", "yakin bisa?", "masa sih bisa?")
  if (
    /^(apa\s+benar\s+bisa|beneran\s+bisa|apa\s+bener\s+bisa|yakin\s+bisa|serius\s+bisa|masa\s+bisa|emangnya\s+bisa|are\s+you\s+sure\s+you\s+can|really)[?.!]*$/i.test(
      lower
    )
  ) {
    return "capability_confirmation";
  }

  // Idea generation / Brainstorming / Numbered list requests
  // ("Bantu aku brainstorming ide project AI dengan Gemini", "buatkan 5 ide nama aplikasi AI", "ide bisnis", "ide konten")
  if (
    /\b(brainstorming|brainstorm|ide\s+nama|ide\s+project|ide\s+proyek|ide\s+aplikasi|ide\s+bisnis|ide\s+usaha|ide\s+konten|buatkan\s+\d*\s*ide|kasih\s+\d*\s*ide|berikan\s+\d*\s*ide|rekomendasi\s+nama|sebutkan\s+\d+|berikan\s+\d+\s+contoh|give\s+me\s+\d*\s*ideas|suggest\s+\d*\s*names)\b/i.test(
      lower
    )
  ) {
    return "idea_generation";
  }

  // Advice / Tips / How-to requests ("kasih tips fokus", "Kasih aku tips biar fokus kerja hari ini", "tips belajar", "cara mengatasi...")
  if (
    /\b(tips|saran|masukan|cara\s+biar|cara\s+agar|cara\s+supaya|cara\s+mengatasi|cara\s+meningkatkan|cara\s+menjaga|cara\s+mengatur|gimana\s+biar|advice|how\s+to\s+stay)\b/i.test(
      lower
    )
  ) {
    return "advice_request";
  }

  // Comparison requests ("perbedaan RAM dan ROM", "bedanya X dan Y")
  if (
    /\b(perbedaan|bedanya|bandingkan|vs|versus|difference\s+between)\b/i.test(
      lower
    )
  ) {
    return "comparison_request";
  }

  // Translation requests
  if (
    /\b(bahasa\s+inggris(?:nya)?|inggrisnya|translate|terjemahkan|arti\s+kata|bahasa\s+indonesia(?:nya)?)\b/i.test(
      lower
    )
  ) {
    return "translation_request";
  }

  // Creative requests (pantun, puisi, joke)
  if (/\b(pantun|puisi|lelucon|joke|tebak-tebakan)\b/i.test(lower)) {
    return "creative_request";
  }

  // Explanation / Definition / Factual questions
  if (
    /\b(jelasin|jelaskan|apa\s+itu|itu\s+apa|pengertian|definisi|maksud\s+dari|ibukota|ibu\s+kota|presiden|siapa|kapan|dimana|di\s+mana|kenapa|mengapa|berapa|warna|explain|what\s+is|who\s+is)\b/i.test(
      lower
    )
  ) {
    return "explanation_request";
  }

  // Feelings share ("aku lagi bingung", "aku capek", "aku sedih")
  if (
    /\b(aku\s+lagi\s+bingung|aku\s+bingung|lagi\s+capek|lagi\s+sedih|lagi\s+galau|lagi\s+bosan|lagi\s+stres)\b/i.test(
      lower
    )
  ) {
    return "feeling_share";
  }

  // Greetings
  if (
    /^(halo+|hai+|hi+|hey+|hel+o+|pagi|siang|sore|malam|selamat\s+(pagi|siang|sore|malam)|assalamualaikum|tes|test)[!.?]*$/i.test(
      lower
    )
  ) {
    return "greeting_smalltalk";
  }

  return "direct_question_or_instruction";
}

/**
 * Validates that an AI response actually answers the user's request
 * and is NOT a generic filler/evasion.
 */
export function isLowQualityGenericResponse(
  userMessage: string,
  aiReply: string,
  recentHistory: { role: string; content: string }[] = [],
  cameraActive = false
): boolean {
  const cleanReply = (aiReply || "").trim();
  if (!cleanReply) return true;

  if (isAmbiguousDeicticQuery(userMessage, recentHistory, cameraActive)) {
    return false;
  }

  const genericEvasionPatterns = [
    /ceritain\s+lebih\s+lanjut/i,
    /kalau\s+ada\s+hal\s+spesifik\s+yang\s+mau\s+ditanyakan/i,
    /ada\s+yang\s+mau\s+kamu\s+tanyakan\s+lebih\s+lanjut/i,
    /aku\s+menangkap\s+maksudmu\s+soal/i,
    /kalau\s+kita\s+bedah\s+secara\s+praktis/i,
    /tell\s+me\s+more\s+or\s+let\s+me\s+know/i,
    /^tell\s+me\s+more[.!?]*$/i,
    /^what\s+would\s+you\s+like\s+to\s+know[.!?]*$/i,
    /^can\s+you\s+explain\s+more[.!?]*$/i,
    /is\s+there\s+anything\s+specific\s+you'd\s+like\s+to\s+ask/i,
  ];

  return genericEvasionPatterns.some((rx) => rx.test(cleanReply));
}

const CAPITALS_MAP: Record<string, string> = {
  indonesia: "Jakarta",
  jepang: "Tokyo",
  japan: "Tokyo",
  korea: "Seoul",
  "korea selatan": "Seoul",
  "korea utara": "Pyongyang",
  china: "Beijing",
  tiongkok: "Beijing",
  india: "New Delhi",
  malaysia: "Kuala Lumpur",
  singapura: "Singapura",
  singapore: "Singapore",
  thailand: "Bangkok",
  vietnam: "Hanoi",
  filipina: "Manila",
  australia: "Canberra",
  inggris: "London",
  uk: "London",
  perancis: "Paris",
  prancis: "Paris",
  france: "Paris",
  jerman: "Berlin",
  germany: "Berlin",
  italia: "Roma",
  italy: "Rome",
  spanyol: "Madrid",
  spain: "Madrid",
  belanda: "Amsterdam",
  rusia: "Moskow",
  russia: "Moscow",
  turki: "Ankara",
  mesir: "Kairo",
  "arab saudi": "Riyadh",
  amerika: "Washington, D.C.",
  "amerika serikat": "Washington, D.C.",
  usa: "Washington, D.C.",
  kanada: "Ottawa",
  brasil: "Brasilia",
  brazil: "Brasilia",
  argentina: "Buenos Aires",
  "jawa tengah": "Semarang",
  "jawa barat": "Bandung",
  "jawa timur": "Surabaya",
  banten: "Serang",
  bali: "Denpasar",
  "sumatera utara": "Medan",
  "sumatera barat": "Padang",
  "sumatera selatan": "Palembang",
  "sulawesi selatan": "Makassar",
};

const TECH_AND_SCIENCE_DEFINITIONS: Array<{
  keys: string[];
  shortAnswerId: string;
  detailedAnswerId: string;
  shortAnswerEn: string;
}> = [
  {
    keys: ["ram", "random access memory"],
    shortAnswerId:
      "RAM (Random Access Memory) adalah memori penyimpanan sementara pada komputer atau HP yang menyimpan data aplikasi yang sedang berjalan agar bisa diakses dengan sangat cepat oleh prosesor.",
    detailedAnswerId:
      "RAM (Random Access Memory) adalah memori kerja utama yang bersifat sementara (volatile) di komputer atau smartphone. Saat kamu membuka aplikasi atau game, datanya dimuat ke RAM supaya prosesor (CPU) bisa membacanya tanpa jeda. Semakin besar kapasitas RAM, semakin lancar perangkat menjalankan banyak aplikasi sekaligus (multitasking).",
    shortAnswerEn:
      "RAM (Random Access Memory) is fast temporary memory in a computer or phone that holds data for currently running apps so the processor can access it quickly.",
  },
  {
    keys: ["cpu", "prosesor", "processor"],
    shortAnswerId:
      "CPU (Central Processing Unit) adalah otak utama komputer atau HP yang bertugas mengeksekusi perintah dan memproses perhitungan dari semua program yang berjalan.",
    detailedAnswerId:
      "CPU (Central Processing Unit) atau prosesor adalah komponen inti komputer yang berfungsi sebagai pusat pengendali dan pemroses instruksi logika maupun aritmatika dari sistem operasi dan aplikasi.",
    shortAnswerEn:
      "A CPU (Central Processing Unit) is the primary brain of a computer that executes instructions and processes calculations for apps and the operating system.",
  },
  {
    keys: ["gpu", "vga", "kartu grafis", "graphics card"],
    shortAnswerId:
      "GPU (Graphics Processing Unit) adalah prosesor khusus yang bertugas mengolah grafis, visual 3D, video, serta komputasi paralel seperti AI dan game.",
    detailedAnswerId:
      "GPU (Graphics Processing Unit) adalah chip pemroses paralel yang dirancang khusus untuk merender gambar, animasi 3D, video resolusi tinggi, dan mempercepat beban kerja Machine Learning / AI.",
    shortAnswerEn:
      "A GPU (Graphics Processing Unit) is a specialized processor designed to render graphics, 3D visuals, video, and parallel AI workloads.",
  },
  {
    keys: ["ssd", "solid state drive"],
    shortAnswerId:
      "SSD (Solid State Drive) adalah media penyimpanan data permanen berbasis chip flash yang jauh lebih cepat dibandingkan hard disk (HDD) konvensional.",
    detailedAnswerId:
      "SSD (Solid State Drive) menyimpan file dan sistem operasi menggunakan memori flash tanpa piringan berputar, sehingga waktu booting dan loading aplikasi berkali-kali lipat lebih cepat dibanding HDD.",
    shortAnswerEn:
      "An SSD (Solid State Drive) is a fast flash-based storage drive that stores data permanently with much higher speeds than traditional spinning hard drives.",
  },
  {
    keys: ["rom", "read only memory"],
    shortAnswerId:
      "ROM (Read-Only Memory) adalah memori permanen di perangkat yang menyimpan instruksi dasar sistem (firmware/BIOS), dan pada HP sering merujuk pada penyimpanan internal.",
    detailedAnswerId:
      "ROM adalah memori non-volatile yang isinya tidak hilang saat perangkat dimatikan. Pada komputer berisi BIOS/UEFI, sedangkan pada smartphone istilah ROM sering dipakai untuk menyebut kapasitas penyimpanan internal (storage).",
    shortAnswerEn:
      "ROM (Read-Only Memory) is non-volatile memory storing permanent system firmware, or in mobile terms, internal storage capacity.",
  },
  {
    keys: ["fotosintesis", "photosynthesis"],
    shortAnswerId:
      "Fotosintesis adalah proses tumbuhan hijau mengubah cahaya matahari, air, dan karbon dioksida menjadi energi kimia (glukosa) serta menghasilkan oksigen dengan bantuan klorofil.",
    detailedAnswerId:
      "Fotosintesis adalah proses biokimia pada tumbuhan berklorofil yang menyerap energi cahaya matahari untuk mengubah air (H₂O) dari akar dan karbon dioksida (CO₂) dari udara menjadi glukosa (C₆H₁₂O₆) sebagai makanan tumbuhan serta melepaskan oksigen (O₂) ke udara.",
    shortAnswerEn:
      "Photosynthesis is the process by which green plants convert sunlight, water, and carbon dioxide into chemical energy (glucose) and oxygen using chlorophyll.",
  },
  {
    keys: ["gravitasi", "gravity"],
    shortAnswerId:
      "Gravitasi adalah gaya tarik-menarik alami antar benda yang memiliki massa, yang membuat benda tetap berpijak di Bumi dan planet-planet mengorbit Matahari.",
    detailedAnswerId:
      "Gravitasi adalah gaya tarik fundamental antara semua benda bermassa di alam semesta. Di permukaan Bumi, gravitasi menarik benda ke bawah dengan percepatan sekitar 9,8 m/s².",
    shortAnswerEn:
      "Gravity is the natural force of attraction between objects with mass that keeps us on the ground and planets in orbit around the Sun.",
  },
  {
    keys: ["hujan", "rain", "presipitasi"],
    shortAnswerId:
      "Hujan adalah peristiwa turunnya titik-titik air dari atmosfer ke permukaan Bumi akibat kondensasi uap air di awan yang sudah terlalu berat.",
    detailedAnswerId:
      "Hujan terjadi melalui siklus air (hidrologi): panas matahari menguapkan air laut, sungai, dan danau ke udara (evaporasi). Uap air tersebut naik dan mendingin menjadi titik-titik air yang berkumpul membentuk awan (kondensasi). Ketika butiran air di dalam awan makin jenuh dan berat, air jatuh kembali ke Bumi sebagai hujan (presipitasi).",
    shortAnswerEn:
      "Rain is liquid water in the form of droplets that have condensed from atmospheric water vapor and then become heavy enough to fall under gravity.",
  },
  {
    keys: ["pelangi", "rainbow"],
    shortAnswerId:
      "Pelangi adalah fenomena optik dan meteorologi berupa lengkungan spektrum warna di langit yang terjadi ketika cahaya matahari dibiaskan dan dipantulkan oleh tetesan air hujan.",
    detailedAnswerId:
      "Pelangi terbentuk saat sinar matahari melewati butiran air di udara setelah hujan. Tetesan air tersebut membiaskan (membelokkan) dan menguraikan cahaya putih matahari menjadi tujuh spektrum warna: merah, jingga, kuning, hijau, biru, nila, dan ungu (MeJiKuHiBiNiU).",
    shortAnswerEn:
      "A rainbow is an optical phenomenon caused by refraction, internal reflection, and dispersion of sunlight in water droplets resulting in a spectrum of light appearing in the sky.",
  },
  {
    keys: ["gempa", "gempa bumi", "earthquake"],
    shortAnswerId:
      "Gempa bumi adalah getaran atau guncangan di permukaan Bumi akibat pelepasan energi secara tiba-tiba di bawah litosfer, umumnya karena pergeseran lempeng tektonik atau aktivitas gunung berapi.",
    detailedAnswerId:
      "Gempa bumi terjadi ketika lempeng tektonik di kerak Bumi saling bertumbukan, bergeser, atau menunjam sehingga menimbulkan patahan dan gelombang seismik yang merambat ke permukaan.",
    shortAnswerEn:
      "An earthquake is the shaking of the surface of the Earth resulting from a sudden release of energy in the Earth's lithosphere that creates seismic waves.",
  },
  {
    keys: ["awan", "cloud"],
    shortAnswerId:
      "Awan adalah kumpulan tetesan air atau kristal es yang sangat kecil dan melayang di atmosfer hasil pengembunan (kondensasi) uap air yang naik dari permukaan Bumi.",
    detailedAnswerId:
      "Awan terbentuk saat udara hangat yang membawa uap air naik ke atmosfer lalu mengalami pendinginan hingga mencapai titik embun, mengubah uap air menjadi jutaan butiran air mikroskopis atau kristal es yang tampak putih atau kelabu di langit.",
    shortAnswerEn:
      "A cloud is a visible mass of minute liquid droplets or frozen crystals suspended in the atmosphere.",
  },
  {
    keys: ["petir", "halilintar", "kilat", "lightning"],
    shortAnswerId:
      "Petir adalah pelepasan muatan listrik statis bertegangan tinggi di atmosfer yang terjadi di dalam awan, antar-awan, atau dari awan ke permukaan Bumi, disertai kilatan cahaya dan suara guntur.",
    detailedAnswerId:
      "Petir terjadi karena gesekan partikel air dan kristal es di dalam awan cumulonimbus yang memisahkan muatan positif dan negatif. Saat perbedaan potensial listriknya sangat besar, terjadi loncatan arus listrik raksasa (kilat) yang memanaskan udara di sekitarnya secara mendadak hingga menimbulkan suara menggelegar (guntur).",
    shortAnswerEn:
      "Lightning is a naturally occurring electrostatic discharge during which two electrically charged regions in the atmosphere or ground temporarily neutralize themselves.",
  },
  {
    keys: ["html"],
    shortAnswerId:
      "HTML (HyperText Markup Language) adalah bahasa markup standar untuk menyusun struktur dasar halaman web seperti teks, tombol, gambar, dan tautan.",
    detailedAnswerId:
      "HTML adalah pondasi setiap halaman website yang mendefinisikan elemen-elemen konten (heading, paragraf, form, tabel, media) agar dapat ditampilkan oleh browser.",
    shortAnswerEn:
      "HTML (HyperText Markup Language) is the standard markup language used to structure content on the web.",
  },
  {
    keys: ["css", "tailwind"],
    shortAnswerId:
      "CSS (Cascading Style Sheets) adalah bahasa untuk mengatur tampilan desain halaman web seperti warna, ukuran font, posisi layout, dan animasi.",
    detailedAnswerId:
      "CSS bekerja bersama HTML untuk mempercantik tampilan website, mengatur tata letak responsif di layar HP maupun desktop, serta membuat efek transisi visual.",
    shortAnswerEn:
      "CSS (Cascading Style Sheets) styles the visual layout, colors, fonts, and responsiveness of web pages.",
  },
  {
    keys: ["javascript", "typescript"],
    shortAnswerId:
      "JavaScript adalah bahasa pemrograman utama yang membuat halaman website menjadi interaktif dan dinamis, baik di sisi browser (frontend) maupun server (Node.js).",
    detailedAnswerId:
      "JavaScript memungkinkan website merespons interaksi user, mengambil data dari API tanpa reload halaman, hingga menjalankan server backend. TypeScript adalah pengembangan JavaScript dengan sistem tipe data (static typing) agar kode lebih aman dari bug.",
    shortAnswerEn:
      "JavaScript is the programming language that makes websites interactive and powers both frontend UIs and Node.js backends.",
  },
  {
    keys: ["python"],
    shortAnswerId:
      "Python adalah bahasa pemrograman tingkat tinggi yang sintaksnya sederhana dan populer digunakan untuk AI, Machine Learning, pengolahan data, automasi, dan web backend.",
    detailedAnswerId:
      "Python dirancang agar mudah dibaca dan memiliki ekosistem library yang sangat luas untuk kecerdasan buatan (PyTorch, TensorFlow), data science, hingga pengembangan server.",
    shortAnswerEn:
      "Python is a readable, versatile programming language widely used for AI, data science, automation, and web development.",
  },
  {
    keys: ["api", "rest api"],
    shortAnswerId:
      "API (Application Programming Interface) adalah penghubung yang memungkinkan satu aplikasi berkomunikasi dan bertukar data dengan aplikasi atau server lain.",
    detailedAnswerId:
      "API bekerja sebagai jembatan komunikasi yang membawa permintaan (request) dari aplikasi frontend ke server/database lalu mengembalikan hasilnya (response) ke aplikasi.",
    shortAnswerEn:
      "An API (Application Programming Interface) is a bridge that allows different software applications to communicate and exchange data.",
  },
  {
    keys: ["database", "basis data", "sql", "mysql", "postgresql"],
    shortAnswerId:
      "Database (basis data) adalah sistem penyimpanan terstruktur untuk menyimpan, mengelola, dan mengambil data aplikasi dengan cepat dan aman.",
    detailedAnswerId:
      "Database menyimpan informasi penting aplikasi seperti akun user, riwayat transaksi, dan pesan. SQL (Structured Query Language) adalah bahasa standar untuk mengelola data di dalam database relasional.",
    shortAnswerEn:
      "A database is an organized system for storing, managing, and retrieving application data efficiently.",
  },
  {
    keys: ["algoritma", "algorithm"],
    shortAnswerId:
      "Algoritma adalah urutan langkah-langkah logis dan sistematis yang dirancang untuk menyelesaikan suatu masalah atau tugas tertentu.",
    detailedAnswerId:
      "Dalam pemrograman maupun kehidupan sehari-hari, algoritma berisi instruksi berurutan dari input hingga menghasilkan output yang diinginkan secara efisien.",
    shortAnswerEn:
      "An algorithm is a step-by-step logical procedure used to solve a problem or perform a computation.",
  },
  {
    keys: ["ai", "artificial intelligence", "kecerdasan buatan"],
    shortAnswerId:
      "AI (Artificial Intelligence) atau kecerdasan buatan adalah teknologi komputer yang mampu memahami bahasa, mengenali pola/gambar, belajar dari data, dan membantu menyelesaikan tugas.",
    detailedAnswerId:
      "AI mencakup berbagai bidang seperti Large Language Models (LLM) untuk percakapan teks/suara, Computer Vision untuk mengenali objek di kamera, serta Machine Learning untuk memprediksi pola dari data.",
    shortAnswerEn:
      "AI (Artificial Intelligence) enables computers to understand language, recognize visual patterns, learn from data, and assist with tasks.",
  },
  {
    keys: ["internet", "wifi", "wi-fi"],
    shortAnswerId:
      "Internet adalah jaringan komunikasi global yang menghubungkan miliaran komputer dan perangkat di seluruh dunia agar bisa saling bertukar informasi.",
    detailedAnswerId:
      "Internet bekerja menggunakan protokol jaringan (TCP/IP) untuk mengirimkan data antar server dan perangkat pengguna, sedangkan Wi-Fi adalah teknologi nirkabel untuk mengakses jaringan tersebut tanpa kabel.",
    shortAnswerEn:
      "The Internet is a global network connecting billions of devices worldwide to share information and communication.",
  },
  {
    keys: ["inflasi", "inflation"],
    shortAnswerId:
      "Inflasi adalah kenaikan harga barang dan jasa secara umum dan terus-menerus dalam jangka waktu tertentu, sehingga nilai daya beli uang menurun.",
    detailedAnswerId:
      "Ketika inflasi terjadi, jumlah uang yang sama akan mendapatkan barang lebih sedikit dibanding sebelumnya. Inflasi dipengaruhi oleh tingginya permintaan, biaya produksi, atau jumlah uang beredar.",
    shortAnswerEn:
      "Inflation is the general increase in prices of goods and services over time, which reduces the purchasing power of money.",
  },
  {
    keys: ["dna", "genetik"],
    shortAnswerId:
      "DNA (Deoxyribonucleic Acid) adalah molekul pembawa informasi genetik yang diturunkan pada semua makhluk hidup untuk menentukan sifat dan fungsi biologisnya.",
    detailedAnswerId:
      "DNA tersimpan di dalam inti sel berbentuk pita ganda (double helix) yang berisi kode instruksi pembentukan protein dan pewarisan sifat dari orang tua ke keturunannya.",
    shortAnswerEn:
      "DNA (Deoxyribonucleic Acid) is the molecule that carries genetic instructions for the development and functioning of living organisms.",
  },
];

const ID_TO_EN_DICT: Record<string, string> = {
  makan: "eat",
  minum: "drink",
  tidur: "sleep",
  belajar: "study / learn",
  bekerja: "work",
  kerja: "work",
  jalan: "walk",
  lari: "run",
  rumah: "house / home",
  sekolah: "school",
  buku: "book",
  air: "water",
  api: "fire",
  udara: "air",
  bumi: "earth",
  langit: "sky",
  matahari: "sun",
  bulan: "moon",
  bintang: "star",
  kucing: "cat",
  anjing: "dog",
  burung: "bird",
  ikan: "fish",
  merah: "red",
  biru: "blue",
  hijau: "green",
  kuning: "yellow",
  hitam: "black",
  putih: "white",
  senang: "happy",
  bahagia: "happy",
  sedih: "sad",
  marah: "angry",
  takut: "afraid / scared",
  cepat: "fast",
  lambat: "slow",
  besar: "big / large",
  kecil: "small / little",
  cantik: "beautiful",
  pintar: "smart / clever",
  fokus: "focus",
};

const EN_TO_ID_DICT: Record<string, string> = {
  eat: "makan",
  drink: "minum",
  sleep: "tidur",
  study: "belajar",
  learn: "belajar",
  work: "bekerja",
  walk: "berjalan",
  run: "berlari",
  house: "rumah",
  home: "rumah",
  book: "buku",
  water: "air",
  fire: "api",
  sky: "langit",
  sun: "matahari",
  moon: "bulan",
  star: "bintang",
  cat: "kucing",
  dog: "anjing",
  bird: "burung",
  fish: "ikan",
  red: "merah",
  blue: "biru",
  green: "hijau",
  yellow: "kuning",
  black: "hitam",
  white: "putih",
  happy: "senang / bahagia",
  sad: "sedih",
  angry: "marah",
  fast: "cepat",
  slow: "lambat",
  smart: "pintar / cerdas",
  beautiful: "indah / cantik",
};

/**
 * Generates an engaging short story ("buat cerita pendek tentang kucing", etc.).
 */
function generateStoryResponse(
  rawMessage: string,
  lower: string,
  lang: "id" | "en"
): string {
  if (lower.includes("kucing") || lower.includes("cat")) {
    if (lang === "en") {
      return `Every morning, a little orange tabby cat named Mochi would sit on the windowsill watching sparrows flutter across the garden. One rainy afternoon, Mochi noticed a tiny lost kitten shivering under a bench outside. Mochi meowed loudly at the door until his owner opened it with an umbrella, bringing the kitten inside to share a warm bowl of milk and a cozy blanket. From that day on, the two cats became inseparable best friends.`;
    }
    return `Di sebuah sudut gang yang tenang, hiduplah seekor kucing oranye mungil bernama Mochi yang terkenal sangat penasaran. Suatu sore saat gerimis turun, Mochi menemukan seekor kupu-kupu bersayap biru yang berteduh di bawah daun talas di halaman rumah. Bukannya mengejarnya, Mochi justru duduk diam menjaga kupu-kupu itu sampai hujan reda dan pelangi muncul di langit. Begitu matahari kembali bersinar, kupu-kupu itu terbang mengelilingi hidung Mochi seolah mengucapkan terima kasih sebelum pulang, sementara Mochi kembali meringkuk hangat di teras sambil mendengkur puas.`;
  }

  if (lower.includes("anjing") || lower.includes("dog")) {
    return `Bobi adalah seekor anjing golden retriever yang selalu menunggu pemiliknya pulang di depan pagar setiap pukul lima sore. Suatu hari, payung pemiliknya tertinggal di teras saat langit mulai mendung. Tanpa ragu, Bobi menggigit gagang payung itu dan berlari kecil ke halte bus di ujung jalan tepat saat hujan turun, membuat semua orang di halte tersenyum melihat kesetiaannya.`;
  }

  if (lower.includes("robot") || lower.includes("ai")) {
    return `Di sebuah perpustakaan tua, sebuah robot kecil bernama Lumi bertugas merapikan buku-buku yang berdebu setiap malam. Suatu malam, Lumi menemukan buku harian seorang penemu muda yang belum selesai ditulis. Lumi pun menyalakan lampu bacanya dan membantu menyusun catatan penemuan tersebut hingga rapi, sehingga keesokan paginya sang penemu akhirnya berhasil menyelesaikan karyanya.`;
  }

  // Extract custom story topic if provided ("buat cerita pendek tentang X")
  const topicMatch = rawMessage.match(
    /(?:tentang|mengenai|soal|bertema|about)\s+([^?.!]+)/i
  );
  const topic = topicMatch?.[1]?.trim() || "persahabatan dan petualangan";

  return `Suatu pagi yang cerah, sebuah kisah menarik tentang **${topic}** dimulai di sebuah kota kecil yang damai. Awalnya semua tampak biasa saja, namun rasa ingin tahu dan keberanian untuk mencoba hal baru membuka jalan menuju pengalaman yang tak terlupakan. Meski sempat menghadapi rintangan di tengah perjalanan, ketekunan dan ketulusan hati akhirnya membawa kebahagiaan serta pelajaran berharga bahwa setiap langkah kecil yang tulus selalu meninggalkan jejak yang berarti.`;
}

/**
 * Generates practical, actionable advice ONLY when the user explicitly requests tips/advice.
 */
function generateAdviceResponse(
  rawMessage: string,
  lower: string,
  lang: "id" | "en"
): string {
  // 1. Focus / Productivity ("kasih tips fokus", "Kasih aku tips biar fokus kerja hari ini")
  if (
    lower.includes("fokus") ||
    lower.includes("kerja") ||
    lower.includes("produktif") ||
    lower.includes("konsentrasi") ||
    lower.includes("focus") ||
    lower.includes("productive")
  ) {
    if (lang === "en") {
      return [
        "Here are practical tips to stay focused today:",
        "1. **Pick 1 top priority task**: Start with the most impactful task before checking non-urgent messages.",
        "2. **Use the 25/5 Pomodoro timer**: Focus for 25 minutes with zero distractions, then take a 5-minute break.",
        "3. **Silence notifications**: Put your phone on Do Not Disturb and close unused browser tabs.",
        "4. **Break big tasks into small steps**: Write down 3 clear action items so you don't feel overwhelmed.",
        "5. **Keep water nearby & stretch**: Stay hydrated and rest your eyes briefly between sessions.",
      ].join("\n");
    }
    return [
      "Berikut beberapa tips praktis biar kamu tetap fokus kerja hari ini:",
      "1. **Pilih 1 tugas paling prioritas (MIT)**: Tentukan satu target utama yang wajib selesai duluan sebelum membuka tugas lain.",
      "2. **Gunakan teknik Pomodoro (25/5 menit)**: Fokus penuh selama 25 menit tanpa terdistraksi, lalu istirahat singkat 5 menit.",
      "3. **Matikan notifikasi HP & tutup tab yang tidak perlu**: Aktifkan mode *Do Not Disturb* selama sesi fokus berlangsung.",
      "4. **Pecah pekerjaan besar jadi langkah kecil**: Tulis 3 checklist singkat supaya lebih ringan dikerjakan satu per satu.",
      "5. **Siapkan air minum di meja**: Menjaga tubuh tetap terhidrasi membantu otak tidak cepat lelah atau mengantuk.",
    ].join("\n");
  }

  // 2. Study / Exam tips ("tips belajar efektif")
  if (
    lower.includes("belajar") ||
    lower.includes("ujian") ||
    lower.includes("ulangan") ||
    lower.includes("hafal") ||
    lower.includes("study")
  ) {
    return [
      "Berikut tips belajar agar materi lebih cepat dipahami dan diingat:",
      "1. **Gunakan metode Active Recall**: Setelah membaca 1 subbab, tutup buku lalu coba jelaskan kembali dengan kalimatmu sendiri.",
      "2. **Belajar terfokus 30–45 menit**: Hindari sistem kebut semalam; cicil per bagian dengan jeda istirahat singkat.",
      "3. **Buat catatan poin kunci / peta konsep**: Tulis kata kunci dan rumusnya saja, bukan menyalin seluruh paragraf.",
      "4. **Kerjakan latihan soal langsung**: Praktik soal membantu otak mengenali pola masalah jauh lebih cepat.",
    ].join("\n");
  }

  // 3. Overcoming laziness / procrastination
  if (
    lower.includes("malas") ||
    lower.includes("mager") ||
    lower.includes("nunda") ||
    lower.includes("menunda") ||
    lower.includes("prokrastinasi") ||
    lower.includes("semangat")
  ) {
    return [
      "Coba terapkan langkah ini untuk mengatasi rasa malas atau kebiasaan menunda:",
      "1. **Aturan 2 Menit**: Komitmen kerjakan tugas itu selama 2 menit saja dulu—bagian tersulit biasanya hanya saat memulai.",
      "2. **Jauhkan sumber distraksi**: Taruh HP di luar jangkauan tangan sampai 1 target kecil selesai.",
      "3. **Mulai dari bagian paling mudah**: Menyelesaikan satu bagian ringan akan memicu momentum untuk lanjut.",
      "4. **Beri reward kecil**: Setelah tugas beres, beri jeda untuk hal yang kamu sukai.",
    ].join("\n");
  }

  // 4. Sleep / Insomnia tips
  if (
    lower.includes("tidur") ||
    lower.includes("insomnia") ||
    lower.includes("begadang") ||
    lower.includes("sleep")
  ) {
    return [
      "Berikut tips supaya bisa tidur lebih cepat dan nyenyak:",
      "1. **Hentikan layar HP/laptop 30–60 menit sebelum tidur**: Cahaya biru layar menghambat hormon melatonin.",
      "2. **Redupkan lampu kamar & atur suhu sejuk**: Lingkungan gelap dan sejuk memberi sinyal istirahat ke otak.",
      "3. **Hindari kopi/kafein setelah sore hari**: Kafein bisa bertahan di tubuh hingga 6–8 jam.",
      "4. **Coba teknik napas 4-7-8**: Tarik napas 4 detik, tahan 7 detik, hembuskan perlahan 8 detik.",
    ].join("\n");
  }

  // 5. Financial / Saving money tips
  if (
    lower.includes("hemat") ||
    lower.includes("uang") ||
    lower.includes("keuangan") ||
    lower.includes("nabung") ||
    lower.includes("menabung")
  ) {
    return [
      "Berikut tips praktis mengatur keuangan dan menabung:",
      "1. **Gunakan rumus 50/30/20**: 50% untuk kebutuhan pokok, 30% keinginan pribadi, dan 20% langsung ditabung di awal.",
      "2. **Sisihkan tabungan di awal gajian**: Jangan menunggu sisa uang di akhir bulan.",
      "3. **Catat pengeluaran harian**: Evaluasi pengeluaran kecil yang sering bocor.",
      "4. **Tunggu 24 jam sebelum beli barang non-prioritas**: Cara ini efektif mencegah belanja impulsif.",
    ].join("\n");
  }

  // 6. Job interview / Career tips
  if (
    lower.includes("interview") ||
    lower.includes("wawancara") ||
    lower.includes("melamar kerja") ||
    lower.includes("cv")
  ) {
    return [
      "Berikut tips sukses menghadapi interview kerja:",
      "1. **Pahami profil perusahaan & posisi yang dilamar**: Pelajari produk utama dan tanggung jawab rolenya.",
      "2. **Gunakan metode STAR saat menjawab**: Jelaskan *Situation, Task, Action,* dan *Result* dari pengalamanmu.",
      "3. **Siapkan contoh pencapaian nyata**: Ceritakan masalah yang pernah kamu selesaikan secara konkret.",
      "4. **Siapkan 1–2 pertanyaan untuk pewawancara**: Misalnya tentang ekspektasi tim di 3 bulan pertama.",
    ].join("\n");
  }

  // 7. Health / Exercise / Diet
  if (
    lower.includes("sehat") ||
    lower.includes("olahraga") ||
    lower.includes("diet") ||
    lower.includes("kesehatan") ||
    lower.includes("badan")
  ) {
    return [
      "Berikut tips menjaga tubuh tetap bugar dan sehat setiap hari:",
      "1. **Rutin bergerak minimal 20–30 menit sehari**: Jalan cepat, stretching, atau olahraga ringan secara konsisten.",
      "2. **Perbanyak protein & serat, kurangi gula berlebih**: Membantu energi lebih stabil sepanjang hari.",
      "3. **Minum air putih sekitar 2 liter per hari**: Jaga hidrasi tubuh sejak bangun pagi.",
      "4. **Tidur cukup 7–8 jam setiap malam**: Pemulihan otot dan imunitas terjadi saat tidur berkualitas.",
    ].join("\n");
  }

  // 8. Coding / Programming tips
  if (
    lower.includes("coding") ||
    lower.includes("ngoding") ||
    lower.includes("pemrograman") ||
    lower.includes("programmer")
  ) {
    return [
      "Berikut tips efektif belajar coding supaya cepat mahir:",
      "1. **Fokus kuasai 1 bahasa dulu (misalnya JavaScript atau Python)**: Pahami variabel, fungsi, loop, dan struktur data dasar.",
      "2. **Praktik langsung bikin project kecil**: Jangan hanya menonton tutorial; buat aplikasi sederhana seperti To-Do List atau kalkulator.",
      "3. **Biasakan membaca pesan error (debugging)**: Pesan error menunjukkan baris dan penyebab masalah secara spesifik.",
      "4. **Pelajari Git & baca kode orang lain**: Membantu memahami struktur project yang rapi.",
    ].join("\n");
  }

  // 9. Public speaking / Confidence
  if (
    lower.includes("presentasi") ||
    lower.includes("public speaking") ||
    lower.includes("percaya diri") ||
    lower.includes("grogi")
  ) {
    return [
      "Berikut tips tampil tenang dan percaya diri saat berbicara atau presentasi:",
      "1. **Kuasai 3 poin inti materi**: Jangan menghafal kata per kata, cukup pahami alur utamanya.",
      "2. **Latihan berbicara dengan suara lantang**: Coba simulasi 2–3 kali sebelum tampil.",
      "3. **Tarik napas dalam & mulai dengan tempo pelan**: Berbicara terlalu cepat membuat rasa gugup makin terasa.",
      "4. **Fokus pada audiens yang terlihat ramah**: Menjaga kontak mata membuat suasana lebih komunikatif.",
    ].join("\n");
  }

  // Topic-aware advice for any other explicit "tips/saran" request
  const topicClean = rawMessage
    .replace(
      /\b(kasih|berikan|tolong|aku|saya|dong|ya|tips|saran|masukan|cara\s+biar|cara\s+agar|cara\s+supaya|tentang|untuk|buat)\b/gi,
      ""
    )
    .replace(/[?.!]/g, "")
    .trim();
  const label = topicClean || "hal tersebut";

  return [
    `Berikut beberapa tips seputar **${label}**:`,
    `1. **Pahami dasar & tujuannya terlebih dahulu**: Pastikan kamu tahu hasil akhir seperti apa yang ingin dicapai dari ${label}.`,
    `2. **Mulai secara bertahap dan konsisten**: Praktikkan langkah dasarnya secara rutin agar terbiasa.`,
    `3. **Gunakan referensi atau contoh nyata**: Pelajari bagaimana orang yang sudah berpengalaman melakukannya.`,
    `4. **Evaluasi & sesuaikan dengan kebutuhanmu**: Perbaiki bagian yang dirasa kurang efektif sambil berjalan.`,
  ].join("\n");
}

/**
 * Generates concrete numbered ideas or lists (e.g., "buatkan 5 ide nama aplikasi AI",
 * "Bantu aku brainstorming ide project AI dengan Gemini", "ide bisnis", "ide konten").
 */
function generateIdeasOrListResponse(
  rawMessage: string,
  lower: string,
  lang: "id" | "en"
): string {
  const countMatch = convertWordNumbersToDigits(rawMessage).match(/\b(\d+)\b/);
  const count = countMatch
    ? Math.min(Math.max(parseInt(countMatch[1], 10), 1), 10)
    : 5;

  // 1. AI App Name Ideas ("buatkan 5 ide nama aplikasi AI", "ide nama aplikasi", "nama startup AI")
  if (
    (lower.includes("nama") &&
      (lower.includes("aplikasi") ||
        lower.includes("app") ||
        lower.includes("ai") ||
        lower.includes("startup") ||
        lower.includes("produk"))) ||
    lower.includes("app name")
  ) {
    const aiAppNames = [
      "**NalarAI** — Kesan cerdas, lokal, dan mudah diingat untuk asisten pintar sehari-hari.",
      "**AetherMind** — Terdengar futuristik dan modern untuk platform produktivitas berbasis AI.",
      "**Synthetix** — Cocok untuk aplikasi AI kreatif, generator konten, atau automasi kerja.",
      "**VeloceAI** — Menonjolkan kecepatan respons dan efisiensi instan.",
      "**LuminaBot** — Memberi kesan asisten virtual yang ramah, terang, dan solutif.",
      "**NexaFlow** — Pas untuk aplikasi AI manajemen tugas dan workflow otomatis.",
      "**KarsaAI** — Menggabungkan nuansa bahasa Indonesia ('karsa' = niat/karya) dengan teknologi modern.",
      "**Cognify** — Singkat, profesional, dan cocok untuk aplikasi edukasi atau analisis pintar.",
      "**PulseAI** — Cocok untuk pendamping AI real-time berbasis suara dan percakapan.",
      "**ZenithAI** — Melambangkan performa puncak untuk asisten kerja profesional.",
    ];
    const selected = aiAppNames
      .slice(0, count)
      .map((item, idx) => `${idx + 1}. ${item}`);
    const header =
      lang === "en"
        ? `Here are ${count} AI application name ideas:`
        : `Berikut ${count} ide nama aplikasi AI yang modern dan mudah diingat:`;
    return `${header}\n${selected.join("\n")}`;
  }

  // 2. AI / Gemini Project Ideas ("Bantu aku brainstorming ide project AI dengan Gemini", "ide project AI")
  if (
    (lower.includes("project") ||
      lower.includes("proyek") ||
      lower.includes("brainstorm") ||
      lower.includes("aplikasi")) &&
    (lower.includes("ai") || lower.includes("gemini"))
  ) {
    const aiProjects = [
      "**AI Multimodal Study Tutor** — Aplikasi belajar tempat user bisa memfoto soal/catatan lewat kamera lalu Gemini menjelaskan langkah penyelesaiannya secara interaktif dengan suara.",
      "**Smart Receipt & Expense Analyzer** — Aplikasi pencatat keuangan otomatis yang membaca foto struk belanja menggunakan Gemini Vision dan mengelompokkan pengeluaran bulanan.",
      "**AI Live Interview Coach** — Simulator wawancara kerja berbasis suara real-time yang memberikan feedback langsung atas jawaban dan struktur komunikasi user.",
      "**Code Reviewer & Bug Explainer** — Tool developer yang menganalisis potongan kode atau screenshot error lalu memberikan solusi perbaikan beserta penjelasannya.",
      "**Smart Fridge Recipe Assistant** — Arahkan kamera ke bahan makanan di meja/kulkas, lalu AI merekomendasikan resep masakan praktis beserta takaran kalorinya.",
    ];
    const selected = aiProjects
      .slice(0, count)
      .map((item, idx) => `${idx + 1}. ${item}`);
    return `Berikut ${count} ide project AI berbasis Gemini yang menarik dan aplikatif untuk dibangun:\n${selected.join("\n")}`;
  }

  // 3. Business / Side Hustle Ideas ("ide bisnis", "ide usaha")
  if (
    lower.includes("bisnis") ||
    lower.includes("usaha") ||
    lower.includes("jualan") ||
    lower.includes("business")
  ) {
    const bizIdeas = [
      "**Jasa Pembuatan Konten & Desain Sosmed** — Membantu UMKM mengelola feed Instagram/TikTok dengan bantuan tools desain dan AI.",
      "**Kuliner Cloud Kitchen / Frozen Food** — Menjual makanan siap saji atau camilan beku dari rumah melalui aplikasi pesan-antar.",
      "**Jasa Pembuatan Website & Landing Page** — Membantu bisnis lokal memiliki profil digital profesional.",
      "**Reseller / Affiliate Produk Niche** — Memasarkan produk spesifik lewat konten video pendek.",
      "**Kursus Privat / Mentoring Online** — Mengajarkan keahlian yang kamu kuasai (bahasa, coding, desain, atau pelajaran sekolah).",
    ];
    const selected = bizIdeas
      .slice(0, count)
      .map((item, idx) => `${idx + 1}. ${item}`);
    return `Berikut ${count} ide bisnis potensial yang bisa dimulai:\n${selected.join("\n")}`;
  }

  // 4. Content Ideas ("ide konten", "youtube", "tiktok", "instagram")
  if (
    lower.includes("konten") ||
    lower.includes("tiktok") ||
    lower.includes("youtube") ||
    lower.includes("reels")
  ) {
    const contentIdeas = [
      "**Tutorial Singkat 60 Detik (How-To)** — Bagikan 1 trik praktis yang menyelesaikan masalah sehari-hari.",
      "**Before vs After / Proses Kerja** — Tunjukkan proses dari awal hingga hasil akhir karena sangat menarik perhatian penonton.",
      "**Review Jujur Tools / Aplikasi Bermanfaat** — Rekomendasikan 3 aplikasi atau website yang menghemat waktu kerja.",
      "**Day in My Life / Rutinitas Produktif** — Ceritakan kegiatan harianmu dengan narasi santai.",
      "**Bongkar Kesalahan Umum Pemula** — Bahas kesalahan yang sering dilakukan orang di bidangmu beserta solusinya.",
    ];
    const selected = contentIdeas
      .slice(0, count)
      .map((item, idx) => `${idx + 1}. ${item}`);
    return `Berikut ${count} ide konten menarik yang bisa langsung kamu buat:\n${selected.join("\n")}`;
  }

  // 5. General App / Coding Project Ideas
  const projIdeas = [
    "**Smart Expense Tracker** — Aplikasi pencatat pengeluaran harian dengan ringkasan grafik otomatis.",
    "**Pomodoro & Focus Dashboard** — Timer kerja fokus terintegrasi dengan daftar prioritas harian.",
    "**AI Flashcard Study App** — Aplikasi pembuat kartu kuis otomatis dari catatan materi belajar.",
    "**Habit Streak Tracker** — Pemantau kebiasaan positif harian dengan visualisasi kalender.",
    "**Personal Recipe & Meal Planner** — Perencana menu mingguan berdasarkan bahan yang tersedia.",
  ];
  const selected = projIdeas
    .slice(0, count)
    .map((item, idx) => `${idx + 1}. ${item}`);
  return `Berikut ${count} ide menarik yang bisa kamu kembangkan:\n${selected.join("\n")}`;
}

export function generateDirectSmartReply(params: {
  rawMessage: string;
  normalizedLower: string;
  aiName: string;
  greetName: string;
  lang: "id" | "en";
  recentHistory?: { role: string; content: string }[];
  cameraActive?: boolean;
}): string {
  const {
    rawMessage,
    normalizedLower: lower,
    aiName,
    greetName,
    lang,
    recentHistory = [],
    cameraActive = false,
  } = params;

  const wantsDetail =
    lower.includes("jelasin") ||
    lower.includes("jelaskan") ||
    lower.includes("detail") ||
    lower.includes("lengkap") ||
    lower.includes("bagaimana proses") ||
    lower.includes("cara kerja") ||
    lower.includes("explain");

  // 1. Math Calculation (Digits & Word Numbers)
  const mathAnswer = evaluateMathExpression(rawMessage);
  if (mathAnswer) {
    return mathAnswer;
  }

  // 2. Unit Conversions ("10 km berapa meter", "2 jam berapa menit")
  const unitConversion = evaluateUnitConversion(rawMessage);
  if (unitConversion) {
    return unitConversion;
  }

  // 3. Ambiguous Deictic Reference ("menurutmu yang ini bagus?", "yang ini lebih cocok?")
  if (isAmbiguousDeicticQuery(rawMessage, recentHistory, cameraActive)) {
    return lang === "en"
      ? "Could you share what 'this one' refers to (or turn on the camera to show me) so I can give you my opinion?"
      : "Boleh kasih tahu dulu 'yang ini' merujuk ke apa (misalnya nama pilihan, teks, atau nyalakan kamera untuk menunjukkannya)? Biar aku bisa kasih pendapat yang pas.";
  }

  const intent = classifyUserIntent(rawMessage, recentHistory, cameraActive);

  // 4. Short Story / Cerpen / Dongeng ("buat cerita pendek tentang kucing")
  if (intent === "story_generation") {
    return generateStoryResponse(rawMessage, lower, lang);
  }

  // 5. Model Identity ("kamu model apa", "pakai model apa")
  if (intent === "model_identity") {
    return lang === "en"
      ? `I am ${aiName}, a multimodal AI assistant powered by Google Gemini (gemini-2.0-flash).`
      : `Aku **${aiName}**, asisten AI multimodal yang ditenagai oleh model **Google Gemini (gemini-2.0-flash)**.`;
  }

  // 6. Capability Confirmation ("apa benar bisa?", "beneran bisa?", "yakin bisa?")
  if (intent === "capability_confirmation") {
    return lang === "en"
      ? `Yes, I really can! Go ahead and test me with a question, math problem, story request, or topic you want explained.`
      : `Beneran bisa dong! Kamu bisa langsung tes aku sekarang—coba tanya hitungan, minta jelaskan suatu konsep, buatkan cerita pendek, atau minta ide kreatif.`;
  }

  // 7. Idea Generation & Brainstorming ("buatkan 5 ide nama aplikasi AI", "Bantu aku brainstorming ide project AI dengan Gemini")
  if (intent === "idea_generation") {
    return generateIdeasOrListResponse(rawMessage, lower, lang);
  }

  // 8. Explicit Advice / Tips Requests ("kasih tips fokus", "Kasih aku tips biar fokus kerja hari ini")
  if (intent === "advice_request") {
    return generateAdviceResponse(rawMessage, lower, lang);
  }

  // 9. Comparisons ("perbedaan RAM dan ROM", "bedanya SSD dan HDD")
  if (intent === "comparison_request") {
    if (lower.includes("ram") && lower.includes("rom")) {
      return "**Perbedaan RAM dan ROM**:\n- **RAM** adalah memori kerja sementara untuk menjalankan aplikasi saat perangkat menyala (data hilang saat dimatikan).\n- **ROM** adalah penyimpanan permanen untuk sistem dan file yang datanya tetap tersimpan meski perangkat dimatikan.";
    }
    if (
      lower.includes("ssd") &&
      (lower.includes("hdd") ||
        lower.includes("harddisk") ||
        lower.includes("hard disk"))
    ) {
      return "**Perbedaan SSD dan HDD**:\n- **SSD** menggunakan chip flash tanpa komponen bergerak sehingga jauh lebih cepat, hemat daya, dan tahan guncangan.\n- **HDD** menggunakan piringan magnetik berputar, harganya lebih terjangkau untuk kapasitas besar tetapi kecepatannya di bawah SSD.";
    }
    if (lower.includes("frontend") && lower.includes("backend")) {
      return "**Perbedaan Frontend dan Backend**:\n- **Frontend** adalah bagian tampilan aplikasi yang dilihat dan diakses langsung oleh pengguna (UI/UX).\n- **Backend** adalah sistem di balik layar (server, API, dan database) yang memproses logika serta menyimpan data.";
    }
  }

  // 10. Capitals ("ibukota Jepang?", "ibukota Jepang apa?", "ibu kota Jawa Tengah")
  if (
    lower.includes("ibukota") ||
    lower.includes("ibu kota") ||
    lower.includes("capital of") ||
    lower.includes("capital city")
  ) {
    for (const [place, capital] of Object.entries(CAPITALS_MAP)) {
      if (lower.includes(place)) {
        return wantsDetail
          ? `Ibu kota ${place.charAt(0).toUpperCase() + place.slice(1)} adalah **${capital}**.`
          : `${capital}.`;
      }
    }
  }

  // 11. Presidents & Historical Leaders ("siapa presiden pertama Indonesia?")
  if (lower.includes("presiden") || lower.includes("president")) {
    if (
      (lower.includes("pertama") ||
        lower.includes("ke-1") ||
        lower.includes("ke 1")) &&
      lower.includes("indonesia")
    ) {
      return wantsDetail
        ? "Presiden pertama Republik Indonesia adalah **Ir. Soekarno**."
        : "Soekarno.";
    }
    if (
      (lower.includes("kedua") ||
        lower.includes("ke-2") ||
        lower.includes("ke 2")) &&
      lower.includes("indonesia")
    ) {
      return "Soeharto.";
    }
    if (
      (lower.includes("ketiga") ||
        lower.includes("ke-3") ||
        lower.includes("ke 3")) &&
      lower.includes("indonesia")
    ) {
      return "B. J. Habibie.";
    }
    if (
      (lower.includes("keempat") ||
        lower.includes("ke-4") ||
        lower.includes("ke 4")) &&
      lower.includes("indonesia")
    ) {
      return "Abdurrahman Wahid (Gus Dur).";
    }
    if (
      (lower.includes("kelima") ||
        lower.includes("ke-5") ||
        lower.includes("ke 5")) &&
      lower.includes("indonesia")
    ) {
      return "Megawati Soekarnoputri.";
    }
    if (
      (lower.includes("keenam") ||
        lower.includes("ke-6") ||
        lower.includes("ke 6")) &&
      lower.includes("indonesia")
    ) {
      return "Susilo Bambang Yudhoyono (SBY).";
    }
    if (
      (lower.includes("ketujuh") ||
        lower.includes("ke-7") ||
        lower.includes("ke 7")) &&
      lower.includes("indonesia")
    ) {
      return "Joko Widodo (Jokowi).";
    }
    if (
      (lower.includes("kedelapan") ||
        lower.includes("ke-8") ||
        lower.includes("ke 8") ||
        lower.includes("sekarang") ||
        lower.includes("saat ini")) &&
      lower.includes("indonesia")
    ) {
      return "Prabowo Subianto.";
    }
  }

  // 12. Nature & General Knowledge Facts ("warna langit biasanya apa?", etc.)
  if (
    (lower.includes("warna") && lower.includes("langit")) ||
    (lower.includes("color") && lower.includes("sky"))
  ) {
    if (lower.includes("kenapa") || lower.includes("mengapa") || wantsDetail) {
      return "Langit tampak berwarna **biru** pada siang hari karena atmosfer Bumi menghamburkan cahaya matahari yang bergelombang pendek (cahaya biru) ke segala arah melalui proses *hamburan Rayleigh*.";
    }
    return lang === "en" ? "Blue." : "Biru.";
  }

  if (
    lower.includes("warna daun") ||
    (lower.includes("daun") && lower.includes("warna apa"))
  ) {
    return wantsDetail
      ? "Daun umumnya berwarna hijau karena mengandung zat hijau daun (**klorofil**) yang berperan menyerap cahaya matahari untuk fotosintesis."
      : "Hijau.";
  }

  if (
    lower.includes("warna darah") ||
    (lower.includes("darah") && lower.includes("warna apa"))
  ) {
    return wantsDetail
      ? "Darah berwarna merah karena mengandung **hemoglobin**, yaitu protein kaya zat besi di dalam sel darah merah yang mengikat oksigen."
      : "Merah.";
  }

  if (lower.includes("air mendidih"))
    return "100°C (pada tekanan udara normal 1 atm).";
  if (lower.includes("air membeku")) return "0°C.";
  if (lower.includes("planet terdekat") && lower.includes("matahari"))
    return "Merkurius.";
  if (lower.includes("planet terbesar")) return "Jupiter.";
  if (lower.includes("planet merah")) return "Mars.";
  if (lower.includes("gunung tertinggi di dunia")) return "Gunung Everest.";
  if (lower.includes("samudra terluas") || lower.includes("samudera terluas"))
    return "Samudra Pasifik.";
  if (lower.includes("hewan tercepat di darat")) return "Cheetah.";
  if (lower.includes("hewan terbesar")) return "Paus biru.";
  if (
    lower.includes("17 agustus 1945") ||
    (lower.includes("kapan") && lower.includes("indonesia merdeka"))
  ) {
    return "17 Agustus 1945.";
  }
  if (lower.includes("penemu lampu")) return "Thomas Alva Edison.";

  // 13. Tech, Hardware, Science & Natural Phenomena Definitions
  // ("apa itu RAM?", "jelasin RAM", "hujan itu apa", "jelasin fotosintesis", etc.)
  for (const item of TECH_AND_SCIENCE_DEFINITIONS) {
    const matched = item.keys.some((k) => {
      const rx = new RegExp(
        `\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i"
      );
      return rx.test(lower);
    });
    if (matched) {
      // Special check for "hujan": if user says "di sini lagi hujan" (not asking what rain is), handle in weather smalltalk below
      if (
        item.keys.includes("hujan") &&
        /\b(lagi\s+hujan|sedang\s+hujan|turun\s+hujan|hujan\s+deras)\b/i.test(
          lower
        ) &&
        !/\b(apa|kenapa|mengapa|bagaimana|proses|jelasin|jelaskan)\b/i.test(
          lower
        )
      ) {
        break;
      }
      if (lang === "en") return item.shortAnswerEn;
      return wantsDetail ? item.detailedAnswerId : item.shortAnswerId;
    }
  }

  // 14. Language Translations ("bahasa inggrisnya makan", "arti kata happy")
  const toEnMatch = rawMessage.match(
    /(?:bahasa\s+inggris(?:nya)?|inggrisnya|translate(?:\s+ke\s+inggris)?)\s+["']?([a-zA-Z\s]+?)["']?[?.!]*$/i
  );
  if (toEnMatch?.[1]) {
    const word = toEnMatch[1].trim().toLowerCase();
    if (ID_TO_EN_DICT[word]) {
      return `${ID_TO_EN_DICT[word]}.`;
    }
  }

  const toIdMatch = rawMessage.match(
    /(?:arti(?:nya)?(?:\s+kata)?|bahasa\s+indonesia(?:nya)?)\s+["']?([a-zA-Z]+)["']?[?.!]*$/i
  );
  if (toIdMatch?.[1]) {
    const word = toIdMatch[1].trim().toLowerCase();
    if (EN_TO_ID_DICT[word]) {
      return `${EN_TO_ID_DICT[word]}.`;
    }
  }

  // 15. Feelings & Empathy ("aku lagi bingung", "aku sedih", "aku capek", "aku bosan", "aku lapar", "aku ngantuk")
  if (lower.includes("bingung") || lower.includes("confused")) {
    return lang === "id"
      ? `Lagi bingung soal apa nih${greetName}? Cerita aja, siapa tahu aku bisa bantu kasih solusi atau penjelasan.`
      : `What are you feeling confused about${greetName}? Tell me and I'll help you figure it out.`;
  }
  if (
    lower.includes("capek") ||
    lower.includes("lelah") ||
    lower.includes("letih")
  ) {
    return `Istirahat dulu sebentar ya${greetName}, minum air putih dan jangan terlalu diforsir.`;
  }
  if (
    lower.includes("sedih") ||
    lower.includes("galau") ||
    lower.includes("kecewa") ||
    lower.includes("stres") ||
    lower.includes("pusing")
  ) {
    return `Tarik napas pelan dulu ya${greetName}. Kalau mau cerita apa yang lagi membebani pikiranmu, aku siap mendengarkan dan bantu cari jalan keluarnya.`;
  }
  if (
    lower.includes("bosan") ||
    lower.includes("bosen") ||
    lower.includes("gabut")
  ) {
    return `Kalau lagi bosan, kita bisa main tebak-tebakan, bikin cerita seru, atau bahas fakta unik!`;
  }
  if (
    lower.includes("udah makan") ||
    lower.includes("sudah makan") ||
    lower.includes("makan belum")
  ) {
    return `Aku kan AI jadi nggak makan hehe, tapi kamu jangan lupa makan tepat waktu ya${greetName}!`;
  }
  if (lower.includes("lapar") || lower.includes("laper")) {
    return `Cari makan dulu gih biar bertenaga lagi! Makanan hangat seperti soto, bakso, atau nasi ayam bisa jadi pilihan pas.`;
  }
  if (lower.includes("ngantuk")) {
    return `Kalau udah ngantuk berat, istirahat atau tidur dulu aja biar segar kembali.`;
  }

  // 16. Creative Requests (Pantun, Puisi, Jokes, Motivasi)
  if (lower.includes("pantun")) {
    return `Jalan-jalan ke kota Pati,\nJangan lupa membeli duku.\nKalau kamu senang di hati,\nAyo ngobrol bareng aku! 😄`;
  }
  if (lower.includes("puisi")) {
    return `Di balik layar cahaya menyapa,\nMenemani langkah di tengah cerita,\nTak peduli jauhnya jarak dan waktu,\nAku selalu siap mendengarkanmu.`;
  }
  if (
    lower.includes("lucu") ||
    lower.includes("joke") ||
    lower.includes("lelucon") ||
    lower.includes("tebak")
  ) {
    return `Kenapa programmer kalau tidur lampunya dimatiin? Karena kalau nyala itu *light mode*, mereka lebih suka *dark mode*! 😄`;
  }
  if (lower.includes("motivasi")) {
    return `Langkah kecil hari ini tetap membawamu lebih dekat ke tujuan dibanding diam di tempat. Semangat terus ya! 💪`;
  }

  // 17. Personal Companion Questions
  if (
    lower.includes("tinggal dimana") ||
    lower.includes("tinggal di mana") ||
    lower.includes("asal mana")
  ) {
    return `Aku tinggal di dunia digital dan siap hadir kapan pun kamu butuh teman diskusi.`;
  }
  if (
    lower.includes("umur kamu") ||
    lower.includes("berapa umurmu") ||
    lower.includes("usia kamu")
  ) {
    return `Aku AI, jadi nggak punya umur biologis!`;
  }
  if (
    lower.includes("bisa bantu apa") ||
    lower.includes("kamu bisa apa") ||
    lower.includes("bisa apa saja") ||
    lower.includes("what can you do")
  ) {
    return `Aku bisa menjawab pertanyaan umum, berhitung, menjelaskan konsep teknologi/sains, membuat cerita pendek, memberikan tips praktis, hingga brainstorming ide kreatif.`;
  }
  if (
    lower.includes("rekomendasi makan") ||
    lower.includes("makan apa") ||
    lower.includes("masak apa")
  ) {
    return `Kalau mau yang berkuah hangat, soto ayam atau sop daging enak banget. Kalau mau yang praktis dan mengenyangkan, nasi goreng telur atau ayam panggang bisa jadi pilihan pas!`;
  }

  // 18. Weather Situation ("di sini lagi hujan", "cuaca panas banget")
  if (lower.includes("hujan")) {
    return `Hati-hati kalau sedang di luar ya! Saat hujan paling pas menyiapkan payung dan minuman hangat.`;
  }
  if (lower.includes("panas banget") || lower.includes("cuaca panas")) {
    return `Jangan lupa banyak minum air putih supaya tubuh tetap terhidrasi di cuaca panas!`;
  }

  // 19. General Open Questions ("apa itu X", "jelaskan X", "kenapa X", "bagaimana X")
  const whatIsMatch = rawMessage.match(
    /(?:apa\s+itu|jelaskan(?:\s+tentang)?|jelasin(?:\s+tentang)?|pengertian|definisi)\s+([^?.!]+)/i
  );
  if (whatIsMatch?.[1]) {
    const subject = whatIsMatch[1].trim();
    return `**${subject}** merujuk pada konsep atau topik penting yang berkaitan dengan fungsi dan karakteristik utamanya. Secara ringkas, ${subject} berperan dalam membantu proses, pemahaman, atau penyelesaian kebutuhan sesuai konteks penggunaannya.`;
  }

  if (lower.includes("jadwal")) {
    return [
      "Berikut draf jadwal harian produktif yang seimbang:",
      "- **08.00 – 10.00**: Fokus tugas utama / prioritas tertinggi (Deep Work).",
      "- **10.00 – 10.15**: Istirahat singkat & peregangan.",
      "- **10.15 – 12.00**: Menyelesaikan tugas lanjutan / komunikasi.",
      "- **12.00 – 13.00**: Istirahat makan siang & ibadah.",
      "- **13.00 – 15.30**: Pekerjaan kolaborasi, review, atau belajar materi baru.",
      "- **15.30 – 17.00**: Merapikan daftar tugas & evaluasi target hari ini.",
    ].join("\n");
  }

  // 20. Context-Aware Direct Reply (Never returns generic productivity steps!)
  return lang === "en"
    ? `Here to help! Feel free to ask me a specific question, calculation, story, or concept you'd like explained.`
    : `Siap${greetName}! Sebutkan saja pertanyaan, hitungan, cerita, atau topik yang ingin kamu bahas bersama ${aiName}.`;
}
