# Habits & Boundaries — Unified System

> Un seul concept, deux modes : **Do** (faire) et **Avoid** (éviter).

---

## 🎯 Concept

| Type | Mode | Exemple | Validation |
|------|------|---------|------------|
| **Habit** | Do | "Méditer 10min" | Check manuel ✓ |
| **Boundary** | Avoid | "Pas de phone 6h-8h" | Auto ou déclaration d'échec |

Les deux vivent au même endroit, même UX, même mental model.

---

## 📱 UX — Création

```
┌─────────────────────────────────────┐
│  + New Habit                        │
│                                     │
│  Nom: [Pas de téléphone au réveil]  │
│                                     │
│  Type:                              │
│  ● Do something    ○ Avoid something│
│                                     │
│  ─── Si "Avoid" ───                 │
│                                     │
│  Catégorie:                         │
│  ○ Digital (sites/apps)             │
│  ● Physical (nourriture, etc.)      │
│                                     │
│  Horaire:                           │
│  De [06:00] à [08:00]               │
│                                     │
│  Jours: [L][M][M][J][V][S][D]       │
│         ✓  ✓  ✓  ✓  ✓  ○  ○        │
│                                     │
│  ─── Si Digital ───                 │
│                                     │
│  Sites bloqués:                     │
│  [x] Social media                   │
│  [x] YouTube                        │
│  [ ] News                           │
│  + Custom: [__________]             │
│                                     │
│              [Créer]                │
└─────────────────────────────────────┘
```

---

## 📱 UX — Today View

```
┌──────────────────────────────────────┐
│  Today — Vendredi 10 jan            │
│                                      │
│  🌅 Matin                            │
│  ───────────────────────────────     │
│  ○ Méditer 10min                     │
│  ○ Sport 30min                       │
│  🛡️ Pas de phone 6h-8h          ✓    │
│                                      │
│  🌙 Soir                             │
│  ───────────────────────────────     │
│  ○ Journaling                        │
│  ○ Préparer demain                   │
│  🛡️ Pas de social 20h-23h       ⏳   │
│  🛡️ Pas de sucre après 18h      ✓    │
│                                      │
│  ───────────────────────────────     │
│  + Add habit                         │
│                                      │
└──────────────────────────────────────┘
```

### États visuels

| Icône | État | Description |
|-------|------|-------------|
| ○ | Pending | Habit à faire |
| ✓ | Done | Habit complété |
| 🛡️ ⏳ | Active | Boundary en cours |
| 🛡️ ✓ | Respected | Boundary respectée (auto) |
| 🛡️ ✗ | Violated | Boundary violée |

---

## 🔄 Validation — Approche Optimiste

### Principe
> Les boundaries sont **auto-validées** à la fin de leur période.  
> L'utilisateur intervient **seulement pour déclarer un échec**.

### Flow

```
6h00  → Boundary "Pas de phone" devient active (⏳)
8h00  → Boundary auto-validée (✓)
        Aucune action requise si respectée

Si violation:
- Tap sur la boundary → "J'ai pas tenu" → (✗)
- Ou via extension si digital (auto-détecté)
```

### Digital (avec extension)
```
User ouvre Instagram à 7h15
         ↓
┌────────────────────────────────┐
│     🛡️ Boundary active         │
│                                │
│  "Pas de phone au réveil"      │
│   Encore 45 min                │
│                                │
│  [← Retour]   [Bypass →]       │
│               (sera tracké)    │
└────────────────────────────────┘
         ↓
Si bypass → boundary (✗) automatiquement
```

---

## 🗃️ Data Model

### Tables

```sql
-- Habits table (étendue)
create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  
  -- Base
  name text not null,
  icon text,
  description text,
  
  -- Type: 'do' ou 'avoid'
  habit_type text not null default 'do' 
    check (habit_type in ('do', 'avoid')),
  
  -- Pour les 'avoid' boundaries
  avoid_category text check (avoid_category in ('digital', 'physical')),
  time_start time,          -- début de la période
  time_end time,            -- fin de la période
  blocked_sites text[],     -- si digital
  
  -- Scheduling
  days_of_week int[],       -- [1,2,3,4,5,6,7]
  time_of_day text check (time_of_day in ('morning', 'evening', 'anytime')),
  
  -- Meta
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Check-ins (habits + boundaries)
create table habit_check_ins (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid references habits not null,
  user_id uuid references auth.users not null,
  date date not null,
  
  -- Pour 'do': true = fait
  -- Pour 'avoid': true = respecté, false = violé
  completed boolean not null,
  
  -- Pour boundaries digitales
  violation_count int default 0,
  bypass_timestamps timestamptz[],
  
  created_at timestamptz default now(),
  
  unique(habit_id, date)
);
```

### Types (shared)

```typescript
// packages/shared/src/types/habit.ts

export type HabitType = 'do' | 'avoid';
export type AvoidCategory = 'digital' | 'physical';

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  icon?: string;
  description?: string;
  
  habit_type: HabitType;
  
  // Avoid-specific
  avoid_category?: AvoidCategory;
  time_start?: string;  // "06:00"
  time_end?: string;    // "08:00"
  blocked_sites?: string[];
  
  // Scheduling
  days_of_week?: number[];
  time_of_day: 'morning' | 'evening' | 'anytime';
  
  is_active: boolean;
  created_at: string;
}

export interface HabitCheckIn {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  completed: boolean;
  violation_count?: number;
  bypass_timestamps?: string[];
  created_at: string;
}
```

---

## 📋 Implementation Plan

### Phase 1: Database
- [ ] Migration: ajouter colonnes `habit_type`, `avoid_category`, `time_start`, `time_end`, `blocked_sites` à `habits`
- [ ] Migration: ajouter colonnes `violation_count`, `bypass_timestamps` à `habit_check_ins`
- [ ] Update types shared

### Phase 2: API
- [ ] Update habits API pour supporter les nouveaux champs
- [ ] Logique auto-validation boundaries (cron ou edge function)

### Phase 3: UI — Création
- [ ] Update `AddHabitForm` avec type selector (Do/Avoid)
- [ ] Champs conditionnels si Avoid (catégorie, horaires, sites)
- [ ] Update `EditHabitModal`

### Phase 4: UI — Affichage
- [ ] Update `HabitItem` pour afficher différemment Do vs Avoid
- [ ] États visuels boundaries (⏳, ✓, ✗)
- [ ] "Déclarer échec" action sur boundaries

### Phase 5: Extension Chrome (later)
- [ ] Sync boundaries digitales
- [ ] Blocking basé sur time windows
- [ ] Report bypass → update check-in

---

## 🎨 UI Components

### HabitItem variants

```
DO Habit (standard):
┌─────────────────────────────────┐
│ ○  🧘 Méditer 10min             │
└─────────────────────────────────┘

AVOID Boundary (active):
┌─────────────────────────────────┐
│ 🛡️ ⏳  Pas de phone    6h-8h    │
│        En cours...              │
└─────────────────────────────────┘

AVOID Boundary (done):
┌─────────────────────────────────┐
│ 🛡️ ✓  Pas de phone    6h-8h    │
└─────────────────────────────────┘
```

---

## 🚀 Future Ideas

- **Streaks séparés** : streak habits vs streak boundaries
- **Strictness par boundary** : gentle/guided/strict
- **Smart suggestions** : "Tu bypass souvent le dimanche, on ajuste?"
- **Linked habits** : "Débloquer social media après avoir fait sport"

---

*Document créé: 2025-01-10*
