#!/usr/bin/env bash
# Chrome anti-bypass hardening for macOS.
#
# All policies (scalars AND nested ExtensionSettings) are written to:
#   ~/Library/Managed Preferences/com.google.Chrome.plist   (user scope, no admin required)
# Optionally also to /Library/Managed Preferences/ with --system (requires sudo).
# Or generate a system-level .mobileconfig profile with --mobileconfig (recommended).
#
# Usage:
#   ./apply-chrome-hardening.sh [--hardcore] [--extension-id ID] [--update-url URL] \
#       [--allow-extension ID]... [--system] [--mobileconfig]
#   ./apply-chrome-hardening.sh --allow-load-unpacked ...   # TEMP DEV unlock only
#   ./apply-chrome-hardening.sh --help
#
# DEV NOTE (Chrome Enterprise docs, confirmed):
#   Off-store force_install on macOS needs real MDM / MCX / Chrome Enterprise
#   Core. Hand-installed .mobileconfig does NOT qualify → Update hangs.
#   Real Option A (personal Mac / clients): Chrome Web Store (CWS force_install
#   works). Local CRX server is for after MDM or Store update hosting.
#   Interim DEV: --allow-load-unpacked → Load unpacked dist → re-STRICT with
#   Clarity as allowed (NOT force_installed from localhost).
#
# After running: fully quit Chrome (Cmd+Q), reopen, verify at chrome://policy
#
# Chromium quirk: when ExtensionSettings["*"].installation_mode = blocked,
# chrome://extensions → Load unpacked is refused BEFORE any per-ID allowlist
# (BlocklistedByDefault). Without MDM, use --allow-load-unpacked temporarily.
#
# Known Clarity extension IDs:
#   Stable (manifest `key`): bladnadefjcnkapbdclfjpbekhmmoojb
#   Legacy (pre-key unpack): pjdboibemcgajdjnppgfnffmajcokbmf
#   Legacy (dev):            pocdhgbmmooabipboifieikkigmaanok
#
# See docs/04-guides/chrome_managed_policy_macos_2026-11-14.md for full details.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

HARDCORE=0
SYSTEM=0
MOBILECONFIG=0
ALLOW_LOAD_UNPACKED=0
EXTENSION_ID="${CLARITY_CHROME_EXT_ID:-}"
UPDATE_URL="${CLARITY_CHROME_UPDATE_URL:-}"
ALLOW_EXTENSIONS=()

# Known extension IDs (for reference / quick default)
CLARITY_ID_CURRENT="bladnadefjcnkapbdclfjpbekhmmoojb"
CLARITY_ID_LEGACY="pocdhgbmmooabipboifieikkigmaanok"
DEFAULT_LOCAL_UPDATE_URL="http://127.0.0.1:8765/updates.xml"

usage() {
  cat <<EOF
Chrome hardening script — macOS managed preferences

Usage:
  $(basename "$0") [OPTIONS]

Options:
  --hardcore           Also block chrome://extensions + chrome://settings/manageProfile
                       (makes undoing harder — revert with revert-chrome-hardening.sh)
  --extension-id ID    Register Clarity in ExtensionSettings (pin + allow, or force_install
                       when --update-url is set). Stable ID: $CLARITY_ID_CURRENT
  --update-url URL     Force-install Clarity from this update manifest (http/https).
                       ONLY works off-store under MDM / Enterprise Core.
                       CWS update URL is the personal/client path. Local CRX:
                       $DEFAULT_LOCAL_UPDATE_URL (MDM only). file:// unreliable.
  --allow-extension ID Allow another extension while * remains blocked (repeatable).
                       Use for NordPass, Cold Turkey, etc. — allowed but not force-pinned.
  --allow-load-unpacked
                       TEMPORARY DEV: omit ExtensionSettings["*"]=blocked so Load
                       unpacked works. Re-apply STRICT (Clarity allowed) after load.
  --system             Also write policies to /Library/Managed Preferences/ (requires sudo,
                       shows as "Mandatory" on chrome://policy).
  --mobileconfig       Generate ~/Desktop/clarity-chrome-policy.mobileconfig — double-click to
                       install as a system configuration profile. Does NOT unlock off-store
                       force_install (needs real MDM).
  --help               Show this help.

Environment:
  CLARITY_CHROME_EXT_ID      Override extension ID without passing --extension-id.
  CLARITY_CHROME_UPDATE_URL  Override update URL without passing --update-url.

Known Clarity IDs:
  Current (daily): $CLARITY_ID_CURRENT
  Legacy  (dev):   $CLARITY_ID_LEGACY

Policies applied (standard / STRICT):
  IncognitoModeAvailability = 1
  ExtensionSettings[*].installation_mode = blocked
  ExtensionSettings[<clarity>].installation_mode = allowed + toolbar_pin
    (force_installed only with --update-url AND real MDM / CWS URL)
  ExtensionSettings[<allow-id>].installation_mode = allowed
  ExtensionInstallForcelist when --update-url is set
  (with --allow-load-unpacked: * is NOT blocked — Load unpacked works)

Policies applied (--hardcore, additionally):
  URLBlocklist: chrome://extensions, chrome://settings/manageProfile
  URLAllowlist: chrome://policy, chrome://version

DEV interim (no MDM):
  ./apply-chrome-hardening.sh --allow-load-unpacked --system
  → Load unpacked apps/extension/dist → then:
  pnpm ext:update --policy-only   # STRICT allowed + mobileconfig, no localhost force

Revert: ./revert-chrome-hardening.sh  (or the full apply-chrome-managed-policy.sh remove)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hardcore)       HARDCORE=1; shift ;;
    --system)         SYSTEM=1; shift ;;
    --mobileconfig)   MOBILECONFIG=1; shift ;;
    --allow-load-unpacked) ALLOW_LOAD_UNPACKED=1; shift ;;
    --extension-id)   EXTENSION_ID="${2:?--extension-id requires an argument}"; shift 2 ;;
    --update-url)     UPDATE_URL="${2:?--update-url requires an argument}"; shift 2 ;;
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
  [[ $ALLOW_LOAD_UNPACKED -eq 1 ]] && sudo_args+=(--allow-load-unpacked)
  [[ -n "$EXTENSION_ID" ]]  && sudo_args+=(--extension-id "$EXTENSION_ID")
  [[ -n "$UPDATE_URL" ]]   && sudo_args+=(--update-url "$UPDATE_URL")
  for eid in "${ALLOW_EXTENSIONS[@]}"; do
    sudo_args+=(--allow-extension "$eid")
  done
  exec sudo -p "[sudo] Chrome policy password: " env \
    CLARITY_CHROME_EXT_ID="$EXTENSION_ID" \
    CLARITY_CHROME_UPDATE_URL="$UPDATE_URL" \
    "$0" "${sudo_args[@]}"
