# Spec: blocking list lock

For **password vs friction (“game”) unlock modes** and roadmap alignment, see [`unlock-modes.md`](./unlock-modes.md).

## Data on disk

**Path:** `~/.clarity/blocking-lock.json`

**Password mode (v2):** (keys are snake_case in the file)

```json
{
  "version": 2,
  "lock_kind": "password",
  "password_hash": "<Argon2 PHC string>",
  "unlock_duration_secs": 300
}
```

**Friction mode (v2):**

```json
{
  "version": 2,
  "lock_kind": "friction",
  "unlock_duration_secs": 300
}
```

Legacy **v1** files with only `password_hash` are read as password mode.

- `passwordHash`: Argon2id (password mode only).
- `unlockDurationSecs`: default **300**.

If the file is **missing**, treat as **no lock configured**.

## Tauri commands

| Command | Input | Output | Notes |
|---------|--------|--------|--------|
| `blocking_lock_get_status` | — | `{ hasLock, lockKind, unlockedUntilMs, unlockDurationSecs, canManageDestructive }` | `lockKind`: `none` \| `password` \| `friction`. |
| `blocking_lock_set_password` | `newPassword`, `currentPassword?` | `Result<(), string>` | Password mode only; errors if friction lock active. |
| `blocking_lock_set_friction` | — | `Result<(), string>` | Creates friction lock; errors if password lock exists. |
| `blocking_lock_verify_unlock` | `password` | `Result<(), string>` | Password mode only; starts session. |
| `blocking_lock_friction_start` | — | `FrictionChallengeStart` | Friction mode only; pending challenge in memory (~10 min TTL). |
| `blocking_lock_friction_submit` | `challengeId`, `answers: number[]` | `Result<(), string>` | Verifies counts; starts session on success. |
| `blocking_lock_relock` | — | `()` | Clears session and pending friction challenge. |
| `blocking_lock_clear` | — | `Result<(), string>` | Deletes lock file **only** while an unlock session is active (turn off protection). |

Session storage: **in-process** `Mutex<Option<Instant>>` (or ms timestamp). **Not** written to disk (restart = locked).

## Permission matrix (desktop Blocking tab)

| Action | No password | Password + locked | Password + unlocked |
|--------|-------------|-------------------|----------------------|
| Add rule | ✓ | ✓ | ✓ |
| Quick-add presets | ✓ | ✓ | ✓ |
| Toggle rule **on** | ✓ | ✓ | ✓ |
| Toggle rule **off** | ✓ | ✗ | ✓ |
| Remove rule | ✓ | ✗ | ✓ |
| Change password | ✓ (set) | future | future |

## UI

1. **No password:** Banner: short explanation + **Set password** (opens modal: new / confirm; min length).
2. **Password, locked:** Banner: **Locked** — destructive actions disabled; **Unlock** opens password modal.
3. **After unlock:** Banner: **Managing until HH:MM:SS** + **Re-lock now** + optional countdown.
4. Footer disclaimer: limitations (local-only).

## Frontend integration

- `BlockingTab` calls `blocking_lock_get_status` on mount and after unlock/relock/set password.
- Before `removeRule` or `updateRule(..., { is_active: false })`, ensure `can_manage_destructive` (or call verify path already done). If user bypasses React, API still hits Supabase — **document** as known gap for v1.

## Testing checklist

- [ ] Set password, lock, cannot remove until unlock
- [ ] Unlock, remove works; session expires → remove blocked
- [ ] Re-lock immediately clears permission
- [ ] Restart app → session gone, locked again
- [ ] No password file → full access, add still works

## Code references

| Piece | Location |
|-------|----------|
| Rust | `apps/desktop/src-tauri/src/blocking_lock.rs`, commands in `lib.rs` |
| Hook | `apps/desktop/src/features/boundaries/hooks/useBlockingLock.ts` |
| UI | `BlockingLockPanel.tsx`, `BlockingFrictionModal.tsx` |
| Integration | `BlockingTab.tsx` |
