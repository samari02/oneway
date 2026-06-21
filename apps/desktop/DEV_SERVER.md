# Desktop dev server (hot reload)

The Clarity desktop app is a **Tauri 2** shell around a **Vite 7 + React 19** frontend. In development, the native window loads the Vite dev server URL, so **Vite HMR (Hot Module Replacement)** and **React Fast Refresh** (`@vitejs/plugin-react`) update the UI as soon as you save a file—no full app restart for typical UI changes.

## How to run

From the repo root:

```bash
pnpm dev:desktop
```

From `apps/desktop`:

```bash
pnpm dev
```

Both run `tauri dev`, which:

1. Starts the Vite dev server (`beforeDevCommand`: `pnpm vite` in `src-tauri/tauri.conf.json`).
2. Opens the Tauri window pointed at `devUrl`: `http://localhost:1420`.

Requirements: Rust toolchain (for Tauri), Node/pnpm, and dependencies installed at the monorepo root.

## What enables auto-refresh

| Piece | Role |
| --- | --- |
| **Vite dev server** | Watches source and `public/` assets; pushes updates over HMR WebSocket. |
| **`@vitejs/plugin-react`** | React Fast Refresh for component/state-preserving updates. |
| **Tauri `devUrl`** | WebView loads the live dev server instead of a static build. |

Relevant settings in `vite.config.ts`:

- **`server.port: 1420`** and **`strictPort: true`** — fixed port expected by Tauri.
- **`server.hmr`** — when `TAURI_DEV_HOST` is set (e.g. physical device / remote dev), HMR uses WebSocket on port **1421** with that host; otherwise Vite uses default local HMR.
- **`server.watch.ignored: ["**/src-tauri/**"]`** — Rust backend changes do not trigger frontend rebuilds; Rust edits still trigger Tauri’s own rebuild/restart.

Preview production build locally (no Tauri window):

```bash
pnpm vite build && pnpm preview
```

## Ports and environment

| Variable / setting | Purpose |
| --- | --- |
| **1420** | Vite dev server (HTTP) — must match `build.devUrl` in `tauri.conf.json`. |
| **1421** | HMR WebSocket when `TAURI_DEV_HOST` is configured. |
| **`TAURI_DEV_HOST`** | Optional; enables HMR when the WebView is not on localhost (see Tauri mobile/remote dev docs). |
| **`.env.local`** | Copy from `.env.example`; `VITE_*` vars are injected by Vite at dev/build time (Supabase, optional morning ambient audio URL, etc.). Never commit real secrets. |

## Notes

- **Rust-only changes** under `src-tauri/` recompile via `tauri dev` but are excluded from Vite’s file watcher; expect a shorter backend rebuild, not just HMR.
- **Frontend changes** under `src/` and static files under `public/` should hot-reload in the open window—the behavior this doc is meant to preserve when adjusting tooling.
