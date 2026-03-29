# Custom blocking rules — implémentation (desktop + Supabase)

**Last update:** 2026-03-29

Document de référence pour tout ce qui a été livré sur les **règles de blocage utilisateur** (URL + mots-clés recherche), en complément de la spec UX [`boundaries_blocking_rules_ux_2026-03-29.md`](./boundaries_blocking_rules_ux_2026-03-29.md).

---

## 1. Résumé produit

- L’utilisateur gère des règles **Block by URL** (`url_contains`) et **Block by search keyword** (`search_contains`) depuis l’app desktop, onglet **Boundaries → Blocking**.
- Persistance **Supabase** (`custom_blocking_rules`). **Sync vers l’extension Chrome** : pas encore branchée sur le pipeline natif / `GetConfig` (voir §7).

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
| `apps/desktop/src/features/boundaries/api/customBlockingRules.ts` | CRUD Supabase + batch create (presets) |
| `apps/desktop/src/features/boundaries/hooks/useCustomBlockingRules.ts` | État, `lastSyncedAt`, optimistic update |
| `apps/desktop/src/features/boundaries/components/BlockingTab.tsx` | UI onglet Blocking : **table unique** (Type, critère, match, note, engagement, actif, actions), **barre de recherche** sur tout le texte (critère, note, type, engagement), boutons **+ URL rule** / **+ Search rule**, presets en ligne |
| `apps/desktop/src/features/boundaries/components/BlockingTab.css` | Styles |
| `apps/desktop/src/features/boundaries/components/AddCustomBlockingRuleModal.tsx` | Modal création (critère, note, engagement, lock 7 jours) |
| `apps/desktop/src/features/boundaries/components/BoundariesView.tsx` | Onglets **System Health \| Habits \| Blocking**, header + tabs sous le titre |
| `apps/desktop/src/features/boundaries/components/BoundariesView.css` | Layout large + onglets |
| `apps/desktop/src/features/boundaries/index.ts` | Exports publics |

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

## 8. Non fait / dette technique

- **Extension Chrome :** les règles ne sont pas encore fusionnées dans `chrome.storage.local` / `shouldBlock` via le native host (`GetConfig` encore partiellement stub côté Rust à l’époque de l’implémentation).
- **Stats par règle** (nombre de blocages) : non branchées sur cette table en v1.
- **Redirect-aware** : documenté en spec ; implémentation service worker à aligner dans un ticket dédié.

---

## 9. Historique des commits (référence git)

- `feat(desktop): Boundaries Blocking tab + custom_blocking_rules Supabase`
- `fix(boundaries): 3 tabs under header + self-contained custom_blocking_rules trigger`
- Éventuels suivants : doc + refonte UI table / recherche (voir message de commit associé).

---

## 10. Liens

- Spec UX : [`boundaries_blocking_rules_ux_2026-03-29.md`](./boundaries_blocking_rules_ux_2026-03-29.md)
- Blocage extension : [`overview.md`](./overview.md), [`implementation.md`](./implementation.md)
