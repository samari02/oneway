# Extension Debug Log

Documentation des problèmes rencontrés et solutions testées.

---

## 🐛 Problème #1 : Bypass ne fonctionne pas

**Date:** 2026-01-11

### Symptômes

- Sites sont bien bloqués ✅
- Block screen s'affiche correctement ✅
- User sélectionne une option de bypass
- User clique "Continue"
- **Le site reste bloqué (re-redirige vers block screen)** ❌

### Comportement attendu

1. User clique "Continue" après avoir sélectionné un bypass
2. Le domaine est ajouté au cache comme "allow"
3. La navigation vers l'URL originale est autorisée
4. Le site charge normalement

### Investigation

#### Tentative #1 : Fix du cache storage

**Code modifié :** `service-worker.ts` - fonction `handleBypass()`

```typescript
// Avant
cache[extractDomain(data.url)] = 'allow'
await chrome.storage.local.set({ cache })

// Après
const domain = extractDomain(data.url)
cache[domain] = 'allow'
await chrome.storage.local.set({ [STORAGE_KEYS.CACHE]: cache })
```

**Résultat :** ❌ Ne fonctionne toujours pas

**Logs observés :**
```
[Service Worker] Message received: {type: "BYPASS_BLOCK", data: {...}}
[Service Worker] Bypass requested: {url: "...", method: "break"}
[Service Worker] Domain allowed temporarily: twitter.com
[Service Worker] Block event logged: {...}
```

Le cache semble bien être mis à jour, mais la navigation est quand même bloquée.

---

### Hypothèse #1 : Race condition

**Problème identifié :**
1. User clique "Continue"
2. Service worker met le cache à jour
3. `block-screen.ts` fait `window.location.href = blockedUrl`
4. Cette navigation déclenche `webNavigation.onBeforeNavigate`
5. Le service worker check le cache...
6. **MAIS** : Le cache est peut-être pas encore écrit, ou la navigation est interceptée avant que le cache soit vérifié

**Solution proposée :** Attendre que le cache soit écrit avant de naviguer

---

### Hypothèse #2 : Vérification du cache trop tard

**Analyse du flow actuel :**

```
webNavigation.onBeforeNavigate
  ↓
shouldBlock() vérifie le cache
  ↓
Si match dans DEFAULT_BLOCKLIST → block immédiatement
  ↓
Cache jamais vérifié pour les sites dans la blocklist
```

**Code actuel problématique :**

```typescript
// Check rules
const rules = storage.rules || DEFAULT_BLOCKLIST

for (const rule of rules) {
  if (matchesPattern(url, rule.pattern)) {
    if (rule.action === 'block') {
      return { shouldBlock: true, reason: rule.reason }
    }
  }
}
```

Le cache est vérifié AVANT les rules, mais si le domaine match un pattern de rule, on block sans re-vérifier le cache !

---

### Hypothèse #3 : `window.location.href` ne respecte pas le cache

Le problème : quand on fait `window.location.href = blockedUrl` depuis la page de block, c'est une nouvelle navigation qui re-déclenche tout le flow.

**Solutions possibles :**

1. **Temporary whitelist avec timestamp** : Au lieu d'un simple cache, stocker un timestamp d'expiration
2. **Query parameter** : Ajouter `?bypass=token` à l'URL pour signaler que c'est un bypass
3. **Tab-specific allowlist** : Tracker les tabs autorisés
4. **Redirect via chrome.tabs.update()** : Utiliser l'API Chrome au lieu de window.location

---

## Prochaines tentatives

### Option A : Tab-specific allowlist (recommandée)

```typescript
// Storage structure
{
  allowedTabs: {
    [tabId]: {
      domain: string,
      expiresAt: number,
      bypassMethod: string
    }
  }
}

// Dans handleBypass
allowedTabs[currentTabId] = {
  domain: extractDomain(url),
  expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
  bypassMethod: method
}

// Dans shouldBlock
if (allowedTabs[tabId] && allowedTabs[tabId].domain === currentDomain) {
  if (allowedTabs[tabId].expiresAt > Date.now()) {
    return { shouldBlock: false }
  }
}
```

