# Native messaging host — build, install, when to rerun (macOS + Chrome)

**Last update:** 2026-03-29

The Chrome extension talks to Clarity through **Native Messaging** (`com.clarity.app`). Chrome starts whatever binary the **host manifest** points to. Clarity only runs the native-host protocol when the process is started with **`--native-host`**. Chrome does **not** pass that flag, so the repo ships a **runner script** that adds it.

This guide lists **exact terminal commands** and **when** you need them.

---

## When to rebuild the binary and reinstall the host

Do **both** (build + `install-native-host.sh`) when:

- You changed Rust code under `apps/desktop/src-tauri/` that affects the host (e.g. `native_host.rs`, `custom_rules_file.rs`).
- You switched between **debug** and **release** builds and want Chrome to use that binary.
- **First-time setup** on a machine, or the extension **ID** changed (new unpacked extension → new ID in `chrome://extensions`).
- Custom blocking rules sync misbehaves and you suspect an **old** host binary (GET_CONFIG missing `customRules` / `customSearchKeywords`).

You do **not** need to reinstall the host for every front-end-only change in the extension if you only reload the extension — but you **must** run `npm run build` in `apps/extension` and reload when you change extension source.

---

## 1. Build the Tauri / native host binary

From the repo root (adjust path if your clone lives elsewhere):

```bash
cd /Users/samuelmarinelli/Development/oneway/apps/desktop/src-tauri
cargo build
```

- **Debug** output (default):  
  `apps/desktop/src-tauri/target/debug/appsdesktop`

Optional release:

```bash
cd /Users/samuelmarinelli/Development/oneway/apps/desktop/src-tauri
cargo build --release
```

- **Release** output:  
  `apps/desktop/src-tauri/target/release/appsdesktop`

Warnings from `cargo build` are normal unless the command fails.

---

## 2. Get your Chrome extension ID

1. Open Chrome: `chrome://extensions`
2. Turn on **Developer mode** (top right).
3. Find **Clarity** and copy the **ID** (32-character string under the name).

You will paste this ID into the install script in the next step.

---

## 3. Install the host manifest + runner (one command)

The script:

- Writes `~/.clarity/clarity-native-host-runner.sh` → runs `YOUR_BINARY --native-host`
- Writes  
  `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.clarity.app.json`  
  with `allowed_origins` set to `chrome-extension://YOUR_ID/`

**Template** (replace `YOUR_EXTENSION_ID` and the binary path):

```bash
chmod +x /Users/samuelmarinelli/Development/oneway/apps/desktop/scripts/install-native-host.sh

/Users/samuelmarinelli/Development/oneway/apps/desktop/scripts/install-native-host.sh YOUR_EXTENSION_ID /Users/samuelmarinelli/Development/oneway/apps/desktop/src-tauri/target/debug/appsdesktop
```

For a **release** build, use `target/release/appsdesktop` instead of `debug`.

If Clarity is installed as **`/Applications/Clarity.app`**, you can omit the second argument; the script defaults to that app’s executable:

```bash
/Users/samuelmarinelli/Development/oneway/apps/desktop/scripts/install-native-host.sh YOUR_EXTENSION_ID
```

---

## 4. Reload the extension in Chrome

`chrome://extensions` → **Reload** on Clarity. Otherwise Chrome may keep a stale native connection.

---

## 5. Quick verification

- **`~/.clarity/extension-status.json`**: `last_heartbeat` should advance about every minute when the extension is connected.
- **Custom blocking**: after saving rules in the desktop app, `~/.clarity/custom-blocking-rules.json` should update; the extension receives them via `GET_CONFIG` from the host reading that file.

---

## Related files

| Item | Path |
|------|------|
| Install script | `apps/desktop/scripts/install-native-host.sh` |
| Host manifest template | `apps/desktop/src-tauri/native-host/com.clarity.app.json` |
| Native protocol (Rust) | `apps/desktop/src-tauri/src/native_host.rs` |
| Disk → GET_CONFIG payload | `apps/desktop/src-tauri/src/custom_rules_file.rs` |
| Extension client | `apps/extension/src/background/native-messaging.ts` |

---

## See also

- [clarity_desktop_extension_connectivity_2026-03-28.md](../02-features/05-plateforme-desktop-extension/clarity-connectivity/clarity_desktop_extension_connectivity_2026-03-28.md) — broader connectivity notes
- [build_et_distribution_2026-03-28.md](./build_et_distribution_2026-03-28.md) — builds and distribution
