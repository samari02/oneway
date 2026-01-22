# Content Analysis — Layer 3

> Algorithme d'analyse du contenu HTML des pages pour détecter le contenu explicite.
> Phase 4 du système de blocage intelligent.

---

## Vue d'ensemble

```
Page HTML chargée
        │
        ▼
┌─────────────────────────────────────────────────────┐
│                    EXTRACTORS                        │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │   Meta   │  │   Text   │  │  Images  │          │
│  │   Tags   │  │   Body   │  │  Ratio   │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │             │             │                 │
└───────┼─────────────┼─────────────┼─────────────────┘
        │             │             │
        ▼             ▼             ▼
┌─────────────────────────────────────────────────────┐
│                  SCORING ENGINE                      │
│                                                      │
│    Meta adult?      → +100 (instant block)          │
│    Title keywords   → +60                           │
│    Body keywords    → +10 par match (cap 50)        │
│    Image ratio      → +20-40                        │
│    URL path         → +30                           │
│    Link analysis    → +5 par lien (cap 30)          │
│                                                      │
│    TOTAL SCORE: 0-200+                              │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│                    DECISION                          │
│                                                      │
│    score >= 70   → BLOCK                            │
│    score 30-69   → WARN (log + heightened watch)    │
│    score < 30    → ALLOW                            │
│                                                      │
│    + heightened mode actif? → seuils divisés par 2  │
└─────────────────────────────────────────────────────┘
```

---

## Algorithme de scoring

### 1. Meta Tags (poids fort)

Les sites légitimes se déclarent souvent avec des meta tags.

```html
<!-- Détection instantanée → BLOCK -->
<meta name="rating" content="adult">
<meta name="rating" content="RTA-5042-1996-1400-1577-RTA">
<meta property="og:restrictions:age" content="18+">
<meta name="rating" content="mature">
```

| Meta Tag | Score |
|----------|-------|
| `rating=adult` | +100 |
| `rating=RTA-5042-*` | +100 |
| `og:restrictions:age=18+` | +80 |
| `rating=mature` | +50 |

### 2. Title Analysis

```html
<title>Hot Girls XXX - Free Porn Videos</title>
```

- Utilise les keyword lists existantes (`shared/keywords/`)
- Score: **+60** si keyword explicite trouvé
- Score: **+30** si combinaison suspecte

### 3. Body Text Analysis

```javascript
const bodyText = document.body.innerText.slice(0, 10000).toLowerCase()

// Compter les keywords explicites
const matches = EXPLICIT_KEYWORDS.filter(k => bodyText.includes(k))
```

| Matches | Score |
|---------|-------|
| 1-2 keywords | +10 |
| 3-5 keywords | +25 |
| 6-10 keywords | +40 |
| 10+ keywords | +50 (cap) |

### 4. Image/Text Ratio

Sites adultes = beaucoup d'images, peu de texte.

```javascript
const images = document.querySelectorAll('img').length
const videos = document.querySelectorAll('video').length
const textLength = document.body.innerText.length

const mediaCount = images + (videos * 3) // Videos comptent plus
const ratio = mediaCount / (textLength / 1000)
```

| Ratio | Interprétation | Score |
|-------|----------------|-------|
| < 5 | Normal (article, blog) | +0 |
| 5-15 | Beaucoup de médias | +10 |
| 15-30 | Site galerie | +20 |
| 30+ | Site principalement médias | +40 |

### 5. URL Path Analysis

```javascript
const urlPath = new URL(location.href).pathname.toLowerCase()

// Patterns suspects dans le path
'/video/xxx-category/'  → +30
'/gallery/nude/'        → +30
'/porn/amateur/'        → +30
'/adult/content/'       → +20
```

### 6. Link Analysis

Analyse des liens sortants/internes.

```javascript
const links = document.querySelectorAll('a[href]')
const suspiciousLinks = links.filter(a => {
  const href = a.href.toLowerCase()
  const text = a.textContent.toLowerCase()
  return EXPLICIT_KEYWORDS.some(k => href.includes(k) || text.includes(k))
})
```

