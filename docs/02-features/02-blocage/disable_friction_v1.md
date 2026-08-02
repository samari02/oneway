# Disable friction v1 (autodiscipline)

**Status:** Shipped — complementary to extension DNR + hosts DNS.

Impulse-resistant gate when **turning protection off**. Enabling / resuming stays instant.

## Behaviour

| Surface | Disable / pause | Enable / resume |
|---------|-----------------|-----------------|
| Desktop Settings → **System adult block** | Cooldown (15 / 30 / 60s) + type `DISABLE` | Instant (admin prompt still applies) |
| Extension popup → **Pause Mode** | Same cooldown + type `DISABLE` | Instant resume |

Default wait: **30 seconds** (persisted preference).

Confirm phrase: **`DISABLE`** (case-insensitive).

## Persistence

| App | Key | Values |
|-----|-----|--------|
| Desktop | `localStorage['clarity-disable-friction-secs']` | `15` \| `30` \| `60` |
| Extension | `chrome.storage.local.disableFrictionSecs` | same |

Preferences are **local per surface** in v1 (not synced across desktop ↔ extension).

## Out of scope (v2+)

- Cold Turkey–style password vault / friend unlock for hosts disable
- Blocking removal from `chrome://extensions` (enterprise policy territory)
- Long cooldowns (minutes/hours) for Boundaries rule deletion (see engagement modes elsewhere)
- Syncing friction duration between desktop and extension

## Files

- Desktop: `DisableFrictionModal`, `useDisableFrictionPrefs`, Settings hosts section
- Extension: popup friction panel; `SET_IS_ACTIVE` / friction prefs messages in service worker

## Manual check

1. Desktop: enable hosts → uncheck → modal countdown → type DISABLE → admin prompt → section removed.
2. Cancel mid-wait → hosts stay enabled.
3. Extension: Pause Mode → wait → DISABLE → status Paused; Resume Mode instant.
