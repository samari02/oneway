# Database Schema — Clarity

> Vue d'ensemble complète du schema Supabase.

---

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE (PostgreSQL)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐     │
│  │   habits    │───→│  habit_check_ins │    │     goals       │     │
│  └─────────────┘    └──────────────────┘    └─────────────────┘     │
│         │                                           │                │
│         └─────────────────────┬─────────────────────┘                │
│                               │                                      │
│                        ┌──────▼──────┐                               │
│                        │user_settings│                               │
│                        └─────────────┘                               │
│                                                                      │
│  ┌─────────────────┐    ┌──────────────────┐                        │
│  │ blocking_rules  │    │  blocking_state  │                        │
│  └─────────────────┘    └──────────────────┘                        │
│                                                                      │
│  ┌───────────────────┐    ┌──────────────────┐                      │
│  │navigation_history │───→│ navigation_stats │                      │
│  └───────────────────┘    └──────────────────┘                      │
│                                                                      │
│  ┌──────────────────┐                                               │
│  │ ai_conversations │                                               │
│  └──────────────────┘                                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tables par domaine

### 1. Habits & Boundaries

#### `habits`
Configuration des habitudes (DO) et boundaries (AVOID).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → auth.users |
| `name` | TEXT | Nom de l'habitude |
| `icon` | TEXT | Emoji |
| `order` | INT | Ordre d'affichage |
| `is_active` | BOOL | Activé/désactivé |
| `description` | TEXT | Description optionnelle |
| `duration_minutes` | INT | Durée estimée |
| `is_required` | BOOL | Requis pour débloquer (strict mode) |
| `time_of_day` | TEXT | `morning` \| `evening` \| `anytime` |
| `scheduled_time` | TEXT | Heure planifiée (HH:MM) |
| `habit_type` | TEXT | `do` \| `avoid` |
| `avoid_category` | TEXT | `digital` \| `physical` (si avoid) |
| `time_start` | TEXT | Début période boundary (HH:MM) |
| `time_end` | TEXT | Fin période boundary (HH:MM) |
| `blocked_sites` | TEXT[] | Sites à bloquer (si digital) |
| `days_of_week` | INT[] | Jours actifs (1=Lun, 7=Dim) |
| `linked_to_north_star` | BOOL | Lié à l'objectif principal |
| `goal_id` | UUID | FK → goals |
| `created_at` | TIMESTAMPTZ | Date création |

#### `habit_check_ins`
Historique des check-ins quotidiens.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Primary key |
| `habit_id` | UUID | FK → habits |
| `user_id` | UUID | FK → auth.users |
| `date` | DATE | Jour du check-in |
| `completed` | BOOL | Complété (habits) / Respecté (boundaries) |
| `violation_count` | INT | Nombre de violations (boundaries) |
| `bypass_timestamps` | TIMESTAMPTZ[] | Timestamps des bypass |
| `completed_at` | TIMESTAMPTZ | Quand complété |

**Contrainte unique** : `(habit_id, date)` — 1 check-in par habit par jour

---

### 2. Goals

#### `goals`
Objectifs avec progression.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → auth.users |
| `name` | TEXT | Nom de l'objectif |
| `icon` | TEXT | Emoji (défaut: 🎯) |
| `progress` | INT | 0-100% |
| `target_date` | DATE | Date cible optionnelle |
| `created_at` | TIMESTAMPTZ | Date création |
| `updated_at` | TIMESTAMPTZ | Dernière modification |

---

### 3. Blocking (Sites Web)

#### `blocking_rules`
Règles de blocage de sites web.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → auth.users |
| `pattern` | TEXT | Pattern URL à bloquer |
| `is_active` | BOOL | Règle active |
| `mode` | TEXT | `off` \| `focus` \| `morning_routine` |
| `created_at` | TIMESTAMPTZ | Date création |

#### `blocking_state`
État actuel du blocage pour l'utilisateur.

| Colonne | Type | Description |
|---------|------|-------------|
| `user_id` | UUID | PK, FK → auth.users |
| `mode` | TEXT | `off` \| `focus` \| `morning_routine` |
| `active_until` | TIMESTAMPTZ | Fin du mode actuel |
| `morning_routine_completed` | BOOL | Routine matinale finie |
| `updated_at` | TIMESTAMPTZ | Dernière modification |

---

### 4. Navigation (Browsing History)

