# Extension Architecture

> Architecture de l'extension Chrome/Firefox pour le blocking web et la collecte d'historique.

---

## Documents

| Document | Description |
|----------|-------------|
| [browser-extension.md](./browser-extension.md) | Architecture générale de l'extension |
| [native-messaging.md](./native-messaging.md) | Communication Extension ↔ Desktop |
| [history-collection.md](./history-collection.md) | Collecte d'historique de navigation |

---

## Stack

| Layer | Technology |
|-------|------------|
| **Manifest** | V3 (Chrome/Edge), V2 (Firefox) |
| **Background** | Service Worker |
| **Content Scripts** | Aoi widget, page analysis |
| **Build** | Vite + TypeScript |
| **Communication** | Native Messaging (Chrome) |

---

## Structure des fichiers

```
apps/extension/
├── src/
│   ├── background/
│   │   ├── service-worker.ts     # Main orchestrator
│   │   ├── search-filter.ts      # Search query blocking
│   │   ├── search-intelligence.ts # Intelligent scoring
│   │   ├── history-collector.ts  # History collection
│   │   └── native-messaging.ts   # Desktop communication
│   │
│   ├── content/
│   │   ├── content-script.ts     # Aoi widget
│   │   └── page-analyzer.ts      # Page content analysis
│   │
│   ├── ui/
│   │   ├── popup/                # Extension popup
│   │   └── block-screen/         # Blocking page
│   │
│   └── shared/
│       ├── types.ts
│       ├── constants.ts
│       └── keywords/             # Blocking keywords
│
├── public/
│   ├── manifest.json
│   └── rules.json                # declarativeNetRequest rules
│
└── package.json
```

---

## Blocking Layers

```
Layer 1: declarativeNetRequest (rules.json)
         └─ SafeSearch enforcement (Google, Bing, etc.)
         └─ Site blocking (Twitter, Reddit, etc.)

Layer 2: webNavigation.onBeforeNavigate
         └─ Search query detection
         └─ Intelligent scoring (keywords, patterns)

Layer 3: Content Script (page-analyzer.ts)
         └─ Page content analysis
         └─ Meta tags, image ratio, etc.
```

---

## Communication avec Desktop

```
Extension                              Desktop
    │                                     │
    ├── NAVIGATION_EVENT ────────────────▶│ Store visit
    ├── BLOCK_EVENT ─────────────────────▶│ Store block
    ├── HEARTBEAT (60s) ─────────────────▶│ Update status
    │                                     │
    │◀─── CONFIG_UPDATE ──────────────────┤ Sync config
    │◀─── AUTH_STATUS ────────────────────┤ Sync auth
```

---

## Voir aussi

- [Desktop Architecture](../desktop/) — Application desktop Tauri
- [Blocking Features](../../02-features/blocking/) — Documentation fonctionnelle du blocking
