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

1. `pnpm build` in `apps/extension`, remove the old unpacked extension in Chrome, **Load unpacked** → `apps/extension/dist`.
2. `./scripts/install-native-host.sh bladnadefjcnkapbdclfjpbekhmmoojb` (add debug binary path if needed).
3. Re-run `apply-chrome-hardening.sh` with the new `--extension-id` if you use managed policy.

Verify anytime: `pnpm check:connectivity` from the repo root.

## Chrome anti-bypass hardening (macOS)

After loading the Chrome extension, run the hardening script to disable Incognito and block random extension installs:

```bash
# Standard (recommended):
./scripts/apply-chrome-hardening.sh --extension-id bladnadefjcnkapbdclfjpbekhmmoojb

# Optional hardcore (also blocks chrome://extensions page):
./scripts/apply-chrome-hardening.sh --hardcore --extension-id bladnadefjcnkapbdclfjpbekhmmoojb

# Revert:
./scripts/revert-chrome-hardening.sh
```

Then quit Chrome completely (Cmd+Q), reopen, and verify at `chrome://policy` — you should see `ExtensionSettings` (not only Incognito). On macOS, nested policies are written to `~/Library/Preferences/com.google.Chrome.plist`; see the guide for `--system` / sudo.

**Known extension IDs:**
- Stable (manifest `key`): `bladnadefjcnkapbdclfjpbekhmmoojb`
- Legacy (pre-key unpack): `pjdboibemcgajdjnppgfnffmajcokbmf`
- Legacy dev:              `pocdhgbmmooabipboifieikkigmaanok`

See [`docs/04-guides/chrome_managed_policy_macos_2026-11-14.md`](../../docs/04-guides/chrome_managed_policy_macos_2026-11-14.md) for full details and limitations (force-install requires CRX + update URL).
