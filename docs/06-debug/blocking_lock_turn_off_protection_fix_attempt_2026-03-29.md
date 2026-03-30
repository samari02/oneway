# Debug — « Turn off protection » (blocking list lock)

**Last update:** 2026-03-29

---

## 1. Symptôme produit

- Dans l’app desktop **Clarity** (Tauri), onglet **Boundaries** / bloc **blocking list lock**, l’action **« Turn off protection »** ne retire pas le verrou comme attendu (ou échoue sans retour utilisateur clair).
- Le flux attendu : après **unlock** (mot de passe ou challenge friction), l’utilisateur peut supprimer `~/.clarity/blocking-lock.json` via cette action.
- **Observation :** le problème a été signalé **après** plusieurs itérations UI (alignement sur `canManageDestructive`, `refresh` avant clear, messages d’erreur Tauri). **La dernière tentative décrite ci‑dessous n’a pas été validée comme résolue** par le produit au moment de la rédaction.

---

## 2. Chaîne technique (rappel)

| Couche | Rôle |
|--------|------|
| Rust `blocking_lock.rs` | Fichier `~/.clarity/blocking-lock.json`, hash Argon2, session d’unlock **en mémoire** (`UNLOCK_UNTIL_MS`), commandes Tauri `blocking_lock_*`. |
| `blocking_lock_clear` | Supprime le fichier si session valide, ou (mode mot de passe) si un **mot de passe** est fourni et vérifie le hash. |
| React `useBlockingLock` + `BlockingLockPanel` | `invoke` des commandes, état « Managing », bouton **Turn off protection**. |

Tester **uniquement** dans la fenêtre **Tauri** (`pnpm dev`). Un onglet navigateur sur `http://localhost:1420` **sans** shell Tauri ne peut pas exécuter `invoke` correctement.

---

## 3. Hypothèses déjà explorées (non exhaustif)

1. **Décalage UI / backend** : l’état « déverrouillé » était dérivé de `Date.now() < unlockedUntilMs` alors que Rust utilisait `now_ms() < until` → risque d’afficher **Managing** alors que la session Rust est déjà expirée.
2. **Sérialisation du statut** : clés **camelCase** vs **snake_case** dans la réponse `blocking_lock_get_status` → champs `canManageDestructive` / `hasLock` **absents** côté JS si non normalisés.
3. **`unlock_duration_secs` à 0** dans le JSON : session d’une durée nulle, comportement erratique.
4. **Port 1420 déjà pris** : ancien `pnpm dev` / Vite → échec au démarrage ; pas le même bug que le clear, mais bloque les tests.

---

## 4. Tentative de correctif (2026-03-29) — état

**Objectif :** rendre **Turn off** fiable en session **ou** avec **mot de passe** (mode password), normaliser le statut, éviter une durée de session nulle.

| Zone | Changement |
|------|------------|
| `blocking_lock.rs` | `clear_lock_file(current_password: Option<&str>)` : si session active → suppression ; sinon mode **password** + mot de passe correct → suppression ; mode **friction** → erreur explicite (déverrouiller via challenge d’abord). `finish_clear_lock_file` factorisé. **`start_unlock_session`** : `unlock_duration_secs` clampé avec **`max(1)`** seconde. |
| `lib.rs` | `blocking_lock_clear(password: Option<String>)` passé au Rust. |
| `useBlockingLock.ts` | **`normalizeBlockingLockStatus`** (camelCase + snake_case, nombres typés). **`clearLock(password?)`** : `invoke('blocking_lock_clear', { password })` puis `refresh()` (plus de `refresh` avant clear). |
| `BlockingLockPanel.tsx` | En échec avec message type « unlock first » en mode **password** → **`window.prompt`** pour retenter avec le mot de passe. |
| `docs/02-features/03-blocking-list-lock/README.md` | Section troubleshooting mise à jour. |

**Résultat au moment de la rédaction :** le correctif **n’a pas été confirmé** comme suffisant par le test produit (« ça ne marche toujours pas »). Ce document sert de **point de reprise** pour la prochaine investigation (logs `invoke`, contenu réel de `~/.clarity/blocking-lock.json`, confirmation que l’action est bien déclenchée dans la webview Tauri, pas dans le navigateur seul).

---

## 5. Pistes suivantes (checklist)

- [ ] Reproduire **uniquement** avec la fenêtre ouverte par **`pnpm dev`** (pas Chrome sur `:1420`).
- [ ] Après clic sur **Turn off**, vérifier la **console** (DevTools Tauri) pour erreur `invoke` ou message Rust exact.
- [ ] Vérifier **`~/.clarity/blocking-lock.json`** : `unlock_duration_secs`, `lock_kind`, intégrité du fichier.
- [ ] Confirmer que **`blocking_lock_clear`** est bien autorisé par les **capabilities** Tauri (si un jour les commandes custom sont restreintes explicitement).
- [ ] Si le symptôme est « rien ne se passe » **sans** alerte : vérifier que `handleTurnOffProtection` n’est pas court-circuité (`confirm` annulé, `busy`, etc.).

---

## 6. Fichiers concernés (référence rapide)

- `apps/desktop/src-tauri/src/blocking_lock.rs`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src/features/boundaries/hooks/useBlockingLock.ts`
- `apps/desktop/src/features/boundaries/components/BlockingLockPanel.tsx`
- Doc feature : `docs/02-features/03-blocking-list-lock/README.md`