| Liens suspects | Score |
|----------------|-------|
| 1-3 liens | +5 |
| 4-10 liens | +15 |
| 10+ liens | +30 (cap) |

---

## Safe Context Detection

Pour éviter les faux positifs sur du contenu éducatif/médical.

```typescript
const SAFE_CONTEXT_INDICATORS = [
  // Mots dans le contenu
  'wikipedia', 'education', 'medical', 'health', 'research',
  'documentary', 'news', 'article', 'study', 'academic',
  'cancer', 'disease', 'anatomy', 'biology', 'history'
]

const SAFE_DOMAINS = [
  'wikipedia.org', 'webmd.com', 'mayoclinic.org',
  'healthline.com', 'nih.gov', 'cdc.gov',
  'britannica.com', 'khanacademy.org'
]

function hasSafeContext(document: Document, url: string): boolean {
  const domain = new URL(url).hostname
  
  // Domaine safe → toujours OK
  if (SAFE_DOMAINS.some(d => domain.includes(d))) {
    return true
  }
  
  // Check contenu
  const text = document.body.innerText.toLowerCase()
  const safeIndicatorCount = SAFE_CONTEXT_INDICATORS.filter(
    indicator => text.includes(indicator)
  ).length
  
  // 3+ indicateurs safe → divise score par 3
  return safeIndicatorCount >= 3
}
```

**Effet sur le score:**
```
Si hasSafeContext() → score final = Math.floor(score / 3)
```

---

## Gestion des SPAs

Les Single Page Applications chargent le contenu dynamiquement après le HTML initial.

### Stratégie : Double Analyse

```typescript
async function analyzePageSmart(): Promise<void> {
  // Analyse 1 : immédiate (DOMContentLoaded)
  const result1 = analyzePage()
  
  if (result1.score >= BLOCK_THRESHOLD) {
    blockPage(result1)
    return
  }
  
  // Analyse 2 : après délai (contenu dynamique chargé)
  await delay(1500) // 1.5 secondes
  
  const result2 = analyzePage()
  
  if (result2.score >= BLOCK_THRESHOLD) {
    blockPage(result2)
    return
  }
  
  // Optionnel : observer les mutations majeures
  if (result2.score >= WARN_THRESHOLD) {
    observeForChanges()
  }
}
```

### Détection de SPA

```typescript
function isSPALikely(): boolean {
  // Indicateurs qu'un site est une SPA
  const indicators = [
    // Peu de contenu initial
    document.body.innerText.length < 500,
    // Frameworks SPA courants
    !!document.querySelector('[data-reactroot]'),
    !!document.querySelector('[ng-app]'),
    !!document.querySelector('#__nuxt'),
    !!document.querySelector('#__next'),
    // Script bundles volumineux
    document.querySelectorAll('script[src*="bundle"]').length > 0
  ]
  
  return indicators.filter(Boolean).length >= 2
}
```

---

## Communication Content Script ↔ Background

### Content Script → Background

```typescript
// content/page-analyzer.ts

const analysisResult = analyzePage()

chrome.runtime.sendMessage({
  type: 'PAGE_ANALYSIS_RESULT',
  data: {
    url: location.href,
    score: analysisResult.score,
    reasons: analysisResult.reasons,
    isExplicit: analysisResult.isExplicit,
    detectedMeta: analysisResult.detectedMeta,
    timestamp: Date.now()
  }
})
```

### Background → Content Script (Block)

```typescript
// background/service-worker.ts

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'PAGE_ANALYSIS_RESULT') {
    const { data } = message
    
    if (data.isExplicit || data.score >= getBlockThreshold()) {
      // Redirect tab to block screen
      chrome.tabs.update(sender.tab.id, {
        url: `${BLOCK_SCREEN_URL}?url=${encodeURIComponent(data.url)}&reason=content_analysis&score=${data.score}`
      })
    }
  }
})
```

---

## Exemples concrets

### Exemple 1 : Site adulte déguisé

```
URL: https://free-videos-hub.com/category/hot

Meta:    <meta name="rating" content="adult">     → +100
Title:   "Free Adult Videos - Watch Now"          → +60
Body:    contient "nude", "xxx", "hot girls" (5x) → +25
Images:  45 images, 200 mots de texte             → +40
URL:     /category/hot                            → +10
Links:   12 liens vers sites suspects             → +30

TOTAL: 265 → BLOCK IMMÉDIAT
```

