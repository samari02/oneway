//! Native Messaging Host for Chrome Extension Communication
//!
//! This module handles the Chrome Native Messaging protocol:
//! - Reads JSON messages from stdin (prefixed with 4-byte length)
//! - Writes JSON responses to stdout (prefixed with 4-byte length)
//!
//! Protocol: https://developer.chrome.com/docs/apps/nativeMessaging/

use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};
use std::fs;
use std::path::PathBuf;

use crate::browsing_data::{self, StoredVisit};

/// Global state for extension connection status
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExtensionStatus {
    pub connected: bool,
    pub last_seen: i64,
    pub incognito_enabled: bool,
    pub safe_search_enforced: bool,
    pub search_filter_active: bool,
    pub blocked_searches_today: i32,
}

/// Get the path to the extension status file (shared between processes)
fn get_status_file_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".clarity").join("extension-status.json")
}

/// Get the current extension status (reads from shared file)
pub fn get_extension_status() -> ExtensionStatus {
    let path = get_status_file_path();
    
    if let Ok(contents) = fs::read_to_string(&path) {
        if let Ok(status) = serde_json::from_str::<ExtensionStatus>(&contents) {
            return status;
        }
    }
    
    ExtensionStatus::default()
}

/// Save extension status to shared file
fn save_extension_status(status: &ExtensionStatus) {
    let path = get_status_file_path();
    
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    
    if let Ok(json) = serde_json::to_string_pretty(status) {
        let _ = fs::write(&path, json);
    }
}

/// Update extension status (called when we receive messages)
fn update_extension_seen() {
    let mut status = get_extension_status();
    status.connected = true;
    status.last_seen = chrono::Utc::now().timestamp_millis();
    save_extension_status(&status);
}

/// Update protection status from extension
fn update_protection_status(data: &ProtectionStatusData) {
    let mut status = get_extension_status();
    status.connected = true;
    status.last_seen = chrono::Utc::now().timestamp_millis();
    status.incognito_enabled = data.incognito_enabled;
    status.safe_search_enforced = data.safe_search_enforced;
    status.search_filter_active = data.search_filter_active;
    status.blocked_searches_today = data.blocked_searches_today;
    save_extension_status(&status);
}

/// Message received from the Chrome extension
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum IncomingMessage {
    #[serde(rename = "PING")]
    Ping,
    
    #[serde(rename = "GET_AUTH_STATUS")]
    GetAuthStatus,
    
    #[serde(rename = "GET_CONFIG")]
    GetConfig,
    
    #[serde(rename = "NAVIGATION_EVENT")]
    NavigationEvent { data: NavigationEventData },
    
    #[serde(rename = "BLOCK_EVENT")]
    BlockEvent { data: BlockEventData },
    
    #[serde(rename = "HISTORY_SYNC")]
    HistorySync { data: HistorySyncData },
    
    #[serde(rename = "PROTECTION_STATUS")]
    ProtectionStatus { data: ProtectionStatusData },
}

#[derive(Debug, Deserialize, Clone)]
pub struct ProtectionStatusData {
    #[serde(rename = "incognitoEnabled")]
    pub incognito_enabled: bool,
    #[serde(rename = "safeSearchEnforced")]
    pub safe_search_enforced: bool,
    #[serde(rename = "searchFilterActive")]
    pub search_filter_active: bool,
    #[serde(rename = "blockedSearchesToday")]
    pub blocked_searches_today: i32,
}

#[derive(Debug, Deserialize)]
pub struct NavigationEventData {
    pub url: String,
    pub domain: String,
    pub category: String,
    #[serde(rename = "visitTime")]
    pub visit_time: i64,
    pub title: Option<String>,
    #[serde(rename = "isDistraction")]
    pub is_distraction: bool,
}

#[derive(Debug, Deserialize)]
pub struct BlockEventData {
    pub url: String,
    pub domain: String,
    pub reason: String,
    pub action: String,
    pub timestamp: i64,
}

#[derive(Debug, Deserialize)]
pub struct HistorySyncData {
    pub visits: Vec<NavigationEventData>,
}

/// Message sent to the Chrome extension
#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum OutgoingMessage {
    #[serde(rename = "PONG")]
    Pong,
    
    #[serde(rename = "AUTH_STATUS")]
    AuthStatus { data: AuthStatusData },
    
    #[serde(rename = "CONFIG_UPDATE")]
    ConfigUpdate { data: ConfigData },
    
    #[serde(rename = "SYNC_REQUEST")]
    SyncRequest { data: SyncRequestData },
    
    #[serde(rename = "ACK")]
    Ack,
    
    #[serde(rename = "ERROR")]
    Error { data: ErrorData },
}

#[derive(Debug, Serialize)]
pub struct AuthStatusData {
    pub authenticated: bool,
    pub user: Option<UserData>,
}