### Option B : Message-based approach

Au lieu de faire `window.location.href`, envoyer un message au service worker pour qu'il fasse la navigation :

```typescript
// block-screen.ts
chrome.runtime.sendMessage({
  type: 'NAVIGATE_WITH_BYPASS',
  data: { url: blockedUrl, tabId: currentTabId }
})

// service-worker.ts
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'NAVIGATE_WITH_BYPASS') {
    // Mark tab as allowed
    // Then navigate
    chrome.tabs.update(message.data.tabId, { url: message.data.url })
  }
})
```

### Option C : Whitelist temporaire avec cleanup

```typescript
// Stocker une whitelist temporaire en mémoire (dans le service worker)
const temporaryWhitelist = new Map<string, number>() // domain -> expiresAt

// Cleanup automatique
setInterval(() => {
  const now = Date.now()
  for (const [domain, expiresAt] of temporaryWhitelist.entries()) {
    if (expiresAt < now) {
      temporaryWhitelist.delete(domain)
    }
  }
}, 60000) // Check every minute
```

---

## Notes techniques

### Service Worker lifecycle

- Service workers peuvent être killed par Chrome à tout moment
- Les variables en mémoire ne persistent pas
- Il faut utiliser chrome.storage pour la persistence
- chrome.storage.local est asynchrone

### webNavigation timing

`onBeforeNavigate` se déclenche AVANT que la requête soit envoyée, donc c'est le bon moment pour bloquer, mais on ne peut pas rediriger facilement sans causer une loop.

### Tab ID

On peut récupérer le tab ID dans `onBeforeNavigate` via `details.tabId`. Il faut passer ce tab ID au block screen pour pouvoir faire un allowlist par tab.

---

## Status actuel

- ❌ Bypass ne fonctionne pas (avant fix)
- ✅ Block fonctionne
- ✅ Block screen s'affiche
- ✅ Logs sont corrects
- 🔄 **Fix implémenté - à tester**

---

## ✅ Tentative #2 : Tab-specific allowlist (IMPLÉMENTÉE)

**Date:** 2026-01-11

### Changements apportés

#### 1. Passer le `tabId` partout

**`service-worker.ts` - `webNavigation.onBeforeNavigate`**
```typescript
// Ajouter tabId dans l'URL du block screen
const blockUrl = `${BLOCK_SCREEN_URL}?url=${encodeURIComponent(event.url)}&reason=${encodeURIComponent(decision.reason || '')}&tabId=${details.tabId}`

// Passer tabId à shouldBlock
const decision = await shouldBlock(event.url, details.tabId)
```

**`block-screen.ts`**
```typescript
// Parser le tabId des query params
const tabId = parseInt(params.get('tabId') || '0')

// L'envoyer avec le bypass request
chrome.runtime.sendMessage({
  type: 'BYPASS_BLOCK',
  data: {
    url: blockedUrl,
    method: selectedReason,
    tabId: tabId  // ← Nouveau
  }
})
```

#### 2. Nouvelle logique de allowlist par tab

**Structure de données :**
```typescript
{
  allowedTabs: {
    [tabId: number]: {
      domain: string,
      expiresAt: number
    }
  }
}
```

**`shouldBlock()` - Check l'allowlist EN PREMIER**
```typescript
async function shouldBlock(url: string, tabId: number) {
  // ...
  
  // Check tab-specific allowlist AVANT les rules
  if (storage.allowedTabs && storage.allowedTabs[tabId]) {
    const allowed = storage.allowedTabs[tabId]
    if (allowed.domain === domain && allowed.expiresAt > Date.now()) {
      log('Tab', tabId, 'is allowed for', domain)
      return { shouldBlock: false }  // ← Bypass les rules !
    }
  }
  
  // Ensuite check les rules...
}
```

