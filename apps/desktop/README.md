# Clarity Desktop (Tauri + React + TypeScript)

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Chrome anti-bypass hardening (macOS)

After loading the Chrome extension, run the hardening script to disable Incognito and block random extension installs:

```bash
# Standard (recommended):
./scripts/apply-chrome-hardening.sh --extension-id pjdboibemcgajdjnppgfnffmajcokbmf

# Optional hardcore (also blocks chrome://extensions page):
./scripts/apply-chrome-hardening.sh --hardcore --extension-id pjdboibemcgajdjnppgfnffmajcokbmf

# Revert:
./scripts/revert-chrome-hardening.sh
```

Then quit Chrome completely (Cmd+Q), reopen, and verify at `chrome://policy` — you should see `ExtensionSettings` (not only Incognito). On macOS, nested policies are written to `~/Library/Preferences/com.google.Chrome.plist`; see the guide for `--system` / sudo.

**Known extension IDs:**
- Current daily: `pjdboibemcgajdjnppgfnffmajcokbmf`
- Legacy dev:    `pocdhgbmmooabipboifieikkigmaanok`

See [`docs/04-guides/chrome_managed_policy_macos_2026-11-14.md`](../../docs/04-guides/chrome_managed_policy_macos_2026-11-14.md) for full details and limitations (force-install requires CRX + update URL).
