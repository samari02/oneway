mod browsing_data;
mod native_host;
mod app_data;
mod app_monitor;

use browsing_data::BrowsingStats;
use app_data::{AppUsageStats, BlockedAppsConfig};

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
            save_site_classifications,
            get_site_classifications,
            get_extension_status,
            get_aoi_preferences,
            save_aoi_preferences,
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
            get_app_icon
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
