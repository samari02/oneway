# Clarity Desktop (Tauri + React + TypeScript)

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Connectivity guardrails (do not break native messaging)

Chrome, the native-messaging host, and the desktop app are wired together by **fixed names and IDs**. If you change any of these without updating scripts and reinstalling, the extension will show disconnected in Clarity:

| Piece | Must stay |
|-------|-----------|
| Tauri binary | `appsdesktop` (`Cargo.toml` package name) |
| macOS app bundle | `Clarity.app` |
| Native host name | `com.clarity.app` |
| Extension ID | From manifest `"key"` → run `pnpm check:connectivity` |

**Signing key (private, not in git):** `~/.clarity/extension-signing.pem` (chmod 600). Public half lives in `apps/extension/manifest.json` as `"key"`.

After changing `key`, product name, or binary path:

1. From repo root: `pnpm ext:update` (pack CRX + STRICT policy). In Chrome: chrome://extensions → **Update**.
2. `./scripts/install-native-host.sh bladnadefjcnkapbdclfjpbekhmmoojb` (add debug binary path if needed).
3. Policy is refreshed by `ext:update`; re-run hardening only if you change allowlists.

Verify anytime: `pnpm check:connectivity` from the repo root.

## Chrome anti-bypass hardening (macOS)

**Preferred (Option A):** local CRX force_install — no Load unpacked for daily work:

```bash
pnpm ext:update   # from repo root
# then chrome://extensions → Update
```

Manual policy (same STRICT shape):

```bash
./scripts/apply-chrome-hardening.sh \
  --extension-id bladnadefjcnkapbdclfjpbekhmmoojb \
  --update-url http://127.0.0.1:8765/updates.xml \
  --mobileconfig

# Optional hardcore (also blocks chrome://extensions page):
./scripts/apply-chrome-hardening.sh --hardcore --extension-id bladnadefjcnkapbdclfjpbekhmmoojb

# Revert:
./scripts/revert-chrome-hardening.sh
```

Then quit Chrome completely (Cmd+Q), reopen, and verify at `chrome://policy` — `ExtensionSettings` with `* = blocked` and Clarity `force_installed`. Off-store CRX force_install also needs MDM or Chrome Enterprise Core on macOS (manual `.mobileconfig` alone can download the CRX then skip install).

**Known extension IDs:**
- Stable (manifest `key`): `bladnadefjcnkapbdclfjpbekhmmoojb`
- Legacy (pre-key unpack): `pjdboibemcgajdjnppgfnffmajcokbmf`
- Legacy dev:              `pocdhgbmmooabipboifieikkigmaanok`

See [`docs/04-guides/chrome_managed_policy_macos_2026-11-14.md`](../../docs/04-guides/chrome_managed_policy_macos_2026-11-14.md) for full details and limitations (force-install requires CRX + update URL).
