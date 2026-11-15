#!/usr/bin/env bash
# Chrome anti-bypass hardening for macOS.
#
# All policies (scalars AND nested ExtensionSettings) are written to:
#   ~/Library/Managed Preferences/com.google.Chrome.plist   (user scope, no admin required)
# Optionally also to /Library/Managed Preferences/ with --system (requires sudo).
# Or generate a system-level .mobileconfig profile with --mobileconfig (recommended).
#
# Usage:
#   ./apply-chrome-hardening.sh [--hardcore] [--extension-id ID] [--allow-extension ID]... [--system] [--mobileconfig]
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
MOBILECONFIG=0
EXTENSION_ID="${CLARITY_CHROME_EXT_ID:-}"
ALLOW_EXTENSIONS=()

# Known extension IDs (for reference / quick default)
CLARITY_ID_CURRENT="pjdboibemcgajdjnppgfnffmajcokbmf"
CLARITY_ID_LEGACY="pocdhgbmmooabipboifieikkigmaanok"

usage() {
  cat <<EOF
Chrome hardening script — macOS managed preferences

Usage:
  $(basename "$0") [OPTIONS]

Options:
  --hardcore           Also block chrome://extensions + chrome://settings/manageProfile
                       (makes undoing harder — revert with revert-chrome-hardening.sh)
  --extension-id ID    Register Clarity extension in ExtensionSettings (allowed + toolbar-pinned).
                       Without a CRX update URL, Chrome cannot force-install unpacked extensions;
                       use --hardcore to block chrome://extensions as an alternative anti-bypass.
  --allow-extension ID Allow another extension while * remains blocked (repeatable).
                       Use for NordPass, Cold Turkey, etc. — allowed but not force-pinned.
  --system             Also write policies to /Library/Managed Preferences/ (requires sudo,
                       shows as "Mandatory" on chrome://policy).
  --mobileconfig       Generate ~/Desktop/clarity-chrome-policy.mobileconfig — double-click to
                       install as a system configuration profile (strongest enforcement, no sudo).
  --help               Show this help.

Environment:
  CLARITY_CHROME_EXT_ID   Override extension ID without passing --extension-id.

Known Clarity IDs:
  Current (daily): $CLARITY_ID_CURRENT
  Legacy  (dev):   $CLARITY_ID_LEGACY

Policies applied (standard):
  IncognitoModeAvailability = 1   (Incognito disabled)
  ExtensionSettings[*].installation_mode = blocked  (block arbitrary new extension installs)
  ExtensionSettings[<allow-id>].installation_mode = allowed  (per --allow-extension)

Policies applied (--hardcore, additionally):
  URLBlocklist: chrome://extensions, chrome://settings/manageProfile
  URLAllowlist: chrome://policy, chrome://version

NOTE — force-install limitation for unpacked extensions:
  toolbar_pin=force_pinned registers in policy and shows at chrome://policy, but Chrome
  only honours it for extensions it treats as managed (force_installed or normal_installed).
  A side-loaded unpacked extension can still be manually removed from chrome://extensions
  unless you also pass --hardcore (blocks that page entirely) or publish a CRX with
  an update URL (true force_installed).

Revert: ./revert-chrome-hardening.sh  (or the full apply-chrome-managed-policy.sh remove)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hardcore)       HARDCORE=1; shift ;;
    --system)         SYSTEM=1; shift ;;
    --mobileconfig)   MOBILECONFIG=1; shift ;;
    --extension-id)   EXTENSION_ID="${2:?--extension-id requires an argument}"; shift 2 ;;
    --allow-extension) ALLOW_EXTENSIONS+=("${2:?--allow-extension requires an argument}"); shift 2 ;;
    --help|-h)        usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ $SYSTEM -eq 1 ]] && [[ $EUID -ne 0 ]]; then
  echo "Re-running with sudo for --system (/Library/Managed Preferences/)…" >&2
  sudo_args=(--system)
  [[ $HARDCORE -eq 1 ]]     && sudo_args+=(--hardcore)
  [[ $MOBILECONFIG -eq 1 ]] && sudo_args+=(--mobileconfig)
  [[ -n "$EXTENSION_ID" ]]  && sudo_args+=(--extension-id "$EXTENSION_ID")
  for eid in "${ALLOW_EXTENSIONS[@]}"; do
    sudo_args+=(--allow-extension "$eid")
  done
  exec sudo -p "[sudo] Chrome policy password: " env \
    CLARITY_CHROME_EXT_ID="$EXTENSION_ID" \
    "$0" "${sudo_args[@]}"
