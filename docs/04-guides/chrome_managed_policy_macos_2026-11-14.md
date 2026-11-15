# Chrome managed policy — anti-bypass (macOS)

**Status:** Scripted (user-level managed prefs). Run **after** Chrome is available; prep tonight without unlocking the browser.

Closes two easy bypasses for a daily Chrome profile:

1. **Incognito** without extension protection (`manifest.json` uses `"incognito": "split"` — user must opt in today).
2. **Removing or disabling** the unpacked Clarity extension on `chrome://extensions`.

Related layers (unchanged):

- **Hosts adult blocking** — shipped in desktop Settings → System adult block (`hosts_adult_blocking_v1.md`). Complements extension/DNR; **DoH in Chrome can bypass `/etc/hosts`** — keep extension + consider disabling Secure DNS.
- **DNS / Cold Turkey** — still the daily backstop when Chrome policy is not applied.

## Where policies live

| Scope | Path |
|--------|------|
| User (no admin) | `~/Library/Managed Preferences/com.google.Chrome.plist` |
| Machine | `/Library/Managed Preferences/com.google.Chrome.plist` (requires admin + MDM-style deploy) |

Chrome also shows effective policy at **`chrome://policy`** after a full quit/restart.

This repo does **not** write `~/Library/Preferences/com.google.Chrome.plist` (normal prefs). Enterprise keys belong under **Managed Preferences**.

## Script

From repo root:

```bash
chmod +x apps/desktop/scripts/apply-chrome-managed-policy.sh

# Baseline: disable Incognito + block installing random extensions
./apps/desktop/scripts/apply-chrome-managed-policy.sh apply

# Same + block chrome://extensions (hard to undo — read unlock below)
./apps/desktop/scripts/apply-chrome-managed-policy.sh apply --mode hardcore

# Register your unpacked ID (pin intent; no store CRX yet)
./apps/desktop/scripts/apply-chrome-managed-policy.sh apply \
  --extension-id YOUR_32_CHAR_ID

# Future: stable ID + self-hosted or Web Store update URL → true force-install
./apps/desktop/scripts/apply-chrome-managed-policy.sh apply \
  --extension-id abcdefghijklmnopqrstuvwxyzabcdef \
  --update-url https://your.host/clarity/updates.xml

./apps/desktop/scripts/apply-chrome-managed-policy.sh status
./apps/desktop/scripts/apply-chrome-managed-policy.sh remove
```

Environment: `CLARITY_CHROME_EXT_ID`, `CLARITY_CHROME_UPDATE_URL`.

### What each mode does

| Policy key | `standard` | `hardcore` |
|------------|------------|------------|
| `IncognitoModeAvailability` = **1** (disabled) | yes | yes |
| `ExtensionSettings` → `*` → `installation_mode: blocked` | yes | yes |
| `ExtensionSettings` → Clarity ID → `toolbar_pin: force_pinned` (if `--extension-id`) | yes | yes |
| `URLBlocklist` → `chrome://extensions`, `chrome://settings/manageProfile` | no | yes |
| `URLAllowlist` → `chrome://policy`, `chrome://version` | no | yes |
| `ExtensionInstallForcelist` | only if **both** `--extension-id` and `--update-url` | same |

**Unlock hardcore / all Clarity keys:** `./apply-chrome-managed-policy.sh remove`, then Cmd+Q Chrome.

## Native messaging host (extension IDs)

Unpacked **load** changes the extension ID unless the manifest has a fixed **`key`**. The native host manifest allows one origin per ID.

| Slot | ID |
|------|----|
| **Current (daily)** | `pjdboibemcgajdjnppgfnffmajcokbmf` |
| **Legacy (dev)** | `pocdhgbmmooabipboifieikkigmaanok` |

`install-native-host.sh` accepts **multiple IDs** (e.g. dev unpacked vs future pinned ID):

