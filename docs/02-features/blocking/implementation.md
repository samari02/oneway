# Intelligent Blocking — Implementation Guide

> Guide technique pour l'implémentation du système de blocage intelligent.
> Voir `intelligent-blocking.md` pour l'architecture conceptuelle.

---

## Structure des fichiers

```
apps/extension/src/
├── shared/
│   ├── types.ts                    # ✅ Types pour le système (SearchSession, etc.)
│   ├── constants.ts                # Constantes existantes
│   └── keywords/                   # 🆕 Keyword lists
│       ├── index.ts                # ✅ Barrel exports
│       ├── explicit.ts             # ✅ Termes explicites avec scores
│       ├── suspicious.ts           # ✅ Combinaisons suspectes
│       └── multilang.ts            # ✅ Multi-langue
│
├── lib/
│   ├── supabase.ts                 # Client Supabase existant
│   └── normalizer.ts               # 🆕 Anti-evasion normalization
│
├── background/
│   ├── service-worker.ts           # Point d'entrée (à modifier)
│   ├── search-filter.ts            # Existant (à enrichir)
│   ├── search-intelligence.ts      # 🔜 Phase 2 - Scoring engine
│   ├── content-analyzer.ts         # 🔜 Phase 4 - Layer 3
│   └── heightened-mode.ts          # 🔜 Phase 3
│
└── content/
    ├── content-script.ts           # Existant
    └── page-analyzer.ts            # 🔜 Phase 4 - Content analysis
```

---

## Phase 1 : Fondations (✅ Implémenté)

### 1.1 Types (`shared/types.ts`)

Nouveaux types ajoutés pour le système intelligent :

```typescript
// Flags de détection
type SearchFlag =
  | 'explicit_keyword'        // Terme explicite direct
  | 'suspicious_combination'  // Combinaison suspecte
  | 'evasion_attempt'        // Tentative d'évasion détectée
  | 'frantic_pattern'        // Pattern frénétique
  | 'escalation_pattern'     // Escalation progressive
  | 'multilang_keyword'      // Terme étranger

// Session de recherche (persiste 5 min)
interface SearchSession {
  searches: SearchEntry[]
  totalScore: number
  lastActivity: number
  peakScore: number
}

// Résultat d'analyse
interface SearchAnalysisResult {
  score: number
  flags: SearchFlag[]
  action: 'allow' | 'warn' | 'block'
  matchedTerms: string[]
}

// Mode heightened
interface HeightenedModeState {
  active: boolean
  activatedAt: number | null
  expiresAt: number | null
  reason: string | null
  triggerScore: number
}
```

### 1.2 Keywords (`shared/keywords/`)

#### `explicit.ts` — Termes explicites avec scoring

```typescript
// Catégories de score
INSTANT_BLOCK_KEYWORDS  // score: 100 → block immédiat
HIGH_SUSPICION_KEYWORDS // score: 50  → très suspect
MEDIUM_SUSPICION_KEYWORDS // score: 25 → accumulation

// Usage
import { getExplicitKeywordScore } from '../shared/keywords'

const result = getExplicitKeywordScore('some query with porn')
// { found: true, score: 100, matchedTerms: ['porn'] }
```

#### `suspicious.ts` — Combinaisons suspectes

Mots innocents seuls, suspects ensemble :

```typescript
SUSPICIOUS_MODIFIERS  // hot, sexy, asian, young, teen...
SUSPICIOUS_SUBJECTS   // girl, woman, model, wife...
SUSPICIOUS_SUFFIXES   // video, nude, naked, ero, xxx...
SAFE_CONTEXT_WORDS    // cancer, medical, research... (annule le score)

// Scoring des combinaisons
// Modifier + Subject + Suffix = 40 points
// Modifier + Suffix = 30 points
// Subject + Suffix = 25 points

// Usage
import { analyzeSuspiciousCombinations } from '../shared/keywords'

const result = analyzeSuspiciousCombinations('hot girl video')
// { isSuspicious: true, score: 40, matchedCombination: 'hot + girl + video' }

const safe = analyzeSuspiciousCombinations('breast cancer research')
// { isSuspicious: false, score: 0, hasSafeContext: true }
```

#### `multilang.ts` — Multi-langue