fi

echo "Applying Chrome hardening → ~/Library/Managed Preferences/com.google.Chrome.plist"
[[ $HARDCORE -eq 1 ]]     && echo "  Mode: hardcore (chrome://extensions blocked)"
[[ -n "$EXTENSION_ID" ]]  && echo "  Extension ID: $EXTENSION_ID"
[[ ${#ALLOW_EXTENSIONS[@]} -gt 0 ]] && echo "  Also allowed: ${ALLOW_EXTENSIONS[*]}"
[[ $SYSTEM -eq 1 ]]       && echo "  Also writing /Library/Managed Preferences/ (sudo)"
[[ $MOBILECONFIG -eq 1 ]] && echo "  Also generating .mobileconfig on Desktop"

export SCRIPT_DIR HARDCORE SYSTEM MOBILECONFIG EXTENSION_ID CLARITY_ID_CURRENT CLARITY_ID_LEGACY
export CHROME_ALLOW_EXTENSIONS="$(IFS=:; echo "${ALLOW_EXTENSIONS[*]}")"

python3 - <<'PY'
import os
import sys
from pathlib import Path

sys.path.insert(0, os.environ["SCRIPT_DIR"])
import chrome_policy_mac as cpm

hardcore        = os.environ["HARDCORE"]     == "1"
system          = os.environ["SYSTEM"]       == "1"
mobileconfig    = os.environ["MOBILECONFIG"] == "1"
extension_id = os.environ["EXTENSION_ID"].strip()
allowed_raw = os.environ.get("CHROME_ALLOW_EXTENSIONS", "")
allowed_ids = [x.strip() for x in allowed_raw.split(":") if x.strip()]

policy: dict = {"IncognitoModeAvailability": 1}

ext_settings = cpm.build_extension_settings(
    clarity_extension_id=extension_id or None,
    clarity_pin_defaults=not extension_id,
    allowed_extension_ids=allowed_ids,
)
policy["ExtensionSettings"] = ext_settings

if extension_id:
    print(f"  Pinned extension: {extension_id}")
else:
    known = [
        k
        for k in ext_settings
        if k != "*" and ext_settings[k].get("toolbar_pin")
    ]
    if known:
        print(f"  Pinned known Clarity IDs: {', '.join(known)}")
        print("  (Pass --extension-id to pin your specific loaded ID.)")
for eid in allowed_ids:
    print(f"  Allowed extension: {eid}")

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

if mobileconfig:
    mc_path = cpm.generate_mobileconfig(policy)
    print(f"\nGenerated .mobileconfig: {mc_path}")
    print("  → Double-click to install, then:")
    print("    macOS 13+: System Settings → Privacy & Security → Profiles → install")
    print("  → After installing, quit Chrome (Cmd+Q) and reopen.")

print()
print("Next steps:")
print("  1. Fully quit Chrome (Cmd+Q — not just close window)")
print("  2. Reopen Chrome → go to chrome://policy")
print("  3. Expected:")
print("     IncognitoModeAvailability = 1  (Platform, Recommended)")
print("     ExtensionSettings — should show blocked/* + your extension ID")
if mobileconfig:
    print("     After profile install: policies show as 'Platform' / 'Mandatory'")
print("  4. If ExtensionSettings still missing: install the .mobileconfig (run with --mobileconfig)")
print("     OR re-run with --system (requires sudo password) for /Library/Managed Preferences/")
print()
print("Honest limitation: toolbar_pin/force_pinned only prevents unpinning from toolbar.")
print("  It does NOT prevent manual removal of unpacked extensions from chrome://extensions.")
print("  To truly block removal: use --hardcore (blocks chrome://extensions page).")
print()
print("Revert: ./revert-chrome-hardening.sh")
PY
