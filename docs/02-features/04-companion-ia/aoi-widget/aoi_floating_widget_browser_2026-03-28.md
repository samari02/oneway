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
| **Menu** | Click the bubble → options (analysis, hide) |
| **Restore button** | When the widget is hidden, a small control to show it again |

---

## Where it does not show

**Excluded** URLs (no injection) include: `chrome://`, `chrome-extension://`, `edge://`, `about:`, `file://`, etc. (see `shouldInject()` in the code).

---

## Hiding “per page”

The menu offers two **hide** actions (the widget disappears; this is not macOS window minimization):

| Action | Behavior | Storage (`chrome.storage.local`) |
|--------|----------|-----------------------------------|
| **Hide on this site** | Hides Aoi on the **current domain** only | List `clarity_hidden_domains` (hostnames without `www.`) |
| **Hide everywhere** | Hides Aoi on **all** sites | Boolean `clarity_hidden_global` |

When hidden, the container gets the **`hidden`** class; a **restore** button shows Aoi again and **undoes** the right hide mode (global vs domain).

**Sync:** preferences may be sent to the desktop (`AOI_PREFERENCES_UPDATE` → native messaging) for persistence in the app / Supabase depending on the current implementation.

---

## Main code files

| File | Role |
|------|------|
| `apps/extension/src/content/content-script.ts` | Widget injection, styles (Shadow DOM), events, `GET_AOI_STATUS` |
| `apps/extension/src/background/service-worker.ts` | Handlers `GET_AOI_STATUS`, `OPEN_POPUP`, etc. |

CSS also includes rules for `.aoi-widget.minimized`; JS toggling of that class may be missing or partial across versions — the **documented** “per site” behavior relies on **hide domain / hide global**.

---

## See also

- [ai-companion.md](../ai-companion.md) — AI coach in the **desktop app** (conversation, OpenAI)
- [extension/README.md](../../../03-architecture/extension/README.md) — Role of content scripts
- [changelog/1.log.md](../../../changelog/1.log.md) — Entries #73–#75 (detailed product history)
