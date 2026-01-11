# Data Pipeline Architecture

> Documentation du flux de données entre l'extension Chrome et l'app Desktop Clarity.

---

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA PIPELINE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐     Native      ┌──────────────┐                     │
│   │   Chrome     │    Messaging    │    Rust      │                     │
│   │  Extension   │ ──────────────► │ Native Host  │                     │
│   │              │   (JSON/stdio)  │              │                     │
│   └──────────────┘                 └──────┬───────┘                     │
│          │                                │                              │
│          │ Collects:                      │ Stores:                      │
│          │ - Navigation events            │ - visits.jsonl               │
│          │ - Block events                 │ - blocks.jsonl               │
│          │ - History sync                 │                              │
│          │                                ▼                              │
│                                   ┌──────────────┐                       │
│                                   │  ~/.clarity  │                       │
│                                   │   /data/     │                       │
│                                   └──────┬───────┘                       │
│                                          │                               │
│                                          │ Reads via                     │
│                                          │ Tauri command                 │
│                                          ▼                               │
│   ┌──────────────┐      invoke     ┌──────────────┐                     │
│   │    React     │ ◄────────────── │  Tauri App   │                     │
│   │  Dashboard   │  get_browsing_  │   (Rust)     │                     │
│   │              │     stats       │              │                     │
│   └──────────────┘                 └──────────────┘                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Composants

### 1. Chrome Extension (Source)

**Fichier** : `apps/extension/src/background/native-messaging.ts`

**Responsabilités** :
- Collecter les événements de navigation (`webNavigation.onCompleted`)
- Détecter les blocages et bypasses
- Envoyer les données via Native Messaging

**Messages envoyés** :

```typescript
// Navigation event (chaque visite)
{
  type: 'NAVIGATION_EVENT',
  data: {
    url: string,
    domain: string,
    category: string,
    visitTime: number,      // timestamp ms
    title: string | null,
    isDistraction: boolean
  }
}

// Block event (chaque blocage/bypass)
{
  type: 'BLOCK_EVENT',
  data: {
    url: string,
    domain: string,
    reason: string,
    action: string,         // 'blocked' | 'bypassed'
    timestamp: number
  }
}

// History sync (import initial)
{
  type: 'HISTORY_SYNC',
  data: {
    visits: Array<NavigationEventData>
  }
}
```

---

### 2. Native Messaging Host (Transport)

**Fichier** : `apps/desktop/src-tauri/src/native_host.rs`

**Protocole** : Chrome Native Messaging
- 4 bytes (little-endian) = longueur du message
- JSON message

**Fonctionnement** :
1. Lancé par Chrome avec flag `--native-host`
2. Lit les messages de stdin
3. Parse JSON et dispatch vers handlers
4. Écrit les données dans le stockage local
5. Répond sur stdout

**Configuration** :
- Manifest : `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.clarity.app.json`
- Wrapper : `apps/desktop/src-tauri/target/debug/clarity-native-host`

---

### 3. Browsing Data Storage (Persistence)

**Fichier** : `apps/desktop/src-tauri/src/browsing_data.rs`

**Format** : JSON Lines (`.jsonl`)
- Une ligne = un JSON object
- Append-only pour les writes (rapide)
- Lecture séquentielle

**Emplacement** :
```
~/.clarity/clarity-data/
├── visits.jsonl      # Historique de navigation
└── blocks.jsonl      # Événements de blocage
```

**Structure des données** :

```rust
// StoredVisit
{
  "domain": "twitter.com",
  "category": "social_media",
  "visitTime": 1704931200000,
  "title": "Twitter / X",
  "isDistraction": true
}

// StoredBlockEvent
{
  "domain": "twitter.com",
  "reason": "Focus Mode active",
  "action": "blocked",
  "timestamp": 1704931200000
}
```

**Limites** :
- Max 10,000 visites (FIFO)
- Cleanup automatique à la lecture

---

### 4. Tauri Commands (API)

**Fichier** : `apps/desktop/src-tauri/src/lib.rs`

**Commande disponible** :

```rust
#[tauri::command]
fn get_browsing_stats() -> BrowsingStats
```

**Retourne** :

