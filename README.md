# AURA.AI — Modern AI Virtual Companion (Powered by Google Gemini & Gemini Live API)

**Talk to AI like it's really there.**  
Platform AI Virtual Companion modern dan futuristik untuk interaksi real-time melalui **teks (chat)**, **suara (Gemini Live API / STT & TTS + barge-in)**, **kamera (Gemini Vision)**, dan **Screen Share** dengan avatar manusia virtual ekspresif yang mendukung sinkronisasi bibir (**lip-sync**).

---

## Arsitektur AI Modular (Google AI Studio / Gemini Primary Provider)

```text
Frontend (MainConversationView / VoiceController / CameraPreview)
  ↓
AI Service Facade (src/services/AIService.ts)
  ↓
AIProvider Interface Abstraction (src/services/ai/AIProvider.ts)
  ↓
GeminiProvider Implementation (src/services/ai/GeminiProvider.ts)
  ↓
Server API Routes (/api/chat & /api/gemini/session)
  ↓
Google AI Studio / Gemini Multimodal API (gemini-2.0-flash) & Gemini Live API (BidiGenerateContent)
```

---

## Fitur Utama

1. **Google Gemini Text & Multimodal Chat**
   - Menggunakan Gemini API (`gemini-2.0-flash` / `gemini-1.5-flash`) dengan ringkasan konteks percakapan panjang otomatis (*summarized context optimization*) untuk menghemat penggunaan token.
   - Mendukung adaptasi bahasa otomatis (Bahasa Indonesia & Bahasa Inggris) dan *short-term* / *long-term memory*.

2. **Realtime Voice & Barge-In (`useVoiceSession` + `GeminiProvider`)**
   - Mendukung **Gemini Live API** (`BidiGenerateContent` WebSocket) melalui sesi ephemeral server-side (`/api/gemini/session`) serta fallback otomatis ke *Web Speech STT/TTS* jika koneksi realtime terputus.
   - **Interruptable Voice / Barge-in**: Saat pengguna berbicara atau menekan tombol *Interrupt AI* ketika AI sedang menjawab, suara AI langsung berhenti dan status avatar berubah menjadi `interrupted` -> `listening`.

3. **Camera Vision & Screen Share (`CameraPreview` + `VisionService`)**
   - **Adaptive Frame Sampling**: Tidak mengirim video 30/60 FPS penuh. Hanya mengambil snapshot terkompresi JPEG ketika terdeteksi perubahan visual signifikan (*frame delta*) atau ketika pengguna mengajukan pertanyaan visual.
   - Mendukung **Spatial Vision Awareness** (area kiri, tengah, kanan) untuk menjawab pertanyaan seperti:
     - *"Ini benda apa?"*
     - *"Apa yang sedang aku pegang?"*
     - *"Baca tulisan ini."*
     - *"Yang sebelah kiri itu apa?"*
   - Mendukung **Screen Share** agar pengguna dapat menanyakan langsung tentang tampilan layar mereka.

4. **Avatar States & Audio Lip-Sync (`VirtualAvatar` + `LipSyncService`)**
   - Terhubung langsung dengan status Gemini: `idle`, `listening`, `thinking`, `speaking`, `watching`, `interrupted`, serta ekspresi emosi `happy`, `confused`, `surprised`, `neutral`.
   - **Dual Lip-Sync Engine**: Menggunakan pemetaan viseme (`A`, `E`, `I`, `O`, `U`, `M`, `F`, `S`, `rest`) dengan fallback analisis amplitudo & spektrum audio real-time (`amplitudeToVisemeFrame`).

---

## Konfigurasi Environment Variable

Salin `.env.example` menjadi `.env.local` di server:

```env
GEMINI_API_KEY=your_google_ai_studio_api_key
GEMINI_MODEL=gemini-2.0-flash
GEMINI_LIVE_MODEL=models/gemini-2.0-flash-exp
```

API key disimpan aman di sisi server dan tidak pernah diletakkan secara permanen di kode frontend.
