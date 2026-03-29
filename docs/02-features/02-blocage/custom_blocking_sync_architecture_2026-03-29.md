# Custom Blocking Rules — Sync Architecture (Desktop → Extension)

**Date :** 2026-03-29

---

## 1. Principe

Les règles de blocage utilisateur sont créées dans l'app desktop (Boundaries → Blocking), stockées dans Supabase (`custom_blocking_rules`), et doivent être **poussées** vers l'extension Chrome pour bloquer effectivement les sites.

**Règle d'or :** les règles utilisateur sont **additives**. Elles ne remplacent jamais la blocklist système (`DEFAULT_BLOCKLIST`). L'extension ne peut jamais se retrouver sans protection : si la sync échoue, elle continue avec les dernières règles connues.

---

## 2. Flux de données

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Desktop UI  │────▶│   Supabase   │     │  ~/.clarity/    │     │  Chrome ext.    │
│  (React)     │     │  (durable)   │     │  custom-blocking│     │  chrome.storage │
│              │────────────────────────▶│  -rules.json    │────▶│  .local         │
└──────────────┘     └──────────────┘     └─────────────────┘     └─────────────────┘
       │                                         ▲                        ▲
       │                                         │                        │
       └── Tauri invoke ─────────────────────────┘                        │
                                                                          │
       ┌─────────────────┐                                                │
       │  Native Host    │── GET_CONFIG ──────── reads file ──── push ────┘
       │  (Rust, stdio)  │
       └─────────────────┘
```

### Étapes après chaque CRUD (create / update / delete)

1. Desktop UI appelle l'API Supabase (source of truth durable)
2. Desktop appelle `invoke('write_custom_rules_to_disk', { rules })` → écrit `~/.clarity/custom-blocking-rules.json`
3. L'extension Chrome poll `GET_CONFIG` toutes les **60 secondes** (`chrome.alarms`)
4. Le native host lit le fichier JSON et renvoie `CONFIG_UPDATE` avec :
   - `customRules` : `BlockRule[]` mappées depuis les URL rules
   - `customSearchKeywords` : `string[]` extraites des search rules
5. L'extension écrit dans `chrome.storage.local` :
   - `customBlockingRules` : les `BlockRule[]` (vérifiées par `shouldBlock`)
   - `customSearchKeywords` : les mots-clés (vérifiés dans le handler de navigation)
6. `shouldBlock()` merge `rules` (defaults) + `customBlockingRules` (user) = blocage effectif

### Cold start

Au démarrage de l'extension (`onStartup` + `onInstalled`), `GET_CONFIG` est envoyé. Le native host lit le fichier et renvoie les règles custom. L'extension les stocke immédiatement.

---

## 3. Mapping Supabase → Extension

| `rule_type` | `match_mode` | Pattern(s) extension | Clé storage |
|---|---|---|---|
| `url_contains` | `contains` | `*://*{value}*` | `customBlockingRules` |
| `url_contains` | `host_is` | `*://{value}/*` + `*://*.{value}/*` | `customBlockingRules` |
| `search_contains` | `contains` | — (pas de pattern URL) | `customSearchKeywords` |

Seules les règles `is_active: true` sont envoyées.

---

## 4. Sécurité

- **Merge, jamais replace** : `handleConfigUpdate` ne touche plus `rules` (defaults). Il écrit uniquement `customBlockingRules` et `customSearchKeywords`.
- **Jamais vide** : si le fichier disk est absent ou corrompu, le native host renvoie `customRules: []` + `customSearchKeywords: []` → l'extension garde les anciens custom rules en storage.
- **Additif** : `shouldBlock` vérifie les defaults **puis** les custom rules. Un custom rule ne peut pas "dé-bloquer" un site bloqué par le système.
- **Extension autonome** : si le desktop est éteint, l'extension fonctionne toujours avec les dernières règles en `chrome.storage.local`.

---

## 5. Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `apps/desktop/src-tauri/src/custom_rules_file.rs` | **NEW** — Lecture/écriture `~/.clarity/custom-blocking-rules.json` + Tauri command |
| `apps/desktop/src-tauri/src/native_host.rs` | `GET_CONFIG` lit le fichier, mappe les règles, envoie `customRules` + `customSearchKeywords` |
| `apps/desktop/src-tauri/src/lib.rs` | Enregistre `write_custom_rules_to_disk` |
| `apps/desktop/src/features/boundaries/hooks/useCustomBlockingRules.ts` | Appelle `invoke` après chaque mutation (create/update/delete/batch) |
| `apps/extension/src/background/native-messaging.ts` | `handleConfigUpdate` stocke custom rules, ne touche plus `rules` defaults |
| `apps/extension/src/background/service-worker.ts` | `shouldBlock` merge defaults + custom, check search keywords, alarm 60s poll |
| `apps/extension/src/shared/constants.ts` | Nouvelles clés storage : `CUSTOM_BLOCKING_RULES`, `CUSTOM_SEARCH_KEYWORDS` |

---

## 6. Latence & résilience

| Scénario | Latence max | Mécanisme |
|----------|-------------|-----------|
| CRUD normal | ~60s | Alarm poll |
| Cold start extension | <5s | `GET_CONFIG` envoyé sur `connectToDesktopApp()` |
| Desktop fermé | 0 impact | Extension garde les dernières rules en `chrome.storage.local` |
| Fichier disk corrompu | 0 impact | Native host renvoie `[]`, extension garde les anciennes rules |
| Supabase down | 0 impact | CRUD échoue dans l'UI mais les rules déjà sur disk restent valides |

---

## 7. Évolutions futures

- **Push immédiat** : le desktop pourrait signaler un changement au native host via un fichier sémaphore ou un socket Unix, pour déclencher un CONFIG_UPDATE instantané sans attendre le prochain poll.
- **Supabase Realtime** : l'extension pourrait écouter les changements via un canal Realtime (nécessite auth extension).
- **Stats par règle** : compteurs de blocage par `custom_blocking_rules.id`.