```typescript
// 11 langues supportées
JAPANESE_KEYWORDS   // エロ + えろ (katakana + hiragana), 無修正, AV...
CHINESE_KEYWORDS    // 色情, 裸体, 性爱...
SPANISH_KEYWORDS    // porno, desnuda, sexo...
GERMAN_KEYWORDS     // nackt, ficken, titten...
PORTUGUESE_KEYWORDS // gostosa, buceta, foda...
FRENCH_KEYWORDS     // salope, beurette, nichons...
RUSSIAN_KEYWORDS    // порно, секс, голая...
ITALIAN_KEYWORDS    // nuda, scopare, tette...
ARABIC_KEYWORDS     // سكس, بورن, عاري...
DUTCH_KEYWORDS      // naakt, neuken, tieten...
KOREAN_KEYWORDS     // 야동, 포르노, 섹스...

// Usage
import { checkMultilangKeywords } from '../shared/keywords'

const result = checkMultilangKeywords('エロ動画')
// { found: true, score: 50, matchedTerms: ['エロ'] }

// Détection avec caractères répétés (anti-évasion)
checkMultilangKeywords('えろろろ')   // → えろ détecté (score: 65)
checkMultilangKeywords('порнооо')    // → порно détecté (score: 65)
```

### 1.3 Normalizer (`lib/normalizer.ts`)

Anti-évasion : détecte et normalise les tentatives de contournement.

```typescript
import { normalizeQuery, hasEvasionIndicators } from '../lib/normalizer'

// Substitutions de caractères
normalizeQuery('p0rn')  // → { normalized: 'porn', evasionScore: 5 }
normalizeQuery('s3x')   // → { normalized: 'sex', evasionScore: 5 }
normalizeQuery('@ss')   // → { normalized: 'ass', evasionScore: 5 }

// Caractères répétés (TOUS les scripts - très important!)
normalizeQuery('pooooorno')  // → { normalized: 'porno', evasionScore: 15 }
normalizeQuery('sexxxy')     // → { normalized: 'sexy', evasionScore: 10 }

// Espacement
normalizeQuery('p o r n')  // → { normalized: 'porn', evasionScore: 15 }

// Cyrillic lookalikes (рorn avec р russe)
normalizeQuery('рorn')  // → { normalized: 'porn', evasionScore: 5 }

// Typos intentionnels (liste étendue)
normalizeQuery('pron')   // → porn
normalizeQuery('pr0n')   // → porn
normalizeQuery('porno')  // → porn (normalisé)
normalizeQuery('porrrn') // → porn

// Check rapide
hasEvasionIndicators('p0rn')  // → true
hasEvasionIndicators('cats')  // → false
```

**Techniques détectées :**
- `character_substitution` : 0→o, 3→e, $→s, @→a, etc.
- `repeated_characters` : Regex `(.)\1+` réduit TOUT répété à 1 (fonctionne sur tous les scripts)
- `spaced_characters` : p o r n → porn
- `repeated_characters` : porrrn → porn
- `typo_correction` : pron, prn, pr0n → porn
- `separator_removal` : p.o.r.n, p-o-r-n → porn
- `cyrillic_lookalike` : рorn (Cyrillic р) → porn

---

## Phase 2 : Search Intelligence (✅ Implémenté)

### 2.1 Fichier `background/search-intelligence.ts`

