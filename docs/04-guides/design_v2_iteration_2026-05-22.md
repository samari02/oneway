# Design v2 iteration (Clarity / oneway)

**Last update:** 2026-05-22

---

## Setup

| Dossier | Branche | Usage |
|---------|---------|--------|
| `oneway/` | `main` | Produit actuel (sidebar sombre, mint) |
| `oneway-design-v2/` | `design/v2` | Refonte UI expérimentale |

Les deux partagent le **même repo git** via **worktree** — commits séparés par branche.

---

## Lancer le design v2

```bash
cd /Users/samuelmarinelli/Development/4.projects/oneway-design-v2
pnpm install
pnpm dev:desktop:v2
```

Ou depuis `apps/desktop/.env.local` :

```
VITE_UI_VARIANT=v2
```

Puis `pnpm dev:desktop`.

---

## Lancer le classic (inchangé)

```bash
cd /Users/samuelmarinelli/Development/4.projects/oneway
pnpm dev:desktop
```

(`main` n’a pas `VITE_UI_VARIANT=v2` → UI actuelle.)

---

## Où coder la refonte

```
apps/desktop/src/app/v2/
  AppV2.tsx      # shell + navigation
  AppV2.css      # tokens / layout v2
```

- Auth, Supabase, onboarding : réutilisés pour l’instant
- Extension Chrome : **même** build / native host que `main`
- Ne pas toucher `apps/desktop/src/app/App.tsx` sauf si tu merges plus tard

---

## Workflow git

```bash
# Dans le worktree v2
cd /Users/samuelmarinelli/Development/4.projects/oneway-design-v2
git add ...
git commit -m "design(v2): ..."
git push -u origin design/v2
```

Quand v2 est prêt : PR `design/v2` → `main`, ou cherry-pick des commits UI.

---

## Revenir / supprimer le worktree

```bash
cd /Users/samuelmarinelli/Development/4.projects/oneway
git worktree remove ../oneway-design-v2
git branch -d design/v2   # si abandonné
```

---

## Voir aussi

- [build_et_distribution_2026-03-28.md](./build_et_distribution_2026-03-28.md)
- [comprendre_l_application_2026-03-28.md](./comprendre_l_application_2026-03-28.md)