```bash
# Single (current daily ID):
./apps/desktop/scripts/install-native-host.sh pjdboibemcgajdjnppgfnffmajcokbmf -- /path/to/Clarity/binary

# Both IDs (safe to register both):
./apps/desktop/scripts/install-native-host.sh \
  pjdboibemcgajdjnppgfnffmajcokbmf \
  pocdhgbmmooabipboifieikkigmaanok \
  -- /path/to/Clarity/binary
```

Re-run when the ID changes. See [native_host_chrome_setup_2026-03-29.md](./native_host_chrome_setup_2026-03-29.md).

## Hardening scripts (quick reference)

| Script | What it does |
|--------|-------------|
| `apply-chrome-hardening.sh` | Baseline: Incognito disabled + no random new installs; `--hardcore` adds `chrome://extensions` block |
| `revert-chrome-hardening.sh` | Removes all Clarity-managed policy keys |
| `apply-chrome-managed-policy.sh` | Full-featured version with `apply/remove/status` subcommands |

```bash
# Baseline (recommended daily):
./apps/desktop/scripts/apply-chrome-hardening.sh --extension-id pjdboibemcgajdjnppgfnffmajcokbmf

# Hardcore (also blocks chrome://extensions — harder to undo):
./apps/desktop/scripts/apply-chrome-hardening.sh --hardcore --extension-id pjdboibemcgajdjnppgfnffmajcokbmf

# Revert everything:
./apps/desktop/scripts/revert-chrome-hardening.sh
```

## Tomorrow checklist (browser unlock)

1. `pnpm build` in `apps/extension` (or use existing `dist`).
2. Chrome → Load unpacked → `apps/extension/dist` → copy extension ID.
3. `./apps/desktop/scripts/install-native-host.sh <ID> [-- binary]`
4. `./apps/desktop/scripts/apply-chrome-managed-policy.sh apply --extension-id <ID>`  
   Add `--mode hardcore` only if you accept blocking `chrome://extensions`.
5. Cmd+Q Chrome → reopen → `chrome://policy` → confirm `IncognitoModeAvailability`.
6. Reload extension; confirm fail-closed banner clears with desktop open.

## Limitations (unpacked vs force-install)

| Goal | Works today without Web Store / CRX? |
|------|--------------------------------------|
| Disable Incognito | **Yes** (`IncognitoModeAvailability`) |
| Block installing other extensions | **Yes** (`ExtensionSettings` `*`) |
| Block `chrome://extensions` | **Yes** (`hardcore` — use with care) |
| **Force-install** unpacked folder on first launch | **No** — Chrome needs `ExtensionInstallForcelist` entry `id;update_url` and a valid **update manifest + CRX** (or Web Store URL). |
| **Prevent uninstall** of unpacked Clarity | **Partial** — only reliable for extensions Chrome treats as **admin / force_installed**. Unpacked dev extensions can still be removed unless you ship CRX + update URL or publish to the store. |
| Stable extension ID across machines | Add manifest **`key`** (PEM-derived); document ID in runbook; do not commit private PEM to the repo. |

### Stable ID for future force-install

1. Generate a PEM once:  
   `openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out clarity_extension.pem`  
   Derive public key for manifest: Chrome developer docs / `chrome-extension://` tools.
2. Add `"key": "<base64 public key>"` to `apps/extension/manifest.json` — **changes** the extension ID; update native host + policy scripts with the new ID.
3. Package `.crx` + host `updates.xml` for `ExtensionInstallForcelist`.

Until then: **Incognito off + hosts/DNS + desktop fail-closed** is the practical daily stack; policy script removes the Incognito escape hatch.

## Reference

- Chrome policies: [IncognitoModeAvailability](https://chromeenterprise.google/policies/#IncognitoModeAvailability), [ExtensionSettings](https://chromeenterprise.google/policies/#ExtensionSettings), [ExtensionInstallForcelist](https://chromeenterprise.google/policies/#ExtensionInstallForcelist)
- Product note: [disable_friction_v1.md](../02-features/02-blocage/disable_friction_v1.md) (extension removal = enterprise territory)