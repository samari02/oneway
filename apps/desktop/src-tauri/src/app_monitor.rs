//! macOS App Monitor
//!
//! Uses osascript/AppleScript to monitor application activations.
//! Tracks usage time and can block specified applications.
//!
//! Note: Uses shell commands for simplicity and robustness.
//! Can be upgraded to native NSWorkspace bindings later for better performance.

use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use std::path::PathBuf;

use crate::app_data;

/// Global flag to control monitoring
static MONITORING_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Get the frontmost application info using AppleScript
/// Returns (bundle_id, app_name) or None if failed
#[cfg(target_os = "macos")]
pub fn get_frontmost_app() -> Option<(String, String)> {
    // Get app name
    let name_output = Command::new("osascript")
        .arg("-e")
        .arg(r#"tell application "System Events" to get name of first process whose frontmost is true"#)
        .output()
        .ok()?;
    
    let app_name = String::from_utf8_lossy(&name_output.stdout)
        .trim()
        .to_string();
    
    if app_name.is_empty() {
        return None;
    }
    
    // Get bundle identifier
    let bundle_output = Command::new("osascript")
        .arg("-e")
        .arg(format!(
            r#"id of application "{}" as string"#,
            app_name.replace("\"", "\\\"")
        ))
        .output()
        .ok()?;
    
    let bundle_id = String::from_utf8_lossy(&bundle_output.stdout)
        .trim()
        .to_string();
    
    // If we can't get bundle id, use app name as fallback
    let bundle_id = if bundle_id.is_empty() {
        format!("app.{}", app_name.to_lowercase().replace(" ", "-"))
    } else {
        bundle_id
    };
    
    Some((bundle_id, app_name))
}

/// Get list of all running applications
#[cfg(target_os = "macos")]
pub fn get_running_apps() -> Vec<(String, String)> {
    let output = Command::new("osascript")
        .arg("-e")
        .arg(r#"
            tell application "System Events"
                set appList to {}
                repeat with proc in (every process whose background only is false)
                    try
                        set appName to name of proc
                        set end of appList to appName
                    end try
                end repeat
                return appList
            end tell
        "#)
        .output();
    
    let mut apps = Vec::new();
    
    if let Ok(output) = output {
        let output_str = String::from_utf8_lossy(&output.stdout);
        
        // Parse the comma-separated list
        for app_name in output_str.split(", ") {
            let app_name = app_name.trim();
            if !app_name.is_empty() {
                // Try to get bundle ID
                let bundle_id = get_app_bundle_id(app_name)
                    .unwrap_or_else(|| format!("app.{}", app_name.to_lowercase().replace(" ", "-")));
                apps.push((bundle_id, app_name.to_string()));
            }
        }
    }
    
    apps
}

/// Get bundle ID for an app name
#[cfg(target_os = "macos")]
fn get_app_bundle_id(app_name: &str) -> Option<String> {
    let output = Command::new("osascript")
        .arg("-e")
        .arg(format!(
            r#"id of application "{}" as string"#,
            app_name.replace("\"", "\\\"")
        ))
        .output()
        .ok()?;
    
    let bundle_id = String::from_utf8_lossy(&output.stdout)
        .trim()
        .to_string();
    
    if bundle_id.is_empty() {
        None
    } else {
        Some(bundle_id)
    }
}

/// Terminate an application by name or bundle ID
#[cfg(target_os = "macos")]
pub fn terminate_app(bundle_id: &str) -> bool {
    // First try to quit gracefully using bundle ID
    let quit_result = Command::new("osascript")
        .arg("-e")
        .arg(format!(
            r#"tell application id "{}" to quit"#,
            bundle_id.replace("\"", "\\\"")
        ))
        .output();
    
    if quit_result.is_ok() {
        eprintln!("[AppMonitor] Sent quit to app: {}", bundle_id);
        return true;
    }
    
    // Fallback: force kill using pkill
    let kill_result = Command::new("pkill")
        .arg("-f")
        .arg(bundle_id)
        .output();
    
    kill_result.is_ok()
}

/// Start monitoring app activations using polling
#[cfg(target_os = "macos")]
pub fn start_monitoring() {
    if MONITORING_ACTIVE.swap(true, Ordering::SeqCst) {
        eprintln!("[AppMonitor] Already monitoring");
        return;
    }
    
    eprintln!("[AppMonitor] Starting app monitoring");
    
    thread::spawn(|| {
        let mut last_app: Option<String> = None;
        
        while MONITORING_ACTIVE.load(Ordering::SeqCst) {
            if let Some((bundle_id, app_name)) = get_frontmost_app() {
                // Check if app changed
                let changed = match &last_app {
                    Some(last) => last != &bundle_id,
                    None => true,
                };
                
                if changed {
                    // Deactivate previous app
                    if let Some(ref prev) = last_app {
                        app_data::app_deactivated(prev);
                    }
                    
                    // Check if this app should be blocked
                    if app_data::is_app_blocked(&bundle_id) {
                        eprintln!("[AppMonitor] Blocked app detected: {} ({})", app_name, bundle_id);
                        
                        // Terminate the blocked app
                        if terminate_app(&bundle_id) {
                            show_block_notification(&app_name);
                        }
                    } else {
                        // Record activation
                        eprintln!("[AppMonitor] App activated: {} ({})", app_name, bundle_id);
                        app_data::app_activated(bundle_id.clone(), app_name);
                    }
                    
                    last_app = Some(bundle_id);
                }
            }
            
            // Poll every 500ms
            thread::sleep(Duration::from_millis(500));
        }
        
        // End final session when stopping
        if let Some(ref prev) = last_app {
            app_data::app_deactivated(prev);
        }
        
        eprintln!("[AppMonitor] Monitoring stopped");
    });
}

/// Stop monitoring app activations
pub fn stop_monitoring() {
    MONITORING_ACTIVE.store(false, Ordering::SeqCst);
    eprintln!("[AppMonitor] Stopping app monitoring");
}

/// Check if monitoring is active
pub fn is_monitoring() -> bool {
    MONITORING_ACTIVE.load(Ordering::SeqCst)
}

/// Show a notification that an app was blocked
#[cfg(target_os = "macos")]
fn show_block_notification(app_name: &str) {
    let message = format!("{} was blocked by Oneway", app_name);
    let script = format!(
        r#"display notification "{}" with title "App Blocked" sound name "Basso""#,
        message.replace("\"", "\\\"")
    );
    
    let _ = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .spawn();
}

/// Get the icon path for an app by bundle ID
#[cfg(target_os = "macos")]
pub fn get_app_icon_path(bundle_id: &str) -> Option<String> {
    // First, find the app path using the bundle ID
    let output = Command::new("mdfind")
        .arg(format!("kMDItemCFBundleIdentifier == '{}'", bundle_id))
        .output()
        .ok()?;
    
    let app_path = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()?
        .trim()
        .to_string();
    
    if app_path.is_empty() {
        return None;
    }
    
    // Get the icon file name from Info.plist
    let icon_output = Command::new("defaults")
        .arg("read")
        .arg(format!("{}/Contents/Info", app_path))
        .arg("CFBundleIconFile")
        .output()
        .ok()?;
    
    let icon_name = String::from_utf8_lossy(&icon_output.stdout)
        .trim()
        .to_string();
    
    if icon_name.is_empty() {
        // Try default icon name
        let default_icon = format!("{}/Contents/Resources/AppIcon.icns", app_path);
        if std::path::Path::new(&default_icon).exists() {
            return Some(default_icon);
        }
        return None;
    }
    
    // Add .icns extension if not present
    let icon_file = if icon_name.ends_with(".icns") {
        icon_name
    } else {
        format!("{}.icns", icon_name)
    };
    
    let icon_path = format!("{}/Contents/Resources/{}", app_path, icon_file);
    
    if std::path::Path::new(&icon_path).exists() {
        Some(icon_path)
    } else {
        None
    }
}

/// Get app info with icon path
#[cfg(target_os = "macos")]
pub fn get_app_info(bundle_id: &str) -> Option<(String, String, Option<String>)> {
    // Get app name
    let name_output = Command::new("osascript")
        .arg("-e")
        .arg(format!(
            r#"tell application "System Events" to get name of first process whose bundle identifier is "{}""#,
            bundle_id.replace("\"", "\\\"")
        ))
        .output()
        .ok()?;
    
    let app_name = String::from_utf8_lossy(&name_output.stdout)
        .trim()
        .to_string();
    
    if app_name.is_empty() {
        return None;
    }
    
    let icon_path = get_app_icon_path(bundle_id);
    
    Some((bundle_id.to_string(), app_name, icon_path))
}

/// Get app icon as base64 PNG
/// Returns a data URL that can be used directly in img src
#[cfg(target_os = "macos")]
pub fn get_app_icon_base64(bundle_id: &str) -> Option<String> {
    use std::fs;
    use std::io::Read;
    
    let icon_path = get_app_icon_path(bundle_id)?;
    
    // Create temp file for the PNG output
    let temp_dir = std::env::temp_dir();
    let temp_png = temp_dir.join(format!("icon_{}.png", bundle_id.replace(".", "_")));
    
    // Use sips to convert icns to 64x64 PNG
    let sips_result = Command::new("sips")
        .arg("-s")
        .arg("format")
        .arg("png")
        .arg("-z")
        .arg("64")
        .arg("64")
        .arg(&icon_path)
        .arg("--out")
        .arg(&temp_png)
        .output();
    
    if sips_result.is_err() {
        return None;
    }
    
    // Read the PNG file
    let mut file = fs::File::open(&temp_png).ok()?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).ok()?;
    
    // Clean up temp file
    let _ = fs::remove_file(&temp_png);
    
    // Encode as base64 data URL
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let base64_data = STANDARD.encode(&buffer);
    
    Some(format!("data:image/png;base64,{}", base64_data))
}

// Stub implementations for non-macOS platforms
#[cfg(not(target_os = "macos"))]
pub fn get_frontmost_app() -> Option<(String, String)> {
    None
}

#[cfg(not(target_os = "macos"))]
pub fn get_running_apps() -> Vec<(String, String)> {
    Vec::new()
}

#[cfg(not(target_os = "macos"))]
pub fn terminate_app(_bundle_id: &str) -> bool {
    false
}

#[cfg(not(target_os = "macos"))]
pub fn start_monitoring() {
    eprintln!("[AppMonitor] Not supported on this platform");
}

#[cfg(not(target_os = "macos"))]
pub fn get_app_icon_path(_bundle_id: &str) -> Option<String> {
    None
}

#[cfg(not(target_os = "macos"))]
pub fn get_app_info(_bundle_id: &str) -> Option<(String, String, Option<String>)> {
    None
}

#[cfg(not(target_os = "macos"))]
pub fn get_app_icon_base64(_bundle_id: &str) -> Option<String> {
    None
}
