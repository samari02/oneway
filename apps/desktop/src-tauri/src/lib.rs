mod browsing_data;
mod blocking_lock;
mod native_host;
mod custom_rules_file;
mod app_data;
mod app_monitor;
mod supabase_sync;

use browsing_data::BrowsingStats;
use app_data::{AppUsageStats, BlockedAppsConfig};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

// Sync thread control
static SYNC_RUNNING: AtomicBool = AtomicBool::new(false);

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Get browsing stats from local storage
/// Called by React frontend to display insights
/// period: "today" | "7days" | "30days" | "90days" | "180days" | "365days" | "all"
#[tauri::command]
fn get_browsing_stats(period: Option<String>) -> BrowsingStats {
    let period_days = match period.as_deref() {
        Some("today") => Some(0),  // 0 = start of today (midnight local time)
        Some("7days") => Some(7),
        Some("30days") => Some(30),
        Some("90days") => Some(90),
        Some("180days") => Some(180),
        Some("365days") => Some(365),
        _ => None, // "all" or missing
    };

    browsing_data::get_browsing_stats(period_days)
}

/// Clear all browsing data
/// Called from Settings to reset data
#[tauri::command]
fn clear_browsing_data() -> Result<(), String> {
    browsing_data::clear_browsing_data()
}

/// Remove all local visits, block events, and classification for one domain (does not sync to cloud).
#[tauri::command]
fn delete_browsing_data_for_domain(domain: String) -> Result<browsing_data::DeleteSiteStats, String> {
    browsing_data::delete_data_for_domain(&domain)
}

/// Domains present in local browsing storage (for Settings search / delete UI).
#[tauri::command]
fn list_tracked_domains() -> Vec<String> {
    browsing_data::list_tracked_domains()
}

/// Save user site classifications
/// classifications: { "domain.com": "productive" | "neutral" | "distraction" }
#[tauri::command]
fn save_site_classifications(classifications: std::collections::HashMap<String, String>) -> Result<(), String> {
    browsing_data::save_site_classifications(classifications)
}

/// Get user site classifications
#[tauri::command]
fn get_site_classifications() -> std::collections::HashMap<String, String> {
    browsing_data::get_site_classifications()
}

/// Get extension connection and protection status
#[tauri::command]
fn get_extension_status() -> native_host::ExtensionStatus {
    native_host::get_extension_status()
}

/// Get Aoi widget preferences (from local file, synced by native host)
#[tauri::command]
fn get_aoi_preferences() -> native_host::AoiPreferencesData {
    native_host::get_aoi_preferences()
}

// ============================================================================
// App Monitoring & Blocking Commands
// ============================================================================

/// Get app usage stats for a period
/// period: "today" | "7days" | "30days" | "90days" | "all"
#[tauri::command]
fn get_app_usage_stats(period: Option<String>) -> AppUsageStats {
    let period_days = match period.as_deref() {
        Some("today") => Some(0),
        Some("7days") => Some(7),
        Some("30days") => Some(30),
        Some("90days") => Some(90),
        _ => None, // "all" or missing
    };
    
    app_data::get_app_usage_stats(period_days)
}

/// Get list of all running applications
#[tauri::command]
fn get_running_apps() -> Vec<(String, String)> {
    app_monitor::get_running_apps()
}

/// Get the currently active (frontmost) application
#[tauri::command]
fn get_frontmost_app() -> Option<(String, String)> {
    app_monitor::get_frontmost_app()
}

/// Get blocked apps configuration
#[tauri::command]
fn get_blocked_apps() -> BlockedAppsConfig {
    app_data::get_blocked_apps()
}

/// Set blocked apps configuration
#[tauri::command]
fn set_blocked_apps(config: BlockedAppsConfig) -> Result<(), String> {
    app_data::set_blocked_apps(config);
    Ok(())
}

/// Start app monitoring (tracking usage + blocking)
#[tauri::command]
fn start_app_monitoring() -> Result<(), String> {
    app_monitor::start_monitoring();
    Ok(())
}

/// Stop app monitoring
#[tauri::command]
fn stop_app_monitoring() -> Result<(), String> {
    app_monitor::stop_monitoring();
    Ok(())
}

/// Check if app monitoring is active
#[tauri::command]
fn is_app_monitoring_active() -> bool {
    app_monitor::is_monitoring()
}

/// Clear all app usage data
#[tauri::command]
fn clear_app_usage_data() -> Result<(), String> {
    app_data::clear_app_data()
}

/// Get app icon as base64 data URL
#[tauri::command]
fn get_app_icon(bundle_id: String) -> Option<String> {
    app_monitor::get_app_icon_base64(&bundle_id)
}

// ============================================================================
// Supabase Sync Commands
// ============================================================================

/// Set authentication for Supabase sync
/// Called by frontend after user logs in
#[tauri::command]
fn set_supabase_auth(user_id: String, access_token: String) -> Result<(), String> {
    supabase_sync::set_auth(user_id, access_token);
    
    // Start periodic sync if not already running
    start_periodic_sync();
    
    Ok(())
}

/// Clear authentication (on logout)
#[tauri::command]
fn clear_supabase_auth() {
    supabase_sync::clear_auth();
    SYNC_RUNNING.store(false, Ordering::SeqCst);
}

/// Check if Supabase is authenticated
#[tauri::command]
fn is_supabase_authenticated() -> bool {
    supabase_sync::is_authenticated()
}

