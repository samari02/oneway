//! Browsing Data Storage Module
//!
//! Handles persistent storage of browsing data received from the Chrome extension.
//! Data is stored in a JSON file in the app's data directory.
//!
//! Architecture:
//! - Native Host writes → JSON file (append-only for speed)
//! - Tauri commands read → React frontend

use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::Mutex;

/// Maximum number of visits to keep in storage
const MAX_VISITS: usize = 10_000;

/// Data directory name
const DATA_DIR: &str = "clarity-data";

/// Browsing visit stored in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredVisit {
    pub domain: String,
    pub category: String,
    #[serde(rename = "visitTime")]
    pub visit_time: i64,
    pub title: Option<String>,
    #[serde(rename = "isDistraction")]
    pub is_distraction: bool,
}

/// Block event stored in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredBlockEvent {
    pub domain: String,
    pub reason: String,
    pub action: String,  // "blocked" | "bypassed"
    pub timestamp: i64,
}

/// Aggregated stats for a domain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainStats {
    pub domain: String,
    pub visits: u32,
    #[serde(rename = "timeSpent")]
    pub time_spent: u32,  // estimated minutes
    pub category: String,
}

/// Daily focus score
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyScore {
    pub date: String,  // YYYY-MM-DD
    pub score: u32,    // 0-100
}

/// Complete browsing stats for the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowsingStats {
    #[serde(rename = "focusScore")]
    pub focus_score: u32,
    #[serde(rename = "focusTrend")]
    pub focus_trend: String,  // "up" | "down" | "stable"
    #[serde(rename = "timeDistribution")]
    pub time_distribution: TimeDistribution,
    #[serde(rename = "topSites")]
    pub top_sites: Vec<DomainStats>,
    #[serde(rename = "dailyScores")]
    pub daily_scores: Vec<DailyScore>,
    #[serde(rename = "totalVisits")]
    pub total_visits: u32,
    #[serde(rename = "totalTimeTracked")]
    pub total_time_tracked: u32,
    // Data source metadata
    #[serde(rename = "periodStart")]
    pub period_start: Option<String>,
    #[serde(rename = "periodEnd")]
    pub period_end: Option<String>,
    #[serde(rename = "lastSync")]
    pub last_sync: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeDistribution {
    pub productive: u32,
    pub neutral: u32,
    pub distraction: u32,
}

/// Global storage instance (thread-safe)
lazy_static::lazy_static! {
    static ref STORAGE: Mutex<BrowsingStorage> = Mutex::new(BrowsingStorage::new());
}

/// Browsing data storage handler
pub struct BrowsingStorage {
    data_dir: PathBuf,
}

impl BrowsingStorage {
    pub fn new() -> Self {
        let data_dir = get_data_dir();
        
        // Ensure directory exists
        if let Err(e) = fs::create_dir_all(&data_dir) {
            eprintln!("[BrowsingData] Failed to create data dir: {}", e);
        }
        
        Self { data_dir }
    }
    
    /// Path to visits file
    fn visits_path(&self) -> PathBuf {
        self.data_dir.join("visits.jsonl")
    }
    
    /// Path to block events file
    fn blocks_path(&self) -> PathBuf {
        self.data_dir.join("blocks.jsonl")
    }
    
    /// Append a visit to storage (fast, append-only)
    pub fn store_visit(&self, visit: &StoredVisit) -> std::io::Result<()> {
        let path = self.visits_path();
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)?;
        
        let json = serde_json::to_string(visit)?;
        writeln!(file, "{}", json)?;
        