#### `navigation_history`
Historique de navigation (privacy-first: domaines seulement).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → auth.users |
| `domain` | TEXT | Domaine visité (ex: twitter.com) |
| `category` | TEXT | `social_media` \| `news` \| `video` \| `entertainment` \| `shopping` \| `work` \| `other` |
| `is_distraction` | BOOL | Site considéré distraction |
| `visit_time` | TIMESTAMPTZ | Quand visité |
| `title` | TEXT | Titre page (max 200 chars) |
| `source` | TEXT | `extension` \| `import` |
| `synced_at` | TIMESTAMPTZ | Quand synchronisé |
| `created_at` | TIMESTAMPTZ | Date création |

#### `navigation_stats`
Stats pré-calculées pour performance.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → auth.users |
| `period_start` | TIMESTAMPTZ | Début période |
| `period_end` | TIMESTAMPTZ | Fin période |
| `total_visits` | INT | Total visites |
| `visits_by_category` | JSONB | `{"social_media": 150, ...}` |
| `top_domains` | JSONB | `[{"domain": "x.com", "count": 100}, ...]` |
| `top_distractions` | JSONB | Top sites distractions |
| `computed_at` | TIMESTAMPTZ | Quand calculé |

**Contrainte unique** : `(user_id, period_start, period_end)`

---

### 5. User Settings

#### `user_settings`
Préférences utilisateur centralisées.

| Colonne | Type | Description |
|---------|------|-------------|
| `user_id` | UUID | PK, FK → auth.users |
| `morning_routine_habits` | UUID[] | Habits de la routine matinale |
| `default_blocking_mode` | TEXT | Mode par défaut |
| `wake_time` | TEXT | Heure de réveil (HH:MM) |
| `sleep_time` | TEXT | Heure de coucher (HH:MM) |
| `screen_off_time` | TEXT | Heure arrêt écrans (HH:MM) |
| `onboarding_completed` | BOOL | Onboarding terminé |
| `display_name` | TEXT | Prénom utilisateur |
| `north_star_goal` | TEXT | Objectif principal |
| `north_star_icon` | TEXT | Emoji objectif (défaut: 🎯) |
| `north_star_created_at` | TIMESTAMPTZ | Quand créé |
| `aoi_hidden_global` | BOOL | Cacher Aoi partout |
| `aoi_hidden_domains` | TEXT[] | Domaines où Aoi est caché |
| `updated_at` | TIMESTAMPTZ | Dernière modification |

---

### 6. AI Conversations

#### `ai_conversations`
Historique des conversations avec l'assistant AI.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → auth.users |
| `title` | TEXT | Titre de la conversation |
| `mode` | TEXT | Mode de conversation |
| `is_active` | BOOL | Conversation active |
| `messages` | JSONB | Array des messages |
| `context` | JSONB | Contexte de la conversation |
| `created_at` | TIMESTAMPTZ | Date création |
| `updated_at` | TIMESTAMPTZ | Dernière modification |

---

## Patterns de données

### Pattern 1 : Agrégé journalier
**Utilisé par** : `habit_check_ins`

```
1 row par entité par jour
Exemple : 1 check-in par habit par jour
```

**Avantages** :
- Peu de rows
- Queries simples
- Suffisant pour "combien" / "combien de fois"

**Inconvénients** :
- Pas de détail temporel (quand exactement)

---

### Pattern 2 : Granulaire + Stats pré-calculées
**Utilisé par** : `navigation_history` + `navigation_stats`

```
navigation_history : 1 row par visite (granulaire)
navigation_stats   : 1 row par période (agrégé)
```

**Avantages** :
- Données complètes pour analyse fine
- Stats rapides via table pré-calculée
- Peut recalculer les stats si besoin

**Inconvénients** :
- Plus de storage
- Plus de rows à gérer
- Logique de sync entre tables

---

## Stockage Local (non-Supabase)

Certaines données sont stockées localement dans `~/.clarity/` :

| Fichier | Contenu | Synced Supabase ? |
|---------|---------|-------------------|
| `app-usage.json` | Usage apps macOS | ❌ Non (à faire) |
| `blocked-apps.json` | Config blocage apps | ❌ Non (à faire) |
| `icon-cache.json` | Cache icônes apps | ❌ Non (local seulement) |
| `extension-status.json` | État extension | ❌ Non (état runtime) |
| `aoi-preferences.json` | Préfs widget Aoi | ✅ Oui (sync bidirectionnelle) |
| `clarity-data/visits.jsonl` | Historique navigation | ✅ Oui (via extension) |
| `clarity-data/blocks.jsonl` | Événements blocage | ❌ Non |

