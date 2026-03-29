# Oneway documentation

> A copilot to help you stay on track.

---

## Structure

### [01-vision/](./01-vision/) — Why we build this
- [concept.md](./01-vision/concept.md) — Mission, philosophy, persona
- [product-principles.md](./01-vision/product-principles.md) — Design principles
- [roadmap.md](./01-vision/roadmap.md) — Shipped vs planned

### [02-features/](./02-features/) — Feature specs

Index and layout: **[02-features/README.md](./02-features/README.md)**.

- **[01-orientation-objectifs/](./02-features/01-orientation-objectifs/)** — North Star & habits
  - [north-star.md](./02-features/01-orientation-objectifs/north-star.md)
  - [habits-boundaries.md](./02-features/01-orientation-objectifs/habits-boundaries.md)
- **[02-blocage/](./02-features/02-blocage/)** — Intelligent blocking (extension)
  - [overview.md](./02-features/02-blocage/overview.md)
  - [intelligent-blocking.md](./02-features/02-blocage/intelligent-blocking.md)
  - [content-analysis.md](./02-features/02-blocage/content-analysis.md)
  - [implementation.md](./02-features/02-blocage/implementation.md)
- **[03-insights-et-donnees/](./02-features/03-insights-et-donnees/)** — Site insights & data
  - [site-classification.md](./02-features/03-insights-et-donnees/site-classification.md)
  - [screen-time.md](./02-features/03-insights-et-donnees/screen-time.md)
  - [delete_site_browsing_data_2026-03-29.md](./02-features/03-insights-et-donnees/delete_site_browsing_data_2026-03-29.md)
  - [classification/overview.md](./02-features/03-insights-et-donnees/classification/overview.md)
- **[04-companion-ia/](./02-features/04-companion-ia/)** — AI companion & Aoi
  - [ai-companion.md](./02-features/04-companion-ia/ai-companion.md) — Coach in the desktop app (not the browser widget)
  - [aoi-widget/](./02-features/04-companion-ia/aoi-widget/) — Floating mascot on web pages (extension)
    - [aoi_floating_widget_browser_2026-03-28.md](./02-features/04-companion-ia/aoi-widget/aoi_floating_widget_browser_2026-03-28.md)
- **[05-plateforme-desktop-extension/](./02-features/05-plateforme-desktop-extension/)** — Desktop ↔ extension bridge
  - [clarity-connectivity/](./02-features/05-plateforme-desktop-extension/clarity-connectivity/) — Auth, heartbeats, native host
    - [clarity_desktop_extension_connectivity_2026-03-28.md](./02-features/05-plateforme-desktop-extension/clarity-connectivity/clarity_desktop_extension_connectivity_2026-03-28.md)

### [03-architecture/](./03-architecture/) — How it is built
- [overview.md](./03-architecture/overview.md) — System overview
- [data-pipeline.md](./03-architecture/data-pipeline.md) — Data flow
- [browser-extension.md](./03-architecture/browser-extension.md) — Chrome extension
- [native-messaging.md](./03-architecture/native-messaging.md) — Extension ↔ desktop
- [history-collection.md](./03-architecture/history-collection.md) — History collection

### [03-runbooks/](./03-runbooks/) — Conventions & runbooks
- [00-documentation-naming-rules_2026-03-28.md](./03-runbooks/00-documentation-naming-rules_2026-03-28.md) — `.md` file naming

### [04-guides/](./04-guides/) — Guides (FR) & contribution
- [comprendre_l_application_2026-03-28.md](./04-guides/comprendre_l_application_2026-03-28.md) — Product overview (desktop, extension, data)
- [build_et_distribution_2026-03-28.md](./04-guides/build_et_distribution_2026-03-28.md) — Dev vs release, `.app`, Vercel, multi-machine
- [extension-debug.md](./04-guides/extension-debug.md) — Debugging the extension

### [05-backlog/](./05-backlog/) — Future ideas
- [feature-ideas.md](./05-backlog/feature-ideas.md) — Feature backlog

### [06-debug/](./06-debug/) — Debug notes & reproduction
- [README.md](./06-debug/README.md) — Index
- [extension_heartbeat_protection_banner_debug_2026-03-28.md](./06-debug/extension_heartbeat_protection_banner_debug_2026-03-28.md) — Protection banner / extension heartbeats

### [changelog/](./changelog/) — History
- [1.log.md](./changelog/1.log.md) — Change log

---

## Quick start

```bash
# Clone
git clone https://github.com/samari02/oneway.git

# Install
pnpm install

# Run desktop app
cd apps/desktop && pnpm tauri dev

# Run extension (load unpacked from apps/extension/dist)
cd apps/extension && pnpm build
```

---

## Stack

| Layer | Tech |
|-------|------|
| Desktop | Tauri + React + TypeScript |
| Extension | Chrome Manifest V3 |
| Backend | Supabase (Postgres + Auth) |
| AI | OpenAI GPT-4 |