```typescript
interface BrowsingStats {
  focusScore: number       // 0-100
  focusTrend: string       // "up" | "down" | "stable"
  timeDistribution: {
    productive: number     // percentage
    neutral: number
    distraction: number
  }
  topSites: Array<{
    domain: string
    visits: number
    timeSpent: number      // minutes
    category: string
  }>
  dailyScores: Array<{
    date: string           // YYYY-MM-DD
    score: number
  }>
  totalVisits: number
  totalTimeTracked: number // minutes
}
```

---

### 5. React Hook (Consumer)

**Fichier** : `apps/desktop/src/features/stats/hooks/useBrowsingStats.ts`

**Usage** :

```typescript
import { useBrowsingStats } from '../hooks/useBrowsingStats'

function BrowsingView() {
  const { stats, loading, error } = useBrowsingStats()
  
  if (loading) return <Spinner />
  if (error) return <Error />
  if (!stats) return <EmptyState />
  
  return <Dashboard stats={stats} />
}
```

**Comportement** :
- Fetch initial au mount
- Refresh automatique toutes les 30 secondes
- Transformation des données Rust → format React

---

## Catégorisation

### Categories (définies dans l'extension)

| Category | Type | Examples |
|----------|------|----------|
| `social_media` | Distraction | twitter.com, facebook.com, instagram.com |
| `video` | Distraction | youtube.com, netflix.com, twitch.tv |
| `news` | Distraction | nytimes.com, lemonde.fr, cnn.com |
| `entertainment` | Distraction | reddit.com, 9gag.com |
| `shopping` | Distraction | amazon.com, ebay.com |
| `work` | Productive | github.com, notion.so, figma.com |
| `dev` | Productive | stackoverflow.com, docs.* |
| `other` | Neutral | Everything else |

### Focus Score Calculation

```
Focus Score = (Productive Visits / Total Visits) × 100
```

Avec pondération par catégorie :
- Productive : +1 point
- Neutral : 0 points
- Distraction : -1 point (compte comme non-focus)

### Trend Calculation

Compare les 7 derniers jours vs les 7 jours précédents :
- `up` : Amélioration > 5%
- `down` : Dégradation > 5%
- `stable` : Variation < 5%

---

## Sécurité & Privacy

### Données stockées

✅ **Ce qu'on stocke** :
- Domaines (pas les URLs complètes)
- Catégories
- Timestamps
- Titres de pages (optionnel)

❌ **Ce qu'on ne stocke PAS** :
- Query parameters
- Cookies
- Contenu des pages
- Données personnelles

### Accès aux données

- Stockage local uniquement (`~/.clarity/`)
- Pas de sync cloud automatique
- L'utilisateur contrôle ses données

### Permissions Chrome

```json
{
  "permissions": ["webNavigation", "storage"],
  "optional_permissions": ["history"],
  "host_permissions": ["<all_urls>"]
}
```

---

## Troubleshooting

### L'extension ne se connecte pas au native host

1. **Vérifier le manifest** :
   ```bash
   cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.clarity.app.json
   ```

2. **Vérifier que l'extension ID est correct** :
   - Aller sur `chrome://extensions`
   - Copier l'ID de l'extension
   - Vérifier qu'il est dans `allowed_origins`

3. **Redémarrer Chrome complètement** (Cmd+Q)

### Pas de données dans le dashboard

1. **Vérifier que des données existent** :
   ```bash
   cat ~/.clarity/clarity-data/visits.jsonl | wc -l
   ```

2. **Vérifier les logs du native host** :
   - Ouvrir le Service Worker de l'extension
   - Chercher `[NativeHost]` dans les logs

3. **Vérifier la console Tauri** :
   - `npm run tauri dev` dans le terminal
   - Chercher `[BrowsingData]` dans les logs

### Focus Score toujours à 50

- Pas assez de données collectées
- Les catégories ne sont pas reconnues
- Vérifier la catégorisation dans `history-collector.ts`

---

## Évolutions futures

1. **SQLite** au lieu de JSON Lines
   - Meilleure performance pour les requêtes complexes
   - Support des index

2. **Sync Supabase** (opt-in)
   - Backup cloud des données
   - Cross-device analytics

3. **Real-time updates**
   - WebSocket ou Tauri events
   - Dashboard qui se met à jour en temps réel

4. **LLM categorization**
   - Classification intelligente des sites inconnus
   - Apprentissage des préférences utilisateur
