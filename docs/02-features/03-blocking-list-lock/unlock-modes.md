# Unlock modes: password vs friction (game)

This doc clarifies **how** users protect the block list when **weakening** it (remove rule, turn rule off). It complements [`README.md`](./README.md) (shipped **Phase 1** = password + timed session).

## Two different goals

| Goal | What it solves |
|------|----------------|
| **Password** | Only someone who knows the secret can unlock. **Fast** to unlock if you know it. |
| **Friction / challenge (“game”)** | Unlocking is **slow and tedious** on purpose—reduces impulse changes. Nothing to “forget”; the barrier is **time + annoyance** (e.g. count digits in grids). |

These can be **separate product choices**, **combined**, or **stacked** in later versions.

---

## Mode 1 — Password lock (shipped in Phase 1)

- User sets a **password** (Argon2 hash in `~/.clarity/blocking-lock.json`).
- **Remove** / **turn off** requires an **unlock session** after entering the password (~5 minutes by default), then **Re-lock** or expiry.
- **Add** rules and **turn rules on** stay allowed without unlock.

**Best for:** people who want a quick unlock when they’re intentional, and a clear “I forgot” story later (recovery / friend — future phases).

---

## Mode 2 — Friction-only lock (no memorized password)

- User chooses: **lock with a challenge** instead of a password.
- To **manage** (same scope: remove, turn off), they must complete **XYZ** every time—e.g. multiple grids, “how many `7`s in this grid,” wrong answers reset or add steps.
- **No password to forget**; the barrier is always **doing the work**.
- Optional: **cooldown** between attempts so retries aren’t spammed.

**Best for:** “I want it annoying to unlock settings, not secret-based.”

**Implementation note (future):** Rust verifies challenge answers (server-side not required); session start same as today: **in-memory unlock until** `now + duration`.

---

## Mode 3 — Hybrid (later)

Examples (not mutually exclusive):

- **Password + game:** must enter password **and** complete a short challenge to start session.
- **Password for session, game for danger:** password unlocks 5 minutes; **changing password** or **disabling lock entirely** requires the full game.
- **Nth unlock:** every 3rd unlock adds an extra grid.

Ship **Mode 1** or **Mode 2** first; combine only when both flows are stable.

---

## User-facing setup flow (target)

1. **First time** (Blocking / lock settings):

   **“How should we protect removing rules?”**

   - **A — Password:** remember it; unlock is relatively quick when intentional.
   - **B — Friction challenge:** no password; unlocking is always **long and annoying** (estimate shown: e.g. “~2 minutes of steps”).
   - *(Later)* **C — Friend / alert:** accountability partner, not the v2 core.

2. **Each time** they need remove / turn off:

   | Mode | Gate |
   |------|------|
   | Password | Enter password → timed manage session → Re-lock. |
   | Friction | Complete full challenge **then** same timed session (or challenge-only if you prefer no timer—product call). |

3. **“I forgot”**

   - **Password mode:** dedicated recovery (friend code, long game, email—**Phase 2+**).
   - **Friction-only:** nothing to forget; optional **cooldown** only.

4. **Friend / accountability (later)**

   - “Request unlock” → friend approves or sends **one-time code** for a **single** session.
   - Sits **beside** password or friction; does not replace the core lock.

---

## Roadmap alignment

| Phase | Content |
|-------|---------|
| **Phase 1 (done)** | Password + timed unlock + re-lock; gate remove / toggle-off in desktop. |
| **Phase 2a (candidate)** | **Friction-only** path: choose at setup, challenge generator + verification in app, same session semantics. |
| **Phase 2b (candidate)** | Password **recovery** (annoying grid flow → set new password) **if** we keep password as primary. |
| **Phase 3** | Hybrid rules, optional friend alert, extension / hardening per [`README.md`](./README.md). |

---

## Product decisions to lock before building Phase 2a

1. **Friction mode:** after a successful challenge, use the **same **~5 min** session** as password mode, or **no timer** (must challenge every action)?
2. **Switching modes:** once set, can user switch Password ↔ Friction without re-entering / extra proof?
3. **Minimum difficulty:** number of grids, digits, penalty for wrong answer (reset step vs add grid).

---

## One-line summary

**Either** a **password** (fast if you know it) **or** a **mandatory annoying game** (nothing to forget, always painful to unlock) **or** both stacked later; **friend alert** is accountability on top, not a replacement for the core lock.
