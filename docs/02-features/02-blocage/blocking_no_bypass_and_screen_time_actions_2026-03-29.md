# Blocking: no bypass, Boundaries tab order, Screen Time → block list

## Extension (Chrome)

- **Block interstitial** (`apps/extension/src/ui/block-screen/`): single action **Go back**; no “visit anyway”, no reason radios, no Continue.
- **Service worker** (`apps/extension/src/background/service-worker.ts`): removed `BYPASS_BLOCK` handling, `handleBypass`, and tab allowlisting via `allowedTabs`. A blocked navigation stays blocked until rules change.

Rebuild: `cd apps/extension && npm run build` (updates `dist/`).

## Desktop app

### Boundaries

- **Tab order**: **Blocking** is first, then System Health, then Habits.
- **Default tab**: opening Boundaries lands on **Blocking**.

### Screen Time → Overview → Top Sites

- For **web** rows, the trash control is replaced by a **⋯** menu:
  - **Add to block list** — creates a custom blocking rule (same rules as Boundaries → Blocking), with note `From Screen Time`. Duplicate domains/keywords show an error.
  - **Delete stored data** — same as before: removes local visits/block history for that domain (requires confirmation).

Requires signed-in user for “Add to block list”; if not signed in, only delete is available.

## Block list UI (Boundaries)

The **Blocking** tab shows a short user-facing intro (what the list does, last sync time). Technical implementation details belong in repo docs, not in the app.

## Screen Time: “Blocked” badge

On **Overview → Top Sites**, web rows that **match an active custom rule** show a **Blocked** pill and a light highlight. Matching uses `domainMatchesActiveBlockingRules()` in `customBlockingRules.ts` (best-effort for UI; the extension performs real blocking). The ⋯ menu disables **Add to block list** when the site already matches.
