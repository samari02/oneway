# Chrome managed policy — anti-bypass (macOS)

**Status:** Option A (local CRX force_install) is the daily path. Policies → user-managed prefs and/or system profile. Revert with `revert-chrome-hardening.sh`.

Closes two easy bypasses for a daily Chrome profile:

1. **Incognito** without extension protection.
2. **Removing Clarity** — `force_installed` CRX cannot be removed while policy is active (`*` stays blocked).

Related layers (unchanged):

- **Hosts adult blocking** — desktop Settings → System adult block. Complements extension/DNR; **DoH in Chrome can bypass `/etc/hosts`** — keep extension + consider disabling Secure DNS.
- **DNS / Cold Turkey** — daily backstop when Chrome policy is not applied.

---

## Option A — local CRX force_install (preferred)

**Product intent:** Chrome installs Clarity as a signed `.crx` (stable ID `bladnadefjcnkapbdclfjpbekhmmoojb`). You never need **Load unpacked** or temporarily opening `ExtensionSettings["*"]=blocked` for daily work. NordPass / Cold Turkey stay allowlisted.

Chrome’s `update_url` for `force_installed` must be **http(s)**. `file://` is unreliable / unsupported for updates — we serve the CRX + Omaha `updates.xml` from a tiny localhost server.

| Piece | Path / value |
|-------|----------------|
| Signing PEM | `~/.clarity/extension-signing.pem` (never commit) |
| Packed CRX | `~/.clarity/crx-update/clarity.crx` |
| Update manifest | `~/.clarity/crx-update/updates.xml` |
| Local update URL | `http://127.0.0.1:8765/updates.xml` |
| Extension ID | `bladnadefjcnkapbdclfjpbekhmmoojb` |

```bash
# One command: build → pack CRX → start localhost server → STRICT policy + mobileconfig
pnpm ext:update

# Then: Cmd+Q Chrome → reopen → chrome://extensions → Update
# Optional Mandatory scope:
sudo cp ~/.clarity/crx-update/com.google.Chrome.plist \
  "/Library/Managed Preferences/com.google.Chrome.plist"
# or: open ~/Desktop/clarity-chrome-policy.mobileconfig
```

Daily rebuild after first install: `pnpm ext:update` → chrome://extensions → **Update**. Keep the localhost server running (`pnpm ext:serve` / started by `ext:update`).

Scripts: `apps/extension/scripts/{pack-crx,ext-update,serve-crx-update}.*`

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
# Preferred STRICT (force_install Clarity + * blocked + allowlists) — or just: pnpm ext:update
./apps/desktop/scripts/apply-chrome-hardening.sh \
  --extension-id bladnadefjcnkapbdclfjpbekhmmoojb \
  --update-url http://127.0.0.1:8765/updates.xml \
  --allow-extension eiaeiblijfjekdanodkjadfinkhbfgcd \
  --allow-extension pganeibhckoanndahmnfggfoeofncnii \
  --allow-extension efnolkfmdbinpkbnfigocgfglnhahldj \
  --allow-extension pjdboibemcgajdjnppgfnffmajcokbmf \
  --mobileconfig

# Same without force_install (allowed + pin only — Load unpacked still blocked when *=blocked)
./apps/desktop/scripts/apply-chrome-hardening.sh \
  --extension-id bladnadefjcnkapbdclfjpbekhmmoojb \
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

The profile delivers `ExtensionSettings` and `IncognitoModeAvailability` as a `com.apple.ManagedClient.preferences` payload with `Forced` semantics — best for applying Mandatory policies without sudo plist copies.

