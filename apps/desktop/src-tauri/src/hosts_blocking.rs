//! Machine-level adult domain blocking via a managed `/etc/hosts` section (macOS v1).
//!
//! Reads domains from `~/.clarity/adult-blocklist.json` (same seed as the Chrome
//! extension sync path) and maps them to `0.0.0.0` inside marker-delimited comments.
//!
//! Safety:
//! - Backup of `/etc/hosts` under `~/.clarity/` before every privileged write
//! - Only the Clarity-marked section is added/removed; unrelated entries are preserved
//! - Refuses enable/refresh when the blocklist is empty (never wipe protection via empty apply)
//!
//! Caveat: browsers using DNS-over-HTTPS (e.g. Chrome Secure DNS) may bypass hosts.
//! See `docs/02-features/02-blocage/hosts_adult_blocking_v1.md`.

use crate::adult_blocklist_file;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const BEGIN_MARKER: &str = "# BEGIN CLARITY ADULT BLOCK";
const END_MARKER: &str = "# END CLARITY ADULT BLOCK";
const HOSTS_PATH: &str = "/etc/hosts";
const MAX_BACKUP_KEEP: usize = 5;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostsBlockingStatus {
    /// User preference: system adult block should be applied.
    pub enabled: bool,
    /// Whether the Clarity section is currently present in `/etc/hosts`.
    pub hosts_section_present: bool,
    /// Domains available from `~/.clarity/adult-blocklist.json`.
    pub domain_count: usize,
    /// Domains currently listed inside the Clarity hosts section (0 if absent).
    pub applied_domain_count: usize,
    /// ISO-ish timestamp of last successful apply/remove, if any.
    pub last_applied_at: Option<String>,
    /// Platform supports privileged hosts edits in this build.
    pub supported: bool,
    /// Short note for UI (DoH caveat, platform stub, etc.).
    pub note: String,
    /// Path to the most recent hosts backup, if any.
    pub last_backup_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct HostsBlockingState {
    enabled: bool,
    #[serde(default)]
    last_applied_at: Option<String>,
    #[serde(default)]
    last_backup_path: Option<String>,
    #[serde(default)]
    last_applied_domain_count: usize,
}

fn clarity_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".clarity")
}

fn state_path() -> PathBuf {
    clarity_dir().join("hosts-blocking.json")
}

fn load_state() -> HostsBlockingState {
    let path = state_path();
    let Ok(text) = fs::read_to_string(&path) else {
        return HostsBlockingState::default();
    };
    serde_json::from_str(&text).unwrap_or_default()
}

fn save_state(state: &HostsBlockingState) -> Result<(), String> {
    let path = state_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let pretty = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(&path, pretty).map_err(|e| e.to_string())
}

fn now_iso() -> String {
    chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

/// Strip an existing Clarity-managed section; returns (content_without_section, had_section).
fn strip_clarity_section(content: &str) -> (String, bool) {
    let begin = content.find(BEGIN_MARKER);
    let end = content.find(END_MARKER);

    match (begin, end) {
        (Some(b), Some(e)) if e > b => {
            let after_end = e + END_MARKER.len();
            // Also drop a trailing newline after END marker if present
            let after = if content[after_end..].starts_with('\n') {
                after_end + 1
            } else {
                after_end
            };
            let mut out = String::with_capacity(content.len());
            out.push_str(&content[..b]);
            out.push_str(&content[after..]);
            // Avoid leaving more than two trailing newlines from the cut
            while out.ends_with("\n\n\n") {
                out.pop();
            }
            (out, true)
        }
        _ => (content.to_string(), false),
    }
}

fn count_domains_in_section(content: &str) -> usize {
    let Some(begin) = content.find(BEGIN_MARKER) else {
        return 0;
    };
    let Some(end) = content.find(END_MARKER) else {
        return 0;
    };
    if end <= begin {
        return 0;
    }
    content[begin..end]
        .lines()
        .filter(|line| {
            let t = line.trim();
            !t.is_empty() && !t.starts_with('#') && t.contains('.')
        })
        .count()
}

fn build_clarity_section(domains: &[String]) -> String {
    let mut lines: Vec<String> = Vec::with_capacity(domains.len() * 2 + 4);
    lines.push(BEGIN_MARKER.to_string());
    lines.push("# Managed by Clarity desktop — do not edit by hand".to_string());
    lines.push(format!("# Applied: {}", now_iso()));
    lines.push(format!("# Domains: {}", domains.len()));
    for domain in domains {
        // Apex + www; IPv4 sinkhole (classic Cold-Turkey / hosts-block style)
        lines.push(format!("0.0.0.0 {}", domain));
        lines.push(format!("0.0.0.0 www.{}", domain));
    }
    lines.push(END_MARKER.to_string());
    lines.join("\n") + "\n"
}

fn read_hosts() -> Result<String, String> {
    fs::read_to_string(HOSTS_PATH).map_err(|e| format!("failed to read {}: {}", HOSTS_PATH, e))
}

fn backup_hosts(content: &str) -> Result<PathBuf, String> {
    let dir = clarity_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let path = dir.join(format!("hosts-backup-{}.txt", stamp));
    fs::write(&path, content).map_err(|e| format!("failed to write hosts backup: {}", e))?;
    prune_old_backups(&dir)?;
    Ok(path)
}

fn prune_old_backups(dir: &Path) -> Result<(), String> {
    let mut backups: Vec<PathBuf> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("hosts-backup-") && n.ends_with(".txt"))
                .unwrap_or(false)
        })
        .collect();
    backups.sort();
    while backups.len() > MAX_BACKUP_KEEP {
        if let Some(old) = backups.first().cloned() {
            let _ = fs::remove_file(&old);
            backups.remove(0);
        } else {
            break;
        }
    }
    Ok(())
}