        eprintln!("[BrowsingData] Stored visit: {}", visit.domain);
        Ok(())
    }
    
    /// Append a block event to storage
    pub fn store_block_event(&self, event: &StoredBlockEvent) -> std::io::Result<()> {
        let path = self.blocks_path();
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)?;
        
        let json = serde_json::to_string(event)?;
        writeln!(file, "{}", json)?;
        
        eprintln!("[BrowsingData] Stored block event: {} - {}", event.domain, event.action);
        Ok(())
    }
    
    /// Store multiple visits (batch import)
    pub fn store_visits_batch(&self, visits: &[StoredVisit]) -> std::io::Result<()> {
        let path = self.visits_path();
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)?;
        
        for visit in visits {
            let json = serde_json::to_string(visit)?;
            writeln!(file, "{}", json)?;
        }
        
        eprintln!("[BrowsingData] Stored {} visits (batch)", visits.len());
        Ok(())
    }
    
    /// Read all visits from storage
    pub fn read_visits(&self) -> Vec<StoredVisit> {
        let path = self.visits_path();
        
        if !path.exists() {
            return vec![];
        }
        
        let file = match fs::File::open(&path) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("[BrowsingData] Failed to open visits file: {}", e);
                return vec![];
            }
        };
        
        let reader = BufReader::new(file);
        let mut visits = Vec::new();
        
        for line in reader.lines() {
            if let Ok(line) = line {
                if let Ok(visit) = serde_json::from_str::<StoredVisit>(&line) {
                    visits.push(visit);
                }
            }
        }
        
        // Keep only the most recent visits if over limit
        if visits.len() > MAX_VISITS {
            let skip_count = visits.len() - MAX_VISITS;
            visits = visits.into_iter().skip(skip_count).collect();
        }
        
        visits
    }
    
    /// Read all block events from storage
    pub fn read_block_events(&self) -> Vec<StoredBlockEvent> {
        let path = self.blocks_path();
        
        if !path.exists() {
            return vec![];
        }
        
        let file = match fs::File::open(&path) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("[BrowsingData] Failed to open blocks file: {}", e);
                return vec![];
            }
        };
        
        let reader = BufReader::new(file);
        let mut events = Vec::new();
        
        for line in reader.lines() {
            if let Ok(line) = line {
                if let Ok(event) = serde_json::from_str::<StoredBlockEvent>(&line) {
                    events.push(event);
                }
            }
        }
        
        events
    }
    
    /// Calculate browsing stats from stored data
    pub fn calculate_stats(&self) -> BrowsingStats {
        let visits = self.read_visits();
        let blocks = self.read_block_events();
        
        // Count by category
        let mut productive_count = 0u32;
        let mut neutral_count = 0u32;
        let mut distraction_count = 0u32;
        
        // Count by domain
        let mut domain_counts: std::collections::HashMap<String, (u32, String)> = std::collections::HashMap::new();
        
        // Daily scores map
        let mut daily_visits: std::collections::HashMap<String, (u32, u32)> = std::collections::HashMap::new(); // (productive, total)
        
        // Track period bounds
        let mut min_time: i64 = i64::MAX;
        let mut max_time: i64 = 0;
        
        for visit in &visits {
            // Category counts
            match visit.category.as_str() {
                "work" | "dev" | "productivity" => productive_count += 1,
                "social_media" | "video" | "entertainment" | "news" | "shopping" => distraction_count += 1,
                _ => neutral_count += 1,
            }
            
            // Domain counts
            let entry = domain_counts.entry(visit.domain.clone()).or_insert((0, visit.category.clone()));
            entry.0 += 1;
            
            // Daily tracking
            let date = timestamp_to_date(visit.visit_time);
            let daily = daily_visits.entry(date).or_insert((0, 0));
            daily.1 += 1;
            if !visit.is_distraction {
                daily.0 += 1;
            }
            
            // Track period bounds
            if visit.visit_time < min_time {
                min_time = visit.visit_time;
            }
            if visit.visit_time > max_time {
                max_time = visit.visit_time;
            }
        }
        
        let total_visits = visits.len() as u32;
        
        // Calculate percentages
        let total = (productive_count + neutral_count + distraction_count).max(1) as f32;
        let productive_pct = ((productive_count as f32 / total) * 100.0) as u32;
        let distraction_pct = ((distraction_count as f32 / total) * 100.0) as u32;
        let neutral_pct = 100 - productive_pct - distraction_pct;
        
        // Focus score (100 = all productive, 0 = all distraction)
        let focus_score = ((productive_count as f32 / total) * 100.0) as u32;
        
        // Determine trend (compare last 7 days to previous 7 days)
        let focus_trend = calculate_trend(&daily_visits);
        
        // Top sites
        let mut top_sites: Vec<DomainStats> = domain_counts
            .into_iter()
            .map(|(domain, (count, category))| DomainStats {
                domain,
                visits: count,
                time_spent: count * 2, // Estimate: 2 min per visit
                category,
            })
            .collect();
        
        top_sites.sort_by(|a, b| b.visits.cmp(&a.visits));
        top_sites.truncate(10);
        
        // Daily scores (last 30 days)
        let mut daily_scores: Vec<DailyScore> = daily_visits
            .into_iter()
            .map(|(date, (productive, total))| {
                let score = if total > 0 {
                    ((productive as f32 / total as f32) * 100.0) as u32
                } else {
                    50 // Default
                };
                DailyScore { date, score }
            })
            .collect();
        
        daily_scores.sort_by(|a, b| a.date.cmp(&b.date));
        
        // Keep last 30 days
        if daily_scores.len() > 30 {
            let skip_count = daily_scores.len() - 30;
            daily_scores = daily_scores.into_iter().skip(skip_count).collect();
        }
        
        // Blocks today (for future use)
        let _today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let _blocks_today = blocks.iter().filter(|b| timestamp_to_date(b.timestamp) == _today).count() as u32;
        
        // Calculate period dates
        let period_start = if min_time < i64::MAX {
            Some(timestamp_to_iso(min_time))
        } else {
            None
        };
        
        let period_end = if max_time > 0 {
            Some(timestamp_to_iso(max_time))
        } else {
            None
        };
        
        // Last sync is now
        let last_sync = Some(chrono::Local::now().to_rfc3339());
        
        BrowsingStats {
            focus_score,
            focus_trend,
            time_distribution: TimeDistribution {
                productive: productive_pct,
                neutral: neutral_pct,
                distraction: distraction_pct,
            },
            top_sites,
            daily_scores,
            total_visits,
            total_time_tracked: total_visits * 2, // Estimate
            period_start,
            period_end,
            last_sync,
        }
    }
}

