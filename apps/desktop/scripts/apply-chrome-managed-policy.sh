#!/usr/bin/env bash
# Apply or remove Chrome enterprise-style managed policies on macOS.
# No admin required — writes ALL policy keys (scalars AND nested ExtensionSettings)
# to ~/Library/Managed Preferences/com.google.Chrome.plist (user scope).
# Pass --system (sudo) for /Library/Managed Preferences/ (machine scope / Mandatory).
#
# Usage:
#   ./apply-chrome-managed-policy.sh apply [--mode standard|hardcore] [--extension-id ID] [--update-url URL]
#   ./apply-chrome-managed-policy.sh remove
#   ./apply-chrome-managed-policy.sh status
#
# After apply: fully quit Chrome (Cmd+Q), reopen. Verify at chrome://policy
#
# See docs/04-guides/chrome_managed_policy_macos_2026-11-14.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_PATH="${HOME}/Library/Managed Preferences/com.google.Chrome.plist"
MODE="standard"
SYSTEM=0
EXTENSION_ID=""
UPDATE_URL=""
ACTION="${1:-}"

usage() {
  sed -n '2,12p' "$0" | sed 's/^# //'
  echo ""
  echo "Environment overrides: CLARITY_CHROME_EXT_ID, CLARITY_CHROME_UPDATE_URL"
}

if [[ -z "$ACTION" ]] || [[ "$ACTION" == "-h" ]] || [[ "$ACTION" == "--help" ]]; then
  usage
  exit 0
fi

shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:?}"
      shift 2
      ;;
    --extension-id)
      EXTENSION_ID="${2:?}"
      shift 2
      ;;
    --update-url)
      UPDATE_URL="${2:?}"
      shift 2
      ;;
  --system)
    SYSTEM=1
    shift
    ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

EXTENSION_ID="${EXTENSION_ID:-${CLARITY_CHROME_EXT_ID:-}}"
UPDATE_URL="${UPDATE_URL:-${CLARITY_CHROME_UPDATE_URL:-}}"

if [[ "${ACTION:-}" == "apply" ]] && [[ $SYSTEM -eq 1 ]] && [[ $EUID -ne 0 ]]; then
  echo "Re-running with sudo for --system…" >&2
  exec sudo -p "[sudo] Chrome policy password: " env \
    CLARITY_CHROME_EXT_ID="$EXTENSION_ID" \
    CLARITY_CHROME_UPDATE_URL="$UPDATE_URL" \
    "$0" apply --mode "$MODE" --system \
    ${EXTENSION_ID:+--extension-id "$EXTENSION_ID"} \
    ${UPDATE_URL:+--update-url "$UPDATE_URL"}
fi

run_python() {
  python3 - "$@" <<'PY'
import os
import sys

sys.path.insert(0, os.environ["SCRIPT_DIR"])
import chrome_policy_mac as cpm

action = sys.argv[1]
mode = os.environ.get("MODE", "standard")
system = os.environ.get("SYSTEM") == "1"
extension_id = os.environ.get("EXTENSION_ID", "").strip()
update_url = os.environ.get("UPDATE_URL", "").strip()

if action == "status":
    cpm.status()
    sys.exit(0)

if action == "remove":
    touched = cpm.remove_clarity_policies()
    if not touched:
        print("Nothing to remove — no Clarity Chrome policy keys found.")
    else:
        print("Removed Clarity Chrome policy keys from:")
        for path in touched:
            print(f"  {path}")
        if cpm.SYSTEM_MANAGED.exists() and not os.access(cpm.SYSTEM_MANAGED, os.W_OK):
            print(
                "If /Library/Managed Preferences/com.google.Chrome.plist still has keys, "
                "re-run: sudo ./revert-chrome-hardening.sh"
            )
    sys.exit(0)

if action != "apply":
    print(f"Unknown action: {action}", file=sys.stderr)
    sys.exit(1)

data: dict = {}

# 0 = available, 1 = disabled, 2 = only incognito (avoid — bypass vector)
data["IncognitoModeAvailability"] = 1

blocklist = [
    "chrome://extensions",
    "chrome://settings/manageProfile",
]
allowlist = [
    "chrome://policy",
    "chrome://version",
]

if mode == "hardcore":
    data["URLBlocklist"] = blocklist
    data["URLAllowlist"] = allowlist
else:
    data.pop("URLBlocklist", None)
    data.pop("URLAllowlist", None)

extension_settings = data.get("ExtensionSettings")
if not isinstance(extension_settings, dict):
    extension_settings = {}

# Block arbitrary new installs (Clarity unpacked or force-installed is exempted below)
wildcard = extension_settings.get("*")
if not isinstance(wildcard, dict):
    wildcard = {}
wildcard["installation_mode"] = "blocked"
extension_settings["*"] = wildcard

forcelist = data.get("ExtensionInstallForcelist")
if not isinstance(forcelist, list):
    forcelist = []

if extension_id:
    entry = None
    if update_url:
        entry = f"{extension_id};{update_url}"
        ext_entry = extension_settings.get(extension_id)
        if not isinstance(ext_entry, dict):
            ext_entry = {}
        ext_entry["installation_mode"] = "force_installed"
        ext_entry["update_url"] = update_url
        ext_entry["toolbar_pin"] = "force_pinned"
        extension_settings[extension_id] = ext_entry
        if entry not in forcelist:
            forcelist.append(entry)
        print(f"Force-install entry: {entry}")
    else:
        ext_entry = extension_settings.get(extension_id)
        if not isinstance(ext_entry, dict):
            ext_entry = {}
        # Without update URL Chrome cannot truly force-install unpacked/CRX;
        # allow + pin intent still blocks uninstall while policy is active for
        # extensions already treated as admin-installed.
        ext_entry["installation_mode"] = "allowed"
        ext_entry["toolbar_pin"] = "force_pinned"
        extension_settings[extension_id] = ext_entry
        print(
            "Note: no --update-url — ExtensionInstallForcelist skipped. "
            "Unpacked ID registered in ExtensionSettings (pin only). "
            "See docs for manifest key + self-hosted CRX path."
        )
else:
    print(
        "No --extension-id: Incognito disabled"
        + ("; hardcore URL blocklist" if mode == "hardcore" else "")
        + "; new extension installs blocked via ExtensionSettings[*]."
    )

data["ExtensionSettings"] = extension_settings
if forcelist:
    data["ExtensionInstallForcelist"] = forcelist
elif "ExtensionInstallForcelist" in data and not forcelist:
    data.pop("ExtensionInstallForcelist", None)

clarity = {k: data[k] for k in cpm.CLARITY_KEYS if k in data}
touched = cpm.apply_policy(clarity, system=system)
print("Wrote Chrome policies:")
for path in touched:
    print(f"  → {path}")
print("Quit Chrome completely (Cmd+Q), reopen, then open chrome://policy")
PY
}

export SCRIPT_DIR PLIST_PATH MODE SYSTEM EXTENSION_ID UPDATE_URL

case "$ACTION" in
  apply)
    run_python apply
    ;;
  remove)
    run_python remove
    ;;
  status)
    run_python status
    ;;
  *)
    echo "Unknown action: $ACTION (use apply | remove | status)" >&2
    exit 1
    ;;
esac