### Exemple 2 : Wikipedia (faux positif évité)

```
URL: https://en.wikipedia.org/wiki/Human_sexuality

Meta:    aucun meta adult                         → +0
Title:   "Human sexuality - Wikipedia"            → +0 (safe context)
Body:    contient "sex" mais contexte éducatif    → +10
Images:  5 images, 5000 mots                      → +0
Domain:  wikipedia.org                            → SAFE DOMAIN

Score brut: 10
Safe context détecté → 10 / 3 = 3

TOTAL: 3 → ALLOW
```

### Exemple 3 : Site galerie ambigu

```
URL: https://photo-gallery.net/models/

Meta:    aucun                                    → +0
Title:   "Beautiful Models Gallery"               → +0
Body:    "model", "photo", "gallery" (pas explicit) → +0
Images:  30 images, 100 mots                      → +30
Links:   5 liens avec "sexy" dans le texte        → +15

TOTAL: 45 → WARN (log + surveiller)
```

---

## Steps d'implémentation

### Step 1 — Types & Structure

Créer les types dans `shared/types.ts` :

```typescript
interface ContentAnalysisResult {
  score: number
  isExplicit: boolean
  reasons: string[]
  detectedMeta: string[]
  keywordMatches: number
  imageTextRatio: number
  hasSafeContext: boolean
}

interface PageAnalysisMessage {
  type: 'PAGE_ANALYSIS_RESULT'
  data: ContentAnalysisResult & {
    url: string
    timestamp: number
  }
}
```

### Step 2 — Page Analyzer (Content Script)

Créer `content/page-analyzer.ts` :

- `analyzePage()` — Fonction principale
- `analyzeMetaTags()` — Extraction meta
- `analyzeBodyContent()` — Keywords body
- `analyzeMediaRatio()` — Ratio images/texte
- `analyzeLinkHrefs()` — Liens suspects
- `checkSafeContext()` — Détection safe context

### Step 3 — Communication Setup

Modifier `content/content-script.ts` :

- Importer et exécuter `analyzePage()` au chargement
- Envoyer résultat au background
- Gérer la ré-analyse pour SPAs

### Step 4 — Background Handler

Modifier `background/service-worker.ts` :

- Handler pour `PAGE_ANALYSIS_RESULT`
- Logique de décision (allow/warn/block)
- Intégration avec heightened mode
- Logging et stats

### Step 5 — Performance & Whitelist

Optimisations :

- Cache des domaines déjà analysés (session storage)
- Whitelist de domaines safe (skip analysis)
- Timeout max 500ms pour l'analyse
- Throttling si trop de pages analysées

---

## Configuration

```typescript
// Thresholds par défaut
const CONTENT_THRESHOLDS = {
  block: 70,
  warn: 30,
  
  // En heightened mode
  heightenedBlock: 35,
  heightenedWarn: 15
}

// Limites de performance
const PERFORMANCE_LIMITS = {
  maxBodyLength: 10000,    // Caractères analysés
  maxLinks: 100,           // Liens analysés
  analysisTimeout: 500,    // ms
  spaRecheckDelay: 1500    // ms
}
```

---

## Fichiers à créer/modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| `shared/types.ts` | UPDATE | Ajouter types ContentAnalysis |
| `content/page-analyzer.ts` | CREATE | Logique d'analyse HTML |
| `content/content-script.ts` | UPDATE | Intégrer page analyzer |
| `background/service-worker.ts` | UPDATE | Handler PAGE_ANALYSIS_RESULT |
| `shared/keywords/index.ts` | UPDATE | Export ALL_EXPLICIT_KEYWORDS |

---

## Métriques à tracker

Pour le dashboard desktop :

```typescript
interface ContentAnalysisStats {
  pagesAnalyzedToday: number
  pagesBlockedToday: number
  pagesWarnedToday: number
  avgAnalysisTimeMs: number
  topBlockedDomains: string[]
  falsePositiveReports: number
}
```
