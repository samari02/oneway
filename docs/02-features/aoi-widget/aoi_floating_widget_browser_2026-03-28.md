# Widget flottant Aoi (navigateur)

**Last update:** 2026-03-28

> Nommage du fichier : voir [00-documentation-naming-rules_2026-03-28.md](../../03-runbooks/00-documentation-naming-rules_2026-03-28.md).

---

## Ce que c’est

Sur les pages web **http/https**, l’extension injecte un **compagnon visuel** (mascotte + bulle) **fixé en bas à droite** de la fenêtre. Ce n’est **pas** le même écran que le coach IA de l’**app desktop** documenté dans [ai-companion.md](../ai-companion.md) : ici tout passe par le **content script** Chrome.

| Élément | Rôle |
|---------|------|
| **Personnage (Aoi)** | Mascotte CSS (sprout, visage, jambes) dans la bulle |
| **Bulle** | Statut visuel (`ok` / `nudge` / `alert`), message court, badge temps |
| **Menu** | Clic sur la bulle → options (analyse, masquage) |
| **Bouton restore** | Quand le widget est masqué, petit contrôle pour le réafficher |

---

## Où ça ne s’affiche pas

Les URL **exclues** (pas d’injection) incluent notamment : `chrome://`, `chrome-extension://`, `edge://`, `about:`, `file://`, etc. (voir `shouldInject()` dans le code).

---

## Masquer « selon les pages »

Le menu propose deux actions de **masquage** (le widget disparaît ; ce n’est pas une minimisation macOS) :

| Action | Comportement | Stockage (`chrome.storage.local`) |
|--------|----------------|-----------------------------------|
| **Hide on this site** | Masque Aoi **sur le domaine actuel** uniquement | Liste `clarity_hidden_domains` (hostnames sans `www.`) |
| **Hide everywhere** | Masque Aoi sur **tous** les sites | Booléen `clarity_hidden_global` |

Quand masqué, le conteneur prend la classe **`hidden`** ; un bouton **restore** permet de réafficher Aoi et de **annuler** le bon type de masquage (global vs domaine).

**Sync :** les préférences peuvent être envoyées au desktop (`AOI_PREFERENCES_UPDATE` → native messaging) pour persistance côté app / Supabase selon l’implémentation en place.

---

## Fichiers code principaux

| Fichier | Rôle |
|---------|------|
| `apps/extension/src/content/content-script.ts` | Injection du widget, styles (Shadow DOM), événements, `GET_AOI_STATUS` |
| `apps/extension/src/background/service-worker.ts` | Handler `GET_AOI_STATUS`, `OPEN_POPUP`, etc. |

Le CSS inclut aussi des règles pour `.aoi-widget.minimized` ; l’activation JS de cette classe peut être absente ou partielle selon les versions — le comportement **documenté** pour « par site » repose sur **hide domain / hide global**.

---

## Voir aussi

- [ai-companion.md](../ai-companion.md) — Coach IA dans l’**app desktop** (conversation, OpenAI)
- [extension/README.md](../../03-architecture/extension/README.md) — Rôle des content scripts
- [changelog/1.log.md](../../changelog/1.log.md) — Entrées #73–#75 (historique produit détaillé)
