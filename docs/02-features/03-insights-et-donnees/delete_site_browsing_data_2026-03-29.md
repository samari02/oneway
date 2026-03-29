# Delete site browsing data (local)

**Last update:** 2026-03-29

---

## Summary

Users can **remove all stored data for a specific website** from the Clarity desktop app: visits, block events tied to that domain, and the **saved site classification** entry. Data lives in local files under the app data directory (`clarity-data`); **browsing history is not synced to a remote database** in the current product, so deletion is **local-only**.

---

## User-facing entry points

### 1. Settings → Browsing Data

- Component: `apps/desktop/src/features/settings/components/DeleteSiteDomainPicker.tsx`
- **List** comes from `list_tracked_domains` (Tauri): unique domains aggregated from visits, block events, and classification keys.
- **Search**: type at least **two characters** → dropdown filters matching domains from that list.
- **Select** a row to fill the field, or type a full hostname manually.
- **Delete site data…** opens an **inline confirmation** (no native `window.confirm`, which is unreliable in Tauri’s webview).
- **Status message** after the action reports counts removed, or explains when **nothing matched** (wrong spelling / domain not in storage).

### 2. Screen Time → Overview → Top Sites (web rows only)

- Component: `apps/desktop/src/features/stats/components/TopSitesCard.tsx`
- A **trash** control on each **web** row calls the same delete command for that row’s domain, then `refetch` via `onSiteDataDeleted` in `OverviewTab`.

---

## Backend (Tauri / Rust)

| Command | Purpose |
|---------|---------|
| `list_tracked_domains` | Returns sorted unique normalized domains for the picker. |
| `delete_browsing_data_for_domain(domain)` | Rewrites `visits.jsonl` and `blocks.jsonl` without matching rows; removes matching keys from `classifications.json`. Returns `DeleteSiteStats` (`visitsRemoved`, `blocksRemoved`, `classificationRemoved`). |

Implementation: `apps/desktop/src-tauri/src/browsing_data.rs` (`list_tracked_domains`, `delete_data_for_domain`, `normalize_domain_input`, `domain_matches_normalized`).

**Domain matching**

- Input is normalized (lowercase, strip `https://`, path, leading `www.`).
- **Subdomains**: deleting `youtube.com` also removes rows for `m.youtube.com` (suffix rule with a dot in the needle, to avoid deleting “all `.com`” by mistake).

**Scope**

- Does **not** clear extension Chrome storage or remote Supabase tables for visits (not implemented for browsing history today).
- **Clear All Data** in Settings still wipes visit/block **files** entirely; it does not remove `classifications.json` by design in the older flow—per-domain delete **does** remove classification for that site only.

---

## Frontend notes

- Invoke responses are parsed with **camelCase and snake_case** fallibility (`visitsRemoved` vs `visits_removed`) because serde/Tauri boundaries can differ.
- After delete, Settings refreshes stats via `onDataChanged` → `get_browsing_stats`; the picker calls `list_tracked_domains` again.

---

## Related docs

- [screen-time.md](./screen-time.md) — Screen Time overview & Top Sites
- [site-classification.md](./site-classification.md) — Classification storage (overlaps with `classifications.json`)
- [clarity_desktop_extension_connectivity_2026-03-28.md](../05-plateforme-desktop-extension/clarity-connectivity/clarity_desktop_extension_connectivity_2026-03-28.md) — Extension ↔ desktop bridge (separate from delete-by-domain)
