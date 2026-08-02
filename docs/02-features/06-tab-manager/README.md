# Tab Manager (workspace hygiene)

**Last update:** 2026-08-02

Independent, toggleable **Clarity extension module** that helps keep the Chrome workspace clean when too many tabs accumulate during the day — without becoming a second product or a generic OneTab clone.

## Related docs

- Product direction & open ideas: [`tab_manager_workspace_hygiene_2026-08-02.md`](./tab_manager_workspace_hygiene_2026-08-02.md)
- Shipped v0 architecture: [`overview.md`](./overview.md)
- Code: `apps/extension/src/modules/tab-manager/`
- Entry: Clarity popup → **Manage Tabs** → `tab-manager.html`

## Problem

At any moment **t**, the user has too many tabs open. The tab bar is polluted; finding the right page is hard. Many tabs have not been touched for hours or days. Manual listing by domain helps a little, but does not solve **intra-day accumulation** or “I don’t know where to start.”

## Goals

| Goal | Detail |
|------|--------|
| One extension | Lives inside Clarity — no second Chrome extension to manage. |
| Independent module | Own folder + storage keys; on/off toggle; does not depend on goals / North Star (for now). |
| Reduce noise | Park abandoned tabs and close exact duplicates; restore when needed. |
| Findability | Prefer **recency** (last activated) over endless domain dumps. |
| Trust | Prefer reversible actions (**park** > auto-close). Undo must stay visible as autonomy grows. |
| Non-intrusive | Assist during the day via **thresholds / badge / popup**, not constant interruptions (anti-Clarity). |

## Non-goals (near term)

- Semantic AI grouping (“this is Japanese study”) as the trust-critical path — fragile; risk of false groups killing trust.
- Tying hygiene to daily intention / focus sessions (possible later; not required for v1 hygiene).
- Replacing Chrome’s native UX entirely — we **use** tab groups where useful.

## Concepts

| Term | Meaning |
|------|---------|
| **Park** | Close the tab and save `{ title, url, favIconUrl, parkedAt }` in extension storage. Restore later from Clarity. Frees the tab bar and memory. |
| **Chrome tab group** | Native Chrome group (`chrome.tabs.group` / `tabGroups`). Tabs stay open (often collapsed). Organizes in place; does not free memory. |
| **Stale / idle** | Tab not activated recently (`lastAccessed`, Chrome 121+). Heuristic only — reference tabs (Gmail, Calendar) can look stale while still wanted. |
| **Quiet tidy** | Background or threshold-triggered hygiene with minimal interruption. |

## Autonomy model (agreed direction)

| Action | Mode | Why |
|--------|------|-----|
| Close **exact URL duplicates** | Auto, silent | Unambiguous; no useful “keep both.” |
| Park **idle / stale** | Ask, grouped (“Park 12?”) | Guesses intention; need user confirm. |
| Auto-close (destroy without park) | Never | Trust cost too high. |
| Create / collapse **Chrome groups** | Assist / apply-on-confirm (later auto) | Organizes without losing context. |

## Implementation phases

### Phase 0 — Manual manager (shipped)

- [x] Module under `apps/extension/src/modules/tab-manager/`
- [x] Popup button **Manage Tabs**
- [x] Full page: search, park / restore, close duplicates, per-tab park/close
- [x] Scope: **This window** (default) vs **All windows**
- [x] Read Chrome group metadata (`tabGroups`); show group tags
- [x] Module on/off toggle
- [x] Calm-inspired lavender UI

### Phase 1 — Recency lanes + intra-day prompts (shipped)

- [x] Sort / bucket by `lastAccessed`: Active (&lt;1h) / Today (1–6h) / Idle (6h+)
- [x] Duplicate count on actions; auto-close exact duplicates when opening manager (setting, default on)
- [x] Popup line when idle tabs exist → opens manager
- [x] Threshold constant documented (`WINDOW_TAB_THRESHOLD`); badge deferred (Focus heightened owns action badge)
- [x] Visible undo for last park batch (toast + Undo button)

### Phase 2 — Native groups + quiet tidy

- [ ] Propose / apply Chrome tab groups (Active / Today / Idle or domain-heavy)
- [ ] Collapse idle groups by default
- [ ] Optional quiet tidy for very stale (2–3 days) with undo
- [ ] Pin / allowlist domains that must never auto-park

### Phase 3 — Clarity coupling (optional)

- [ ] Tie “keep set” to focus / morning intention
- [ ] Evening reflection: tabs parked / restored stats

## Code layout

```
apps/extension/src/modules/tab-manager/
├── index.html
├── tab-manager.css
├── tab-manager.ts      # UI
├── buckets.ts          # Active / Today / Idle thresholds
├── hygiene.ts          # duplicate pickers + snapshot helpers
├── storage.ts          # enabled, parked, undo, settings
└── index.ts
```

Build: Vite entry `tab-manager`; `copy-files` copies HTML/CSS to `dist/`. Permission: `tabs`, `tabGroups`.
