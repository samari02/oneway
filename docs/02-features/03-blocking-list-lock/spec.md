# Spec: blocking list lock

## Data on disk

**Path:** `~/.clarity/blocking-lock.json`

```json
{
  "version": 1,
  "password_hash": "<Argon2 PHC string>",
  "unlock_duration_secs": 300
}
```

- `password_hash`: produced with **Argon2id** (via `argon2` crate); includes salt and parameters in the string.
- `unlock_duration_secs`: default **300**; editable in a later phase (only while unlocked).

If the file is **missing**, treat as **no password configured**.

## Tauri commands

| Command | Input | Output | Notes |
|---------|--------|--------|--------|
| `blocking_lock_get_status` | — | `{ has_password, unlocked_until_ms, unlock_duration_secs, can_manage_destructive }` | `unlocked_until_ms` is `null` if locked or no session. `can_manage_destructive` = no password **OR** valid session. |
| `blocking_lock_set_password` | `new_password`, `current_password?: string \| null` | `Result<(), string>` | First set: `current_password` omitted. Change: requires current (future) / v1 may only support **first set** + **clear** via recovery later. |
| `blocking_lock_verify_unlock` | `password` | `Result<(), string>` | Verifies hash; starts session until `now + unlock_duration_secs`. |
| `blocking_lock_relock` | — | `()` | Clears session. |

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

## Code references (Phase 1)

| Piece | Location |
|-------|----------|
| Rust | `apps/desktop/src-tauri/src/blocking_lock.rs`, commands in `lib.rs` |
| Hook | `apps/desktop/src/features/boundaries/hooks/useBlockingLock.ts` |
| UI | `apps/desktop/src/features/boundaries/components/BlockingLockPanel.tsx` |
| Integration | `apps/desktop/src/features/boundaries/components/BlockingTab.tsx` |
