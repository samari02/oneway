# Build, exécution locale et distribution (Clarity / oneway)

**Last update:** 2026-03-28

---

Ce document regroupe les **modes d’exécution** (développement vs app installée), ce qui se passe si le **terminal plante**, comment obtenir une **version stable** avec **icône**, et comment penser la **distribution** sur plusieurs machines — sans confondre avec un hébergeur type **Vercel** (réservé au web).

---

## 1. Les deux grandes façons de lancer l’app desktop

| Mode | Commande typique | À quoi ça sert |
|------|------------------|----------------|
| **Développement (dev)** | `pnpm dev` / `pnpm tauri dev` dans `apps/desktop` (ou équivalent monorepo) | Coder : hot-reload, logs, dépend au **processus lancé dans le terminal** |
| **Build release (production locale)** | `pnpm tauri build` dans `apps/desktop` | Obtenir un **`.app` macOS** (ou équivalent Windows/Linux) **figé** tant qu’on ne rebuild pas |

Ce sont **deux usages différents** : le dev sert à **modifier le code** ; la build sert à **utiliser l’app comme un logiciel installé**.

---

## 2. Mode développement — détails

### Comment ça marche

- Un processus (Vite + Tauri) tourne ; souvent lancé **depuis un terminal** (Cursor, Terminal.app, etc.).
- Tant que ce processus vit, l’app réagit aux changements de fichiers (selon config).

### Si le terminal ou Cursor “crash” ou se ferme

- Le **processus de dev** est en général **arrêté** avec : **l’app se ferme** ou cesse d’être joignable.
- Ce n’est **pas** un bug de Clarity : c’est le comportement normal d’un **serveur de dev** lié au terminal.

### Est-ce que ça crée une “vraie” app sur le Mac ?

- **Non**, pas au sens **Applications / Dock persistant** : tu n’as pas une app **installée** au sens utilisateur final ; tu as une **session de développement**.
- Pas d’icône stable dans le Dock **tant que tu n’as pas** installé un **`.app`** issu d’une **build release** (voir §3).

---

## 3. Build release — version **stable** qui “ne bouge pas”

### Objectif

- Obtenir un **instantané** du code **au moment du build** : tant que tu ne modifies pas le code et **ne relances pas** `tauri build`, ce binaire **ne change pas**. C’est ce qu’on peut appeler ta **version stable locale** pour toi.

### Commande

```bash
cd apps/desktop
pnpm tauri build
```

(À adapter si le monorepo expose un script racine du type `pnpm --filter @oneway/desktop build`.)

### Résultat sur macOS

- Tauri produit un dossier de **bundle** (souvent sous `src-tauri/target/release/bundle/macos/` — le chemin exact est affiché **à la fin** du build).
- Tu y trouves un **`.app`** (ex. **Clarity.app** selon `productName` dans `tauri.conf.json`).

### Icône et lancement “comme une vraie app”

- La build **embarque les icônes** définies dans le projet Tauri (pas une icône générique vide par défaut si le projet est bien configuré).
- **macOS ne place pas automatiquement** l’app sur le **Bureau** : tu ouvres le dossier du `.app`, tu le **glisses dans Applications** (recommandé).
- Tu peux **épingler au Dock** (icône dans le Dock → clic droit → **Options** → **Garder dans le Dock**).
- Ensuite tu lances Clarity **sans ouvrir Cursor ni un terminal** : double-clic ou Spotlight, comme n’importe quelle app.

### Indépendance de Cursor / terminal

- Une fois l’**`.app` lancée** depuis Applications ou le Dock, **fermer Cursor ou le terminal** ne ferme **pas** l’app (comportement standard d’une app macOS).

---

## 4. Pourquoi ce n’est **pas** Vercel (ni équivalent “site web”)

| Outil | Rôle |
|-------|------|
| **Vercel, Netlify, Cloudflare Pages**, etc. | Héberger du **web** : HTML, JS, APIs serverless, sites statiques |
| **App Tauri / `.app`** | **Binaire natif** installé sur la machine : ce n’est **pas** déployé “sur Vercel” comme un site |

Pour distribuer l’app desktop à d’autres personnes, on **publie un fichier téléchargeable** (`.dmg`, `.zip`, installateur Windows), souvent via **GitHub Releases**, un **site de téléchargement**, ou les stores — pas en “déployant” le `.app` sur Vercel.

---

## 5. Plusieurs machines (plusieurs Mac, PC, etc.)

### Principe

- Chaque OS a besoin de **son** artefact : **macOS** (`.app` / `.dmg`), **Windows** (`.exe` / MSI), etc. On **compile** sur chaque plateforme (ou via CI).
- **Chaque ordinateur** installe **sa propre copie** : le `.app` sur **ton** Mac ne suffit **pas** aux autres ; ils téléchargent/installent **leur** build (même version si tu la publies).

### Compte / données cloud

- Si le produit utilise **Supabase** (ou autre), le **même compte** peut servir sur plusieurs appareils **côté backend**, selon les features implémentées.
- Les **données locales** (`~/.clarity`, fichiers sur disque) restent **par machine** sauf si le produit prévoit une synchro explicite.

---

## 6. Extension Chrome et chemin du binaire (native messaging)

- L’extension parle au desktop via **native messaging** ; le manifest Chrome pointe vers un **binaire** (ou un **script lanceur** avec `--native-host`).
- Le chemin **en dev** (`target/debug/appsdesktop`) n’est **pas** le même qu’**après install** (`/Applications/Clarity.app/...`).
- Pour que le pont reste valide après une **build release**, il faut **réinstaller / mettre à jour** le manifest (voir `apps/desktop/scripts/install-native-host.sh` et la doc [clarity_desktop_extension_connectivity_2026-03-28.md](../02-features/clarity-connectivity/clarity_desktop_extension_connectivity_2026-03-28.md)).

---

## 7. Récap express

| Question | Réponse courte |
|----------|----------------|
| Je dois lancer en local à chaque fois ? | **En dev**, oui (processus terminal). **En release**, non : tu installes le `.app` une fois. |
| Cursor / terminal qui plante ? | En **dev**, souvent l’app s’arrête avec. En **release**, l’app tourne **sans** dépendre du terminal. |
| Version stable qui ne bouge pas ? | **`pnpm tauri build`** → `.app` figé jusqu’au prochain build. |
| Icône + clic pour lancer ? | Oui après avoir mis le **`.app`** dans **Applications** / Dock ; ce n’est pas créé automatiquement sur le Bureau. |
| Vercel pour multi-machines ? | **Non** pour le binaire ; utiliser **fichiers à télécharger** + install sur chaque machine. |
| Multi-appareils ? | **Une install par machine** ; même binaire/version si tu la distribues (ex. GitHub Releases). |

---

## Voir aussi

- [comprendre_l_application_2026-03-28.md](./comprendre_l_application_2026-03-28.md) — Vue d’ensemble produit (desktop + extension + données)
- [README principal](../README.md) — Quick Start
- [clarity_desktop_extension_connectivity_2026-03-28.md](../02-features/clarity-connectivity/clarity_desktop_extension_connectivity_2026-03-28.md) — Pont extension ↔ desktop
