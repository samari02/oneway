# UX — Règles de blocage utilisateur (Boundaries + Supabase)

**Last update:** 2026-03-29

**Statut:** spécification UX uniquement — pas d’implémentation validée.

---

## 1. Objectif

Permettre à l’utilisateur de **définir ses propres règles** de blocage depuis **l’app desktop**, avec persistance **Supabase** (compte utilisateur), puis application côté **extension Chrome** (sync + évaluation dans le service worker). Le **contrat de sync** desktop ↔ extension est **dans le périmètre produit** de cette spec (détail technique dans un ticket / doc d’implémentation séparé).

Deux familles de règles, claires et distinctes :

| Famille | Portée | Exemple mental |
|--------|--------|----------------|
| **Blocage par URL** | Pages / navigations dont l’URL correspond au critère | « Toute URL qui **contient** `reddit.com` » |
| **Blocage par mot-clé (recherche)** | Requêtes de moteur de recherche dont le texte correspond | « Toute recherche qui **contient** `gossip` » |

---

## 2. Emplacement dans l’app

**Écran :** vue **Boundaries** (sidebar existante).

**Problème :** aujourd’hui « Boundaries » mélange **santé système** (extension, protection) et **habitudes / règles métier** (« My Rules »). Ajouter une longue page sans structure risque la surcharge.

**Proposition UX : sous-navigation par onglets** sous le titre principal `Boundaries` :

| Onglet | Contenu |
|--------|---------|
| **Habits** (ou garder le libellé actuel du bloc « My Rules ») | Ce qui existe : règles d’habitudes, actives / en pause. |
| **Blocking** | Nouveau : règles de blocage URL + mots-clés recherche, listées, éditables, sync Supabase. |

**Libellés possibles pour l’onglet 2 :** `Blocking` · `Block list` · `Protection rules` — à trancher (court, anglais cohérent avec le reste de l’app si l’UI est en anglais).

**Alternative (moins recommandée) :** une seule page scroll avec une **section pliable** « Custom blocking » — moins visible qu’un onglet dédié.

---

## 3. Contenu de l’onglet « Blocking »

### 3.1 En-tête

- **Titre de section :** ex. « Your blocking rules »
- **Sous-texte une ligne :** « These rules apply in Chrome when the Clarity extension is active. They sync to your account. »
- **État de sync (obligatoire v1) :** « Last synced: … » / icône chargement si sync en cours — évite la confusion « j’ai ajouté mais rien ne se passe ». Sans indicateur clair, la feature paraît décorative tant que la sync n’est pas fiable.

### 3.2 Presets / Quick add (recommandé v1)

Pour réduire la friction et guider les usages courants :

- Bloc **« Quick add »** ou **presets** par catégories (cases à cocher ou boutons) : ex. **Social** (reddit.com, x.com, instagram.com, tiktok.com, facebook.com…), **Video** (segments type `/shorts`, plateformes listées), **News / scroll**, **Shopping**, etc.
- L’utilisateur valide → plusieurs règles `url_contains` (ou équivalent) sont créées d’un coup.
- **But :** aller plus vite que taper chaque URL, et suggérer des sites que l’utilisateur n’aurait pas pensé à bloquer.

### 3.3 Deux blocs (ou sous-onglets)

**Option A — deux cartes empilées (recommandé pour la lisibilité)**

1. **Block by URL**  
   - Sous-titre : « Block pages whose address matches… »
   - Liste des règles + bouton **Add rule**.

2. **Block by search keyword**  
   - Sous-titre : « Block search queries (Google, etc.) that contain… »
   - Liste + **Add rule**.

**Option B — sous-onglets internes** `URLs` | `Searches` — utile si les listes deviennent très longues.

### 3.4 Une ligne de règle (liste)

Chaque règle affiche au minimum :

- **Critère** (texte saisi par l’utilisateur), ex. `reddit.com` ou `shopping`
- **Mode de correspondance** (voir §4), affiché en chip ou label : e.g. « Contains »
- **Pourquoi / note (v1)** — champ texte optionnel mais fortement recommandé en UI : rappel au moment de la tentation (« J’ai bloqué Reddit parce que… »). Nudge comportemental ; pas repoussé en v2.
- **Engagement / commitment** (voir §9) — badge ou libellé selon le niveau choisi (Flexible / Committed / Locked)
- **Actif / désactivé** (toggle) — le comportement exact dépend du niveau d’engagement (délai, confirmation différée, etc.)
- **Supprimer** — idem ; friction selon engagement
- **Stats (v1.1 recommandé)** — ex. « Blocked N times this week » par règle, pour montrer que l’outil protège réellement (aligné sur les compteurs déjà possibles côté extension pour les recherches bloquées)

### 3.5 Preview / test de règle (v1.1)

Dans le flux **Add rule** (modal ou inline) :

- Petit champ **« Test »** : l’utilisateur colle une URL (ou une query pour search) → l’UI indique **Would block** / **Would not block** selon la règle en cours de définition.
- **But :** éviter les faux positifs (ex. `contains 'go'` qui toucherait `google.com`) et rassurer avant sauvegarde.

---

