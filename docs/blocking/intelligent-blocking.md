# Intelligent Blocking System — Clarity

> Architecture du système de blocage intelligent multi-couches.

---

## Vue d'ensemble

Le système fonctionne sur **3 couches** qui s'exécutent dans l'ordre. Si une couche bloque, les suivantes ne sont pas exécutées.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER BROWSING                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: HARD BLOCKLIST                                                     │
│  Domaines connus → BLOCK instantané (niveau réseau)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                          (si pas dans blocklist)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: SEARCH INTELLIGENCE                                                │
│  Analyse des recherches → WARNING ou BLOCK selon score                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                          (si pas sur search engine)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: URL & CONTENT ANALYSIS                                             │
│  Analyse dynamique URL + HTML → BLOCK si contenu explicit                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                            ✅ SITE ACCESSIBLE
```

---

## Layer 1 : Hard Blocklist

### Description

Liste statique de domaines pornographiques connus.

### Contenu

- ~500+ domaines (pornhub.com, xvideos.com, xhamster.com, etc.)
- Wildcards pour les sous-domaines (`*.pornhub.com`)
- Mise à jour manuelle ou via liste externe

### Technologie

`declarativeNetRequest` — bloque au niveau réseau avant même que la requête parte.

### Action

Block instantané, redirect vers block screen.

### Quand

Toute navigation vers un domaine de la liste.

### Latence

~0ms (blocking réseau natif Chrome).

### Implémentation

```json
// rules.json
{
  "id": 100,
  "priority": 1,
  "action": { "type": "block" },
  "condition": {
    "urlFilter": "||pornhub.com^",
    "resourceTypes": ["main_frame", "sub_frame"]
  }
}
```

---

## Layer 2 : Search Intelligence

### Description

Analyse intelligente des recherches sur les moteurs de recherche pour détecter les tentatives d'accès à du contenu explicite.

### Problème résolu

L'utilisateur en "moment de folie" va :
1. Chercher frénétiquement des termes de plus en plus explicites
2. Utiliser des variations pour contourner les filtres
3. Essayer différentes langues

### Sous-systèmes

#### 2.1 Keyword Detection

Termes explicites directs.

```typescript
const EXPLICIT_KEYWORDS = [
  'porn', 'xxx', 'hentai', 'nsfw',
  'pornhub', 'xvideos', 'onlyfans',
  // ... ~100+ termes
]
```

#### 2.2 Suspicious Combinations

Mots innocents ensemble = suspect.

```typescript
const SUSPICIOUS_MODIFIERS = ['hot', 'sexy', 'asian', 'young', 'teen', 'girl', 'amateur']
const SUSPICIOUS_SUFFIXES = ['video', 'pic', 'photo', 'nude', 'naked', 'ero', 'xxx']

// "sauna" + "xxx" → suspect
// "girl" + "ero" → suspect
// "hot" + "teen" + "video" → suspect
// "massage" + "asian" + "video" → suspect
```

#### 2.3 Behavioral Analysis

Détection de patterns frénétiques.

```typescript
interface SearchSession {
  searches: Array<{ query: string; timestamp: number }>
  suspicionScore: number
  lastReset: number
}

