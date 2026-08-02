//! Persists / reads the system adult domain blocklist at
//! `~/.clarity/adult-blocklist.json` for native host `GET_CONFIG`.
//!
//! Shape (v1):
//! ```json
//! {
//!   "version": 1,
//!   "updatedAt": "2026-08-02",
//!   "domains": ["pornhub.com", "xcolle.jp", ...]
//! }
//! ```
//! Or a bare JSON array of domain strings.
//!
//! Sync contract: additive merge in the extension — an empty / missing file
//! must never clear bundled protection.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;

fn clarity_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".clarity")
}

pub fn adult_blocklist_path() -> PathBuf {
    clarity_dir().join("adult-blocklist.json")
}

fn domains_from_value(v: &Value) -> Vec<String> {
    let raw_list: Vec<String> = match v {
        Value::Array(arr) => arr
            .iter()
            .filter_map(|item| item.as_str().map(|s| s.to_string()))
            .collect(),
        Value::Object(map) => map
            .get("domains")
            .and_then(|d| d.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| item.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default(),
        _ => Vec::new(),
    };
    let mut out: Vec<String> = raw_list
        .iter()
        .filter_map(|d| normalize_domain(d))
        .collect();
    out.sort();
    out.dedup();
    out
}

/// Write a full adult-blocklist JSON document (object or array) to disk.
///
/// Safety: refuses an empty domain payload when an existing non-empty file is
/// present, so a bad invoke cannot wipe the on-disk sync list. (Extension also
/// treats empty `adultDomains` as a no-op merge.)
pub fn write_adult_blocklist_json(payload: Value) -> Result<(), String> {
    let incoming = domains_from_value(&payload);
    if incoming.is_empty() {
        let existing = domains_from_disk();
        if !existing.is_empty() {
            return Err(
                "refusing to write empty adult blocklist over existing non-empty file".into(),
            );
        }
        return Err(
            "refusing to write adult blocklist with zero domains (empty never wipes protection)"
                .into(),
        );
    }

    let path = adult_blocklist_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let pretty = serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?;
    let n = pretty.len();
    fs::write(&path, pretty).map_err(|e| e.to_string())?;
    eprintln!(
        "[AdultBlocklist] Wrote {} domains ({} bytes) to {}",
        incoming.len(),
        n,
        path.display()
    );
    Ok(())
}

fn normalize_domain(raw: &str) -> Option<String> {
    let mut s = raw.trim().to_lowercase();
    if s.is_empty() {
        return None;
    }
    for prefix in &["https://", "http://"] {
        if s.starts_with(prefix) {
            s = s[prefix.len()..].to_string();
            break;
        }
    }
    if let Some(slash) = s.find('/') {
        s = s[..slash].to_string();
    }
    if s.starts_with("www.") {
        s = s[4..].to_string();
    }
    s = s.trim_matches('.').to_string();
    if s.is_empty() || !s.contains('.') {
        return None;
    }
    Some(s)
}

/// Domains from `~/.clarity/adult-blocklist.json` (empty if missing / invalid).
pub fn domains_from_disk() -> Vec<String> {
    let path = adult_blocklist_path();
    let Ok(text) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    let Ok(v) = serde_json::from_str::<Value>(&text) else {
        eprintln!("[AdultBlocklist] Invalid JSON in {}", path.display());
        return Vec::new();
    };

    match &v {
        Value::Array(_) | Value::Object(_) => domains_from_value(&v),
        _ => {
            eprintln!(
                "[AdultBlocklist] Expected object or array in {}",
                path.display()
            );
            Vec::new()
        }
    }
}
