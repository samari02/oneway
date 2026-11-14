#!/usr/bin/env bash
# Apply or remove Chrome enterprise-style managed policies on macOS (user scope).
# No admin required — writes ~/Library/Managed Preferences/com.google.Chrome.plist
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
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

EXTENSION_ID="${EXTENSION_ID:-${CLARITY_CHROME_EXT_ID:-}}"
UPDATE_URL="${UPDATE_URL:-${CLARITY_CHROME_UPDATE_URL:-}}"

run_python() {
  python3 - "$@" <<'PY'
import os
import plistlib
import sys
from pathlib import Path

action = sys.argv[1]
plist_path = Path(os.environ["PLIST_PATH"])
mode = os.environ.get("MODE", "standard")
extension_id = os.environ.get("EXTENSION_ID", "").strip()
update_url = os.environ.get("UPDATE_URL", "").strip()

def load_plist():
    if not plist_path.exists():
        return {}
    with plist_path.open("rb") as f:
        return plistlib.load(f)

def save_plist(data):
    plist_path.parent.mkdir(parents=True, exist_ok=True)
    with plist_path.open("wb") as f:
        plistlib.dump(data, f)

def clarity_policy_keys():
    return {
        "IncognitoModeAvailability",
        "ExtensionInstallForcelist",
        "ExtensionSettings",
        "URLBlocklist",
        "URLAllowlist",
    }

if action == "status":
    if not plist_path.exists():
        print(f"No managed policy file at {plist_path}")
        sys.exit(0)
    data = load_plist()
    keys = sorted(k for k in data if k in clarity_policy_keys() or k.startswith("Extension"))
    if not keys:
        print(f"Plist exists but no Clarity keys: {plist_path}")
        for k in sorted(data):
            print(f"  (other) {k}")
        sys.exit(0)
    print(f"Managed policies: {plist_path}")
    for k in keys:
        print(f"  {k}: {data[k]}")
    sys.exit(0)

if action == "remove":
    if not plist_path.exists():
        print(f"Nothing to remove — no file at {plist_path}")
        sys.exit(0)
    data = load_plist()
    for k in clarity_policy_keys():
        data.pop(k, None)
    if data:
        save_plist(data)
        print(f"Removed Clarity Chrome policy keys; other keys kept in {plist_path}")
    else:
        plist_path.unlink()
        print(f"Removed {plist_path}")
    sys.exit(0)

if action != "apply":
    print(f"Unknown action: {action}", file=sys.stderr)
    sys.exit(1)

data = load_plist()

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

save_plist(data)
print(f"Wrote Chrome managed policies → {plist_path}")
print("Quit Chrome completely (Cmd+Q), reopen, then open chrome://policy")
PY
}

export PLIST_PATH MODE EXTENSION_ID UPDATE_URL

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