// Détecte :
// - Plus de 5 recherches en 60 secondes
// - Variations rapides du même terme ("girl photo", "girl pic", "girl nude")
// - Pattern d'escalation (termes de plus en plus explicites)
```

#### 2.4 Evasion Detection

Normalisation des tentatives de contournement.

```typescript
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/0/g, 'o')      // p0rn → porn
    .replace(/3/g, 'e')      // s3x → sex
    .replace(/1/g, 'i')      // t1ts → tits
    .replace(/\$/g, 's')     // $ex → sex
    .replace(/@/g, 'a')      // n@ked → naked
    .replace(/\s+/g, '')     // p o r n → porn
    .replace(/[рР]/g, 'p')   // cyrillic р → p
    .replace(/[оО]/g, 'o')   // cyrillic о → o
}
```

#### 2.5 Multi-langue

Termes explicites dans plusieurs langues.

```typescript
const MULTILANG_KEYWORDS = {
  // Japonais
  ja: ['エロ', '無修正', 'アダルト', 'AV'],
  // Chinois
  zh: ['色情', '成人', '裸体'],
  // Espagnol
  es: ['porno', 'desnuda', 'sexo', 'puta'],
  // Allemand
  de: ['nackt', 'porno', 'ficken'],
  // Portugais
  pt: ['porno', 'gostosa', 'nua', 'sexo'],
  // Russe
  ru: ['порно', 'секс', 'голая'],
  // Arabe
  ar: ['سكس', 'بورن'],
  // Français
  fr: ['porno', 'salope', 'beurette', 'cul'],
}
```

### Scoring

Chaque recherche accumule des points. Le score se reset après 5 minutes d'inactivité.

| Élément détecté | Points |
|-----------------|--------|
| Mot innocent seul | 0 |
| Modificateur suspect (hot, sexy) | +2 |
| Combinaison suspecte | +5-10 |
| Terme explicite direct | +50 (instant) |
| Pattern frénétique (5+ en 60s) | +20 |
| Tentative d'évasion détectée | +15 |

### Actions

| Score | Action |
|-------|--------|
| 10-30 | Warning discret sur la page Google |
| 30-50 | Warning fort avec message encourageant |
| 50+ | BLOCK de la recherche, redirect vers block screen |
| Pattern frénétique | Activation du Mode Heightened |

### Moteurs supportés

Google, Bing, DuckDuckGo, Yahoo, Ecosia, Qwant, Brave Search, Yandex, StartPage.

### Faux positifs

Liste de "context words" qui annulent le score :

```typescript
const CONTEXT_SAFE_WORDS = [
  'cancer', 'medical', 'research', 'news', 'article',
  'wikipedia', 'health', 'education', 'documentary',
  'history', 'science', 'study', 'academic'
]

