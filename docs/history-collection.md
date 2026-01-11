# History Collection

> Privacy-first browsing history analysis for personalized blocking insights

---

## Table des matières

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [UX Flow](#ux-flow)
4. [Implementation Details](#implementation-details)
5. [Privacy & Security](#privacy--security)
6. [Data Structure](#data-structure)
7. [Future Enhancements](#future-enhancements)

---

## Overview

Le système de **history collection** permet à Clarity d'analyser les habitudes de navigation de l'utilisateur pour :

- **Identifier les patterns de distraction** (sites visités fréquemment pendant les heures de focus)
- **Recommander des blocages intelligents** (bloquer automatiquement les plus gros distracteurs)
- **Mesurer l'efficacité** (temps économisé, réduction des visites sur sites bloqués)
- **Personnaliser les nudges** (suggestions basées sur le comportement réel)

### Principes

1. **Privacy-first** : On ne stocke que les domaines, jamais les URLs complètes avec query params
2. **User-controlled** : L'utilisateur choisit la période (7/30/90 jours)
3. **Opt-in** : Nécessite une permission explicite
4. **Anonymous** : Pas de tracking externe, tout en local
5. **Transparent** : L'utilisateur voit exactement ce qui est collecté

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Extension Popup                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  "Enable Insights" Button                    │  │
│  │  (Visible si permission pas accordée)        │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              Service Worker                          │
│  ┌──────────────────────────────────────────────┐  │
│  │  history-collector.ts                        │  │
│  │  • requestHistoryPermission()                │  │
│  │  • importHistory(days)                       │  │
│  │  • recordVisit(url, title)                   │  │
│  │  • calculateHistoryStats()                   │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│          Chrome History API                          │
│  chrome.history.search()                             │
│  chrome.permissions.request(['history'])             │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│         chrome.storage.local                         │
│  {                                                    │
│    navigationHistory: CategorizedVisit[]             │
│    historyLastImport: timestamp                      │
│    historyPeriodDays: number                         │
│  }                                                    │
└─────────────────────────────────────────────────────┘
```

---

## UX Flow

### Scenario A: Extension installée en premier

1. **Installation**
   - Extension installée depuis Chrome Web Store
   - Popup s'ouvre automatiquement

2. **Première ouverture**
   - UI montre le mode actuel (free par défaut)
   - **Card "Enable Insights"** visible avec :
     - Icône 📊
     - Titre : "Enable Insights"
     - Description : "Get personalized recommendations based on your browsing patterns"
     - Note privacy : "Privacy-first: We only analyze domain patterns, never URLs or personal data."
     - Bouton "Enable Insights"

3. **Clic sur "Enable Insights"**
   - Chrome affiche la permission dialog native
   - Options : "Allow" / "Deny"

4. **Si Allow**
   - Bouton change : "Importing history..."
   - Import en background des 30 derniers jours
   - Catégorisation automatique
   - UI reload → affiche les stats

5. **Si Deny**
   - Bouton change : "Permission denied"
   - Après 2s, revient à "Enable Insights"
   - L'utilisateur peut ré-essayer plus tard

6. **Après activation**
   - Card "Enable Insights" disparaît
   - Nouvelle section "Stats" apparaît :
     - Visits tracked: X
     - Top distraction: twitter.com
   - Monitoring en temps réel activé

### Scenario B: Desktop App installée en premier

1. **Installation Desktop App**
   - Onboarding standard
   - À la fin, prompt : "Install browser extension for automatic blocking"
   - Lien vers Chrome Web Store

2. **Installation Extension**
   - Flow identique à Scenario A
   - Une fois la permission accordée, l'extension sync avec Supabase
   - Les habits/modes configurés dans l'app sont appliqués

### Scenario C: Permission demandée depuis Settings

Si l'utilisateur a refusé initialement :

1. **Dans Extension Popup**
   - Bouton "Settings" → Ouvre la Desktop App (via Native Messaging)

2. **Dans Desktop App > Settings**
   - Section "Browser Integration"
   - Toggle "Enable History Insights" (OFF)
   - Au clic :
     - Si extension pas installée : Lien vers Chrome Store
     - Si extension installée : Envoie message à l'extension pour request permission
     - Après grant : Toggle passe à ON

---

## Implementation Details

### Files Structure

```
apps/extension/src/
├── background/
│   ├── service-worker.ts        # Message handlers
│   └── history-collector.ts     # NEW - Collection logic
├── shared/
│   ├── types.ts                 # NEW - History types
│   ├── constants.ts
│   └── utils.ts
└── ui/
    └── popup/
        ├── index.html           # NEW - History UI
        └── popup.ts             # NEW - Permission flow
```

### Key Functions

#### `requestHistoryPermission()`

```typescript
export async function requestHistoryPermission(): Promise<boolean> {
  try {
    const granted = await chrome.permissions.request({
      permissions: ['history']
    })
    
    log('History permission:', granted ? 'granted' : 'denied')
    return granted
  } catch (error) {
    log('Error requesting history permission:', error)
    return false
  }
}
```

**Important**: Doit être appelé depuis un **user gesture** (click handler), sinon Chrome refuse.

#### `importHistory(days)`

```typescript
export async function importHistory(days: number = 30): Promise<CategorizedVisit[]> {
  const hasPermission = await hasHistoryPermission()
  
  if (!hasPermission) {
    throw new Error('History permission not granted')
  }
  
  const startTime = Date.now() - (days * 24 * 60 * 60 * 1000)
  const endTime = Date.now()
  
  const historyItems = await chrome.history.search({
    text: '',
    startTime,
    endTime,
    maxResults: 10000
  })
  
  // Categorize and sanitize
  const categorized = historyItems
    .filter(item => item.url && isValidUrl(item.url))
    .map(item => ({
      url: sanitizeUrl(item.url!),
      domain: extractDomain(item.url!),
      title: sanitizeTitle(item.title),
      visitTime: item.lastVisitTime || Date.now(),
      category: categorizeDomain(extractDomain(item.url!)),
      isDistraction: isDistraction(category)
    }))
  
  // Store in chrome.storage.local
  await chrome.storage.local.set({
    navigationHistory: categorized,
    historyLastImport: Date.now(),
    historyPeriodDays: days
  })
  
  return categorized
}
```

#### `recordVisit(url, title)`

Appelé depuis `webNavigation.onCompleted` pour monitorer en temps réel :

```typescript
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return
  if (details.url.startsWith('chrome://')) return
  
  try {
    const tab = await chrome.tabs.get(details.tabId)
    await recordVisit(details.url, tab.title)
  } catch (error) {
    // Permission not granted - fail silently
  }
})
```

#### `categorizeDomain(domain)`

```typescript
const DOMAIN_CATEGORIES: Record<string, Category> = {
  'twitter.com': 'social_media',
  'x.com': 'social_media',
  'youtube.com': 'video',
  'lemonde.fr': 'news',
  'github.com': 'work',
  // ...
}

export function categorizeDomain(domain: string): Category {
  const cleanDomain = domain.replace(/^www\./, '')
  
  // Exact match
  if (DOMAIN_CATEGORIES[cleanDomain]) {
    return DOMAIN_CATEGORIES[cleanDomain]
  }
  
  // Check subdomains
  for (const [knownDomain, category] of Object.entries(DOMAIN_CATEGORIES)) {
    if (cleanDomain.endsWith(knownDomain)) {
      return category
    }
  }
  
  return 'other'
}
```

---

## Privacy & Security

### Privacy-First Principles

1. **No Full URLs**
   - ❌ `https://twitter.com/user/status/123?utm_source=email`
   - ✅ `https://twitter.com/user/status/123`
   - On supprime tous les query params avec `sanitizeUrl()`

2. **Domain-Level Only**
   - On stocke le domaine (`twitter.com`) et la catégorie
   - Pas d'inspection du contenu ou des chemins

3. **Title Sanitization**
   - Tronqué à 200 caractères
   - HTML escaped pour éviter XSS

4. **No External Tracking**
   - Tout est stocké en **local** (`chrome.storage.local`)
   - Pas d'envoi automatique vers Supabase
   - Sync manuel si l'utilisateur connecte la Desktop App

5. **User Control**
   - L'utilisateur peut révoquer la permission depuis `chrome://extensions`
   - Peut supprimer l'historique stocké depuis Settings

### Security Practices

#### URL Validation

```typescript
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    
    // Only http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }
    
    // Exclude chrome:// and extensions
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      return false
    }
    
    return true
  } catch {
    return false
  }
}
```

#### Sanitization

```typescript
function sanitizeTitle(title?: string): string | undefined {
  if (!title) return undefined
  
  return title
    .slice(0, 200)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
```

#### Storage Limits

- Max 10,000 visits stockés
- Cleanup automatique (FIFO)
- Pas de croissance infinie du storage

---

## Data Structure

### Types

```typescript
interface CategorizedVisit {
  url: string              // Sanitized (no query params)
  domain: string           // e.g., "twitter.com"
  title?: string           // Sanitized, max 200 chars
  visitTime: number        // Unix timestamp
  duration?: number        // Optional, for future
  category: Category       // Categorized
  isDistraction: boolean   // Quick flag
}

type Category = 
  | 'social_media'
  | 'news'
  | 'video'
  | 'entertainment'
  | 'shopping'
  | 'adult'
  | 'work'
  | 'other'

interface HistoryStats {
  totalVisits: number
  byCategory: Record<Category, number>
  topDomains: Array<{
    domain: string
    count: number
    category: Category
  }>
  periodStart: number
  periodEnd: number
}
```

### Storage Schema

```typescript
// chrome.storage.local
{
  // Core blocking
  mode: 'focus' | 'wind_down' | 'free',
  isActive: boolean,
  rules: BlockRule[],
  
  // History collection (NEW)
  navigationHistory: CategorizedVisit[],
  historyLastImport: number,
  historyPeriodDays: number,
  
  // Events
  blockHistory: BlockEvent[]
}
```

---

## Future Enhancements

### Phase 1 (Current)
- ✅ Permission request flow
- ✅ Import history (1-time)
- ✅ Real-time monitoring
- ✅ Basic categorization (domain-based)
- ✅ Stats display in popup

### Phase 2 (Next)
- [ ] **Sync avec Desktop App** via Native Messaging
- [ ] **Dashboard dans Desktop App** :
  - Heatmap des visites par heure/jour
  - Top distracteurs du mois
  - Correlation habits ↔ navigation
- [ ] **Smart recommendations** :
  - "You visit twitter.com 50 times/day, block it during Focus Mode?"
  - "Most distractions happen 14h-16h, extend your Focus session?"

### Phase 3 (Future)
- [ ] **LLM-based categorization** :
  - Envoyer les top domains à l'API
  - Classifier plus finement (work vs procrastination youtube, etc.)
- [ ] **Duration tracking** :
  - Time spent per domain
  - Detect "rabbit holes" (quick succession of visits)
- [ ] **Smart blocking** :
  - Auto-block si trop de visites sur un domaine pendant Focus
  - Nudge : "You've visited X 10 times today, take a break?"

### Phase 4 (Advanced)
- [ ] **Content-based blocking** :
  - LLM analyse le title/URL path
  - Bloquer seulement certaines sections (e.g., YouTube Shorts mais pas tutorials)
- [ ] **Cross-device sync** :
  - Si plusieurs browsers/devices avec même compte Supabase
  - Agrégation des stats

---

## Messages API

### Extension → Service Worker

```typescript
// Request permission
chrome.runtime.sendMessage(
  { type: 'REQUEST_HISTORY_PERMISSION' },
  (granted: boolean) => { /* ... */ }
)

// Import history
chrome.runtime.sendMessage(
  { type: 'IMPORT_HISTORY', data: { days: 30 } },
  (result: { success: boolean; visits: number }) => { /* ... */ }
)

// Get stats
chrome.runtime.sendMessage(
  { type: 'GET_HISTORY_STATS' },
  (stats: HistoryStats) => { /* ... */ }
)

// Get status
chrome.runtime.sendMessage(
  { type: 'GET_COLLECTION_STATUS' },
  (status: {
    hasPermission: boolean
    totalVisits: number
    lastImport?: number
    periodDays?: number
  }) => { /* ... */ }
)
```

### Service Worker Handlers

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'REQUEST_HISTORY_PERMISSION':
      requestHistoryPermission().then(sendResponse)
      return true
    
    case 'IMPORT_HISTORY':
      importHistory(message.data?.days || 30)
        .then(visits => sendResponse({ success: true, visits: visits.length }))
        .catch(error => sendResponse({ success: false, error: error.message }))
      return true
    
    case 'GET_HISTORY_STATS':
      getHistoryStats().then(sendResponse)
      return true
    
    case 'GET_COLLECTION_STATUS':
      getCollectionStatus().then(sendResponse)
      return true
  }
})
```

---

## Testing

### Manual Testing

1. **Test Permission Flow**
   ```
   1. Install extension (fresh)
   2. Open popup
   3. Verify "Enable Insights" card visible
   4. Click button
   5. Verify Chrome permission dialog appears
   6. Grant permission
   7. Verify import starts
   8. Verify UI updates with stats
   ```

2. **Test Permission Denial**
   ```
   1. Click "Enable Insights"
   2. Deny permission
   3. Verify button shows "Permission denied"
   4. Verify card stays visible (can retry)
   ```

3. **Test Real-time Monitoring**
   ```
   1. Grant permission
   2. Navigate to twitter.com
   3. Check storage: chrome.storage.local.get('navigationHistory')
   4. Verify new visit recorded
   5. Verify category = 'social_media'
   ```

4. **Test Stats Calculation**
   ```
   1. Import history (30 days)
   2. Open popup
   3. Verify "Visits tracked" count
   4. Verify "Top distraction" shows a domain
   ```

### Privacy Testing

1. **Verify No Query Params**
   ```javascript
   // Visit: https://twitter.com/user?utm_source=email
   // Stored: https://twitter.com/user
   chrome.storage.local.get('navigationHistory')
   // Check all URLs have no query params
   ```

2. **Verify Title Sanitization**
   ```javascript
   // Title with HTML: "<script>alert('xss')</script>"
   // Should be escaped: "&lt;script&gt;alert('xss')&lt;/script&gt;"
   ```

3. **Verify Max Storage**
   ```javascript
   // After 10,001 visits, oldest should be removed
   ```

---

## Troubleshooting

### Permission not working

**Symptom**: Clic sur "Enable Insights", rien ne se passe

**Cause**: Chrome requiert un **user gesture**. Si la fonction est appelée depuis un timer ou callback indirect, ça ne marche pas.

**Fix**: S'assurer que `chrome.permissions.request()` est appelé directement depuis un click handler.

### Import fails silently

**Symptom**: Bouton reste "Importing...", rien ne se passe

**Cause**: `chrome.history.search()` peut fail si trop de résultats.

**Fix**: Limiter avec `maxResults: 10000`

### Stats not updating

**Symptom**: Les stats dans le popup ne changent pas

**Cause**: Les visites sont enregistrées mais le popup ne reload pas.

**Fix**: Forcer un `window.location.reload()` après import

---

## Conclusion

Le système de **history collection** est maintenant **opérationnel** avec :

✅ Flow UX clair (permission → import → monitoring)  
✅ Privacy-first (domain-only, no query params)  
✅ Secure (URL validation, sanitization)  
✅ Extensible (prêt pour LLM integration)  

**Next step** : Implémenter Native Messaging pour sync avec Desktop App.
