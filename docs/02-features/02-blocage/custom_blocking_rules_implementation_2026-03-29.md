# Custom blocking rules — implémentation (desktop + Supabase)

**Last update:** 2026-03-29 (dépannage Supabase / Chrome + bandeau UI)

Document de référence pour tout ce qui a été livré sur les **règles de blocage utilisateur** (URL + mots-clés recherche), en complément de la spec UX [`boundaries_blocking_rules_ux_2026-03-29.md`](./boundaries_blocking_rules_ux_2026-03-29.md).

---

## 1. Résumé produit

- L’utilisateur gère des règles **Block by URL** (`url_contains`) et **Block by search keyword** (`search_contains`) depuis l’app desktop, onglet **Boundaries → Blocking**.
- Persistance **Supabase** (`custom_blocking_rules`). **Sync vers l’extension Chrome** : fichier local `~/.clarity/custom-blocking-rules.json` + native messaging `GET_CONFIG` → `customRules` / `customSearchKeywords` (voir [`custom_blocking_sync_architecture_2026-03-29.md`](./custom_blocking_sync_architecture_2026-03-29.md)).

---

## 2. Schéma base de données

**Table :** `custom_blocking_rules`

| Colonne | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | FK `auth.users` |
| `rule_type` | text | `url_contains` \| `search_contains` |
| `value` | text | Chaîne à matcher (contains, insensible à la casse côté produit) |
| `match_mode` | text | `contains` (défaut) \| `host_is` (prévu) |
| `note` | text | Optionnel (« pourquoi ») |
| `commitment_level` | text | `flexible` \| `committed` \| `locked` |
| `locked_until` | timestamptz | Si `locked`, verrou jusqu’à cette date |
| `is_active` | boolean | Règle activée ou non |
| `created_at` / `updated_at` | timestamptz | Audit |

**RLS :** lecture / insert / update / delete limités à `auth.uid() = user_id`.

**Trigger :** `update_custom_blocking_rules_updated_at()` met à jour `updated_at` avant chaque UPDATE (défini dans la migration, **sans** dépendre de `update_boundaries_updated_at` sur `boundaries`).

---

## 3. Migrations Supabase

| Fichier | Rôle |
|---------|------|
| `supabase/migrations/016_custom_blocking_rules.sql` | Création table, policies, fonction trigger dédiée, trigger `custom_blocking_rules_updated_at`. |
| `supabase/migrations/017_custom_blocking_rules_trigger_fix.sql` | Réparation idempotente si une ancienne 016 avait échoué au trigger alors que la table existait déjà. |

Ordre d’application : **016 puis 017** (CLI / dashboard). Les deux peuvent être rejoués sur une base saine sans casser la logique (017 refait surtout DROP/CREATE du trigger).

---

## 4. Types partagés

**Package :** `packages/shared`

- Fichier : `src/types/customBlockingRule.ts`
- Export : `CustomBlockingRule`, `CustomBlockingRuleType`, `CustomBlockingMatchMode`, `CommitmentLevel`
- Réexport dans `packages/shared/src/index.ts`

---

## 5. App desktop — fichiers

| Chemin | Rôle |
|--------|------|
| `apps/desktop/src/features/boundaries/api/customBlockingRules.ts` | CRUD Supabase + batch (presets) ; `normalizeUrlBlockingValue()` enlève `https://`, `http://`, `www.` |
| `apps/desktop/src/features/boundaries/hooks/useCustomBlockingRules.ts` | État, `lastSyncedAt`, optimistic update |
| `apps/desktop/src/features/boundaries/components/BlockingTab.tsx` | UI onglet Blocking : **barre d’ajout inline** (segment URL \| Search + champ + **Add**), filtre tableau discret à droite, **table unique**, presets en ligne |
| `apps/desktop/src/features/boundaries/components/BlockingTab.css` | Styles |
| `apps/desktop/src/features/boundaries/components/BoundariesView.tsx` | Onglets **System Health \| Habits \| Blocking**, header + tabs sous le titre |
| `apps/desktop/src/features/boundaries/components/BoundariesView.css` | Layout large + onglets |
| `apps/desktop/src/features/boundaries/index.ts` | Exports publics |
| `apps/desktop/src-tauri/src/custom_rules_file.rs` | Écriture / lecture `~/.clarity/custom-blocking-rules.json`, mapping vers payloads extension |
| `apps/desktop/src-tauri/src/native_host.rs` | `GET_CONFIG` → `ConfigUpdate` avec `customRules` + `customSearchKeywords` |
| `apps/desktop/src-tauri/src/lib.rs` | Commande Tauri `write_custom_rules_to_disk` |
| `apps/extension/src/background/native-messaging.ts` | `handleConfigUpdate` ne remplace plus la blocklist par défaut ; poll `GET_CONFIG` ~60s |
| `apps/extension/src/background/service-worker.ts` | `shouldBlock` : merge `rules` + `customBlockingRules` ; mots-clés recherche custom |