// "breast cancer research" → score annulé
// "sex education documentary" → score annulé
```

---

## Layer 3 : Intelligent URL & Content Analysis

### Description

Analyse dynamique des URLs et du contenu HTML des pages non-bloquées par Layer 1.

### Phase A : URL Analysis (avant chargement)

Analyse de l'URL avant que la page charge.

```typescript
function analyzeUrl(url: string): SuspicionScore {
  const urlLower = url.toLowerCase()
  
  // Patterns suspects
  const suspiciousPatterns = [
    /xxx/i, /porn/i, /adult/i, /nsfw/i,
    /sex(?!t)/i, /nude/i, /naked/i, /18\+/i,
    /erotic/i, /xxx/i, /camgirl/i
  ]
  
  // TLDs suspects
  const suspiciousTLDs = ['.xxx', '.adult', '.sex', '.porn']
  
  // Check domain, path, query params
  let score = 0
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(urlLower)) score += 20
  }
  for (const tld of suspiciousTLDs) {
    if (urlLower.includes(tld)) score += 50
  }
  
  return { score, reasons: [...] }
}
```

### Phase B : Content Analysis (après chargement)

Via content script, analyse le HTML de la page.

```typescript
function analyzePageContent(document: Document): AnalysisResult {
  let score = 0
  const reasons: string[] = []
  
  // 1. Meta tags
  const ratingMeta = document.querySelector('meta[name="rating"]')
  if (ratingMeta?.content === 'adult' || ratingMeta?.content === 'RTA-5042-1996-1400-1577-RTA') {
    return { isExplicit: true, reason: 'Adult meta tag' }
  }
  
  // 2. Open Graph
  const ogRestriction = document.querySelector('meta[property="og:restrictions:age"]')
  if (ogRestriction?.content === '18+') {
    return { isExplicit: true, reason: 'Age restriction meta' }
  }
  
  // 3. Title keywords
  const title = document.title.toLowerCase()
  for (const keyword of EXPLICIT_KEYWORDS) {
    if (title.includes(keyword)) {
      score += 30
      reasons.push(`Title contains: ${keyword}`)
    }
  }
  
  // 4. Body content sampling
  const bodyText = document.body.innerText.toLowerCase().slice(0, 5000)
  let keywordCount = 0
  for (const keyword of EXPLICIT_KEYWORDS) {
    if (bodyText.includes(keyword)) keywordCount++
  }
  if (keywordCount > 3) {
    score += keywordCount * 10
    reasons.push(`Multiple explicit keywords in body: ${keywordCount}`)
  }
  
  // 5. Image/text ratio (pages porno = beaucoup d'images)
  const images = document.querySelectorAll('img').length
  const textLength = document.body.innerText.length
  if (images > 20 && textLength < 1000) {
    score += 15
    reasons.push('High image/text ratio')
  }
  
  return { 
    isExplicit: score >= 50,
    score,
    reasons
  }
}
```

### Gestion des SPAs (sites modernes)

Les sites modernes (React, Vue, etc.) chargent le contenu via JavaScript après le HTML initial.

**Solution : Double analyse**

```typescript
async function analyzePageSmart() {
  // Analyse 1 : immédiate
  const result1 = analyzePageContent(document)
  if (result1.isExplicit) {
    blockPage()
    return
  }
  
  // Analyse 2 : après 1 seconde (attrape les SPAs)
  setTimeout(() => {
    const result2 = analyzePageContent(document)
    if (result2.isExplicit) {
      blockPage()
    }
  }, 1000)
}
```

**Note** : La plupart des sites porno sont des sites HTML classiques (pour le SEO), donc ce cas est rare. Les gros sites sont déjà dans Layer 1.

---

## Mode Heightened (Transversal)

### Déclencheur

Activé quand Layer 2 détecte un pattern de craquage :
- Recherches frénétiques (5+ en 60s)
- Score accumulé > 100
- Tentatives d'évasion répétées

### Durée

30 minutes (configurable).

### Effets

| Layer | Comportement normal | Mode Heightened |
|-------|--------------------|-----------------| 
| Layer 1 | Blocklist standard | Blocklist étendue |
| Layer 2 | Seuil warning: 30, block: 50 | Seuil warning: 15, block: 30 |
| Layer 3 | Score block: 50 | Score block: 30 |
| Navigation | Normale | Warning sur sites inconnus |

### Objectif

Casser le momentum d'un moment de faiblesse. Donner à l'utilisateur le temps de se calmer.

---

## Communication Desktop

L'extension envoie au desktop app via native messaging :

```typescript
interface BlockingStatus {
  // Compteurs
  blockedSearchesToday: number
  blockedSitesToday: number
  warningsToday: number
  
  // Mode
  heightenedMode: boolean
  heightenedUntil: number | null  // timestamp
  
