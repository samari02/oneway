# Aoi floating widget (browser)

**Last update:** 2026-03-29

> File naming: see [00-documentation-naming-rules_2026-03-28.md](../../../03-runbooks/00-documentation-naming-rules_2026-03-28.md).

---

## What it is

On **http/https** pages, the extension injects a **visual companion** (mascot + bubble) **pinned to the bottom-right** of the window. This is **not** the same surface as the AI coach in the **desktop app** documented in [ai-companion.md](../ai-companion.md): here everything goes through the Chrome **content script**.

| Piece | Role |
|-------|------|
| **Character (Aoi)** | CSS mascot (sprout, face, legs) inside the bubble |
| **Bubble** | Visual status (`ok` / `nudge` / `alert`), short message, time badge |
| **Menu** | Click the bubble → options (analysis, hide on site / all sites) |

---

## Visibility (binary)

There is **no minimize mode**: Aoi is either **fully visible** or **fully removed** from the page.

- **Removed:** the host node `#clarity-aoi-widget` uses `display: none` — no in-page “restore chip”.
- **Visible again:** change preferences in **Clarity desktop → Settings → Aoi (browser widget)** (toggle global hide, edit domain list), or rely on extension storage sync from the desktop file / Supabase.

Detailed behavior: [aoi_visibility_settings_2026-03-29.md](./aoi_visibility_settings_2026-03-29.md).

---

## Where it does not show

**Excluded** URLs (no injection) include: `chrome://`, `chrome-extension://`, `edge://`, `about:`, `file://`, etc. (see `shouldInject()` in the code).

---

## Hiding from the widget menu

| Action | Behavior | Storage (`chrome.storage.local`) |
|--------|----------|-----------------------------------|
| **Hide on this site** | Removes Aoi on the **current domain** only | `clarity_hidden_domains` (hostnames without `www.`) |
| **Hide on all sites** | Removes Aoi on **every** site | `clarity_hidden_global` |

**Sync:** updates are sent to the desktop via `AOI_PREFERENCES_UPDATE` (native messaging) for `~/.clarity/aoi-preferences.json` and Supabase (`user_settings`).

---

## Main code files

| File | Role |
|------|------|
| `apps/extension/src/content/content-script.ts` | Widget injection (Shadow DOM), visibility, storage listener |
| `apps/extension/src/background/service-worker.ts` | `GET_AOI_STATUS`, `AOI_PREFERENCES_UPDATE`, … |
| `apps/extension/src/background/native-messaging.ts` | Desktop bridge, periodic `GET_AOI_PREFERENCES` when connected |
| `apps/desktop/src/features/settings/components/SettingsView.tsx` | Aoi section (domains + global hide) |

---

## See also

- [aoi_visibility_settings_2026-03-29.md](./aoi_visibility_settings_2026-03-29.md) — Settings UI + sync details
- [ai-companion.md](../ai-companion.md) — AI coach in the **desktop app**
- [extension/README.md](../../../03-architecture/extension/README.md) — Content scripts
- [changelog/1.log.md](../../../changelog/1.log.md) — Product history
