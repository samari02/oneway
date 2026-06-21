# Companion avatar PNGs

Drop `.png` files here to add alternate hero characters on **Clarity Home**.

## How it works

- Files in this folder are auto-discovered at dev/build time via Vite `import.meta.glob`.
- After adding or removing a PNG, restart the dev server (`pnpm dev` from `apps/desktop`).
- Avatars appear in the hero **character switcher** (cycle button on Clarity Home).

## Naming

Use lowercase, hyphenated names when possible (e.g. `my-avatar.png`). The label in the UI is derived from the filename.

## Built-in modes (not in this folder)

- **Orb** — default mascot blob (no speech bubble)
- **Bubble** — mascot with speech bubble
- **Live2D** — Asuka / Jian models from `public/v2/` (when available)
