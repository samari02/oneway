//! Persists / merges adult-block *candidates* at
//! `~/.clarity/adult-blocklist-candidates.json` for the promote loop.
//!
//! Written by native host on `ADULT_CANDIDATE` from the extension.
//! Read by `promote-adult-candidates.mjs` (never auto-hard-blocks dual-use).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

fn clarity_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".clarity")
}

pub fn adult_candidates_path() -> PathBuf {
    clarity_dir().join("adult-blocklist-candidates.json")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdultCandidateRecord {
    pub domain: String,
    pub hits: i64,
    #[serde(rename = "firstSeenAt")]
    pub first_seen_at: i64,
    #[serde(rename = "lastSeenAt")]
    pub last_seen_at: i64,
    #[serde(rename = "maxScore")]
    pub max_score: i64,
    #[serde(default)]
    pub reasons: Vec<String>,
    #[serde(default)]
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CandidatesDocument {
    version: u32,
    #[serde(rename = "updatedAt")]
    updated_at: String,
    candidates: Vec<AdultCandidateRecord>,
}

fn empty_doc() -> CandidatesDocument {
    CandidatesDocument {
        version: 1,
        updated_at: chrono_like_date(),
        candidates: Vec::new(),
    }
}

fn chrono_like_date() -> String {
    // Keep deps light: ISO-ish date from system time via serde_json later; use simple UTC-ish stamp.
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}")
}

fn read_doc() -> CandidatesDocument {
    let path = adult_candidates_path();
    let Ok(text) = fs::read_to_string(&path) else {
        return empty_doc();
    };
    let Ok(v) = serde_json::from_str::<Value>(&text) else {
        eprintln!(
            "[AdultCandidates] Invalid JSON in {} — starting fresh",
            path.display()
        );
        return empty_doc();
    };
    match v {
        Value::Object(_) => serde_json::from_value(v).unwrap_or_else(|_| empty_doc()),
        Value::Array(arr) => {
            let candidates: Vec<AdultCandidateRecord> = arr
                .into_iter()
                .filter_map(|item| serde_json::from_value(item).ok())
                .collect();
            CandidatesDocument {
                version: 1,
                updated_at: chrono_like_date(),
                candidates,
            }
        }
        _ => empty_doc(),
    }
}

fn write_doc(mut doc: CandidatesDocument) -> Result<(), String> {
    let path = adult_candidates_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    doc.updated_at = chrono_like_date();
    // Cap list size (same spirit as extension ADULT_CANDIDATE_CAP)
    const CAP: usize = 500;
    if doc.candidates.len() > CAP {
        doc.candidates
            .sort_by(|a, b| b.last_seen_at.cmp(&a.last_seen_at));
        doc.candidates.truncate(CAP);
    }
    let pretty = serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())?;
    fs::write(&path, pretty).map_err(|e| e.to_string())?;
    Ok(())
}

/// Upsert a candidate observed by the extension (additive merge by domain).
pub fn upsert_candidate(incoming: AdultCandidateRecord) -> Result<(), String> {
    let mut doc = read_doc();
    let domain = incoming.domain.trim().to_lowercase();
    if domain.is_empty() || !domain.contains('.') {
        return Ok(());
    }

    if let Some(existing) = doc.candidates.iter_mut().find(|c| c.domain == domain) {
        existing.hits = existing.hits.max(incoming.hits);
        existing.last_seen_at = existing.last_seen_at.max(incoming.last_seen_at);
        if existing.first_seen_at == 0 || (incoming.first_seen_at > 0 && incoming.first_seen_at < existing.first_seen_at)
        {
            existing.first_seen_at = incoming.first_seen_at;
        }
        existing.max_score = existing.max_score.max(incoming.max_score);
        if !incoming.source.is_empty() {
            existing.source = incoming.source.clone();
        }
        for r in incoming.reasons {
            if existing.reasons.len() >= 8 {
                break;
            }
            if !existing.reasons.iter().any(|x| x == &r) {
                existing.reasons.push(r);
            }
        }
    } else {
        doc.candidates.push(AdultCandidateRecord {
            domain,
            hits: incoming.hits.max(1),
            first_seen_at: incoming.first_seen_at,
            last_seen_at: incoming.last_seen_at,
            max_score: incoming.max_score,
            reasons: incoming.reasons.into_iter().take(8).collect(),
            source: if incoming.source.is_empty() {
                "content_analysis".into()
            } else {
                incoming.source
            },
        });
    }

    write_doc(doc)?;
    eprintln!(
        "[AdultCandidates] Upserted candidate → {}",
        adult_candidates_path().display()
    );
    Ok(())
}
