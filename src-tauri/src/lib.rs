/*
 * SSH Profile Manager
 * Copyright (C) 2025 Thomas Sinclair
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

use rusqlite::{Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager, State};
use uuid::Uuid;
use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use unicode_normalization::UnicodeNormalization;

// Cryptographic imports for export encryption (Phase 6)
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use hmac::{Hmac, Mac};
use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;
use zeroize::Zeroize;


// Constants
const FILE_DIALOG_TIMEOUT_SECS: u64 = 60; // 1 minute timeout for file dialogs
const SETTINGS_IMPORT_RATE_LIMIT_SECS: u64 = 5; // 5 second rate limit for settings import
const SESSION_CREATE_RATE_LIMIT_SECS: u64 = 2; // 2 second rate limit for terminal session creation

// Terminal dimension limits (M-6: Prevent duplication)
const TERMINAL_MAX_COLS: u16 = 250;
const TERMINAL_MAX_ROWS: u16 = 80;
const TERMINAL_MAX_TOTAL_CELLS: u32 = 20000; // 250 cols × 80 rows

// Import size limits (M-2: Prevent OOM attacks)
const MAX_IMPORT_JSON_SIZE: usize = 10 * 1024 * 1024; // 10MB

// Settings validation (M-7: Valid setting keys)
const ALLOWED_SETTING_KEYS: &[&str] = &[
    "theme",
    "terminal_preference",
    "custom_terminal_path",
    "should_minimize_on_connect",
    "enable_keyboard_shortcuts",
    "terminal_font_size",
    "terminal_font_family",
    "terminal_cursor_blink",
    "terminal_cursor_style",
    "default_group_collapsed_state",
    "last_selected_group",
    "keyboard_shortcuts_enabled",
    "window_width",
    "window_height",
    "sidebar_width",
];

// Bundle identifier migration constants
const OLD_BUNDLE_ID: &str = "ssh-profile-manager";
const NEW_BUNDLE_ID: &str = "ssh-profile-manager";
const OLD_KEYCHAIN_SERVICE: &str = "ssh-profile-manager";
const NEW_KEYCHAIN_SERVICE: &str = "ssh-profile-manager";

// Rate limiting for settings import
static LAST_SETTINGS_IMPORT_TIME: Mutex<u64> = Mutex::new(0);
// Rate limiting for terminal session creation
static LAST_SESSION_CREATE_TIME: Mutex<u64> = Mutex::new(0);
// Update check caching (timestamp, UpdateInfo)
static UPDATE_CHECK_CACHE: Mutex<Option<(u64, String, String, bool, String)>> = Mutex::new(None);

// Windows-specific file security function
/// Creates a file on Windows with restrictive permissions atomically (TOCTOU protection)
#[cfg(target_os = "windows")]
fn create_file_windows_secure(path: &std::path::Path, content: &str) -> Result<(), String> {
    use std::fs::OpenOptions;
    use std::io::Write;

    // Create file with minimal access (owner-only initially)
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|e| format!("Failed to create secure file: {}", e))?;

    // Write content
    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write file content: {}", e))?;

    // Sync to disk
    file.sync_all()
        .map_err(|e| format!("Failed to sync file: {}", e))?;

    // Drop file handle before setting ACL
    drop(file);

    // Set restrictive ACL
    set_file_permissions_windows(path)?;

    Ok(())
}

// Restricts a file on Windows to the current user only, using icacls.
// This removes all inherited ACEs and grants only the current user Full Control,
// preventing other users on the machine from reading the file.
//
// The previous DENY-based approach (windows_acl crate) was broken: adding DENY ACEs
// for the "Everyone" and "Users" groups also denies the current user (who is a member
// of both), making the file unreadable by its own creator. The icacls /inheritance:r
// approach correctly removes inherited ACEs without denying the owner.
#[cfg(target_os = "windows")]
fn set_file_permissions_windows(path: &std::path::Path) -> Result<(), String> {
    use std::process::Command;

    let path_str = path.to_string_lossy().to_string();
    let username = std::env::var("USERNAME")
        .map_err(|_| "Failed to get current username for file permission setup".to_string())?;
    if username.is_empty() {
        return Err("Failed to get current username for file permission setup".to_string());
    }
    // Remove inherited permissions, grant only the current user Full Control
    let status = Command::new("icacls")
        .args([&path_str, "/inheritance:r", "/grant:r", &format!("{}:F", username)])
        .output()
        .map_err(|e| format!("Failed to run icacls: {}", e))?;
    if !status.status.success() {
        return Err("Failed to restrict file permissions (icacls failed)".to_string());
    }
    Ok(())
}

// Profile structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub host: String,
    pub port: i32,
    pub username: String,
    pub auth_method: String, // "key", "password", "central_password", or "none"
    pub key_path: Option<String>,
    pub group_path: Option<String>, // v0.7.0+: Semantic path like "Work/Production/Servers"
    pub central_password_id: Option<String>, // v0.9.0+: ID of linked CentralPassword
}

// Profile with metadata and tags (for get_profiles response)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileWithMetadata {
    // L-2: Use composition instead of field duplication (DRY principle)
    // The #[serde(flatten)] attribute spreads Profile fields at top level during serialization
    #[serde(flatten)]
    pub profile: Profile,
    // Metadata fields
    pub icon: Option<String>,
    pub is_favorite: bool,
    pub display_order: i32,
    // Tags (tag names, not IDs, for easier frontend use)
    pub tags: Vec<String>,
}

// Group structure for hierarchical organization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub path: String,
    pub icon: Option<String>,
    pub is_favorite: bool,
    pub display_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

// Hierarchical group tree node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupTreeNode {
    #[serde(flatten)]
    pub group: Group,
    pub children: Vec<GroupTreeNode>,
}

// Profile metadata structure for extended properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileMetadata {
    pub profile_id: String,
    pub icon: Option<String>,
    pub is_favorite: bool,
    pub display_order: i32,
}

// Tag structure for categorization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
    pub created_at: String,
}

// Central password structure for shared credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CentralPassword {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// Recent connection structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentConnection {
    pub id: i32,
    pub profile_id: String,
    pub name: String,
    pub username: String,
    pub host: String,
    pub port: i32,
    pub connected_at: String,
}

// User setting structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSetting {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}

// Terminal session structure
pub struct TerminalSession {
    pub session_id: String,
    pub profile_id: String,
    pub reader_handle: Option<thread::JoinHandle<()>>,
}

// Session registry for managing active terminal sessions
pub struct SessionRegistry {
    sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
    pty_writers: Arc<Mutex<HashMap<String, Box<dyn Write + Send>>>>,
    pty_pairs: Arc<Mutex<HashMap<String, Box<dyn portable_pty::MasterPty + Send>>>>,
    last_activity: Arc<Mutex<HashMap<String, Instant>>>, // Track last data received per session
    write_rate_limits: Arc<Mutex<HashMap<String, (Instant, u32)>>>, // (last_reset, write_count) per session
    abandoned_threads: Arc<Mutex<Vec<(String, thread::JoinHandle<()>, Instant)>>>, // (session_id, handle, abandoned_at)
}

impl SessionRegistry {
    pub fn new() -> Self {
        let registry = SessionRegistry {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            pty_writers: Arc::new(Mutex::new(HashMap::new())),
            pty_pairs: Arc::new(Mutex::new(HashMap::new())),
            last_activity: Arc::new(Mutex::new(HashMap::new())),
            write_rate_limits: Arc::new(Mutex::new(HashMap::new())),
            abandoned_threads: Arc::new(Mutex::new(Vec::new())),
        };

        // Start idle session monitor
        registry.start_idle_monitor();
        // Start abandoned thread cleanup
        registry.start_abandoned_thread_cleanup();

        registry
    }

    /// Start background thread to monitor and clean up idle sessions
    fn start_idle_monitor(&self) {
        const IDLE_TIMEOUT_SECS: u64 = 1800; // 30 minutes
        const CHECK_INTERVAL_SECS: u64 = 300; // Check every 5 minutes

        let sessions = Arc::clone(&self.sessions);
        let pty_pairs = Arc::clone(&self.pty_pairs);
        let pty_writers = Arc::clone(&self.pty_writers);
        let last_activity = Arc::clone(&self.last_activity);
        let write_rate_limits = Arc::clone(&self.write_rate_limits);

        std::thread::spawn(move || {
            loop {
                std::thread::sleep(std::time::Duration::from_secs(CHECK_INTERVAL_SECS));

                let now = Instant::now();
                let mut sessions_to_close = Vec::new();

                // Find idle sessions
                if let Ok(activity) = last_activity.lock() {
                    for (session_id, last_time) in activity.iter() {
                        if now.duration_since(*last_time).as_secs() > IDLE_TIMEOUT_SECS {
                            sessions_to_close.push(session_id.clone());
                        }
                    }
                }

                // Close idle sessions
                for session_id in sessions_to_close {
                    #[cfg(debug_assertions)]
                    println!("Closing idle session: {}", session_id);

                    // Clean up all session resources
                    let _ = sessions.lock().map(|mut s| s.remove(&session_id));
                    let _ = pty_pairs.lock().map(|mut p| p.remove(&session_id));
                    let _ = pty_writers.lock().map(|mut w| w.remove(&session_id));
                    let _ = last_activity.lock().map(|mut a| a.remove(&session_id));
                    let _ = write_rate_limits.lock().map(|mut r| r.remove(&session_id));
                }
            }
        });
    }

    /// Start background thread to cleanup abandoned reader threads
    fn start_abandoned_thread_cleanup(&self) {
        const CHECK_INTERVAL_SECS: u64 = 60; // Check every minute

        let abandoned_threads = Arc::clone(&self.abandoned_threads);

        std::thread::spawn(move || {
            loop {
                std::thread::sleep(std::time::Duration::from_secs(CHECK_INTERVAL_SECS));

                // Check abandoned threads and clean up finished ones
                if let Ok(mut threads) = abandoned_threads.lock() {
                    let before_count = threads.len();

                    // Remove threads that have finished
                    threads.retain(|(_session_id, handle, _abandoned_at)| {
                        if handle.is_finished() {
                            #[cfg(debug_assertions)]
                            println!(
                                "Cleaned up abandoned thread for session {} (was abandoned {} seconds ago)",
                                _session_id,
                                _abandoned_at.elapsed().as_secs()
                            );
                            false // Remove from vector
                        } else {
                            true // Keep in vector
                        }
                    });

                    let cleaned_count = before_count - threads.len();
                    if cleaned_count > 0 {
                        #[cfg(debug_assertions)]
                        println!("Cleaned up {} abandoned thread(s), {} still pending", cleaned_count, threads.len());
                    }
                }
            }
        });
    }
}

// Input validation functions
fn validate_hostname(host: &str) -> Result<(), String> {
    // SECURITY: Normalize Unicode to prevent lookalike attacks (e.g., U+FF1B fullwidth semicolon)
    let normalized: String = host.nfc().collect();
    let host = normalized.as_str();

    if host.is_empty() {
        return Err("Hostname cannot be empty.".to_string());
    }
    if host.len() > 64 {
        return Err("Hostname too long (max 64 characters).".to_string());
    }
    // Check for dangerous characters that could break shell commands
    if host.chars().any(|c| matches!(c, ';' | '&' | '|' | '`' | '$' | '"' | '\'' | '\n' | '\r' | '\\' | '<' | '>')) {
        return Err("Hostname contains invalid characters.".to_string());
    }
    // Basic hostname validation - alphanumeric, dots, hyphens only
    if !host.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-' || c == '_') {
        return Err("Hostname can only contain letters, numbers, dots, hyphens, and underscores.".to_string());
    }
    Ok(())
}

fn validate_username(username: &str) -> Result<(), String> {
    // SECURITY: Normalize Unicode to prevent lookalike attacks
    let normalized: String = username.nfc().collect();
    let username = normalized.as_str();

    if username.is_empty() {
        return Err("Username cannot be empty.".to_string());
    }
    if username.len() > 128 {
        return Err("Username too long (max 128 characters).".to_string());
    }
    // Check for dangerous characters
    if username.chars().any(|c| matches!(c, ';' | '&' | '|' | '`' | '$' | '"' | '\'' | '\n' | '\r' | '\\' | '<' | '>' | ' ')) {
        return Err("Username contains invalid characters.".to_string());
    }
    // Allow alphanumeric, underscore, hyphen, dot, @, and # (for formats like user@proxyuser or user#1234)
    if !username.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.' || c == '@' || c == '#') {
        return Err("Username can only contain letters, numbers, underscores, hyphens, dots, @, and #.".to_string());
    }
    Ok(())
}

fn validate_profile_name(name: &str) -> Result<(), String> {
    // SECURITY: Normalize Unicode to prevent lookalike attacks
    let normalized: String = name.nfc().collect();
    let name = normalized.as_str();

    if name.is_empty() {
        return Err("Profile name cannot be empty.".to_string());
    }
    if name.len() > 64 {
        return Err("Profile name too long (max 64 characters).".to_string());
    }
    // Allow alphanumeric, spaces, and specific special characters: - _ ( ) . [ ] #
    if !name.chars().all(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_' | '(' | ')' | '.' | '[' | ']' | '#')) {
        return Err("Profile name contains invalid characters.".to_string());
    }
    Ok(())
}

fn validate_port(port: i64) -> Result<u16, String> {
    // Validate port is within valid u16 range (1-65535)
    // Note: We accept i64 to handle any JSON number without overflow, then validate range before casting
    if port < 1 || port > 65535 {
        return Err("Port must be between 1 and 65535.".to_string());
    }

    // Safe to cast: we've verified port is in valid u16 range [1, 65535]
    Ok(port as u16)
}

fn validate_ipv4(ip: &str) -> Result<(), String> {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() != 4 {
        return Err("Invalid IPv4 format.".to_string());
    }

    for part in parts {
        match part.parse::<u8>() {
            Ok(_) => {}, // Valid octet (0-255)
            Err(_) => return Err("IPv4 octets must be 0-255".to_string()),
        }
    }
    Ok(())
}

fn validate_host_or_ip(host: &str) -> Result<(), String> {
    if host.is_empty() {
        return Err("Hostname/IP cannot be empty.".to_string());
    }

    // Check if it looks like an IPv4 address (contains only digits and dots)
    if host.chars().all(|c| c.is_numeric() || c == '.') {
        return validate_ipv4(host);
    }

    // Otherwise validate as hostname
    validate_hostname(host)
}

fn validate_description(desc: &str) -> Result<(), String> {
    // SECURITY: Normalize Unicode to prevent lookalike attacks
    let normalized: String = desc.nfc().collect();
    let desc = normalized.as_str();

    if desc.len() > 128 {
        return Err("Description too long (max 128 characters).".to_string());
    }
    if desc.chars().any(|c| matches!(c, '<' | '>')) {
        return Err("Description cannot contain < or >.".to_string());
    }
    Ok(())
}

fn validate_group(group: &str) -> Result<(), String> {
    if group.is_empty() {
        return Ok(()); // Group is optional
    }

    // SECURITY: Normalize Unicode to prevent lookalike attacks
    let normalized: String = group.nfc().collect();
    let group = normalized.as_str();

    // v0.7.0+: group_path can be a hierarchical path like "Work/Production/Servers"
    // Validate total path length (max 3 levels: 64+1+64+1+64 = 194 chars)
    if group.len() > 194 {
        return Err("Group path too long (max 194 characters).".to_string());
    }

    // Split by path separator and validate each segment
    let segments: Vec<&str> = group.split('/').collect();

    for segment in segments {
        // Each segment must be non-empty
        if segment.is_empty() {
            return Err("Group path contains empty segments.".to_string());
        }

        // Check for reserved name "Ungrouped" (case-insensitive)
        if segment.to_lowercase() == "ungrouped" {
            return Err("\"Ungrouped\" is a reserved name for profiles without a group.".to_string());
        }

        // Each segment has max length of 64 chars
        if segment.len() > 64 {
            return Err("Group name segment too long (max 64 characters per segment).".to_string());
        }

        // Same pattern as profile name: alphanumeric and specific special characters
        if !segment.chars().all(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_' | '(' | ')' | '.' | '[' | ']' | '#')) {
            return Err("Group name contains invalid characters.".to_string());
        }
    }

    Ok(())
}

// Validate all profile fields (used during import to prevent injection attacks)
fn validate_profile_fields(profile: &Profile) -> Result<(), String> {
    validate_profile_name(&profile.name)?;
    validate_host_or_ip(&profile.host)?;
    validate_username(&profile.username)?;
    validate_port(profile.port as i64)?;

    if let Some(ref desc) = profile.description {
        validate_description(desc)?;
    }

    if let Some(ref gp) = profile.group_path {
        validate_group(gp)?;
    }

    // Validate auth_method
    if !matches!(profile.auth_method.as_str(), "key" | "password" | "central_password" | "none") {
        return Err(format!("Invalid auth_method: '{}' (must be 'key', 'password', 'central_password', or 'none')", profile.auth_method));
    }

    Ok(())
}

fn validate_settings(settings: &SettingsData) -> Result<(), String> {
    // Validate theme
    if !matches!(settings.theme.as_str(), "system" | "dark" | "light") {
        return Err(format!("Invalid theme value: {}", settings.theme));
    }

    // Validate window dimensions
    if settings.window_width < 600 || settings.window_width > 4000 {
        return Err(format!("Invalid window width: {} (must be between 600-4000)", settings.window_width));
    }
    if settings.window_height < 450 || settings.window_height > 3000 {
        return Err(format!("Invalid window height: {} (must be between 450-3000)", settings.window_height));
    }

    // Validate recent_connections_limit
    if settings.recent_connections_limit < 0 || settings.recent_connections_limit > 20 {
        return Err(format!("Invalid recent_connections_limit: {} (must be between 0-20)", settings.recent_connections_limit));
    }

    // Validate filtered_groups if present
    if let Some(filtered_groups) = &settings.filtered_groups {
        for group in filtered_groups {
            if group.is_empty() {
                return Err("Empty group name in filtered_groups.".to_string());
            }
            validate_group(group)
                .map_err(|e| format!("Invalid filtered group: {}", e))?;
        }
    }

    // Validate collapsed_groups if present
    if let Some(collapsed_groups) = &settings.collapsed_groups {
        for group in collapsed_groups {
            if group.is_empty() {
                return Err("Empty group name in collapsed_groups.".to_string());
            }
            validate_group(group)
                .map_err(|e| format!("Invalid collapsed group: {}", e))?;
        }
    }

    Ok(())
}

fn validate_settings_os_specific(settings_os: &SettingsOsSpecific) -> Result<(), String> {
    // Validate terminal_preference
    // Valid values for macOS: terminal, custom, embedded
    // Valid values for Windows: windows_terminal, cmd, powershell, custom, embedded
    // "default" is accepted on both platforms for backwards compatibility (migrated to explicit value in v0.9.2)
    let valid_prefs = ["default", "terminal", "cmd", "powershell", "windows_terminal", "custom", "embedded"];
    if !valid_prefs.contains(&settings_os.terminal_preference.as_str()) {
        return Err(format!("Invalid terminal_preference value: {}", settings_os.terminal_preference));
    }

    Ok(())
}

fn validate_key_path(path: &str) -> Result<PathBuf, String> {
    if path.is_empty() {
        return Err("Key path cannot be empty.".to_string());
    }

    let expanded = shellexpand::tilde(path);
    let path_buf = PathBuf::from(expanded.as_ref());

    // Check if file exists
    if !path_buf.exists() {
        return Err(format!("Key file does not exist: {}", path));
    }

    // Get canonical path to resolve symlinks and relative paths
    let canonical = std::fs::canonicalize(&path_buf)
        .map_err(|e| format!("Invalid key path: {}", e))?;

    // Ensure it's in a safe location (home directory or .ssh)
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let ssh_dir = home.join(".ssh");

    // Canonicalize home paths for consistent comparison (handles Windows \\?\ prefix)
    let canonical_home = std::fs::canonicalize(&home)
        .map_err(|e| format!("Cannot canonicalize home directory: {}", e))?;
    let canonical_ssh_dir = if ssh_dir.exists() {
        std::fs::canonicalize(&ssh_dir).ok()
    } else {
        None
    };

    // Check if key path is within home directory or .ssh directory
    let is_in_home = canonical.starts_with(&canonical_home);
    let is_in_ssh = canonical_ssh_dir
        .map(|ssh| canonical.starts_with(&ssh))
        .unwrap_or(false);

    if !is_in_home && !is_in_ssh {
        return Err("Key path must be within your home directory.".to_string());
    }

    Ok(canonical)
}

fn validate_terminal_path(path: &str) -> Result<PathBuf, String> {
    if path.is_empty() {
        return Err("Terminal path cannot be empty.".to_string());
    }

    let expanded = shellexpand::tilde(path);
    let path_buf = PathBuf::from(expanded.as_ref());

    // Check if file exists
    if !path_buf.exists() {
        return Err(format!("Terminal application not found: {}", path));
    }

    // Get canonical path to resolve symlinks, .. components, and relative paths
    let canonical = std::fs::canonicalize(&path_buf)
        .map_err(|e| format!("Invalid terminal path: {}", e))?;

    // Platform-specific validation
    #[cfg(target_os = "macos")]
    {
        // Ensure it's an .app bundle
        let path_str = canonical.to_string_lossy();
        if !path_str.ends_with(".app") {
            return Err("macOS terminal must be an .app bundle.".to_string());
        }

        // Whitelist: Must be in standard macOS application directories
        let allowed_dirs = vec![
            PathBuf::from("/Applications"),
            PathBuf::from("/System/Applications"),
            PathBuf::from("/System/Library/CoreServices/Applications"),
            PathBuf::from("/usr/local"),
            PathBuf::from("/opt/homebrew"),
            PathBuf::from("/opt/local"), // MacPorts
        ];

        let mut is_allowed = false;
        for allowed_dir in allowed_dirs {
            if canonical.starts_with(&allowed_dir) {
                is_allowed = true;
                break;
            }
        }

        // Also allow user's Applications folder
        if !is_allowed {
            if let Some(home) = dirs::home_dir() {
                let user_apps = home.join("Applications");
                if canonical.starts_with(&user_apps) {
                    is_allowed = true;
                }
            }
        }

        if !is_allowed {
            return Err("Terminal must be located in /Applications, /System/Applications, or ~/Applications.".to_string());
        }

        // Check if the app bundle is executable (check the Contents/MacOS directory exists)
        let macos_dir = canonical.join("Contents").join("MacOS");
        if !macos_dir.exists() || !macos_dir.is_dir() {
            return Err("Invalid .app bundle structure.".to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Ensure it's an .exe file
        let path_str = canonical.to_string_lossy();
        if !path_str.ends_with(".exe") {
            return Err("Windows terminal must be an .exe file.".to_string());
        }

        // Whitelist: Must be in Program Files, Windows directory, or user's AppData
        let mut is_allowed = false;

        // Check Program Files
        if let Ok(program_files) = std::env::var("ProgramFiles") {
            if canonical.starts_with(&program_files) {
                is_allowed = true;
            }
        }

        // Check Program Files (x86)
        if !is_allowed {
            if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
                if canonical.starts_with(&program_files_x86) {
                    is_allowed = true;
                }
            }
        }

        // Check Windows directory
        if !is_allowed {
            if let Ok(windir) = std::env::var("SystemRoot") {
                if canonical.starts_with(&windir) {
                    is_allowed = true;
                }
            }
        }

        // Check user's Local AppData
        if !is_allowed {
            if let Some(local_appdata) = dirs::data_local_dir() {
                if canonical.starts_with(&local_appdata) {
                    is_allowed = true;
                }
            }
        }

        if !is_allowed {
            return Err("Terminal must be located in Program Files, Windows directory, or AppData.".to_string());
        }
    }

    Ok(canonical)
}

// Database wrapper
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    fn new(path: PathBuf) -> SqlResult<Self> {
        // SECURITY: Create the database file with restrictive permissions before opening
        // to prevent TOCTOU race condition where the file would be created with default
        // permissions and then changed afterward.

        // Apply security hardening to the database file.
        // On new installs: create the file with restricted permissions before SQLite opens it
        // (TOCTOU protection — avoids a window where the file exists with default permissions).
        // On existing installs: re-apply permissions in case a previous run left the file with
        // a broken ACL (e.g. from the old windows_acl DENY approach that blocked the owner).
        #[cfg(unix)]
        if !path.exists() {
            use std::fs;
            use std::os::unix::fs::OpenOptionsExt;
            fs::OpenOptions::new()
                .create(true)
                .write(true)
                .mode(0o600)
                .open(&path)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        }

        #[cfg(target_os = "windows")]
        {
            use std::fs::OpenOptions;
            if !path.exists() {
                // Create the file before setting ACL (icacls requires the file to exist)
                let file = OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(&path)
                    .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
                drop(file);
            }
            // Always re-apply permissions — fixes files left with a broken ACL from a
            // prior run (e.g. old DENY-based setup that blocked the current user).
            set_file_permissions_windows(&path)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(std::io::ErrorKind::PermissionDenied, e))))?;
        }

        let conn = Connection::open(&path)?;

        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        // Create schema_version table if it doesn't exist
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            )",
            [],
        )?;

        // Create profiles table (migration 0 - baseline)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                host TEXT NOT NULL,
                port INTEGER NOT NULL DEFAULT 22,
                username TEXT NOT NULL,
                auth_method TEXT NOT NULL DEFAULT 'key',
                key_path TEXT,
                group_name TEXT
            )",
            [],
        )?;

        // Apply migrations
        Self::apply_migrations(&conn)?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    fn get_schema_version(conn: &Connection) -> SqlResult<i32> {
        // Get the highest version number from schema_version table
        let version: Result<i32, _> = conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0)
        );
        Ok(version.unwrap_or(0))
    }

    fn apply_migrations(conn: &Connection) -> SqlResult<()> {
        let current_version = Self::get_schema_version(conn)?;

        // Migration 1: Create recent_connections table
        if current_version < 1 {
            conn.execute(
                "CREATE TABLE IF NOT EXISTS recent_connections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    profile_id TEXT NOT NULL,
                    connected_at TEXT NOT NULL,
                    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
                )",
                [],
            )?;

            // Create indexes for better query performance
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_recent_connections_profile_id
                 ON recent_connections(profile_id)",
                [],
            )?;

            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_recent_connections_connected_at
                 ON recent_connections(connected_at DESC)",
                [],
            )?;

            // Record migration
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                (1, chrono::Utc::now().to_rfc3339()),
            )?;
        }

        // Migration 2: Create active_sessions table
        if current_version < 2 {
            conn.execute(
                "CREATE TABLE IF NOT EXISTS active_sessions (
                    id TEXT PRIMARY KEY,
                    profile_id TEXT NOT NULL,
                    tab_id TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    last_activity_at TEXT NOT NULL,
                    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
                )",
                [],
            )?;

            // Record migration
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                (2, chrono::Utc::now().to_rfc3339()),
            )?;
        }

        // Migration 3: Create user_settings table
        if current_version < 3 {
            conn.execute(
                "CREATE TABLE IF NOT EXISTS user_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )",
                [],
            )?;

            // Record migration
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                (3, chrono::Utc::now().to_rfc3339()),
            )?;
        }

        // Migration 4: Hierarchical groups and enhanced organization (v0.7.0)
        if current_version < 4 {
            // Create groups table with hierarchical support
            conn.execute(
                "CREATE TABLE groups (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    parent_id TEXT,
                    path TEXT NOT NULL UNIQUE,
                    icon TEXT,
                    is_favorite INTEGER DEFAULT 0,
                    display_order INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (parent_id) REFERENCES groups(id) ON DELETE CASCADE
                )",
                [],
            )?;

            // Create indexes for groups
            conn.execute(
                "CREATE UNIQUE INDEX idx_groups_unique_name_parent
                 ON groups(name, COALESCE(parent_id, ''))",
                [],
            )?;

            conn.execute(
                "CREATE INDEX idx_groups_parent ON groups(parent_id)",
                [],
            )?;

            conn.execute(
                "CREATE INDEX idx_groups_path ON groups(path)",
                [],
            )?;

            // Create profile_metadata table
            conn.execute(
                "CREATE TABLE profile_metadata (
                    profile_id TEXT PRIMARY KEY,
                    icon TEXT,
                    is_favorite INTEGER DEFAULT 0,
                    display_order INTEGER DEFAULT 0,
                    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
                )",
                [],
            )?;

            // Backfill default metadata for all existing profiles
            // Default: icon='server', is_favorite=0, display_order=0
            conn.execute(
                "INSERT INTO profile_metadata (profile_id, icon, is_favorite, display_order)
                 SELECT id, 'server', 0, 0
                 FROM profiles",
                [],
            )?;

            // Create tags table
            conn.execute(
                "CREATE TABLE tags (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    color TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )",
                [],
            )?;

            // Create profile_tags junction table
            conn.execute(
                "CREATE TABLE profile_tags (
                    profile_id TEXT NOT NULL,
                    tag_id TEXT NOT NULL,
                    PRIMARY KEY (profile_id, tag_id),
                    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
                    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
                )",
                [],
            )?;

            // L-5: group_tags table removed (unused feature - no UI, no commands, import-only)
            // If needed in v1.0.0, add with proper migration and full feature implementation

            // Extract unique group names from profiles (handle NULL as "Ungrouped")
            let mut stmt = conn.prepare(
                "SELECT DISTINCT COALESCE(group_name, 'Ungrouped') FROM profiles"
            )?;
            let group_names: Vec<String> = stmt.query_map([], |row| row.get(0))?.collect::<Result<Vec<_>, _>>()?;
            drop(stmt);

            // Create group records for each unique group name
            let now = chrono::Utc::now().to_rfc3339();
            for group_name in group_names {
                let group_id = Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO groups (id, name, parent_id, path, icon, is_favorite, display_order, created_at, updated_at)
                     VALUES (?1, ?2, NULL, ?3, NULL, 0, 0, ?4, ?5)",
                    (&group_id, &group_name, &group_name, &now, &now),
                )?;
            }

            // Rename group_name column to group_path (semantic path approach)
            // SQLite doesn't support RENAME COLUMN before 3.25.0, so we:
            // 1. Add new column
            // 2. Copy data
            // 3. Drop old column (in a recreate-table approach)

            // Add group_path column
            conn.execute(
                "ALTER TABLE profiles ADD COLUMN group_path TEXT",
                [],
            )?;

            // Populate group_path by matching group_name to group path
            conn.execute(
                "UPDATE profiles
                 SET group_path = COALESCE(group_name, 'Ungrouped')",
                [],
            )?;

            // Create index for profiles.group_path
            conn.execute(
                "CREATE INDEX idx_profiles_group_path ON profiles(group_path)",
                [],
            )?;

            // Verify all profiles have valid group_path
            let count: i32 = conn.query_row(
                "SELECT COUNT(*) FROM profiles WHERE group_path IS NULL OR group_path = ''",
                [],
                |row| row.get(0)
            )?;

            if count > 0 {
                return Err(rusqlite::Error::ExecuteReturnedResults);
            }

            // Record migration
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                (4, chrono::Utc::now().to_rfc3339()),
            )?;
        }

        // Migration 5: Central Passwords (v0.9.0)
        if current_version < 5 {
            // Create central_passwords table
            conn.execute(
                "CREATE TABLE IF NOT EXISTS central_passwords (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )",
                [],
            )?;

            // Add central_password_id column to profiles
            conn.execute(
                "ALTER TABLE profiles ADD COLUMN central_password_id TEXT",
                [],
            )?;

            // Index for lookups by central_password_id
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_profiles_central_password_id
                 ON profiles(central_password_id)",
                [],
            )?;

            // Record migration
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                (5, chrono::Utc::now().to_rfc3339()),
            )?;
        }

        Ok(())
    }

    fn get_all_profiles(&self) -> SqlResult<Vec<Profile>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, name, description, host, port, username, auth_method, key_path, group_path, central_password_id
             FROM profiles ORDER BY name"
        )?;

        let profiles = stmt
            .query_map([], |row| {
                Ok(Profile {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    host: row.get(3)?,
                    port: row.get(4)?,
                    username: row.get(5)?,
                    auth_method: row.get(6)?,
                    key_path: row.get(7)?,
                    group_path: row.get(8)?,
                    central_password_id: row.get(9)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(profiles)
    }

    fn get_all_profiles_with_metadata(&self) -> SqlResult<Vec<ProfileWithMetadata>> {
        let conn = self.conn.lock().expect("Database lock poisoned");

        // First, get all profiles with their metadata in one query
        let mut stmt = conn.prepare(
            "SELECT p.id, p.name, p.description, p.host, p.port, p.username, p.auth_method,
                    p.key_path, p.group_path, p.central_password_id, m.icon, COALESCE(m.is_favorite, 0),
                    COALESCE(m.display_order, 0)
             FROM profiles p
             LEFT JOIN profile_metadata m ON p.id = m.profile_id
             ORDER BY COALESCE(m.display_order, 0), p.name"
        )?;

        let profiles_with_metadata = stmt
            .query_map([], |row| {
                // L-2: Create Profile first, then compose ProfileWithMetadata
                let profile = Profile {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    host: row.get(3)?,
                    port: row.get(4)?,
                    username: row.get(5)?,
                    auth_method: row.get(6)?,
                    key_path: row.get(7)?,
                    group_path: row.get(8)?,
                    central_password_id: row.get(9)?,
                };
                let id = profile.id.clone();

                Ok((
                    id,
                    ProfileWithMetadata {
                        profile,
                        icon: row.get(10)?,
                        is_favorite: row.get::<_, i32>(11)? != 0,
                        display_order: row.get(12)?,
                        tags: Vec::new(), // Will populate below
                    }
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        // Convert to HashMap for efficient tag assignment
        let mut profiles_map: std::collections::HashMap<String, ProfileWithMetadata> =
            profiles_with_metadata.into_iter().collect();

        // Get all tag assignments in one query
        let mut tag_stmt = conn.prepare(
            "SELECT pt.profile_id, t.name
             FROM profile_tags pt
             JOIN tags t ON pt.tag_id = t.id
             ORDER BY pt.profile_id, t.name"
        )?;

        let tag_rows = tag_stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?, // profile_id
                row.get::<_, String>(1)?, // tag_name
            ))
        })?;

        // Assign tags to profiles
        for tag_result in tag_rows {
            let (profile_id, tag_name) = tag_result?;
            if let Some(profile) = profiles_map.get_mut(&profile_id) {
                profile.tags.push(tag_name);
            }
        }

        // Convert back to Vec and sort by display_order then name
        let mut profiles: Vec<ProfileWithMetadata> = profiles_map.into_values().collect();
        profiles.sort_by(|a, b| a.display_order.cmp(&b.display_order).then(a.profile.name.cmp(&b.profile.name)));

        Ok(profiles)
    }

    fn create_profile(&self, profile: &Profile) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute(
            "INSERT INTO profiles (id, name, description, host, port, username, auth_method, key_path, group_path, central_password_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            (
                &profile.id,
                &profile.name,
                &profile.description,
                &profile.host,
                &profile.port,
                &profile.username,
                &profile.auth_method,
                &profile.key_path,
                &profile.group_path,
                &profile.central_password_id,
            ),
        )?;
        Ok(())
    }

    fn update_profile(&self, profile: &Profile) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute(
            "UPDATE profiles
             SET name = ?2, description = ?3, host = ?4, port = ?5,
                 username = ?6, auth_method = ?7, key_path = ?8, group_path = ?9,
                 central_password_id = ?10
             WHERE id = ?1",
            (
                &profile.id,
                &profile.name,
                &profile.description,
                &profile.host,
                &profile.port,
                &profile.username,
                &profile.auth_method,
                &profile.key_path,
                &profile.group_path,
                &profile.central_password_id,
            ),
        )?;
        Ok(())
    }

    fn delete_profile(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute("DELETE FROM profiles WHERE id = ?1", [id])?;
        Ok(())
    }

    // Group CRUD operations
    fn get_all_groups(&self) -> SqlResult<Vec<Group>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, name, parent_id, path, icon, is_favorite, display_order, created_at, updated_at
             FROM groups ORDER BY path"
        )?;

        let groups = stmt
            .query_map([], |row| {
                Ok(Group {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    parent_id: row.get(2)?,
                    path: row.get(3)?,
                    icon: row.get(4)?,
                    is_favorite: row.get::<_, i32>(5)? != 0,
                    display_order: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(groups)
    }

    fn get_group_by_id(&self, id: &str) -> SqlResult<Option<Group>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, name, parent_id, path, icon, is_favorite, display_order, created_at, updated_at
             FROM groups WHERE id = ?1"
        )?;

        let mut groups = stmt.query_map([id], |row| {
            Ok(Group {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                path: row.get(3)?,
                icon: row.get(4)?,
                is_favorite: row.get::<_, i32>(5)? != 0,
                display_order: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;

        groups.next().transpose()
    }

    fn get_group_by_path(&self, path: &str) -> SqlResult<Option<Group>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, name, parent_id, path, icon, is_favorite, display_order, created_at, updated_at
             FROM groups WHERE path = ?1"
        )?;

        let mut groups = stmt.query_map([path], |row| {
            Ok(Group {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                path: row.get(3)?,
                icon: row.get(4)?,
                is_favorite: row.get::<_, i32>(5)? != 0,
                display_order: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;

        groups.next().transpose()
    }

    fn move_profile_to_group(&self, profile_id: &str, new_group_path: Option<&str>) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute(
            "UPDATE profiles SET group_path = ?1 WHERE id = ?2",
            rusqlite::params![new_group_path, profile_id],
        )?;
        Ok(())
    }

    fn reorder_profiles_db(&self, orders: &[ProfileOrder]) -> SqlResult<()> {
        let mut conn = self.conn.lock().expect("Database lock poisoned");
        let tx = conn.transaction()?;
        for order in orders {
            tx.execute(
                "UPDATE profile_metadata SET display_order = ?1 WHERE profile_id = ?2",
                (&order.display_order, &order.profile_id),
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    fn reorder_groups_db(&self, orders: &[GroupOrder]) -> SqlResult<()> {
        let mut conn = self.conn.lock().expect("Database lock poisoned");
        let tx = conn.transaction()?;
        for order in orders {
            tx.execute(
                "UPDATE groups SET display_order = ?1 WHERE id = ?2",
                (&order.display_order, &order.group_id),
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    fn create_group(&self, group: &Group) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute(
            "INSERT INTO groups (id, name, parent_id, path, icon, is_favorite, display_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            (
                &group.id,
                &group.name,
                &group.parent_id,
                &group.path,
                &group.icon,
                if group.is_favorite { 1 } else { 0 },
                &group.display_order,
                &group.created_at,
                &group.updated_at,
            ),
        )?;
        Ok(())
    }

    fn update_group(&self, group: &Group) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute(
            "UPDATE groups
             SET name = ?2, parent_id = ?3, path = ?4, icon = ?5, is_favorite = ?6, display_order = ?7, updated_at = ?8
             WHERE id = ?1",
            (
                &group.id,
                &group.name,
                &group.parent_id,
                &group.path,
                &group.icon,
                if group.is_favorite { 1 } else { 0 },
                &group.display_order,
                &group.updated_at,
            ),
        )?;
        Ok(())
    }

    fn delete_group(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute("DELETE FROM groups WHERE id = ?1", [id])?;
        Ok(())
    }

    fn get_profile_by_id(&self, id: &str) -> SqlResult<Option<Profile>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, name, description, host, port, username, auth_method, key_path, group_path, central_password_id
             FROM profiles WHERE id = ?1"
        )?;

        let mut profiles = stmt.query_map([id], |row| {
            Ok(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                host: row.get(3)?,
                port: row.get(4)?,
                username: row.get(5)?,
                auth_method: row.get(6)?,
                key_path: row.get(7)?,
                group_path: row.get(8)?,
                central_password_id: row.get(9)?,
            })
        })?;

        // M-8: Standardized to use .transpose() pattern (consistent with get_group_by_id)
        profiles.next().transpose()
    }

    // Recent connections methods
    fn get_recent_connections(&self, limit: Option<usize>) -> SqlResult<Vec<RecentConnection>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let limit_val = limit.unwrap_or(5).min(20) as i64; // Max 20, default 5

        let mut stmt = conn.prepare(
            "SELECT rc.id, rc.profile_id, p.name, p.username, p.host, p.port, rc.connected_at
             FROM recent_connections rc
             JOIN profiles p ON rc.profile_id = p.id
             ORDER BY rc.connected_at DESC
             LIMIT ?1"
        )?;

        let connections = stmt
            .query_map([limit_val], |row| {
                Ok(RecentConnection {
                    id: row.get(0)?,
                    profile_id: row.get(1)?,
                    name: row.get(2)?,
                    username: row.get(3)?,
                    host: row.get(4)?,
                    port: row.get(5)?,
                    connected_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(connections)
    }

    fn record_connection(&self, profile_id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");

        // Check if this profile already exists in recent_connections
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM recent_connections WHERE profile_id = ?1",
            [profile_id],
            |row| row.get(0)
        )?;

        if exists {
            // Update the timestamp (moves to top of recent list)
            conn.execute(
                "UPDATE recent_connections SET connected_at = ?1 WHERE profile_id = ?2",
                (chrono::Utc::now().to_rfc3339(), profile_id),
            )?;
        } else {
            // Insert new record
            conn.execute(
                "INSERT INTO recent_connections (profile_id, connected_at) VALUES (?1, ?2)",
                (profile_id, chrono::Utc::now().to_rfc3339()),
            )?;
        }

        Ok(())
    }

    fn clear_recent_connections(&self) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute("DELETE FROM recent_connections", [])?;
        Ok(())
    }

    fn remove_recent_connection(&self, profile_id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute("DELETE FROM recent_connections WHERE profile_id = ?1", [profile_id])?;
        Ok(())
    }

    // User settings methods
    fn get_setting(&self, key: &str) -> SqlResult<Option<UserSetting>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT key, value, updated_at FROM user_settings WHERE key = ?1"
        )?;

        let mut settings = stmt.query_map([key], |row| {
            Ok(UserSetting {
                key: row.get(0)?,
                value: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })?;

        // M-8: Standardized to use .transpose() pattern
        settings.next().transpose()
    }

    fn save_setting(&self, key: &str, value: &str) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");

        // Use INSERT OR REPLACE for upsert behavior
        conn.execute(
            "INSERT OR REPLACE INTO user_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
            (key, value, chrono::Utc::now().to_rfc3339()),
        )?;

        Ok(())
    }

    // Profile metadata methods
    fn get_profile_metadata(&self, profile_id: &str) -> SqlResult<Option<ProfileMetadata>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT profile_id, icon, is_favorite, display_order FROM profile_metadata WHERE profile_id = ?1"
        )?;

        let mut metadata = stmt.query_map([profile_id], |row| {
            Ok(ProfileMetadata {
                profile_id: row.get(0)?,
                icon: row.get(1)?,
                is_favorite: row.get::<_, i32>(2)? != 0,
                display_order: row.get(3)?,
            })
        })?;

        // M-8: Standardized to use .transpose() pattern
        metadata.next().transpose()
    }

    // Tag methods
    fn get_profile_tags(&self, profile_id: &str) -> SqlResult<Vec<Tag>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT t.id, t.name, t.color, t.created_at
             FROM tags t
             JOIN profile_tags pt ON t.id = pt.tag_id
             WHERE pt.profile_id = ?1
             ORDER BY t.name COLLATE NOCASE"
        )?;

        let tags = stmt
            .query_map([profile_id], |row| {
                Ok(Tag {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    created_at: row.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(tags)
    }

    // L-5: get_group_tags removed (group_tags feature removed - no UI, no commands)

    // M-11: Helper method to get all descendant group paths (including the group itself)
    // Extracted to eliminate duplication in delete_group cascade/move modes
    fn get_descendant_paths(&self, group_path: &str) -> SqlResult<Vec<String>> {
        let conn = self.conn.lock().expect("Database lock poisoned");

        // Escape LIKE wildcards to prevent unintended matches
        let escaped_path = group_path.replace('%', "\\%").replace('_', "\\_");

        let mut stmt = conn.prepare(
            "SELECT path FROM groups WHERE path LIKE ?1 ESCAPE '\\' OR path = ?2"
        )?;

        let rows = stmt.query_map([format!("{}/%", escaped_path), group_path.to_string()], |row| row.get(0))?;

        rows.collect()
    }

    // Toggle favorite status for a profile
    fn toggle_profile_favorite_db(&self, profile_id: &str) -> SqlResult<bool> {
        let conn = self.conn.lock().expect("Database lock poisoned");

        // Get current favorite status (or false if no metadata exists)
        let current_favorite: bool = conn.query_row(
            "SELECT COALESCE(is_favorite, 0) FROM profile_metadata WHERE profile_id = ?1",
            [profile_id],
            |row| {
                let val: i32 = row.get(0)?;
                Ok(val != 0)
            }
        ).unwrap_or(false);

        let new_favorite = !current_favorite;

        // Upsert metadata with new favorite status
        conn.execute(
            "INSERT INTO profile_metadata (profile_id, icon, is_favorite, display_order)
             VALUES (?1, NULL, ?2, 0)
             ON CONFLICT(profile_id) DO UPDATE SET is_favorite = excluded.is_favorite",
            (profile_id, if new_favorite { 1 } else { 0 }),
        )?;

        Ok(new_favorite)
    }

    // Set profile favorite status (explicit set, not toggle)
    fn set_profile_favorite_db(&self, profile_id: &str, is_favorite: bool) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute(
            "INSERT INTO profile_metadata (profile_id, icon, is_favorite, display_order)
             VALUES (?1, NULL, ?2, 0)
             ON CONFLICT(profile_id) DO UPDATE SET is_favorite = excluded.is_favorite",
            (profile_id, if is_favorite { 1 } else { 0 }),
        )?;
        Ok(())
    }

    // Update profile icon
    fn update_profile_icon_db(&self, profile_id: &str, icon: Option<String>) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute(
            "INSERT INTO profile_metadata (profile_id, icon, is_favorite, display_order)
             VALUES (?1, ?2, 0, 0)
             ON CONFLICT(profile_id) DO UPDATE SET icon = excluded.icon",
            (profile_id, icon),
        )?;
        Ok(())
    }

    // Upsert profile metadata (icon and is_favorite)
    fn upsert_profile_metadata_db(&self, profile_id: &str, icon: Option<String>, is_favorite: bool) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute(
            "INSERT INTO profile_metadata (profile_id, icon, is_favorite, display_order)
             VALUES (?1, ?2, ?3, 0)
             ON CONFLICT(profile_id) DO UPDATE SET
                icon = excluded.icon,
                is_favorite = excluded.is_favorite",
            (profile_id, icon, if is_favorite { 1 } else { 0 }),
        )?;
        Ok(())
    }

    // Get all tags
    fn get_all_tags(&self) -> SqlResult<Vec<Tag>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, name, color, created_at FROM tags ORDER BY name COLLATE NOCASE"
        )?;

        let tags = stmt
            .query_map([], |row| {
                Ok(Tag {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    created_at: row.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(tags)
    }

    // Create a new tag
    fn create_tag_db(&self, tag: &Tag) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute(
            "INSERT INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
            (&tag.id, &tag.name, &tag.color, &tag.created_at),
        )?;
        Ok(())
    }

    // Delete a tag
    fn delete_tag_db(&self, tag_id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute("DELETE FROM tags WHERE id = ?1", [tag_id])?;
        Ok(())
    }

    // Get tag usage counts
    fn get_tag_usage_counts_db(&self) -> SqlResult<Vec<(Tag, i32)>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT t.id, t.name, t.color, t.created_at, COUNT(pt.profile_id) as usage_count
             FROM tags t
             LEFT JOIN profile_tags pt ON t.id = pt.tag_id
             GROUP BY t.id
             ORDER BY t.name COLLATE NOCASE"
        )?;

        let results = stmt
            .query_map([], |row| {
                let tag = Tag {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    created_at: row.get(3)?,
                };
                let count: i32 = row.get(4)?;
                Ok((tag, count))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(results)
    }

    // Add tag to profile
    fn add_profile_tag_db(&self, profile_id: &str, tag_id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute(
            "INSERT OR IGNORE INTO profile_tags (profile_id, tag_id) VALUES (?1, ?2)",
            (profile_id, tag_id),
        )?;
        Ok(())
    }

    // Remove tag from profile
    fn remove_profile_tag_db(&self, profile_id: &str, tag_id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute(
            "DELETE FROM profile_tags WHERE profile_id = ?1 AND tag_id = ?2",
            (profile_id, tag_id),
        )?;
        Ok(())
    }

    // Set profile tags (replaces all existing tags)
    fn set_profile_tags_db(&self, profile_id: &str, tag_ids: &[String]) -> SqlResult<()> {
        let mut conn = self.conn.lock().expect("Database lock poisoned");

        // Use RAII transaction guard for automatic rollback on panic or error
        let tx = conn.transaction()?;

        // Delete existing tags
        tx.execute(
            "DELETE FROM profile_tags WHERE profile_id = ?1",
            [profile_id],
        )?;

        // Insert new tags
        for tag_id in tag_ids {
            tx.execute(
                "INSERT INTO profile_tags (profile_id, tag_id) VALUES (?1, ?2)",
                (profile_id, tag_id),
            )?;
        }

        // Commit transaction (explicit commit, auto-rollback on drop if not committed)
        tx.commit()?;
        Ok(())
    }

    // --- Central Password DB methods ---

    fn create_central_password(&self, cp: &CentralPassword) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute(
            "INSERT INTO central_passwords (id, name, description, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (&cp.id, &cp.name, &cp.description, &cp.created_at, &cp.updated_at),
        )?;
        Ok(())
    }

    fn get_all_central_passwords(&self) -> SqlResult<Vec<CentralPassword>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, name, description, created_at, updated_at
             FROM central_passwords ORDER BY name COLLATE NOCASE"
        )?;

        let cps = stmt
            .query_map([], |row| {
                Ok(CentralPassword {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(cps)
    }

    fn get_central_password_by_id(&self, id: &str) -> SqlResult<Option<CentralPassword>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, name, description, created_at, updated_at
             FROM central_passwords WHERE id = ?1"
        )?;

        let mut rows = stmt.query_map([id], |row| {
            Ok(CentralPassword {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;

        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    fn get_central_password_by_name(&self, name: &str) -> SqlResult<Option<CentralPassword>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, name, description, created_at, updated_at
             FROM central_passwords WHERE name = ?1"
        )?;

        let mut rows = stmt.query_map([name], |row| {
            Ok(CentralPassword {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;

        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    fn update_central_password_meta(
        &self,
        id: &str,
        name: &str,
        description: Option<&str>,
    ) -> SqlResult<()> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        conn.execute(
            "UPDATE central_passwords SET name = ?1, description = ?2, updated_at = ?3
             WHERE id = ?4",
            (name, description, chrono::Utc::now().to_rfc3339(), id),
        )?;
        Ok(())
    }

    fn get_profiles_by_central_password_id(&self, cp_id: &str) -> SqlResult<Vec<Profile>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, name, description, host, port, username, auth_method, key_path, group_path, central_password_id
             FROM profiles WHERE central_password_id = ?1 ORDER BY name"
        )?;

        let profiles = stmt
            .query_map([cp_id], |row| {
                Ok(Profile {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    host: row.get(3)?,
                    port: row.get(4)?,
                    username: row.get(5)?,
                    auth_method: row.get(6)?,
                    key_path: row.get(7)?,
                    group_path: row.get(8)?,
                    central_password_id: row.get(9)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(profiles)
    }

    // Reverts all profiles linked to a central password back to keyboard-interactive auth.
    // Returns the number of profiles updated (shown in deletion toast).
    fn revert_profiles_central_password(&self, cp_id: &str) -> SqlResult<usize> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let count = conn.execute(
            "UPDATE profiles SET auth_method = 'none', central_password_id = NULL
             WHERE central_password_id = ?1",
            [cp_id],
        )?;
        Ok(count)
    }

    fn get_profiles_by_group_path(&self, group_path: &str) -> SqlResult<Vec<Profile>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, name, description, host, port, username, auth_method, key_path, group_path, central_password_id
             FROM profiles WHERE group_path = ?1
             ORDER BY name"
        )?;

        let profiles = stmt
            .query_map([group_path], |row| {
                Ok(Profile {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    host: row.get(3)?,
                    port: row.get(4)?,
                    username: row.get(5)?,
                    auth_method: row.get(6)?,
                    key_path: row.get(7)?,
                    group_path: row.get(8)?,
                    central_password_id: row.get(9)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(profiles)
    }

    fn get_child_groups(&self, parent_id: &str) -> SqlResult<Vec<Group>> {
        let conn = self.conn.lock().expect("Database lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, name, parent_id, path, icon, is_favorite, display_order, created_at, updated_at
             FROM groups WHERE parent_id = ?1
             ORDER BY display_order, name"
        )?;

        let groups = stmt
            .query_map([parent_id], |row| {
                Ok(Group {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    parent_id: row.get(2)?,
                    path: row.get(3)?,
                    icon: row.get(4)?,
                    is_favorite: row.get::<_, i32>(5)? != 0,
                    display_order: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(groups)
    }
}

// Password storage using system keychain
fn store_password(profile_id: &str, password: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(NEW_KEYCHAIN_SERVICE, profile_id)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    entry
        .set_password(password)
        .map_err(|e| format!("Failed to store password: {}", e))?;
    Ok(())
}

fn get_password(profile_id: &str) -> Result<String, String> {
    let entry = keyring::Entry::new(NEW_KEYCHAIN_SERVICE, profile_id)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    entry
        .get_password()
        .map_err(|e| format!("Failed to retrieve password: {}", e))
}

fn delete_password(profile_id: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(NEW_KEYCHAIN_SERVICE, profile_id)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    entry
        .delete_credential()
        .map_err(|e| format!("Failed to delete password: {}", e))?;
    Ok(())
}

#[tauri::command]
fn get_profile_password(profile_id: String) -> Result<String, String> {
    get_password(&profile_id)
}

// Export/Import structures (full export/import)
#[derive(Debug, Serialize, Deserialize)]
struct ProfileExport {
    #[serde(flatten)]
    profile: Profile,  // Use Profile directly - group_path is already semantic
    password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    metadata: Option<ProfileMetadata>,
    #[serde(default)]
    tags: Vec<Tag>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    central_password_ref: Option<String>,  // v0.9.0+: Name of linked central password (portable reference)
}

#[derive(Debug, Serialize, Deserialize)]
struct ExportData {
    export_format_version: String,
    version: String,
    exported_at: String,
    profiles: Vec<ProfileExport>,
}

#[derive(Debug, Deserialize)]
struct ImportData {
    #[serde(default)]
    _export_format_version: Option<String>,  // Unused: compatibility checked on frontend
    profiles: Vec<ProfileExport>,
}

// Portable group structure for export/import (uses semantic parent_path instead of parent_id UUID)
#[derive(Debug, Clone, Serialize, Deserialize)]
struct GroupPortable {
    pub id: String,  // Exported but regenerated on import
    pub name: String,
    pub parent_path: Option<String>,  // Semantic path to parent instead of UUID
    pub path: String,  // Full semantic path
    pub icon: Option<String>,
    pub is_favorite: bool,
    pub display_order: i32,
}

// Individual profile/group export structures (v0.7.0+)
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ProfileExportDetailed {
    #[serde(flatten)]
    profile: Profile,  // Use Profile directly - group_path is already semantic
    password: Option<String>,
    metadata: Option<ProfileMetadata>,
    tags: Vec<Tag>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    central_password_ref: Option<String>,  // v0.9.0+: Name of linked central password (portable reference)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GroupExportDetailed {
    #[serde(flatten)]
    group: GroupPortable,  // Groups still need conversion for parent_id -> parent_path
    // L-5: tags field removed (group_tags feature removed)
    profiles: Vec<ProfileExportDetailed>,
    subgroups: Vec<GroupExportDetailed>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SingleProfileExportData {
    export_format_version: String,
    version: String,
    exported_at: String,
    profile: ProfileExportDetailed,
}

#[derive(Debug, Serialize, Deserialize)]
struct SingleGroupExportData {
    export_format_version: String,
    version: String,
    exported_at: String,
    group: GroupExportDetailed,
}

// Encrypted export structure (Phase 6)
#[derive(Debug, Serialize, Deserialize)]
struct EncryptedExport {
    version: String,          // Export format version (e.g., "2.0")
    encrypted: bool,          // Always true for encrypted exports
    cipher: String,           // "AES-256-GCM"
    kdf: String,              // "PBKDF2-HMAC-SHA256"
    kdf_iterations: u32,      // 600000 (OWASP 2023 recommendation)
    salt: String,             // Base64-encoded 16-byte salt
    iv: String,               // Base64-encoded 12-byte IV (nonce)
    data: String,             // Base64-encoded ciphertext
    hmac: String,             // Base64-encoded HMAC-SHA256
}

// Settings export/import structures
#[derive(Debug, Serialize, Deserialize)]
struct SettingsData {
    theme: String,
    auto_update_check: bool,
    window_width: i32,
    window_height: i32,
    recent_connections_limit: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    filtered_groups: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    collapsed_groups: Option<Vec<String>>,
    #[serde(default = "default_include_passwords")]
    include_passwords_in_exports: bool,
    #[serde(default)]
    require_encryption_for_all_exports: bool,
    #[serde(default)]
    expanded_card_actions_enabled: bool,
}

fn default_include_passwords() -> bool {
    true
}

#[derive(Debug, Serialize, Deserialize)]
struct SettingsOsSpecific {
    terminal_preference: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    use_tabs_in_terminal: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    minimize_on_launch: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SettingsExport {
    version: String,
    os: String,
    exported_at: String,
    settings: SettingsData,
    settings_os_specific: SettingsOsSpecific,
    #[serde(skip_serializing_if = "Option::is_none")]
    profiles: Option<Vec<ProfileExport>>,
}

#[derive(Debug, Deserialize)]
struct SettingsImport {
    #[serde(default)]
    os: Option<String>,
    settings: SettingsData,
    #[serde(default)]
    settings_os_specific: Option<SettingsOsSpecific>,
    #[serde(default)]
    profiles: Option<Vec<ProfileExport>>,
}

#[derive(Debug, Serialize)]
struct SettingsImportResult {
    settings: SettingsData,
    settings_os_specific: Option<SettingsOsSpecific>,
    profiles: Option<Vec<ProfileExport>>,
}

// ============================================================================
// Cryptographic Functions (Phase 6)
// ============================================================================

/// PBKDF2 iteration count (OWASP 2023 recommendation)
const PBKDF2_ITERATIONS: u32 = 600_000;

/// Salt size in bytes (16 bytes = 128 bits)
const SALT_SIZE: usize = 16;

/// IV/Nonce size in bytes for AES-GCM (12 bytes = 96 bits, recommended)
const NONCE_SIZE: usize = 12;

/// Validates encryption password meets minimum requirements
fn validate_encryption_password(password: &str) -> Result<(), String> {
    let char_count = password.chars().count();
    if char_count < 12 {
        return Err("Password too short: Encryption password must be at least 12 characters.".to_string());
    }
    if char_count > 128 {
        return Err("Password too long: Encryption password must not exceed 128 characters.".to_string());
    }
    Ok(())
}

/// Derives a 256-bit encryption key from a password using PBKDF2-HMAC-SHA256
fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    if salt.len() != SALT_SIZE {
        return Err(format!("Invalid salt length: expected {}, got {}", SALT_SIZE, salt.len()));
    }

    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, PBKDF2_ITERATIONS, &mut key);

    Ok(key)
}

/// Generates HMAC-SHA256 over salt + IV + ciphertext for integrity verification
fn generate_hmac(salt: &[u8], iv: &[u8], ciphertext: &[u8], key: &[u8]) -> [u8; 32] {
    type HmacSha256 = Hmac<Sha256>;

    let mut mac = <HmacSha256 as Mac>::new_from_slice(key)
        .expect("HMAC can take key of any size");

    mac.update(salt);
    mac.update(iv);
    mac.update(ciphertext);

    let result = mac.finalize();
    result.into_bytes().into()
}

/// Verifies HMAC-SHA256 using constant-time comparison
fn verify_hmac(expected: &[u8], salt: &[u8], iv: &[u8], ciphertext: &[u8], key: &[u8]) -> bool {
    type HmacSha256 = Hmac<Sha256>;

    let mut mac = <HmacSha256 as Mac>::new_from_slice(key)
        .expect("HMAC can take key of any size");

    mac.update(salt);
    mac.update(iv);
    mac.update(ciphertext);

    // verify() uses constant-time comparison to prevent timing attacks
    mac.verify_slice(expected).is_ok()
}

/// Encrypts plaintext JSON data with AES-256-GCM and returns EncryptedExport
fn encrypt_data(plaintext: &str, password: &str) -> Result<EncryptedExport, String> {
    // Validate password
    validate_encryption_password(password)?;

    // Generate random salt
    let mut salt = [0u8; SALT_SIZE];
    rand::fill(&mut salt);

    // Derive encryption key from password
    let mut key = derive_key(password, &salt)?;

    // Generate random nonce (IV)
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    rand::fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Create cipher
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;

    // Encrypt plaintext
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Generate HMAC for integrity verification
    // M-4: We use the same derived key for both AES-256-GCM encryption and HMAC-SHA256.
    // This is intentional: AES-GCM already provides authenticated encryption with integrity
    // protection. The HMAC serves as a fail-fast integrity check before attempting decryption,
    // allowing us to reject tampered data earlier. While cryptographic best practice suggests
    // separate keys for encryption and authentication, there is no known practical attack
    // against this construction when using AES-GCM (which internally uses independent keys
    // derived from the input key). The HMAC is defense-in-depth, not a security requirement.
    let hmac = generate_hmac(&salt, &nonce_bytes, &ciphertext, &key);

    // Zeroize sensitive data from memory
    key.zeroize();

    // Base64 encode all components
    let salt_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, salt);
    let iv_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, nonce_bytes);
    let data_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &ciphertext);
    let hmac_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, hmac);

    Ok(EncryptedExport {
        version: "2.0".to_string(),
        encrypted: true,
        cipher: "AES-256-GCM".to_string(),
        kdf: "PBKDF2-HMAC-SHA256".to_string(),
        kdf_iterations: PBKDF2_ITERATIONS,
        salt: salt_b64,
        iv: iv_b64,
        data: data_b64,
        hmac: hmac_b64,
    })
}

/// Decrypts EncryptedExport with AES-256-GCM and returns plaintext JSON
fn decrypt_data(encrypted: &EncryptedExport, password: &str) -> Result<String, String> {
    // Verify encryption parameters
    if encrypted.cipher != "AES-256-GCM" {
        return Err(format!("Unsupported cipher: {}", encrypted.cipher));
    }
    if encrypted.kdf != "PBKDF2-HMAC-SHA256" {
        return Err(format!("Unsupported KDF: {}", encrypted.kdf));
    }

    // Base64 decode all components
    let salt = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &encrypted.salt)
        .map_err(|_| "Failed to decode salt: corrupted data".to_string())?;
    let nonce_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &encrypted.iv)
        .map_err(|_| "Failed to decode IV: corrupted data".to_string())?;
    let ciphertext = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &encrypted.data)
        .map_err(|_| "Failed to decode ciphertext: corrupted data".to_string())?;
    let expected_hmac = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &encrypted.hmac)
        .map_err(|_| "Failed to decode HMAC: corrupted data".to_string())?;

    // Validate sizes
    if salt.len() != SALT_SIZE {
        return Err("Invalid salt length: corrupted data".to_string());
    }
    if nonce_bytes.len() != NONCE_SIZE {
        return Err("Invalid IV length: corrupted data".to_string());
    }

    // Derive encryption key from password
    let mut key = derive_key(password, &salt)?;

    // VERIFY HMAC FIRST (fail fast if tampered)
    if !verify_hmac(&expected_hmac, &salt, &nonce_bytes, &ciphertext, &key) {
        key.zeroize();
        return Err("Incorrect password, or the file has been tampered with.".to_string());
    }

    // Create cipher
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| {
            key.zeroize();
            format!("Failed to create cipher: {}", e)
        })?;

    let nonce = Nonce::from_slice(&nonce_bytes);

    // Decrypt ciphertext
    let plaintext_bytes = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| {
            key.zeroize();
            "Incorrect password. Please try again.".to_string()
        })?;

    // Zeroize sensitive data from memory
    key.zeroize();

    // Convert to string
    let plaintext = String::from_utf8(plaintext_bytes)
        .map_err(|_| "Decryption produced invalid UTF-8: corrupted data".to_string())?;

    Ok(plaintext)
}

/// Helper function to check if any profile in a list requires encryption
/// Returns true if ANY profile has password authentication.
/// Note: `central_password` profiles are intentionally excluded — exports only store the
/// central password name as a reference (`central_password_ref`), never the credential value,
/// so there is nothing sensitive to encrypt for those profiles.
fn export_requires_encryption(profiles: &[Profile]) -> bool {
    profiles.iter().any(|p| p.auth_method == "password")
}

/// Phase 6C: Detect whether a JSON string is an encrypted export
fn detect_encrypted_export(json: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(json)
        .ok()
        .and_then(|v| v.get("encrypted").and_then(|e| e.as_bool()))
        .unwrap_or(false)
}

/// Phase 6C: Decrypt import data if encrypted, pass through unchanged if plain.
/// Returns an error if encrypted but no password provided.
fn decrypt_import_if_encrypted(data: &str, encryption_password: &Option<String>) -> Result<String, String> {
    if !detect_encrypted_export(data) {
        return Ok(data.to_string());
    }

    // Encrypted export detected - password is required
    let password = encryption_password.as_deref()
        .ok_or_else(|| "This import is encrypted. Please provide the decryption password.".to_string())?;

    // Parse as EncryptedExport and decrypt
    let encrypted: EncryptedExport = serde_json::from_str(data)
        .map_err(|_| "Import file is corrupted or invalid. Cannot import.".to_string())?;

    decrypt_data(&encrypted, password)
}

/// Helper function to recursively collect all profiles from a group export
fn collect_profiles_from_group_export(group_export: &GroupExportDetailed) -> Vec<Profile> {
    let mut all_profiles = Vec::new();

    // Collect profiles from this group
    for profile_export in &group_export.profiles {
        all_profiles.push(profile_export.profile.clone());
    }

    // Recursively collect profiles from sub-groups
    for subgroup in &group_export.subgroups {
        all_profiles.extend(collect_profiles_from_group_export(subgroup));
    }

    all_profiles
}

// Tauri commands
#[tauri::command]
fn get_profiles(db: State<Database>) -> Result<Vec<ProfileWithMetadata>, String> {
    db.get_all_profiles_with_metadata()
        .map_err(|e| format!("Failed to get profiles: {}", e))
}

#[derive(Deserialize)]
struct CreateProfileInput {
    name: String,
    description: Option<String>,
    host: String,
    port: Option<i64>,
    username: String,
    auth_method: String,
    key_path: Option<String>,
    password: Option<String>,
    group_path: Option<String>, // v0.7.0+: Semantic path to group
    #[serde(default)]
    display_order: Option<i32>,
    #[serde(default)]
    central_password_id: Option<String>, // v0.9.0+: ID of linked CentralPassword
}

// SECURITY: Custom Debug implementation to redact password field
impl std::fmt::Debug for CreateProfileInput {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CreateProfileInput")
            .field("name", &self.name)
            .field("description", &self.description)
            .field("host", &self.host)
            .field("port", &self.port)
            .field("username", &self.username)
            .field("auth_method", &self.auth_method)
            .field("key_path", &self.key_path)
            .field("password", &"[REDACTED]")
            .field("group_path", &self.group_path)
            .field("display_order", &self.display_order)
            .field("central_password_id", &self.central_password_id)
            .finish()
    }
}

#[tauri::command]
fn create_profile(db: State<Database>, profile: CreateProfileInput) -> Result<String, String> {
    // Validate all inputs
    validate_profile_name(&profile.name)?;
    validate_host_or_ip(&profile.host)?;
    validate_username(&profile.username)?;

    // Validate description if provided
    if let Some(ref desc) = profile.description {
        validate_description(desc)?;
    }

    // Validate group_path if provided
    if let Some(ref group_path) = profile.group_path {
        validate_group(group_path)?;
    }

    let port = validate_port(profile.port.unwrap_or(22))? as i32;

    // Validate key path if using key authentication
    if profile.auth_method == "key" {
        if let Some(ref key_path) = profile.key_path {
            if !key_path.is_empty() {
                validate_key_path(key_path)?;
            }
        }
    }

    let id = Uuid::new_v4().to_string();

    // Resolve central_password_id: only relevant for "central_password" auth method
    let central_password_id = if profile.auth_method == "central_password" {
        let cp_id = profile.central_password_id
            .filter(|s| !s.is_empty())
            .ok_or_else(|| "A central password must be selected".to_string())?;
        // Verify the central password exists
        db.get_central_password_by_id(&cp_id)
            .map_err(|e| format!("Failed to verify central password: {}", e))?
            .ok_or_else(|| "Selected central password not found".to_string())?;
        Some(cp_id)
    } else {
        None
    };

    let new_profile = Profile {
        id: id.clone(),
        name: profile.name,
        description: profile.description,
        host: profile.host,
        port,
        username: profile.username,
        auth_method: profile.auth_method.clone(),
        key_path: profile.key_path,
        group_path: profile.group_path,
        central_password_id,
    };

    db.create_profile(&new_profile)
        .map_err(|e| format!("Failed to create profile: {}", e))?;

    // Create default metadata for new profile
    // Default: icon='server', is_favorite=false, display_order=0
    db.upsert_profile_metadata_db(&id, Some("server".to_string()), false)
        .map_err(|e| format!("Failed to create profile metadata: {}", e))?;

    // Set display_order if provided (used when drag reorder is enabled)
    if let Some(order) = profile.display_order {
        let conn = db.conn.lock().expect("Database lock poisoned");
        conn.execute(
            "UPDATE profile_metadata SET display_order = ?1 WHERE profile_id = ?2",
            (order, &id),
        ).map_err(|e| format!("Failed to set display_order: {}", e))?;
    }

    // Store individual password in keychain if provided (not used for central_password auth)
    if profile.auth_method == "password" {
        if let Some(password) = profile.password {
            if !password.is_empty() {
                store_password(&id, &password)
                    .map_err(|e| format!("Failed to store password: {}", e))?;
            }
        }
    }

    Ok(id)
}

#[derive(Deserialize)]
struct UpdateProfileInput {
    id: String,
    name: String,
    description: Option<String>,
    host: String,
    port: Option<i64>,
    username: String,
    auth_method: String,
    key_path: Option<String>,
    password: Option<String>,
    group_path: Option<String>, // v0.7.0+: Semantic path to group
    #[serde(default)]
    central_password_id: Option<String>, // v0.9.0+: ID of linked CentralPassword
}

// SECURITY: Custom Debug implementation to redact password field
impl std::fmt::Debug for UpdateProfileInput {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("UpdateProfileInput")
            .field("id", &self.id)
            .field("name", &self.name)
            .field("description", &self.description)
            .field("host", &self.host)
            .field("port", &self.port)
            .field("username", &self.username)
            .field("auth_method", &self.auth_method)
            .field("key_path", &self.key_path)
            .field("password", &"[REDACTED]")
            .field("group_path", &self.group_path)
            .field("central_password_id", &self.central_password_id)
            .finish()
    }
}

#[tauri::command]
fn update_profile(db: State<Database>, profile: UpdateProfileInput) -> Result<(), String> {
    // Validate all inputs
    validate_profile_name(&profile.name)?;
    validate_host_or_ip(&profile.host)?;
    validate_username(&profile.username)?;

    // Validate description if provided
    if let Some(ref desc) = profile.description {
        validate_description(desc)?;
    }

    // Validate group_path if provided
    if let Some(ref group_path) = profile.group_path {
        validate_group(group_path)?;
    }

    let port = validate_port(profile.port.unwrap_or(22))? as i32;

    // Validate key path if using key authentication
    if profile.auth_method == "key" {
        if let Some(ref key_path) = profile.key_path {
            if !key_path.is_empty() {
                validate_key_path(key_path)?;
            }
        }
    }

    // Resolve central_password_id: only relevant for "central_password" auth method
    let central_password_id = if profile.auth_method == "central_password" {
        let cp_id = profile.central_password_id
            .filter(|s| !s.is_empty())
            .ok_or_else(|| "A central password must be selected".to_string())?;
        // Verify the central password exists
        db.get_central_password_by_id(&cp_id)
            .map_err(|e| format!("Failed to verify central password: {}", e))?
            .ok_or_else(|| "Selected central password not found".to_string())?;
        Some(cp_id)
    } else {
        None
    };

    let updated_profile = Profile {
        id: profile.id.clone(),
        name: profile.name,
        description: profile.description,
        host: profile.host,
        port,
        username: profile.username,
        auth_method: profile.auth_method.clone(),
        key_path: profile.key_path,
        group_path: profile.group_path,
        central_password_id,
    };

    db.update_profile(&updated_profile)
        .map_err(|e| format!("Failed to update profile: {}", e))?;

    // Manage individual keychain entry based on auth method
    if profile.auth_method == "password" {
        // Update individual password in keychain if a new one was provided
        if let Some(password) = profile.password {
            if !password.is_empty() {
                store_password(&profile.id, &password)?;
            }
        }
    } else {
        // Auth method changed away from individual password — remove keychain entry
        // (ignore errors if no password exists; central_password auth uses a different key)
        let _ = delete_password(&profile.id);
    }

    Ok(())
}

#[tauri::command]
fn delete_profile(db: State<Database>, id: String) -> Result<(), String> {
    db.delete_profile(&id)
        .map_err(|e| format!("Failed to delete profile: {}", e))?;

    // Also delete password from keychain if exists
    let _ = delete_password(&id);

    Ok(())
}

// Group management commands
#[tauri::command]
fn get_groups(db: State<Database>) -> Result<Vec<Group>, String> {
    db.get_all_groups()
        .map_err(|e| format!("Failed to get groups: {}", e))
}

#[derive(Deserialize)]
struct CreateGroupInput {
    name: String,
    parent_id: Option<String>,
    icon: Option<String>,
    #[serde(default)]
    display_order: Option<i32>,
}

#[tauri::command]
fn create_group(db: State<Database>, input: CreateGroupInput) -> Result<String, String> {
    // Validate group name
    validate_group(&input.name)?;

    // Calculate path based on parent
    let path = if let Some(ref parent_id) = input.parent_id {
        // Get parent group to construct path
        let parent = db.get_group_by_id(parent_id)
            .map_err(|e| format!("Failed to get parent group: {}", e))?
            .ok_or_else(|| "Parent group not found".to_string())?;

        // Calculate depth to enforce 3-level limit
        let parent_depth = parent.path.matches('/').count();
        if parent_depth >= 2 {
            return Err("Maximum group depth (3 levels) reached".to_string());
        }

        format!("{}/{}", parent.path, input.name)
    } else {
        input.name.clone()
    };

    let now = chrono::Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();

    let group = Group {
        id: id.clone(),
        name: input.name,
        parent_id: input.parent_id,
        path,
        icon: input.icon,
        is_favorite: false,
        display_order: input.display_order.unwrap_or(0),
        created_at: now.clone(),
        updated_at: now,
    };

    db.create_group(&group)
        .map_err(|e| format!("Failed to create group: {}", e))?;

    Ok(id)
}

#[derive(Deserialize)]
struct UpdateGroupInput {
    id: String,
    name: String,
    icon: Option<String>,
    parent_id: Option<String>, // C-2 FIX: Allow updating parent to move groups
}

#[tauri::command]
fn update_group(db: State<Database>, input: UpdateGroupInput) -> Result<(), String> {
    // Validate group name
    validate_group(&input.name)?;

    // Get existing group
    let mut group = db.get_group_by_id(&input.id)
        .map_err(|e| format!("Failed to get group: {}", e))?
        .ok_or_else(|| "Group not found".to_string())?;

    // C-2 FIX: Check if name OR parent has changed (either requires path recalculation)
    let name_changed = group.name != input.name;
    let parent_changed = group.parent_id != input.parent_id;

    if name_changed || parent_changed {
        let old_path = group.path.clone();

        // Update parent_id if changed
        if parent_changed {
            group.parent_id = input.parent_id.clone();
        }

        // Calculate new path based on (possibly new) parent and name
        group.path = if let Some(ref parent_id) = group.parent_id {
            let parent = db.get_group_by_id(parent_id)
                .map_err(|e| format!("Failed to get parent group: {}", e))?
                .ok_or_else(|| "Parent group not found".to_string())?;
            format!("{}/{}", parent.path, input.name)
        } else {
            input.name.clone()
        };

        // Update name and icon
        group.name = input.name;
        group.icon = input.icon;
        group.updated_at = chrono::Utc::now().to_rfc3339();

        // Update this group
        db.update_group(&group)
            .map_err(|e| format!("Failed to update group: {}", e))?;

        // CASCADE UPDATE: Update all descendant group paths and profile group_paths.
        // Use SQL SUBSTR instead of Rust String::replace() to avoid corrupting paths with
        // overlapping prefixes (e.g., renaming "Dev" with a "Dev/DevOps" child — replace()
        // would incorrectly change "Dev/DevOps" to "Development/DevelopmentOps").
        let conn = db.conn.lock().expect("Database lock poisoned");
        let now = chrono::Utc::now().to_rfc3339();
        let escaped_path = old_path.replace('%', "\\%").replace('_', "\\_");
        let like_pattern = format!("{}/%", escaped_path);

        // Update descendant group paths
        conn.execute(
            "UPDATE groups
             SET path = ?2 || SUBSTR(path, LENGTH(?1) + 1),
                 updated_at = ?3
             WHERE path LIKE ?4 ESCAPE '\\'",
            (&old_path, &group.path, &now, &like_pattern),
        ).map_err(|e| format!("Failed to update descendant group paths: {}", e))?;

        // Update profile group_paths (direct members and profiles in sub-groups)
        conn.execute(
            "UPDATE profiles
             SET group_path = ?2 || SUBSTR(group_path, LENGTH(?1) + 1)
             WHERE group_path = ?1 OR group_path LIKE ?3 ESCAPE '\\'",
            (&old_path, &group.path, &like_pattern),
        ).map_err(|e| format!("Failed to cascade update profile paths: {}", e))?;
    } else {
        // Just update icon (name and parent unchanged)
        group.icon = input.icon;
        group.updated_at = chrono::Utc::now().to_rfc3339();
        db.update_group(&group)
            .map_err(|e| format!("Failed to update group: {}", e))?;
    }

    Ok(())
}

#[derive(Deserialize)]
struct DeleteGroupInput {
    id: String,
    delete_profiles: bool,
}

#[tauri::command]
fn delete_group(db: State<Database>, input: DeleteGroupInput) -> Result<(), String> {
    // Get the group to be deleted
    let group = db.get_group_by_id(&input.id)
        .map_err(|e| format!("Failed to get group: {}", e))?
        .ok_or_else(|| "Group not found".to_string())?;

    if input.delete_profiles {
        // Cascade delete: Delete profiles first, then group (CASCADE will handle sub-groups via FK)

        // C-1 FIX: Get descendant paths BEFORE acquiring lock to avoid deadlock
        let descendant_paths = db.get_descendant_paths(&group.path)
            .map_err(|e| format!("Failed to get descendant paths: {}", e))?;

        let conn = db.conn.lock().expect("Database lock poisoned");

        // Delete all profiles in these groups
        for group_path in descendant_paths {
            conn.execute(
                "DELETE FROM profiles WHERE group_path = ?1",
                [&group_path],
            ).map_err(|e| format!("Failed to delete profiles: {}", e))?;
        }

        drop(conn);

        // Now delete the group (CASCADE will handle sub-groups)
        db.delete_group(&input.id)
            .map_err(|e| format!("Failed to delete group: {}", e))?;
    } else {
        // Move profiles to parent: Get all profiles in this group and descendants

        // C-1 FIX: Get descendant paths and calculate target path BEFORE acquiring lock to avoid deadlock
        let descendant_paths = db.get_descendant_paths(&group.path)
            .map_err(|e| format!("Failed to get descendant paths: {}", e))?;

        // Calculate target group path (parent path or "Ungrouped" if top-level)
        // C-1 FIX: Get parent group BEFORE acquiring lock
        let target_group_path = if let Some(parent_id) = &group.parent_id {
            // Get parent group's path
            let parent = db.get_group_by_id(parent_id)
                .map_err(|e| format!("Failed to get parent group: {}", e))?
                .ok_or_else(|| "Parent group not found".to_string())?;
            parent.path
        } else {
            "Ungrouped".to_string()
        };

        // Now acquire lock for database operations
        let conn = db.conn.lock().expect("Database lock poisoned");

        // Ensure "Ungrouped" group exists if we're moving to top level
        if target_group_path == "Ungrouped" {
            let ungrouped = conn.query_row(
                "SELECT id FROM groups WHERE name = 'Ungrouped' AND parent_id IS NULL",
                [],
                |row| row.get::<_, String>(0)
            );

            if ungrouped.is_err() {
                // Create Ungrouped group
                let now = chrono::Utc::now().to_rfc3339();
                let id = Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO groups (id, name, parent_id, path, icon, is_favorite, display_order, created_at, updated_at)
                     VALUES (?1, 'Ungrouped', NULL, 'Ungrouped', NULL, 0, 0, ?2, ?3)",
                    (&id, &now, &now),
                ).map_err(|e| format!("Failed to create Ungrouped group: {}", e))?;
            }
        }

        // Update all profiles in descendant groups to move to target group path
        for group_path in descendant_paths {
            conn.execute(
                "UPDATE profiles SET group_path = ?1 WHERE group_path = ?2",
                (&target_group_path, &group_path),
            ).map_err(|e| format!("Failed to move profiles: {}", e))?;
        }

        drop(conn);

        // Now delete the group (CASCADE will handle sub-groups)
        db.delete_group(&input.id)
            .map_err(|e| format!("Failed to delete group: {}", e))?;
    }

    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MoveGroupInput {
    id: String,
    new_parent_id: Option<String>,
}

#[tauri::command]
fn move_group(db: State<Database>, input: MoveGroupInput) -> Result<(), String> {
    // Get the group to be moved
    let mut group = db.get_group_by_id(&input.id)
        .map_err(|e| format!("Failed to get group: {}", e))?
        .ok_or_else(|| "Group not found".to_string())?;

    // Prevent moving a group into itself
    if Some(&input.id) == input.new_parent_id.as_ref() {
        return Err("Cannot move a group into itself".to_string());
    }

    // If moving to a parent, validate:
    // 1. Parent exists
    // 2. Not moving into own descendant (circular reference)
    // 3. Depth limit not exceeded
    if let Some(ref new_parent_id) = input.new_parent_id {
        // Get new parent
        let new_parent = db.get_group_by_id(new_parent_id)
            .map_err(|e| format!("Failed to get parent group: {}", e))?
            .ok_or_else(|| "Parent group not found".to_string())?;

        // Check if new parent is a descendant of this group (circular reference)
        if new_parent.path.starts_with(&format!("{}/", group.path)) || new_parent.path == group.path {
            return Err("Cannot move a group into its own descendant".to_string());
        }

        // Calculate new depth
        let new_parent_depth = new_parent.path.matches('/').count();
        let group_depth = group.path.matches('/').count();
        let group_subtree_depth = {
            // Get all descendants to find max depth
            let all_groups = db.get_all_groups()
                .map_err(|e| format!("Failed to get groups: {}", e))?;
            let mut max_relative_depth = 0;
            for g in all_groups {
                if g.path.starts_with(&format!("{}/", group.path)) {
                    let relative_depth = g.path.matches('/').count() - group_depth;
                    if relative_depth > max_relative_depth {
                        max_relative_depth = relative_depth;
                    }
                }
            }
            max_relative_depth
        };

        // New depth would be: new_parent_depth + 1 (for this group) + group_subtree_depth
        if new_parent_depth + 1 + group_subtree_depth > 2 {
            return Err("Move would exceed maximum group depth (3 levels)".to_string());
        }
    }

    let old_path = group.path.clone();

    // Calculate new path
    let new_path = if let Some(ref new_parent_id) = input.new_parent_id {
        let new_parent = db.get_group_by_id(new_parent_id)
            .map_err(|e| format!("Failed to get parent group: {}", e))?
            .ok_or_else(|| "Parent group not found".to_string())?;
        format!("{}/{}", new_parent.path, group.name)
    } else {
        // Moving to top level
        group.name.clone()
    };

    // Update group
    group.parent_id = input.new_parent_id;
    group.path = new_path.clone();
    group.updated_at = chrono::Utc::now().to_rfc3339();

    db.update_group(&group)
        .map_err(|e| format!("Failed to update group: {}", e))?;

    // CASCADE UPDATE: Update all descendant group paths and profile group_paths.
    // Use SQL SUBSTR instead of Rust String::replace() to avoid corrupting paths with
    // overlapping prefixes (e.g., moving "Dev" with a "Dev/DevOps" child — replace()
    // would incorrectly change "Dev/DevOps" to "NewParent/Dev/NewParent/DevOps").
    let conn = db.conn.lock().expect("Database lock poisoned");
    let now = chrono::Utc::now().to_rfc3339();
    let escaped_path = old_path.replace('%', "\\%").replace('_', "\\_");
    let like_pattern = format!("{}/%", escaped_path);

    // Update descendant group paths
    conn.execute(
        "UPDATE groups
         SET path = ?2 || SUBSTR(path, LENGTH(?1) + 1),
             updated_at = ?3
         WHERE path LIKE ?4 ESCAPE '\\'",
        (&old_path, &new_path, &now, &like_pattern),
    ).map_err(|e| format!("Failed to update descendant group paths: {}", e))?;

    // Update profile group_paths (direct members and profiles in sub-groups)
    conn.execute(
        "UPDATE profiles
         SET group_path = ?2 || SUBSTR(group_path, LENGTH(?1) + 1)
         WHERE group_path = ?1 OR group_path LIKE ?3 ESCAPE '\\'",
        (&old_path, &new_path, &like_pattern),
    ).map_err(|e| format!("Failed to cascade update profile paths: {}", e))?;

    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MoveProfileInput {
    profile_id: String,
    new_group_path: Option<String>,
}

#[tauri::command]
fn move_profile(db: State<Database>, input: MoveProfileInput) -> Result<(), String> {
    // Validate profile exists
    db.get_profile_by_id(&input.profile_id)
        .map_err(|e| format!("Failed to get profile: {}", e))?
        .ok_or_else(|| "Profile not found".to_string())?;

    // If moving to a group, validate the path format and that the group exists
    if let Some(ref path) = input.new_group_path {
        validate_group(path)?;
        db.get_group_by_path(path)
            .map_err(|e| format!("Failed to get group: {}", e))?
            .ok_or_else(|| "Group not found".to_string())?;
    }

    db.move_profile_to_group(&input.profile_id, input.new_group_path.as_deref())
        .map_err(|e| format!("Failed to move profile: {}", e))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfileOrder {
    profile_id: String,
    display_order: i32,
}

#[tauri::command]
fn reorder_profiles(db: State<Database>, orders: Vec<ProfileOrder>) -> Result<(), String> {
    if orders.len() > 500 {
        return Err("Too many items to reorder at once (max 500)".to_string());
    }
    for order in &orders {
        if order.display_order < 0 {
            return Err(format!("display_order must be non-negative, got {}", order.display_order));
        }
    }
    db.reorder_profiles_db(&orders).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GroupOrder {
    group_id: String,
    display_order: i32,
}

#[tauri::command]
fn reorder_groups(db: State<Database>, orders: Vec<GroupOrder>) -> Result<(), String> {
    if orders.len() > 500 {
        return Err("Too many items to reorder at once (max 500)".to_string());
    }
    for order in &orders {
        if order.display_order < 0 {
            return Err(format!("display_order must be non-negative, got {}", order.display_order));
        }
    }
    db.reorder_groups_db(&orders).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_group_tree(db: State<Database>) -> Result<Vec<GroupTreeNode>, String> {
    // Get all groups
    let all_groups = db.get_all_groups()
        .map_err(|e| format!("Failed to get groups: {}", e))?;

    // L-1: Build parent index for O(1) child lookup (was O(n) per parent, now O(1))
    // This changes tree building from O(n²) to O(n)
    let mut parent_index: HashMap<Option<String>, Vec<Group>> = HashMap::new();
    for group in all_groups {
        parent_index.entry(group.parent_id.clone()).or_insert_with(Vec::new).push(group);
    }

    // Build tree structure using parent index
    fn build_tree_recursive(
        parent_id: Option<String>,
        parent_index: &HashMap<Option<String>, Vec<Group>>,
    ) -> Vec<GroupTreeNode> {
        // Look up children directly from index (O(1) instead of O(n))
        let children_groups = match parent_index.get(&parent_id) {
            Some(groups) => groups,
            None => return Vec::new(),
        };

        let mut children: Vec<GroupTreeNode> = children_groups
            .iter()
            .map(|group| {
                let node_children = build_tree_recursive(Some(group.id.clone()), parent_index);
                GroupTreeNode {
                    group: group.clone(),
                    children: node_children,
                }
            })
            .collect();

        // Sort by display_order, then by name
        children.sort_by(|a, b| {
            a.group.display_order
                .cmp(&b.group.display_order)
                .then_with(|| a.group.name.cmp(&b.group.name))
        });

        children
    }

    let tree = build_tree_recursive(None, &parent_index);

    Ok(tree)
}

#[tauri::command]
fn export_profiles(db: State<Database>, include_passwords: bool, encryption_password: Option<String>) -> Result<String, String> {
    let profiles = db.get_all_profiles()
        .map_err(|e| format!("Failed to get profiles: {}", e))?;

    let mut export_profiles = Vec::new();

    for profile in &profiles {
        let password = if include_passwords && profile.auth_method == "password" {
            get_password(&profile.id).ok()
        } else {
            None
        };

        // Fetch metadata for the profile
        let metadata = db.get_profile_metadata(&profile.id).ok().flatten();

        // Fetch tags for the profile
        let tags = db.get_profile_tags(&profile.id).unwrap_or_default();

        // Resolve central password name for portable reference (v0.9.0+)
        let central_password_ref = if profile.auth_method == "central_password" {
            profile.central_password_id.as_deref()
                .and_then(|cp_id| db.get_central_password_by_id(cp_id).ok().flatten())
                .map(|cp| cp.name)
        } else {
            None
        };

        export_profiles.push(ProfileExport {
            profile: profile.clone(),  // Use profile directly - group_path is already semantic
            password,
            metadata,
            tags,
            central_password_ref,
        });
    }

    let export_data = ExportData {
        export_format_version: "2.0".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        profiles: export_profiles,
    };

    // Serialize to JSON
    let mut json_data = serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize profiles: {}", e))?;

    // Check if encryption is required (any password-auth profile with include_passwords=true)
    let requires_encryption = include_passwords && export_requires_encryption(&profiles);

    // Handle encryption
    match encryption_password {
        Some(password) => {
            // User provided encryption password - encrypt the export
            let encrypted = encrypt_data(&json_data, &password)?;
            // M-10: Zeroize plaintext JSON after encryption (defense-in-depth)
            json_data.zeroize();
            serde_json::to_string_pretty(&encrypted)
                .map_err(|e| format!("Failed to serialize encrypted export: {}", e))
        },
        None => {
            // No encryption password provided
            if requires_encryption {
                Err("Encryption required: This export contains password-authenticated profiles. Please provide an encryption password.".to_string())
            } else {
                // Encryption not required - return plain JSON
                Ok(json_data)
            }
        }
    }
}

#[tauri::command]
fn import_profiles(db: State<Database>, data: String, encryption_password: Option<String>) -> Result<(), String> {
    // M-2: Validate import size to prevent OOM attacks
    if data.len() > MAX_IMPORT_JSON_SIZE {
        return Err(format!(
            "Import data exceeds maximum allowed size ({} MB)",
            MAX_IMPORT_JSON_SIZE / 1024 / 1024
        ));
    }

    // Phase 6C: Decrypt if encrypted
    let data = decrypt_import_if_encrypted(&data, &encryption_password)?;

    let import_data: ImportData = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse import data: {}", e))?;

    // SECURITY: Validate profile count to prevent resource exhaustion
    const MAX_IMPORT_PROFILES: usize = 999;
    if import_data.profiles.len() > MAX_IMPORT_PROFILES {
        return Err(format!(
            "Import exceeds maximum of {} profiles (received {})",
            MAX_IMPORT_PROFILES,
            import_data.profiles.len()
        ));
    }

    // Delete all existing profiles first
    let existing_profiles = db.get_all_profiles()
        .map_err(|e| format!("Failed to get existing profiles: {}", e))?;

    for profile in existing_profiles {
        // Delete the profile from database
        db.delete_profile(&profile.id)
            .map_err(|e| format!("Failed to delete existing profile: {}", e))?;

        // Delete password from keychain if it exists
        let _ = delete_password(&profile.id);
    }

    // Extract unique group paths from profiles and create groups
    // This is needed for v1.0 imports where groups are inferred from profile group_path
    let mut unique_group_paths: std::collections::HashSet<String> = std::collections::HashSet::new();
    for profile_export in &import_data.profiles {
        if let Some(ref group_path) = profile_export.profile.group_path {
            #[cfg(debug_assertions)]
            println!("Found profile with group_path: {}", group_path);
            unique_group_paths.insert(group_path.clone());
        }
    }

    // Create groups in sorted order (parent before child)
    let mut sorted_paths: Vec<String> = unique_group_paths.into_iter().collect();
    sorted_paths.sort();
    #[cfg(debug_assertions)]
    println!("Creating {} groups from import", sorted_paths.len());

    // PERFORMANCE: Load existing groups once to avoid N+1 query pattern
    let mut existing_groups = db.get_all_groups()
        .map_err(|e| format!("Failed to get groups: {}", e))?;

    for group_path in sorted_paths {
        // Check if group already exists
        if !existing_groups.iter().any(|g| g.path == group_path) {
            // Extract name from path (last component)
            let name = group_path.split('/').last().unwrap_or(&group_path).to_string();

            // Determine parent_id by finding parent path
            let parent_id = if group_path.contains('/') {
                let parent_path = group_path.rsplitn(2, '/').nth(1).unwrap();
                existing_groups.iter().find(|g| g.path == parent_path).map(|g| g.id.clone())
            } else {
                None
            };

            // Create the group
            let group = Group {
                id: Uuid::new_v4().to_string(),
                name,
                parent_id,
                path: group_path,
                icon: None,
                is_favorite: false,
                display_order: 0,
                created_at: chrono::Utc::now().to_rfc3339(),
                updated_at: chrono::Utc::now().to_rfc3339(),
            };

            db.create_group(&group)
                .map_err(|e| format!("Failed to create group '{}': {}", group.path, e))?;

            // Update local collection after insert
            existing_groups.push(group.clone());

            #[cfg(debug_assertions)]
            println!("Created group: {} (id: {})", group.path, group.id);
        } else {
            #[cfg(debug_assertions)]
            println!("Group already exists: {}", group_path);
        }
    }

    // PERFORMANCE: Load existing tags once before loop to avoid N+1 query pattern
    let mut existing_tags = db.get_all_tags()
        .map_err(|e| format!("Failed to get tags: {}", e))?;

    // Now import the new profiles
    for profile_export in import_data.profiles {
        let mut profile = profile_export.profile;

        // Handle central_password_ref: resolve to local ID, or create empty shell (v0.9.0+)
        if let Some(ref cp_name) = profile_export.central_password_ref {
            let cp_id = resolve_or_create_central_password_for_import(&db, cp_name)?;
            profile.central_password_id = Some(cp_id);
            profile.auth_method = "central_password".to_string();
        } else {
            // Clear any exported central_password_id — UUIDs are machine-specific
            profile.central_password_id = None;
        }

        // SECURITY: Validate all profile fields to prevent injection attacks
        validate_profile_fields(&profile)
            .map_err(|e| format!("Invalid profile '{}': {}", profile.name, e))?;

        // Generate new ID for imported profile to avoid conflicts
        profile.id = Uuid::new_v4().to_string();

        // Create the profile (group_path is already set correctly)
        db.create_profile(&profile)
            .map_err(|e| format!("Failed to import profile '{}': {}", profile.name, e))?;

        // Store password if it exists (individual password auth only — central passwords have no per-profile value)
        if let Some(password) = profile_export.password {
            if !password.is_empty() {
                store_password(&profile.id, &password)?;
            }
        }

        // Import metadata if provided, otherwise use defaults
        if let Some(metadata) = profile_export.metadata {
            db.upsert_profile_metadata_db(&profile.id, metadata.icon, metadata.is_favorite)
                .map_err(|e| format!("Failed to import metadata for profile '{}': {}", profile.name, e))?;
        } else {
            // No metadata provided - use defaults (icon='server', is_favorite=false)
            db.upsert_profile_metadata_db(&profile.id, Some("server".to_string()), false)
                .map_err(|e| format!("Failed to create default metadata for profile '{}': {}", profile.name, e))?;
        }

        // Import tags - match by name, create if missing, then assign
        if !profile_export.tags.is_empty() {
            let mut tag_ids = Vec::new();

            for import_tag in profile_export.tags {
                // Try to find existing tag by name using pre-loaded tags
                let tag_id = if let Some(existing) = existing_tags.iter().find(|t| t.name == import_tag.name) {
                    // Tag exists - use existing tag (preserve color)
                    existing.id.clone()
                } else {
                    // Tag doesn't exist - create new tag with imported color
                    db.create_tag_db(&import_tag)
                        .map_err(|e| format!("Failed to create tag '{}': {}", import_tag.name, e))?;

                    // Update local collection after insert
                    existing_tags.push(import_tag.clone());

                    import_tag.id.clone()
                };

                tag_ids.push(tag_id);
            }

            // Assign all tags to the profile
            db.set_profile_tags_db(&profile.id, &tag_ids)
                .map_err(|e| format!("Failed to assign tags to profile '{}': {}", profile.name, e))?;
        }
    }

    Ok(())
}

// Helper function: Get semantic group path from group_id (used for group export)
fn get_group_path_by_id(db: &Database, group_id: &Option<String>) -> Result<Option<String>, String> {
    match group_id {
        None => Ok(None),
        Some(id) => {
            let group = db.get_group_by_id(id)
                .map_err(|e| format!("Failed to get group: {}", e))?
                .ok_or_else(|| format!("Group not found: {}", id))?;
            Ok(Some(group.path))
        }
    }
}

// Helper function: Resolve semantic group path to group_id (used for group import)
fn resolve_group_path_to_id(db: &Database, path: &Option<String>) -> Result<Option<String>, String> {
    match path {
        None => Ok(None),
        Some(p) => {
            let groups = db.get_all_groups()
                .map_err(|e| format!("Failed to get groups: {}", e))?;

            // Find group by exact path match
            let group = groups.iter().find(|g| &g.path == p);

            Ok(group.map(|g| g.id.clone()))
        }
    }
}

// Helper function: Convert Group to GroupPortable for export
fn group_to_portable(db: &Database, group: &Group) -> Result<GroupPortable, String> {
    let parent_path = get_group_path_by_id(db, &group.parent_id)?;

    Ok(GroupPortable {
        id: group.id.clone(),
        name: group.name.clone(),
        parent_path,
        path: group.path.clone(),
        icon: group.icon.clone(),
        is_favorite: group.is_favorite,
        display_order: group.display_order,
    })
}

// Individual profile export (v0.7.0+)
#[tauri::command]
fn export_profile(db: State<Database>, profile_id: String, include_password: bool, encryption_password: Option<String>) -> Result<String, String> {
    // Get the profile
    let profile = db.get_profile_by_id(&profile_id)
        .map_err(|e| format!("Failed to get profile: {}", e))?
        .ok_or_else(|| format!("Profile not found: {}", profile_id))?;

    // Get password if needed
    let password = if include_password && profile.auth_method == "password" {
        get_password(&profile_id).ok()
    } else {
        None
    };

    // Get metadata (optional)
    let metadata = db.get_profile_metadata(&profile_id)
        .map_err(|e| format!("Failed to get profile metadata: {}", e))?;

    // Get tags
    let tags = db.get_profile_tags(&profile_id)
        .map_err(|e| format!("Failed to get profile tags: {}", e))?;

    // Resolve central password name for portable reference (v0.9.0+)
    let central_password_ref = if profile.auth_method == "central_password" {
        profile.central_password_id.as_deref()
            .and_then(|cp_id| db.get_central_password_by_id(cp_id).ok().flatten())
            .map(|cp| cp.name)
    } else {
        None
    };

    let profile_export = ProfileExportDetailed {
        profile: profile.clone(),  // Use profile directly - group_path is already semantic
        password,
        metadata,
        tags,
        central_password_ref,
    };

    let export_data = SingleProfileExportData {
        export_format_version: "2.0".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        profile: profile_export,
    };

    // Serialize to JSON
    let mut json_data = serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize profile: {}", e))?;

    // Check if encryption is required (password-auth profile with include_password=true)
    let requires_encryption = include_password && profile.auth_method == "password";

    // Handle encryption
    match encryption_password {
        Some(password) => {
            // User provided encryption password - encrypt the export
            let encrypted = encrypt_data(&json_data, &password)?;
            // M-10: Zeroize plaintext JSON after encryption (defense-in-depth)
            json_data.zeroize();
            serde_json::to_string_pretty(&encrypted)
                .map_err(|e| format!("Failed to serialize encrypted export: {}", e))
        },
        None => {
            // No encryption password provided
            if requires_encryption {
                Err("Encryption required: This export contains a password-authenticated profile. Please provide an encryption password.".to_string())
            } else {
                // Encryption not required - return plain JSON
                Ok(json_data)
            }
        }
    }
}

// Individual group export (v0.7.0+) - recursive
#[tauri::command]
fn export_group(db: State<Database>, group_id: String, include_passwords: bool, encryption_password: Option<String>) -> Result<String, String> {
    fn export_group_recursive(
        db: &Database,
        group_id: &str,
        include_passwords: bool,
    ) -> Result<GroupExportDetailed, String> {
        // Get the group
        let group = db.get_group_by_id(group_id)
            .map_err(|e| format!("Failed to get group: {}", e))?
            .ok_or_else(|| format!("Group not found: {}", group_id))?;

        // Convert to portable format (with semantic parent path)
        let group_portable = group_to_portable(db, &group)?;

        // L-5: Group tags removed (no UI, no commands for group tags)

        // Get all profiles in this group
        let profiles = db.get_profiles_by_group_path(&group.path)
            .map_err(|e| format!("Failed to get profiles for group: {}", e))?;

        let mut profile_exports = Vec::new();
        for profile in profiles {
            let password = if include_passwords && profile.auth_method == "password" {
                get_password(&profile.id).ok()
            } else {
                None
            };

            let metadata = db.get_profile_metadata(&profile.id)
                .map_err(|e| format!("Failed to get profile metadata: {}", e))?;

            let profile_tags = db.get_profile_tags(&profile.id)
                .map_err(|e| format!("Failed to get profile tags: {}", e))?;

            // Resolve central password name for portable reference (v0.9.0+)
            let central_password_ref = if profile.auth_method == "central_password" {
                profile.central_password_id.as_deref()
                    .and_then(|cp_id| db.get_central_password_by_id(cp_id).ok().flatten())
                    .map(|cp| cp.name)
            } else {
                None
            };

            profile_exports.push(ProfileExportDetailed {
                profile,  // Use profile directly - group_path is already semantic
                password,
                metadata,
                tags: profile_tags,
                central_password_ref,
            });
        }

        // Get all child groups recursively
        let child_groups = db.get_child_groups(group_id)
            .map_err(|e| format!("Failed to get child groups: {}", e))?;

        let mut subgroup_exports = Vec::new();
        for child_group in child_groups {
            let subgroup = export_group_recursive(db, &child_group.id, include_passwords)?;
            subgroup_exports.push(subgroup);
        }

        Ok(GroupExportDetailed {
            group: group_portable,
            // L-5: tags field removed
            profiles: profile_exports,
            subgroups: subgroup_exports,
        })
    }

    let group_export = export_group_recursive(&db, &group_id, include_passwords)?;

    let export_data = SingleGroupExportData {
        export_format_version: "2.0".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        group: group_export.clone(),
    };

    // Serialize to JSON
    let mut json_data = serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize group: {}", e))?;

    // Collect all profiles from the group and sub-groups to check if encryption is required
    let all_profiles = collect_profiles_from_group_export(&group_export);
    let requires_encryption = include_passwords && export_requires_encryption(&all_profiles);

    // Handle encryption
    match encryption_password {
        Some(password) => {
            // User provided encryption password - encrypt the export
            let encrypted = encrypt_data(&json_data, &password)?;
            // M-10: Zeroize plaintext JSON after encryption (defense-in-depth)
            json_data.zeroize();
            serde_json::to_string_pretty(&encrypted)
                .map_err(|e| format!("Failed to serialize encrypted export: {}", e))
        },
        None => {
            // No encryption password provided
            if requires_encryption {
                Err("Encryption required: This export contains password-authenticated profiles. Please provide an encryption password.".to_string())
            } else {
                // Encryption not required - return plain JSON
                Ok(json_data)
            }
        }
    }
}

// Helper function for import: look up central password by name, or create an empty shell if not found (v0.9.0+)
fn resolve_or_create_central_password_for_import(db: &Database, name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() || name.len() > 64 {
        return Err(format!("Invalid central password name in import: name must be 1–64 characters"));
    }
    if !name.chars().all(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_' | '(' | ')')) {
        return Err("Invalid central password name in import: name contains invalid characters".to_string());
    }

    if let Some(cp) = db.get_central_password_by_name(name)
        .map_err(|e| format!("Failed to look up central password '{}': {}", name, e))?
    {
        return Ok(cp.id);
    }

    // Not found — create an empty shell; keychain entry will be set by the user via the CP manager
    let now = chrono::Utc::now().to_rfc3339();
    let cp = CentralPassword {
        id: Uuid::new_v4().to_string(),
        name: name.to_string(),
        description: None,
        created_at: now.clone(),
        updated_at: now,
    };
    db.create_central_password(&cp)
        .map_err(|e| format!("Failed to create central password '{}': {}", name, e))?;

    Ok(cp.id)
}

// Helper function to create profile_metadata and profile_tags
fn import_profile_metadata_and_tags(
    db: &Database,
    profile_id: &str,
    metadata: Option<ProfileMetadata>,
    tags: Vec<Tag>,
) -> Result<(), String> {
    let conn = db.conn.lock().expect("Database lock poisoned");

    // Import metadata if provided, otherwise use defaults
    if let Some(meta) = metadata {
        conn.execute(
            "INSERT OR REPLACE INTO profile_metadata (profile_id, icon, is_favorite, display_order) VALUES (?1, ?2, ?3, ?4)",
            (profile_id, meta.icon, if meta.is_favorite { 1 } else { 0 }, meta.display_order),
        ).map_err(|e| format!("Failed to import profile metadata: {}", e))?;
    } else {
        // No metadata provided - insert defaults (icon='server', is_favorite=0, display_order=0)
        conn.execute(
            "INSERT OR REPLACE INTO profile_metadata (profile_id, icon, is_favorite, display_order) VALUES (?1, 'server', 0, 0)",
            [profile_id],
        ).map_err(|e| format!("Failed to create default profile metadata: {}", e))?;
    }

    // Import tags
    for tag in tags {
        // Create tag if it doesn't exist (by name)
        let existing_tag: Option<String> = conn
            .query_row("SELECT id FROM tags WHERE name = ?1", [&tag.name], |row| row.get(0))
            .ok();

        let tag_id = if let Some(existing_id) = existing_tag {
            existing_id
        } else {
            // Create new tag with original or new ID
            let new_tag_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
                (new_tag_id.clone(), tag.name, tag.color, chrono::Utc::now().to_rfc3339()),
            ).map_err(|e| format!("Failed to create tag: {}", e))?;
            new_tag_id
        };

        // Link tag to profile
        conn.execute(
            "INSERT OR IGNORE INTO profile_tags (profile_id, tag_id) VALUES (?1, ?2)",
            (profile_id, tag_id),
        ).map_err(|e| format!("Failed to link tag to profile: {}", e))?;
    }

    Ok(())
}

// Individual profile import (v0.7.0+) - append mode with duplicate detection
#[tauri::command]
fn import_profile(
    db: State<Database>,
    data: String,
    target_group_path: Option<String>,  // Semantic path for target group
    duplicate_action: String, // "skip", "rename", or "overwrite"
    encryption_password: Option<String>,
) -> Result<String, String> {
    // M-2: Validate import size to prevent OOM attacks
    if data.len() > MAX_IMPORT_JSON_SIZE {
        return Err(format!(
            "Import data exceeds maximum allowed size ({} MB)",
            MAX_IMPORT_JSON_SIZE / 1024 / 1024
        ));
    }

    // Phase 6C: Decrypt if encrypted
    let data = decrypt_import_if_encrypted(&data, &encryption_password)?;

    // Parse import data
    let import_data: SingleProfileExportData = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse import data: {}", e))?;

    let profile_export = import_data.profile;
    let mut profile = profile_export.profile;

    // Set target group_path (overriding the imported value)
    profile.group_path = target_group_path.clone();

    // Handle central_password_ref: resolve to local ID, or create empty shell (v0.9.0+)
    if let Some(ref cp_name) = profile_export.central_password_ref {
        let cp_id = resolve_or_create_central_password_for_import(&db, cp_name)?;
        profile.central_password_id = Some(cp_id);
        profile.auth_method = "central_password".to_string();
    } else {
        // Clear any exported central_password_id — UUIDs are machine-specific
        profile.central_password_id = None;
    }

    // SECURITY: Validate all profile fields to prevent injection attacks
    validate_profile_fields(&profile)
        .map_err(|e| format!("Invalid profile '{}': {}", profile.name, e))?;

    // Check for duplicates: same name + semantic group path
    // Profile names must be unique within their group (allows same name in different groups)
    let existing_profiles = db.get_all_profiles()
        .map_err(|e| format!("Failed to get existing profiles: {}", e))?;

    let duplicate = existing_profiles.iter().find(|p| {
        p.name == profile.name && p.group_path == target_group_path
    });

    let new_id = match (duplicate, duplicate_action.as_str()) {
        (Some(_), "skip") => {
            return Ok("skipped".to_string());
        }
        (Some(dup), "overwrite") => {
            // Delete existing profile and reuse ID
            db.delete_profile(&dup.id)
                .map_err(|e| format!("Failed to delete existing profile: {}", e))?;
            let _ = delete_password(&dup.id);
            dup.id.clone()
        }
        (Some(_), "rename") | (None, _) => {
            // Generate new ID for renamed or new profile
            if duplicate.is_some() {
                // Add " (imported)" suffix to name
                profile.name = format!("{} (imported)", profile.name);
            }
            Uuid::new_v4().to_string()
        }
        _ => return Err(format!("Invalid duplicate_action: {}", duplicate_action)),
    };

    // Set new ID
    profile.id = new_id.clone();

    // Create the profile
    db.create_profile(&profile)
        .map_err(|e| format!("Failed to import profile '{}': {}", profile.name, e))?;

    // Store password if it exists
    if let Some(password) = profile_export.password {
        if !password.is_empty() {
            store_password(&new_id, &password)?;
        }
    }

    // Import metadata and tags
    import_profile_metadata_and_tags(&db, &new_id, profile_export.metadata, profile_export.tags)?;

    Ok(new_id)
}

// Individual group import (v0.7.0+) - append mode with duplicate detection
#[tauri::command]
fn import_group(
    db: State<Database>,
    data: String,
    parent_group_path: Option<String>,  // Changed from parent_group_id to semantic path
    duplicate_action: String, // "skip", "rename", or "merge"
    encryption_password: Option<String>,
) -> Result<String, String> {
    fn import_group_recursive(
        db: &Database,
        group_export: GroupExportDetailed,
        parent_id: Option<String>,
        parent_path: Option<String>,
        duplicate_action: &str,
        existing_groups: &mut Vec<Group>, // Pass existing groups to avoid N+1 queries
        existing_profiles: &mut Vec<Profile>, // Pass existing profiles to avoid N+1 queries
    ) -> Result<String, String> {
        let mut group_portable = group_export.group;

        // Check for duplicate group (same name under same parent) using semantic paths
        // Use pre-loaded existing_groups instead of querying

        let duplicate = existing_groups.iter().find(|g| {
            if g.name != group_portable.name {
                return false;
            }

            // Compare by semantic parent paths instead of UUIDs
            let existing_parent_path = get_group_path_by_id(db, &g.parent_id).ok().flatten();
            existing_parent_path == parent_path
        }).cloned(); // Clone to avoid borrow checker issues

        let (group_id, actual_path) = match (duplicate.clone(), duplicate_action) {
            (Some(_), "skip") => {
                return Ok("skipped".to_string());
            }
            (Some(dup), "merge") => {
                // Use existing group ID and path
                (dup.id.clone(), dup.path.clone())
            }
            (Some(_), "rename") | (None, _) => {
                // Create new group
                if duplicate.is_some() {
                    group_portable.name = format!("{} (imported)", group_portable.name);
                }

                // Create Group struct from GroupPortable
                let group = Group {
                    id: Uuid::new_v4().to_string(),
                    name: group_portable.name.clone(),
                    parent_id: parent_id.clone(),
                    path: if let Some(pp) = &parent_path {
                        format!("{}/{}", pp, group_portable.name)
                    } else {
                        group_portable.name.clone()
                    },
                    icon: group_portable.icon,
                    is_favorite: group_portable.is_favorite,
                    display_order: group_portable.display_order,
                    created_at: chrono::Utc::now().to_rfc3339(),
                    updated_at: chrono::Utc::now().to_rfc3339(),
                };

                let new_id = group.id.clone();
                let new_path = group.path.clone(); // Capture the actual path with renamed group name

                db.create_group(&group)
                    .map_err(|e| format!("Failed to create group '{}': {}", group.name, e))?;

                // Update local collection after insert
                existing_groups.push(group.clone());

                // L-5: Group tags import removed (feature removed - no UI, no commands)

                (new_id, new_path)
            }
            _ => return Err(format!("Invalid duplicate_action: {}", duplicate_action)),
        };

        // Import all profiles in this group
        for profile_export in group_export.profiles {
            let mut profile = profile_export.profile;

            // Set group_path
            profile.group_path = Some(actual_path.clone());

            // Handle central_password_ref: resolve to local ID, or create empty shell (v0.9.0+)
            if let Some(ref cp_name) = profile_export.central_password_ref {
                let cp_id = resolve_or_create_central_password_for_import(db, cp_name)?;
                profile.central_password_id = Some(cp_id);
                profile.auth_method = "central_password".to_string();
            } else {
                // Clear any exported central_password_id — UUIDs are machine-specific
                profile.central_password_id = None;
            }

            // SECURITY: Validate all profile fields to prevent injection attacks
            validate_profile_fields(&profile)
                .map_err(|e| format!("Invalid profile '{}' in group '{}': {}", profile.name, actual_path, e))?;

            // Check for duplicate profile when merging
            let profile_id = if duplicate_action == "merge" {
                // Use pre-loaded existing profiles to check for duplicates
                let existing = existing_profiles.iter().find(|p| {
                    p.name == profile.name && p.group_path.as_ref() == Some(&actual_path)
                });

                if let Some(existing_profile) = existing {
                    // Overwrite existing profile - delete and recreate with same ID
                    let reused_id = existing_profile.id.clone();
                    db.delete_profile(&reused_id)
                        .map_err(|e| format!("Failed to delete existing profile: {}", e))?;
                    profile.id = reused_id.clone();
                    reused_id
                } else {
                    // New profile
                    let new_id = Uuid::new_v4().to_string();
                    profile.id = new_id.clone();
                    new_id
                }
            } else {
                // For rename/skip actions, always create new profile
                let new_id = Uuid::new_v4().to_string();
                profile.id = new_id.clone();
                new_id
            };

            db.create_profile(&profile)
                .map_err(|e| format!("Failed to import profile '{}': {}", profile.name, e))?;

            // Store password
            if let Some(password) = profile_export.password {
                if !password.is_empty() {
                    store_password(&profile_id, &password)?;
                }
            }

            // Import metadata and tags
            import_profile_metadata_and_tags(db, &profile_id, profile_export.metadata, profile_export.tags)?;
        }

        // Import subgroups recursively, passing collections to avoid N+1 queries
        for subgroup in group_export.subgroups {
            import_group_recursive(db, subgroup, Some(group_id.clone()), Some(actual_path.clone()), duplicate_action, existing_groups, existing_profiles)?;
        }

        Ok(group_id)
    }

    // M-2: Validate import size to prevent OOM attacks
    if data.len() > MAX_IMPORT_JSON_SIZE {
        return Err(format!(
            "Import data exceeds maximum allowed size ({} MB)",
            MAX_IMPORT_JSON_SIZE / 1024 / 1024
        ));
    }

    // Phase 6C: Decrypt if encrypted
    let data = decrypt_import_if_encrypted(&data, &encryption_password)?;

    // Parse import data
    let import_data: SingleGroupExportData = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse import data: {}", e))?;

    // Use parent path from export data if not explicitly provided
    // This ensures encrypted imports preserve original group structure
    let parent_group_path = parent_group_path.or_else(|| import_data.group.group.parent_path.clone());

    // Resolve parent group path to group_id
    let parent_group_id = resolve_group_path_to_id(&db, &parent_group_path)?;

    // PERFORMANCE: Load existing groups and profiles once to avoid N+1 query pattern
    let mut existing_groups = db.get_all_groups()
        .map_err(|e| format!("Failed to get existing groups: {}", e))?;
    let mut existing_profiles = db.get_all_profiles()
        .map_err(|e| format!("Failed to get existing profiles: {}", e))?;

    import_group_recursive(&db, import_data.group, parent_group_id, parent_group_path, &duplicate_action, &mut existing_groups, &mut existing_profiles)
}


#[tauri::command]
async fn save_profiles_to_file(
    data: String,
    default_filename: String,
) -> Result<bool, String> {
    use tauri::async_runtime::spawn_blocking;
    use tokio::time::timeout;

    // Show save dialog in a blocking context with 2-minute timeout
    let result = timeout(
        std::time::Duration::from_secs(FILE_DIALOG_TIMEOUT_SECS),
        spawn_blocking(move || {
            // Use rfd (native file dialog) which works well with Tauri
            let file_path = rfd::FileDialog::new()
                .set_file_name(&default_filename)
                .add_filter("JSON", &["json"])
                .save_file();

            file_path
        })
    )
    .await
    .map_err(|_| "File dialog timed out".to_string())?
    .map_err(|e| format!("Failed to show dialog: {}", e))?;

    match result {
        Some(path) => {
            // Write the file
            fs::write(&path, data)
                .map_err(|e| format!("Failed to write file: {}", e))?;
            Ok(true)
        }
        None => Ok(false), // User cancelled
    }
}

#[tauri::command]
fn export_settings(
    theme: String,
    auto_update_check: bool,
    window_width: i32,
    window_height: i32,
    recent_connections_limit: i32,
    filtered_groups: Option<Vec<String>>,
    collapsed_groups: Option<Vec<String>>,
    include_passwords_in_exports: bool,
    require_encryption_for_all_exports: bool,
    expanded_card_actions_enabled: bool,
    terminal_preference: String,
    use_tabs_in_terminal: Option<bool>,
    minimize_on_launch: Option<bool>,
    include_profiles: bool,
    include_passwords: bool,
    encryption_password: Option<String>,
    db: State<Database>,
) -> Result<String, String> {
    // Detect current OS
    let current_os = {
        #[cfg(target_os = "macos")]
        { "macos".to_string() }
        #[cfg(target_os = "windows")]
        { "windows".to_string() }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        { "unknown".to_string() }
    };

    let settings_data = SettingsData {
        theme,
        auto_update_check,
        window_width,
        window_height,
        recent_connections_limit,
        filtered_groups,
        collapsed_groups,
        include_passwords_in_exports,
        require_encryption_for_all_exports,
        expanded_card_actions_enabled,
    };

    let settings_os_specific = SettingsOsSpecific {
        terminal_preference,
        use_tabs_in_terminal,
        minimize_on_launch,
    };

    // Validate before exporting
    validate_settings(&settings_data)?;
    validate_settings_os_specific(&settings_os_specific)?;

    // Get profiles if include_profiles is true
    let profiles_data = if include_profiles {
        let all_profiles = db.get_all_profiles()
            .map_err(|e| format!("Failed to get profiles: {}", e))?;
        let mut profile_exports = Vec::new();

        for profile in all_profiles {
            let password = if include_passwords {
                match &profile.auth_method as &str {
                    "password" => get_password(&profile.id).ok(),
                    _ => None,
                }
            } else {
                None
            };

            // Fetch metadata for the profile
            let metadata = db.get_profile_metadata(&profile.id).ok().flatten();

            // Fetch tags for the profile
            let tags = db.get_profile_tags(&profile.id).unwrap_or_default();

            // Resolve central password name for portable reference (v0.9.0+)
            let central_password_ref = if profile.auth_method == "central_password" {
                profile.central_password_id.as_deref()
                    .and_then(|cp_id| db.get_central_password_by_id(cp_id).ok().flatten())
                    .map(|cp| cp.name)
            } else {
                None
            };

            profile_exports.push(ProfileExport {
                profile,  // Use profile directly - group_path is already semantic
                password,
                metadata,
                tags,
                central_password_ref,
            });
        }

        Some(profile_exports)
    } else {
        None
    };

    // Enforce mandatory encryption when backup includes password-authenticated profiles
    if include_profiles && include_passwords && encryption_password.is_none() {
        if let Some(ref prof_list) = profiles_data {
            let has_password_profile = prof_list.iter().any(|p| p.profile.auth_method == "password" && p.password.is_some());
            if has_password_profile {
                return Err("Encryption required: This backup contains password-authenticated profiles. Please provide an encryption password.".to_string());
            }
        }
    }

    let export_data = SettingsExport {
        version: env!("CARGO_PKG_VERSION").to_string(),
        os: current_os,
        exported_at: chrono::Utc::now().to_rfc3339(),
        settings: settings_data,
        settings_os_specific,
        profiles: profiles_data,
    };

    let json = serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    // Encrypt if password provided
    if let Some(ref password) = encryption_password {
        let encrypted = encrypt_data(&json, password)?;
        serde_json::to_string_pretty(&encrypted)
            .map_err(|e| format!("Failed to serialize encrypted settings: {}", e))
    } else {
        Ok(json)
    }
}

#[tauri::command]
fn import_settings(data: String, encryption_password: Option<String>) -> Result<SettingsImportResult, String> {
    // SECURITY: Validate payload size to prevent resource exhaustion
    const MAX_SETTINGS_JSON_SIZE: usize = 1024 * 1024; // 1MB
    if data.len() > MAX_SETTINGS_JSON_SIZE {
        return Err(format!(
            "Settings import exceeds maximum size of {} bytes (received {} bytes)",
            MAX_SETTINGS_JSON_SIZE,
            data.len()
        ));
    }

    // Server-side rate limiting (5 seconds between imports)
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    {
        let mut last_time = LAST_SETTINGS_IMPORT_TIME.lock()
            .map_err(|e| format!("Rate limit lock poisoned: {}", e))?;
        if now - *last_time < SETTINGS_IMPORT_RATE_LIMIT_SECS {
            return Err("Rate limit: Please wait 5 seconds between settings imports.".to_string());
        }
        *last_time = now;
    }

    // Phase 6: Decrypt if encrypted
    let data = decrypt_import_if_encrypted(&data, &encryption_password)?;

    let import_data: SettingsImport = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse settings data: {}", e))?;

    let settings = import_data.settings;

    // Determine current OS
    let current_os = {
        #[cfg(target_os = "macos")]
        { "macos" }
        #[cfg(target_os = "windows")]
        { "windows" }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        { "unknown" }
    };

    // Handle OS-specific settings
    // Only apply if the backup OS matches current OS
    let settings_os_specific = if let Some(backup_os) = import_data.os {
        if backup_os == current_os {
            // OS matches - use the imported OS-specific settings
            import_data.settings_os_specific
        } else {
            // Different OS - ignore OS-specific settings, will use platform defaults
            None
        }
    } else {
        // No OS field in backup (old format) - ignore OS-specific settings
        None
    };

    // Validate imported settings
    validate_settings(&settings)?;
    if let Some(ref os_settings) = settings_os_specific {
        validate_settings_os_specific(os_settings)?;
    }

    Ok(SettingsImportResult {
        settings,
        settings_os_specific,
        profiles: import_data.profiles,
    })
}

#[tauri::command]
async fn browse_ssh_key() -> Result<Option<String>, String> {
    use tauri::async_runtime::spawn_blocking;
    use tokio::time::timeout;

    // Determine starting directory: prefer ~/.ssh, fallback to home
    let start_dir = match dirs::home_dir() {
        Some(home) => {
            let ssh_dir = home.join(".ssh");
            if ssh_dir.exists() && ssh_dir.is_dir() {
                ssh_dir
            } else {
                home
            }
        }
        None => std::env::current_dir().unwrap_or_default(),
    };

    // Show open file dialog in a blocking context with 2-minute timeout
    let result = timeout(
        std::time::Duration::from_secs(FILE_DIALOG_TIMEOUT_SECS),
        spawn_blocking(move || {
            // Use rfd (native file dialog) which works well with Tauri
            let file_path = rfd::FileDialog::new()
                .set_title("Select SSH Key File")
                .set_directory(&start_dir)
                .pick_file();

            file_path
        })
    )
    .await
    .map_err(|_| "File dialog timed out".to_string())?
    .map_err(|e| format!("Failed to show dialog: {}", e))?;

    match result {
        Some(path) => Ok(Some(path.to_string_lossy().to_string())),
        None => Ok(None), // User cancelled
    }
}

#[tauri::command]
async fn browse_terminal_app() -> Result<Option<String>, String> {
    use tauri::async_runtime::spawn_blocking;
    use tokio::time::timeout;

    // Show open file dialog in a blocking context with 2-minute timeout
    let result = timeout(
        std::time::Duration::from_secs(FILE_DIALOG_TIMEOUT_SECS),
        spawn_blocking(move || {
            #[cfg(target_os = "macos")]
            {
                // macOS: Look for .app bundles in /Applications
                // Note: .app bundles are directories, but macOS treats them as applications
                let applications_dir = std::path::PathBuf::from("/Applications");

                // Use NSOpenPanel directly via osascript for better .app bundle selection
                let script = format!(
                    r#"tell application "System Events"
                        activate
                        set appPath to POSIX path of (choose file of type {{"app"}} with prompt "Select Terminal Application" default location "{}")
                        return appPath
                    end tell"#,
                    applications_dir.to_string_lossy()
                );

                let output = std::process::Command::new("osascript")
                    .arg("-e")
                    .arg(script)
                    .output();

                match output {
                    Ok(result) if result.status.success() => {
                        let path_str = String::from_utf8_lossy(&result.stdout).trim().to_string();
                        if path_str.is_empty() {
                            None // User cancelled
                        } else {
                            Some(std::path::PathBuf::from(path_str))
                        }
                    },
                    _ => None // Error or cancelled
                }
            }

            #[cfg(target_os = "windows")]
            {
                // Windows: Look for .exe files
                let file_path = rfd::FileDialog::new()
                    .set_title("Select Terminal Application")
                    .add_filter("Executable", &["exe"])
                    .pick_file();

                file_path
            }

            #[cfg(not(any(target_os = "macos", target_os = "windows")))]
            {
                None
            }
        })
    )
    .await
    .map_err(|_| "File dialog timed out".to_string())?
    .map_err(|e| format!("Failed to show dialog: {}", e))?;

    match result {
        Some(path) => Ok(Some(path.to_string_lossy().to_string())),
        None => Ok(None), // User cancelled
    }
}

// Update checker structures
#[derive(Debug, Serialize, Deserialize)]
struct UpdateInfo {
    current_version: String,
    latest_version: String,
    update_available: bool,
    download_url: String,
}

#[tauri::command]
async fn check_for_updates() -> Result<UpdateInfo, String> {
    // Current version from Cargo.toml
    const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");
    const CACHE_DURATION_SECS: u64 = 3600; // Cache for 1 hour

    // Check cache first
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    if let Ok(cache) = UPDATE_CHECK_CACHE.lock() {
        if let Some((cached_time, current_ver, latest_ver, update_avail, dl_url)) = cache.as_ref() {
            // If cache is less than 1 hour old, return cached result
            if now - cached_time < CACHE_DURATION_SECS {
                #[cfg(debug_assertions)]
                println!("Using cached update check result (age: {} seconds)", now - cached_time);

                return Ok(UpdateInfo {
                    current_version: current_ver.clone(),
                    latest_version: latest_ver.clone(),
                    update_available: *update_avail,
                    download_url: dl_url.clone(),
                });
            }
        }
    }

    // Create async HTTP client with 10-second timeout
    let client = reqwest::Client::builder()
        .user_agent("SSH-Profile-Manager")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Fetch latest release from GitHub API
    let response = client
        .get("https://api.github.com/repos/tomsinclair94/ssh-profile-manager/releases/latest")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch releases: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API returned status: {}", response.status()));
    }

    let release: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    // Validate and extract tag_name
    let tag_name = release["tag_name"]
        .as_str()
        .ok_or("No tag_name in release")?;

    // Validate tag_name format (should be vX.X.X or X.X.X)
    if tag_name.is_empty() {
        return Err("Empty tag_name in release.".to_string());
    }

    let latest_version = tag_name.trim_start_matches('v').to_string();

    // Ensure version string is not empty after trimming
    if latest_version.is_empty() {
        return Err("Invalid version format in tag_name.".to_string());
    }

    // Validate download URL exists
    let download_url = release["html_url"]
        .as_str()
        .ok_or("No html_url in release")?
        .to_string();

    if download_url.is_empty() {
        return Err("Empty html_url in release.".to_string());
    }

    // Use semantic versioning for proper version comparison
    use semver::Version;
    let current = Version::parse(CURRENT_VERSION)
        .map_err(|e| format!("Invalid current version: {}", e))?;
    let latest = Version::parse(&latest_version)
        .map_err(|e| format!("Invalid latest version '{}': {}", latest_version, e))?;

    // Update is available only if latest > current
    let update_available = latest > current;

    let result = UpdateInfo {
        current_version: CURRENT_VERSION.to_string(),
        latest_version: latest_version.clone(),
        update_available,
        download_url: download_url.clone(),
    };

    // Cache the result
    if let Ok(mut cache) = UPDATE_CHECK_CACHE.lock() {
        *cache = Some((now, CURRENT_VERSION.to_string(), latest_version, update_available, download_url));
        #[cfg(debug_assertions)]
        println!("Cached update check result for {} seconds", CACHE_DURATION_SECS);
    }

    Ok(result)
}

#[tauri::command]
fn validate_custom_terminal(path: String) -> Result<bool, String> {
    // Simply validate the path without opening file picker
    match validate_terminal_path(&path) {
        Ok(_) => Ok(true),
        Err(e) => Err(e),
    }
}

#[tauri::command]
fn get_recent_connections(db: State<Database>, limit: Option<usize>) -> Result<Vec<RecentConnection>, String> {
    db.get_recent_connections(limit)
        .map_err(|e| format!("Failed to get recent connections: {}", e))
}

#[tauri::command]
fn record_connection(db: State<Database>, profile_id: String) -> Result<(), String> {
    db.record_connection(&profile_id)
        .map_err(|e| format!("Failed to record connection: {}", e))
}

#[tauri::command]
fn clear_recent_connections(db: State<Database>) -> Result<(), String> {
    db.clear_recent_connections()
        .map_err(|e| format!("Failed to clear recent connections: {}", e))
}

#[tauri::command]
fn remove_recent_connection(db: State<Database>, profile_id: String) -> Result<(), String> {
    db.remove_recent_connection(&profile_id)
        .map_err(|e| format!("Failed to remove recent connection: {}", e))
}

#[tauri::command]
fn get_setting(db: State<Database>, key: String) -> Result<Option<UserSetting>, String> {
    db.get_setting(&key)
        .map_err(|e| format!("Failed to get setting: {}", e))
}

#[tauri::command]
fn save_setting(db: State<Database>, key: String, value: String) -> Result<(), String> {
    // M-7: Validate setting key against allowlist
    if !ALLOWED_SETTING_KEYS.contains(&key.as_str()) {
        return Err(format!("Invalid setting key: {}", key));
    }

    // Validate value size (10KB max)
    if value.len() > 10240 {
        return Err("Setting value exceeds maximum size (10KB)".to_string());
    }

    db.save_setting(&key, &value)
        .map_err(|e| format!("Failed to save setting: {}", e))
}

// Profile Metadata Commands
#[tauri::command]
fn toggle_profile_favorite(db: State<Database>, profile_id: String) -> Result<bool, String> {
    db.toggle_profile_favorite_db(&profile_id)
        .map_err(|e| format!("Failed to toggle favorite: {}", e))
}

#[tauri::command]
fn set_profile_favorite(db: State<Database>, profile_id: String, is_favorite: bool) -> Result<(), String> {
    db.set_profile_favorite_db(&profile_id, is_favorite)
        .map_err(|e| format!("Failed to set favorite: {}", e))
}

#[tauri::command]
fn update_profile_icon(db: State<Database>, profile_id: String, icon: Option<String>) -> Result<(), String> {
    db.update_profile_icon_db(&profile_id, icon)
        .map_err(|e| format!("Failed to update icon: {}", e))
}

#[tauri::command]
fn get_profile_metadata(db: State<Database>, profile_id: String) -> Result<Option<ProfileMetadata>, String> {
    db.get_profile_metadata(&profile_id)
        .map_err(|e| format!("Failed to get metadata: {}", e))
}

// Tag Commands
#[tauri::command]
fn get_tags(db: State<Database>) -> Result<Vec<Tag>, String> {
    db.get_all_tags()
        .map_err(|e| format!("Failed to get tags: {}", e))
}

#[derive(Debug, Deserialize)]
struct CreateTagInput {
    name: String,
    color: String,
}

#[derive(Deserialize)]
struct CreateCentralPasswordInput {
    name: String,
    description: Option<String>,
    password: String,
}

impl std::fmt::Debug for CreateCentralPasswordInput {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CreateCentralPasswordInput")
            .field("name", &self.name)
            .field("description", &self.description)
            .field("password", &"[REDACTED]")
            .finish()
    }
}

#[derive(Debug, Deserialize)]
struct UpdateCentralPasswordInput {
    id: String,
    name: String,
    description: Option<String>,
}

#[tauri::command]
fn create_tag(db: State<Database>, input: CreateTagInput) -> Result<String, String> {
    // Validate tag name
    if input.name.trim().is_empty() {
        return Err("Tag name cannot be empty".to_string());
    }

    if input.name.len() > 32 {
        return Err("Tag name must be 32 characters or less".to_string());
    }

    // Validate name: alphanumeric, hyphens, underscores only (NO spaces)
    // Using character-by-character validation instead of regex for performance
    if input.name.is_empty() || !input.name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err("Tag name can only contain letters, numbers, hyphens, and underscores (no spaces)".to_string());
    }

    // Validate color format (#RRGGBB)
    // Using character-by-character validation instead of regex for performance
    if input.color.len() != 7 || !input.color.starts_with('#') || !input.color[1..].chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Invalid color format. Use hex format like #FF5733".to_string());
    }

    let tag_id = Uuid::new_v4().to_string();
    let tag = Tag {
        id: tag_id.clone(),
        name: input.name.trim().to_string(),
        color: input.color.to_uppercase(), // Normalize to uppercase
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    db.create_tag_db(&tag)
        .map_err(|e| {
            if e.to_string().contains("UNIQUE constraint failed") {
                "A tag with this name already exists".to_string()
            } else {
                format!("Failed to create tag: {}", e)
            }
        })?;

    Ok(tag_id)
}

#[tauri::command]
fn delete_tag(db: State<Database>, tag_id: String) -> Result<(), String> {
    db.delete_tag_db(&tag_id)
        .map_err(|e| format!("Failed to delete tag: {}", e))
}

#[tauri::command]
fn get_tag_usage_counts(db: State<Database>) -> Result<Vec<(Tag, i32)>, String> {
    db.get_tag_usage_counts_db()
        .map_err(|e| format!("Failed to get tag usage counts: {}", e))
}

#[tauri::command]
fn get_profile_tags(db: State<Database>, profile_id: String) -> Result<Vec<Tag>, String> {
    db.get_profile_tags(&profile_id)
        .map_err(|e| format!("Failed to get profile tags: {}", e))
}

#[tauri::command]
fn add_profile_tag(db: State<Database>, profile_id: String, tag_id: String) -> Result<(), String> {
    db.add_profile_tag_db(&profile_id, &tag_id)
        .map_err(|e| format!("Failed to add tag: {}", e))
}

#[tauri::command]
fn remove_profile_tag(db: State<Database>, profile_id: String, tag_id: String) -> Result<(), String> {
    db.remove_profile_tag_db(&profile_id, &tag_id)
        .map_err(|e| format!("Failed to remove tag: {}", e))
}

#[tauri::command]
fn set_profile_tags(db: State<Database>, profile_id: String, tag_ids: Vec<String>) -> Result<(), String> {
    db.set_profile_tags_db(&profile_id, &tag_ids)
        .map_err(|e| format!("Failed to set tags: {}", e))
}

// Central Password Commands

#[tauri::command]
fn get_central_passwords(db: State<Database>) -> Result<Vec<CentralPassword>, String> {
    db.get_all_central_passwords()
        .map_err(|e| format!("Failed to get central passwords: {}", e))
}

#[tauri::command]
fn create_central_password(
    db: State<Database>,
    input: CreateCentralPasswordInput,
) -> Result<String, String> {
    let name = input.name.trim().to_string();

    if name.is_empty() {
        return Err("Name cannot be empty".to_string());
    }
    if name.len() > 64 {
        return Err("Name must be 64 characters or less".to_string());
    }
    // Alphanumeric + spaces + - _ ( )
    if !name.chars().all(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_' | '(' | ')')) {
        return Err(
            "Name can only contain letters, numbers, spaces, hyphens, underscores, and parentheses"
                .to_string(),
        );
    }
    if let Some(ref desc) = input.description {
        validate_description(desc)?;
    }
    if input.password.is_empty() {
        return Err("Password cannot be empty".to_string());
    }

    // Check name uniqueness
    if db
        .get_central_password_by_name(&name)
        .map_err(|e| format!("Failed to check name: {}", e))?
        .is_some()
    {
        return Err("A central password with this name already exists".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let cp = CentralPassword {
        id: id.clone(),
        name,
        description: input.description,
        created_at: now.clone(),
        updated_at: now,
    };

    db.create_central_password(&cp)
        .map_err(|e| format!("Failed to create central password: {}", e))?;

    let keychain_key = format!("central-{}", id);
    if let Err(e) = store_password(&keychain_key, &input.password) {
        // Roll back the DB record so the CP doesn't appear with no usable password
        let conn = db.conn.lock().expect("Database lock poisoned");
        let _ = conn.execute("DELETE FROM central_passwords WHERE id = ?1", [&id]);
        return Err(format!("Failed to store password in keychain: {}", e));
    }

    Ok(id)
}

#[tauri::command]
fn update_central_password(
    db: State<Database>,
    input: UpdateCentralPasswordInput,
) -> Result<(), String> {
    let name = input.name.trim().to_string();

    if name.is_empty() {
        return Err("Name cannot be empty".to_string());
    }
    if name.len() > 64 {
        return Err("Name must be 64 characters or less".to_string());
    }
    if !name.chars().all(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_' | '(' | ')')) {
        return Err(
            "Name can only contain letters, numbers, spaces, hyphens, underscores, and parentheses"
                .to_string(),
        );
    }
    if let Some(ref desc) = input.description {
        validate_description(desc)?;
    }

    // Check name uniqueness (allow keeping own name)
    if let Some(existing) = db
        .get_central_password_by_name(&name)
        .map_err(|e| format!("Failed to check name: {}", e))?
    {
        if existing.id != input.id {
            return Err("A central password with this name already exists".to_string());
        }
    }

    db.update_central_password_meta(&input.id, &name, input.description.as_deref())
        .map_err(|e| format!("Failed to update central password: {}", e))
}

#[tauri::command]
fn update_central_password_value(
    db: State<Database>,
    central_password_id: String,
    password: String,
) -> Result<(), String> {
    if password.is_empty() {
        return Err("Password cannot be empty".to_string());
    }
    // Verify the CP exists before touching the keychain
    db.get_central_password_by_id(&central_password_id)
        .map_err(|e| format!("Failed to verify central password: {}", e))?
        .ok_or_else(|| "Central password not found".to_string())?;
    let keychain_key = format!("central-{}", central_password_id);
    store_password(&keychain_key, &password)
        .map_err(|e| format!("Failed to update password in keychain: {}", e))
}

#[tauri::command]
fn get_central_password_value(
    db: State<Database>,
    central_password_id: String,
) -> Result<String, String> {
    // Verify the CP exists before touching the keychain
    db.get_central_password_by_id(&central_password_id)
        .map_err(|e| format!("Failed to verify central password: {}", e))?
        .ok_or_else(|| "Central password not found".to_string())?;
    let keychain_key = format!("central-{}", central_password_id);
    get_password(&keychain_key)
        .map_err(|_| "No password stored for this central password".to_string())
}

#[tauri::command]
fn delete_central_password(
    db: State<Database>,
    central_password_id: String,
) -> Result<usize, String> {
    // Revert all linked profiles to keyboard-interactive auth
    let reverted = db
        .revert_profiles_central_password(&central_password_id)
        .map_err(|e| format!("Failed to revert profiles: {}", e))?;

    // Remove keychain entry (ignore if already absent)
    let keychain_key = format!("central-{}", central_password_id);
    let _ = delete_password(&keychain_key);

    // Delete the DB record
    {
        let conn = db.conn.lock().expect("Database lock poisoned");
        conn.execute(
            "DELETE FROM central_passwords WHERE id = ?1",
            [&central_password_id],
        )
        .map_err(|e| format!("Failed to delete central password: {}", e))?;
    }

    Ok(reverted)
}

#[tauri::command]
fn get_profiles_using_central_password(
    db: State<Database>,
    central_password_id: String,
) -> Result<Vec<String>, String> {
    db.get_profiles_by_central_password_id(&central_password_id)
        .map(|profiles| profiles.into_iter().map(|p| p.name).collect())
        .map_err(|e| format!("Failed to get profiles: {}", e))
}

#[tauri::command]
async fn create_terminal_session(
    db: State<'_, Database>,
    registry: State<'_, SessionRegistry>,
    app_handle: tauri::AppHandle,
    profile_id: String,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    // SECURITY: Rate limiting to prevent thread exhaustion via rapid session creation
    // Each session spawns 2 threads (reader + blocking reader), so limit to 1 per 2 seconds
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    {
        let mut last_time = LAST_SESSION_CREATE_TIME.lock()
            .map_err(|e| format!("Rate limit lock poisoned: {}", e))?;
        if now - *last_time < SESSION_CREATE_RATE_LIMIT_SECS {
            return Err(format!(
                "Rate limit: Please wait {} seconds between terminal sessions",
                SESSION_CREATE_RATE_LIMIT_SECS
            ));
        }
        *last_time = now;
    }

    // SECURITY: Limit concurrent sessions to prevent resource exhaustion
    const MAX_CONCURRENT_SESSIONS: usize = 5;
    {
        let sessions = registry.sessions.lock()
            .map_err(|e| format!("Session registry lock poisoned: {}", e))?;
        if sessions.len() >= MAX_CONCURRENT_SESSIONS {
            return Err(format!(
                "Maximum concurrent sessions reached ({}). Please close an existing session before creating a new one.",
                MAX_CONCURRENT_SESSIONS
            ));
        }
    }

    // Get profile from database
    let profile = db
        .get_profile_by_id(&profile_id)
        .map_err(|e| format!("Failed to get profile: {}", e))?
        .ok_or_else(|| "Profile not found".to_string())?;

    // Validate inputs
    validate_hostname(&profile.host)?;
    validate_username(&profile.username)?;
    validate_port(profile.port as i64)?;

    // Validate dimensions (reduced from 500x200 for security: prevent resource exhaustion)
    if cols < 10 || cols > TERMINAL_MAX_COLS {
        return Err(format!("Terminal columns must be between 10 and {}", TERMINAL_MAX_COLS));
    }
    if rows < 10 || rows > TERMINAL_MAX_ROWS {
        return Err(format!("Terminal rows must be between 10 and {}", TERMINAL_MAX_ROWS));
    }

    // Validate total cell count to prevent excessive memory usage
    let total_cells = cols as u32 * rows as u32;
    if total_cells > TERMINAL_MAX_TOTAL_CELLS {
        return Err(format!(
            "Terminal dimensions exceed maximum size ({}×{} = {} cells > {} max)",
            cols, rows, total_cells, TERMINAL_MAX_TOTAL_CELLS
        ));
    }

    // Create PTY
    let pty_system = native_pty_system();
    let pty_pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to create PTY: {}", e))?;

    // Build SSH command arguments using shared helper (ensures StrictHostKeyChecking is included)
    let ssh_args = build_ssh_args(&profile)?;

    // Create command builder for PTY
    let mut cmd = CommandBuilder::new(&ssh_args[0]);
    cmd.args(&ssh_args[1..]);

    // Spawn SSH process in PTY
    let _child = pty_pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn SSH process: {}", e))?;

    // Generate session ID
    let session_id = Uuid::new_v4().to_string();

    // Get reader and writer from PTY
    let mut reader = pty_pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

    let writer = pty_pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take PTY writer: {}", e))?;

    // Spawn reader thread to emit terminal output events
    let session_id_clone = session_id.clone();
    let app_handle_clone = app_handle.clone();
    let activity_tracker = registry.last_activity.clone();
    let reader_handle = thread::spawn(move || {
        use std::sync::mpsc;
        use std::time::Duration;

        // Create channel for non-blocking read pattern
        let (tx, rx) = mpsc::channel();

        // Spawn blocking reader thread
        thread::spawn(move || {
            let mut buffer = [0u8; 8192];
            loop {
                match reader.read(&mut buffer) {
                    Ok(n) => {
                        if tx.send(Ok(buffer[..n].to_vec())).is_err() {
                            break; // Main thread disconnected
                        }
                        if n == 0 {
                            break; // EOF
                        }
                    }
                    Err(e) => {
                        let _ = tx.send(Err(e));
                        break;
                    }
                }
            }
        });

        // Main output batching loop with timeout-based flushing
        let mut batch_buffer: Vec<u8> = Vec::with_capacity(32768); // 32KB batch buffer
        let mut last_emit = std::time::Instant::now();
        const BATCH_INTERVAL_MS: u128 = 50; // 50ms = instant to humans, efficient batching
        const MAX_BATCH_SIZE: usize = 16384; // 16KB max batch before forced emit

        loop {
            // Use recv_timeout to allow periodic buffer flushing even when no data arrives
            match rx.recv_timeout(Duration::from_millis(BATCH_INTERVAL_MS as u64)) {
                Ok(Ok(data)) => {
                    if data.is_empty() {
                        // EOF - emit any remaining data and signal session end
                        if !batch_buffer.is_empty() {
                            let _ = app_handle_clone.emit(
                                &format!("terminal-output-{}", session_id_clone),
                                std::mem::take(&mut batch_buffer) // Take buffer without clone
                            );
                        }
                        // Emit session ended event for frontend auto-close
                        let _ = app_handle_clone.emit(
                            &format!("terminal-ended-{}", session_id_clone),
                            ()
                        );
                        break;
                    }
                    batch_buffer.extend(data);
                    // Update last activity timestamp (for hung session detection)
                    if let Ok(mut activity) = activity_tracker.lock() {
                        activity.insert(session_id_clone.clone(), Instant::now());
                    }
                }
                Ok(Err(e)) => {
                    // Read error - emit any remaining data and signal session end with error
                    if !batch_buffer.is_empty() {
                        let _ = app_handle_clone.emit(
                            &format!("terminal-output-{}", session_id_clone),
                            std::mem::take(&mut batch_buffer) // Take buffer without clone
                        );
                    }
                    let _ = app_handle_clone.emit(
                        &format!("terminal-ended-{}", session_id_clone),
                        format!("Connection error: {}", e) // Include error message
                    );
                    break;
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    // Timeout - check if channel disconnected during wait (prevents 50ms delay on exit)
                    match rx.try_recv() {
                        Ok(Ok(data)) => {
                            // Got data immediately after timeout - process it
                            if data.is_empty() {
                                // EOF - emit remaining data and exit
                                if !batch_buffer.is_empty() {
                                    let _ = app_handle_clone.emit(
                                        &format!("terminal-output-{}", session_id_clone),
                                        std::mem::take(&mut batch_buffer) // Take buffer without clone
                                    );
                                }
                                let _ = app_handle_clone.emit(
                                    &format!("terminal-ended-{}", session_id_clone),
                                    ()
                                );
                                break;
                            }
                            batch_buffer.extend(data);
                        }
                        Ok(Err(e)) => {
                            // Error arrived - emit remaining data and exit with error
                            if !batch_buffer.is_empty() {
                                let _ = app_handle_clone.emit(
                                    &format!("terminal-output-{}", session_id_clone),
                                    std::mem::take(&mut batch_buffer) // Take buffer without clone
                                );
                            }
                            let _ = app_handle_clone.emit(
                                &format!("terminal-ended-{}", session_id_clone),
                                format!("Connection error: {}", e) // Include error message
                            );
                            break;
                        }
                        Err(mpsc::TryRecvError::Disconnected) => {
                            // Channel disconnected - emit remaining data and exit
                            if !batch_buffer.is_empty() {
                                let _ = app_handle_clone.emit(
                                    &format!("terminal-output-{}", session_id_clone),
                                    std::mem::take(&mut batch_buffer) // Take buffer without clone
                                );
                            }
                            let _ = app_handle_clone.emit(
                                &format!("terminal-ended-{}", session_id_clone),
                                "Connection terminated unexpectedly".to_string()
                            );
                            break;
                        }
                        Err(mpsc::TryRecvError::Empty) => {
                            // Truly timed out with no pending data - continue to flush check
                        }
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    // Reader thread died - emit any remaining data and signal session end
                    if !batch_buffer.is_empty() {
                        let _ = app_handle_clone.emit(
                            &format!("terminal-output-{}", session_id_clone),
                            std::mem::take(&mut batch_buffer) // Take buffer without clone
                        );
                    }
                    let _ = app_handle_clone.emit(
                        &format!("terminal-ended-{}", session_id_clone),
                        "Connection terminated unexpectedly".to_string()
                    );
                    break;
                }
            }

            // PERFORMANCE FIX: Emit buffered data if timeout elapsed or buffer is full
            // This ensures prompts and small outputs are displayed promptly
            let elapsed = last_emit.elapsed().as_millis();
            let should_emit = !batch_buffer.is_empty() &&
                              (elapsed >= BATCH_INTERVAL_MS || batch_buffer.len() >= MAX_BATCH_SIZE);

            if should_emit {
                let _ = app_handle_clone.emit(
                    &format!("terminal-output-{}", session_id_clone),
                    std::mem::take(&mut batch_buffer) // Take buffer without clone (it's auto-cleared by take)
                );
                // No need for batch_buffer.clear() - take() already emptied it
                last_emit = std::time::Instant::now();
            }
        }
    });

    // Create terminal session
    let terminal_session = TerminalSession {
        session_id: session_id.clone(),
        profile_id: profile_id.clone(),
        reader_handle: Some(reader_handle),
    };

    // Store in registry
    {
        let mut sessions = registry.sessions.lock()
            .map_err(|e| format!("Session registry lock poisoned: {}", e))?;
        sessions.insert(session_id.clone(), terminal_session);
    }
    {
        let mut writers = registry.pty_writers.lock()
            .map_err(|e| format!("Writer registry lock poisoned: {}", e))?;
        writers.insert(session_id.clone(), writer);
    }
    {
        let mut pairs = registry.pty_pairs.lock()
            .map_err(|e| format!("PTY pairs registry lock poisoned: {}", e))?;
        pairs.insert(session_id.clone(), pty_pair.master);
    }
    {
        let mut activity = registry.last_activity.lock()
            .map_err(|e| format!("Activity registry lock poisoned: {}", e))?;
        activity.insert(session_id.clone(), Instant::now());
    }

    // Record in active_sessions table
    let conn = db.conn.lock()
        .expect("Database lock poisoned");
    conn.execute(
        "INSERT INTO active_sessions (id, profile_id, tab_id, started_at, last_activity_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        (
            &session_id,
            &profile_id,
            &session_id, // Use session_id as tab_id for now
            chrono::Utc::now().to_rfc3339(),
            chrono::Utc::now().to_rfc3339(),
        ),
    )
    .map_err(|e| format!("Failed to record session in database: {}", e))?;
    drop(conn); // Release lock before calling record_connection

    // Record connection in recent_connections table
    db.record_connection(&profile_id)
        .map_err(|e| format!("Failed to record recent connection: {}", e))?;

    Ok(session_id)
}

#[tauri::command]
fn write_to_terminal(
    registry: State<SessionRegistry>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    // SECURITY: Token bucket rate limiting to prevent write flooding (100 writes/second max)
    // Token bucket prevents burst attacks at window boundaries by gradually refilling tokens
    const BUCKET_CAPACITY: u32 = 100; // Max tokens (100 writes/sec)
    const REFILL_RATE_MS: u128 = 10;  // Add 1 token every 10ms (100 tokens/sec)
    {
        let mut rate_limits = registry.write_rate_limits.lock()
            .map_err(|e| format!("Rate limit lock poisoned: {}", e))?;
        let (last_refill, available_tokens) = rate_limits
            .entry(session_id.clone())
            .or_insert((Instant::now(), BUCKET_CAPACITY));

        // Calculate tokens to add based on elapsed time
        let elapsed_ms = last_refill.elapsed().as_millis();
        let tokens_to_add = (elapsed_ms / REFILL_RATE_MS) as u32;

        if tokens_to_add > 0 {
            // Refill tokens (capped at capacity)
            *available_tokens = (*available_tokens + tokens_to_add).min(BUCKET_CAPACITY);
            *last_refill = Instant::now();
        }

        // Check if token available
        if *available_tokens == 0 {
            return Err("Rate limit exceeded: too many write operations.".to_string());
        }

        // Consume one token
        *available_tokens -= 1;
    }

    let mut writers = registry.pty_writers.lock()
        .map_err(|e| format!("Writer registry lock poisoned: {}", e))?;

    let writer = writers
        .get_mut(&session_id)
        .ok_or_else(|| "Invalid session ID".to_string())?;

    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to terminal: {}", e))?;

    writer
        .flush()
        .map_err(|e| format!("Failed to flush terminal: {}", e))?;

    Ok(())
}

#[tauri::command]
fn resize_terminal(
    registry: State<SessionRegistry>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    // Validate dimensions (reduced from 500x200 for security: prevent resource exhaustion)
    if cols < 10 || cols > TERMINAL_MAX_COLS {
        return Err(format!("Terminal columns must be between 10 and {}", TERMINAL_MAX_COLS));
    }
    if rows < 10 || rows > TERMINAL_MAX_ROWS {
        return Err(format!("Terminal rows must be between 10 and {}", TERMINAL_MAX_ROWS));
    }

    // Validate total cell count to prevent excessive memory usage
    let total_cells = cols as u32 * rows as u32;
    if total_cells > TERMINAL_MAX_TOTAL_CELLS {
        return Err(format!(
            "Terminal dimensions exceed maximum size ({}×{} = {} cells > {} max)",
            cols, rows, total_cells, TERMINAL_MAX_TOTAL_CELLS
        ));
    }

    let pairs = registry.pty_pairs.lock()
        .map_err(|e| format!("PTY pairs registry lock poisoned: {}", e))?;

    let pty = pairs
        .get(&session_id)
        .ok_or_else(|| "Invalid session ID".to_string())?;

    pty.resize(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    })
    .map_err(|e| format!("Failed to resize terminal: {}", e))?;

    Ok(())
}

#[tauri::command]
fn close_terminal_session(
    db: State<Database>,
    registry: State<SessionRegistry>,
    session_id: String,
) -> Result<(), String> {
    // SECURITY: Validate session_id is a valid UUID format
    Uuid::parse_str(&session_id)
        .map_err(|_| "Invalid session ID format".to_string())?;

    // SECURITY FIX: Acquire all locks atomically to prevent race conditions
    // Lock all registries at once before making any mutations
    let mut sessions = registry.sessions.lock()
        .map_err(|e| format!("Session registry lock poisoned: {}", e))?;
    let mut writers = registry.pty_writers.lock()
        .map_err(|e| format!("Writer registry lock poisoned: {}", e))?;
    let mut pairs = registry.pty_pairs.lock()
        .map_err(|e| format!("PTY pairs registry lock poisoned: {}", e))?;
    let mut activity = registry.last_activity.lock()
        .map_err(|e| format!("Activity registry lock poisoned: {}", e))?;
    let mut rate_limits = registry.write_rate_limits.lock()
        .map_err(|e| format!("Rate limit lock poisoned: {}", e))?;

    // Remove all entries atomically
    let session = sessions.remove(&session_id);
    writers.remove(&session_id);
    // Remove PTY pair (this will drop it and send SIGHUP to the SSH process)
    pairs.remove(&session_id);

    // Check last activity for hung session detection
    let last_activity_time = activity.remove(&session_id);
    // Clean up rate limiting data
    rate_limits.remove(&session_id);
    let is_potentially_hung = if let Some(last_time) = last_activity_time {
        // Consider session hung if no data received for 30+ seconds
        last_time.elapsed() > Duration::from_secs(30)
    } else {
        false
    };

    // Release locks before waiting for thread
    drop(sessions);
    drop(writers);
    drop(pairs);
    drop(activity);
    drop(rate_limits);

    // Wait for reader thread to finish (if it exists)
    if let Some(session) = session {
        if let Some(handle) = session.reader_handle {
            // SECURITY FIX: Adaptive timeout based on session state
            // - Normal sessions: 5 second timeout
            // - Hung sessions (no activity for 30s): 1 second timeout to avoid blocking
            let timeout = if is_potentially_hung {
                eprintln!("Warning: Session {} appears hung (no activity for 30s), using reduced cleanup timeout", session_id);
                Duration::from_secs(1)
            } else {
                Duration::from_secs(5)
            };
            let start = Instant::now();

            // Poll join with timeout (Rust doesn't have native join_timeout on JoinHandle)
            loop {
                if handle.is_finished() {
                    // Thread finished - consume handle and clean up
                    let _ = handle.join();
                    break;
                }
                if start.elapsed() > timeout {
                    // Thread didn't finish in time - add to abandoned registry for later cleanup
                    if is_potentially_hung {
                        eprintln!("Info: Hung session {} cleanup timed out as expected - inner reader thread may still be blocked", session_id);
                    } else {
                        eprintln!("Warning: Reader thread for session {} did not exit within timeout", session_id);
                    }

                    // Move handle to abandoned threads registry
                    if let Ok(mut abandoned) = registry.abandoned_threads.lock() {
                        abandoned.push((session_id.clone(), handle, Instant::now()));
                        eprintln!("Added abandoned thread for session {} to cleanup registry ({} total abandoned)", session_id, abandoned.len());
                    }
                    break;
                }
                std::thread::sleep(Duration::from_millis(100));
            }
        }
    }

    // Remove from active_sessions table
    let conn = db.conn.lock()
        .expect("Database lock poisoned");
    conn.execute("DELETE FROM active_sessions WHERE id = ?1", [&session_id])
        .map_err(|e| format!("Failed to remove session from database: {}", e))?;

    Ok(())
}

// Helper function: Build SSH command arguments from profile
fn build_ssh_args(profile: &Profile) -> Result<Vec<String>, String> {
    let mut ssh_args: Vec<String> = vec![];

    // Add port if not default
    if profile.port != 22 {
        ssh_args.push("-p".to_string());
        ssh_args.push(profile.port.to_string());
    }

    // Add host key verification (MITM protection)
    ssh_args.push("-o".to_string());
    ssh_args.push("StrictHostKeyChecking=ask".to_string());

    // For password auth, limit SSH to exactly one password attempt.
    // Without this, SSH retries up to NumberOfPasswordPrompts times (default 3),
    // invoking the askpass helper repeatedly even after a wrong password.
    if profile.auth_method == "password" || profile.auth_method == "central_password" {
        ssh_args.push("-o".to_string());
        ssh_args.push("NumberOfPasswordPrompts=1".to_string());
    }

    // Add key path if specified and validated
    if profile.auth_method == "key" {
        if let Some(key_path) = &profile.key_path {
            if !key_path.is_empty() {
                let validated_path = validate_key_path(key_path)?;
                ssh_args.push("-i".to_string());
                ssh_args.push(validated_path.to_string_lossy().to_string());
            }
        }
    }

    // Build connection string (already validated)
    let connection = format!("{}@{}", profile.username, profile.host);
    ssh_args.push(connection);

    Ok(ssh_args)
}

// Helper function: Shell escape for bash/sh contexts
#[cfg(target_os = "macos")]
fn shell_escape(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

// Helper function: AppleScript escape
#[cfg(target_os = "macos")]
fn applescript_escape(s: &str) -> String {
    s.replace('\\', "\\\\")
     .replace('"', "\\\"")
     .replace('\n', "\\n")
     .replace('\r', "\\r")
     .replace('$', "\\$")
     .replace('`', "\\`")
}

// Helper function: Escape strings for bash double-quote context
#[cfg(target_os = "macos")]
fn escape_bash_double_quote(s: &str) -> String {
    s.replace('\\', "\\\\")
     .replace('"', "\\\"")
     .replace('$', "\\$")
     .replace('`', "\\`")
}

// Holds the paths of temporary askpass files created for password-auth connections
struct AskpassSetup {
    askpass_script_path: std::path::PathBuf,
    pwd_file_path: std::path::PathBuf,
    // Written by the terminal script on SSH non-zero exit; monitored to emit in-app failure toast
    status_file_path: std::path::PathBuf,
}

// Creates a temporary password file and askpass script for SSH_ASKPASS mechanism.
// The password file is written with restricted permissions (0600 on Unix).
// The askpass script simply cats the password file to stdout when invoked by SSH.
fn create_askpass_setup(password: &str) -> Result<AskpassSetup, String> {
    let temp_dir = std::env::temp_dir();
    let uuid = Uuid::new_v4();

    // Write password to temp file with restricted permissions.
    // On Unix, the file is created atomically with mode 0o600 (no intermediate world-readable
    // state). On Windows, icacls restricts access after creation; failure is treated as an error
    // and the file is removed to avoid leaving it with default permissions.
    let pwd_file_path = temp_dir.join(format!("spm-pwd-{}", uuid));
    // Path only — file is created by the terminal launch script on SSH auth failure.
    // Its presence is the failure signal monitored by the background polling thread.
    let status_file_path = temp_dir.join(format!("spm-status-{}", uuid));

    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&pwd_file_path)
            .map_err(|e| format!("Failed to create temporary password file: {}", e))?;
        file.write_all(password.as_bytes())
            .map_err(|e| format!("Failed to write password file: {}", e))?;
    }

    #[cfg(windows)]
    {
        use std::fs;
        use std::process::Command;
        fs::write(&pwd_file_path, password)
            .map_err(|e| format!("Failed to create temporary password file: {}", e))?;
        // Restrict file to current user only via icacls
        let path_str = pwd_file_path.to_string_lossy().to_string();
        let username = std::env::var("USERNAME").map_err(|_| {
            let _ = fs::remove_file(&pwd_file_path);
            "Failed to get current username for file permission setup".to_string()
        })?;
        if username.is_empty() {
            let _ = fs::remove_file(&pwd_file_path);
            return Err("Failed to get current username for file permission setup".to_string());
        }
        // Remove inherited permissions, then grant current user full control only
        let status = Command::new("icacls")
            .args([&path_str, "/inheritance:r", "/grant:r", &format!("{}:F", username)])
            .output()
            .map_err(|e| {
                let _ = fs::remove_file(&pwd_file_path);
                format!("Failed to run icacls: {}", e)
            })?;
        if !status.status.success() {
            let _ = fs::remove_file(&pwd_file_path);
            return Err("Failed to restrict password file permissions (icacls failed)".to_string());
        }
    }

    // Write platform-specific askpass script atomically with restricted permissions
    #[cfg(unix)]
    let askpass_script_path = {
        use std::os::unix::fs::OpenOptionsExt;
        use std::io::Write;
        let script_path = temp_dir.join(format!("spm-askpass-{}.sh", uuid));
        let pwd_path_escaped = shell_escape(&pwd_file_path.to_string_lossy());
        // State machine — mirrors spm-askpass.exe behaviour on Windows:
        //
        //   Password file EXISTS (first invocation):
        //     Deliver the stored password and delete the file.
        //
        //   File GONE + non-password prompt (proxy follow-up challenges):
        //     Relay the prompt to /dev/tty so the user can type a response
        //     (reason for access, MFA token, etc.).
        //
        //   File GONE + password/passphrase prompt (wrong-password retry):
        //     Exit non-zero immediately — fail fast rather than re-submitting
        //     the stored password or leaving the user with an interactive prompt.
        //
        // SSH_ASKPASS_REQUIRE=force + NumberOfPasswordPrompts=1 ensure this
        // script is always called for auth prompts and SSH retries only once.
        let script_content = format!(
            "#!/bin/sh\n\
             if [ -f {0} ]; then\n\
             \tpassword=$(cat {0})\n\
             \trm -f {0}\n\
             \tprintf '%s' \"$password\"\n\
             else\n\
             \tPROMPT=\"$1\"\n\
             \tcase \"$(printf '%s' \"$PROMPT\" | tr '[:upper:]' '[:lower:]')\" in\n\
             \t\t*password*|*passphrase*)\n\
             \t\t\tprintf 'spm-askpass: stored password rejected; aborting\\n' >&2\n\
             \t\t\texit 1\n\
             \t\t\t;;\n\
             \t\t*)\n\
             \t\t\tprintf '%s' \"$PROMPT\" > /dev/tty\n\
             \t\t\tread -r SPM_INPUT < /dev/tty\n\
             \t\t\tprintf '%s' \"$SPM_INPUT\"\n\
             \t\t\t;;\n\
             \tesac\n\
             fi\n",
            pwd_path_escaped
        );
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o700)
            .open(&script_path)
            .map_err(|e| format!("Failed to create askpass script: {}", e))?;
        file.write_all(script_content.as_bytes())
            .map_err(|e| format!("Failed to write askpass script: {}", e))?;
        script_path
    };

    // On Windows, SSH cannot CreateProcess a .bat file (returns ERROR_ACCESS_DENIED).
    // Use the bundled spm-askpass.exe helper instead — a real executable that SSH can invoke.
    // It reads SPM_PASSWORD_FILE (set in the terminal launch command) and writes the
    // password to stdout for SSH to consume.
    #[cfg(windows)]
    let askpass_script_path = {
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to find application path: {}", e))?;
        let exe_dir = exe_path.parent()
            .ok_or_else(|| "Failed to determine application directory".to_string())?;
        let helper = exe_dir.join("spm-askpass.exe");
        if !helper.exists() {
            return Err(
                "SSH password helper (spm-askpass.exe) not found alongside the application. \
                The application may need to be reinstalled.".to_string()
            );
        }
        helper
    };

    Ok(AskpassSetup { askpass_script_path, pwd_file_path, status_file_path })
}

// Spawns a background thread to securely delete askpass temp files after a delay.
// spm-askpass.exe deletes the password file itself after first use, so this cleanup
// is a safety net for the case where the connection fails before SSH ever invokes
// the askpass helper (e.g. host unreachable). 30s is ample for that scenario.
fn schedule_askpass_cleanup(setup: AskpassSetup) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(30));
        delete_file_with_overwrite(&setup.pwd_file_path);
        delete_file_with_overwrite(&setup.status_file_path);
        // On Unix, askpass_script_path is a temp .sh script — delete it.
        // On Windows, askpass_script_path is the bundled spm-askpass.exe — do NOT delete it.
        #[cfg(unix)]
        delete_file_with_overwrite(&setup.askpass_script_path);
    });
}

#[cfg(target_os = "macos")]
fn launch_macos_custom_terminal(
    custom_path: &str,
    ssh_args: &[String],
    profile_name: &str,
    askpass_setup: Option<&AskpassSetup>,
) -> Result<(), String> {
    use std::process::Command;
    use std::fs;

    // Re-validate path immediately before use (TOCTOU protection)
    let validated_path = validate_terminal_path(custom_path)?;

    // Create temporary script
    let temp_dir = std::env::temp_dir();
    let script_path = temp_dir.join(format!("ssh-profile-{}.sh", Uuid::new_v4()));

    let ssh_args_escaped = ssh_args.iter()
        .map(|arg| shell_escape(arg))
        .collect::<Vec<_>>()
        .join(" ");

    let script_content = if let Some(setup) = askpass_setup {
        let status_path_escaped = shell_escape(&setup.status_file_path.to_string_lossy());
        format!(
            "#!/bin/bash\n\
             echo \"Connecting to {}...\"\n\
             export SSH_ASKPASS={}\n\
             export SSH_ASKPASS_REQUIRE=force\n\
             ssh {}\n\
             SPMCODE=$?\n\
             if [ \"$SPMCODE\" = \"0\" ]; then printf OK > {}; else printf FAIL > {}; fi\n\
             echo \"\"\n\
             echo \"Connection closed. Press any key to exit or type 'exit'...\"\n\
             exec bash\n",
            escape_bash_double_quote(profile_name),
            shell_escape(&setup.askpass_script_path.to_string_lossy()),
            ssh_args_escaped,
            status_path_escaped,
            status_path_escaped
        )
    } else {
        format!(
            "#!/bin/bash\n\
             echo \"Connecting to {}...\"\n\
             ssh {}\n\
             echo \"\"\n\
             echo \"Connection closed. Press any key to exit or type 'exit'...\"\n\
             exec bash\n",
            escape_bash_double_quote(profile_name),
            ssh_args_escaped
        )
    };

    // Write and make executable
    fs::write(&script_path, script_content)
        .map_err(|e| format!("Failed to create temporary script: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&script_path)
            .map_err(|e| format!("Failed to get script permissions: {}", e))?
            .permissions();
        perms.set_mode(0o700);
        fs::set_permissions(&script_path, perms)
            .map_err(|e| format!("Failed to set script permissions: {}", e))?;
    }

    // Launch terminal
    Command::new("open")
        .arg("-n")
        .arg("-a")
        .arg(&validated_path)
        .arg(&script_path)
        .spawn()
        .map_err(|e| format!("Failed to launch custom terminal: {}", e))?;

    // Schedule secure cleanup
    let script_path_cleanup = script_path.clone();
    std::thread::spawn(move || {
        // Wait longer to ensure terminal has read the script
        std::thread::sleep(std::time::Duration::from_secs(5));
        delete_file_with_overwrite(&script_path_cleanup);
    });

    Ok(())
}

/// Deletes a file after overwriting with random data (single pass)
/// Note: Not cryptographically secure deletion (DoD 5220.22-M requires 3+ passes)
fn delete_file_with_overwrite(path: &std::path::Path) {
    use std::io::Write;

    // Get file size
    let file_size = match fs::metadata(path) {
        Ok(metadata) => metadata.len() as usize,
        Err(_) => {
            // File might already be gone, which is fine
            return;
        }
    };

    // Overwrite with random data
    if let Ok(mut file) = fs::OpenOptions::new().write(true).open(path) {
        let random_data: Vec<u8> = (0..file_size).map(|_| rand::random::<u8>()).collect();
        let _ = file.write_all(&random_data);
        let _ = file.sync_all();
    }

    // Remove the file
    let _ = fs::remove_file(path);
}

#[cfg(target_os = "macos")]
fn launch_macos_default_terminal(
    ssh_args: &[String],
    use_tabs: bool,
    askpass_setup: Option<&AskpassSetup>,
) -> Result<(), String> {
    use std::process::Command;

    let escaped_args: Vec<String> = ssh_args.iter()
        .map(|arg| shell_escape(arg))
        .collect();

    // Build command with auto-close; prefix env vars inline for password auth
    let ssh_cmd_no_exit = if let Some(setup) = askpass_setup {
        format!(
            "SSH_ASKPASS={} SSH_ASKPASS_REQUIRE=force ssh {}",
            shell_escape(&setup.askpass_script_path.to_string_lossy()),
            escaped_args.join(" ")
        )
    } else {
        format!("ssh {}", escaped_args.join(" "))
    };
    let close_command = "osascript -e 'tell application \"System Events\" to keystroke \"w\" using command down'";
    // For password auth, write OK/FAIL to the status file immediately after SSH exits.
    // The background polling thread reads this to emit an in-app toast on auth failure.
    // Use && / || rather than $? so we avoid shell variable expansion — applescript_escape()
    // would mangle any $ characters in the string before it reaches the shell.
    let ssh_with_close = if let Some(setup) = askpass_setup {
        let status_path_escaped = shell_escape(&setup.status_file_path.to_string_lossy());
        format!(
            "{} && printf OK > {} || printf FAIL > {} ; {}",
            ssh_cmd_no_exit, status_path_escaped, status_path_escaped, close_command
        )
    } else {
        format!("{} ; {}", ssh_cmd_no_exit, close_command)
    };
    let ssh_with_close_escaped = applescript_escape(&ssh_with_close);

    let applescript = if use_tabs {
        format!(
            "tell application \"Terminal\"\n\
             activate\n\
             if (count of windows) > 0 then\n\
                 tell application \"System Events\" to keystroke \"t\" using command down\n\
                 delay 0.3\n\
                 do script \"{}\" in front window\n\
             else\n\
                 do script \"{}\"\n\
             end if\n\
             end tell",
            ssh_with_close_escaped, ssh_with_close_escaped
        )
    } else {
        format!(
            "tell application \"Terminal\"\n\
             do script \"{}\"\n\
             activate\n\
             end tell",
            ssh_with_close_escaped
        )
    };

    let output = Command::new("osascript")
        .arg("-e")
        .arg(applescript)
        .output()
        .map_err(|e| format!("Failed to launch terminal: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Check for macOS Accessibility/TCC permission errors (System Events blocked)
        if use_tabs && (stderr.contains("Not authorized") || stderr.contains("-1743")) {
            return Err(
                "Could not open new tab — macOS may have blocked Terminal automation. \
                 Go to System Settings → Privacy & Security → Accessibility \
                 and toggle SSH Profile Manager off and on to restore access."
                    .to_string(),
            );
        }
        return Err("Failed to launch terminal — please check your terminal settings.".to_string());
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn launch_windows_cmd(ssh_args: &[String], askpass_setup: Option<&AskpassSetup>) -> Result<(), String> {
    use std::process::Command;

    if let Some(setup) = askpass_setup {
        // Use a temp bat file for env var injection.
        // The inline `set "VAR=val"& ssh ...` compound command approach fails because
        // the inner quotes in `set "VAR=val"` get mangled as they pass through the
        // Rust→cmd→start→cmd subprocess chain (three layers of quoting interpretation),
        // leaving SSH_ASKPASS unset.  A bat file sidesteps all quoting layers entirely.
        let temp_dir = std::env::temp_dir();
        let script_path = temp_dir.join(format!("ssh-profile-{}.bat", Uuid::new_v4()));
        let askpass_path = setup.askpass_script_path.to_string_lossy();
        let pwd_path = setup.pwd_file_path.to_string_lossy();
        let status_path = setup.status_file_path.to_string_lossy();
        // Save ERRORLEVEL to SSHCODE immediately after ssh exits, before any other
        // command can reset it. Then write the outcome to SPM_STATUS_FILE.
        let script_content = format!(
            "@echo off\r\n\
             set \"SPM_PASSWORD_FILE={}\"\r\n\
             set \"SSH_ASKPASS={}\"\r\n\
             set \"SSH_ASKPASS_REQUIRE=force\"\r\n\
             set \"SPM_STATUS_FILE={}\"\r\n\
             ssh {}\r\n\
             set \"SSHCODE=%ERRORLEVEL%\"\r\n\
             if \"%SSHCODE%\"==\"0\" (echo OK>\"%SPM_STATUS_FILE%\") else (echo FAIL>\"%SPM_STATUS_FILE%\")\r\n",
            pwd_path, askpass_path, status_path, ssh_args.join(" ")
        );
        create_file_windows_secure(&script_path, &script_content)?;

        Command::new("cmd")
            .arg("/c")
            .arg("start")
            .arg("cmd")
            .arg("/c")
            .arg(&script_path)
            .spawn()
            .map_err(|e| format!("Failed to launch Command Prompt: {}", e))?;

        let script_path_cleanup = script_path.clone();
        std::thread::spawn(move || {
            // Plain remove (not overwrite) — bat files contain no sensitive data.
            // Must outlive the SSH session: cmd.exe re-reads the file after SSH exits
            // to execute the remaining lines (SSHCODE capture + FAIL/OK write).
            // 90s exceeds the 60s monitor window with margin.
            std::thread::sleep(std::time::Duration::from_secs(90));
            let _ = std::fs::remove_file(&script_path_cleanup);
        });
    } else {
        // Build SSH command with explicit exit to ensure auto-close
        let mut full_command = vec!["ssh".to_string()];
        full_command.extend(ssh_args.iter().cloned());
        full_command.push("&".to_string());
        full_command.push("exit".to_string());

        Command::new("cmd")
            .arg("/c")
            .arg("start")
            .arg("cmd")
            .arg("/c")
            .args(&full_command)
            .spawn()
            .map_err(|e| format!("Failed to launch Command Prompt: {}", e))?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn launch_windows_powershell(ssh_args: &[String], askpass_setup: Option<&AskpassSetup>) -> Result<(), String> {
    use std::process::Command;

    // SECURITY: Use Base64-encoded command to avoid complex shell escaping issues
    // when passing through cmd /c start powershell (three different shell contexts).
    // This is more secure than trying to escape for cmd, start, and PowerShell simultaneously.

    let mut ps_args = vec!["ssh".to_string()];
    ps_args.extend(ssh_args.iter().cloned());

    // Build PowerShell command with proper array syntax to avoid injection
    let args_quoted: Vec<String> = ps_args.iter()
        .map(|arg| {
            // Escape single quotes in PowerShell by doubling them
            format!("'{}'", arg.replace('\'', "''"))
        })
        .collect();

    // Create PowerShell command; prepend env var assignments for password auth
    let ps_command = if let Some(setup) = askpass_setup {
        let askpass_path = setup.askpass_script_path.to_string_lossy();
        let askpass_path_escaped = askpass_path.replace('\'', "''");
        let pwd_path = setup.pwd_file_path.to_string_lossy();
        let pwd_path_escaped = pwd_path.replace('\'', "''");
        let status_path = setup.status_file_path.to_string_lossy();
        let status_path_escaped = status_path.replace('\'', "''");
        format!(
            "$env:SPM_PASSWORD_FILE = '{}'; $env:SSH_ASKPASS = '{}'; $env:SSH_ASKPASS_REQUIRE = 'force'; $env:SPM_STATUS_FILE = '{}'; & {}; if ($LASTEXITCODE -ne 0) {{ [System.IO.File]::WriteAllText($env:SPM_STATUS_FILE, 'FAIL') }} else {{ [System.IO.File]::WriteAllText($env:SPM_STATUS_FILE, 'OK') }}; exit",
            pwd_path_escaped,
            askpass_path_escaped,
            status_path_escaped,
            args_quoted.join(" ")
        )
    } else {
        format!("& {}; exit", args_quoted.join(" "))
    };

    // Convert to UTF-16LE and Base64 encode (required by PowerShell -EncodedCommand)
    let utf16_bytes: Vec<u16> = ps_command.encode_utf16().collect();
    let bytes: Vec<u8> = utf16_bytes.iter()
        .flat_map(|&w| vec![(w & 0xFF) as u8, (w >> 8) as u8])
        .collect();

    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let encoded = STANDARD.encode(&bytes);

    Command::new("cmd")
        .arg("/c")
        .arg("start")
        .arg("powershell")
        .arg("-EncodedCommand")
        .arg(&encoded)
        .spawn()
        .map_err(|e| format!("Failed to launch PowerShell: {}", e))?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn launch_windows_terminal(
    ssh_args: &[String],
    profile_name: &str,
    use_tabs: bool,
    askpass_setup: Option<&AskpassSetup>,
) -> Result<(), String> {
    use std::process::Command;

    if let Some(setup) = askpass_setup {
        // Cannot inject env vars via wt command-line args — use a temp .bat script.
        // SSH_ASKPASS points to spm-askpass.exe (a real exe, not a .bat).
        // SPM_PASSWORD_FILE tells the helper where to read the password from.
        let temp_dir = std::env::temp_dir();
        let script_path = temp_dir.join(format!("ssh-profile-{}.bat", Uuid::new_v4()));
        let askpass_path = setup.askpass_script_path.to_string_lossy();
        let pwd_path = setup.pwd_file_path.to_string_lossy();
        let status_path = setup.status_file_path.to_string_lossy();
        // Save ERRORLEVEL to SSHCODE immediately after ssh exits, before any other
        // command can reset it. Then write the outcome to SPM_STATUS_FILE.
        let script_content = format!(
            "@echo off\r\nset \"SPM_PASSWORD_FILE={}\"\r\nset \"SSH_ASKPASS={}\"\r\nset \"SSH_ASKPASS_REQUIRE=force\"\r\nset \"SPM_STATUS_FILE={}\"\r\nssh {}\r\nset \"SSHCODE=%ERRORLEVEL%\"\r\nif \"%SSHCODE%\"==\"0\" (echo OK>\"%SPM_STATUS_FILE%\") else (echo FAIL>\"%SPM_STATUS_FILE%\")\r\n",
            pwd_path,
            askpass_path,
            status_path,
            ssh_args.join(" ")
        );
        create_file_windows_secure(&script_path, &script_content)?;

        let mut cmd = Command::new("wt");
        if use_tabs { cmd.arg("-w").arg("last").arg("nt"); } else { cmd.arg("-w").arg("new"); }
        cmd.arg("--title")
            .arg(profile_name)
            .arg("cmd")
            .arg("/c")
            .arg(&script_path)
            .spawn()
            .map_err(|_| "Windows Terminal (wt.exe) not found. Please install Windows Terminal or select a different terminal.".to_string())?;

        let script_path_cleanup = script_path.clone();
        std::thread::spawn(move || {
            // Must outlive the SSH session: cmd.exe re-reads the file after SSH exits
            // to execute the remaining lines (SSHCODE capture + FAIL/OK write).
            // 90s exceeds the 60s monitor window with margin.
            std::thread::sleep(std::time::Duration::from_secs(90));
            let _ = std::fs::remove_file(&script_path_cleanup);
        });
    } else {
        let mut cmd = Command::new("wt");
        if use_tabs { cmd.arg("-w").arg("last").arg("nt"); } else { cmd.arg("-w").arg("new"); }
        cmd.arg("--title")
            .arg(profile_name)
            .arg("ssh")
            .args(ssh_args)
            .spawn()
            .map_err(|_| "Windows Terminal (wt.exe) not found. Please install Windows Terminal or select a different terminal.".to_string())?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn launch_windows_custom_terminal(
    custom_path: &str,
    ssh_args: &[String],
    profile_name: &str,
    askpass_setup: Option<&AskpassSetup>,
) -> Result<(), String> {
    use std::process::Command;

    // Re-validate path (TOCTOU protection)
    let validated_path = validate_terminal_path(custom_path)?;

    // Helper functions for batch escaping
    fn escape_batch_echo(s: &str) -> String {
        s.replace('^', "^^")
         .replace('&', "^&")
         .replace('|', "^|")
         .replace('<', "^<")
         .replace('>', "^>")
         .replace('%', "%%")
         .replace('!', "^!")
    }

    fn escape_batch_arg(s: &str) -> String {
        format!("\"{}\"", s.replace('"', "\"\""))
    }

    // Create temporary script
    let temp_dir = std::env::temp_dir();
    let script_path = temp_dir.join(format!("ssh-profile-{}.bat", Uuid::new_v4()));

    let ssh_args_str = ssh_args.iter()
        .map(|arg| escape_batch_arg(arg))
        .collect::<Vec<_>>()
        .join(" ");

    let script_content = if let Some(setup) = askpass_setup {
        let askpass_path = setup.askpass_script_path.to_string_lossy();
        let pwd_path = setup.pwd_file_path.to_string_lossy();
        let status_path = setup.status_file_path.to_string_lossy();
        format!(
            "@echo off\r\n\
             set \"SPM_PASSWORD_FILE={}\"\r\n\
             set \"SSH_ASKPASS={}\"\r\n\
             set \"SSH_ASKPASS_REQUIRE=force\"\r\n\
             set \"SPM_STATUS_FILE={}\"\r\n\
             echo Connecting to {}...\r\n\
             ssh {}\r\n\
             set \"SSHCODE=%ERRORLEVEL%\"\r\n\
             if \"%SSHCODE%\"==\"0\" (\r\n\
             echo OK>\"%SPM_STATUS_FILE%\"\r\n\
             echo.\r\n\
             echo Connection closed.\r\n\
             ) else (\r\n\
             echo FAIL>\"%SPM_STATUS_FILE%\"\r\n\
             echo.\r\n\
             echo Connection failed. Press any key to close...\r\n\
             pause >nul\r\n\
             )\r\n",
            pwd_path,
            askpass_path,
            status_path,
            escape_batch_echo(profile_name),
            ssh_args_str
        )
    } else {
        format!(
            "@echo off\r\n\
             echo Connecting to {}...\r\n\
             ssh {}\r\n\
             if errorlevel 1 (\r\n\
             echo.\r\n\
             echo Connection failed. Press any key to close...\r\n\
             pause >nul\r\n\
             ) else (\r\n\
             echo.\r\n\
             echo Connection closed.\r\n\
             )\r\n",
            escape_batch_echo(profile_name),
            ssh_args_str
        )
    };

    // Create file with restrictive permissions atomically (TOCTOU protection)
    create_file_windows_secure(&script_path, &script_content)?;

    // Launch terminal
    Command::new("cmd")
        .arg("/c")
        .arg("start")
        .arg("")
        .arg(&validated_path)
        .arg(&script_path)
        .spawn()
        .map_err(|e| format!("Failed to launch custom terminal: {}", e))?;

    let script_path_cleanup = script_path.clone();
    std::thread::spawn(move || {
        // Must outlive the SSH session: cmd.exe re-reads the file after SSH exits
        // to execute the remaining lines (SSHCODE capture + FAIL/OK write).
        // 90s exceeds the 60s monitor window with margin.
        std::thread::sleep(std::time::Duration::from_secs(90));
        let _ = std::fs::remove_file(&script_path_cleanup);
    });

    Ok(())
}

#[tauri::command]
fn connect_ssh(
    db: State<Database>,
    profile_id: String,
    terminal_preference: Option<String>,
    custom_terminal_path: Option<String>,
    use_tabs_in_terminal: Option<bool>,
    minimize_on_launch: Option<bool>,
    app_handle: tauri::AppHandle
) -> Result<(), String> {
    // Load and validate profile
    let profile = db
        .get_profile_by_id(&profile_id)
        .map_err(|e| format!("Failed to get profile: {}", e))?
        .ok_or_else(|| "Profile not found".to_string())?;

    validate_hostname(&profile.host)?;
    validate_username(&profile.username)?;
    validate_port(profile.port as i64)?;

    // Build SSH arguments
    let ssh_args = build_ssh_args(&profile)?;

    // Retrieve password and create askpass temp files if this is a password-auth profile
    let askpass_setup = if profile.auth_method == "password" || profile.auth_method == "central_password" {
        let keychain_key = if profile.auth_method == "central_password" {
            match profile.central_password_id {
                Some(ref cp_id) => format!("central-{}", cp_id),
                None => return Err(
                    "This profile is set to use a central password but none is assigned. \
                     Edit the profile to select a central password.".to_string()
                ),
            }
        } else {
            profile_id.clone()
        };
        let mut password = get_password(&keychain_key).map_err(|_| {
            "No password stored for this profile. Edit the profile to set a password, \
             or switch to a different authentication method.".to_string()
        })?;
        if password.is_empty() {
            return Err(
                "No password stored for this profile. Edit the profile to set a password, \
                 or switch to a different authentication method.".to_string()
            );
        }
        let setup = create_askpass_setup(&password)?;
        password.zeroize();
        Some(setup)
    } else {
        None
    };

    // Get terminal preference (default to "default")
    let terminal_pref = terminal_preference.unwrap_or_else(|| "default".to_string());
    let use_tabs = use_tabs_in_terminal.unwrap_or(true);
    let should_minimize = minimize_on_launch.unwrap_or(true);

    // Launch terminal based on OS and preference
    #[cfg(target_os = "macos")]
    {
        match terminal_pref.as_str() {
            "custom" => {
                if let Some(custom_path) = custom_terminal_path {
                    launch_macos_custom_terminal(&custom_path, &ssh_args, &profile.name, askpass_setup.as_ref())?;
                } else {
                    return Err("Custom terminal selected but no path provided.".to_string());
                }
            }
            // "default" is the legacy value (migrated to "terminal" in v0.9.2); treat as Terminal.app
            "terminal" | "default" | _ => {
                launch_macos_default_terminal(&ssh_args, use_tabs, askpass_setup.as_ref())?;
            }
        }

        // Minimize app window if enabled
        if should_minimize {
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.minimize();
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        match terminal_pref.as_str() {
            "cmd" => launch_windows_cmd(&ssh_args, askpass_setup.as_ref())?,
            "powershell" => launch_windows_powershell(&ssh_args, askpass_setup.as_ref())?,
            "custom" => {
                if let Some(custom_path) = custom_terminal_path {
                    launch_windows_custom_terminal(&custom_path, &ssh_args, &profile.name, askpass_setup.as_ref())?;
                } else {
                    return Err("Custom terminal selected but no path provided.".to_string());
                }
            }
            // "default" is the legacy value (migrated to "windows_terminal" in v0.9.2); treat as WT
            "windows_terminal" | "default" | _ => launch_windows_terminal(&ssh_args, &profile.name, use_tabs, askpass_setup.as_ref())?,
        }

        // Minimize app window if enabled
        if should_minimize {
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.minimize();
            }
        }
    }

    // Poll for the status file written by the terminal script after SSH exits.
    // The monitoring thread runs for up to 60s; if the file appears, emit an in-app toast.
    // 60s covers slow proxy auth (2FA + typed reason) that may exceed 30s.
    // The thread stops early on OK (clean session close) or FAIL (auth failure).
    #[cfg(target_os = "macos")]
    if let Some(ref setup) = askpass_setup {
        let status_path = setup.status_file_path.clone();
        let app_handle_poll = app_handle.clone();
        let profile_name_poll = profile.name.clone();
        std::thread::spawn(move || {
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(60);
            loop {
                if std::time::Instant::now() >= deadline {
                    let _ = std::fs::remove_file(&status_path);
                    break;
                }
                if status_path.exists() {
                    let content = std::fs::read_to_string(&status_path).unwrap_or_default();
                    let _ = std::fs::remove_file(&status_path);
                    if content.trim() == "FAIL" {
                        if let Some(win) = app_handle_poll.get_webview_window("main") {
                            let _ = win.unminimize();
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                        let message = format!(
                            "SSH authentication failed — the stored password was rejected.\n\
                             Edit the profile '{}' to update the password.",
                            profile_name_poll
                        );
                        let _ = app_handle_poll.emit("ssh-connection-failed", message);
                    }
                    // Stop polling for both FAIL and OK
                    break;
                }
                std::thread::sleep(std::time::Duration::from_secs(2));
            }
        });
    }

    #[cfg(target_os = "windows")]
    if let Some(ref setup) = askpass_setup {
        let status_path = setup.status_file_path.clone();
        let app_handle_poll = app_handle.clone();
        let profile_name_poll = profile.name.clone();
        std::thread::spawn(move || {
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(60);
            loop {
                if std::time::Instant::now() >= deadline {
                    let _ = std::fs::remove_file(&status_path);
                    break;
                }
                if status_path.exists() {
                    let content = std::fs::read_to_string(&status_path).unwrap_or_default();
                    let _ = std::fs::remove_file(&status_path);
                    if content.trim() == "FAIL" {
                        if let Some(win) = app_handle_poll.get_webview_window("main") {
                            let _ = win.unminimize();
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                        let message = format!(
                            "SSH authentication failed — the stored password was rejected.\n\
                             Edit the profile '{}' to update the password.",
                            profile_name_poll
                        );
                        let _ = app_handle_poll.emit("ssh-connection-failed", message);
                    }
                    // Stop polling for both FAIL and OK
                    break;
                }
                std::thread::sleep(std::time::Duration::from_secs(2));
            }
        });
    }

    // Schedule secure cleanup of askpass temp files (30s safety-net delay)
    if let Some(setup) = askpass_setup {
        schedule_askpass_cleanup(setup);
    }

    // Record connection
    db.record_connection(&profile_id)
        .map_err(|e| format!("Failed to record recent connection: {}", e))?;

    Ok(())
}

/// Core migration logic (testable - accepts paths as parameters)
/// Returns Ok(true) if migration was performed, Ok(false) if not needed
#[cfg_attr(test, allow(dead_code))]
pub(crate) fn perform_bundle_migration(
    old_db_path: &PathBuf,
    new_db_path: &PathBuf,
    old_keychain_service: &str,
    new_keychain_service: &str,
) -> Result<bool, String> {
    // Check if migration is needed
    let old_exists = old_db_path.exists();
    let new_exists = new_db_path.exists();

    if !old_exists {
        // No old database to migrate
        return Ok(false);
    }

    if new_exists {
        // New database already exists, don't overwrite
        return Ok(false);
    }

    // Perform migration
    eprintln!("Migrating database from {:?} to {:?}", old_db_path, new_db_path);

    // Create new directory
    if let Some(parent) = new_db_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create new data directory: {}", e))?;
    }

    // Copy database file
    fs::copy(old_db_path, new_db_path)
        .map_err(|e| format!("Failed to copy database: {}", e))?;

    eprintln!("Database copied successfully");

    // Migrate keychain entries
    // First, we need to read all profile IDs from the database
    let conn = Connection::open(new_db_path)
        .map_err(|e| format!("Failed to open migrated database: {}", e))?;

    let mut stmt = conn.prepare("SELECT id FROM profiles WHERE auth_method = 'password'")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let profile_ids: Vec<String> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query profiles: {}", e))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| format!("Failed to collect profile IDs: {}", e))?;

    eprintln!("Found {} password-authenticated profiles to migrate", profile_ids.len());

    // Migrate each keychain entry
    let mut migrated_count = 0;
    for profile_id in profile_ids {
        // Try to read from old keychain
        let old_entry = keyring::Entry::new(old_keychain_service, &profile_id)
            .map_err(|e| format!("Failed to create old keychain entry: {}", e))?;

        if let Ok(password) = old_entry.get_password() {
            // Store in new keychain
            let new_entry = keyring::Entry::new(new_keychain_service, &profile_id)
                .map_err(|e| format!("Failed to create new keychain entry: {}", e))?;

            new_entry.set_password(&password)
                .map_err(|e| format!("Failed to store password in new keychain: {}", e))?;

            migrated_count += 1;
            eprintln!("Migrated keychain entry for profile: {}", profile_id);
        }
    }

    eprintln!("Migrated {} keychain entries", migrated_count);
    eprintln!("Migration completed successfully!");

    Ok(true)
}

/// Migrates data from old bundle identifier to new bundle identifier
/// Returns Ok(true) if migration was performed, Ok(false) if not needed
fn migrate_bundle_identifier() -> Result<bool, String> {
    let data_local_dir = dirs::data_local_dir()
        .ok_or("Failed to get data directory")?;

    let old_db_path = data_local_dir.join(OLD_BUNDLE_ID).join("profiles.db");
    let new_db_path = data_local_dir.join(NEW_BUNDLE_ID).join("profiles.db");

    perform_bundle_migration(
        &old_db_path,
        &new_db_path,
        OLD_KEYCHAIN_SERVICE,
        NEW_KEYCHAIN_SERVICE,
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Perform bundle identifier migration before database initialization
    let migration_performed = migrate_bundle_identifier()
        .expect("Failed to perform bundle identifier migration");

    // Get database path using new bundle identifier
    let data_dir = dirs::data_local_dir()
        .expect("Failed to get data directory")
        .join(NEW_BUNDLE_ID);

    std::fs::create_dir_all(&data_dir).expect("Failed to create data directory");
    let db_path = data_dir.join("profiles.db");

    // Initialize database
    let db = Database::new(db_path).expect("Failed to initialize database");

    // Initialize session registry
    let registry = SessionRegistry::new();

    tauri::Builder::default()
        .manage(db)
        .manage(registry)
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Emit migration success notification if migration was performed
            if migration_performed {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("migration-success", ());
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_profiles,
            create_profile,
            update_profile,
            delete_profile,
            get_profile_password,
            get_groups,
            create_group,
            update_group,
            delete_group,
            move_group,
            move_profile,
            reorder_profiles,
            reorder_groups,
            get_group_tree,
            export_profiles,
            import_profiles,
            export_profile,
            export_group,
            import_profile,
            import_group,
            save_profiles_to_file,
            browse_ssh_key,
            browse_terminal_app,
            validate_custom_terminal,
            check_for_updates,
            connect_ssh,
            export_settings,
            import_settings,
            get_recent_connections,
            record_connection,
            clear_recent_connections,
            remove_recent_connection,
            get_setting,
            save_setting,
            toggle_profile_favorite,
            set_profile_favorite,
            update_profile_icon,
            get_profile_metadata,
            get_tags,
            create_tag,
            delete_tag,
            get_tag_usage_counts,
            get_profile_tags,
            add_profile_tag,
            remove_profile_tag,
            set_profile_tags,
            get_central_passwords,
            create_central_password,
            update_central_password,
            update_central_password_value,
            get_central_password_value,
            delete_central_password,
            get_profiles_using_central_password,
            create_terminal_session,
            write_to_terminal,
            resize_terminal,
            close_terminal_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    // Test helper functions (shared across all test modules)
    mod helpers;
    
    // Test modules
    mod encryption;
    mod validation;
    mod profiles;
    mod groups;
    mod tags;
    mod connections;
    mod settings;
    mod migrations;
    mod integration;         // Phase 8C: Integration tests for multi-step workflows
    mod central_passwords;   // v0.9.0: Central passwords DB layer tests
}
