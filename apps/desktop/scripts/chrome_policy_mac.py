"""
macOS Chrome enterprise policy I/O.

CFPreferences only surfaces *scalar* keys from ~/Library/Managed Preferences/
com.google.Chrome.plist to Chrome (e.g. IncognitoModeAvailability). Nested
policies (ExtensionSettings, URLBlocklist, ExtensionInstallForcelist) must be
written to ~/Library/Preferences/com.google.Chrome.plist (user, recommended
level) or /Library/Managed Preferences/com.google.Chrome.plist (machine,
requires sudo).
"""

from __future__ import annotations

import plistlib
import sys
from pathlib import Path
from typing import Any

MANAGED_USER = Path.home() / "Library/Managed Preferences/com.google.Chrome.plist"
USER_PREFS = Path.home() / "Library/Preferences/com.google.Chrome.plist"
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

COMPLEX_KEYS = frozenset(
    {
        "ExtensionSettings",
        "ExtensionInstallForcelist",
        "URLBlocklist",
        "URLAllowlist",
    }
)


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


def split_policy(policy: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    scalars: dict[str, Any] = {}
    complex_: dict[str, Any] = {}
    for key, value in policy.items():
        if key in COMPLEX_KEYS or isinstance(value, (dict, list)):
            complex_[key] = value
        else:
            scalars[key] = value
    return scalars, complex_


def merge_clarity_managed(data: dict[str, Any], scalars: dict[str, Any]) -> None:
    for key in COMPLEX_KEYS:
        data.pop(key, None)
    for key, value in scalars.items():
        if key in CLARITY_KEYS:
            data[key] = value


def merge_clarity_prefs(data: dict[str, Any], complex_: dict[str, Any]) -> None:
    for key in CLARITY_KEYS & COMPLEX_KEYS:
        if key in complex_:
            data[key] = complex_[key]
        else:
            data.pop(key, None)


def apply_policy(
    policy: dict[str, Any], *, system: bool = False
) -> list[str]:
    """Write policy bundle to the correct macOS plists. Returns paths touched."""
    scalars, complex_ = split_policy(policy)
    touched: list[str] = []

    managed = load_plist(MANAGED_USER)
    merge_clarity_managed(managed, scalars)
    save_plist(MANAGED_USER, managed)
    touched.append(str(MANAGED_USER))

    if complex_:
        prefs = load_plist(USER_PREFS)
        merge_clarity_prefs(prefs, complex_)
        save_plist(USER_PREFS, prefs)
        touched.append(str(USER_PREFS))

    if system:
        if not complex_ and not scalars:
            return touched
        system_data = load_plist(SYSTEM_MANAGED)
        for key in CLARITY_KEYS:
            if key in scalars:
                system_data[key] = scalars[key]
            elif key in complex_:
                system_data[key] = complex_[key]
            else:
                system_data.pop(key, None)
        save_plist(SYSTEM_MANAGED, system_data)
        touched.append(str(SYSTEM_MANAGED))

    return touched


def remove_clarity_policies() -> list[str]:
    """Remove Clarity keys from all plist locations."""
    touched: list[str] = []

    if MANAGED_USER.exists():
        data = load_plist(MANAGED_USER)
        removed = [k for k in CLARITY_KEYS if k in data]
        for k in removed:
            del data[k]
        if data:
            save_plist(MANAGED_USER, data)
        else:
            MANAGED_USER.unlink()
        if removed:
            touched.append(str(MANAGED_USER))

    if USER_PREFS.exists():
        data = load_plist(USER_PREFS)
        removed = [k for k in CLARITY_KEYS if k in data]
        for k in removed:
            del data[k]
        if data:
            save_plist(USER_PREFS, data)
        else:
            USER_PREFS.unlink()
        if removed:
            touched.append(str(USER_PREFS))

    if SYSTEM_MANAGED.exists():
        data = load_plist(SYSTEM_MANAGED)
        removed = [k for k in CLARITY_KEYS if k in data]
        for k in removed:
            del data[k]
        if data:
            save_plist(SYSTEM_MANAGED, data)
        else:
            SYSTEM_MANAGED.unlink()
        if removed:
            touched.append(str(SYSTEM_MANAGED))

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
        print(f"{path}:")
        for k in keys:
            print(f"  {k}: {data[k]}")
    if not found:
        print("No Clarity Chrome policy keys found in managed or preference plists.")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "status":
        status()