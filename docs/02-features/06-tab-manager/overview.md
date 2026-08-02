# Tab Manager — overview (shipped v0)

**Last update:** 2026-08-02

Technical snapshot of the **shipped** independent module. Product roadmap and open design notes: [`tab_manager_workspace_hygiene_2026-08-02.md`](./tab_manager_workspace_hygiene_2026-08-02.md) and [`README.md`](./README.md).

---

## Entry points

1. Clarity extension **popup** → button **Manage Tabs**
2. Opens `chrome-extension://<id>/tab-manager.html` in a new tab
3. Module **On/Off** toggle on the manager page (`tabManager.enabled`; default on)

When off, the manager page shows a disabled state; the popup button still opens the page so the user can re-enable.

---

## Storage (`chrome.storage.local`)

| Key | Type | Purpose |
|-----|------|---------|
| `tabManager.enabled` | `boolean` | Module toggle (`false` = off; missing = on) |
| `tabManager.parked` | `ParkedTab[]` | Parked tabs awaiting restore |

```ts
interface ParkedTab {
  title: string
  url: string
  favIconUrl?: string
  parkedAt: number
}
```

---

## UI (board + group-by)

- **Group by** pills: Time · Theme · Site · Window
- Board columns (chips: title + age, no URL wall)
- Primary: **Apply as Chrome groups** (+ Clear Clarity groups)
- Secondary: Park idle · Close duplicates · Restore / Undo
- Scope: This window (default) | All windows
- Parked list under “More actions”

---

## Chrome APIs used

| API | Use |
|-----|-----|
| `chrome.tabs.query` | List tabs (all windows; filter by current window in UI) |
| `chrome.tabs.remove` / `create` / `update` | Close, park (= remove after save), restore, activate |
| `chrome.windows.getCurrent` / `update` | Scope + focus window when activating a tab |
| `chrome.tabGroups.get` / `onUpdated` | Titles + collapsed state for tags (v0 read-only) |

**Note:** `Tab.lastAccessed` (Chrome 121+) powers Phase 1 lanes (Active / Today / Idle).

**Park vs group:** Phase 1 **parks** (close + storage) with undo. Creating/updating Chrome groups remains Phase 2 (`chrome.tabs.group`, `tabGroups.update`).

### Storage keys (Phase 1+)

| Key | Purpose |
|-----|---------|
| `tabManager.enabled` | Module on/off |
| `tabManager.parked` | Parked tabs |
| `tabManager.undoPark` | Last park batch for undo |
| `tabManager.autoCloseDuplicates` | Auto-close on manager open (default on) |

---

## Permissions

In `apps/extension/manifest.json`:

- `tabs` (already required for blocking)
- `tabGroups` (added for Tab Manager)

---

## Build

- Vite input: `tab-manager` → `dist/tab-manager.js`
- `package.json` `copy-files`: copies `index.html` → `dist/tab-manager.html`, CSS → `dist/tab-manager.css`

Reload the unpacked extension from `apps/extension/dist` after build.