---

## Row Level Security (RLS)

Toutes les tables ont RLS activé avec la politique standard :

```sql
-- Chaque utilisateur ne voit que ses propres données
CREATE POLICY "Users can manage own data"
  ON table_name FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## Migrations

Les migrations sont dans `supabase/migrations/` :

| Fichier | Description |
|---------|-------------|
| `001_initial_schema.sql` | Tables de base (habits, blocking, user_settings) |
| `002_user_settings_onboarding.sql` | Champs onboarding |
| `003_habits_enriched.sql` | Champs enrichis habits |
| `004_habits_scheduled_time.sql` | Heure planifiée |
| `005_user_display_name.sql` | Prénom utilisateur |
| `006_habits_boundaries.sql` | Support boundaries (do/avoid) |
| `007_checkins_boundaries.sql` | Tracking violations |
| `008_north_star.sql` | North Star goal |
| `009_ai_conversations.sql` | Conversations AI |
| `010_goals.sql` | Table goals |
| `011_ai_conversations_history.sql` | Historique conversations |
| `012_navigation_history.sql` | Historique navigation |
| `013_boundaries.sql` | (à vérifier) |
| `014_aoi_preferences.sql` | Préférences Aoi widget |

---

## À venir

### App Blocking (macOS/Windows/Android)

Tables pour synchroniser l'usage d'apps natives (granulaire).

#### `app_sessions`
Chaque session d'utilisation d'une app (granulaire).

```sql
CREATE TABLE app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- App info
  bundle_id TEXT NOT NULL,           -- "com.spotify.client"
  app_name TEXT NOT NULL,            -- "Spotify"
  
  -- Session timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_ms BIGINT,                -- Computed: end_time - start_time
  
  -- Platform (multi-device ready)
  platform TEXT NOT NULL DEFAULT 'macos',  -- "macos" | "windows" | "android" | "ios"
  
  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT now(),
  
  -- Contrainte unique pour éviter doublons
  UNIQUE(user_id, bundle_id, start_time)
);

-- Index pour queries rapides
CREATE INDEX idx_app_sessions_user_time ON app_sessions(user_id, start_time DESC);
CREATE INDEX idx_app_sessions_user_bundle ON app_sessions(user_id, bundle_id);

-- RLS
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sessions" ON app_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**Volume estimé** : ~50 sessions/jour/user = ~18K rows/an/user

**Query typique** (~5-10ms avec index) :
```sql
SELECT bundle_id, app_name, SUM(duration_ms) as total, COUNT(*) as sessions
FROM app_sessions
WHERE user_id = $1 AND start_time > now() - interval '7 days'
GROUP BY bundle_id, app_name
ORDER BY total DESC;
```

#### `blocked_apps`
Configuration des apps bloquées par utilisateur.

```sql
CREATE TABLE blocked_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bundle_id TEXT NOT NULL,
  app_name TEXT,
  blocked_at TIMESTAMPTZ DEFAULT now(),
  
  -- Schedule (optionnel)
  schedule TEXT DEFAULT 'always',    -- "always" | "scheduled" | "focus_mode"
  time_start TEXT,                   -- "09:00"
  time_end TEXT,                     -- "18:00"
  days_of_week INTEGER[],            -- [1,2,3,4,5] = Lun-Ven
  
  UNIQUE(user_id, bundle_id)
);

-- RLS
ALTER TABLE blocked_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own blocked apps" ON blocked_apps
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

#### `app_usage_stats` (optionnel, pour performance)
Stats pré-calculées pour queries instantanées.

```sql
CREATE TABLE app_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  period TEXT NOT NULL,              -- "daily" | "weekly" | "monthly"
  period_start DATE NOT NULL,
  
  stats JSONB NOT NULL,              -- {"com.spotify.client": {"total_ms": 3600000, "sessions": 5}, ...}
  computed_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, period, period_start)
);
```

#### Sync Strategy

```
Local (Rust)                          Supabase
    │                                     │
    ├─ AppSession stocké localement       │
    │  avec synced_at = null              │
    │                                     │
    ├─ Toutes les 10 min ────────────────►│ Batch INSERT
    │  + au quit de l'app                 │ ON CONFLICT DO NOTHING
    │                                     │
    └─ Mark synced_at = now()             │
```

**Gestion des doublons** : `UNIQUE(user_id, bundle_id, start_time)` + `ON CONFLICT DO NOTHING`

**Perte max en cas de crash** : 10 minutes de données (acceptable)
