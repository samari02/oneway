"""
macOS Chrome enterprise policy I/O.

Policy reading hierarchy (Chrome for macOS, confirmed behaviour):
  1. /Library/Managed Preferences/com.google.Chrome.plist   — machine scope, requires sudo
                                                               → shows as "Platform" / "Mandatory"
  2. ~/Library/Managed Preferences/com.google.Chrome.plist  — user scope, no sudo needed
                                                               → shows as "Platform" / "Recommended"
  3. Configuration profiles (.mobileconfig) installed via
     System Settings → Privacy & Security → Profiles         — machine scope, strongest

NOTE — previous versions of this module incorrectly split writes:
  scalars → ~/Library/Managed Preferences/   (works)
  complex keys (ExtensionSettings etc.) → ~/Library/Preferences/  (WRONG — Chrome ignores
  managed-policy keys written to the regular user Preferences plist)

Chrome's macOS policy backend (RegistryDict / CFPreferences) reads BOTH scalars AND
nested dicts/arrays from the Managed Preferences paths.  Writing ExtensionSettings
to ~/Library/Preferences/com.google.Chrome.plist (Chrome's own data file) is not
visible at chrome://policy and does nothing for enterprise enforcement.

Recommendation:
  • User-scope only (no sudo): write everything to ~/Library/Managed Preferences/ — works
    for IncognitoModeAvailability and ExtensionSettings, shows as "Recommended".
  • Machine-scope / Mandatory (requires sudo): write to /Library/Managed Preferences/.
  • Gold standard (no sudo, strongest): install the generated .mobileconfig profile.
"""

from __future__ import annotations

import plistlib
import sys
import uuid
from pathlib import Path
from typing import Any

MANAGED_USER   = Path.home() / "Library/Managed Preferences/com.google.Chrome.plist"
# Legacy write target (plain user prefs — NOT a policy path, only kept for cleanup)
USER_PREFS     = Path.home() / "Library/Preferences/com.google.Chrome.plist"
SYSTEM_MANAGED = Path("/Library/Managed Preferences/com.google.Chrome.plist")

CLARITY_KEYS = frozenset(
    {
        "IncognitoModeAvailability",
        "ExtensionInstallForcelist",
        "ExtensionSettings",
        "URLBlocklist",
        "URLAllowlist",
    }
)

CLARITY_EXT_ID_CURRENT = "bladnadefjcnkapbdclfjpbekhmmoojb"
CLARITY_EXT_ID_LEGACY = "pocdhgbmmooabipboifieikkigmaanok"


def build_extension_settings(
    *,
    clarity_extension_id: str | None = None,
    clarity_pin_defaults: bool = True,
    allowed_extension_ids: list[str] | None = None,
    block_wildcard: bool = True,
) -> dict[str, Any]:
    """Build Chrome ExtensionSettings: block * by default, allow specific IDs.

    Clarity (--extension-id) entries get toolbar_pin=force_pinned.
    Additional --allow-extension IDs are allowed without forced toolbar pin.
    """
    ext_settings: dict[str, Any] = {}
    if block_wildcard:
        ext_settings["*"] = {"installation_mode": "blocked"}

    def allow_id(eid: str, *, pin: bool) -> None:
        entry: dict[str, Any] = {"installation_mode": "allowed"}
        if pin:
            entry["toolbar_pin"] = "force_pinned"
        ext_settings[eid] = entry

    if clarity_extension_id:
        allow_id(clarity_extension_id, pin=True)
    elif clarity_pin_defaults:
        allow_id(CLARITY_EXT_ID_CURRENT, pin=True)
        allow_id(CLARITY_EXT_ID_LEGACY, pin=True)

    seen = {k for k in ext_settings if k != "*"}
    for raw in allowed_extension_ids or []:
        eid = raw.strip()
        if not eid or eid in seen:
            continue
        seen.add(eid)
        allow_id(eid, pin=False)

    return ext_settings


