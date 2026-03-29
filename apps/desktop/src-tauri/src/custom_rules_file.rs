//! Persists custom blocking rules to `~/.clarity/custom-blocking-rules.json`
//! for the native messaging host to read on `GET_CONFIG`.

use serde::Deserialize;
use serde_json::json;
use std::fs;
use std::path::PathBuf;

fn clarity_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".clarity")
}

pub fn custom_rules_path() -> PathBuf {
    clarity_dir().join("custom-blocking-rules.json")
}

/// Raw row shape (matches desktop / Supabase JSON).
#[derive(Debug, Deserialize)]
struct DiskRule {
    id: String,
    rule_type: String,
    value: String,
    #[serde(default = "default_match_mode")]
    match_mode: String,
    #[serde(default = "default_true")]
    is_active: bool,
}

fn default_match_mode() -> String {
    "contains".to_string()
}

fn default_true() -> bool {
    true
}

/// Sanitize user value for the middle of a `matchesPattern` string (extension).
/// Strips `*` so structural wildcards in the pattern are not conflated with user input.
fn sanitize_value_for_pattern(s: &str) -> String {
    s.replace('*', "")
}

/// Strip `https://`, `http://`, `www.` so pasting a full URL still matches navigation URLs.
fn normalize_url_contains_value(raw: &str) -> String {
    let mut s = raw.trim();
    for prefix in &["https://", "http://", "HTTPS://", "HTTP://"] {
        if s.starts_with(prefix) {
            s = s.strip_prefix(prefix).unwrap_or(s);
            break;
        }
    }
    let mut s = s.trim_start();
    if s.len() >= 4 && s[..4].eq_ignore_ascii_case("www.") {
        s = &s[4..];
    }
    sanitize_value_for_pattern(s.trim())
}

/// Writes the JSON array of rules (as received from the desktop UI).
pub fn write_rules_json(rules: serde_json::Value) -> Result<(), String> {
    if !rules.is_array() {
        return Err("custom rules payload must be a JSON array".to_string());
    }
    let path = custom_rules_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let pretty = serde_json::to_string_pretty(&rules).map_err(|e| e.to_string())?;
    let n = pretty.len();
    fs::write(&path, pretty).map_err(|e| e.to_string())?;
    eprintln!("[CustomRules] Wrote {} bytes to {}", n, path.display());
    Ok(())
}

fn read_disk_array() -> Vec<serde_json::Value> {
    let path = custom_rules_path();
    let Ok(text) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else {
        eprintln!("[CustomRules] Invalid JSON in {}", path.display());
        return Vec::new();
    };
    match v {
        serde_json::Value::Array(arr) => arr,
        _ => {
            eprintln!("[CustomRules] Expected array in {}", path.display());
            Vec::new()
        }
    }
}

fn row_to_block_rules(row: &DiskRule) -> Vec<serde_json::Value> {
    let v = normalize_url_contains_value(&row.value);
    if v.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();

    match row.rule_type.as_str() {
        "url_contains" => {
            let pattern = if row.match_mode == "host_is" {
                format!("*://{}/*", v)
            } else {
                format!("*://*{}*", v)
            };
            out.push(json!({
                "id": format!("custom-{}", row.id),
                "pattern": pattern,
                "action": "block",
                "reason": "Custom URL rule (Clarity)",
                "category": "other"
            }));
            if row.match_mode == "host_is" {
                out.push(json!({
                    "id": format!("custom-sub-{}", row.id),
                    "pattern": format!("*://*.{}/*", v),
                    "action": "block",
                    "reason": "Custom URL rule (Clarity)",
                    "category": "other"
                }));
            }
        }
        "search_contains" => {
            // Handled as keywords, not URL patterns
        }
        _ => {}
    }
    out
}

/// Returns (custom_url_block_rules, search_keywords_lower).
pub fn extension_payload_from_disk() -> (Vec<serde_json::Value>, Vec<String>) {
    let mut custom_rules: Vec<serde_json::Value> = Vec::new();
    let mut keywords: Vec<String> = Vec::new();

    for val in read_disk_array() {
        let row: DiskRule = match serde_json::from_value(val) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[CustomRules] Skip invalid row: {}", e);
                continue;
            }
        };
        if !row.is_active {
            continue;
        }
        match row.rule_type.as_str() {
            "search_contains" => {
                let k = row.value.trim().to_lowercase();
                if !k.is_empty() {
                    keywords.push(k);
                }
            }
            "url_contains" => {
                custom_rules.extend(row_to_block_rules(&row));
            }
            _ => {}
        }
    }

    (custom_rules, keywords)
}
