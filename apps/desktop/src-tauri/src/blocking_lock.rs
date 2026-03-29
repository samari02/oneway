//! Local password gate for *weakening* the custom blocking list (remove / turn off rules).
//! Hash stored at `~/.clarity/blocking-lock.json`; unlock session is in-memory only.

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use rand_core::OsRng;
use argon2::Argon2;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const MIN_PASSWORD_LEN: usize = 8;
const DEFAULT_UNLOCK_SECS: u64 = 300;

static UNLOCK_UNTIL_MS: Lazy<Mutex<Option<i64>>> = Lazy::new(|| Mutex::new(None));

fn clarity_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".clarity")
}

fn lock_file_path() -> PathBuf {
    clarity_dir().join("blocking-lock.json")
}

#[derive(Debug, Serialize, Deserialize)]
struct LockFile {
    version: u32,
    password_hash: String,
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockingLockStatus {
    pub has_password: bool,
    pub unlocked_until_ms: Option<i64>,
    pub unlock_duration_secs: u64,
    pub can_manage_destructive: bool,
}

pub fn get_status() -> BlockingLockStatus {
    clear_expired_unlock();
    let path = lock_file_path();
    let has_password = path.exists();
    let unlock_duration_secs = if has_password {
        load_file()
            .map(|f| f.unlock_duration_secs)
            .unwrap_or(DEFAULT_UNLOCK_SECS)
    } else {
        DEFAULT_UNLOCK_SECS
    };

    let unlocked_until_ms = *UNLOCK_UNTIL_MS.lock().expect("unlock mutex");
    let session_ok = unlocked_until_ms.map(|u| now_ms() < u).unwrap_or(false);

    let can_manage_destructive = !has_password || session_ok;

    BlockingLockStatus {
        has_password,
        unlocked_until_ms: if session_ok { unlocked_until_ms } else { None },
        unlock_duration_secs,
        can_manage_destructive,
    }
}

fn load_file() -> Result<LockFile, String> {
    let path = lock_file_path();
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

fn save_file(data: &LockFile) -> Result<(), String> {
    let dir = clarity_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = lock_file_path();
    let tmp = path.with_extension("json.tmp");
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
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

/// First-time set or change (requires current when a password already exists).
pub fn set_password(new_password: &str, current_password: Option<&str>) -> Result<(), String> {
    if new_password.len() < MIN_PASSWORD_LEN {
        return Err(format!("Password must be at least {MIN_PASSWORD_LEN} characters."));
    }

    let path = lock_file_path();
    if path.exists() {
        let cur = current_password.ok_or_else(|| "Enter your current password to change it.".to_string())?;
        let data = load_file()?;
        verify_password(cur, &data.password_hash)?;
        let password_hash = hash_password(new_password)?;
        save_file(&LockFile {
            version: 1,
            password_hash,
            unlock_duration_secs: data.unlock_duration_secs,
        })?;
    } else {
        let password_hash = hash_password(new_password)?;
        save_file(&LockFile {
            version: 1,
            password_hash,
            unlock_duration_secs: DEFAULT_UNLOCK_SECS,
        })?;
    }
    Ok(())
}

pub fn verify_and_unlock(password: &str) -> Result<(), String> {
    let path = lock_file_path();
    if !path.exists() {
        return Err("No password is set.".to_string());
    }
    let data = load_file()?;
    verify_password(password, &data.password_hash)?;
    let until = now_ms() + (data.unlock_duration_secs as i64) * 1000;
    *UNLOCK_UNTIL_MS.lock().expect("unlock mutex") = Some(until);
    Ok(())
}

pub fn relock() {
    *UNLOCK_UNTIL_MS.lock().expect("unlock mutex") = None;
}
