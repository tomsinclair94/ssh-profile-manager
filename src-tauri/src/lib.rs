use rusqlite::{Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use tauri::{Manager, State};
use uuid::Uuid;

// Constants
const FILE_DIALOG_TIMEOUT_SECS: u64 = 120; // 2 minutes timeout for file dialogs

// Profile structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub host: String,
    pub port: i32,
    pub username: String,
    pub auth_method: String, // "key", "password", or "none"
    pub key_path: Option<String>,
    pub group: Option<String>,
}

// Input validation functions
fn validate_hostname(host: &str) -> Result<(), String> {
    if host.is_empty() {
        return Err("Hostname cannot be empty".to_string());
    }
    if host.len() > 128 {
        return Err("Hostname too long (max 128 characters)".to_string());
    }
    // Check for dangerous characters that could break shell commands
    if host.chars().any(|c| matches!(c, ';' | '&' | '|' | '`' | '$' | '"' | '\'' | '\n' | '\r' | '\\' | '<' | '>')) {
        return Err("Hostname contains invalid characters".to_string());
    }
    // Basic hostname validation - alphanumeric, dots, hyphens only
    if !host.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-' || c == '_') {
        return Err("Hostname can only contain letters, numbers, dots, hyphens, and underscores".to_string());
    }
    Ok(())
}

fn validate_username(username: &str) -> Result<(), String> {
    if username.is_empty() {
        return Err("Username cannot be empty".to_string());
    }
    if username.len() > 32 {
        return Err("Username too long (max 32 characters)".to_string());
    }
    // Check for dangerous characters
    if username.chars().any(|c| matches!(c, ';' | '&' | '|' | '`' | '$' | '"' | '\'' | '\n' | '\r' | '\\' | '<' | '>' | ' ')) {
        return Err("Username contains invalid characters".to_string());
    }
    // Allow alphanumeric, underscore, hyphen, dot (common in usernames)
    if !username.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.') {
        return Err("Username can only contain letters, numbers, underscores, hyphens, and dots".to_string());
    }
    Ok(())
}

fn validate_profile_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Profile name cannot be empty".to_string());
    }
    if name.len() > 64 {
        return Err("Profile name too long (max 64 characters)".to_string());
    }
    // Allow alphanumeric, spaces, and specific special characters: - _ ( ) . [ ]
    if !name.chars().all(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_' | '(' | ')' | '.' | '[' | ']')) {
        return Err("Profile name contains invalid characters".to_string());
    }
    Ok(())
}

fn validate_port(port: i32) -> Result<u16, String> {
    // Validate port is within valid u16 range (1-65535)
    // Note: We accept i32 from frontend for compatibility, but validate range before casting
    if port < 1 || port > 65535 {
        return Err("Port must be between 1 and 65535".to_string());
    }

    // Safe to cast: we've verified port is in valid u16 range [1, 65535]
    debug_assert!(port >= 1 && port <= 65535, "Port validation failed");
    Ok(port as u16)
}

fn validate_ipv4(ip: &str) -> Result<(), String> {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() != 4 {
        return Err("Invalid IPv4 format".to_string());
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
        return Err("Hostname/IP cannot be empty".to_string());
    }

    // Check if it looks like an IPv4 address (contains only digits and dots)
    if host.chars().all(|c| c.is_numeric() || c == '.') {
        return validate_ipv4(host);
    }

    // Otherwise validate as hostname
    validate_hostname(host)
}

fn validate_description(desc: &str) -> Result<(), String> {
    if desc.len() > 128 {
        return Err("Description too long (max 128 characters)".to_string());
    }
    if desc.chars().any(|c| matches!(c, '<' | '>')) {
        return Err("Description cannot contain < or >".to_string());
    }
    Ok(())
}

