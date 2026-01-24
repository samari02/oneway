# UX Unification — Screen Time & Boundaries

> Objectif : Rendre cohérente l'expérience entre Stats, Apps et Boundaries.

---

## Problème actuel

L'app a 3 espaces qui trackent des choses similaires de manière fragmentée :

| Vue | Contenu | Problème |
|-----|---------|----------|
| **Stats** | Browsing (web) + Habits | Pas d'apps |
| **App Blocking** | Usage apps + Rules apps | Isolé, mélange stats et rules |
| **Boundaries** | Rules web + System Health | Pas d'apps |

**Résultat :** L'utilisateur a 3 modèles mentaux différents pour un objectif unique : comprendre et contrôler son temps digital.

---

## Solution : 2 piliers unifiés

### 1. Screen Time (observation)

> "Voici ce que tu fais de ton temps."

Regroupe TOUTES les stats en un seul endroit :
- **Overview** — Vue agrégée (total time, focus score global, top distractions)
- **Browsing** — Stats navigation web (existant)
- **Apps** — Stats apps natives (déplacé depuis App Blocking)
- **Habits** — Stats habits (existant)

### 2. Boundaries (contrôle)

> "Voici ce que tu veux changer."

Regroupe TOUTES les règles en un seul endroit :
- **System Health** — État de protection (extension, incognito, safesearch)
- **My Rules** — Règles web ET apps unifiées

---

## Nouvelle sidebar

```
┌────────────────────┐
│  📊 Screen Time    │  ← Toutes les stats
│  🛡️ Boundaries     │  ← Toutes les règles
│  ────────────────  │
│  ✓ Habits          │  ← Daily check (action)
│  🎯 Goals          │
│  💬 Aoi            │
│  ⚙️ Settings       │
└────────────────────┘
```

---

## Plan d'implémentation

### Phase 1 : Unifier les Stats → Screen Time ✅

1. [x] Renommer `Stats` → `Screen Time` (sidebar + header)
2. [x] Réorganiser les onglets : `Overview` | `Browsing` | `Apps` | `Habits`
3. [x] Créer `OverviewTab` avec stats agrégées
4. [x] Déplacer stats apps (depuis AppBlockingView) vers onglet Apps

### Phase 2 : Unifier les Boundaries

1. [ ] Étendre type `Boundary` pour supporter `type: 'website' | 'app'`
2. [ ] Migration DB : `blocked_apps` → `boundaries` avec type='app'
3. [ ] UI pour créer boundary app dans BoundariesView
4. [ ] Supprimer AppBlockingView de la sidebar

### Phase 3 : Polish

1. [ ] Quick actions "Limiter" depuis Screen Time → crée boundary
2. [ ] Catégories partagées (productive/neutral/distraction) pour apps ET web
3. [ ] Focus Score global (apps + web combinés)

---

## Modèle de données étendu

```typescript
// Boundary unifié
interface Boundary {
  id: string
  user_id: string
  
  // Type de cible
  type: 'website' | 'app' | 'category'
  
  // Pour websites
  patterns?: string[]           // ["twitter.com", "*.reddit.com"]
  
  // Pour apps
  bundle_ids?: string[]         // ["com.hnc.Discord"]
  
  // Pour catégories
  category?: 'social' | 'entertainment' | 'news' | 'gaming'
  
  // Configuration
  name: string
  mode: 'block' | 'awareness' | 'limit'
  daily_limit_ms?: number       // Pour mode 'limit'
  schedule: BoundarySchedule
  reason?: string
  
  // État
  is_active: boolean
  created_at: string
  updated_at: string
}
```

---

## Flow utilisateur cible

```
1. OBSERVER (Screen Time)
   └─→ "J'ai passé 2h sur Twitter aujourd'hui"
   
2. DÉCIDER (depuis Screen Time ou Boundaries)
   └─→ Clic "Limiter" → Modal création boundary
   
3. AGIR (Boundaries actives)
   └─→ Blocage/awareness automatique
   
4. ITÉRER (Screen Time)
   └─→ "Ma consommation Twitter a baissé de 40%"
```

---

*Créé : 2026-01-25*
