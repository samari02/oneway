#!/usr/bin/env bash
# Pack apps/extension/dist into a CRX3 signed with ~/.clarity/extension-signing.pem
# so the extension ID stays bladnadefjcnkapbdclfjpbekhmmoojb.
#
# Usage:
#   ./pack-crx.sh              # pack existing dist/
#   ./pack-crx.sh --build     # pnpm build then pack
#
# Outputs:
#   ~/.clarity/crx-update/clarity.crx
#   ~/.clarity/crx-update/updates.xml
#
# Chrome force_installed cannot use file:// update URLs reliably — pair with
# serve-crx-update.py (http://127.0.0.1:8765/updates.xml).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST="$EXT_ROOT/dist"
PEM="${CLARITY_EXT_PEM:-$HOME/.clarity/extension-signing.pem}"
OUT_DIR="${CLARITY_CRX_DIR:-$HOME/.clarity/crx-update}"
CRX_NAME="clarity.crx"
UPDATE_PORT="${CLARITY_CRX_PORT:-8765}"
UPDATE_BASE="http://127.0.0.1:${UPDATE_PORT}"
EXPECTED_ID="bladnadefjcnkapbdclfjpbekhmmoojb"
CHROME="${CLARITY_CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
DO_BUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build) DO_BUILD=1; shift ;;
    --help|-h)
      sed -n '2,16p' "$0" | sed 's/^# //'
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ $DO_BUILD -eq 1 ]]; then
  echo "Building extension…"
  (cd "$EXT_ROOT" && pnpm build)
fi

if [[ ! -d "$DIST" ]] || [[ ! -f "$DIST/manifest.json" ]]; then
  echo "Missing $DIST/manifest.json — run with --build or pnpm build first." >&2
  exit 1
fi

if [[ ! -f "$PEM" ]]; then
  echo "Missing signing key: $PEM" >&2
  echo "Expected private PEM that matches manifest \"key\" (ID $EXPECTED_ID)." >&2
  exit 1
fi

if [[ ! -x "$CHROME" ]]; then
  echo "Google Chrome not found at: $CHROME" >&2
  echo "Set CLARITY_CHROME_BIN to the Chrome binary path." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

# Inject localhost update_url so CRX updates follow the same channel as policy.
python3 - <<PY
import json
from pathlib import Path

manifest_path = Path("$DIST") / "manifest.json"
data = json.loads(manifest_path.read_text())
data["update_url"] = "$UPDATE_BASE/updates.xml"
manifest_path.write_text(json.dumps(data, indent=2) + "\n")
print(f"  manifest version={data.get('version')} update_url={data['update_url']}")
PY

# Chrome writes <folder>.crx next to the extension directory.
rm -f "${DIST}.crx"
echo "Packing CRX with Chrome (--pack-extension)…"
"$CHROME" \
  --pack-extension="$DIST" \
  --pack-extension-key="$PEM" \
  --no-message-box

if [[ ! -f "${DIST}.crx" ]]; then
  echo "Pack failed — ${DIST}.crx not created." >&2
  exit 1
fi

cp -f "${DIST}.crx" "$OUT_DIR/$CRX_NAME"
rm -f "${DIST}.crx"

VERSION="$(python3 -c "import json; print(json.load(open('$DIST/manifest.json'))['version'])")"

cat > "$OUT_DIR/updates.xml" <<XML
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='$EXPECTED_ID'>
    <updatecheck codebase='$UPDATE_BASE/$CRX_NAME' version='$VERSION'/>
  </app>
</gupdate>
XML

# Verify public key → ID still matches (guard against wrong PEM).
python3 - <<PY
import hashlib, subprocess, sys
from pathlib import Path

pem = Path("$PEM")
der = subprocess.check_output(
    ["openssl", "rsa", "-in", str(pem), "-pubout", "-outform", "DER"],
    stderr=subprocess.DEVNULL,
)
digest = hashlib.sha256(der).digest()[:16]
ext_id = "".join(
    chr(ord("a") + ((b >> 4) & 0xF)) + chr(ord("a") + (b & 0xF)) for b in digest
)
expected = "$EXPECTED_ID"
if ext_id != expected:
    print(f"ERROR: PEM yields ID {ext_id}, expected {expected}", file=sys.stderr)
    sys.exit(1)
print(f"  Signed ID OK: {ext_id}")
PY

echo
echo "Packed:"
echo "  → $OUT_DIR/$CRX_NAME  (v$VERSION)"
echo "  → $OUT_DIR/updates.xml"
echo "  update_url: $UPDATE_BASE/updates.xml"
echo
echo "Serve with: $SCRIPT_DIR/serve-crx-update.py"
echo "Or full flow:  pnpm ext:update  (from repo root)"
