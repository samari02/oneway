#!/usr/bin/env bash
# Clarity extension build + STRICT policy refresh (macOS).
#
# DEV NOTE (Chrome Enterprise docs, confirmed):
#   On macOS, force_install of extensions OUTSIDE the Chrome Web Store only
#   works under real MDM / MCX / Chrome Enterprise Core. A hand-installed
#   .mobileconfig does NOT qualify. Localhost updates.xml can be perfect and
#   Chrome will still ignore force_install → Update hangs, Clarity never appears.
#
#   • Client-smooth path (real Option A): Chrome Web Store. force_install from
#     CWS works without MDM. Publish there for personal Macs / clients.
#   • Local CRX server: useful AFTER MDM, or as update hosting once Store-
#     listed. Do NOT expect force_installed from http://127.0.0.1 without MDM.
#   • Interim DEV path (this Mac, no MDM):
#       1) --allow-load-unpacked (temp) → Load unpacked apps/extension/dist
#       2) re-STRICT: * blocked + Clarity installation_mode=allowed (NOT
#          force_installed from localhost) + NordPass/Cold Turkey allowed
#   • Optional advanced: Chrome Enterprise Core / MDM — do NOT auto-enroll.
#
# Does (default):
#   1. Build apps/extension/dist (keeps stable key → ID below)
#   2. Pack CRX + optional localhost server (artifacts / future MDM only)
#   3. Write STRICT policy: * blocked + Clarity allowed + allowlists
#   4. Regenerate ~/Desktop/clarity-chrome-policy.mobileconfig (no fake
#      localhost force_installed)
#   5. Stage system plist for optional sudo cp
#
# Usage (from repo root):
#   pnpm ext:update
#   ./apps/extension/scripts/ext-update.sh
#   ./apps/extension/scripts/ext-update.sh --no-build
#   ./apps/extension/scripts/ext-update.sh --policy-only
#   ./apps/extension/scripts/ext-update.sh --with-localhost-force   # MDM only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$EXT_ROOT/../.." && pwd)"
DESKTOP_SCRIPTS="$REPO_ROOT/apps/desktop/scripts"

CLARITY_ID="bladnadefjcnkapbdclfjpbekhmmoojb"
UPDATE_PORT="${CLARITY_CRX_PORT:-8765}"
UPDATE_URL="http://127.0.0.1:${UPDATE_PORT}/updates.xml"
CRX_DIR="${CLARITY_CRX_DIR:-$HOME/.clarity/crx-update}"
STAGED_PLIST="$CRX_DIR/com.google.Chrome.plist"

# Allowlists (allowed, not force-installed)
NORDPASS="eiaeiblijfjekdanodkjadfinkhbfgcd"
COLD_TURKEY_A="efnolkfmdbinpkbnfigocgfglnhahldj"
COLD_TURKEY_B="pganeibhckoanndahmnfggfoeofncnii"
LEGACY_UNPACK="pjdboibemcgajdjnppgfnffmajcokbmf"

DO_BUILD=1
POLICY_ONLY=0
WITH_LOCALHOST_FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-build) DO_BUILD=0; shift ;;
    --policy-only) POLICY_ONLY=1; DO_BUILD=0; shift ;;
    --with-localhost-force) WITH_LOCALHOST_FORCE=1; shift ;;
    --help|-h)
      sed -n '2,36p' "$0" | sed 's/^# //'
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

echo "=== Clarity ext:update (STRICT allowed — Web Store is real Option A) ==="
echo
if [[ $WITH_LOCALHOST_FORCE -eq 1 ]]; then
  echo "WARNING: --with-localhost-force only works under MDM / Chrome Enterprise Core."
  echo "         Hand-installed .mobileconfig does NOT qualify — Update will hang."
  echo
fi

if [[ $POLICY_ONLY -eq 0 ]]; then
  if [[ $DO_BUILD -eq 1 ]]; then
    "$SCRIPT_DIR/pack-crx.sh" --build
  else
    "$SCRIPT_DIR/pack-crx.sh"
  fi
  echo
  # Still pack/serve CRX for future MDM or Store update hosting — not for
  # personal-Mac force_install.
  python3 "$SCRIPT_DIR/serve-crx-update.py" --daemon || true
  echo
