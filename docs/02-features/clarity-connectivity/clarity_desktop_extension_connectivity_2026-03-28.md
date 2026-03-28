# Clarity — Desktop ↔ Extension connectivity & auth hardening

**Last update:** 2026-03-28

---

## Scope

Work session covering: Supabase login failures in the Tauri app, the “Protection Compromised” banner (extension heartbeats), native messaging setup, Chrome reconnect behaviour, and UX fixes for the protection alert.

---

## 1. Supabase auth (`Load failed`)

**Issue:** Sign up / sign in showed a generic **Load failed** (WebKit) when the Supabase project URL could not be reached (e.g. bad or removed project ref, DNS).

**Changes:**

- `apps/desktop/src/lib/supabase.ts` — optional overrides: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (fallback to `@oneway/shared` constants).
- `apps/desktop/.env.example` — template for those variables.
- `apps/desktop/src/features/auth/components/LoginForm.tsx` — `formatAuthError()` maps network-style errors to an actionable message; `try/catch` around auth calls.
- `packages/shared/src/constants.ts` — comment pointing to Dashboard → Settings → API.

**Operational note:** Set real values in `apps/desktop/.env.local` and restart Vite/Tauri.

---

## 2. Protection alert — “Check Extension” did nothing

**Issue:** `ProtectionAlert` used `window.alert()`, which is often invisible or blocked in Tauri’s WebView.

**Changes (`apps/desktop/src/features/boundaries/components/ProtectionAlert.tsx` + CSS):**

- Use `@tauri-apps/plugin-opener` `openUrl()` to open `chrome://extensions` (and fallbacks: Chromium, Brave, Edge, Arc).
- If all opens fail, show **inline** instructions + **Copy `chrome://extensions/`**.

---

## 3. Native messaging host — why heartbeats stopped

**Facts:**

- The desktop UI reads `~/.clarity/extension-status.json`. **`last_heartbeat`** is updated only when the **native messaging** path receives `HEARTBEAT` from the extension (`native_host.rs`).
- Chrome’s manifest **`path`** must point to a process that runs the app with **`--native-host`**. Chrome **does not** pass that flag; the binary’s `main` only enters native host mode when `args` contain `--native-host`.

**Changes:**

- `apps/desktop/scripts/install-native-host.sh` — writes **`~/.clarity/clarity-native-host-runner.sh`** that runs `exec "$APP_PATH" --native-host`, and sets the manifest **`path`** to that runner (not directly to the bare binary).
- `apps/desktop/src-tauri/native-host/com.clarity.app.json` — template documents **`allowed_origins`** (must include `chrome-extension://<id>/`); **empty `allowed_origins`** blocks all extensions.

**Install usage:**

```bash
./apps/desktop/scripts/install-native-host.sh <extension_id> /path/to/appsdesktop
# Dev example after build:
# .../src-tauri/target/debug/appsdesktop
```

---

## 4. Extension — reconnect after transient failures

**Issue:** After **5** failed reconnects, `native-messaging.ts` stopped retrying permanently, so the bridge could stay down for days even after the desktop was fixed.

**Change:** `apps/extension/src/background/native-messaging.ts` — **unbounded** reconnect with **exponential backoff** (capped at 5 minutes).

---

## 5. Debugging checklist

| Check | Where |
|--------|--------|
| Manifest `path` | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.clarity.app.json` (macOS) |
| `allowed_origins` | Must match current extension id (`chrome://extensions`, Developer mode) |
| `last_heartbeat` | `~/.clarity/extension-status.json` — should move forward every ~60s when connected |
| Service worker logs | Look for “Connected to desktop app” vs disconnect / errors |

---

## Related code

| Area | Path |
|------|------|
| Native host (Rust) | `apps/desktop/src-tauri/src/native_host.rs` |
| Extension NM client | `apps/extension/src/background/native-messaging.ts` |
| Extension status (UI) | `apps/desktop/src/features/boundaries/hooks/useExtensionStatus.ts` |
| Protection banner | `apps/desktop/src/features/boundaries/components/ProtectionAlert.tsx` |
