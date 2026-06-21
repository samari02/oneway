# Voice input (morning brain dump)

Voice input lets users speak their morning brain dump on the intention step instead of typing. The UI lives on the brain dump phase of the morning flow; transcripts are appended to the textarea so the user can edit before running **Sort my day**.

See [DEV_SERVER.md](./DEV_SERVER.md) for how to run the desktop app in development.

## What we built

| Piece | Location |
| --- | --- |
| Brain dump step UI (mic, Speak/Stop, errors) | `src/features/clarity-home/components/morning/MorningStepIntention.tsx` |
| Speech hook (engine selection, recording, errors) | `src/features/clarity-home/hooks/useSpeechRecognition.ts` |
| Whisper transcription API | `transcribeAudio()` in `src/lib/openai.ts` |
| Mic / listening styles | `src/features/clarity-home/components/morning/MorningFlow.css` |
| Web Speech API typings | `src/vite-env.d.ts` |

Related morning flow (LLM plan extraction from the dump): `src/lib/morning-plan.ts`, `useMorningFlow.ts`, and morning flow components.

## Architecture

```text
User taps mic
    → requestMicrophoneAccess() (preflight getUserMedia)
    → Engine choice:
         Browser (not Tauri): Web Speech API if available
         Tauri desktop: Whisper path only (Web Speech disabled)
    → Whisper: MediaRecorder → blob → transcribeAudio() → append to textarea
```

### Tauri vs browser

**Web Speech API is intentionally disabled in Tauri** (`isRunningInTauri()` in `useSpeechRecognition.ts` returns `null` from `getSpeechRecognitionCtor()`). On macOS, calling `SpeechRecognition.start()` without a proper `.app` bundle and speech-recognition entitlement flow can trigger TCC and **SIGABRT** during `tauri dev`.

**Primary path in the desktop app:** `MediaRecorder` captures audio, then OpenAI **Whisper** (`whisper-1`) transcribes via `transcribeAudio()`.

**Browser / Vite-only dev:** Web Speech can be used when the constructor exists; the hook falls back to Whisper on `service-not-allowed` or `network` errors if an API key is configured.

### OpenAI API key

Whisper requires a user-provided key stored in localStorage as `clarity_openai_api_key` (same key as other OpenAI features in Settings). `hasApiKey()` gates the Whisper path; missing key shows a clear inline error.

### Locale

`resolveSpeechLang()` uses an optional hook `lang` prop, else `navigator.language`: French locales map to `fr-FR`, otherwise `en-US`. Whisper receives the ISO 639-1 language prefix (e.g. `fr`, `en`).

## macOS permissions and Tauri config

| File | Purpose |
| --- | --- |
| `src-tauri/Info.plist` | `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription` (system prompt copy) |
| `src-tauri/Entitlements.plist` | `com.apple.security.device.audio-input`, `com.apple.security.device.microphone` |
| `src-tauri/tauri.conf.json` | `bundle.macOS.entitlements` → `Entitlements.plist`; CSP allows `mediastream:` and `media-src` for recorder blobs and `connect-src` to `https://api.openai.com` |

Ensure usage strings from `Info.plist` are included in shipped macOS bundles per your Tauri bundle settings (entitlements are wired in `tauri.conf.json`).

## UX

- **Mic button** on the brain dump textarea and a **Speak** / **Stop** control in the footer.
- **Tap to start** listening; **tap Stop** (or mic again) when finished. On the Whisper path, transcription runs after recording stops (not live streaming).
- **Web Speech path:** interim results update the textarea preview; final segments commit into the dump.
- **Whisper path:** final transcript is appended after stop.
- User **edits text** before **Sort my day** (`extractMorningPlan` / morning-plan LLM flow).
- **Errors** are non-blocking: no API key, mic denied, no device, or transcription failure — user can keep typing.

## Known limitations

- Web Speech is only viable **outside Tauri** (browser) or potentially in **signed `.app` builds** with correct entitlements and Info.plist in the bundle; it is not used in `tauri dev`.
- Whisper needs **network** and a **valid API key** (usage billed to the user’s OpenAI account).
- **Dev mode on macOS:** microphone permission prompts may not appear reliably when the app is launched from some IDE-integrated terminals; run `pnpm dev:desktop` from a **standalone Terminal** if prompts fail ([Tauri #6208](https://github.com/tauri-apps/tauri/issues/6208)).
- Language handling follows browser locale unless overridden; mixed-language dumps depend on Whisper quality.

## How to test

1. **Run the app** from the repo root: `pnpm dev:desktop` (prefer a standalone Terminal on macOS for mic prompts).
2. **Settings:** add a valid OpenAI API key (`clarity_openai_api_key`).
3. Open the **morning flow** and reach the **brain dump** step (`MorningStepIntention`, dump phase).
4. **Grant microphone** when macOS prompts (System Settings → Privacy & Security → Microphone if needed).
5. Tap **Speak** or the mic, say a short brain dump, tap **Stop**.
6. Confirm text appears in the textarea; edit if needed, then **Sort my day** and complete review/priority steps.
7. **Negative cases:** remove API key (expect Settings message); deny mic (expect permission message); verify typing still works.

Optional: run the frontend in the browser only (`pnpm vite` in `apps/desktop`) to exercise Web Speech where supported, with Whisper fallback when Web Speech fails and a key is set.
