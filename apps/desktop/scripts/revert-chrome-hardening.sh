#!/usr/bin/env bash
# Revert Chrome hardening — removes all Clarity-managed policy keys.
# Equivalent to: apply-chrome-managed-policy.sh remove
#
# Usage:
#   ./revert-chrome-hardening.sh
#
# After running: fully quit Chrome (Cmd+Q) and reopen for policies to clear.

set -euo pipefail

PLIST_PATH="${HOME}/Library/Managed Preferences/com.google.Chrome.plist"

CLARITY_KEYS=(
  "IncognitoModeAvailability"
  "ExtensionInstallForcelist"
  "ExtensionSettings"
  "URLBlocklist"
  "URLAllowlist"
)

if [[ ! -f "$PLIST_PATH" ]]; then
  echo "Nothing to revert — no managed policy file at $PLIST_PATH"
  exit 0
fi

echo "Reverting Chrome hardening: $PLIST_PATH"

export PLIST_PATH
python3 - <<'PY'
import os, plistlib
from pathlib import Path

plist_path = Path(os.environ["PLIST_PATH"])
clarity_keys = {
    "IncognitoModeAvailability",
    "ExtensionInstallForcelist",
    "ExtensionSettings",
    "URLBlocklist",
    "URLAllowlist",
}

with plist_path.open("rb") as f:
    data = plistlib.load(f)

removed = [k for k in clarity_keys if k in data]
for k in removed:
    del data[k]

if data:
    with plist_path.open("wb") as f:
        plistlib.dump(data, f)
    print(f"Removed Clarity keys: {', '.join(removed)}")
    print(f"Other keys kept in {plist_path}")
else:
    plist_path.unlink()
    print(f"All Clarity keys removed; deleted empty plist {plist_path}")

if removed:
    print("\nNext: fully quit Chrome (Cmd+Q) and reopen to clear policies.")
    print("Verify removal at chrome://policy (page should show no Clarity entries).")
else:
    print("No Clarity keys were present — nothing changed.")
PY
