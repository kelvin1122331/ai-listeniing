# AURA

A conversational companion with text chat, Gemini Live voice, browser speech fallback, camera questions, and screen sharing. Built with Next.js, React, and TypeScript.

The interface uses a focused conversation layout, responsive device controls, an accessible settings dialog, and light/dark themes. Avatars are vector illustrations with simple expression and mouth animation.

## Run locally

Requires Node.js 22.12 or newer.

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local`.
3. Set `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey).
4. Run `npm run dev` and open [localhost:3000](http://localhost:3000).
5. Production: stop the development server, run `npm run build`, then `npm start`.

A missing API key is reported as a configuration error. The app does not substitute canned answers and label them as Gemini output. Model availability and quota depend on the configured Google project. Models can be changed using environment variables or the admin panel.

## Configure the admin panel

Set `ADMIN_USERNAME`, `ADMIN_PASSWORD` (at least 12 characters), and `ADMIN_SESSION_SECRET` (at least 32 characters). To save encrypted API keys through the panel, also set `CONFIG_ENCRYPTION_KEY` to a separate random secret of at least 32 characters. Generate a secret with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Open `/admin`. There are no built-in login credentials. Sessions use signed, expiring HTTP-only cookies. Production cookies require HTTPS; `COOKIE_SECURE=false` is only for local production testing over HTTP.

The connection test actually calls the chosen model and can consume API quota. It does not report success when a key is absent. Saving an API key does not automatically test access to every model.

Admin configuration is encrypted in `.data/ai_configuration.enc.json`. Use a persistent writable disk for this folder. On ephemeral/serverless hosting, supply keys and models through environment variables; the admin file is not a shared database. Request statistics and rate limits are per server instance. Public deployments should apply shared rate limits at their reverse proxy when running multiple instances.

Existing encrypted keys saved with the old public fallback encryption secret need to be entered again after configuring a private encryption key. If a prior deployment exposed a Gemini master key through the old Live endpoint, rotate that key in Google AI Studio.

## Voice and visual input

- Microphone access begins only after pressing **Bicara**. Gemini Live receives mono 16 kHz PCM through an AudioWorklet.
- The server creates a short-lived, single-use Live token. The permanent key stays on the server. The connection is ready only after the provider sends `setupComplete`.
- Audio output is 24 kHz PCM. Chunks are scheduled in order; interrupt, mute, stop, and leaving a conversation release playback and input resources.
- Live transcripts appear in chat without generating a duplicate REST answer. Recent conversation text and enabled memories provide context when starting a Live session.
- If Live is unavailable, supported browsers can use their speech recognition service. This service uses the browser's selected microphone and may need an internet connection. Without either option, the UI reports that voice is unavailable.
- Camera and screen capture require browser permission and HTTPS or localhost. Cancelling or denying permission displays a clear error. It never silently switches to a simulated camera.
- Each text question includes a fresh image when visual input is enabled. During Live voice, images are sampled at the chosen interval. Vision and OCR come from the AI model; pixel colors are not presented as object recognition.
- Browser speech voices, pronunciation, autoplay, microphone support, and screen capture availability vary by browser and device. Voice/rate/pitch settings under **Suara** apply to browser speech; native Gemini voices use the chosen character.

## Privacy and deployment

Preferences are kept in local browser storage. Long-term memory is off by default. Chat history uses tab session storage; raw camera frames are not saved there. Messages, enabled memories, and attached images are sent to the selected AI provider to answer the request. Avatars are not sent with chat requests.

Set `APP_ORIGIN` to the exact public origin when deploying behind a reverse proxy. API writes reject mismatched browser origins. Do not enable wildcard CORS for credentialed admin routes. API responses containing credentials or user data use `Cache-Control: no-store`.

The default models follow the [Gemini model catalog](https://ai.google.dev/gemini-api/docs/models). The implementation follows Google's [ephemeral token guide](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens), [WebSocket guide](https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket), and [audio format guidance](https://ai.google.dev/gemini-api/docs/live-api/capabilities).

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

Tests cover server validation, upstream failures, model/history/image forwarding, signed sessions, encrypted secrets, Live handshakes and transcripts, microphone cancellation, sequential audio playback, retries, clearing chat, and aborting requests. Provider calls and hardware are mocked in automated tests; a real API key and actual browser devices are still needed for live integration testing.

GitHub Actions runs installation, lint, type checking, tests, and a production build for pull requests and pushes to main.