#[derive(Debug, Serialize)]
pub struct UserData {
    pub id: String,
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct ConfigData {
    pub mode: String,
    pub rules: Vec<serde_json::Value>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct SyncRequestData {
    pub since: i64,
}

#[derive(Debug, Serialize)]
pub struct ErrorData {
    pub message: String,
}

/// Read a message from stdin using Chrome Native Messaging protocol
pub fn read_message() -> io::Result<Option<IncomingMessage>> {
    // Read 4-byte length prefix (little-endian)
    let mut len_bytes = [0u8; 4];
    match io::stdin().read_exact(&mut len_bytes) {
        Ok(_) => {}
        Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }
    
    let len = u32::from_le_bytes(len_bytes) as usize;
    
    // Sanity check - don't read more than 1MB
    if len > 1_000_000 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Message too large",
        ));
    }
    
    // Read the JSON message
    let mut buffer = vec![0u8; len];
    io::stdin().read_exact(&mut buffer)?;
    
    // Parse JSON
    match serde_json::from_slice(&buffer) {
        Ok(msg) => Ok(Some(msg)),
        Err(e) => {
            eprintln!("[NativeHost] Failed to parse message: {}", e);
            eprintln!("[NativeHost] Raw message: {}", String::from_utf8_lossy(&buffer));
            Err(io::Error::new(io::ErrorKind::InvalidData, e))
        }
    }
}

/// Write a message to stdout using Chrome Native Messaging protocol
pub fn write_message(msg: &OutgoingMessage) -> io::Result<()> {
    let json = serde_json::to_vec(msg)?;
    let len = (json.len() as u32).to_le_bytes();
    
    let stdout = io::stdout();
    let mut handle = stdout.lock();
    
    handle.write_all(&len)?;
    handle.write_all(&json)?;
    handle.flush()?;
    
    Ok(())
}

/// Handle an incoming message and return a response
pub fn handle_message(msg: IncomingMessage) -> OutgoingMessage {
    // Update last seen timestamp for any message
    update_extension_seen();
    
    match msg {
        IncomingMessage::Ping => {
            eprintln!("[NativeHost] Received PING");
            OutgoingMessage::Pong
        }
        
        IncomingMessage::GetAuthStatus => {
            eprintln!("[NativeHost] Received GET_AUTH_STATUS");
            // TODO: Check actual Supabase session
            // For now, return placeholder
            OutgoingMessage::AuthStatus {
                data: AuthStatusData {
                    authenticated: false,
                    user: None,
                },
            }
        }
        
        IncomingMessage::GetConfig => {
            eprintln!("[NativeHost] Received GET_CONFIG");
            // TODO: Get actual config from app state
            OutgoingMessage::ConfigUpdate {
                data: ConfigData {
                    mode: "focus".to_string(),
                    rules: vec![],
                    is_active: true,
                },
            }
        }
        
        IncomingMessage::NavigationEvent { data } => {
            eprintln!("[NativeHost] Received NAVIGATION_EVENT: {}", data.domain);
            
            // Store in local database
            browsing_data::store_navigation_event(
                data.domain,
                data.category,
                data.visit_time,
                data.title,
                data.is_distraction,
            );
            
            OutgoingMessage::Ack
        }
        
        IncomingMessage::BlockEvent { data } => {
            eprintln!("[NativeHost] Received BLOCK_EVENT: {} - {}", data.domain, data.action);
            
            // Store in local database
            browsing_data::store_block_event(
                data.domain,
                data.reason,
                data.action,
                data.timestamp,
            );
            
            OutgoingMessage::Ack
        }
        
        IncomingMessage::HistorySync { data } => {
            eprintln!("[NativeHost] Received HISTORY_SYNC: {} visits", data.visits.len());
            
            // Convert and store visits in local database
            let visits: Vec<StoredVisit> = data.visits
                .into_iter()
                .map(|v| StoredVisit {
                    domain: v.domain,
                    category: v.category,
                    visit_time: v.visit_time,
                    title: v.title,
                    is_distraction: v.is_distraction,
                })
                .collect();
            
            browsing_data::store_history_batch(visits);
            
            OutgoingMessage::Ack
        }
        
        IncomingMessage::ProtectionStatus { data } => {
            eprintln!("[NativeHost] Received PROTECTION_STATUS: incognito={}, safesearch={}", 
                data.incognito_enabled, data.safe_search_enforced);
            
            update_protection_status(&data);
            
            OutgoingMessage::Ack
        }
    }
}

/// Run the native host message loop
/// This is called when the app is launched with --native-host flag
pub fn run_native_host() {
    eprintln!("[NativeHost] Starting native messaging host");
    
    loop {
        match read_message() {
            Ok(Some(msg)) => {
                let response = handle_message(msg);
                if let Err(e) = write_message(&response) {
                    eprintln!("[NativeHost] Failed to write response: {}", e);
                    break;
                }
            }
            Ok(None) => {
                // EOF - extension disconnected
                eprintln!("[NativeHost] Extension disconnected (EOF)");
                break;
            }
            Err(e) => {
                eprintln!("[NativeHost] Error reading message: {}", e);
                // Send error response and continue
                let _ = write_message(&OutgoingMessage::Error {
                    data: ErrorData {
                        message: e.to_string(),
                    },
                });
            }
        }
    }
    
    eprintln!("[NativeHost] Shutting down");
}