## 4. Sémantique des correspondances (à figer avant dev)

### 4.1 Règles URL

| Mode (libellé UI) | Comportement (à spécifier en prod) |
|-------------------|-------------------------------------|
| **Contains** (défaut proposé) | La navigation est bloquée si l’URL **entière** (ou host + path) **contient** la chaîne, insensible à la casse recommandé. |
| **Host is** (option avancée) | Équivalent « domaine exact » ou host normalisé — à définir (évite les faux positifs sur des sous-chaînes trop courtes). |

**Exemples à montrer dans un tooltip ou aide :**

- Contains `reddit.com` → bloque `https://www.reddit.com/r/...`
- Contains `/shorts` → bloque toute URL avec ce segment de chemin (YouTube Shorts, etc.)

**Risque :** « Contains » avec une chaîne trop courte (`e`, `a`) → trop de collisions. **Validation côté UI :** longueur minimale (ex. 3 caractères) ou avertissement.

**Redirects / raccourcisseurs (obligatoire produit) :** les navigations passent par la **même logique** que le reste de l’extension (ex. résolution `extractRedirectDestination` / équivalent dans le service worker). Sinon un `bit.ly/...` qui redirige vers un site bloqué pourrait contourner une règle « contains reddit.com » sur l’URL visible initialement. À documenter côté implémentation pour que l’évaluation des règles utilisateur soit **redirect-aware** là où le pipeline existant l’est déjà.

### 4.2 Règles « search keyword »

| Mode (libellé UI) | Comportement |
|-------------------|--------------|
| **Contains** (défaut) | Sur les URLs de **moteur de recherche** reconnues, extraire la **query** ; bloquer si la query (normalisée) **contient** la chaîne. |

**Périmètre moteurs :** aligné sur ce que l’extension sait déjà (`isSearchEngine` / extract query) — pas « toutes les barres de recherche du web » sans liste.

### 4.3 Hiérarchie et ordre d’évaluation (tranché pour v1)

- **Règles utilisateur = toujours additives.** Elles **ne peuvent pas** désactiver ou whitelister ce que le système bloque déjà (blocklist DNR, politique produit, etc.). Un utilisateur ne peut pas « débloquer » un site que la protection système a décidé de bloquer.
- **Ordre de référence (à aligner sur le code) :**  
  Layer 1 (règles dures / DNR) → Layer 2 (intelligence recherche) → **règles utilisateur en complément** → Layer 3 (analyse contenu) selon l’architecture actuelle documentée dans `intelligent-blocking.md` / `service-worker`. Les détails exacts restent dans le ticket technique ; l’UX doit refléter « les règles que tu ajoutes **renforcent** le blocage, ne le contournent pas ».

### 4.4 Incognito (tranché pour v1)

- **Oui :** si l’extension est autorisée en navigation privée, **les mêmes règles utilisateur** s’appliquent qu’en navigation normale. Le contourner via incognito sans cette parité serait un bypass trivial.

---

## 5. Flux « Ajouter une règle »

1. Clic **Add rule** dans la section URL ou Search (ou ajout via **Quick add** / presets §3.2).
2. **Modal** ou **ligne inline** (formulaire) avec :
   - Champ texte **obligatoire** (placeholder différent selon URL vs search).
   - Sélecteur **Match:** `Contains` (autres modes en « Advanced » si besoin).
   - **Note « Pourquoi »** (optionnel mais mis en avant en UI).
   - **Niveau d’engagement** (voir §9) — au minimum un choix au save ou défaut « Flexible ».
   - Boutons **Save** / **Cancel**.
3. **Preview / test** (§3.5) — cible v1.1 si pas en v1.
4. Après save : **optimistic UI** + sync Supabase ; message d’erreur si échec réseau.
5. Règle créée **active** par défaut (sauf si le produit impose un étape de confirmation — à trancher).

**Empty state :** « No URL rules yet » + CTA Add (+ lien vers presets si présent).

---

## 6. Blocage horaire (schedule) — v1.1 ou dès que le modèle le permet

Le modèle **`boundaries`** existant côté app peut déjà porter des **créneaux** (JSON schedule). Pour les règles de blocage « custom » :

- **Cas d’usage :** « Bloquer Reddit **pendant les heures de travail** », « sauf le weekend », etc.
- **Spec produit :** prévoir dès la conception des données (`schedule` optionnel par règle) même si l’UI complète arrive en v1.1 — évite une migration douloureuse.
- **Implémentation extension :** le service worker doit appliquer des règles **effectives** (résolues avec l’heure locale ou le fuseau stocké) ; aujourd’hui la sync plate vers `chrome.storage.local` ne porte pas forcément toute la logique horaire — ticket technique dédié.

---

## 7. Engagement / commitment lock (anti-contournement)

**Problème :** un toggle ou une suppression **instantanés** permettent de contourner la protection au moment de la tentation.

**Proposition — niveaux configurables par règle (ou défaut global utilisateur) :**

