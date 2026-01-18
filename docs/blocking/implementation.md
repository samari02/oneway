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
JAPANESE_KEYWORDS   // エロ, 無修正, AV...
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
```

### 1.3 Normalizer (`lib/normalizer.ts`)

Anti-évasion : détecte et normalise les tentatives de contournement.

```typescript
import { normalizeQuery, hasEvasionIndicators } from '../lib/normalizer'

// Substitutions de caractères
normalizeQuery('p0rn')  // → { normalized: 'porn', evasionScore: 5 }
normalizeQuery('s3x')   // → { normalized: 'sex', evasionScore: 5 }
normalizeQuery('@ss')   // → { normalized: 'ass', evasionScore: 5 }

// Espacement
normalizeQuery('p o r n')  // → { normalized: 'porn', evasionScore: 15 }

// Cyrillic lookalikes (рorn avec р russe)
normalizeQuery('рorn')  // → { normalized: 'porn', evasionScore: 5 }

// Typos intentionnels
normalizeQuery('pron')  // → { normalized: 'porn', evasionScore: 10 }
normalizeQuery('pr0n')  // → { normalized: 'porn', evasionScore: 10 }

// Check rapide
hasEvasionIndicators('p0rn')  // → true
hasEvasionIndicators('cats')  // → false
```

**Techniques détectées :**
- `character_substitution` : 0→o, 3→e, $→s, @→a, etc.
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

## Phase 3 : Heightened Mode (🔜 À implémenter)

```typescript
// background/heightened-mode.ts

export async function activateHeightenedMode(reason: string, score: number) {
  const state: HeightenedModeState = {
    active: true,
    activatedAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
    reason,
    triggerScore: score,
    originalThresholds: await getThresholds()
  }
  
  // Lower thresholds during heightened mode
  const heightenedThresholds: SearchThresholds = {
    warnScore: 10,      // Was 20
    blockScore: 30,     // Was 50
    // ... etc
  }
  
  await chrome.storage.local.set({
    heightenedMode: state,
    searchThresholds: heightenedThresholds
  })
  
  // Notify desktop app
  if (isDesktopAppConnected()) {
    sendHeightenedModeAlert(state)
  }
}

export async function checkHeightenedMode(): Promise<HeightenedModeState | null> {
  const { heightenedMode } = await chrome.storage.local.get('heightenedMode')
  
  if (!heightenedMode?.active) return null
  
  // Check if expired
  if (heightenedMode.expiresAt && Date.now() > heightenedMode.expiresAt) {
    await deactivateHeightenedMode()
    return null
  }
  
  return heightenedMode
}
```

---

## Phase 4 : Content Analysis (🔜 À implémenter)

### 4.1 URL Analysis

```typescript
// background/content-analyzer.ts

export function analyzeUrl(url: string): UrlAnalysisResult {
  const urlLower = url.toLowerCase()
  let score = 0
  const reasons: string[] = []
  const suspiciousParts: string[] = []
  
  // Check TLD
  const suspiciousTLDs = ['.xxx', '.adult', '.sex', '.porn']
  for (const tld of suspiciousTLDs) {
    if (urlLower.includes(tld)) {
      score += 80
      reasons.push(`Suspicious TLD: ${tld}`)
      suspiciousParts.push(tld)
    }
  }
  
  // Check path and query params
  const urlObj = new URL(url)
  const pathAndQuery = urlObj.pathname + urlObj.search
  
  // Use our keyword detection
  const explicit = getExplicitKeywordScore(pathAndQuery)
  if (explicit.found) {
    score += explicit.score
    reasons.push(`Explicit keyword in URL: ${explicit.matchedTerms.join(', ')}`)
    suspiciousParts.push(...explicit.matchedTerms)
  }
  
  return {
    score,
    isSuspicious: score >= 30,
    reasons,
    suspiciousParts
  }
}
```

### 4.2 Content Script (Page Analysis)

```typescript
// content/page-analyzer.ts

export function analyzePage(): ContentAnalysisResult {
  let score = 0
  const reasons: string[] = []
  const detectedMeta: string[] = []
  
  // 1. Check meta tags
  const ratingMeta = document.querySelector('meta[name="rating"]')
  if (ratingMeta?.getAttribute('content')?.toLowerCase() === 'adult') {
    score += 100
    detectedMeta.push('rating=adult')
    reasons.push('Adult rating meta tag')
  }
  
  // 2. Check Open Graph age restriction
  const ogAge = document.querySelector('meta[property="og:restrictions:age"]')
  if (ogAge?.getAttribute('content') === '18+') {
    score += 80
    detectedMeta.push('og:restrictions:age=18+')
    reasons.push('18+ age restriction')
  }
  
  // 3. Check title
  const title = document.title.toLowerCase()
  const titleResult = getExplicitKeywordScore(title)
  if (titleResult.found) {
    score += titleResult.score
    reasons.push(`Explicit keyword in title: ${titleResult.matchedTerms.join(', ')}`)
  }
  
  // 4. Sample body content (first 5000 chars)
  const bodyText = document.body.innerText.slice(0, 5000).toLowerCase()
  let keywordCount = 0
  for (const keyword of ALL_EXPLICIT_KEYWORDS) {
    if (bodyText.includes(keyword.toLowerCase())) {
      keywordCount++
    }
  }
  if (keywordCount > 3) {
    score += keywordCount * 5
    reasons.push(`Multiple explicit keywords in body: ${keywordCount}`)
  }
  
  return {
    score,
    isExplicit: score >= 50,
    reasons,
    detectedMeta,
    keywordMatches: keywordCount
  }
}
```

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
| 2 | Search Intelligence | `search-intelligence.ts` | 🔜 Next |
| 3 | Heightened Mode | `heightened-mode.ts` | 🔜 |
| 4 | Content Analysis | `content-analyzer.ts`, `page-analyzer.ts` | 🔜 |
| 5 | Hard Blocklist | `rules.json` (enrichir) | 🔜 |
| 6 | Desktop Integration | Native messaging | 🔜 |

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