/// Write `new_content` to `/etc/hosts` via a temp file + elevated copy (macOS).
#[cfg(target_os = "macos")]
fn write_hosts_elevated(new_content: &str) -> Result<(), String> {
    // Refuse writing a completely empty hosts file (would break local name resolution)
    if new_content.trim().is_empty() {
        return Err("refusing to write empty /etc/hosts".into());
    }

    let staging = clarity_dir().join("hosts-staging.txt");
    if let Some(parent) = staging.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&staging, new_content).map_err(|e| format!("failed to stage hosts: {}", e))?;

    // Use osascript "with administrator privileges" so the user gets a native auth prompt.
    // Quote paths for the shell snippet carefully.
    let staging_str = staging.display().to_string();
    let hosts_str = HOSTS_PATH.to_string();
    let shell = format!(
        "cp '{}' '{}' && chmod 644 '{}'",
        escape_single_quotes(&staging_str),
        escape_single_quotes(&hosts_str),
        escape_single_quotes(&hosts_str)
    );
    let script = format!(
        "do shell script \"{}\" with administrator privileges",
        escape_applescript_string(&shell)
    );

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("failed to run osascript: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        // User cancelled auth dialog → -128
        if stderr.contains("-128") || stdout.contains("-128") {
            return Err("administrator authorization was cancelled".into());
        }
        return Err(format!(
            "privileged hosts write failed: {}",
            stderr.trim().if_empty(stdout.trim())
        ));
    }

    // Best-effort cleanup of staging file
    let _ = fs::remove_file(&staging);
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn write_hosts_elevated(_new_content: &str) -> Result<(), String> {
    Err("system adult blocking via /etc/hosts is only implemented on macOS in v1".into())
}

fn escape_single_quotes(s: &str) -> String {
    s.replace('\'', "'\\''")
}

fn escape_applescript_string(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

trait IfEmpty {
    fn if_empty(self, alt: &str) -> String;
}

impl IfEmpty for &str {
    fn if_empty(self, alt: &str) -> String {
        if self.is_empty() {
            alt.to_string()
        } else {
            self.to_string()
        }
    }
}

fn apply_section(domains: &[String]) -> Result<(PathBuf, usize), String> {
    if domains.is_empty() {
        return Err(
            "refusing to apply empty adult blocklist to /etc/hosts (empty never wipes protection)"
                .into(),
        );
    }

    let current = read_hosts()?;
    let backup = backup_hosts(&current)?;
    let (stripped, _) = strip_clarity_section(&current);

    // Ensure we still have a sane base (at least localhost entries ideally)
    let mut base = stripped.trim_end().to_string();
    if !base.is_empty() {
        base.push('\n');
        base.push('\n');
    }
    base.push_str(&build_clarity_section(domains));

    write_hosts_elevated(&base)?;
    Ok((backup, domains.len()))
}

fn remove_section() -> Result<(PathBuf, bool), String> {
    let current = read_hosts()?;
    let (stripped, had) = strip_clarity_section(&current);
    if !had {
        // Nothing to remove; still succeed (idempotent)
        return Ok((
            clarity_dir().join("(no-backup-needed)"),
            false,
        ));
    }

    let backup = backup_hosts(&current)?;
    let mut out = stripped.trim_end().to_string();
    out.push('\n');
    write_hosts_elevated(&out)?;
    Ok((backup, true))
}

fn support_note() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "Chrome Secure DNS (DoH) can bypass /etc/hosts — prefer OS DNS or disable Secure DNS for full coverage."
    }
    #[cfg(not(target_os = "macos"))]
    {
        "System adult blocking is macOS-only in v1."
    }
}