| Niveau | Comportement UX (résumé) |
|--------|---------------------------|
| **Flexible** | Toggle désactiver / supprimer **immédiat** — pour tester ou règles peu sensibles. |
| **Committed** | Désactiver ou supprimer exige un **cooldown** (ex. 15 min, 1 h) ou une **confirmation différée** (« Reviens dans X minutes si tu veux vraiment »). Le bouton de confirmation n’est actif qu’après le délai. |
| **Locked** (power mode) | La règle ne peut pas être modifiée pendant une **période** fixée à la création (ex. X jours / semaines), sauf procédure de secours produit (ex. email, support — hors scope UX minimal). |

**But produit :** différencier un vrai outil d’intention (protection, focus) d’une simple liste ignorée. Les libellés exacts et les durées par défaut sont à valider (copy + légal / mineurs si applicable).

---

## 8. Sync desktop ↔ extension (obligatoire pour une feature réelle)

**Contexte technique actuel :** le pipeline natif peut encore renvoyer une config vide côté extension (`rules: []` / TODO) — tant que la sync n’est pas branchée, les règres Supabase ne s’appliquent pas dans Chrome.

**Exigences produit v1 :**

1. **Contrat de données** : format des règles (type, value, match mode, active, schedule si présent, engagement…) sérialisé vers l’extension.
2. **Quand sync :** au démarrage app, après login, après chaque modification, **polling** ou **push** raisonnable ; extension : **copie locale** dans `chrome.storage.local` (pattern déjà utilisé par `shouldBlock`) pour que les règles survivent au desktop fermé.
3. **Échec réseau :** message clair + retry ; pas de faux sentiment de protection.
4. **Doc technique** : ticket ou section dans `implementation.md` — pas « hors scope » pour le produit ; seul le code détaillé est dans l’implémentation.

---

## 9. Données Supabase (niveau conceptuel)

Sans imposer le schéma SQL ici — à réconcilier avec **`boundaries`** / **`blocking_rules`** existants pour éviter deux sources de vérité :

- **Par utilisateur** (`user_id`), avec au minimum :
  - `type`: `url_contains` | `search_contains` (ou équivalent)
  - `value`: string normalisée côté client ou serveur
  - `match_mode` (si plusieurs modes en prod)
  - `is_active`: boolean
  - `note` / `reason` (texte optionnel — **v1 UI**)
  - `commitment_level` : `flexible` | `committed` | `locked` (+ paramètres de délai / période si besoin)
  - `schedule` (optionnel, JSON — aligné **v1.1** ou données prêtes avant UI complète)
  - `blocked_count` / agrégation stats (**v1.1** ou sync depuis extension)
  - `created_at` / `updated_at`
- **RLS** activée pour que chaque utilisateur ne voie que ses lignes.

**Sync vers l’extension :** voir §8.

---

## 10. Blocage par catégorie de site (v2)

Au-delà des URLs / mots-clés :

- **« Bloquer toute la catégorie Social / Shopping / … »** en s’appuyant sur la **classification de sites** déjà documentée (`site-classification`, insights) plutôt que sur une liste manuelle infinie.
- Réduit la charge cognitive ; dépend de la fiabilité du classifieur — donc **v2** après les fondations URL/search.

---

## 11. Questions encore ouvertes

1. **Langue UI** : Boundaries est-elle 100 % EN ou bilingue ?
2. **Limite** du nombre de règles par utilisateur (anti-abus / perf extension).
3. **Ordre fin** entre règles utilisateur multiples (première match gagne vs toutes évaluées) — ticket technique.
4. **Procédure de secours** pour niveau **Locked** (reset compte, délai max, mineurs).
5. **Wildcards** avancés (`*.example.com`) — post-v1 si demandé.

**Tranchés (ne plus traiter comme « ouverts ») :** chevauchement avec blocklist système (**additif uniquement** §4.3), incognito (**mêmes règles** §4.4), indicateur de sync (**obligatoire v1** §3.1 et §8).

---

## 12. Synthèse priorisation

| Idée | Cible | Impact principal |
|------|--------|------------------|
| Commitment lock (Flexible / Committed / Locked) | v1 | Indéfectible / intention |
| Sync contract + copie locale extension | v1 | Sans ça, rien ne s’applique dans Chrome |
| Redirect-aware matching | v1 | Indéfectible |
| Règles user strictement additives | v1 | Indéfectible / confiance |
| Incognito = parité avec navigation normale | v1 | Indéfectible |
| Indicateur sync (pas optionnel) | v1 | Confiance utilisateur |
| Presets / Quick add | v1 | User-friendly |
| Champ « Pourquoi » / note | v1 | Rétention / nudge |
| Schedule (données + UI) | v1.1 (données dès que possible) | User-friendly |
| Stats de blocage par règle | v1.1 | Feedback |
| Preview / test de règle | v1.1 | Évite faux positifs |
| Blocage par catégorie | v2 | Échelle / simplicité |

---

## 13. Liens

- État actuel du produit : `overview.md`, `intelligent-blocking.md`, `implementation.md`.
- Pipeline extension : `service-worker.ts`, `search-filter.ts`, `search-intelligence.ts`.
- Desktop : `BoundariesView`, API `boundaries` / migrations `013_boundaries.sql`.
- Fichier associé implémentation future : référencer depuis `implementation.md` une fois le ticket créé.
