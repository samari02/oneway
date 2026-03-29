# Aoi visibility & Clarity Settings

**Last update:** 2026-03-29

## Goal

- **Binary visibility:** the browser widget is either fully shown or fully hidden on a page — **no minimized / “small bubble only” state**.
- **Desktop control:** users can see **which domains** hide Aoi, **add** hostnames, **remove** them, and toggle **hide on all websites** from **Clarity → Settings** (signed-in users).

## Data model

Same as before:

- `clarity_hidden_global` (boolean) in `chrome.storage.local`
- `clarity_hidden_domains` (string[], hostnames without `www.`) in `chrome.storage.local`
- Mirror: `~/.clarity/aoi-preferences.json` via Tauri + Supabase `user_settings` (`aoi_hidden_global`, `aoi_hidden_domains`)

## Extension

1. **Host node** `#clarity-aoi-widget` toggles `display: none` when hidden; no in-page restore control.
2. **`chrome.storage.onChanged`** in the content script reapplies visibility when prefs change (e.g. after Clarity Settings saves).
3. **Native messaging:** while connected to the desktop, the extension **polls `GET_AOI_PREFERENCES` every 30s** so file writes from the desktop app propagate to `chrome.storage` without reloading every tab.

## Desktop app

- **Hook:** `useAoiPreferences` — Supabase load on mount, save to local file, poll local file every 5s to merge extension-originated changes back to Supabase.
- **UI:** `SettingsView` section **“Aoi (browser widget)”** — global checkbox, domain list with Remove, text field + Add.

## Related code (pointers)

- `apps/desktop/src/features/settings/hooks/useAoiPreferences.ts`
- `apps/desktop/src/features/settings/components/SettingsView.tsx`
- `apps/extension/src/content/content-script.ts`
- `apps/extension/src/background/native-messaging.ts` (`startAoiPreferencesPolling`)
