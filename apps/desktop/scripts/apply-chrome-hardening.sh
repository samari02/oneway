#!/usr/bin/env bash
# Chrome anti-bypass hardening for macOS (user scope, no admin required).
# Scalars → ~/Library/Managed Preferences/com.google.Chrome.plist
# ExtensionSettings / URL lists → ~/Library/Preferences/com.google.Chrome.plist
#   (macOS does not expose nested managed prefs at user scope to Chrome;
#   see docs/04-guides/chrome_managed_policy_macos_2026-11-14.md)
#
# Usage:
#   ./apply-chrome-hardening.sh [--hardcore] [--extension-id ID] [--system]
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

HARDCORE=0
SYSTEM=0
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
  --system             Also write policies to /Library/Managed Preferences/ (sudo, machine scope).
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
    --system) SYSTEM=1 ;;
    --help|-h) usage; exit 0 ;;
  esac
done

# Positional --extension-id parsing (after the loop above)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --extension-id) EXTENSION_ID="${2:?--extension-id requires an argument}"; shift 2 ;;
    --hardcore|--system|--help|-h) shift ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ $SYSTEM -eq 1 ]] && [[ $EUID -ne 0 ]]; then
  echo "Re-running with sudo for --system (/Library/Managed Preferences/)…" >&2
  exec sudo -p "[sudo] Chrome policy password: " env \
    CLARITY_CHROME_EXT_ID="$EXTENSION_ID" \
    "$0" ${HARDCORE:+--hardcore} --system \
    ${EXTENSION_ID:+--extension-id "$EXTENSION_ID"}
fi

echo "Applying Chrome hardening (scalars → Managed Preferences; ExtensionSettings → Preferences)"
[[ $HARDCORE -eq 1 ]] && echo "  Mode: hardcore (chrome://extensions blocked)"
[[ -n "$EXTENSION_ID" ]] && echo "  Extension ID pinned: $EXTENSION_ID"
[[ $SYSTEM -eq 1 ]] && echo "  Also writing machine-scope plist (sudo)"

export SCRIPT_DIR HARDCORE SYSTEM EXTENSION_ID CLARITY_ID_CURRENT CLARITY_ID_LEGACY

python3 - <<'PY'
import os
import sys

sys.path.insert(0, os.environ["SCRIPT_DIR"])
import chrome_policy_mac as cpm

hardcore = os.environ["HARDCORE"] == "1"
system = os.environ["SYSTEM"] == "1"
extension_id = os.environ["EXTENSION_ID"].strip()
clarity_current = os.environ["CLARITY_ID_CURRENT"]
clarity_legacy = os.environ["CLARITY_ID_LEGACY"]

policy = {"IncognitoModeAvailability": 1}

ext_settings: dict = {
    "*": {"installation_mode": "blocked"},
}


def pin_id(eid: str) -> None:
    ext_settings[eid] = {
        "installation_mode": "allowed",
        "toolbar_pin": "force_pinned",
    }


if extension_id:
    pin_id(extension_id)
    print(f"  Pinned extension: {extension_id}")
else:
    pin_id(clarity_current)
    pin_id(clarity_legacy)
    print(
        f"  Pinned known IDs: {clarity_current} (current), {clarity_legacy} (legacy)"
    )
    print("  (Pass --extension-id to override with your actual loaded ID.)")

policy["ExtensionSettings"] = ext_settings

if hardcore:
    policy["URLBlocklist"] = [
        "chrome://extensions",
        "chrome://settings/manageProfile",
    ]
    policy["URLAllowlist"] = [
        "chrome://policy",
        "chrome://version",
    ]
    print("  URLBlocklist active (chrome://extensions blocked).")

touched = cpm.apply_policy(policy, system=system)
print("\nWrote Chrome policies:")
for path in touched:
    print(f"  → {path}")
print(
    "\nmacOS note: ExtensionSettings is stored in Preferences (or system Managed "
    "Preferences with --system) so Chrome can read nested policy values."
)
print("Next: fully quit Chrome (Cmd+Q), reopen, then open chrome://policy to verify.")
print("  Expect ExtensionSettings with your Clarity ID + toolbar_pin force_pinned.")
print("Revert: ./revert-chrome-hardening.sh")
PY