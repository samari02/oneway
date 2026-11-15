#!/usr/bin/env bash
# Revert Chrome hardening — removes all Clarity-managed policy keys.
# Equivalent to: apply-chrome-managed-policy.sh remove
#
# Usage:
#   ./revert-chrome-hardening.sh
#   sudo ./revert-chrome-hardening.sh   # if you previously used --system
#
# After running: fully quit Chrome (Cmd+Q) and reopen for policies to clear.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export SCRIPT_DIR

python3 - <<'PY'
import os
import sys

sys.path.insert(0, os.environ["SCRIPT_DIR"])
import chrome_policy_mac as cpm

touched = cpm.remove_clarity_policies()
if not touched:
    print("Nothing to revert — no Clarity Chrome policy keys found.")
else:
    print("Removed Clarity Chrome policy keys from:")
    for path in touched:
        print(f"  {path}")

if cpm.SYSTEM_MANAGED.exists():
    data = cpm.load_plist(cpm.SYSTEM_MANAGED)
    leftover = sorted(k for k in data if k in cpm.CLARITY_KEYS)
    if leftover:
        print(
            "\nSystem plist still has Clarity keys (needs sudo): "
            f"{', '.join(leftover)}"
        )
        print("Run: sudo ./revert-chrome-hardening.sh")

if touched:
    print("\nNext: fully quit Chrome (Cmd+Q) and reopen to clear policies.")
    print("Verify removal at chrome://policy.")
PY