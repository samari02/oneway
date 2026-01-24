//! Supabase Sync Module
//!
//! Handles syncing local app usage data to Supabase cloud storage.

use chrono::{TimeZone, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use once_cell::sync::Lazy;

// Supabase configuration
const SUPABASE_URL: &str = "https://yvftumjlqjddrduueneb.supabase.co";
const SUPABASE_ANON_KEY: &str = "sb_publishable_Tu3pL-oMVf9Dl7gtipXc9w_LZM2HyoN";

// HTTP client (reused for efficiency)
static HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .expect("Failed to create HTTP client")
});

// Auth state - set from frontend when user logs in
static AUTH_STATE: Lazy<Mutex<Option<AuthState>>> = Lazy::new(|| Mutex::new(None));

#[derive(Debug, Clone)]
struct AuthState {
    user_id: String,
    access_token: String,
}

/// Session data for Supabase insert
#[derive(Debug, Serialize)]
struct AppSessionInsert {
    user_id: String,
    bundle_id: String,
    app_name: String,
    platform: String,
    start_time: String,  // ISO 8601
    end_time: Option<String>,
    duration_ms: Option<i64>,
}

/// Blocked app data for Supabase insert
#[derive(Debug, Serialize)]
struct BlockedAppInsert {
    user_id: String,
    bundle_id: String,
    app_name: Option<String>,
    platform: String,
    blocking_enabled: bool,
    schedule: String,
    time_start: Option<String>,
    time_end: Option<String>,
}

/// Response from Supabase
#[derive(Debug, Deserialize)]
struct SupabaseError {
    message: String,
    #[serde(default)]
    code: String,
}

/// Set auth state from frontend
pub fn set_auth(user_id: String, access_token: String) {
    let mut auth = AUTH_STATE.lock().unwrap();
    eprintln!("[supabase] Auth set for user: {}", user_id);
    *auth = Some(AuthState { user_id, access_token });
}

/// Clear auth state (on logout)
pub fn clear_auth() {
    let mut auth = AUTH_STATE.lock().unwrap();
    *auth = None;
}

/// Check if authenticated
pub fn is_authenticated() -> bool {
    AUTH_STATE.lock().unwrap().is_some()
}

/// Get current user ID
pub fn get_user_id() -> Option<String> {
    AUTH_STATE.lock().unwrap().as_ref().map(|a| a.user_id.clone())
}

/// Sync completed sessions to Supabase
pub async fn sync_sessions(sessions: Vec<crate::app_data::AppSession>) -> Result<usize, String> {
    let auth = {
        let guard = AUTH_STATE.lock().unwrap();
        guard.clone().ok_or_else(|| "Not authenticated".to_string())?
    };
    
    if sessions.is_empty() {
        return Ok(0);
    }
    
    // Convert to Supabase format
    let inserts: Vec<AppSessionInsert> = sessions
        .iter()
        .filter(|s| s.end_time.is_some()) // Only sync completed sessions
        .map(|s| {
            let start = Utc.timestamp_millis_opt(s.start_time).unwrap();
            let end = s.end_time.map(|e| Utc.timestamp_millis_opt(e).unwrap());
            
            AppSessionInsert {
                user_id: auth.user_id.clone(),
                bundle_id: s.bundle_id.clone(),
                app_name: s.app_name.clone(),
                platform: "macos".to_string(),
                start_time: start.to_rfc3339(),
                end_time: end.map(|e| e.to_rfc3339()),
                duration_ms: s.duration_ms,
            }
        })
        .collect();
    
    if inserts.is_empty() {
        return Ok(0);
    }
    
    let count = inserts.len();
    
    // POST to Supabase REST API with upsert (ON CONFLICT DO NOTHING)
    let url = format!("{}/rest/v1/app_sessions", SUPABASE_URL);
    
    let response = HTTP_CLIENT
        .post(&url)
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", auth.access_token))
        .header("Content-Type", "application/json")
        .header("Prefer", "resolution=ignore-duplicates") // ON CONFLICT DO NOTHING
        .json(&inserts)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    if response.status().is_success() {
        eprintln!("[supabase] Synced {} sessions", count);
        Ok(count)
    } else {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        Err(format!("Supabase error {}: {}", status, body))
    }
}

/// Sync blocked apps config to Supabase
pub async fn sync_blocked_apps(config: &crate::app_data::BlockedAppsConfig) -> Result<(), String> {
    let auth = {
        let guard = AUTH_STATE.lock().unwrap();
        guard.clone().ok_or_else(|| "Not authenticated".to_string())?
    };
    
    // First, delete existing blocked apps for this user/platform
    let delete_url = format!(
        "{}/rest/v1/blocked_apps?user_id=eq.{}&platform=eq.macos",
        SUPABASE_URL, auth.user_id
    );
    
    let delete_response = HTTP_CLIENT
        .delete(&delete_url)
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", auth.access_token))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    if !delete_response.status().is_success() {
        let body = delete_response.text().await.unwrap_or_default();
        eprintln!("[supabase] Warning: Failed to delete old blocked apps: {}", body);
    }
    
    // Insert new blocked apps
    if !config.blocked_bundle_ids.is_empty() {
        let inserts: Vec<BlockedAppInsert> = config.blocked_bundle_ids
            .iter()
            .map(|bundle_id| BlockedAppInsert {
                user_id: auth.user_id.clone(),
                bundle_id: bundle_id.clone(),
                app_name: None, // Could be enhanced to store names
                platform: "macos".to_string(),
                blocking_enabled: config.blocking_enabled,
                schedule: config.schedule.clone(),
                time_start: config.time_start.clone(),
                time_end: config.time_end.clone(),
            })
            .collect();
        
        let url = format!("{}/rest/v1/blocked_apps", SUPABASE_URL);
        
        let response = HTTP_CLIENT
            .post(&url)
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Authorization", format!("Bearer {}", auth.access_token))
            .header("Content-Type", "application/json")
            .json(&inserts)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Failed to sync blocked apps: {}", body));
        }
    }
    
    eprintln!("[supabase] Synced blocked apps config");
    Ok(())
}

/// Fetch blocked apps from Supabase (for sync on startup)
pub async fn fetch_blocked_apps() -> Result<crate::app_data::BlockedAppsConfig, String> {
    let auth = {
        let guard = AUTH_STATE.lock().unwrap();
        guard.clone().ok_or_else(|| "Not authenticated".to_string())?
    };
    
    let url = format!(
        "{}/rest/v1/blocked_apps?user_id=eq.{}&platform=eq.macos&select=*",
        SUPABASE_URL, auth.user_id
    );
    
    let response = HTTP_CLIENT
        .get(&url)
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", auth.access_token))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Failed to fetch blocked apps: {}", body));
    }
    
    #[derive(Deserialize)]
    struct BlockedAppRow {
        bundle_id: String,
        blocking_enabled: bool,
        schedule: String,
        time_start: Option<String>,
        time_end: Option<String>,
    }
    
    let rows: Vec<BlockedAppRow> = response.json().await
        .map_err(|e| format!("Parse error: {}", e))?;
    
    if rows.is_empty() {
        return Ok(crate::app_data::BlockedAppsConfig::default());
    }
    
    // Use first row for config, collect all bundle_ids
    let first = &rows[0];
    Ok(crate::app_data::BlockedAppsConfig {
        blocked_bundle_ids: rows.iter().map(|r| r.bundle_id.clone()).collect(),
        blocking_enabled: first.blocking_enabled,
        schedule: first.schedule.clone(),
        time_start: first.time_start.clone(),
        time_end: first.time_end.clone(),
    })
}
