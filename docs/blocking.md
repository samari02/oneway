# Blocking System — Clarity

> Documentation de l'architecture du système de blocage et protection.

---

## Vue d'ensemble

Le système de blocage de Clarity fonctionne sur **3 niveaux** :

| Niveau | Technologie | Ce qu'il bloque |
|--------|-------------|-----------------|
| 1. Sites | `declarativeNetRequest` + `webNavigation` | Domaines spécifiques (Twitter, Reddit, etc.) |
| 2. SafeSearch | `declarativeNetRequest` URL rewrite | Résultats explicites Google |
| 3. Recherches | `webNavigation` + keyword detection | Requêtes explicites avant résultats |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Chrome Extension                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  webNavigation.onBeforeNavigate             │ │
│  │                                                              │ │
│  │   1. isSearchEngine(url)?                                   │ │
│  │      └─→ extractSearchQuery() → isExplicitSearch()          │ │
│  │          └─→ BLOCK if explicit                              │ │
│  │                                                              │ │
│  │   2. shouldBlock(url, tabId)?                               │ │
│  │      └─→ Check allowlist → Check rules                      │ │
│  │          └─→ BLOCK if matched                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  declarativeNetRequest                       │ │
│  │                                                              │ │
│  │   rules.json:                                               │ │
│  │   - Google searches → add &safe=active                      │ │
│  │   - (autres règles à venir)                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  Native Messaging                            │ │
│  │                                                              │ │
│  │   PROTECTION_STATUS → Desktop App                           │ │
│  │   { incognitoEnabled, safeSearchEnforced, ... }            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Desktop App (Tauri)                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  native_host.rs                              │ │
│  │                                                              │ │
│  │   ExtensionStatus {                                         │ │
│  │     connected: bool,                                        │ │
│  │     last_seen: i64,                                         │ │
│  │     incognito_enabled: bool,                                │ │
│  │     safe_search_enforced: bool,                             │ │
│  │     search_filter_active: bool,                             │ │
│  │     blocked_searches_today: i32,                            │ │
│  │   }                                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  BoundariesView.tsx                          │ │
│  │                                                              │ │
│  │   Protection Status Section:                                │ │
│  │   - Extension ✅/⚠️                                         │ │
│  │   - Incognito ✅/⚠️ [Setup]                                 │ │
│  │   - SafeSearch ✅                                           │ │
│  │   - Search Filter ✅ (X blocked)                            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Blocage de sites (Boundaries)

### Flow

1. User navigue vers un site
2. `webNavigation.onBeforeNavigate` intercepte
3. `shouldBlock()` vérifie :
   - Allowlist par tab (bypass récent?)
   - Rules de blocage (Boundaries)
4. Si bloqué → redirect vers block screen
5. Block screen affiche raison + options bypass

### Rules

Stockées dans `chrome.storage.local.rules` :

```typescript
interface BlockRule {
  id: string
  pattern: string       // ex: "*://*.twitter.com/*"
  action: 'block' | 'allow' | 'ask'
  reason?: string
  category?: Category
}
```

### Bypass

- User peut bypass pour 5 minutes par tab
- Stocké dans `allowedTabs` map
- Cleanup automatique des entrées expirées

---

## 2. SafeSearch Enforcement

### Implémentation

Fichier : `apps/extension/public/rules.json`

```json
{
  "id": 1,
  "priority": 1,
  "action": {
    "type": "redirect",
    "redirect": {
      "transform": {
        "queryTransform": {
          "addOrReplaceParams": [
            { "key": "safe", "value": "active" }
          ]
        }
      }
    }
  },
  "condition": {
    "urlFilter": "||google.com/search*",
    "resourceTypes": ["main_frame"]
  }
}
```

### Domaines couverts

**Google** (20 TLDs) :
- google.com, google.fr, google.de, google.co.uk, google.es
- google.it, google.ca, google.com.au, google.ch, google.be
- google.nl, google.pt, google.com.br, google.com.mx, google.co.in
- google.co.jp, google.co.kr, google.ru, google.pl, google.at

**Bing** :
- bing.com/search, bing.com/images, bing.com/videos
- Paramètre : `adlt=strict`

**DuckDuckGo** :
- duckduckgo.com
- Paramètre : `kp=1`

**Yahoo** :
- search.yahoo.com, fr.search.yahoo.com, images.search.yahoo.com
- Paramètre : `vm=r`

**Ecosia** :
- ecosia.org/search
- Paramètre : `safeSearch=strict`

**Qwant** :
- qwant.com
- Paramètre : `safesearch=2`

**Brave Search** :
- search.brave.com/search, /images, /videos
- Paramètre : `safesearch=strict`

**Yandex** :
- yandex.com, yandex.ru, /images
- Paramètre : `family=yes`

### Comment ça marche

1. `declarativeNetRequest` intercepte au niveau réseau
2. URL transformée : `?q=test` → `?q=test&safe=active`
3. Google affiche résultats filtrés
4. User ne voit jamais la version non-filtrée

---

## 3. Search Query Detection

### Implémentation

Fichier : `apps/extension/src/background/search-filter.ts`

### Keywords

Liste de ~50+ termes explicites incluant :
- Termes directs (porn, xxx, nsfw, hentai...)
- Sites connus (pornhub, xvideos, onlyfans...)
- Termes français
- Patterns de recherche ("nude", "sex video", etc.)

### Patterns Regex

```typescript
const EXPLICIT_PATTERNS = [
  /\bfap\b/i,
  /\bjerk\s*off\b/i,
  /\bhot\s+(girl|guy|women|men|teen)s?\s+(nude|naked|video)/i,
  /\b(watch|free)\s+porn\b/i,
  /\badult\s+(video|content|site)/i,
]
```

