import {
  AvatarPreset,
  CompanionConfig,
  CompanionMode,
  DemoCameraScene,
  UserProfile,
} from "@/types/companion";

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "aura",
    name: "AURA",
    roleTitle: "Gemini Neural Companion",
    description:
      "Warm, perceptive, and naturally expressive digital human powered by Google Gemini Multimodal.",
    primaryColor: "#38bdf8",
    secondaryColor: "#818cf8",
    skinTone: "#f4d2c0",
    skinShadow: "#d9a58c",
    hairColor: "#1e2640",
    eyeColor: "#38bdf8",
    lipColor: "#d97782",
    defaultVoiceGender: "female",
    defaultPitch: 1.05,
    defaultRate: 1.02,
    hairStyle: "cyber_bob",
  },
  {
    id: "luna",
    name: "Luna",
    roleTitle: "Empathetic Creative Muse",
    description:
      "Gentle, artistic, and insightful companion ideal for deep conversations and brainstorming.",
    primaryColor: "#c084fc",
    secondaryColor: "#f472b6",
    skinTone: "#f7dcd0",
    skinShadow: "#dfb09c",
    hairColor: "#311b47",
    eyeColor: "#a855f7",
    lipColor: "#e1748e",
    defaultVoiceGender: "female",
    defaultPitch: 1.12,
    defaultRate: 0.98,
    hairStyle: "flowing_long",
  },
  {
    id: "kai",
    name: "Kai",
    roleTitle: "Tech & Strategy Partner",
    description:
      "Sharp, calm, and pragmatic digital specialist for coding, productivity, and problem-solving.",
    primaryColor: "#2dd4bf",
    secondaryColor: "#3b82f6",
    skinTone: "#eac0a6",
    skinShadow: "#c99578",
    hairColor: "#141d2b",
    eyeColor: "#14b8a6",
    lipColor: "#c27874",
    defaultVoiceGender: "male",
    defaultPitch: 0.92,
    defaultRate: 1.05,
    hairStyle: "neo_crop",
  },
  {
    id: "nova",
    name: "Nova",
    roleTitle: "Futuristic Synth Guide",
    description:
      "High-energy, witty, and curious holographic intelligence ready for gaming and fast banter.",
    primaryColor: "#22d3ee",
    secondaryColor: "#10b981",
    skinTone: "#eed5c8",
    skinShadow: "#d2ab96",
    hairColor: "#0f293a",
    eyeColor: "#06b6d4",
    lipColor: "#d86c7e",
    defaultVoiceGender: "female",
    defaultPitch: 1.08,
    defaultRate: 1.08,
    hairStyle: "synth_waves",
  },
];

export const COMPANION_MODES: {
  id: CompanionMode;
  label: string;
  badge: string;
  description: string;
}[] = [
  {
    id: "companion",
    label: "Virtual Companion",
    badge: "Default",
    description: "Natural, friendly everyday conversation & emotional presence.",
  },
  {
    id: "tutor",
    label: "AI Tutor Mode",
    badge: "Education",
    description: "Step-by-step explanations, visual homework & note analysis.",
  },
  {
    id: "assistant",
    label: "AI Assistant Mode",
    badge: "Productivity",
    description: "Focused brainstorming, scheduling, and structured insights.",
  },
  {
    id: "gaming",
    label: "AI Gaming Companion",
    badge: "Interactive",
    description: "Energetic co-pilot for game lore, strategy, and lively banter.",
  },
  {
    id: "language_tutor",
    label: "AI Language Tutor",
    badge: "Bilingual",
    description: "Practice natural speaking in Indonesian & English with gentle tips.",
  },
];

export const DEFAULT_COMPANION_CONFIG: CompanionConfig = {
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
  memoryEnabled: false,
  theme: "light",
  autoSpeak: true,
  bargeInEnabled: true,
  cameraSampleIntervalSec: 4,
  adaptiveSampling: true,
  geminiModel: "gemini-3.8-flash",
  useGeminiLiveVoice: true,
  selectedMicrophoneId: "default",
  selectedCameraId: "default",
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: "Explorer",
  bio: "Building and exploring next-gen human-AI interaction with Gemini.",
  role: "Creator & Technologist",
  preferredGreeting: "Santai & Natural",
  avatarInitials: "EX",
};