fn validate_group(group: &str) -> Result<(), String> {
    if group.is_empty() {
        return Ok(()); // Group is optional
    }
    if group.len() > 32 {
        return Err("Group name too long (max 32 characters)".to_string());
    }
    // Same pattern as profile name but shorter
    if !group.chars().all(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_' | '(' | ')' | '.' | '[' | ']')) {
        return Err("Group name contains invalid characters".to_string());
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

    // Validate filtered_groups if present
    if let Some(filtered_groups) = &settings.filtered_groups {
        for group in filtered_groups {
            if group.is_empty() {
                return Err("Empty group name in filtered_groups".to_string());
            }
            validate_group(group)
                .map_err(|e| format!("Invalid filtered group: {}", e))?;
        }
    }

    // Validate collapsed_groups if present
    if let Some(collapsed_groups) = &settings.collapsed_groups {
        for group in collapsed_groups {
            if group.is_empty() {
                return Err("Empty group name in collapsed_groups".to_string());
            }
            validate_group(group)
                .map_err(|e| format!("Invalid collapsed group: {}", e))?;
        }
    }

    Ok(())
}

fn validate_settings_os_specific(settings_os: &SettingsOsSpecific) -> Result<(), String> {
    // Validate terminal_preference
    // Valid values for macOS: default, custom, embedded
    // Valid values for Windows: default, cmd, powershell, windows_terminal, custom, embedded
    let valid_prefs = ["default", "cmd", "powershell", "windows_terminal", "custom", "embedded"];
    if !valid_prefs.contains(&settings_os.terminal_preference.as_str()) {
        return Err(format!("Invalid terminal_preference value: {}", settings_os.terminal_preference));
    }

    Ok(())
}

fn validate_key_path(path: &str) -> Result<PathBuf, String> {
    if path.is_empty() {
        return Err("Key path cannot be empty".to_string());
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

    if !canonical.starts_with(&ssh_dir) && !canonical.starts_with(&home) {
        return Err("Key path must be within your home directory".to_string());
    }

    Ok(canonical)
}

// Database wrapper
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    fn new(path: PathBuf) -> SqlResult<Self> {
        let conn = Connection::open(path)?;

        // Create profiles table
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

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    fn get_all_profiles(&self) -> SqlResult<Vec<Profile>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, host, port, username, auth_method, key_path, group_name
             FROM profiles ORDER BY group_name, name"
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
                    group: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(profiles)
    }

    fn create_profile(&self, profile: &Profile) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO profiles (id, name, description, host, port, username, auth_method, key_path, group_name)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            (
                &profile.id,
                &profile.name,
                &profile.description,
                &profile.host,
                &profile.port,
                &profile.username,
                &profile.auth_method,
                &profile.key_path,
                &profile.group,
            ),
        )?;
        Ok(())
    }

    fn update_profile(&self, profile: &Profile) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE profiles
             SET name = ?2, description = ?3, host = ?4, port = ?5,
                 username = ?6, auth_method = ?7, key_path = ?8, group_name = ?9
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
                &profile.group,
            ),
        )?;
        Ok(())
    }

    fn delete_profile(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM profiles WHERE id = ?1", [id])?;
        Ok(())
    }

    fn get_profile_by_id(&self, id: &str) -> SqlResult<Option<Profile>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, host, port, username, auth_method, key_path, group_name
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
                group: row.get(8)?,
            })
        })?;

        if let Some(profile) = profiles.next() {
            Ok(Some(profile?))
        } else {
            Ok(None)
        }
    }
}

// Password storage using system keychain
fn store_password(profile_id: &str, password: &str) -> Result<(), String> {
    let entry = keyring::Entry::new("ssh-profile-manager", profile_id)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    entry
        .set_password(password)
        .map_err(|e| format!("Failed to store password: {}", e))?;
    Ok(())
}

fn get_password(profile_id: &str) -> Result<String, String> {
    let entry = keyring::Entry::new("ssh-profile-manager", profile_id)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    entry
        .get_password()
        .map_err(|e| format!("Failed to retrieve password: {}", e))
}

fn delete_password(profile_id: &str) -> Result<(), String> {
    let entry = keyring::Entry::new("ssh-profile-manager", profile_id)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    entry
        .delete_credential()
        .map_err(|e| format!("Failed to delete password: {}", e))?;
    Ok(())
}

