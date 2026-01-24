# Data Architecture

> Architecture de la couche données : Supabase, storage local, pipelines de sync.

---

## Documents

| Document | Description |
|----------|-------------|
| [database.md](./database.md) | Schema Supabase complet |
| [data-pipeline.md](./data-pipeline.md) | Pipeline Extension → Desktop → Cloud |

---

## Stack

| Layer | Technology |
|-------|------------|
| **Cloud DB** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (Magic Link) |
| **Local Storage** | JSON files (`~/.clarity/`) |
| **ORM** | Raw SQL + Supabase JS Client |
| **Sync** | Periodic batch (10 min) |

---

## Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Sources    │     │    Local     │     │   Supabase   │
│              │────▶│   Storage    │────▶│   (Cloud)    │
└──────────────┘     └──────────────┘     └──────────────┘

Sources:
├── Extension (navigation)
├── Desktop (app usage)
└── User input (habits, goals)

Local Storage (~/.clarity/):
├── app-usage.json
├── blocked-apps.json
├── icon-cache.json
├── extension-status.json
└── clarity-data/
    ├── visits.jsonl
    └── blocks.jsonl
```

---

## Tables Supabase

### Core

| Table | Description | Pattern |
|-------|-------------|---------|
| `habits` | Config habitudes | Config |
| `habit_check_ins` | Check-ins quotidiens | Agrégé journalier |
| `goals` | Objectifs avec progression | Config |
| `user_settings` | Préférences utilisateur | Config |

### Blocking (Web)

| Table | Description | Pattern |
|-------|-------------|---------|
| `blocking_rules` | Règles de blocage sites | Config |
| `blocking_state` | État actuel du blocage | State |

### Navigation

| Table | Description | Pattern |
|-------|-------------|---------|
| `navigation_history` | Visites web (granulaire) | Granulaire |
| `navigation_stats` | Stats pré-calculées | Agrégé |

### App Usage (à venir)

| Table | Description | Pattern |
|-------|-------------|---------|
| `app_sessions` | Sessions apps (granulaire) | Granulaire |
| `blocked_apps` | Config apps bloquées | Config |
| `app_usage_stats` | Stats pré-calculées | Agrégé |

### AI

| Table | Description | Pattern |
|-------|-------------|---------|
| `ai_conversations` | Historique conversations | Data |

---

## Patterns de données

### Granulaire
- 1 row par événement (visite, session)
- Full détail temporel
- Volume élevé (~50 rows/jour/user)
- Exemple : `navigation_history`, `app_sessions`

### Agrégé
- 1 row par entité par période
- Totaux seulement
- Volume faible (~10 rows/jour/user)
- Exemple : `habit_check_ins`

### Config
- 1 row par entité
- Données de configuration
- Rarement modifié
- Exemple : `habits`, `user_settings`

---

## Sync Strategy

### Periodic Sync (10 min)

```rust
async fn sync_job() {
    // 1. Get unsynced data
    let unsynced = get_unsynced_sessions();
    
    // 2. Batch insert to Supabase
    supabase.insert_batch("app_sessions", unsynced)
        .on_conflict_do_nothing();
    
    // 3. Mark as synced
    mark_synced(unsynced);
}
```

### Deduplication

```sql
-- Contrainte unique évite les doublons
UNIQUE(user_id, bundle_id, start_time)

-- Insert ignore les conflits
INSERT ... ON CONFLICT DO NOTHING;
```

### Offline Support

1. Toutes les données stockées localement d'abord
2. Sync en background quand connecté
3. Retry automatique si échec
4. Pas de perte de données

---

## Performance

### Indexes

```sql
-- Queries par utilisateur + temps (le plus fréquent)
CREATE INDEX idx_sessions_user_time 
  ON app_sessions(user_id, start_time DESC);

-- Queries par utilisateur + app
CREATE INDEX idx_sessions_user_bundle 
  ON app_sessions(user_id, bundle_id);
```

### Query Performance

| Rows total | Rows pour 1 user (7j) | Temps query |
|------------|----------------------|-------------|
| 1M | ~350 | ~5 ms |
| 10M | ~350 | ~10 ms |
| 100M | ~350 | ~15 ms |

### Stats pré-calculées (optionnel)

Pour queries < 1ms :
```sql
CREATE TABLE app_usage_stats (
  user_id, period, period_start,
  stats JSONB  -- {"app": {"total_ms": X, "sessions": Y}}
);
```

---

## Row Level Security

Toutes les tables ont RLS :

```sql
CREATE POLICY "Users own data"
  ON table_name FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## Voir aussi

- [Desktop Architecture](../desktop/) — Storage local et sync
- [Extension Architecture](../extension/) — Collecte de données navigation