export const DEMO_CAMERA_SCENES: DemoCameraScene[] = [
  {
    id: "coffee_mug",
    title: "Holding Ceramic Coffee Mug",
    titleId: "Memegang Cangkir Kopi Keramik",
    description:
      "A matte dark-blue ceramic mug filled with hot latte art held in front of the camera, with a wireless mechanical keyboard on the left and a succulent plant on the right.",
    objects: [
      "Ceramic Coffee Mug (Center)",
      "Mechanical Keyboard (Left)",
      "Succulent Mini Plant (Right)",
      "Wooden Desk",
    ],
    spatialRegions: {
      leftRegion:
        "Mechanical keyboard wireless 75% warna dark-grey dan buku catatan kecil",
      centerRegion:
        "Tangan yang sedang memegang cangkir kopi keramik biru tua berisi latte art hangat",
      rightRegion:
        "Tanaman sukulen hijau di dalam pot keramik putih minimalis",
    },
    suggestedQuestionId: "Apa yang sedang aku pegang?",
    suggestedQuestionEn: "What am I holding right now?",
  },
  {
    id: "handwritten_notes",
    title: "Algorithm & Physics Study Notes",
    titleId: "Catatan Tulisan Tangan & Rumus",
    description:
      "Notebook page showing Newton's Second Law (F = m × a) on the left column and Big-O binary search complexity O(log n) on the right column.",
    objects: [
      "Spiral Notebook",
      "Newton's Law Formula (Left)",
      "Binary Search Diagram (Right)",
      "Highlighter Pen",
    ],
    spatialRegions: {
      leftRegion:
        "Rumus Fisika Hukum II Newton (F = m · a) beserta stabilo kuning dan pena hitam",
      centerRegion:
        "Halaman buku catatan spiral terbuka dengan tulisan tangan rapi",
      rightRegion:
        "Diagram pohon Binary Search dengan kompleksitas waktu O(log n)",
    },
    sampleText:
      "F = m · a | Binary Search Time Complexity: O(log n) | Energi Kinetik Ek = ½mv²",
    suggestedQuestionId: "Baca tulisan ini.",
    suggestedQuestionEn: "Can you read and explain this writing?",
  },
  {
    id: "electronic_gadget",
    title: "Microcontroller & Sensor Board",
    titleId: "Perangkat Elektronik ESP32 / PCB",
    description:
      "An ESP32 Wi-Fi/Bluetooth microcontroller development board in the center, an ultrasonic sensor on the left, and an OLED module on the right.",
    objects: [
      "ESP32 Microcontroller",
      "HC-SR04 Ultrasonic Sensor (Left)",
      "OLED Display Module (Right)",
      "Breadboard & Jumper Wires",
    ],
    spatialRegions: {
      leftRegion:
        "Sensor jarak ultrasonik HC-SR04 dengan dua silinder transduser perak dan kabel USB-C",
      centerRegion:
        "Board mikrokontroler ESP32-WROOM-32D terpasang di atas breadboard putih",
      rightRegion:
        "Layar modul OLED 0.96 inci I2C yang menampilkan status tegangan 3.3V",
    },
    sampleText: "ESP32-WROOM-32D Dual Core Wi-Fi + BLE | GPIO Pins 3.3V",
    suggestedQuestionId: "Ini benda apa?",
    suggestedQuestionEn: "What object is this and how does it work?",
  },
  {
    id: "architecture_diagram",
    title: "Gemini Live Architecture Sketch",
    titleId: "Diagram Arsitektur Sistem Gemini",
    description:
      "Whiteboard diagram showing Frontend Client on the left, AIProvider + GeminiProvider in the center, and Gemini Live Multimodal API on the right.",
    objects: [
      "Client UI Node (Left)",
      "AIProvider Abstraction (Center)",
      "Gemini Live Bidi API (Right)",
    ],
    spatialRegions: {
      leftRegion:
        "Blok diagram Frontend Browser (Camera, Screen Share, Microphone, Lip-Sync Avatar)",
      centerRegion:
        "Layer abstraksi AIProvider.ts dan GeminiProvider.ts dengan Adaptive Frame Sampler",
      rightRegion:
        "Server Google AI Studio / Gemini 2.0 Flash & Gemini Live WebSocket API",
    },
    sampleText:
      "Frontend -> AIProvider -> GeminiProvider -> Gemini 2.0 Flash / Live API",
    suggestedQuestionId: "Yang sebelah kiri itu apa?",
    suggestedQuestionEn: "What is on the left side of this diagram?",
  },
];

export const CAMERA_QUICK_PROMPTS = [
  "Ini benda apa?",
  "Apa yang sedang aku pegang?",
  "Baca tulisan ini.",
  "Yang sebelah kiri itu apa?",
];

export const SCREEN_SHARE_QUICK_PROMPTS = [
  "Jelaskan apa yang tampil di layarku sekarang.",
  "Baca tulisan ini.",
  "Yang sebelah kiri itu apa?",
  "Apakah ada yang perlu diperbaiki di tampilan layar ini?",
];

export const GENERAL_QUICK_PROMPTS = [
  "Halo! Ceritakan sedikit tentang dirimu.",
  "Bantu aku brainstorming ide project AI dengan Gemini.",
  "Let's practice casual English conversation!",
  "Kasih aku tips biar fokus kerja hari ini.",
];
