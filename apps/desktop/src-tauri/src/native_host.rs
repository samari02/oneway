//! Native Messaging Host for Chrome Extension Communication
//!
//! This module handles the Chrome Native Messaging protocol:
//! - Reads JSON messages from stdin (prefixed with 4-byte length)
//! - Writes JSON responses to stdout (prefixed with 4-byte length)
//!
//! Protocol: https://developer.chrome.com/docs/apps/nativeMessaging/

use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};

use crate::browsing_data::{self, StoredVisit};

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
