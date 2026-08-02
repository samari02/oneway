# Tab Manager — workspace hygiene direction

**Last update:** 2026-08-02

Design notes from product discussion (2026-08-02). Captures **why** the module should evolve beyond a manual list, and decisions to validate in Phase 1–2.

---

## Insight

A page the user must remember to open will not fix pollution **at time t**. Intra-day tab opening means a once-per-day tidy is **too late** — the damage is already done by afternoon.

So the module should become a **quiet hygiene assistant**:

- Signals accumulate in the background (counts, idle buckets)
- Surface at natural moments (popup open, badge, hard threshold) — not every 10 minutes
- Prefer **reversible** actions

Manual domain lists (v0) remain useful for inspection; they are not the primary UX for “too many tabs right now.”

---

## UI experiments considered (not chosen as primary)

| Concept | Idea | Limitation for this problem |
|---------|------|------------------------------|
| A Domain cards | Summary cards per host | Still manual exploration |
| B Accordion | Collapse domain rows | Cleaner list; still list-first |
| C Noise triage | Duplicates / heavy / other windows first | Closer — action-first |
| D Split pane | Domains left, tabs right | Good for inspect; not always-on |
| Smart lanes | Active / Today / Stale | Strong **structure** for Phase 1 |
| Propose groups | Named stacks to Apply | Impressive but fragile if semantic |
| Always-on dashboard | Score + suggestion feed + timeline | Right **philosophy**; combine with lanes |

**Preferred blend:** philosophy of **always-on** + structure of **recency lanes**, with **Chrome groups** for in-place organize and **park** for true abandonment.

---

## Signal: `lastAccessed`

- Available on `chrome.tabs.Tab` (Chrome 121+)
- Updates when a tab **becomes active** in its window — not on scroll/refresh alone
- Switching windows may not refresh the foreground tab’s timestamp the way users expect
- **Pinned / reference tabs** (Calendar, Gmail) often look “stale” while still wanted → need allowlist / never auto-park pinned

Use for bucketing and sorting; do not treat as perfect intent.

---

## Park vs Chrome tab groups

Both are valid; they solve different layers:

```text
During the day (organize in place)
  → Chrome groups: Active / Today / Idle (collapsed)
  → Tab bar stays usable; memory still used

When clearly abandoned
  → Park: close + save in Clarity storage
  → Bar + memory cleaned; restore from Parked

Never (by default)
  → Auto-close without park
```

Extensions **can** create Chrome groups via `chrome.tabs.group` and set title/color/collapsed via `chrome.tabGroups.update`. v0 only **reads** groups; write path is Phase 2.

---

## Triggers (intra-day, not only nightly)

| Trigger | Role |
|---------|------|
| Soft badge on extension icon | Silent: “12 idle” — no modal (deferred: heightened owns badge) |
| Popup / Manage Tabs open | Grouped CTA: “Park N idle (6h+)?” |
| Hard threshold (e.g. 40 tabs in window) | Rare nudge |
| End of day / next morning | Safety net for long-stale |
| Continuous 10-minute nag | **Avoid** — fights Clarity’s focus ethos |

### Recency lanes (agreed)

| Lane | Last touched | Chrome group (Phase 2) |
|------|----------------|-------------------------|
| **Active** | &lt; 1h | open |
| **Today** | 1h–6h | collapsed (replié) |
| **Idle** | 6h+ | collapsed / fermé |

---

## Autonomy ladder

1. **Silent:** close exact duplicate URLs (same URL key, keep one; skip pinned)
2. **Confirm once (batched):** park idle set
3. **Confirm / apply:** create or reshape Chrome groups
4. **Later, optional:** quiet park of very-stale with undo toast
5. **Never default:** destroy tabs with no park / no undo

**Undo:** last park batch must be one-click restorable (toast or parked list prominence). Without undo, users will refuse autonomy.

---

## v1 feature cut (Phase 1 — shipped 2026-08-02)

Shipped:

- [x] Buckets: Active (recent) / Today / Idle — based on `lastAccessed` thresholds
- [x] Popup idle count + open manager
- [x] Exact duplicate auto-close on manager open (setting, default on)
- [x] Undo last park batch
- [x] Keep **This window** default

Nice to have next (Phase 2):

- [ ] Create collapsed Chrome group “Idle” for current window
- [ ] Domain allowlist / honor pinned (pinned already skipped for park idle)
- [ ] Search results already sorted by recency within lanes
- [ ] Action badge for idle (deferred — heightened mode owns badge)

---

## Open questions

1. Idle threshold defaults — e.g. Active &lt; 30m, Today &lt; 12h, else Idle? Needs real usage tuning.
2. Badge vs popup-only for Phase 1 — badge needs icon badging API + clear UX when Clarity Focus Mode is also “the” badge story.
3. Should “Park all except current” remain primary, or yield to “Park idle” as the hero action?
4. Multi-window: park only current window by default when confirming idle?

---

## Alignment with Clarity

Clarity’s end-of-day story is **stay focused and clear on digital usage**. Tab hygiene is in-scope as **workspace clarity**, not as a separate tab product — as long as it stays:

- optional / toggleable
- non-nagging
- reversible
- independent of goals until we deliberately couple them