pub fn get_status() -> HostsBlockingStatus {
    let state = load_state();
    let domains = adult_blocklist_file::domains_from_disk();
    let hosts_content = read_hosts().unwrap_or_default();
    let (_, present) = strip_clarity_section(&hosts_content);
    let applied = if present {
        count_domains_in_section(&hosts_content)
    } else {
        0
    };

    #[cfg(target_os = "macos")]
    let supported = true;
    #[cfg(not(target_os = "macos"))]
    let supported = false;

    HostsBlockingStatus {
        enabled: state.enabled,
        hosts_section_present: present,
        domain_count: domains.len(),
        applied_domain_count: applied,
        last_applied_at: state.last_applied_at,
        supported,
        note: support_note().to_string(),
        last_backup_path: state.last_backup_path,
    }
}

pub fn enable() -> Result<HostsBlockingStatus, String> {
    #[cfg(not(target_os = "macos"))]
    {
        return Err(support_note().to_string());
    }
    #[cfg(target_os = "macos")]
    {
        let domains = adult_blocklist_file::domains_from_disk();
        if domains.is_empty() {
            return Err(
                "no adult domains on disk (~/.clarity/adult-blocklist.json). Install/sync the blocklist first."
                    .into(),
            );
        }
        let (backup, count) = apply_section(&domains)?;
        let mut state = load_state();
        state.enabled = true;
        state.last_applied_at = Some(now_iso());
        state.last_backup_path = Some(backup.display().to_string());
        state.last_applied_domain_count = count;
        save_state(&state)?;
        eprintln!(
            "[HostsBlocking] Enabled — {} domains applied (backup: {})",
            count,
            backup.display()
        );
        Ok(get_status())
    }
}

pub fn disable() -> Result<HostsBlockingStatus, String> {
    #[cfg(not(target_os = "macos"))]
    {
        return Err(support_note().to_string());
    }
    #[cfg(target_os = "macos")]
    {
        // Friction / PIN to disable is out of scope for v1 — stub note only.
        let (backup, removed) = remove_section()?;
        let mut state = load_state();
        state.enabled = false;
        state.last_applied_at = Some(now_iso());
        if removed {
            state.last_backup_path = Some(backup.display().to_string());
        }
        state.last_applied_domain_count = 0;
        save_state(&state)?;
        eprintln!(
            "[HostsBlocking] Disabled — section removed={}",
            removed
        );
        Ok(get_status())
    }
}

/// Re-apply hosts section from current disk blocklist if enabled.
pub fn refresh_if_enabled() -> Result<HostsBlockingStatus, String> {
    let state = load_state();
    if !state.enabled {
        return Ok(get_status());
    }
    enable()
}

/// Force re-apply regardless of previous applied set (still requires enabled preference,
/// or sets enabled=true). Used by the Settings "Refresh" action when already on.
pub fn refresh() -> Result<HostsBlockingStatus, String> {
    let state = load_state();
    if !state.enabled {
        return Err("system adult block is not enabled — enable it first".into());
    }
    enable()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_preserves_unrelated_entries() {
        let input = "\
127.0.0.1 localhost
255.255.255.255 broadcasthost
::1 localhost
# BEGIN CLARITY ADULT BLOCK
0.0.0.0 bad.example
0.0.0.0 www.bad.example
# END CLARITY ADULT BLOCK
# custom
10.0.0.1 printer.local
";
        let (out, had) = strip_clarity_section(input);
        assert!(had);
        assert!(out.contains("127.0.0.1 localhost"));
        assert!(out.contains("10.0.0.1 printer.local"));
        assert!(!out.contains("bad.example"));
        assert!(!out.contains(BEGIN_MARKER));
    }

    #[test]
    fn strip_noop_without_markers() {
        let input = "127.0.0.1 localhost\n";
        let (out, had) = strip_clarity_section(input);
        assert!(!had);
        assert_eq!(out, input);
    }

    #[test]
    fn build_section_has_markers_and_www() {
        let section = build_clarity_section(&["pornhub.com".into()]);
        assert!(section.contains(BEGIN_MARKER));
        assert!(section.contains(END_MARKER));
        assert!(section.contains("0.0.0.0 pornhub.com"));
        assert!(section.contains("0.0.0.0 www.pornhub.com"));
    }

    #[test]
    fn refuse_empty_apply() {
        let err = apply_section(&[]).unwrap_err();
        assert!(err.contains("empty"));
    }
}
