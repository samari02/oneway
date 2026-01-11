# Native Messaging

> Communication bidirectionnelle entre l'Extension Chrome et la Desktop App

---

## Table des matières

1. [Overview](#overview)
2. [User Experience](#user-experience)
3. [Architecture](#architecture)
4. [Implementation](#implementation)
5. [Message Protocol](#message-protocol)
6. [Security](#security)
7. [Testing](#testing)

---

## Overview

### Qu'est-ce que Native Messaging ?

Native Messaging est une API Chrome qui permet à une extension de communiquer avec une application native installée sur l'ordinateur de l'utilisateur.

```
┌─────────────────┐                      ┌─────────────────┐
│   Extension     │  ←— stdin/stdout —→  │   Desktop App   │
│   (Chrome)      │     Native Host      │   (Tauri)       │
└─────────────────┘                      └─────────────────┘
```

### Pourquoi en a-t-on besoin ?

| Sans Native Messaging | Avec Native Messaging |
|-----------------------|----------------------|
| Extension isolée | Extension connectée à l'app |
| 2 logins nécessaires | 1 seul login |
| Pas de dashboard temps réel | Sync instantané |
| Config manuelle dans chaque app | Config partagée |

### Ce que ça permet

1. **Auth partagée** : Login une fois, connecté partout
2. **Sync temps réel** : Historique de navigation → Dashboard desktop
3. **Config centralisée** : Modes/habits configurés dans l'app → Appliqués par l'extension
4. **Données locales** : Pas besoin d'internet pour la communication

---

## User Experience

### Flow typique

```
┌────────────────────────────────────────────────────────────┐
│  1. User installe Desktop App                              │
│     → Se connecte avec email (magic link)                  │
│     → Configure ses habits et modes                        │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│  2. User installe Extension Chrome                         │
│     → L'extension détecte la Desktop App                   │
│     → Auto-connectée (zéro action requise)                 │
│     → Reçoit la config (modes, rules)                      │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│  3. User navigue                                           │
│     → Extension bloque/nudge selon la config               │
│     → Historique envoyé à Desktop App en temps réel        │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│  4. User ouvre Desktop App                                 │
│     → Voit le dashboard avec insights                      │
│     → Heatmap, top distracteurs, temps économisé           │
└────────────────────────────────────────────────────────────┘
```

### Ce que l'utilisateur voit

**Dans l'Extension :**
- Indicateur "Connecté à Clarity" (vert)
- Stats temps réel
- Pas besoin de login séparé

**Dans la Desktop App :**
- Section "Browser Extension: Connected"
- Historique de navigation en live
- Dashboard avec insights

### Si Desktop App pas installée

```
Extension popup:
┌─────────────────────────────────────┐
│  ⚠️ Desktop App not detected       │
│                                      │
│  Install Clarity Desktop for:        │
│  • Detailed insights dashboard       │
│  • Cross-app sync                    │
│  • Advanced blocking rules           │
│                                      │
│  [Download Desktop App]              │
└─────────────────────────────────────┘
```

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         EXTENSION                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  service-worker.ts                                        │  │
│  │  • chrome.runtime.connectNative('com.clarity.app')        │  │
│  │  • Envoie: auth requests, navigation events               │  │
│  │  • Reçoit: auth status, config updates                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    stdin/stdout (JSON)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NATIVE HOST MANIFEST                         │
│  com.clarity.app.json                                            │
│  {                                                               │
│    "name": "com.clarity.app",                                    │
│    "path": "/Applications/Clarity.app/.../native-host",          │
│    "type": "stdio",                                              │
│    "allowed_origins": ["chrome-extension://..."]                 │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DESKTOP APP (Tauri)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  native-host binary (Rust)                                │  │
│  │  • Lit stdin, parse JSON                                  │  │
│  │  • Communique avec l'app Tauri via IPC                    │  │
│  │  • Répond via stdout                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React Frontend                                           │  │
│  │  • Affiche les données reçues                             │  │
│  │  • Envoie les config changes                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Files Structure

```
apps/
├── extension/
│   ├── manifest.json              # + nativeMessaging permission
│   └── src/
│       └── background/
│           └── native-messaging.ts  # NEW
│
└── desktop/
    ├── src-tauri/
    │   ├── src/
    │   │   ├── main.rs
    │   │   ├── lib.rs
    │   │   └── native_host.rs      # NEW - Native messaging handler
    │   └── native-host/
    │       └── com.clarity.app.json  # Host manifest
    └── src/
        └── features/
            └── extension/           # NEW - Extension status UI
```

---

## Implementation

### 1. Extension Side

**manifest.json**
```json
{
  "permissions": [
    "nativeMessaging"
  ]
}
```

**native-messaging.ts**
```typescript
const HOST_NAME = 'com.clarity.app'

let port: chrome.runtime.Port | null = null

// Connect to native app
export function connectToDesktopApp() {
  try {
    port = chrome.runtime.connectNative(HOST_NAME)
    
    port.onMessage.addListener((message) => {
      handleMessageFromDesktop(message)
    })
    
    port.onDisconnect.addListener(() => {
      console.log('Disconnected from desktop app')
      port = null
      // Retry connection after delay
      setTimeout(connectToDesktopApp, 5000)
    })
    
    // Request initial auth status
    sendToDesktop({ type: 'GET_AUTH_STATUS' })
    
  } catch (error) {
    console.log('Desktop app not available')
  }
}

// Send message to desktop
export function sendToDesktop(message: any) {
  if (port) {
    port.postMessage(message)
  }
}

// Handle messages from desktop
function handleMessageFromDesktop(message: any) {
  switch (message.type) {
    case 'AUTH_STATUS':
      // Update extension auth state
      chrome.storage.local.set({ 
        isAuthenticated: message.authenticated,
        user: message.user 
      })
      break
      
    case 'CONFIG_UPDATE':
      // Update blocking rules, modes, etc.
      chrome.storage.local.set({
        rules: message.rules,
        mode: message.mode,
        isActive: message.isActive
      })
      break
      
    case 'SYNC_REQUEST':
      // Desktop is requesting history data
      sendHistoryToDesktop()
      break
  }
}
```

### 2. Desktop Side (Tauri/Rust)

**native_host.rs**
```rust
use std::io::{self, Read, Write};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct IncomingMessage {
    #[serde(rename = "type")]
    msg_type: String,
    data: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct OutgoingMessage {
    #[serde(rename = "type")]
    msg_type: String,
    data: serde_json::Value,
}

pub fn run_native_host() {
    loop {
        // Read message length (4 bytes, little-endian)
        let mut len_bytes = [0u8; 4];
        if io::stdin().read_exact(&mut len_bytes).is_err() {
            break;
        }
        let len = u32::from_le_bytes(len_bytes) as usize;
        
        // Read message
        let mut buffer = vec![0u8; len];
        if io::stdin().read_exact(&mut buffer).is_err() {
            break;
        }
        
        // Parse and handle
        if let Ok(msg) = serde_json::from_slice::<IncomingMessage>(&buffer) {
            let response = handle_message(msg);
            send_message(&response);
        }
    }
}

fn handle_message(msg: IncomingMessage) -> OutgoingMessage {
    match msg.msg_type.as_str() {
        "GET_AUTH_STATUS" => {
            // Check Supabase session
            OutgoingMessage {
                msg_type: "AUTH_STATUS".to_string(),
                data: json!({
                    "authenticated": true,
                    "user": { "id": "...", "email": "..." }
                }),
            }
        }
        "NAVIGATION_EVENT" => {
            // Store in local DB, update UI
            OutgoingMessage {
                msg_type: "ACK".to_string(),
                data: json!({}),
            }
        }
        _ => OutgoingMessage {
            msg_type: "ERROR".to_string(),
            data: json!({ "message": "Unknown message type" }),
        }
    }
}

fn send_message(msg: &OutgoingMessage) {
    let json = serde_json::to_vec(msg).unwrap();
    let len = (json.len() as u32).to_le_bytes();
    
    io::stdout().write_all(&len).unwrap();
    io::stdout().write_all(&json).unwrap();
    io::stdout().flush().unwrap();
}
```

### 3. Host Manifest

**com.clarity.app.json** (macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`)
```json
{
  "name": "com.clarity.app",
  "description": "Clarity Desktop App Native Messaging Host",
  "path": "/Applications/Clarity.app/Contents/MacOS/native-host",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://EXTENSION_ID_HERE/"
  ]
}
```

---

## Message Protocol

### Extension → Desktop

| Type | Payload | Description |
|------|---------|-------------|
| `GET_AUTH_STATUS` | `{}` | Request current auth status |
| `NAVIGATION_EVENT` | `{ url, domain, category, timestamp }` | New page visit |
| `BLOCK_EVENT` | `{ url, reason, action }` | Site was blocked/bypassed |
| `GET_CONFIG` | `{}` | Request current config |

### Desktop → Extension

| Type | Payload | Description |
|------|---------|-------------|
| `AUTH_STATUS` | `{ authenticated, user }` | Auth state |
| `CONFIG_UPDATE` | `{ mode, rules, isActive }` | New config |
| `SYNC_REQUEST` | `{ since: timestamp }` | Request history since timestamp |
| `ACK` | `{}` | Acknowledgement |

---

## Security

### Protections

1. **allowed_origins** : Seule notre extension peut se connecter
2. **Path validation** : Le host doit être dans `/Applications/Clarity.app/`
3. **No network** : Communication 100% locale (stdin/stdout)
4. **Signed app** : Desktop app signée (pour macOS Gatekeeper)

### Host Manifest Location

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` |
| Windows | Registry key |
| Linux | `~/.config/google-chrome/NativeMessagingHosts/` |

### Installation

Le manifest doit être installé quand la Desktop App est installée :
- macOS : Via post-install script dans le .dmg
- Windows : Via installer (MSI/NSIS)

---

## Testing

### Manual Testing

1. **Vérifier que le manifest existe**
   ```bash
   cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.clarity.app.json
   ```

2. **Tester le host directement**
   ```bash
   echo '{"type":"GET_AUTH_STATUS"}' | /Applications/Clarity.app/.../native-host
   ```

3. **Dans l'extension**
   - Ouvrir DevTools du service worker
   - Vérifier les logs de connection

### Debug

```typescript
// Dans l'extension
port.onDisconnect.addListener(() => {
  console.log('Disconnect error:', chrome.runtime.lastError)
})
```

Erreurs communes :
- `Specified native messaging host not found` : Manifest pas installé
- `Access to the specified native messaging host is forbidden` : Extension ID pas dans allowed_origins
- `Native host has exited` : Crash du host, vérifier les logs

---

## Conclusion

Native Messaging permet une **intégration seamless** entre l'extension et la Desktop App :

✅ Auth partagée (login une fois)
✅ Sync temps réel (pas d'internet requis)
✅ Config centralisée
✅ Sécurisé (communication locale uniquement)

**Files à créer :**
- `apps/extension/src/background/native-messaging.ts`
- `apps/desktop/src-tauri/src/native_host.rs`
- `com.clarity.app.json` (manifest)

**Next** : Implémenter le code et tester la connexion.
