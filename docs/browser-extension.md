# Browser Extension — Oneway

Documentation du développement de l'extension browser pour le système de blocage intelligent.

---

## 🎯 Objectif

Créer une extension browser (Chrome/Edge/Brave) qui:
1. Monitore la navigation de l'utilisateur
2. Bloque les sites distractifs selon des règles et modes
3. Collecte l'historique pour analyse
4. Communique avec l'app Electron via Native Messaging
5. Utilise le LLM pour classification intelligente (Phase 2)

---

## 🏗️ Architecture

```
┌────────────────────────────────────┐
│  Browser Extension                 │
│                                    │
│  ├─ Background Service Worker     │
│  │   - Intercept requests         │
│  │   - Rules engine               │
│  │   - Native Messaging           │
│  │                                │
│  ├─ Content Scripts                │
│  │   - Inject block UI            │
│  │   - Monitor page interactions  │
│  │                                │
│  └─ UI Components                  │
│      - Block screen                │
│      - Popup settings              │
└────────────┬───────────────────────┘
             │ Native Messaging
             │
┌────────────▼───────────────────────┐
│  Electron App                      │
│  - Rules management                │
│  - LLM integration                 │
│  - Analytics                       │
└────────────────────────────────────┘
```

---

## 📦 Tech Stack

- **Manifest**: V3 (moderne, requis par Chrome)
- **Language**: TypeScript
- **Build**: Vite
- **APIs**: 
  - `declarativeNetRequest` (blocking)
  - `webNavigation` (monitoring)
  - `history` (historique)
  - `storage` (cache local)
  - `runtime` (native messaging)

---

## 🗂️ Structure du projet

```
apps/extension/
├── manifest.json                  # Extension config
├── package.json
├── vite.config.ts                 # Build config
├── src/
│   ├── background/
│   │   ├── service-worker.ts      # Main background logic
│   │   ├── rules-engine.ts        # Decision logic
│   │   ├── history-collector.ts   # History import/monitoring
│   │   └── native-messaging.ts    # Communication with Electron
│   ├── content/
│   │   ├── content-script.ts      # Injected in pages
│   │   └── block-injector.ts      # Inject block screen
│   ├── ui/
│   │   ├── block-screen/
│   │   │   ├── index.html
│   │   │   ├── block-screen.ts
│   │   │   └── block-screen.css
│   │   └── popup/
│   │       ├── index.html
│   │       └── popup.ts
│   ├── shared/
│   │   ├── types.ts               # Shared types
│   │   ├── constants.ts           # Blocklists, categories
│   │   └── utils.ts
│   └── assets/
│       └── icons/
└── public/
```

---

## 🚀 Phases de développement

### ✅ Phase 0: Setup (Completed 2026-01-11)
- [x] Créer structure du projet
- [x] Manifest V3 basique
- [x] Service worker minimal
- [x] Content script minimal
- [x] Build setup avec Vite
- [x] Block screen UI
- [x] Extension popup UI
- [ ] Test chargement dans Chrome (next step)

### Phase 1: Blocking basique (Week 1-2)
- [ ] Hardcoded blocklist (twitter, reddit, etc.)
- [ ] Intercept navigation avec declarativeNetRequest
- [ ] Block screen UI
- [ ] Bypass simple (bouton "Continue anyway")
- [ ] Test avec vraies pages

### Phase 2: History Collection (Week 2-3)
- [ ] Permission `history`
- [ ] Import historique passé (30 jours)
- [ ] Real-time monitoring avec webNavigation
- [ ] Categorization basique (rules-based)
- [ ] Storage local dans extension

### Phase 3: Native Messaging (Week 3-4)
- [ ] Setup Native Messaging host dans Electron
- [ ] Communication bidirectionnelle
- [ ] Send history data to Electron
- [ ] Receive rules updates from Electron
- [ ] Sync modes (Focus/Wind Down)

### Phase 4: Modes & Intelligence (Week 4-5)
- [ ] Focus Mode
- [ ] Wind Down Mode
- [ ] Schedule-based activation
- [ ] Strictness levels (gentle/guided/strict)
- [ ] Bypass challenges

### Phase 5: LLM Integration (Week 6+)
- [ ] Send uncertain URLs to Electron
- [ ] Electron calls LLM for classification
- [ ] Cache decisions locally
- [ ] Batch analysis of history
- [ ] Pattern detection

### Phase 6: Analytics & Insights (Week 7+)
- [ ] Log all block/allow events
- [ ] Time tracking per site
- [ ] Category analysis
- [ ] Pattern insights
- [ ] UI dashboard in main app

---

## 🔧 APIs & Permissions

### Manifest V3 Permissions

```json
{
  "permissions": [
    "storage",           // Local cache
    "declarativeNetRequest",  // Blocking
    "webNavigation",     // Monitor navigation
    "history",           // Access browsing history
    "tabs",              // Tab info
    "scripting"          // Inject content scripts
  ],
  "host_permissions": [
    "<all_urls>"         // Access all sites for blocking
  ]
}
```

