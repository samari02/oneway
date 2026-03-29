# Oneway Documentation

> Un copilote pour rester dans le droit chemin.

---

## 📚 Structure

### [01-vision/](./01-vision/) — Pourquoi on fait ça
- [concept.md](./01-vision/concept.md) — Mission, philosophie, persona
- [product-principles.md](./01-vision/product-principles.md) — Principes de design
- [roadmap.md](./01-vision/roadmap.md) — Ce qui est fait et ce qui reste

### [02-features/](./02-features/) — Specs des features
- [clarity-connectivity/](./02-features/clarity-connectivity/) — Pont desktop ↔ extension, auth, heartbeats
  - [clarity_desktop_extension_connectivity_2026-03-28.md](./02-features/clarity-connectivity/clarity_desktop_extension_connectivity_2026-03-28.md)
- [aoi-widget/](./02-features/aoi-widget/) — Bulle + mascotte sur les pages web (extension)
  - [aoi_floating_widget_browser_2026-03-28.md](./02-features/aoi-widget/aoi_floating_widget_browser_2026-03-28.md)
- [habits-boundaries.md](./02-features/habits-boundaries.md) — Système d'habitudes
- [north-star.md](./02-features/north-star.md) — Objectif principal
- [ai-companion.md](./02-features/ai-companion.md) — Coach IA dans l’app desktop (≠ widget navigateur)
- [site-classification.md](./02-features/site-classification.md) — Classification des sites
- [blocking/](./02-features/blocking/) — Système de blocage intelligent
  - [overview.md](./02-features/blocking/overview.md)
  - [intelligent-blocking.md](./02-features/blocking/intelligent-blocking.md)
  - [content-analysis.md](./02-features/blocking/content-analysis.md)

### [03-architecture/](./03-architecture/) — Comment c'est construit
- [overview.md](./03-architecture/overview.md) — Architecture globale
- [data-pipeline.md](./03-architecture/data-pipeline.md) — Flux de données
- [browser-extension.md](./03-architecture/browser-extension.md) — Extension Chrome
- [native-messaging.md](./03-architecture/native-messaging.md) — Communication extension ↔ desktop
- [history-collection.md](./03-architecture/history-collection.md) — Collecte d'historique

### [03-runbooks/](./03-runbooks/) — Conventions & runbooks
- [00-documentation-naming-rules_2026-03-28.md](./03-runbooks/00-documentation-naming-rules_2026-03-28.md) — Nommage des fichiers `.md`

### [04-guides/](./04-guides/) — Guides & contribution
- [comprendre_l_application_2026-03-28.md](./04-guides/comprendre_l_application_2026-03-28.md) — Vue d’ensemble pédagogique (desktop, extension, données)
- [build_et_distribution_2026-03-28.md](./04-guides/build_et_distribution_2026-03-28.md) — Dev vs release, `.app`, Vercel, multi-machines, distribution
- [extension-debug.md](./04-guides/extension-debug.md) — Débugger l'extension

### [05-backlog/](./05-backlog/) — Idées futures
- [feature-ideas.md](./05-backlog/feature-ideas.md) — Backlog de features

### [changelog/](./changelog/) — Historique
- [1.log.md](./changelog/1.log.md) — Journal des changements

---

## 🚀 Quick Start

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

## 🛠 Stack

| Layer | Tech |
|-------|------|
| Desktop | Tauri + React + TypeScript |
| Extension | Chrome Manifest V3 |
| Backend | Supabase (Postgres + Auth) |
| AI | OpenAI GPT-4 |
