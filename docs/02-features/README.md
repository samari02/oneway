# Features map (`docs/02-features/`)

**Last update:** 2026-08-02

Product specs are grouped into **numbered domains** (rough order: product orientation → platform). Dated filenames follow [00-documentation-naming-rules_2026-03-28.md](../03-runbooks/00-documentation-naming-rules_2026-03-28.md).

---

## Overview

| Folder | Theme | Main content |
|--------|--------|----------------|
| **[01-orientation-objectifs](./01-orientation-objectifs/)** | North Star & habits | `north-star.md`, `habits-boundaries.md` |
| **[02-blocage](./02-blocage/)** | Blocking & protection (extension) | `overview`, `intelligent-blocking`, [`blocking-flow-interactive.html`](./02-blocage/blocking-flow-interactive.html) (viz · boucle auto-améliorante), `adult_blocklist_sync_v1`, `public_adult_lists_import_v1`, `self_improving_blocking_loop_v1`, `boundaries_blocking_rules_ux_*`, `custom_blocking_rules_implementation_*`, `custom_blocking_sync_architecture_*` (desktop ↔ extension), `content-analysis`, `implementation` |
| **[03-blocking-list-lock](./03-blocking-list-lock/)** | Block-list password / friction lock | `README`, `spec`, `unlock-modes` |
| **[03-insights-et-donnees](./03-insights-et-donnees/)** | Measurement & classification | `site-classification`, `screen-time`, `delete_site_browsing_data_*`, `classification/overview` |
| **[04-companion-ia](./04-companion-ia/)** | Aoi & AI companion | `ai-companion.md` (desktop app), [aoi-widget/](./04-companion-ia/aoi-widget/) (browser) |
| **[05-plateforme-desktop-extension](./05-plateforme-desktop-extension/)** | Desktop ↔ Chrome bridge | [clarity-connectivity/](./05-plateforme-desktop-extension/clarity-connectivity/) |
| **[06-tab-manager](./06-tab-manager/)** | Tab / workspace hygiene (extension module) | `README`, `overview` (v0), `tab_manager_workspace_hygiene_*` (direction & ideas) |

---

## Tree

```
02-features/
├── README.md                 ← this file
├── 01-orientation-objectifs/
├── 02-blocage/
│   ├── blocking-flow-interactive.html
│   ├── boundaries_blocking_rules_ux_2026-03-29.md
│   ├── custom_blocking_rules_implementation_2026-03-29.md
│   └── custom_blocking_sync_architecture_2026-03-29.md
├── 03-blocking-list-lock/
├── 03-insights-et-donnees/
│   ├── delete_site_browsing_data_2026-03-29.md
│   └── classification/
├── 04-companion-ia/
│   └── aoi-widget/
├── 05-plateforme-desktop-extension/
│   └── clarity-connectivity/
└── 06-tab-manager/
    ├── README.md
    ├── overview.md
    └── tab_manager_workspace_hygiene_2026-08-02.md
```

---

## Repo doc index

See [README.md](../README.md) at the root of `docs/` for the full list (vision, architecture, guides, etc.).