/// Get the data directory path
fn get_data_dir() -> PathBuf {
    // Use home directory for simplicity
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".clarity").join(DATA_DIR)
}

/// Convert timestamp (ms) to date string (YYYY-MM-DD)
fn timestamp_to_date(timestamp: i64) -> String {
    use chrono::{TimeZone, Local};
    
    let dt = Local.timestamp_millis_opt(timestamp).single();
    match dt {
        Some(dt) => dt.format("%Y-%m-%d").to_string(),
        None => "unknown".to_string(),
    }
}

/// Convert timestamp (ms) to ISO 8601 string
fn timestamp_to_iso(timestamp: i64) -> String {
    use chrono::{TimeZone, Local};
    
    let dt = Local.timestamp_millis_opt(timestamp).single();
    match dt {
        Some(dt) => dt.to_rfc3339(),
        None => "unknown".to_string(),
    }
}

/// Calculate trend based on daily data
fn calculate_trend(daily_visits: &std::collections::HashMap<String, (u32, u32)>) -> String {
    // Simple implementation: compare recent vs older
    let today = chrono::Local::now();
    
    let mut recent_score = 0u32;
    let mut recent_count = 0u32;
    let mut older_score = 0u32;
    let mut older_count = 0u32;
    
    for (date_str, (productive, total)) in daily_visits {
        if let Ok(date) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            let days_ago = (today.date_naive() - date).num_days();
            
            let score = if *total > 0 {
                (*productive as f32 / *total as f32 * 100.0) as u32
            } else {
                50
            };
            
            if days_ago <= 7 {
                recent_score += score;
                recent_count += 1;
            } else if days_ago <= 14 {
                older_score += score;
                older_count += 1;
            }
        }
    }
    
    let recent_avg = if recent_count > 0 { recent_score / recent_count } else { 50 };
    let older_avg = if older_count > 0 { older_score / older_count } else { 50 };
    
    if recent_avg > older_avg + 5 {
        "up".to_string()
    } else if recent_avg < older_avg - 5 {
        "down".to_string()
    } else {
        "stable".to_string()
    }
}

// ============================================================================
// Public API for Native Host
// ============================================================================

/// Store a navigation event from the extension
pub fn store_navigation_event(
    domain: String,
    category: String,
    visit_time: i64,
    title: Option<String>,
    is_distraction: bool,
) {
    let visit = StoredVisit {
        domain,
        category,
        visit_time,
        title,
        is_distraction,
    };
    
    if let Ok(storage) = STORAGE.lock() {
        let _ = storage.store_visit(&visit);
    }
}

/// Store a block event from the extension
pub fn store_block_event(
    domain: String,
    reason: String,
    action: String,
    timestamp: i64,
) {
    let event = StoredBlockEvent {
        domain,
        reason,
        action,
        timestamp,
    };
    
    if let Ok(storage) = STORAGE.lock() {
        let _ = storage.store_block_event(&event);
    }
}

/// Store multiple visits (history sync)
pub fn store_history_batch(visits: Vec<StoredVisit>) {
    if let Ok(storage) = STORAGE.lock() {
        let _ = storage.store_visits_batch(&visits);
    }
}

/// Clear all browsing data
pub fn clear_browsing_data() -> Result<(), String> {
    if let Ok(storage) = STORAGE.lock() {
        let visits_path = storage.visits_path();
        let blocks_path = storage.blocks_path();
        
        // Remove files if they exist
        if visits_path.exists() {
            std::fs::remove_file(&visits_path).map_err(|e| e.to_string())?;
        }
        if blocks_path.exists() {
            std::fs::remove_file(&blocks_path).map_err(|e| e.to_string())?;
        }
        
        eprintln!("[BrowsingData] Cleared all data");
        Ok(())
    } else {
        Err("Failed to acquire lock".to_string())
    }
}

/// Get browsing stats for the frontend
pub fn get_browsing_stats() -> BrowsingStats {
    if let Ok(storage) = STORAGE.lock() {
        storage.calculate_stats()
    } else {
        // Return empty stats on error
        BrowsingStats {
            focus_score: 50,
            focus_trend: "stable".to_string(),
            time_distribution: TimeDistribution {
                productive: 33,
                neutral: 34,
                distraction: 33,
            },
            top_sites: vec![],
            daily_scores: vec![],
            total_visits: 0,
            total_time_tracked: 0,
            period_start: None,
            period_end: None,
            last_sync: None,
        }
    }
}