### Flow

```typescript
// Dans service-worker.ts
if (isSearchEngine(details.url)) {
  const query = extractSearchQuery(details.url)
  if (query) {
    const { isExplicit, matchedTerm } = isExplicitSearch(query)
    if (isExplicit) {
      // Redirect to block screen
      // Increment blocked counter
      return
    }
  }
}
```

### Moteurs supportés

| Moteur | Paramètre query |
|--------|-----------------|
| Google | `?q=` |
| Bing | `?q=` |
| DuckDuckGo | `?q=` |
| Yahoo | `?p=` |

---

## 4. Protection Status

### Extension → Desktop

Message envoyé au connect :

```typescript
{
  type: 'PROTECTION_STATUS',
  data: {
    incognitoEnabled: boolean,
    safeSearchEnforced: boolean,
    searchFilterActive: boolean,
    blockedSearchesToday: number
  }
}
```

### Desktop Storage

Rust global state via `once_cell::Lazy<Mutex<...>>` :

```rust
pub struct ExtensionStatus {
  pub connected: bool,
  pub last_seen: i64,
  pub incognito_enabled: bool,
  pub safe_search_enforced: bool,
  pub search_filter_active: bool,
  pub blocked_searches_today: i32,
}
```

### Frontend Query

```typescript
const { status } = useExtensionStatus()

// status = {
//   connected: true,
//   lastSeen: 1705512345678,
//   incognitoEnabled: false,
//   safeSearchEnforced: true,
//   searchFilterActive: true,
//   blockedSearchesToday: 3
// }
```

---

## 5. Mode Incognito

### Problème

Par défaut, les extensions Chrome ne s'exécutent PAS en mode incognito.
→ Bypass total de toute la protection.

### Solution

L'utilisateur doit manuellement activer l'extension en incognito :

1. Ouvrir `chrome://extensions`
2. Trouver "Clarity - Focus & Flow"
3. Cliquer "Détails"
4. Activer "Autoriser en mode navigation privée"

### Détection

```typescript
const incognitoEnabled = await chrome.extension.isAllowedIncognitoAccess()
```

### UI

- **Popup** : Warning orange si non activé
- **Desktop** : Section Protection avec bouton "Setup"
- **Modal** : Guide étape par étape

---

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `apps/extension/public/rules.json` | Rules declarativeNetRequest (SafeSearch) |
| `apps/extension/src/background/search-filter.ts` | Détection queries explicites |
| `apps/extension/src/background/service-worker.ts` | Orchestration blocking |
| `apps/extension/src/background/native-messaging.ts` | Communication desktop |
| `apps/desktop/src-tauri/src/native_host.rs` | Réception status extension |
| `apps/desktop/src/features/boundaries/hooks/useExtensionStatus.ts` | Hook React |
| `apps/desktop/src/features/boundaries/components/BoundariesView.tsx` | UI Protection |

---

## Limitations connues

1. **Autres navigateurs** : Safari, Firefox non supportés (extension Chrome only)
2. **Bypass possible** : User peut désinstaller l'extension
3. **Faux positifs** : Certaines recherches légitimes peuvent être bloquées (ex: "breast cancer")
4. **Incognito** : Requiert action manuelle de l'utilisateur

---

## Évolutions futures

### Phase 2 — Safeguards & Resilience

#### DNS-Level Blocking (Backup)
Protection au niveau réseau, fonctionne même sans extension Chrome.

**Options** :
- **Hosts file** : Modifier `/etc/hosts` pour bloquer les domaines
- **DNS custom** : Pi-hole, NextDNS, ou Cloudflare Family
- **Avantage** : Fonctionne sur tous les navigateurs et apps

```
# Exemple hosts file
127.0.0.1 pornhub.com
127.0.0.1 xvideos.com
...
```

#### Health Check & Alertes
L'extension vérifie périodiquement que les règles de protection sont actives.

**Flow** :
1. Extension envoie heartbeat toutes les X minutes
2. Desktop app vérifie la réception
3. Si pas de heartbeat depuis Y minutes → alerte urgente
4. Si règles désactivées → alerte + notification système

**UI** :
- Badge rouge dans le tray icon
- Notification système macOS/Windows
- Modal bloquant dans l'app desktop

#### Alerte Incognito Persistante
Tant que l'extension n'est pas activée en incognito :
- Notification récurrente (toutes les heures?)
- Badge permanent dans BoundariesView
- Impossible de marquer comme "vu" - doit être résolu

### Phase 3 — Modes de Strictness

#### Mode Panic (Nuclear)
Si la protection est compromise (extension désactivée, etc.) :

**Comportement** :
- Bloquer TOUT accès internet via proxy local ou firewall
- Afficher un écran de blocage system-wide
- Seul moyen de débloquer : réactiver la protection

**Implémentation possible** :
- Tauri peut modifier les paramètres proxy système
- Ou utiliser pf (macOS) / iptables (Linux) / Windows Firewall

⚠️ **Mode optionnel** - Doit être explicitement activé par l'utilisateur

### Phase 4 — Intelligence
- [ ] Classification AI des queries ambiguës
- [ ] Apprentissage des patterns utilisateur
- [ ] Détection de contournement (VPN, autre navigateur)

### Phase 5 — Multi-platform
- [ ] Extension Firefox (WebExtensions API similaire)
- [ ] Extension Edge (basé sur Chromium, devrait fonctionner)
- [ ] Safari (nécessite rewrite avec Safari Web Extensions)

### Phase 6 — Reporting
- [ ] Dashboard des tentatives bloquées
- [ ] Patterns temporels (heures à risque)
- [ ] Intégration avec Aoi (coaching)
