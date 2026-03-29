//! Local gate for *weakening* the custom blocking list: **password** or **friction** (counting) modes.
//! Data in `~/.clarity/blocking-lock.json`; unlock session and pending challenges are in-memory only.

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use once_cell::sync::Lazy;
use rand::Rng;
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const MIN_PASSWORD_LEN: usize = 8;
const DEFAULT_UNLOCK_SECS: u64 = 300;
const FRICTION_GRID: usize = 5;
const FRICTION_ROUNDS: usize = 3;
/// Pending challenge must be submitted within this many ms.
const FRICTION_CHALLENGE_TTL_MS: i64 = 10 * 60 * 1000;

static UNLOCK_UNTIL_MS: Lazy<Mutex<Option<i64>>> = Lazy::new(|| Mutex::new(None));

static PENDING_FRICTION: Lazy<Mutex<Option<PendingFrictionChallenge>>> =
    Lazy::new(|| Mutex::new(None));

fn clarity_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".clarity")
}

fn lock_file_path() -> PathBuf {
    clarity_dir().join("blocking-lock.json")
}

#[derive(Clone, Debug)]
enum LockKind {
    Password(String),
    Friction,
}

#[derive(Debug, Serialize, Deserialize)]
struct LockFileSerde {
    version: u32,
    #[serde(default)]
    lock_kind: Option<String>,
    #[serde(default)]
    password_hash: Option<String>,
    #[serde(default = "default_unlock_secs")]
    unlock_duration_secs: u64,
}

