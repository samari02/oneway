//! Reads `~/.clarity/signed-adult-list.json` for native host `GET_CONFIG`.
//!
//! The extension verifies Ed25519 signature before merge / dynamic DNR apply.
//! Missing or invalid JSON → `None` (never clears protection).

use serde_json::Value;
use std::fs;
use std::path::PathBuf;

fn clarity_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".clarity")
}

pub fn signed_adult_list_path() -> PathBuf {
    clarity_dir().join("signed-adult-list.json")
}

/// Full signed document as JSON value, if present and parseable.
pub fn signed_adult_list_from_disk() -> Option<Value> {
    let path = signed_adult_list_path();
    let text = fs::read_to_string(&path).ok()?;
    match serde_json::from_str::<Value>(&text) {
        Ok(Value::Object(map)) => {
            eprintln!(
                "[SignedAdultList] Loaded {} ({} bytes)",
                path.display(),
                text.len()
            );
            Some(Value::Object(map))
        }
        Ok(_) => {
            eprintln!(
                "[SignedAdultList] Expected object in {}",
                path.display()
            );
            None
        }
        Err(e) => {
            eprintln!(
                "[SignedAdultList] Invalid JSON in {}: {}",
                path.display(),
                e
            );
            None
        }
    }
}