```typescript
/**
 * Search Intelligence Engine
 * Analyses searches and maintains session scoring
 */

import { normalizeQuery } from '../lib/normalizer'
import { 
  getExplicitKeywordScore, 
  analyzeSuspiciousCombinations,
  checkMultilangKeywords 
} from '../shared/keywords'
import type { 
  SearchSession, 
  SearchAnalysisResult, 
  SearchThresholds 
} from '../shared/types'

const DEFAULT_THRESHOLDS: SearchThresholds = {
  warnScore: 20,
  blockScore: 50,
  heightenedTrigger: 100,
  franticCount: 5,
  franticWindowMs: 60000,      // 1 minute
  sessionTimeoutMs: 300000,    // 5 minutes
}

export async function analyzeSearch(query: string): Promise<SearchAnalysisResult> {
  // 1. Normalize query (anti-evasion)
  const { normalized, evasionScore, detectedTechniques } = normalizeQuery(query)
  
  // 2. Check explicit keywords
  const explicit = getExplicitKeywordScore(normalized)
  
  // 3. Check suspicious combinations
  const combinations = analyzeSuspiciousCombinations(normalized)
  
  // 4. Check multilingual keywords
  const multilang = checkMultilangKeywords(query) // Use original for non-Latin
  
  // 5. Calculate total score
  let totalScore = 0
  const flags: SearchFlag[] = []
  const matchedTerms: string[] = []
  
  if (explicit.found) {
    totalScore += explicit.score
    flags.push('explicit_keyword')
    matchedTerms.push(...explicit.matchedTerms)
  }
  
  if (combinations.isSuspicious) {
    totalScore += combinations.score
    flags.push('suspicious_combination')
  }
  
  if (multilang.found) {
    totalScore += multilang.score
    flags.push('multilang_keyword')
    matchedTerms.push(...multilang.matchedTerms)
  }
  
  if (evasionScore > 0) {
    totalScore += evasionScore
    flags.push('evasion_attempt')
  }
  
  // 6. Check behavioral patterns (frantic, escalation)
  const session = await getSearchSession()
  const behavioralFlags = analyzeBehavior(session, totalScore)
  flags.push(...behavioralFlags.flags)
  totalScore += behavioralFlags.additionalScore
  
  // 7. Determine action
  const thresholds = await getThresholds()
  let action: 'allow' | 'warn' | 'block' = 'allow'
  
  if (totalScore >= thresholds.blockScore) {
    action = 'block'
  } else if (totalScore >= thresholds.warnScore) {
    action = 'warn'
  }
  
  // 8. Update session
  await updateSearchSession(query, normalized, totalScore, flags)
  
  return {
    score: totalScore,
    flags,
    action,
    matchedTerms
  }
}
```

### 2.2 Behavioral Analysis

```typescript
function analyzeBehavior(session: SearchSession, currentScore: number): {
  flags: SearchFlag[]
  additionalScore: number
} {
  const flags: SearchFlag[] = []
  let additionalScore = 0
  const now = Date.now()
  
  // Check for frantic pattern (5+ searches in 60 seconds)
  const recentSearches = session.searches.filter(
    s => now - s.timestamp < 60000
  )
  if (recentSearches.length >= 5) {
    flags.push('frantic_pattern')
    additionalScore += 20
  }
  
  // Check for escalation (scores increasing over time)
  if (session.searches.length >= 3) {
    const lastThree = session.searches.slice(-3)
    const isEscalating = lastThree.every((s, i) => 
      i === 0 || s.score > lastThree[i - 1].score
    )
    if (isEscalating && currentScore > lastThree[lastThree.length - 1].score) {
      flags.push('escalation_pattern')
      additionalScore += 15
    }
  }
  
  return { flags, additionalScore }
}
```

---

## Phase 3 : Heightened Mode UI (✅ Implémenté)

Feedback visuel quand le mode protection renforcée est actif.

### 3.1 Badge Extension

```typescript
// search-intelligence.ts

async function updateBadge(isHeightened: boolean): Promise<void> {
  if (isHeightened) {
    await chrome.action.setBadgeText({ text: '!' })
    await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' })
  } else {
    await chrome.action.setBadgeText({ text: '' })
  }
}
```

### 3.2 Popup Section

Nouvelle section dans la popup quand heightened mode actif :

```html
<!-- popup/index.html -->
<div class="popup__heightened" id="heightened-section">
  <div class="popup__heightened-header">
    <span>🔥</span>
    <span>Protection Renforcée</span>
    <span id="heightened-timer">28:45</span>  <!-- Countdown -->
  </div>
  <div class="popup__heightened-stats">
    <span>Bloqués: 3</span>
    <span>Avertis: 2</span>
    <span>Activations: 1</span>
  </div>
</div>
```

### 3.3 Notification Browser

```typescript
async function showHeightenedNotification(): Promise<void> {
  chrome.notifications.create('heightened-mode', {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title: '⚠️ Mode Protection Renforcée',
    message: 'Clarity a détecté une activité suspecte. Seuils abaissés pour 30 min.',
    priority: 2
  })
}
```

