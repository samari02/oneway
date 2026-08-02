# System adult blocking via `/etc/hosts` (macOS v1)

**Status:** Shipped (desktop) — additive to the Chrome extension, not a replacement.

Machine-level adult domain blocking maps the same seed list as extension sync
(`~/.clarity/adult-blocklist.json`) into a **managed section** of `/etc/hosts`.

## Why hosts (Option A)

- Shippable on macOS without a privileged DNS daemon
- Works for apps and browsers that use OS name resolution
- Same Cold-Turkey-style pattern: sinkhole domains to `0.0.0.0`

A local DNS proxy (Option B) is deferred — harder on macOS without extra privileges.

## Behaviour

| Action | Effect |
|--------|--------|
| Enable | Admin prompt → backup `/etc/hosts` → write Clarity section from disk blocklist |
| Disable | Admin prompt → backup → remove only the Clarity-marked section |
| Refresh | Re-apply from current `adult-blocklist.json` while enabled |
| Blocklist write | If hosts blocking is enabled, best-effort refresh after `write_adult_blocklist_to_disk` |

Markers:

```
# BEGIN CLARITY ADULT BLOCK
# Managed by Clarity desktop — do not edit by hand
0.0.0.0 example.com
0.0.0.0 www.example.com
# END CLARITY ADULT BLOCK
```

State: `~/.clarity/hosts-blocking.json`  
Backups: `~/.clarity/hosts-backup-YYYYMMDD-HHMMSS.txt` (keeps last 5)

## Safety

- Backup before every privileged write
- Only the marker-delimited section is added/removed; unrelated hosts entries are preserved
- Refuses enable/refresh when the on-disk adult list is empty (never apply an empty wipe)
- Refuses writing a completely empty `/etc/hosts`
- Disable friction v1: cooldown + type `DISABLE` before hosts disable (see [`disable_friction_v1.md`](./disable_friction_v1.md))

## Tauri commands

- `get_hosts_blocking_status`
- `enable_hosts_adult_blocking`
- `disable_hosts_adult_blocking`
- `refresh_hosts_adult_blocking`

UI: Settings → **System adult block**.

## DoH caveat (important)

**Chrome Secure DNS (DNS-over-HTTPS) and similar resolver overrides can bypass `/etc/hosts`.**

Hosts file blocking only affects lookups that go through the OS resolver. If Chrome
(or another app) resolves names via DoH, adult sites may still load in that browser
even while the hosts section is present.

Mitigations for users who want full coverage:

1. Keep the Clarity **extension** enabled (DNR + monk UI — not bypassed by DoH the same way)
2. In Chrome: Settings → Privacy and security → Security → **Use secure DNS** → Off  
   (or use your OS / router DNS instead of Chrome’s DoH)
3. Prefer OS-level DNS / Family DNS for network-wide policy when hosts is insufficient

Clarity treats hosts blocking as a **complementary machine net**, not a substitute for the extension.

## Manual test (macOS)

Admin password is required; not fully exercisable in CI sandboxes.

1. Ensure `~/.clarity/adult-blocklist.json` exists with a non-empty `domains` array  
   (extension sync, or seed install).
2. Open Clarity desktop → Settings → **System adult block** → enable.
3. Authenticate in the macOS admin dialog.
4. Confirm `/etc/hosts` contains `# BEGIN CLARITY ADULT BLOCK` … `# END CLARITY ADULT BLOCK`.
5. Confirm a backup appeared under `~/.clarity/hosts-backup-*.txt`.
6. `ping -c 1 <blocked-domain>` should fail / hit `0.0.0.0` (unless DoH client).
7. Disable → section removed; unrelated hosts lines unchanged.
8. Cancel the admin dialog once → UI shows cancellation error; hosts unchanged.

## Out of scope (later)

- Windows / Linux parity
- Password vault / longer cooldowns (beyond disable-friction v1)
- Local DNS proxy / pf rules
- Replacing the extension