**Comportement engagement (v1) :**

- **Flexible** : toggle / suppression immédiats (avec confirm simple pour delete).
- **Committed** : confirmation supplémentaire avant désactivation ou suppression.
- **Locked** : `locked_until` renseigné (ex. +7 jours) ; toggle/delete désactivés tant que la date n’est pas passée.

**Presets :** `BLOCKING_PRESETS` dans `BlockingTab.tsx` (Social, Short video, Shopping) — insert batch `url_contains`, doublons ignorés (même valeur insensible à la casse).

**Validation :** longueur minimale du critère **3 caractères** (UI + logique preset).

---

## 6. Layout large (Boundaries)

- `BoundariesView.css` : zone de contenu élargie (`max-width: min(1600px, 100%)`, padding horizontal réduit sur mobile, un peu plus large ≥900px) pour éviter la « colonne étroite » au centre sur l’onglet Blocking et le reste de Boundaries.

---

## 7. UX Boundaries (navigation)

- **System Health** : `ProtectionAlert` + grille Extension / Incognito / SafeSearch / Search Filter.
- **Habits** : « My Rules » (table `boundaries` existante).
- **Blocking** : règles `custom_blocking_rules`.

Onglets placés **directement sous le titre** « Boundaries » (`boundaries-view__header-block`). Onglet par défaut : **System Health**.

---

## 8. Dépannage

### Table `custom_blocking_rules` vide dans le dashboard

1. **Pas de `.env` à la racine du repo** — Seul **`apps/desktop/.env.local`** est lu par Vite (voir `apps/desktop/.env.example`). À la racine `oneway/`, il n’y a en général **pas** de fichier d’env pour le desktop.
2. **Mauvais projet Supabase** — Sans `.env.local`, l’app utilise les URLs par défaut dans **`packages/shared/src/constants.ts`**. Il faut ouvrir le dashboard du **même** projet (même ref dans l’URL `https://<ref>.supabase.co`). Si tu regardes un autre projet, la table semble toujours vide.
3. **Mauvaise table** — Les anciennes migrations ont une table legacy `blocking_rules` ; la feature Boundaries Blocking utilise **`custom_blocking_rules`**.
4. **Migrations non appliquées** — Exécuter **`016_custom_blocking_rules.sql`** puis **`017_...`** sur ce projet (CLI ou SQL Editor). Sinon l’insert échoue (`relation does not exist`).
5. **Erreur silencieuse** — Si l’insert échoue (RLS, clé, etc.), un message peut apparaître dans la modale ou la bannière d’erreur de l’onglet Blocking.

### Chrome ne bloque pas `hello.com` alors que la règle existe

1. **Règle URL** : ajoute `hello.com` en **URL rule** (`url_contains`), pas seulement en mot-clé recherche.
2. **Desktop + extension** : Clarity doit avoir écrit `~/.clarity/custom-blocking-rules.json` (voir la console après un changement dans Blocking). L’extension doit être connectée au native host (`GET_CONFIG`). Un poll ~60s recharge la config ; reconnexion immédiate au redémarrage de l’extension.
3. **Supabase OK mais fichier absent** : vérifie que `invoke('write_custom_rules_to_disk')` s’exécute (app desktop Tauri, pas le navigateur).

**Types de règles :** une règle **Search** (`search_contains`) filtre les **requêtes** sur les moteurs reconnus, pas la navigation vers un domaine. Pour bloquer l’ouverture de `https://hello.com/`, il faut une règle **URL** (`url_contains`) avec par ex. `hello.com`.

---

## 9. Non fait / dette technique

- **Push instantané** : pas d’IPC desktop → native host hors fichier ; latence max ~60s + reconnect.
- **Stats par règle** (nombre de blocages) : non branchées sur cette table en v1.
- **Redirect-aware** : documenté en spec ; implémentation service worker à aligner dans un ticket dédié.

---

## 10. Historique des commits (référence git)

- `feat(desktop): Boundaries Blocking tab + custom_blocking_rules Supabase`
- `fix(boundaries): 3 tabs under header + self-contained custom_blocking_rules trigger`
- Éventuels suivants : doc + refonte UI table / recherche (voir message de commit associé).

---

## 11. Liens

- Spec UX : [`boundaries_blocking_rules_ux_2026-03-29.md`](./boundaries_blocking_rules_ux_2026-03-29.md)
- Blocage extension : [`overview.md`](./overview.md), [`implementation.md`](./implementation.md)