fn default_unlock_secs() -> u64 {
    DEFAULT_UNLOCK_SECS
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn clear_expired_unlock() {
    let mut guard = UNLOCK_UNTIL_MS.lock().expect("unlock mutex");
    if let Some(until) = *guard {
        if now_ms() >= until {
            *guard = None;
        }
    }
}

fn load_lock_kind() -> Result<Option<LockKind>, String> {
    let path = lock_file_path();
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let j: LockFileSerde = serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    let kind_str = j.lock_kind.as_deref();
    let hash = j.password_hash.as_ref().map(|s| s.as_str()).unwrap_or("");

    match kind_str {
        Some("friction") => {
            if !hash.is_empty() {
                return Err("Invalid lock file: friction with password hash".to_string());
            }
            Ok(Some(LockKind::Friction))
        }
        Some("password") | None => {
            if hash.is_empty() {
                return Err("Invalid lock file: missing password hash".to_string());
            }
            Ok(Some(LockKind::Password(hash.to_string())))
        }
        Some(other) => Err(format!("Unknown lock kind: {other}")),
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockingLockStatus {
    /// True if a lock file exists (password or friction).
    pub has_lock: bool,
    /// `none` | `password` | `friction`
    pub lock_kind: String,
    pub unlocked_until_ms: Option<i64>,
    pub unlock_duration_secs: u64,
    pub can_manage_destructive: bool,
}

pub fn get_status() -> BlockingLockStatus {
    clear_expired_unlock();
    let path = lock_file_path();
    let has_lock = path.exists();

    let (lock_kind_str, unlock_duration_secs) = if !has_lock {
        ("none".to_string(), DEFAULT_UNLOCK_SECS)
    } else {
        match load_lock_kind() {
            Ok(Some(LockKind::Password(_))) => {
                let secs = load_unlock_secs().unwrap_or(DEFAULT_UNLOCK_SECS);
                ("password".to_string(), secs)
            }
            Ok(Some(LockKind::Friction)) => {
                let secs = load_unlock_secs().unwrap_or(DEFAULT_UNLOCK_SECS);
                ("friction".to_string(), secs)
            }
            Ok(None) => ("none".to_string(), DEFAULT_UNLOCK_SECS),
            Err(_) => ("password".to_string(), DEFAULT_UNLOCK_SECS),
        }
    };

    let unlocked_until_ms = *UNLOCK_UNTIL_MS.lock().expect("unlock mutex");
    let session_ok = unlocked_until_ms.map(|u| now_ms() < u).unwrap_or(false);

    let can_manage_destructive = !has_lock || session_ok;

    BlockingLockStatus {
        has_lock,
        lock_kind: lock_kind_str,
        unlocked_until_ms: if session_ok { unlocked_until_ms } else { None },
        unlock_duration_secs,
        can_manage_destructive,
    }
}

fn load_unlock_secs() -> Option<u64> {
    let raw = fs::read_to_string(lock_file_path()).ok()?;
    let j: LockFileSerde = serde_json::from_str(&raw).ok()?;
    Some(j.unlock_duration_secs)
}

fn save_lock_file(kind: &LockKind, unlock_duration_secs: u64) -> Result<(), String> {
    let dir = clarity_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = lock_file_path();
    let tmp = path.with_extension("json.tmp");

    let out = match kind {
        LockKind::Password(hash) => LockFileSerde {
            version: 2,
            lock_kind: Some("password".to_string()),
            password_hash: Some(hash.clone()),
            unlock_duration_secs,
        },
        LockKind::Friction => LockFileSerde {
            version: 2,
            lock_kind: Some("friction".to_string()),
            password_hash: None,
            unlock_duration_secs,
        },
    };

    let json = serde_json::to_string_pretty(&out).map_err(|e| e.to_string())?;
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| e.to_string())
}

fn verify_password(password: &str, phc: &str) -> Result<(), String> {
    let parsed = PasswordHash::new(phc).map_err(|e| e.to_string())?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .map_err(|_| "Incorrect password".to_string())
}

/// First-time set or change password (password mode only).
pub fn set_password(new_password: &str, current_password: Option<&str>) -> Result<(), String> {
    if new_password.len() < MIN_PASSWORD_LEN {
        return Err(format!("Password must be at least {MIN_PASSWORD_LEN} characters."));
    }

    let path = lock_file_path();
    let existing = load_lock_kind()?;

    if path.exists() {
        match &existing {
            Some(LockKind::Friction) => {
                return Err("Turn off friction lock first (unlock, then turn off protection).".to_string());
            }
            Some(LockKind::Password(old_hash)) => {
                let cur = current_password
                    .ok_or_else(|| "Enter your current password to change it.".to_string())?;
                verify_password(cur, old_hash)?;
            }
            None => {}
        }
    }

    let unlock_secs = load_unlock_secs().unwrap_or(DEFAULT_UNLOCK_SECS);
    let hash = hash_password(new_password)?;
    save_lock_file(&LockKind::Password(hash), unlock_secs)?;
    Ok(())
}

/// Create a friction-only lock (no password).
pub fn set_friction_lock() -> Result<(), String> {
    let path = lock_file_path();
    if path.exists() {
        match load_lock_kind()? {
            Some(LockKind::Password(_)) => {
                return Err("Remove the password lock first (unlock, then turn off protection).".to_string());
            }
            Some(LockKind::Friction) => {
                return Err("Friction lock is already enabled.".to_string());
            }
            None => {}
        }
    }
    let unlock_secs = load_unlock_secs().unwrap_or(DEFAULT_UNLOCK_SECS);
    save_lock_file(&LockKind::Friction, unlock_secs)?;
    Ok(())
}

pub fn verify_and_unlock(password: &str) -> Result<(), String> {
    let path = lock_file_path();
    if !path.exists() {
        return Err("No lock is set.".to_string());
    }
    let kind = load_lock_kind()?.ok_or_else(|| "No lock is set.".to_string())?;
    match kind {
        LockKind::Password(hash) => {
            verify_password(password, &hash)?;
        }
        LockKind::Friction => {
            return Err("This lock uses a challenge, not a password. Use Unlock and complete the steps.".to_string());
        }
    }
    start_unlock_session();
    Ok(())
}

fn start_unlock_session() {
    let secs = load_unlock_secs().unwrap_or(DEFAULT_UNLOCK_SECS);
    let until = now_ms() + (secs as i64) * 1000;
    *UNLOCK_UNTIL_MS.lock().expect("unlock mutex") = Some(until);
}

pub fn relock() {
    *UNLOCK_UNTIL_MS.lock().expect("unlock mutex") = None;
    *PENDING_FRICTION.lock().expect("friction mutex") = None;
}

/// Remove `blocking-lock.json` only while an unlock session is active.
pub fn clear_lock_file() -> Result<(), String> {
    clear_expired_unlock();
    let unlocked_until_ms = *UNLOCK_UNTIL_MS.lock().expect("unlock mutex");
    let session_ok = unlocked_until_ms.map(|u| now_ms() < u).unwrap_or(false);
    if !session_ok {
        return Err("Unlock first to turn off protection.".to_string());
    }
    let path = lock_file_path();
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    *UNLOCK_UNTIL_MS.lock().expect("unlock mutex") = None;
    *PENDING_FRICTION.lock().expect("friction mutex") = None;
    Ok(())
}

// --- Friction challenge ---

#[derive(Clone)]
struct FrictionRound {
    target_digit: u8,
    expected_count: u8,
}

struct PendingFrictionChallenge {
    id: String,
    rounds: Vec<FrictionRound>,
    expires_at_ms: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrictionChallengeRound {
    pub rows: Vec<String>,
    pub target_digit: u8,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrictionChallengeStart {
    pub challenge_id: String,
    pub rounds: Vec<FrictionChallengeRound>,
}

fn rng_digit() -> u8 {
    let mut rng = rand::thread_rng();
    rng.gen_range(0..10)
}

fn build_round() -> (FrictionRound, FrictionChallengeRound) {
    let mut grid = [[0u8; FRICTION_GRID]; FRICTION_GRID];
    for r in 0..FRICTION_GRID {
        for c in 0..FRICTION_GRID {
            grid[r][c] = rng_digit();
        }
    }
    let target_digit = rng_digit();
    let mut count: u8 = 0;
    for r in 0..FRICTION_GRID {
        for c in 0..FRICTION_GRID {
            if grid[r][c] == target_digit {
                count = count.saturating_add(1);
            }
        }
    }
    let mut rows = Vec::with_capacity(FRICTION_GRID);
    for r in 0..FRICTION_GRID {
        let s: String = grid[r]
            .iter()
            .map(|d| char::from_digit(*d as u32, 10).unwrap_or('0'))
            .collect();
        rows.push(s);
    }
    let round = FrictionRound {
        target_digit,
        expected_count: count,
    };
    let display = FrictionChallengeRound {
        rows,
        target_digit,
    };
    (round, display)
}

pub fn friction_challenge_start() -> Result<FrictionChallengeStart, String> {
    let path = lock_file_path();
    if !path.exists() {
        return Err("No lock is set.".to_string());
    }
    match load_lock_kind()? {
        Some(LockKind::Friction) => {}
        Some(LockKind::Password(_)) => {
            return Err("This lock uses a password.".to_string());
        }
        None => return Err("No lock is set.".to_string()),
    }

    let id = Uuid::new_v4().to_string();
    let mut rounds = Vec::new();
    let mut display_rounds = Vec::new();
    for _ in 0..FRICTION_ROUNDS {
        let (r, d) = build_round();
        rounds.push(r);
        display_rounds.push(d);
    }
    let expires_at_ms = now_ms() + FRICTION_CHALLENGE_TTL_MS;
    *PENDING_FRICTION.lock().expect("friction mutex") = Some(PendingFrictionChallenge {
        id: id.clone(),
        rounds,
        expires_at_ms,
    });

    Ok(FrictionChallengeStart {
        challenge_id: id,
        rounds: display_rounds,
    })
}

pub fn friction_challenge_submit(
    challenge_id: String,
    answers: Vec<u8>,
) -> Result<(), String> {
    let path = lock_file_path();
    if !path.exists() {
        return Err("No lock is set.".to_string());
    }
    match load_lock_kind()? {
        Some(LockKind::Friction) => {}
        Some(LockKind::Password(_)) => {
            return Err("This lock uses a password.".to_string());
        }
        None => return Err("No lock is set.".to_string()),
    }

    let mut guard = PENDING_FRICTION.lock().expect("friction mutex");
    let pending = guard
        .take()
        .ok_or_else(|| "Start the challenge again. Session expired.".to_string())?;

    if pending.id != challenge_id {
        return Err("Challenge mismatch. Start again.".to_string());
    }
    if now_ms() >= pending.expires_at_ms {
        return Err("Challenge expired. Start again.".to_string());
    }
    if answers.len() != pending.rounds.len() {
        return Err(
            format!(
                "Expected {} answer(s), got {}.",
                pending.rounds.len(),
                answers.len()
            ),
        );
    }
    for (i, round) in pending.rounds.iter().enumerate() {
        if answers[i] != round.expected_count {
            return Err(format!(
                "Round {} is incorrect. Try again from the start.",
                i + 1
            ));
        }
    }

    drop(guard);
    start_unlock_session();
    Ok(())
}
