//! App Usage Data Storage
//!
//! Stores and retrieves app usage statistics locally.
//! Similar pattern to browsing_data.rs but for native applications.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use once_cell::sync::Lazy;

/// Path to app usage data file
fn get_app_data_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".clarity").join("app-usage.json")
}

/// Path to blocked apps config file
fn get_blocked_apps_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".clarity").join("blocked-apps.json")
}

/// A single app usage session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSession {
    /// Bundle identifier (e.g., "com.spotify.client")
    pub bundle_id: String,
    /// App display name
    pub app_name: String,
    /// When the app became active (Unix timestamp ms)
    pub start_time: i64,
    /// When the app lost focus (Unix timestamp ms), None if still active
    pub end_time: Option<i64>,
    /// Duration in milliseconds (computed when session ends)
    pub duration_ms: Option<i64>,
    /// When this session was synced to Supabase (None = not synced)
    #[serde(default)]
    pub synced_at: Option<i64>,
}

/// Daily app usage summary
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DailyAppUsage {
    /// Date in YYYY-MM-DD format
    pub date: String,
    /// Total usage per app (bundle_id -> total_ms)
    pub usage_by_app: HashMap<String, i64>,
    /// App names for display (bundle_id -> name)
    pub app_names: HashMap<String, String>,
}

/// Stored app usage data
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppUsageData {
    /// Daily usage summaries (aggregated for display)
    pub daily_usage: Vec<DailyAppUsage>,
    /// Currently active session (if any)
    pub current_session: Option<AppSession>,
    /// Completed sessions pending sync to Supabase
    #[serde(default)]
    pub pending_sessions: Vec<AppSession>,
}

/// Blocked apps configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BlockedAppsConfig {
    /// List of blocked app bundle identifiers
    pub blocked_bundle_ids: Vec<String>,
    /// Whether blocking is currently active
    pub blocking_enabled: bool,
    /// Schedule: "always" | "scheduled" | "focus_mode"
    pub schedule: String,
    /// Start time for scheduled blocking (HH:MM)
    pub time_start: Option<String>,
    /// End time for scheduled blocking (HH:MM)
    pub time_end: Option<String>,
}