### 3.4 État restauré au startup

```typescript
// service-worker.ts

async function restoreBadgeState(): Promise<void> {
  const heightened = await getHeightenedMode()
  await updateBadge(heightened?.active || false)
}
```

---

## Phase 4 : Content Analysis (✅ Implémenté)

> Documentation détaillée : **[content-analysis.md](./content-analysis.md)**

Layer 3 du système — analyse le contenu HTML des pages.

### Résumé

| Signal | Score |
|--------|-------|
| Meta `rating=adult` | +100 (instant block) |
| Title explicite | +60 |
| Body keywords (5+) | +10-50 |
| Image/text ratio élevé | +20-40 |
| URL path suspect | +30 |
| Liens suspects | +5-30 |

### Seuils

| Score | Action |
|-------|--------|
| >= 70 | BLOCK |
| 30-69 | WARN |
| < 30 | ALLOW |

### Steps d'implémentation

1. **Types & Structure** — `shared/types.ts`
2. **Page Analyzer** — `content/page-analyzer.ts`
3. **Communication** — Content ↔ Background messaging
4. **Background Handler** — Logique de décision
5. **Performance** — Cache, whitelist, throttling

Voir [content-analysis.md](./content-analysis.md) pour l'algorithme complet et les exemples.

---

## Integration dans Service Worker

```typescript
// background/service-worker.ts (modifications)

import { analyzeSearch } from './search-intelligence'
import { checkHeightenedMode, activateHeightenedMode } from './heightened-mode'

// Dans le listener webNavigation.onBeforeNavigate
if (isSearchEngine(details.url)) {
  const query = extractSearchQuery(details.url)
  if (query) {
    const result = await analyzeSearch(query)
    
    if (result.action === 'block') {
      // Redirect to block screen
      const blockUrl = `${BLOCK_SCREEN_URL}?url=${encodeURIComponent(details.url)}&reason=${encodeURIComponent('Search blocked')}&type=search`
      chrome.tabs.update(details.tabId, { url: blockUrl })
      return
    }
    
    if (result.action === 'warn') {
      // TODO: Inject warning UI
      console.log('Warning:', result.matchedTerms)
    }
    
    // Check if should activate heightened mode
    const session = await getSearchSession()
    if (session.totalScore >= 100) {
      await activateHeightenedMode('High suspicion score', session.totalScore)
    }
  }
}
```

---

## Prochaines étapes

| Phase | Description | Fichiers | Statut |
|-------|-------------|----------|--------|
| 1 | Types & Keywords | `types.ts`, `keywords/*`, `normalizer.ts` | ✅ Done |
| 2 | Search Intelligence | `search-intelligence.ts` | ✅ Done |
| 3 | Heightened Mode UI | Badge, popup section, notifications | ✅ Done |
| 4 | Content Analysis | `page-analyzer.ts` | ✅ Done |
| 5 | Hard Blocklist | `rules.json` (~500 domaines) | 🔜 |
| 6 | Desktop Integration | Native messaging sync | 🔜 |

### Documentation

| Document | Description |
|----------|-------------|
| [intelligent-blocking.md](./intelligent-blocking.md) | Architecture conceptuelle (3 layers) |
| [implementation.md](./implementation.md) | Ce fichier — guide technique |
| [content-analysis.md](./content-analysis.md) | Algorithme Layer 3 détaillé |

---

## Testing

```typescript
// Tester le normalizer
import { normalizeQuery } from '../lib/normalizer'

console.log(normalizeQuery('p0rn'))     // → porn
console.log(normalizeQuery('s3xy'))     // → sexy
console.log(normalizeQuery('h o t'))    // → hot

// Tester les keywords
import { getExplicitKeywordScore } from '../shared/keywords'

console.log(getExplicitKeywordScore('pornhub'))  // → { score: 100 }
console.log(getExplicitKeywordScore('cats'))     // → { score: 0 }

// Tester les combinaisons
import { analyzeSuspiciousCombinations } from '../shared/keywords'

console.log(analyzeSuspiciousCombinations('hot girl video'))  // → suspicious
console.log(analyzeSuspiciousCombinations('breast cancer'))   // → safe context
```
