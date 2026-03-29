# Features map (`docs/02-features/`)

**Last update:** 2026-03-29

Product specs are grouped into **numbered domains** (rough order: product orientation → platform). Dated filenames follow [00-documentation-naming-rules_2026-03-28.md](../03-runbooks/00-documentation-naming-rules_2026-03-28.md).

---

## Overview

| Folder | Theme | Main content |
|--------|--------|----------------|
| **[01-orientation-objectifs](./01-orientation-objectifs/)** | North Star & habits | `north-star.md`, `habits-boundaries.md` |
| **[02-blocage](./02-blocage/)** | Blocking & protection (extension) | `overview`, `intelligent-blocking`, `boundaries_blocking_rules_ux_*`, `custom_blocking_rules_implementation_*` (desktop + DB), `content-analysis`, `implementation` |
| **[03-insights-et-donnees](./03-insights-et-donnees/)** | Measurement & classification | `site-classification`, `screen-time`, `delete_site_browsing_data_*`, `classification/overview` |
| **[04-companion-ia](./04-companion-ia/)** | Aoi & AI companion | `ai-companion.md` (desktop app), [aoi-widget/](./04-companion-ia/aoi-widget/) (browser) |
| **[05-plateforme-desktop-extension](./05-plateforme-desktop-extension/)** | Desktop ↔ Chrome bridge | [clarity-connectivity/](./05-plateforme-desktop-extension/clarity-connectivity/) |

---

## Tree

```
02-features/
├── README.md                 ← this file
├── 01-orientation-objectifs/
├── 02-blocage/
│   ├── boundaries_blocking_rules_ux_2026-03-29.md
│   └── custom_blocking_rules_implementation_2026-03-29.md
├── 03-insights-et-donnees/
│   ├── delete_site_browsing_data_2026-03-29.md
│   └── classification/
├── 04-companion-ia/
│   └── aoi-widget/
└── 05-plateforme-desktop-extension/
    └── clarity-connectivity/
```

---

## Repo doc index

See [README.md](../README.md) at the root of `docs/` for the full list (vision, architecture, guides, etc.).