def load_plist(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    with path.open("rb") as f:
        return plistlib.load(f)


def save_plist(path: Path, data: dict[str, Any]) -> None:
    if not data:
        if path.exists():
            path.unlink()
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as f:
        plistlib.dump(data, f)


def apply_policy(
    policy: dict[str, Any], *, system: bool = False
) -> list[str]:
    """Write all policy keys to ~/Library/Managed Preferences/ (and optionally system path).

    ALL keys — including nested dicts like ExtensionSettings — are written to the
    Managed Preferences plist.  Chrome reads both scalars and nested values from
    that path via CFPreferences.
    """
    touched: list[str] = []

    # --- user-scope managed prefs (no sudo) ---
    managed = load_plist(MANAGED_USER)
    for key in CLARITY_KEYS:
        if key in policy:
            managed[key] = policy[key]
        else:
            managed.pop(key, None)
    save_plist(MANAGED_USER, managed)
    touched.append(str(MANAGED_USER))

    # --- clean up legacy wrong write target (~/Library/Preferences) ---
    if USER_PREFS.exists():
        prefs = load_plist(USER_PREFS)
        stale_keys = [k for k in CLARITY_KEYS if k in prefs]
        if stale_keys:
            for k in stale_keys:
                del prefs[k]
            save_plist(USER_PREFS, prefs)
            # don't add to touched (it's a cleanup, not a policy write)

    # --- system/machine-scope managed prefs (sudo required) ---
    if system:
        sys_data = load_plist(SYSTEM_MANAGED)
        for key in CLARITY_KEYS:
            if key in policy:
                sys_data[key] = policy[key]
            else:
                sys_data.pop(key, None)
        save_plist(SYSTEM_MANAGED, sys_data)
        touched.append(str(SYSTEM_MANAGED))

    return touched


def remove_clarity_policies() -> list[str]:
    """Remove Clarity keys from all plist locations (including legacy user prefs)."""
    touched: list[str] = []

    for path in [MANAGED_USER, USER_PREFS, SYSTEM_MANAGED]:
        if not path.exists():
            continue
        data = load_plist(path)
        removed = [k for k in CLARITY_KEYS if k in data]
        for k in removed:
            del data[k]
        if data:
            save_plist(path, data)
        else:
            path.unlink()
        if removed:
            touched.append(str(path))

    return touched


def status() -> None:
    paths = [MANAGED_USER, USER_PREFS, SYSTEM_MANAGED]
    found = False
    for path in paths:
        if not path.exists():
            continue
        data = load_plist(path)
        keys = sorted(k for k in data if k in CLARITY_KEYS)
        if not keys:
            continue
        found = True
        label = "(LEGACY — Chrome ignores policy keys here)" if path == USER_PREFS else ""
        print(f"{path}: {label}")
        for k in keys:
            print(f"  {k}: {data[k]}")
    if not found:
        print("No Clarity Chrome policy keys found in managed or preference plists.")


# ---------------------------------------------------------------------------
# .mobileconfig generator
# ---------------------------------------------------------------------------

def generate_mobileconfig(
    policy: dict[str, Any],
    *,
    org: str = "Oneway / Clarity",
    profile_id: str = "com.oneway.clarity.chrome-policy",
    output_path: Path | None = None,
) -> Path:
    """Generate a signed-free .mobileconfig that delivers Chrome managed preferences.

    The profile installs as a machine-scope configuration profile (requires the user
    to approve via System Settings → Privacy & Security → Profiles, or double-click
    on macOS 13+).  Delivers ALL policy types including nested ExtensionSettings.

    Args:
        policy: dict of Chrome policy keys/values.
        org: display name shown in System Settings.
        profile_id: reverse-DNS identifier for the profile.
        output_path: where to write the .mobileconfig.  Defaults to
                     ~/Desktop/clarity-chrome-policy.mobileconfig.

    Returns:
        Path to the written file.
    """
    if output_path is None:
        output_path = Path.home() / "Desktop" / "clarity-chrome-policy.mobileconfig"

    payload_uuid = str(uuid.uuid4()).upper()
    top_uuid = str(uuid.uuid4()).upper()

    # Chrome enterprise policies via com.apple.ManagedClient.preferences payload
    mcx_settings: dict[str, Any] = {}
    for k, v in policy.items():
        mcx_settings[k] = v

    profile = {
        "PayloadContent": [
            {
                "PayloadType": "com.apple.ManagedClient.preferences",
                "PayloadVersion": 1,
                "PayloadIdentifier": f"{profile_id}.prefs",
                "PayloadUUID": payload_uuid,
                "PayloadEnabled": True,
                "PayloadDisplayName": "Chrome Enterprise Policies (Clarity)",
                "PayloadContent": {
                    "com.google.Chrome": {
                        "Forced": [
                            {"mcx_preference_settings": mcx_settings}
                        ]
                    }
                },
            }
        ],
        "PayloadDescription": (
            "Disables Incognito mode, blocks arbitrary extension installs, "
            "and pins the Clarity extension. Managed by Oneway."
        ),
        "PayloadDisplayName": f"{org} — Chrome Policy",
        "PayloadIdentifier": profile_id,
        "PayloadOrganization": org,
        "PayloadRemovalDisallowed": False,
        "PayloadScope": "System",
        "PayloadType": "Configuration",
        "PayloadUUID": top_uuid,
        "PayloadVersion": 1,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as f:
        plistlib.dump(profile, f)

    return output_path


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "status":
        status()
