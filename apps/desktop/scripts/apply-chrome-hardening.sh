#!/usr/bin/env bash
# Chrome anti-bypass hardening for macOS (user scope, no admin required).
# Writes ~/Library/Managed Preferences/com.google.Chrome.plist
#
# Usage:
#   ./apply-chrome-hardening.sh [--hardcore] [--extension-id ID]
#   ./apply-chrome-hardening.sh --help
#
# After running: fully quit Chrome (Cmd+Q), reopen, verify at chrome://policy
#
# Known Clarity extension IDs:
#   Current (daily):  pjdboibemcgajdjnppgfnffmajcokbmf
#   Legacy (dev):     pocdhgbmmooabipboifieikkigmaanok
#
# See docs/04-guides/chrome_managed_policy_macos_2026-11-14.md for full details.

set -euo pipefail

HARDCORE=0
EXTENSION_ID="${CLARITY_CHROME_EXT_ID:-}"

# Known extension IDs (for reference / quick default)
CLARITY_ID_CURRENT="pjdboibemcgajdjnppgfnffmajcokbmf"
CLARITY_ID_LEGACY="pocdhgbmmooabipboifieikkigmaanok"

usage() {
  cat <<EOF
Chrome hardening script — macOS managed preferences (user scope)

Usage:
  $(basename "$0") [OPTIONS]

Options:
  --hardcore           Also block chrome://extensions + chrome://settings/manageProfile
                       (makes undoing harder — revert with revert-chrome-hardening.sh)
  --extension-id ID    Pin Clarity extension in ExtensionSettings (pin only, no force-install
                       without a CRX update URL — see note below).
  --help               Show this help.

Environment:
  CLARITY_CHROME_EXT_ID   Override extension ID without passing --extension-id.

Known Clarity IDs:
  Current (daily): $CLARITY_ID_CURRENT
  Legacy  (dev):   $CLARITY_ID_LEGACY

Policies applied (standard):
  IncognitoModeAvailability = 1   (Incognito disabled)
  ExtensionSettings[*].installation_mode = blocked  (no random new installs)

Policies applied (--hardcore, additionally):
  URLBlocklist: chrome://extensions, chrome://settings/manageProfile
  URLAllowlist: chrome://policy, chrome://version

NOTE — ExtensionInstallForcelist:
  True force-install requires a stable extension ID AND a CRX file + update XML served
  over HTTPS (or the Chrome Web Store URL). Unpacked dev extensions CANNOT be
  force-installed via this policy alone. Use --extension-id to register pin intent;
  the extension will be allowed + toolbar-pinned, but Chrome will not auto-install
  an unpacked folder on first launch.

Revert: ./revert-chrome-hardening.sh  (or the full apply-chrome-managed-policy.sh remove)
EOF
}

for arg in "$@"; do
  case "$arg" in
    --hardcore) HARDCORE=1 ;;
    --help|-h) usage; exit 0 ;;
  esac
done

# Positional --extension-id parsing (after the loop above)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --extension-id) EXTENSION_ID="${2:?--extension-id requires an argument}"; shift 2 ;;
    --hardcore|--help|-h) shift ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

PLIST_PATH="${HOME}/Library/Managed Preferences/com.google.Chrome.plist"

echo "Applying Chrome hardening to: $PLIST_PATH"
[[ $HARDCORE -eq 1 ]] && echo "  Mode: hardcore (chrome://extensions blocked)"
[[ -n "$EXTENSION_ID" ]] && echo "  Extension ID pinned: $EXTENSION_ID"

export PLIST_PATH HARDCORE EXTENSION_ID CLARITY_ID_CURRENT CLARITY_ID_LEGACY

python3 - <<'PY'
import os, plistlib, sys
from pathlib import Path

plist_path = Path(os.environ["PLIST_PATH"])
hardcore = os.environ["HARDCORE"] == "1"
extension_id = os.environ["EXTENSION_ID"].strip()
clarity_current = os.environ["CLARITY_ID_CURRENT"]
clarity_legacy  = os.environ["CLARITY_ID_LEGACY"]

def load():
    if not plist_path.exists():
        return {}
    with plist_path.open("rb") as f:
        return plistlib.load(f)

def save(data):
    plist_path.parent.mkdir(parents=True, exist_ok=True)
    with plist_path.open("wb") as f:
        plistlib.dump(data, f)

data = load()

# 1. Disable Incognito (0=available, 1=disabled, 2=forced)
data["IncognitoModeAvailability"] = 1

# 2. Block arbitrary new extension installs
ext_settings = data.get("ExtensionSettings")
if not isinstance(ext_settings, dict):
    ext_settings = {}
wildcard = ext_settings.get("*")
if not isinstance(wildcard, dict):
    wildcard = {}
wildcard["installation_mode"] = "blocked"
ext_settings["*"] = wildcard

# 3. Pin the provided extension ID (or known IDs) — no force-install without update URL
def pin_id(eid):
    entry = ext_settings.get(eid)
    if not isinstance(entry, dict):
        entry = {}
    # NOTE: without update_url, Chrome won't truly force-install;
    # this only allows the already-loaded unpacked extension and pins toolbar.
    entry["installation_mode"] = "allowed"
    entry["toolbar_pin"] = "force_pinned"
    ext_settings[eid] = entry

if extension_id:
    pin_id(extension_id)
    print(f"  Pinned extension: {extension_id}")
else:
    # Pin both known Clarity IDs as a convenience
    pin_id(clarity_current)
    pin_id(clarity_legacy)
    print(f"  Pinned known IDs: {clarity_current} (current), {clarity_legacy} (legacy)")
    print("  (Pass --extension-id to override with your actual loaded ID.)")

data["ExtensionSettings"] = ext_settings

# 4. Hardcore mode: block chrome://extensions page
if hardcore:
    data["URLBlocklist"] = [
        "chrome://extensions",
        "chrome://settings/manageProfile",
    ]
    data["URLAllowlist"] = [
        "chrome://policy",
        "chrome://version",
    ]
    print("  URLBlocklist active (chrome://extensions blocked).")
else:
    # Remove hardcore keys if previously set
    data.pop("URLBlocklist", None)
    data.pop("URLAllowlist", None)

save(data)
print(f"\nWrote Chrome managed policies → {plist_path}")
print("Next: fully quit Chrome (Cmd+Q), reopen, then open chrome://policy to verify.")
print("Revert: ./revert-chrome-hardening.sh")
PY
