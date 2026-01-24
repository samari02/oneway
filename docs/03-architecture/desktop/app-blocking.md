# App Blocking — Desktop Architecture

> Système de monitoring et blocage d'applications natives macOS/Windows.

---

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DESKTOP APP (Tauri)                           │
│                                                                      │
│  ┌──────────────────┐     ┌──────────────────┐     ┌─────────────┐  │
│  │   app_monitor.rs │────▶│   app_data.rs    │────▶│  Supabase   │  │
│  │   (polling)      │     │   (storage)      │     │  (sync)     │  │
│  └──────────────────┘     └──────────────────┘     └─────────────┘  │
│           │                        │                                 │
│           ▼                        ▼                                 │
│  ┌──────────────────┐     ┌──────────────────┐                      │
│  │ osascript/Win32  │     │ ~/.clarity/*.json│                      │
│  │ (native APIs)    │     │ (local cache)    │                      │
│  └──────────────────┘     └──────────────────┘                      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    React Frontend                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │   │
│  │  │useAppBlocking│  │useAppUsage │  │ AppBlockingView.tsx │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Composants Rust

### `app_monitor.rs` — Monitoring & Blocking

Responsable de :
- Détecter l'app active (frontmost)
- Lister les apps en cours d'exécution
- Terminer les apps bloquées
- Extraire les icônes

#### APIs natives par plateforme

| Plateforme | API | Méthode |
|------------|-----|---------|
| **macOS** | `osascript` (AppleScript) | Shell commands |
| **Windows** | Win32 API | `GetForegroundWindow`, `EnumProcesses` |
| **Android** | `UsageStatsManager` | Java/Kotlin (future) |
| **iOS** | ❌ Bloqué par Apple | Non supporté |

#### Fonctions principales

```rust
/// Get the frontmost (active) application
pub fn get_frontmost_app() -> Option<(String, String)>
// Returns: (bundle_id, app_name)

/// Get list of all running applications
pub fn get_running_apps() -> Vec<(String, String)>
// Returns: [(bundle_id, app_name), ...]

/// Terminate an application by bundle ID
pub fn terminate_app(bundle_id: &str) -> bool

/// Start monitoring loop (500ms polling)
pub fn start_monitoring()

/// Stop monitoring
pub fn stop_monitoring()

/// Get app icon as base64 PNG (with cache)
pub fn get_app_icon_base64(bundle_id: &str) -> Option<String>
```

#### Monitoring Loop

```rust
// Polling toutes les 500ms
while MONITORING_ACTIVE {
    if let Some((bundle_id, app_name)) = get_frontmost_app() {
        // App changed?
        if bundle_id != last_app {
            // End previous session
            app_data::app_deactivated(&last_app);
            
            // Check if blocked
            if app_data::is_app_blocked(&bundle_id) {
                terminate_app(&bundle_id);
                show_block_notification(&app_name);
            } else {
                // Start new session
                app_data::app_activated(bundle_id, app_name);
            }
            
            last_app = bundle_id;
        }
    }
    
    thread::sleep(Duration::from_millis(500));
}
```

---

### `app_data.rs` — Data Storage & Sync

Responsable de :
- Stocker les sessions localement
- Calculer les stats d'usage
- Gérer la config de blocage
- Sync vers Supabase (TODO)

#### Data Structures

```rust
/// Une session d'utilisation d'app
pub struct AppSession {
    pub bundle_id: String,
    pub app_name: String,
    pub start_time: i64,        // Unix timestamp ms
    pub end_time: Option<i64>,
    pub duration_ms: Option<i64>,
    pub synced_at: Option<i64>, // null = not synced
}

/// Usage quotidien agrégé (legacy, pour migration)
pub struct DailyAppUsage {
    pub date: String,           // "2026-01-24"
    pub usage_by_app: HashMap<String, i64>,
    pub app_names: HashMap<String, String>,
}

/// Config de blocage
pub struct BlockedAppsConfig {
    pub blocked_bundle_ids: Vec<String>,
    pub blocking_enabled: bool,
    pub schedule: String,       // "always" | "scheduled"
    pub time_start: Option<String>,
    pub time_end: Option<String>,
}
```

#### Fichiers locaux

| Fichier | Contenu | Sync Supabase |
|---------|---------|---------------|
| `~/.clarity/app-usage.json` | Sessions & usage | ✅ Oui |
| `~/.clarity/blocked-apps.json` | Config blocage | ✅ Oui |
| `~/.clarity/icon-cache.json` | Cache icônes base64 | ❌ Non (local only) |

---

## Tauri Commands

Commands exposées au frontend React :

```rust
// Usage stats
#[tauri::command]
fn get_app_usage_stats(period: Option<String>) -> AppUsageStats

// Running apps
#[tauri::command]
fn get_running_apps() -> Vec<(String, String)>

#[tauri::command]
fn get_frontmost_app() -> Option<(String, String)>

// Blocking config
#[tauri::command]
fn get_blocked_apps() -> BlockedAppsConfig

#[tauri::command]
fn set_blocked_apps(config: BlockedAppsConfig) -> Result<(), String>

// Monitoring control
#[tauri::command]
fn start_app_monitoring() -> Result<(), String>

#[tauri::command]
fn stop_app_monitoring() -> Result<(), String>

#[tauri::command]
fn is_app_monitoring_active() -> bool

// Icons
#[tauri::command]
fn get_app_icon(bundle_id: String) -> Option<String>

// Data management
#[tauri::command]
fn clear_app_usage_data() -> Result<(), String>
```

---

## React Frontend

### Hooks

#### `useAppBlocking`
Gestion de la config de blocage et du monitoring.

```typescript
const {
  config,           // BlockedAppsConfig
  loading,
  isMonitoring,     // boolean
  setBlockedApps,   // (bundleIds: string[]) => Promise<void>
  setBlockingEnabled, // (enabled: boolean) => Promise<void>
  startMonitoring,
  stopMonitoring,
} = useAppBlocking()
```

#### `useAppUsage`
Stats d'usage des apps.

```typescript
const { stats, loading, refetch } = useAppUsage(period)
// period: "today" | "7days" | "30days" | "90days" | "all"

// stats: AppUsageStats
// {
//   apps: [{ bundle_id, app_name, total_time_ms, percentage }],
//   total_time_ms: number,
//   days_count: number
// }
```

#### `useRunningApps`
Liste des apps en cours (fetch à la demande).

```typescript
const { 
  apps,       // Array<[bundleId, appName]>
  loading, 
  hasLoaded,
  refetch 
} = useRunningApps(enabled)
```

#### `useAppIcons`
Cache d'icônes côté frontend.

```typescript
const { fetchIcon, getIcon } = useAppIcons()

// fetchIcon(bundleId) - Fetch et cache l'icône
// getIcon(bundleId) -> string | null - Récupère du cache
```

### Components

#### `AppBlockingView.tsx`
Vue principale avec :
- Master toggle ON/OFF
- Status indicator (monitoring active)
- Tabs : Blocked Apps | Usage Today
- Suggested apps grid (avec vraies icônes macOS)
- Currently blocked list
- Currently running (collapsible, lazy load)
- Usage stats avec barres de progression

---

## Sync Strategy

### Local → Supabase

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Session   │     │   Local     │     │  Supabase   │
│   Created   │────▶│   Buffer    │────▶│   Sync      │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                    Toutes les 10 min
                    + Au quit de l'app
```

### Gestion des doublons

```sql
-- Contrainte unique
UNIQUE(user_id, bundle_id, start_time)

-- Insert qui ignore les doublons
INSERT INTO app_sessions (...) 
ON CONFLICT (user_id, bundle_id, start_time) DO NOTHING;
```

### Gestion offline

1. Sessions stockées localement avec `synced_at = null`
2. Au sync, batch insert vers Supabase
3. Mark `synced_at = now()` après succès
4. Retry automatique si échec

---

## Performance

### Icon Cache

Les icônes macOS (.icns) sont :
1. Converties en PNG 64x64 via `sips`
2. Encodées en base64
3. Cachées dans `~/.clarity/icon-cache.json`
4. Servies instantanément après premier fetch

### Lazy Loading

La section "Currently Running" :
- Collapsée par défaut
- Fetch seulement quand ouverte
- Évite ~1s de lag au chargement initial

### Query Performance

```sql
-- Index optimal pour queries utilisateur
CREATE INDEX idx_app_sessions_user_time 
  ON app_sessions(user_id, start_time DESC);

-- Query typique : ~5-10ms même avec 100K+ rows
SELECT bundle_id, SUM(duration_ms)
FROM app_sessions
WHERE user_id = $1 AND start_time > now() - interval '7 days'
GROUP BY bundle_id;
```

---

## Roadmap

| Phase | Plateforme | Status |
|-------|------------|--------|
| 1 | macOS | ✅ Implémenté |
| 2 | Supabase Sync | 🔜 À faire |
| 3 | Windows | 📋 Planifié |
| 4 | Android | 📋 Planifié |
| 5 | iOS | ❌ Bloqué par Apple |

---

## Fichiers

| Fichier | Description |
|---------|-------------|
| `src-tauri/src/app_monitor.rs` | Monitoring & native APIs |
| `src-tauri/src/app_data.rs` | Storage & data structures |
| `src-tauri/src/lib.rs` | Tauri commands |
| `src/features/app-blocking/hooks/useAppBlocking.ts` | Hook config |
| `src/features/app-blocking/hooks/useAppUsage.ts` | Hook stats |
| `src/features/app-blocking/components/AppBlockingView.tsx` | UI principale |