### Key APIs

**declarativeNetRequest**: Block requests before they happen
- Fast, efficient
- Cannot see content (just URL)
- Good for hardcoded rules

**webNavigation**: Monitor page visits
- onBeforeNavigate, onCompleted, onCommitted
- Track full navigation lifecycle
- Good for analytics

**history**: Access past browsing
- search() for importing old history
- Real-time via webNavigation
- Privacy-sensitive

**runtime**: Native Messaging
- connectNative() to talk to Electron
- Bidirectional communication
- JSON messages

---

## 📊 Data Flow

### Blocking Flow
```
1. User navigates to URL
   ↓
2. declarativeNetRequest intercepts
   ↓
3. Check local rules cache
   ↓
4. If blocked → redirect to block screen
   ↓
5. Block screen shows reason + bypass options
   ↓
6. Log event to analytics
```

### History Collection Flow
```
1. Extension installed
   ↓
2. Request permission for history
   ↓
3. Import last 30 days via history.search()
   ↓
4. Batch send to Electron via Native Messaging
   ↓
5. Electron stores in SQLite
   ↓
6. (Phase 2) Electron sends to LLM for classification
```

### Native Messaging Flow
```
Extension → Electron:
{
  type: "HISTORY_BATCH",
  data: [{url, title, visitTime}, ...]
}

Electron → Extension:
{
  type: "RULES_UPDATE",
  rules: [{pattern, action, reason}, ...]
}
```

---

## 🎨 UI Components

### Block Screen
Full-page overlay when site is blocked:
```
┌─────────────────────────────────┐
│          🧘 Pause               │
│                                 │
│  You're in Focus Mode           │
│                                 │
│  twitter.com is blocked         │
│                                 │
│  Why do you want to visit?      │
│  ○ Work-related                 │
│  ○ Quick check (5min)           │
│  ○ End Focus Mode               │
│                                 │
│  [Cancel]         [Continue]    │
└─────────────────────────────────┘
```

### Popup (extension icon)
Quick status and controls:
```
┌─────────────────────────────────┐
│  🟢 Focus Mode                  │
│  Active until 12:00 PM          │
│                                 │
│  Sites blocked today: 12        │
│  Time saved: 45 min             │
│                                 │
│  [End Mode]  [Settings]         │
└─────────────────────────────────┘
```

---

## 🔐 Privacy & Security

- **Local-first**: All data stored locally by default
- **Encrypted**: History data encrypted in storage
- **Opt-in**: User must approve history access
- **Transparent**: Clear what data is collected
- **Control**: User can export/delete anytime
- **No tracking**: No telemetry to external servers

---

## 🧪 Testing Strategy

### Manual Testing
1. Load unpacked extension in Chrome
2. Navigate to blocked sites
3. Verify block screen appears
4. Test bypass mechanisms
5. Check history collection

### Automated Testing (later)
- Playwright for E2E tests
- Jest for unit tests
- Mock Chrome APIs

---

## 📝 Notes & Decisions

### Manifest V2 vs V3
✅ **Chose V3** because:
- Required by Chrome (V2 deprecated 2024)
- Better performance (service workers)
- More secure
- Future-proof

❌ **Challenges**:
- declarativeNetRequest more limited than webRequest
- Service workers are ephemeral (not persistent)
- Need careful state management

### Blocking Strategy
✅ **declarativeNetRequest** for hardcoded rules (fast)
✅ **Content script injection** for intelligent blocking (flexible)

### Communication
✅ **Native Messaging** for Extension ↔ Electron
- More secure than localhost HTTP server
- Built-in Chrome API
- JSON-based

---

## 🐛 Known Issues & TODOs

- [ ] Service worker can be killed by browser (need persistence strategy)
- [ ] declarativeNetRequest has limits (max 5000 rules)
- [ ] Native Messaging requires manifest in specific OS location
- [ ] Safari support needs separate build

---

## 📚 Resources

- [Chrome Extensions Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/)
- [Native Messaging](https://developer.chrome.com/docs/extensions/mv3/nativeMessaging/)

---

## 🎯 Current Status

**Phase**: 0 - Setup ✅ Complete
**Last Updated**: 2026-01-11

**What's Working**:
- ✅ Extension builds successfully
- ✅ Service worker monitors navigation
- ✅ Hardcoded blocklist (Twitter, Reddit, etc.)
- ✅ Block screen UI with bypass options
- ✅ Extension popup with status
- ✅ Block event logging

**Next Steps**: 
1. Test loading extension in Chrome
2. Test blocking on real sites
3. Verify block screen appears correctly
4. Test bypass flow
5. Check popup displays correctly

**Then**: 
- History collection
- Native Messaging to Electron
- Modes implementation
