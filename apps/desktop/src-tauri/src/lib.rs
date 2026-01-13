mod browsing_data;
mod native_host;

use browsing_data::BrowsingStats;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Get browsing stats from local storage
/// Called by React frontend to display insights
/// period: "today" | "7days" | "30days" | "90days" | "all"
#[tauri::command]
fn get_browsing_stats(period: Option<String>) -> BrowsingStats {
    let period_days = match period.as_deref() {
        Some("today") => Some(1),
        Some("7days") => Some(7),
        Some("30days") => Some(30),
        Some("90days") => Some(90),
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
            get_site_classifications
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
