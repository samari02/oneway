# Chrome managed policy — anti-bypass (macOS)

**Status:** Scripted (all policies → user-managed prefs OR system profile). Run after Chrome is loaded; revert with `revert-chrome-hardening.sh`.

Closes two easy bypasses for a daily Chrome profile:

1. **Incognito** without extension protection.
2. **Removing or disabling** the unpacked Clarity extension on `chrome://extensions`.

Related layers (unchanged):

- **Hosts adult blocking** — desktop Settings → System adult block. Complements extension/DNR; **DoH in Chrome can bypass `/etc/hosts`** — keep extension + consider disabling Secure DNS.
- **DNS / Cold Turkey** — daily backstop when Chrome policy is not applied.

---

## Where policies live — corrected map

| Path | Scope | Chrome reads it? | Notes |
|------|-------|-----------------|-------|
| `~/Library/Managed Preferences/com.google.Chrome.plist` | User-managed | **Yes** — scalars AND nested dicts/arrays | Shows as "Platform / Recommended" on chrome://policy |
| `~/Library/Preferences/com.google.Chrome.plist` | User data | **NO for policy keys** | Chrome's own data file; policy keys here are silently ignored |
| `/Library/Managed Preferences/com.google.Chrome.plist` | Machine-managed | **Yes** (requires sudo) | Shows as "Platform / Mandatory" |
| `.mobileconfig` configuration profile | Machine | **Yes** (strongest) | Double-click + approve in System Settings → Profiles |

> **Previous bug (fixed in this commit):** `chrome_policy_mac.py` incorrectly split writes — scalars to `~/Library/Managed Preferences/` (correct) and nested keys like `ExtensionSettings` to `~/Library/Preferences/com.google.Chrome.plist` (wrong — policy keys there are silently ignored by Chrome). The script now writes **all** policy keys to the managed path.

---

## Script usage

```bash
# Recommended — all policies to ~/Library/Managed Preferences/ (no sudo)
./apps/desktop/scripts/apply-chrome-hardening.sh \
  --extension-id bladnadefjcnkapbdclfjpbekhmmoojb

# Same + generate a .mobileconfig on ~/Desktop (strongest, no sudo, needs double-click install)
./apps/desktop/scripts/apply-chrome-hardening.sh \
  --extension-id bladnadefjcnkapbdclfjpbekhmmoojb \
  --mobileconfig

# Keep NordPass / Cold Turkey visible while * stays blocked (repeat --allow-extension)
./apps/desktop/scripts/apply-chrome-hardening.sh \
  --extension-id bladnadefjcnkapbdclfjpbekhmmoojb \
  --allow-extension eiaeiblijfjekdanodkjadfinkhbfgcd \
  --allow-extension pganeibhckoanndahmnfggfoeofncnii \
  --allow-extension efnolkfmdbinpkbnfigocgfglnhahldj \
  --mobileconfig

# Hardcore: also blocks chrome://extensions (prevents manual removal of extension)
./apps/desktop/scripts/apply-chrome-hardening.sh \
  --hardcore \
  --extension-id bladnadefjcnkapbdclfjpbekhmmoojb

# Machine scope (shows as Mandatory on chrome://policy — requires sudo password)
./apps/desktop/scripts/apply-chrome-hardening.sh \
  --system \
  --extension-id bladnadefjcnkapbdclfjpbekhmmoojb

# Revert everything (user scope + legacy cleanup):
./apps/desktop/scripts/revert-chrome-hardening.sh
```

Full-featured version with `apply/remove/status`:

```bash
./apps/desktop/scripts/apply-chrome-managed-policy.sh apply \
  --extension-id bladnadefjcnkapbdclfjpbekhmmoojb

./apps/desktop/scripts/apply-chrome-managed-policy.sh status
./apps/desktop/scripts/apply-chrome-managed-policy.sh remove

# With CRX update URL (true force-install):
./apps/desktop/scripts/apply-chrome-managed-policy.sh apply \
  --extension-id bladnadefjcnkapbdclfjpbekhmmoojb \
  --update-url https://your.host/clarity/updates.xml
```

---

## .mobileconfig — gold-standard install

The `--mobileconfig` flag writes `~/Desktop/clarity-chrome-policy.mobileconfig`.

Install steps (macOS 13 Ventura+):
1. Double-click the file on your Desktop.
2. Open **System Settings → Privacy & Security → Profiles** (scroll down).
3. Click the pending profile → **Install**.
4. Quit Chrome fully (Cmd+Q), reopen, check `chrome://policy`.
5. Policies will show as **"Platform / Mandatory"** (not just Recommended).

The profile delivers `ExtensionSettings` and `IncognitoModeAvailability` as a `com.apple.ManagedClient.preferences` payload with `Forced` semantics — the most reliable path without an MDM server.

To remove: System Settings → Privacy & Security → Profiles → select → remove.

---

## Verifying at chrome://policy

