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
#[tauri::command]
fn get_browsing_stats() -> BrowsingStats {
    browsing_data::get_browsing_stats()
}

/// Clear all browsing data
/// Called from Settings to reset data
#[tauri::command]
fn clear_browsing_data() -> Result<(), String> {
    browsing_data::clear_browsing_data()
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
        .invoke_handler(tauri::generate_handler![greet, get_browsing_stats, clear_browsing_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