else
  echo "Policy-only mode — skipping build/pack."
  echo
fi

if [[ $WITH_LOCALHOST_FORCE -eq 1 ]]; then
  if [[ ! -f "$CRX_DIR/clarity.crx" ]] || [[ ! -f "$CRX_DIR/updates.xml" ]]; then
    echo "Missing CRX artifacts in $CRX_DIR — run without --policy-only first." >&2
    exit 1
  fi
  if ! curl -sf "$UPDATE_URL" >/dev/null; then
    echo "WARNING: $UPDATE_URL not reachable. Start: $SCRIPT_DIR/serve-crx-update.py --daemon" >&2
  fi
  echo "Applying STRICT + localhost force_installed (MDM-only; will fail otherwise)…"
  "$DESKTOP_SCRIPTS/apply-chrome-hardening.sh" \
    --extension-id "$CLARITY_ID" \
    --update-url "$UPDATE_URL" \
    --allow-extension "$NORDPASS" \
    --allow-extension "$COLD_TURKEY_A" \
    --allow-extension "$COLD_TURKEY_B" \
    --allow-extension "$LEGACY_UNPACK" \
    --mobileconfig
else
  echo "Applying STRICT Chrome policy ( * blocked + Clarity allowed — NO localhost force_install )…"
  "$DESKTOP_SCRIPTS/apply-chrome-hardening.sh" \
    --extension-id "$CLARITY_ID" \
    --allow-extension "$NORDPASS" \
    --allow-extension "$COLD_TURKEY_A" \
    --allow-extension "$COLD_TURKEY_B" \
    --allow-extension "$LEGACY_UNPACK" \
    --mobileconfig
fi

# Stage a copy of the user managed plist for optional machine-scope install.
if [[ -f "$HOME/Library/Managed Preferences/com.google.Chrome.plist" ]]; then
  cp -f "$HOME/Library/Managed Preferences/com.google.Chrome.plist" "$STAGED_PLIST"
  echo "Staged system plist copy: $STAGED_PLIST"
fi

VERSION="$(python3 -c "import json; print(json.load(open('$EXT_ROOT/dist/manifest.json'))['version'])" 2>/dev/null || echo "?")"

cat <<EOF

────────────────────────────────────────────────────────────
DEV NOTE
  Web Store = client-smooth Option A (force_install CWS works).
  Local CRX server = only after MDM, or for update hosting after Store.
  Personal Mac without MDM: Load unpacked (temp unlock) then STRICT allowed.

INTERIM DEV LOAD (this Mac now)
  # 1) TEMP unlock Load unpacked (system scope):
  ./apps/desktop/scripts/apply-chrome-hardening.sh --allow-load-unpacked --system
  # Cmd+Q Chrome → reopen → chrome://extensions → Load unpacked →
  #   $EXT_ROOT/dist   (ID must be $CLARITY_ID)

  # 2) Re-STRICT (Clarity allowed, NOT force_installed from localhost):
  pnpm ext:update --policy-only
  # or the apply-chrome-hardening.sh call above without --allow-load-unpacked
  sudo cp "$STAGED_PLIST" /Library/Managed\\ Preferences/com.google.Chrome.plist
  sudo killall cfprefsd 2>/dev/null || true
  # Cmd+Q Chrome → chrome://policy → * blocked, Clarity allowed

NEXT AFTER POLICY REFRESH
  1) Optional Mandatory: sudo cp staged plist (above) OR open Desktop mobileconfig
  2) Cmd+Q Chrome → reopen → chrome://policy
  3) Expected STRICT:
       ExtensionSettings[*] = blocked
       ExtensionSettings[$CLARITY_ID] = allowed (+ pin)
       NordPass / Cold Turkey = allowed
       NO force_installed from 127.0.0.1 (unless --with-localhost-force + MDM)

Native host:
  ./apps/desktop/scripts/install-native-host.sh $CLARITY_ID

Packed version: $VERSION
CRX dir:        $CRX_DIR  (artifacts for MDM/Store hosting — not personal force_install)
────────────────────────────────────────────────────────────
EOF