/// Get count of pending sessions to sync
#[tauri::command]
fn get_pending_sync_count() -> usize {
    app_data::get_pending_count()
}

/// Manually trigger sync (for testing or user-initiated)
#[tauri::command]
async fn sync_app_sessions_now() -> Result<usize, String> {
    let pending = app_data::get_pending_sessions();
    if pending.is_empty() {
        return Ok(0);
    }
    
    let start_times: Vec<i64> = pending.iter().map(|s| s.start_time).collect();
    
    match supabase_sync::sync_sessions(pending).await {
        Ok(count) => {
            // Mark as synced
            app_data::mark_sessions_synced(&start_times);
            Ok(count)
        }
        Err(e) => Err(e)
    }
}

/// Sync blocked apps config to Supabase
#[tauri::command]
async fn sync_blocked_apps_now() -> Result<(), String> {
    let config = app_data::get_blocked_apps();
    supabase_sync::sync_blocked_apps(&config).await
}

/// Start periodic sync thread (every 10 minutes)
fn start_periodic_sync() {
    // Only start if not already running
    if SYNC_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    
    thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create runtime");
        
        while SYNC_RUNNING.load(Ordering::SeqCst) {
            // Wait 10 minutes
            thread::sleep(Duration::from_secs(600));
            
            if !SYNC_RUNNING.load(Ordering::SeqCst) {
                break;
            }
            
            if !supabase_sync::is_authenticated() {
                continue;
            }
            
            // Sync pending sessions
            let pending = app_data::get_pending_sessions();
            if !pending.is_empty() {
                let start_times: Vec<i64> = pending.iter().map(|s| s.start_time).collect();
                
                rt.block_on(async {
                    match supabase_sync::sync_sessions(pending).await {
                        Ok(count) => {
                            app_data::mark_sessions_synced(&start_times);
                            eprintln!("[sync] Synced {} sessions", count);
                        }
                        Err(e) => {
                            eprintln!("[sync] Failed to sync: {}", e);
                        }
                    }
                });
            }
        }
        
        eprintln!("[sync] Periodic sync stopped");
    });
}

/// Persist custom blocking rules JSON (same shape as Supabase rows) for the native host.
#[tauri::command]
fn write_custom_rules_to_disk(rules: serde_json::Value) -> Result<(), String> {
    custom_rules_file::write_rules_json(rules)
}

// --- Blocking list lock (local password + timed unlock) ---

#[tauri::command]
fn blocking_lock_get_status() -> blocking_lock::BlockingLockStatus {
    blocking_lock::get_status()
}

#[tauri::command]
fn blocking_lock_set_password(new_password: String, current_password: Option<String>) -> Result<(), String> {
    let cur = current_password.as_deref();
    blocking_lock::set_password(&new_password, cur)
}

#[tauri::command]
fn blocking_lock_verify_unlock(password: String) -> Result<(), String> {
    blocking_lock::verify_and_unlock(&password)
}

#[tauri::command]
fn blocking_lock_relock() {
    blocking_lock::relock();
}

#[tauri::command]
fn blocking_lock_set_friction() -> Result<(), String> {
    blocking_lock::set_friction_lock()
}

#[tauri::command]
fn blocking_lock_clear(password: Option<String>) -> Result<(), String> {
    blocking_lock::clear_lock_file(password.as_deref())
}

#[tauri::command]
fn blocking_lock_friction_start() -> Result<blocking_lock::FrictionChallengeStart, String> {
    blocking_lock::friction_challenge_start()
}

#[tauri::command]
fn blocking_lock_friction_submit(challenge_id: String, answers: Vec<u8>) -> Result<(), String> {
    blocking_lock::friction_challenge_submit(challenge_id, answers)
}

/// Save Aoi widget preferences (to local file, will be read by native host)
#[tauri::command]
fn save_aoi_preferences(hidden_global: bool, hidden_domains: Vec<String>) -> Result<(), String> {
    let prefs = native_host::AoiPreferencesData {
        hidden_global,
        hidden_domains,
    };
    
    // Save to local file (native host will read this)
    native_host::save_aoi_preferences_external(&prefs);
    
    Ok(())
}

/// Check if running as native messaging host
pub fn is_native_host_mode() -> bool {
    std::env::args().any(|arg| arg == "--native-host")
}

/// Run as native messaging host (called from main.rs)
pub fn run_as_native_host() {
    native_host::run_native_host();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            get_browsing_stats, 
            clear_browsing_data,
            delete_browsing_data_for_domain,
            list_tracked_domains,
            save_site_classifications,
            get_site_classifications,
            get_extension_status,
            get_aoi_preferences,
            save_aoi_preferences,
            write_custom_rules_to_disk,
            blocking_lock_get_status,
            blocking_lock_set_password,
            blocking_lock_verify_unlock,
            blocking_lock_relock,
            blocking_lock_set_friction,
            blocking_lock_clear,
            blocking_lock_friction_start,
            blocking_lock_friction_submit,
            // App monitoring & blocking
            get_app_usage_stats,
            get_running_apps,
            get_frontmost_app,
            get_blocked_apps,
            set_blocked_apps,
            start_app_monitoring,
            stop_app_monitoring,
            is_app_monitoring_active,
            clear_app_usage_data,
            get_app_icon,
            // Supabase sync
            set_supabase_auth,
            clear_supabase_auth,
            is_supabase_authenticated,
            get_pending_sync_count,
            sync_app_sessions_now,
            sync_blocked_apps_now
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