fi

echo "Applying Chrome hardening → ~/Library/Managed Preferences/com.google.Chrome.plist"
[[ $HARDCORE -eq 1 ]]     && echo "  Mode: hardcore (chrome://extensions blocked)"
[[ $ALLOW_LOAD_UNPACKED -eq 1 ]] && echo "  TEMP: Load unpacked allowed (* not blocked) — re-harden after install"
[[ -n "$EXTENSION_ID" ]]  && echo "  Extension ID: $EXTENSION_ID"
[[ -n "$UPDATE_URL" ]]   && echo "  Force-install update_url: $UPDATE_URL"
[[ ${#ALLOW_EXTENSIONS[@]} -gt 0 ]] && echo "  Also allowed: ${ALLOW_EXTENSIONS[*]}"
[[ $SYSTEM -eq 1 ]]       && echo "  Also writing /Library/Managed Preferences/ (sudo)"
[[ $MOBILECONFIG -eq 1 ]] && echo "  Also generating .mobileconfig on Desktop"

export SCRIPT_DIR HARDCORE SYSTEM MOBILECONFIG ALLOW_LOAD_UNPACKED EXTENSION_ID UPDATE_URL
export CLARITY_ID_CURRENT CLARITY_ID_LEGACY
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
allow_unpacked  = os.environ.get("ALLOW_LOAD_UNPACKED", "0") == "1"
extension_id = os.environ.get("EXTENSION_ID", "").strip()
update_url = os.environ.get("UPDATE_URL", "").strip()
allowed_raw = os.environ.get("CHROME_ALLOW_EXTENSIONS", "")
allowed_ids = [x.strip() for x in allowed_raw.split(":") if x.strip()]

if update_url.startswith("file:"):
    print(
        "WARNING: file:// update URLs are unreliable in Chrome. "
        "Prefer http://127.0.0.1:8765/updates.xml via serve-crx-update.py.",
        file=sys.stderr,
    )

policy: dict = {"IncognitoModeAvailability": 1}

ext_settings = cpm.build_extension_settings(
    clarity_extension_id=extension_id or None,
    clarity_pin_defaults=not extension_id,
    allowed_extension_ids=allowed_ids,
    block_wildcard=not allow_unpacked,
    clarity_update_url=update_url or None,
)
policy["ExtensionSettings"] = ext_settings

force_id = extension_id or (cpm.CLARITY_EXT_ID_CURRENT if update_url else "")
if update_url and force_id:
    entry = cpm.build_forcelist_entry(force_id, update_url)
    policy["ExtensionInstallForcelist"] = [entry]
    print(f"  Force-install: {entry}")
    print("  override_update_url=true (subsequent updates use this URL)")
elif allow_unpacked:
    print("  Wildcard * NOT blocked — Load unpacked will work after Chrome relaunch.")
    print("  Prefer pnpm ext:update (CRX) instead of leaving * open.")

if extension_id:
    mode = ext_settings.get(extension_id, {}).get("installation_mode", "?")
    print(f"  Clarity extension: {extension_id} ({mode})")
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
print("     ExtensionSettings — blocked/* + Clarity (+ force_installed if --update-url)")
if update_url:
    print("     ExtensionInstallForcelist — clarity id;update_url")
    print("  4. Off-store force_install needs MDM/Enterprise Core; else Update hangs.")
    print("     Prefer CWS URL, or Load unpacked + STRICT allowed (no --update-url).")
else:
    print("  4. Clarity = allowed/pinned (correct for personal Mac without MDM).")
    print("     Interim: Load unpacked dist, then keep this STRICT (no localhost force).")
if mobileconfig:
    print("     After profile install: policies show as 'Platform' / 'Mandatory'")
    print("     NOTE: .mobileconfig alone does NOT unlock off-store force_install.")
print("  Optional Mandatory plist:")
print("     sudo cp ~/Library/Managed\\ Preferences/com.google.Chrome.plist \\")
print("            /Library/Managed\\ Preferences/com.google.Chrome.plist")
print()
print("Revert: ./revert-chrome-hardening.sh")
PY