  // Dernière action
  lastBlockedUrl: string | null
  lastBlockedReason: string | null
  lastBlockedAt: number | null
}
```

Le desktop peut afficher ces infos dans :
- Section Protection de BoundariesView
- Aoi (coaching contextuel)
- Notifications système

---

## Résumé des technologies

| Layer | API Chrome | Latence | Où ça tourne |
|-------|-----------|---------|--------------|
| Layer 1 | `declarativeNetRequest` | ~0ms | Niveau réseau |
| Layer 2 | `webNavigation.onBeforeNavigate` | ~5ms | Service worker |
| Layer 3 | Content Script | ~100-500ms | Page |

---

## Limitations connues

1. **Images Google** : Les vignettes peuvent charger avant le block (SafeSearch atténue ça)

2. **VPN/Proxy** : Ne protège pas si l'user utilise un autre navigateur ou un VPN

3. **Extensions multiples** : Un autre navigateur ou profil Chrome sans l'extension = pas de protection

4. **Incognito** : Requiert activation manuelle par l'utilisateur

5. **Performance** : Layer 3 content analysis ajoute ~100-500ms sur les pages (négligeable)

---

## Protection contre les faux positifs

Le système inclut plusieurs mécanismes pour éviter de bloquer des sites légitimes.

### 1. Word Boundary Matching

Pour les mots courts (≤3 caractères), on utilise des regex avec `\b` :

```typescript
// "nu" ne matche pas dans "nutrition"
/\bnu\b/.test("nutrition")  // false
/\bnu\b/.test("photo nu")   // true ✓
```

Évite les faux positifs comme :
- "nutrition" → "nu" (Portugais/Français pour "naked")
- "assault" → "ass"
- "classic" → "ass"

### 2. Détection des URLs de redirection

Les URLs de redirection (Google, Bing) sont détectées et l'URL destination est extraite :

```typescript
// google.com/url?q=https://example.com
// → Analyse "example.com", pas le tracking URL complet
extractRedirectDestination(url)
```

Évite les faux positifs dus aux paramètres de tracking encodés (Base64, etc.).

### 3. Whitelist des domaines de tracking email

Les liens email (Mailgun, SendGrid, Mailchimp, etc.) sont whitelistés :

```typescript
const emailTrackingPatterns = [
  /\.mg\./,           // Mailgun
  /sendgrid\.net/,
  /mailchimp\.com/,
  /click\./,
  /track\./,
  // ...
]
```

### 4. Whitelist par patterns

Certains patterns de domaines sont automatiquement safe :

```typescript
const safePatterns = [
  /bank/i,      // Domaines bancaires
  /kanri/i,     // 管理 - Gestion (JP)
  /\.gov$/,     // Gouvernement
  /\.edu$/,     // Éducation
  /\.co\.jp$/,  // Corporate Japon
]
```

### 5. Safe Context Detection

Si 3+ indicateurs "safe" sont détectés, le score est divisé par 3 :

```typescript
const SAFE_INDICATORS = [
  'wikipedia', 'education', 'medical', 'research',
  'cancer', 'health', 'science', 'academic'
]
```

### 6. Règle des 2+ signaux

**Un seul signal ne peut pas bloquer** (sauf meta tag `rating=adult`).

| Signaux | Action |
|---------|--------|
| Meta `rating=adult` | BLOCK (exception) |
| Score élevé + 2+ raisons | BLOCK |
| Score élevé + 1 raison | WARN seulement |
| Score moyen | WARN |

Cela évite les faux positifs où un seul signal faible (ex: ratio média élevé) déclencherait un block.

### 7. Scoring contextuel

Les signaux n'ont pas tous le même poids :

| Signal | Score max | Peut bloquer seul ? |
|--------|-----------|---------------------|
| Meta adult | 100 | ✅ Oui |
| Title keyword | 60 | ❌ Non |
| Body keywords | 50 | ❌ Non |
| Media ratio | 25 | ❌ Non |
| URL pattern | 30 | ❌ Non |

---

## Fichiers d'implémentation

| Fichier | Rôle |
|---------|------|
| `apps/extension/public/rules.json` | Rules declarativeNetRequest (Layer 1 + SafeSearch) |
| `apps/extension/src/background/search-filter.ts` | Détection queries (Layer 2) |
| `apps/extension/src/background/search-intelligence.ts` | Scoring & behavioral analysis (Layer 2) |
| `apps/extension/src/content/content-analyzer.ts` | Analyse HTML (Layer 3) |
| `apps/extension/src/background/service-worker.ts` | Orchestration |
| `apps/extension/src/background/heightened-mode.ts` | Gestion du mode heightened |

---

## Prochaines étapes

1. [ ] Implémenter scoring system dans `search-intelligence.ts`
2. [ ] Ajouter les keyword lists multi-langue
3. [ ] Créer le content script pour Layer 3
4. [ ] Implémenter Mode Heightened
5. [ ] Connecter au desktop app via native messaging
6. [ ] Tests avec cas réels