| What you should see | Means |
|---------------------|-------|
| `IncognitoModeAvailability = 1` — Platform, Recommended | ✅ Managed pref write worked |
| `ExtensionSettings` row present | ✅ Nested policy is now being read |
| `ExtensionSettings` row **missing** | ❌ Still old code — rerun the fixed script |
| Policies show **Mandatory** (not Recommended) | ✅ System scope or .mobileconfig installed |

After `--hardcore`: `URLBlocklist` row will appear with `chrome://extensions`.

---

## Policy key matrix

| Policy key | standard | hardcore |
|------------|----------|---------|
| `IncognitoModeAvailability = 1` (Incognito disabled) | ✅ | ✅ |
| `ExtensionSettings[*].installation_mode = blocked` | ✅ | ✅ |
| `ExtensionSettings[<ID>].installation_mode = allowed` | ✅ per `--allow-extension` | ✅ |
| `ExtensionSettings[<ID>].toolbar_pin = force_pinned` | ✅ if `--extension-id` | ✅ |
| `URLBlocklist` → `chrome://extensions`, `chrome://settings/manageProfile` | ❌ | ✅ |
| `URLAllowlist` → `chrome://policy`, `chrome://version` | ❌ | ✅ |
| `ExtensionInstallForcelist` (true force-install) | only if `--update-url` given | same |

---

## Honest limitations (unpacked vs force-install)

| Goal | Works today? |
|------|-------------|
| Disable Incognito | **Yes** — `IncognitoModeAvailability` |
| Block installing arbitrary extensions | **Yes** — `ExtensionSettings[*]` |
| Block `chrome://extensions` page | **Yes** — `--hardcore` (careful: harder to undo) |
| Pin extension to toolbar (prevent unpinning) | **Partial** — `toolbar_pin: force_pinned` works for managed/installed extensions; side-loaded unpacked extensions may still allow unpinning |
| **Prevent uninstall** of unpacked Clarity | **Partial** — blocked only for `force_installed` extensions (needs CRX + update URL). Without that, `--hardcore` (block the page) is the practical alternative |
| **Force-install** unpacked folder on first launch | **No** — `ExtensionInstallForcelist` requires a valid `id;update_url` pointing to a CRX + update manifest |
| Stable extension ID across machines | **Done** — manifest `"key"` in repo; private PEM at `~/.clarity/extension-signing.pem` (never commit) |

### Anti-bypass alternatives when force-install is not available

1. **`--hardcore`**: blocks `chrome://extensions` and `chrome://settings/manageProfile` via `URLBlocklist`. The user cannot navigate to the page to remove the extension. Revert with `revert-chrome-hardening.sh`.
2. **Cold Turkey / Focus** (host-level): blocks chrome:// URLs at the browser level even if policies are bypassed.
3. **Future CRX path**: generate a PEM-based manifest `key`, package `.crx`, host `updates.xml`, then use `--update-url` → true `force_installed`, unremovable.

---

## Native messaging host (extension IDs)

| Slot | ID |
|------|----|
| **Stable (manifest `key`)** | `bladnadefjcnkapbdclfjpbekhmmoojb` |
| **Legacy (pre-key unpack)** | `pjdboibemcgajdjnppgfnffmajcokbmf` |
| **Legacy (dev)** | `pocdhgbmmooabipboifieikkigmaanok` |

```bash
# Single ID:
./apps/desktop/scripts/install-native-host.sh bladnadefjcnkapbdclfjpbekhmmoojb -- /path/to/Clarity/binary

# Both IDs:
./apps/desktop/scripts/install-native-host.sh \
  bladnadefjcnkapbdclfjpbekhmmoojb \
  pocdhgbmmooabipboifieikkigmaanok \
  -- /path/to/Clarity/binary
```

---

## Setup checklist

1. `pnpm build` in `apps/extension` (or use existing `dist`).
2. Chrome → Load unpacked → `apps/extension/dist` → ID should match `pnpm check:connectivity` (`bladnadefjcnkapbdclfjpbekhmmoojb`).
3. `./apps/desktop/scripts/install-native-host.sh bladnadefjcnkapbdclfjpbekhmmoojb [-- binary]`
4. `./apps/desktop/scripts/apply-chrome-hardening.sh --extension-id bladnadefjcnkapbdclfjpbekhmmoojb --mobileconfig`
5. Double-click `~/Desktop/clarity-chrome-policy.mobileconfig` → install in System Settings.
6. Cmd+Q Chrome → reopen → `chrome://policy` → confirm:
   - `IncognitoModeAvailability = 1` (Platform, Mandatory after profile install)
   - `ExtensionSettings` with Clarity ID + `toolbar_pin: force_pinned`
7. Reload extension; confirm fail-closed banner clears.

---

## Reference

- [IncognitoModeAvailability](https://chromeenterprise.google/policies/#IncognitoModeAvailability)
- [ExtensionSettings](https://chromeenterprise.google/policies/#ExtensionSettings)
- [ExtensionInstallForcelist](https://chromeenterprise.google/policies/#ExtensionInstallForcelist)
- [URLBlocklist](https://chromeenterprise.google/policies/#URLBlocklist)