/// App usage statistics for display
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppUsageStats {
    /// Per-app usage for the period
    pub apps: Vec<AppUsageStat>,
    /// Total tracked time in milliseconds
    pub total_time_ms: i64,
    /// Number of days in the period
    pub days_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppUsageStat {
    pub bundle_id: String,
    pub app_name: String,
    pub total_time_ms: i64,
    pub percentage: f64,
}

// Global mutex for thread-safe access
static APP_DATA: Lazy<Mutex<AppUsageData>> = Lazy::new(|| {
    Mutex::new(load_app_data())
});

static BLOCKED_APPS: Lazy<Mutex<BlockedAppsConfig>> = Lazy::new(|| {
    Mutex::new(load_blocked_apps())
});

/// Load app usage data from disk
fn load_app_data() -> AppUsageData {
    let path = get_app_data_path();
    if let Ok(contents) = fs::read_to_string(&path) {
        if let Ok(data) = serde_json::from_str(&contents) {
            return data;
        }
    }
    AppUsageData::default()
}

/// Save app usage data to disk
fn save_app_data(data: &AppUsageData) {
    let path = get_app_data_path();
    
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    
    if let Ok(json) = serde_json::to_string_pretty(data) {
        let _ = fs::write(&path, json);
    }
}

/// Load blocked apps config from disk
fn load_blocked_apps() -> BlockedAppsConfig {
    let path = get_blocked_apps_path();
    if let Ok(contents) = fs::read_to_string(&path) {
        if let Ok(config) = serde_json::from_str(&contents) {
            return config;
        }
    }
    BlockedAppsConfig {
        blocked_bundle_ids: vec![],
        blocking_enabled: false,
        schedule: "always".to_string(),
        time_start: None,
        time_end: None,
    }
}

/// Save blocked apps config to disk
fn save_blocked_apps_config(config: &BlockedAppsConfig) {
    let path = get_blocked_apps_path();
    
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    
    if let Ok(json) = serde_json::to_string_pretty(config) {
        let _ = fs::write(&path, json);
    }
}

/// Record that an app became active
pub fn app_activated(bundle_id: String, app_name: String) {
    let now = chrono::Utc::now().timestamp_millis();
    
    let mut data = APP_DATA.lock().unwrap();
    
    // End any existing session first
    let prev_session = if let Some(ref mut session) = data.current_session {
        session.end_time = Some(now);
        session.duration_ms = Some(now - session.start_time);
        Some(session.clone())
    } else {
        None
    };
    
    // Add previous session to daily usage (after releasing the borrow)
    if let Some(session) = prev_session {
        add_to_daily_usage(&mut data, session);
    }
    
    // Start new session
    data.current_session = Some(AppSession {
        bundle_id,
        app_name,
        start_time: now,
        end_time: None,
        duration_ms: None,
        synced_at: None,
    });
    
    save_app_data(&data);
}

/// Record that an app was deactivated
pub fn app_deactivated(bundle_id: &str) {
    let now = chrono::Utc::now().timestamp_millis();
    
    let mut data = APP_DATA.lock().unwrap();
    
    // Check if current session matches and extract it
    let completed_session = if let Some(ref mut session) = data.current_session {
        if session.bundle_id == bundle_id {
            session.end_time = Some(now);
            session.duration_ms = Some(now - session.start_time);
            Some(session.clone())
        } else {
            None
        }
    } else {
        None
    };
    
    // Process the completed session
    if let Some(session) = completed_session {
        add_to_daily_usage(&mut data, session);
        data.current_session = None;
        save_app_data(&data);
    }
}

/// Add a completed session to daily usage and pending sync queue
fn add_to_daily_usage(data: &mut AppUsageData, session: AppSession) {
    // Use session START date, not current date
    // This fixes the bug where overnight sessions are attributed to the wrong day
    let session_date = chrono::DateTime::from_timestamp_millis(session.start_time)
        .map(|dt| dt.with_timezone(&chrono::Local).format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());
    
    let duration = session.duration_ms.unwrap_or(0);
    
    // Add to pending sessions for Supabase sync
    data.pending_sessions.push(session.clone());
    
    // Keep pending sessions manageable (max 1000)
    if data.pending_sessions.len() > 1000 {
        // Remove oldest synced sessions first, then oldest unsynced
        data.pending_sessions.retain(|s| s.synced_at.is_none());
        if data.pending_sessions.len() > 1000 {
            data.pending_sessions = data.pending_sessions.split_off(data.pending_sessions.len() - 1000);
        }
    }
    
    // Find or create the session's day entry (for aggregated display)
    let daily = data.daily_usage
        .iter_mut()
        .find(|d| d.date == session_date);
    
    if let Some(daily) = daily {
        // Update existing day
        *daily.usage_by_app.entry(session.bundle_id.clone()).or_insert(0) += duration;
        daily.app_names.insert(session.bundle_id, session.app_name);
    } else {
        // Create new day
        let mut usage_by_app = HashMap::new();
        usage_by_app.insert(session.bundle_id.clone(), duration);
        
        let mut app_names = HashMap::new();
        app_names.insert(session.bundle_id, session.app_name);
        
        data.daily_usage.push(DailyAppUsage {
            date: session_date,
            usage_by_app,
            app_names,
        });
    }
    
    // Keep only last 365 days of aggregated data
    if data.daily_usage.len() > 365 {
        data.daily_usage.sort_by(|a, b| b.date.cmp(&a.date));
        data.daily_usage.truncate(365);
    }
}

/// Get app usage stats for a period
pub fn get_app_usage_stats(period_days: Option<i32>) -> AppUsageStats {
    let data = APP_DATA.lock().unwrap();
    
    let cutoff_date = if let Some(days) = period_days {
        if days == 0 {
            // Today only
            chrono::Local::now().format("%Y-%m-%d").to_string()
        } else {
            let cutoff = chrono::Local::now() - chrono::Duration::days(days as i64);
            cutoff.format("%Y-%m-%d").to_string()
        }
    } else {
        "".to_string() // All time
    };
    
    // Aggregate usage
    let mut usage_totals: HashMap<String, i64> = HashMap::new();
    let mut app_names: HashMap<String, String> = HashMap::new();
    let mut days_count = 0;
    
    for daily in &data.daily_usage {
        if !cutoff_date.is_empty() && daily.date < cutoff_date {
            continue;
        }
        
        days_count += 1;
        
        for (bundle_id, duration) in &daily.usage_by_app {
            *usage_totals.entry(bundle_id.clone()).or_insert(0) += duration;
        }
        
        for (bundle_id, name) in &daily.app_names {
            app_names.insert(bundle_id.clone(), name.clone());
        }
    }
    
    // Include current session only if it's within the requested period
    if let Some(ref session) = data.current_session {
        let session_date = chrono::DateTime::from_timestamp_millis(session.start_time)
            .map(|dt| dt.with_timezone(&chrono::Local).format("%Y-%m-%d").to_string())
            .unwrap_or_default();
        
        // Check if session is within the requested period
        let include_session = if cutoff_date.is_empty() {
            true // All time - include everything
        } else if period_days == Some(0) {
            // Today only - session must have started today
            session_date == cutoff_date
        } else {
            // N days - session must be >= cutoff
            session_date >= cutoff_date
        };
        
        if include_session {
            let now = chrono::Utc::now().timestamp_millis();
            let current_duration = now - session.start_time;
            *usage_totals.entry(session.bundle_id.clone()).or_insert(0) += current_duration;
            app_names.insert(session.bundle_id.clone(), session.app_name.clone());
        }
    }
    
    let total_time_ms: i64 = usage_totals.values().sum();
    
    // Convert to sorted list
    let mut apps: Vec<AppUsageStat> = usage_totals
        .into_iter()
        .map(|(bundle_id, total_time_ms)| {
            let percentage = if total_time_ms > 0 {
                (total_time_ms as f64 / total_time_ms.max(1) as f64) * 100.0
            } else {
                0.0
            };
            
            AppUsageStat {
                app_name: app_names.get(&bundle_id).cloned().unwrap_or_else(|| bundle_id.clone()),
                bundle_id,
                total_time_ms,
                percentage,
            }
        })
        .collect();
    
    // Recalculate percentages with correct total
    for app in &mut apps {
        app.percentage = if total_time_ms > 0 {
            (app.total_time_ms as f64 / total_time_ms as f64) * 100.0
        } else {
            0.0
        };
    }
    
    // Sort by time descending
    apps.sort_by(|a, b| b.total_time_ms.cmp(&a.total_time_ms));
    
    AppUsageStats {
        apps,
        total_time_ms,
        days_count: days_count.max(1),
    }
}

/// Get the list of blocked apps
pub fn get_blocked_apps() -> BlockedAppsConfig {
    BLOCKED_APPS.lock().unwrap().clone()
}

/// Update the blocked apps list
pub fn set_blocked_apps(config: BlockedAppsConfig) {
    let mut blocked = BLOCKED_APPS.lock().unwrap();
    *blocked = config.clone();
    save_blocked_apps_config(&config);
}

/// Check if an app is currently blocked
pub fn is_app_blocked(bundle_id: &str) -> bool {
    let config = BLOCKED_APPS.lock().unwrap();
    
    if !config.blocking_enabled {
        return false;
    }
    
    // Check schedule
    if config.schedule == "scheduled" {
        if let (Some(start), Some(end)) = (&config.time_start, &config.time_end) {
            let now = chrono::Local::now();
            let current_time = now.format("%H:%M").to_string();
            
            // Simple time range check (doesn't handle overnight ranges)
            if !(current_time >= *start && current_time <= *end) {
                return false;
            }
        }
    }
    
    config.blocked_bundle_ids.contains(&bundle_id.to_string())
}

/// Clear all app usage data
pub fn clear_app_data() -> Result<(), String> {
    let mut data = APP_DATA.lock().map_err(|e| e.to_string())?;
    *data = AppUsageData::default();
    save_app_data(&data);
    Ok(())
}

// ============================================================================
// Supabase Sync Functions
// ============================================================================

/// Get all pending (unsynced) sessions
pub fn get_pending_sessions() -> Vec<AppSession> {
    let data = APP_DATA.lock().unwrap();
    data.pending_sessions
        .iter()
        .filter(|s| s.synced_at.is_none() && s.end_time.is_some())
        .cloned()
        .collect()
}

/// Mark sessions as synced (by start_time, which is unique per session)
pub fn mark_sessions_synced(start_times: &[i64]) {
    let now = chrono::Utc::now().timestamp_millis();
    let mut data = APP_DATA.lock().unwrap();
    
    for session in &mut data.pending_sessions {
        if start_times.contains(&session.start_time) {
            session.synced_at = Some(now);
        }
    }
    
    // Remove old synced sessions (keep last 100 for dedup reference)
    let mut synced: Vec<_> = data.pending_sessions
        .iter()
        .filter(|s| s.synced_at.is_some())
        .cloned()
        .collect();
    synced.sort_by(|a, b| b.synced_at.cmp(&a.synced_at));
    synced.truncate(100);
    
    let unsynced: Vec<_> = data.pending_sessions
        .iter()
        .filter(|s| s.synced_at.is_none())
        .cloned()
        .collect();
    
    data.pending_sessions = unsynced;
    data.pending_sessions.extend(synced);
    
    save_app_data(&data);
}

/// Get count of pending sessions
pub fn get_pending_count() -> usize {
    let data = APP_DATA.lock().unwrap();
    data.pending_sessions
        .iter()
        .filter(|s| s.synced_at.is_none() && s.end_time.is_some())
        .count()
}
