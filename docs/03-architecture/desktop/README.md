# Desktop Architecture

> Architecture de l'application desktop Tauri (macOS, Windows, Linux).

---

## Documents

| Document | Description |
|----------|-------------|
| [app-blocking.md](./app-blocking.md) | Système de monitoring et blocage d'apps natives |

---

## Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Tauri 2.0 |
| **Backend** | Rust |
| **Frontend** | React + TypeScript |
| **Styling** | CSS Modules |
| **State** | React hooks (local) |
| **Storage** | Local files + Supabase |

---

## Structure des fichiers

```
apps/desktop/
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs              # Tauri commands entry
│   │   ├── app_monitor.rs      # App monitoring (macOS/Win)
│   │   ├── app_data.rs         # App usage storage
│   │   ├── browsing_data.rs    # Browsing stats storage
│   │   └── native_host.rs      # Extension communication
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/
│   ├── app/
│   │   ├── App.tsx             # Main app component
│   │   └── App.css
│   ├── features/
│   │   ├── app-blocking/       # App blocking feature
│   │   ├── boundaries/         # Boundaries/habits
│   │   ├── habits/             # Habits tracking
│   │   ├── stats/              # Statistics views
│   │   ├── settings/           # User settings
│   │   └── ...
│   └── styles/
│       ├── global.css
│       └── variables.css
│
└── package.json
```

---

## Communication Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Frontend │◄───▶│  Tauri Commands │◄───▶│   Rust Backend  │
│  (TypeScript)   │     │  (IPC Bridge)   │     │   (Business)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                                              │
         │                                              ▼
         │                                      ┌───────────────┐
         │                                      │ Local Storage │
         │                                      │ ~/.clarity/   │
         │                                      └───────────────┘
         │                                              │
         ▼                                              ▼
┌─────────────────┐                            ┌───────────────┐
│    Supabase     │◄───────────────────────────│   Sync Job    │
│   (Cloud DB)    │                            │  (10 min)     │
└─────────────────┘                            └───────────────┘
```

---

## Voir aussi

- [Extension Architecture](../extension/) — Communication avec l'extension browser
- [Data Architecture](../data/) — Base de données et pipelines
