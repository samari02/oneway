# Comprendre l’application Clarity (oneway)

**Last update:** 2026-03-28

---

## En une phrase

**Clarity** est une app **sur ton Mac** (Tauri) + une **extension Chrome** qui travaillent ensemble : limiter les distractions, suivre la navigation utile, et t’aider à rester concentré. Ce n’est **pas** qu’un site web : le cœur du produit est **local** (desktop + navigateur).

---

## Les deux briques

| Brique | Rôle | Techno |
|--------|------|--------|
| **App desktop** (“Clarity”) | Fenêtre principale : stats, réglages, onboarding, connexion compte, données sur disque | Tauri + React |
| **Extension Chrome** | Tourne **en arrière-plan** dans le navigateur : règles de blocage, collecte d’URL visitées, lien avec le desktop | Manifest V3, service worker |

Tu peux ouvrir le **petit popup** de l’extension (icône dans la barre) : c’est surtout pour l’UI rapide. La **logique importante** (blocage, historique) vit dans le **service worker**, pas dans le popup.

---

## Comment le desktop et Chrome se parlent

Chrome ne peut pas “voir” ton dossier utilisateur comme une app normale. Le mécanisme prévu s’appelle **native messaging** :

1. Un petit fichier JSON dit à Chrome **quel programme lancer** quand l’extension veut parler au Mac (`com.clarity.app`).
2. Ce programme est en pratique le **même binaire** que l’app Clarity, lancé en mode **hôte** (avec un flag du type `--native-host`).
3. Sur ce canal passent : **heartbeats** (“l’extension est vivante”), **événements de navigation**, **sync d’historique**, **statut d’auth** depuis le desktop, etc.

Si ce lien est cassé (mauvais chemin, extension mal installée, desktop fermé trop longtemps), l’app peut afficher un bandeau du type **“Protection compromised”** : ce n’est pas que l’extension est “off” dans `chrome://extensions`, c’est que **le pont vers le desktop** ne reçoit plus de signaux.

Détails techniques : [native-messaging.md](../03-architecture/extension/native-messaging.md) et [clarity_desktop_extension_connectivity_2026-03-28.md](../02-features/clarity-connectivity/clarity_desktop_extension_connectivity_2026-03-28.md).

---

## Où vivent les données (repères)

| Emplacement | Contenu typique |
|-------------|------------------|
| `~/.clarity/` | Fichiers partagés (ex. statut extension / heartbeats, données browsing côté Rust) |
| `chrome.storage.local` (extension) | Règles, cache, **`navigationHistory`** (historique collecté côté navigateur) |
| App desktop (Rust) | Fichiers type `visits.jsonl` sous un répertoire dédié (voir data pipeline) |

---

## Historique de navigation : le chemin simple

1. **Collecte** : à chaque chargement de page (cadre principal), le service worker enregistre une visite dans **`navigationHistory`** (stockage local de l’extension).
2. **Vers le desktop** : si le **native messaging** est OK, chaque visite peut être envoyée **en direct** ; au démarrage, un **gros envoi** peut resynchroniser tout le buffer (avec un délai anti-spam).
3. **Cloud (Supabase)** : le code peut prévoir une synchro cloud depuis l’extension, mais **dans l’état actuel du service worker**, une partie de ce flux peut être **désactivée** — le chemin **fiable** pour l’historique reste **extension → desktop en local**.

**Être “connecté” dans le popup** sert surtout à l’**affichage du compte** et aux flux liés au compte ; **ce n’est pas** la condition pour que l’historique soit **écrit dans Chrome** ou **envoyé au desktop** tant que le pont technique fonctionne.

---

## Compte et backend

- **Auth “principale”** pour l’expérience complète : souvent via **l’app desktop** (Supabase côté client web embarqué).
- **Supabase** sert backend (données, auth) selon les features branchées ; tout n’est pas obligatoirement synchronisé depuis l’extension.

---

## Lancer le projet en développement

Voir la section **Quick Start** du [README principal](../README.md) : `pnpm install`, puis `apps/desktop` (Tauri) et build de l’extension dans `apps/extension` chargée en **non empaquetée** dans Chrome.

---

## Build release, icône, distribution (résumé)

Pour une **version stable** installable (`.app`), l’indépendance au terminal, le fait que **Vercel ne sert pas** au binaire desktop, et la **multi-machine** : tout est détaillé dans le guide dédié **[build_et_distribution_2026-03-28.md](./build_et_distribution_2026-03-28.md)**.

---

## Pour aller plus loin (docs du repo)

| Sujet | Fichier |
|-------|---------|
| Vision produit | [01-vision/](../01-vision/) |
| Blocage, habits, widget Aoi (navigateur) | [02-features/](../02-features/) — [aoi-widget/](../02-features/aoi-widget/) |
| Architecture, pipeline de données | [03-architecture/overview.md](../03-architecture/overview.md), [data-pipeline.md](../03-architecture/data/data-pipeline.md) |
| Build, `.app`, Vercel, multi-postes | [build_et_distribution_2026-03-28.md](./build_et_distribution_2026-03-28.md) |
| Débug extension | [extension-debug.md](./extension-debug.md) |

---

## À retenir

1. **Desktop + extension** : deux processus, un **canal natif** pour les joindre.  
2. **L’historique** : collecte **automatique** côté extension, envoi **vers le desktop** quand le canal est sain.  
3. **Le popup** : utile pour l’UI, pas le centre du moteur.  
4. **La doc évolue** : en cas de doute, croiser avec `03-architecture` et les notes datées dans `02-features/`.
