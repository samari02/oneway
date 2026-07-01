# Tauri dev troubleshooting

**Last update:** 2026-07-02

Practical fixes for issues seen during local desktop development. For day-to-day dev server setup, see also [`apps/desktop/DEV_SERVER.md`](../apps/desktop/DEV_SERVER.md).

---

## 1. Sidebar not clickable in Tauri (works in browser)

### Symptoms

- Sidebar nav items do not respond to clicks in the **Tauri window**.
- Same UI works fine in a plain browser tab on `http://localhost:1420`.

### Cause

Two overlapping issues:

1. **Implicit drag regions** — On macOS, Tauri `titleBarStyle: "Overlay"` (`tauri.conf.json`) plus CSS `-webkit-app-region: drag` makes WKWebView treat large areas as window-drag targets. Clicks are swallowed before they reach interactive elements.
2. **Full-viewport modal backdrop** — `TasksView` plan modal used `inset: 0` with a high `z-index`, covering the sidebar even when the modal content was centered in the main pane.

### Fixes applied

| Area | Change |
|------|--------|
| **Global** | `html { -webkit-app-region: no-drag; }` in `global.css` — only `startDragging()` in `App.tsx` moves the window |
| **Titlebar** | Removed CSS drag region; titlebar scoped to content area (`left: 72px`, expands to `200px` when sidebar pinned/hovered) |
| **Sidebar** | `z-index: 300`, `pointer-events: auto`, explicit `no-drag` on `.sidebar` and descendants in `Sidebar.css` |
| **Tasks modal** | Backdrop scoped to content (`top: 38px`, `left: 72px` / `200px`), `z-index: 90` so sidebar stays above and clickable |

### Verify

Run `pnpm dev:desktop` and test sidebar clicks **in the Tauri window**, not only in Chrome.

---

## 2. Immediate crash (SIGABRT) on launch

### Symptoms

- App exits immediately on startup with **SIGABRT** (no useful UI).
- May appear after app-blocking / monitoring code paths run.

### Cause

1. **`eprintln!` in Rust** — In `app_monitor.rs`, `eprintln!` uses `_eprint`, which **panics** if stderr lock/write fails. That happens during Tauri IPC `invoke` in GUI apps.
2. **Duplicate monitoring start** — `start_app_monitoring` is invoked from both `App.tsx` and `useAppBlocking`. The second call is harmless (guard returns early) but increases IPC traffic during startup.

### Fix

Replace `eprintln!` with a non-panicking `monitor_log!` macro that ignores write errors:

```rust
fn monitor_log(args: std::fmt::Arguments<'_>) {
    let _ = std::io::Write::write_fmt(&mut std::io::stderr(), args);
    let _ = std::io::Write::write_all(&mut std::io::stderr(), b"\n");
}
```

All `[AppMonitor]` logging in `app_monitor.rs` uses `monitor_log!` instead of `eprintln!`.

---

## 3. Dev won't start — port 1420 in use

### Symptoms

- `pnpm dev:desktop` fails because Vite cannot bind to port **1420** (`strictPort: true` in `vite.config.ts`).

### Cause

Stale Vite or `tauri dev` processes from a previous session still holding the port.

### Fix

```bash
lsof -ti :1420 | xargs kill -9
pnpm dev:desktop
```

If it persists, also check port **1421** (HMR WebSocket when `TAURI_DEV_HOST` is set).

---

## 4. Supabase migrations order

When applying migrations manually or debugging schema errors, respect this order:

| Migration | Purpose | Notes |
|-----------|---------|-------|
| **019** `focus_areas.sql` | Base `focus_areas` table | Required before 023 |
| **021** `monk_chat_sessions.sql` | Monk chat persistence | Uses `CREATE TABLE IF NOT EXISTS` — safe to skip if already applied |
| **022** `tasks_planning.sql` | Task planning columns (`planning`, `sort_order`) | Required for Tasks kanban |
| **023** `focus_areas_parent.sql` | `parent_id` hierarchy (buckets → sub-categories) | Depends on 019 |

**023 behaviour:** `parent_id IS NULL` = top-level bucket; `parent_id` set = sub-category. Existing flat areas are reparented under a per-user **General** bucket on first run.

Typical error if order is wrong: `relation "focus_areas" does not exist` (023 before 019) or missing `planning` column on tasks (Tasks UI before 022).