// Export/Import structures
#[derive(Debug, Serialize, Deserialize)]
struct ProfileExport {
    #[serde(flatten)]
    profile: Profile,
    password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ExportData {
    version: String,
    exported_at: String,
    profiles: Vec<ProfileExport>,
}

#[derive(Debug, Deserialize)]
struct ImportData {
    profiles: Vec<ProfileExport>,
}

// Settings export/import structures
#[derive(Debug, Serialize, Deserialize)]
struct SettingsData {
    theme: String,
    auto_update_check: bool,
    window_width: i32,
    window_height: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    filtered_groups: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    collapsed_groups: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SettingsOsSpecific {
    terminal_preference: String,
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

// Tauri commands
#[tauri::command]
fn get_profiles(db: State<Database>) -> Result<Vec<Profile>, String> {
    db.get_all_profiles()
        .map_err(|e| format!("Failed to get profiles: {}", e))
}

#[derive(Deserialize)]
struct CreateProfileInput {
    name: String,
    description: Option<String>,
    host: String,
    port: Option<i32>,
    username: String,
    auth_method: String,
    key_path: Option<String>,
    password: Option<String>,
    group: Option<String>,
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

    // Validate group if provided
    if let Some(ref group) = profile.group {
        validate_group(group)?;
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

    let new_profile = Profile {
        id: id.clone(),
        name: profile.name,
        description: profile.description,
        host: profile.host,
        port,
        username: profile.username,
        auth_method: profile.auth_method.clone(),
        key_path: profile.key_path,
        group: profile.group,
    };

    db.create_profile(&new_profile)
        .map_err(|e| format!("Failed to create profile: {}", e))?;

    // Store password in keychain if provided
    if profile.auth_method == "password" {
        if let Some(password) = profile.password {
            if !password.is_empty() {
                store_password(&id, &password)?;
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
    port: Option<i32>,
    username: String,
    auth_method: String,
    key_path: Option<String>,
    password: Option<String>,
    group: Option<String>,
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

    // Validate group if provided
    if let Some(ref group) = profile.group {
        validate_group(group)?;
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

    let updated_profile = Profile {
        id: profile.id.clone(),
        name: profile.name,
        description: profile.description,
        host: profile.host,
        port,
        username: profile.username,
        auth_method: profile.auth_method.clone(),
        key_path: profile.key_path,
        group: profile.group,
    };

    db.update_profile(&updated_profile)
        .map_err(|e| format!("Failed to update profile: {}", e))?;

    // Update password in keychain if provided
    if profile.auth_method == "password" {
        if let Some(password) = profile.password {
            if !password.is_empty() {
                store_password(&profile.id, &password)?;
            }
        }
    } else {
        // Try to delete password from keychain if auth method changed (ignore errors if no password exists)
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

#[tauri::command]
fn export_profiles(db: State<Database>) -> Result<String, String> {
    let profiles = db.get_all_profiles()
        .map_err(|e| format!("Failed to get profiles: {}", e))?;

    let mut export_profiles = Vec::new();

    for profile in profiles {
        let password = if profile.auth_method == "password" {
            get_password(&profile.id).ok()
        } else {
            None
        };

        export_profiles.push(ProfileExport {
            profile,
            password,
        });
    }

    let export_data = ExportData {
        version: env!("CARGO_PKG_VERSION").to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        profiles: export_profiles,
    };

    serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize profiles: {}", e))
}

#[tauri::command]
fn import_profiles(db: State<Database>, data: String) -> Result<(), String> {
    let import_data: ImportData = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse import data: {}", e))?;

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

    // Now import the new profiles
    for profile_export in import_data.profiles {
        // Generate new ID for imported profile to avoid conflicts
        let new_id = Uuid::new_v4().to_string();

        let mut profile = profile_export.profile;
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
    }

    Ok(())
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
    filtered_groups: Option<Vec<String>>,
    collapsed_groups: Option<Vec<String>>,
    terminal_preference: String,
    include_profiles: bool,
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
        filtered_groups,
        collapsed_groups,
    };

    let settings_os_specific = SettingsOsSpecific {
        terminal_preference,
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
            let password = match &profile.auth_method as &str {
                "password" => get_password(&profile.id).ok(),
                _ => None,
            };

            profile_exports.push(ProfileExport {
                profile,
                password,
            });
        }

        Some(profile_exports)
    } else {
        None
    };

    let export_data = SettingsExport {
        version: env!("CARGO_PKG_VERSION").to_string(),
        os: current_os,
        exported_at: chrono::Utc::now().to_rfc3339(),
        settings: settings_data,
        settings_os_specific,
        profiles: profiles_data,
    };

    serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize settings: {}", e))
}

#[tauri::command]
fn import_settings(data: String) -> Result<SettingsImportResult, String> {
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
        return Err("Empty tag_name in release".to_string());
    }

    let latest_version = tag_name.trim_start_matches('v').to_string();

    // Ensure version string is not empty after trimming
    if latest_version.is_empty() {
        return Err("Invalid version format in tag_name".to_string());
    }

    // Validate download URL exists
    let download_url = release["html_url"]
        .as_str()
        .ok_or("No html_url in release")?
        .to_string();

    if download_url.is_empty() {
        return Err("Empty html_url in release".to_string());
    }

    // Use semantic versioning for proper version comparison
    use semver::Version;
    let current = Version::parse(CURRENT_VERSION)
        .map_err(|e| format!("Invalid current version: {}", e))?;
    let latest = Version::parse(&latest_version)
        .map_err(|e| format!("Invalid latest version '{}': {}", latest_version, e))?;

    // Update is available only if latest > current
    let update_available = latest > current;

    Ok(UpdateInfo {
        current_version: CURRENT_VERSION.to_string(),
        latest_version,
        update_available,
        download_url,
    })
}

#[tauri::command]
fn connect_ssh(
    db: State<Database>,
    profile_id: String,
    terminal_preference: Option<String>,
    custom_terminal_path: Option<String>,
    app_handle: tauri::AppHandle
) -> Result<(), String> {
    let profile = db
        .get_profile_by_id(&profile_id)
        .map_err(|e| format!("Failed to get profile: {}", e))?
        .ok_or_else(|| "Profile not found".to_string())?;

    // Validate inputs before connecting (defense in depth)
    validate_hostname(&profile.host)?;
    validate_username(&profile.username)?;
    validate_port(profile.port)?;

    // Build SSH command arguments safely
    let mut ssh_args: Vec<String> = vec![];

    // Add port if not default
    if profile.port != 22 {
        ssh_args.push("-p".to_string());
        ssh_args.push(profile.port.to_string());
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

    // Build connection string (already validated above)
    let connection = format!("{}@{}", profile.username, profile.host);
    ssh_args.push(connection);

    // Default to "default" if no preference specified
    let terminal_pref = terminal_preference.unwrap_or_else(|| "default".to_string());

    // Open in system terminal
    #[cfg(target_os = "macos")]
    {
        // Check for embedded terminal (not yet implemented)
        if terminal_pref == "embedded" {
            return Err("Embedded terminal is not yet available. Coming soon!".to_string());
        }

        // Properly escape the SSH command for shell
        // Each argument must be shell-escaped to prevent injection
        fn shell_escape(s: &str) -> String {
            // Replace single quotes with '\'' and wrap in single quotes
            format!("'{}'", s.replace('\'', "'\\''"))
        }

        // Properly escape strings for AppleScript
        fn applescript_escape(s: &str) -> String {
            s.replace('\\', "\\\\")
             .replace('"', "\\\"")
             .replace('\n', "\\n")
             .replace('\r', "\\r")
             .replace('\'', "\\'")
             .replace('$', "\\$")
             .replace('`', "\\`")
        }

        // Build the escaped SSH command
        let escaped_args: Vec<String> = ssh_args.iter()
            .map(|arg| shell_escape(arg))
            .collect();
        let ssh_cmd_str = format!("ssh {}", escaped_args.join(" "));

        match terminal_pref.as_str() {
            "custom" => {
                // Use custom terminal app
                if let Some(custom_path) = custom_terminal_path {
                    // Validate the custom terminal path
                    let path_buf = std::path::PathBuf::from(&custom_path);

                    // Check if file exists
                    if !path_buf.exists() {
                        return Err(format!("Terminal application not found: {}", custom_path));
                    }

                    // Ensure it's an .app bundle
                    if !custom_path.ends_with(".app") {
                        return Err("macOS terminal must be an .app bundle".to_string());
                    }

                    // Escape the SSH command for AppleScript
                    let applescript_escaped = applescript_escape(&ssh_cmd_str);

                    // Get app name from path and escape it for AppleScript
                    let app_name = path_buf
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .ok_or_else(|| "Invalid terminal application path".to_string())?;

                    let app_name_escaped = applescript_escape(app_name);

                    // First open the app
                    Command::new("open")
                        .arg("-a")
                        .arg(&custom_path)
                        .spawn()
                        .map_err(|e| format!("Failed to launch custom terminal: {}", e))?;

                    // Small delay to let the app open
                    std::thread::sleep(std::time::Duration::from_millis(500));

                    // Send the SSH command with properly escaped app name
                    Command::new("osascript")
                        .arg("-e")
                        .arg(format!("tell application \"{}\" to do script \"{}\"", app_name_escaped, applescript_escaped))
                        .arg("-e")
                        .arg(format!("tell application \"{}\" to activate", app_name_escaped))
                        .spawn()
                        .map_err(|e| format!("Failed to execute SSH command in custom terminal: {}", e))?;
                } else {
                    return Err("Custom terminal selected but no path provided".to_string());
                }
            },
            "default" | _ => {
                // Use default Terminal.app
                let applescript_escaped = applescript_escape(&ssh_cmd_str);

                Command::new("osascript")
                    .arg("-e")
                    .arg(format!("tell application \"Terminal\" to do script \"{}\"", applescript_escaped))
                    .arg("-e")
                    .arg("tell application \"Terminal\" to activate")
                    .spawn()
                    .map_err(|e| format!("Failed to launch terminal: {}", e))?;
            }
        }

        // Minimize the app window after launching terminal
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.minimize();
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Check for embedded terminal (not yet implemented)
        if terminal_pref == "embedded" {
            return Err("Embedded terminal is not yet available. Coming soon!".to_string());
        }

        match terminal_pref.as_str() {
            "cmd" => {
                // Use Command Prompt - pass args directly to avoid shell escaping issues
                Command::new("cmd")
                    .arg("/c")
                    .arg("start")
                    .arg("cmd")
                    .arg("/k")
                    .arg("ssh")
                    .args(&ssh_args)
                    .spawn()
                    .map_err(|e| format!("Failed to launch Command Prompt: {}", e))?;
            },
            "powershell" => {
                // Use PowerShell - pass args directly
                let mut ps_args = vec!["ssh".to_string()];
                ps_args.extend(ssh_args.clone());

                let ssh_command = ps_args.iter()
                    .map(|arg| {
                        // PowerShell escaping: wrap in single quotes and escape single quotes
                        if arg.contains(' ') || arg.contains('\'') {
                            format!("'{}'", arg.replace('\'', "''"))
                        } else {
                            arg.clone()
                        }
                    })
                    .collect::<Vec<String>>()
                    .join(" ");

                Command::new("cmd")
                    .arg("/c")
                    .arg("start")
                    .arg("powershell")
                    .arg("-NoExit")
                    .arg("-Command")
                    .arg(&ssh_command)
                    .spawn()
                    .map_err(|e| format!("Failed to launch PowerShell: {}", e))?;
            },
            "windows_terminal" => {
                // Use Windows Terminal (wt.exe) - pass args directly (safest method)
                match Command::new("wt")
                    .arg("new-tab")
                    .arg("--title")
                    .arg(&profile.name)
                    .arg("ssh")
                    .args(&ssh_args)
                    .spawn()
                {
                    Ok(_) => {},
                    Err(_) => {
                        // Windows Terminal not found
                        return Err("Windows Terminal (wt.exe) not found. Please install Windows Terminal or select a different terminal.".to_string());
                    }
                }
            },
            "custom" => {
                // Use custom terminal
                if let Some(custom_path) = custom_terminal_path {
                    // Validate the custom terminal path
                    let path_buf = std::path::PathBuf::from(&custom_path);

                    // Check if file exists
                    if !path_buf.exists() {
                        return Err(format!("Terminal application not found: {}", custom_path));
                    }

                    // Ensure it's an .exe file
                    if !custom_path.ends_with(".exe") {
                        return Err("Windows terminal must be an .exe file".to_string());
                    }

                    // Launch custom terminal with SSH command
                    // Note: Custom terminals may have different argument formats
                    // This attempts to use cmd.exe-style arguments, but may not work for all terminals
                    Command::new("cmd")
                        .arg("/c")
                        .arg("start")
                        .arg(&custom_path)
                        .arg("/k")
                        .arg("ssh")
                        .args(&ssh_args)
                        .spawn()
                        .map_err(|e| format!("Failed to launch custom terminal: {}", e))?;
                } else {
                    return Err("Custom terminal selected but no path provided".to_string());
                }
            },
            "default" | _ => {
                // Default: Try Windows Terminal first, fall back to cmd
                match Command::new("wt")
                    .arg("new-tab")
                    .arg("--title")
                    .arg(&profile.name)
                    .arg("ssh")
                    .args(&ssh_args)
                    .spawn()
                {
                    Ok(_) => {},
                    Err(_) => {
                        // Windows Terminal not found, fall back to cmd.exe
                        Command::new("cmd")
                            .arg("/c")
                            .arg("start")
                            .arg("cmd")
                            .arg("/k")
                            .arg("ssh")
                            .args(&ssh_args)
                            .spawn()
                            .map_err(|e| format!("Failed to launch terminal: {}", e))?;
                    }
                }
            }
        }

        // Minimize the app window after launching terminal
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.minimize();
        }
    }

    #[cfg(target_os = "linux")]
    {
        // For Linux, we can safely use shell_escape similar to macOS
        fn shell_escape(s: &str) -> String {
            format!("'{}'", s.replace('\'', "'\\''"))
        }

        let escaped_args: Vec<String> = ssh_args.iter()
            .map(|arg| shell_escape(arg))
            .collect();
        let ssh_cmd = format!("ssh {}", escaped_args.join(" "));

        // Try common terminal emulators
        let terminals = vec!["gnome-terminal", "konsole", "xterm"];
        let mut tried_terminals = Vec::new();

        for terminal in terminals {
            match Command::new(terminal)
                .arg("-e")
                .arg(&ssh_cmd)
                .spawn()
            {
                Ok(_) => {
                    // Minimize the app window after launching terminal
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.minimize();
                    }
                    return Ok(());
                }
                Err(e) => {
                    tried_terminals.push(format!("{} ({})", terminal, e));
                }
            }
        }

        return Err(format!(
            "No terminal emulator found. Tried: {}",
            tried_terminals.join(", ")
        ));
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Get database path
    let data_dir = dirs::data_local_dir()
        .expect("Failed to get data directory")
        .join("ssh-profile-manager");

    std::fs::create_dir_all(&data_dir).expect("Failed to create data directory");
    let db_path = data_dir.join("profiles.db");

    // Initialize database
    let db = Database::new(db_path).expect("Failed to initialize database");

    tauri::Builder::default()
        .manage(db)
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_profiles,
            create_profile,
            update_profile,
            delete_profile,
            export_profiles,
            import_profiles,
            save_profiles_to_file,
            browse_ssh_key,
            browse_terminal_app,
            check_for_updates,
            connect_ssh,
            export_settings,
            import_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