**It is not enough by itself for off-store CRX force_install** on Google Chrome: you still need MDM enrollment or Chrome Enterprise Core (see caveat 4 below). Manual install shows Source: Manual in `profiles status`; CBCM/MDM is what flips the off-store allow gate.

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
| `ExtensionSettings[<Clarity>].installation_mode = force_installed` | ✅ with `--update-url` | same |
| `ExtensionSettings[<ID>].toolbar_pin = force_pinned` | ✅ if `--extension-id` | ✅ |
| `URLBlocklist` → `chrome://extensions`, `chrome://settings/manageProfile` | ❌ | ✅ |
| `URLAllowlist` → `chrome://policy`, `chrome://version` | ❌ | ✅ |
| `ExtensionInstallForcelist` (true force-install) | ✅ with `--update-url` / `pnpm ext:update` | same |

---

## Honest limitations (unpacked vs force-install)

| Goal | Works today? |
|------|-------------|
| Disable Incognito | **Yes** — `IncognitoModeAvailability` |
| Block installing arbitrary extensions | **Yes** — `ExtensionSettings[*]` |
| **Load unpacked** while `*` is blocked | **No** (by design) — use Option A CRX instead of `--allow-load-unpacked` |
| **Force-install** Clarity from local CRX | **Only if Mac is enterprise-managed** — see caveat 4 |
| **Prevent uninstall** of Clarity | **Yes** while `force_installed` policy is active **and** the CRX actually installed |
| Block `chrome://extensions` page | **Yes** — `--hardcore` (optional; CRX force_install already blocks Remove) |
| Stable extension ID across machines | **Done** — manifest `"key"` + `~/.clarity/extension-signing.pem` |

### Caveats

1. **Localhost update server** must be running for first install and version bumps (`serve-crx-update.py` / `pnpm ext:serve`).
2. **`file://` update URLs** — do not use; Chrome expects http(s).
3. **`--allow-load-unpacked`** opens `*` — emergency only; re-run STRICT / `pnpm ext:update` after.
4. **Off-store force_install gate (Chrome):** Google Chrome only force-installs extensions **outside the Chrome Web Store** on macOS if the device is **managed via MDM**, joined via **MCX domain**, or enrolled in **Chrome Enterprise Core** (Browser Cloud Management). A **manual** `.mobileconfig` (Source: Manual) correctly delivers `ExtensionSettings` / `ExtensionInstallForcelist` (banner “managed by your organization”, policies Mandatory) but does **not** set `enterprise_mdm_mac`. Symptom: `http://127.0.0.1:8765` serves `updates.xml` + `clarity.crx`, Chrome **downloads** the CRX on **Update**, then **never appears** in `chrome://extensions`. Fix: enroll the browser in [Chrome Browser Cloud Management](https://support.google.com/chrome/a/answer/9301891) (enrollment token under `/Library/Google/Chrome/CloudManagementEnrollmentToken`) **or** push the same profile from a real MDM, then Cmd+Q → `chrome://extensions` → **Update** (not Load unpacked).

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

## Setup checklist (Option A)

1. `pnpm ext:update` (build + pack CRX + localhost server + STRICT policy + Desktop mobileconfig).
2. Optional Mandatory: install `~/Desktop/clarity-chrome-policy.mobileconfig` **or**
   `sudo cp ~/.clarity/crx-update/com.google.Chrome.plist "/Library/Managed Preferences/com.google.Chrome.plist"`.
3. Cmd+Q Chrome → reopen → `chrome://extensions` → **Update**. ID must be `bladnadefjcnkapbdclfjpbekhmmoojb`.
4. `./apps/desktop/scripts/install-native-host.sh bladnadefjcnkapbdclfjpbekhmmoojb [-- binary]`
5. `chrome://policy` → confirm `* = blocked`, Clarity `force_installed` + `update_url`, NordPass/Cold Turkey `allowed`.
6. Daily: `pnpm ext:update` → chrome://extensions → **Update** (no Load unpacked).

---

## Reference

- [IncognitoModeAvailability](https://chromeenterprise.google/policies/#IncognitoModeAvailability)
- [ExtensionSettings](https://chromeenterprise.google/policies/#ExtensionSettings)
- [ExtensionInstallForcelist](https://chromeenterprise.google/policies/#ExtensionInstallForcelist)
- [URLBlocklist](https://chromeenterprise.google/policies/#URLBlocklist)