**`handleBypass()` - Enregistrer le tab**
```typescript
async function handleBypass(data: { url: string; method: string; tabId: number }) {
  const domain = extractDomain(data.url)
  
  // Créer l'entrée allowlist pour ce tab
  const expiresAt = Date.now() + (5 * 60 * 1000) // 5 minutes
  allowedTabs[data.tabId] = {
    domain,
    expiresAt
  }
  
  await chrome.storage.local.set({ allowedTabs })
  // ...
}
```

#### 3. Meilleurs logs

```typescript
log('Tab', tabId, 'allowed for', domain, 'until', new Date(expiresAt).toLocaleTimeString())
console.log('[Block Screen] Bypass approved, navigating to', blockedUrl)
```

### Pourquoi ça devrait marcher maintenant

**Flow complet :**

1. User navigue vers `twitter.com` (tab 123)
2. `onBeforeNavigate` déclenché avec `tabId: 123`
3. `shouldBlock(url, 123)` vérifie :
   - `allowedTabs[123]` existe ? → NON
   - Rules match ? → OUI → BLOCK
4. Redirect vers `block-screen.html?url=...&tabId=123`
5. User sélectionne bypass et clique Continue
6. Message envoyé : `{type: 'BYPASS_BLOCK', data: {tabId: 123, url, method}}`
7. `handleBypass()` enregistre : `allowedTabs[123] = {domain: 'twitter.com', expiresAt: ...}`
8. Block screen fait `window.location.href = blockedUrl`
9. **Nouvelle navigation** vers `twitter.com` (même tab 123)
10. `onBeforeNavigate` re-déclenché avec `tabId: 123`
11. `shouldBlock(url, 123)` vérifie :
    - `allowedTabs[123]` existe ? → **OUI !**
    - Domain match ? → **OUI !**
    - Expiré ? → **NON** (5 min)
    - **→ return false (NE PAS BLOQUER) ✅**
12. Twitter charge normalement !

### Avantages de cette approche

✅ **Tab-specific** : Si tu ouvres Twitter dans un autre tab, il sera toujours bloqué  
✅ **Time-limited** : Expire après 5 minutes automatiquement  
✅ **Persiste dans storage** : Survit aux reloads du service worker  
✅ **Pas de race condition** : Le check se fait de manière synchrone  

### Testing

Pour tester :
1. Recharger l'extension dans `chrome://extensions/`
2. Aller sur `twitter.com`
3. Block screen s'affiche
4. Sélectionner "Quick break"
5. Cliquer Continue
6. **→ Devrait charger Twitter ! 🎯**
7. Ouvrir la console du service worker et vérifier les logs :
   ```
   [Oneway] Tab 123 allowed for twitter.com until 15:45:30
   [Oneway] Navigation detected: twitter.com on tab 123
   [Oneway] Tab 123 is allowed for twitter.com until 15:45:30
   ```

### Cleanup automatique (TODO)

Pour l'instant, les entries expirent naturellement (on check `expiresAt`), mais on pourrait ajouter un cleanup périodique :

```typescript
// Dans service-worker.ts, au top-level
chrome.alarms.create('cleanupAllowedTabs', { periodInMinutes: 5 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanupAllowedTabs') {
    const storage = await chrome.storage.local.get('allowedTabs')
    const allowedTabs = storage.allowedTabs || {}
    
    const now = Date.now()
    const cleaned = Object.fromEntries(
      Object.entries(allowedTabs).filter(([_, data]) => data.expiresAt > now)
    )
    
    await chrome.storage.local.set({ allowedTabs: cleaned })
  }
})
```

---

## Prochaine étape

**Si ça marche :**
- ✅ Commit et push
- ✅ Update changelog
- → Passer à Phase 1 : History collection

**Si ça marche toujours pas :**
- Debug avec les logs du service worker
- Vérifier que `tabId` est bien passé
- Vérifier que `allowedTabs` est bien enregistré dans storage
