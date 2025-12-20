use rusqlite::{Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use tauri::{Manager, State};
use uuid::Uuid;

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
    let id = Uuid::new_v4().to_string();

    let new_profile = Profile {
        id: id.clone(),
        name: profile.name,
        description: profile.description,
        host: profile.host,
        port: profile.port.unwrap_or(22),
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
            store_password(&id, &password)?;
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
    let updated_profile = Profile {
        id: profile.id.clone(),
        name: profile.name,
        description: profile.description,
        host: profile.host,
        port: profile.port.unwrap_or(22),
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
        // Delete password from keychain if auth method changed
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
        version: "1.0".to_string(),
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

    // Show save dialog in a blocking context
    let result = spawn_blocking(move || {
        // Use rfd (native file dialog) which works well with Tauri
        let file_path = rfd::FileDialog::new()
            .set_file_name(&default_filename)
            .add_filter("JSON", &["json"])
            .save_file();

        file_path
    })
    .await
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
fn connect_ssh(db: State<Database>, profile_id: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let profile = db
        .get_profile_by_id(&profile_id)
        .map_err(|e| format!("Failed to get profile: {}", e))?
        .ok_or_else(|| "Profile not found".to_string())?;

    // Build SSH command
    let mut ssh_command = Command::new("ssh");

    // Add port if not default
    if profile.port != 22 {
        ssh_command.arg("-p").arg(profile.port.to_string());
    }

    // Add key path if specified
    if profile.auth_method == "key" {
        if let Some(key_path) = &profile.key_path {
            let expanded_path = shellexpand::tilde(key_path);
            ssh_command.arg("-i").arg(expanded_path.as_ref());
        }
    }

    // Build connection string
    let connection = format!("{}@{}", profile.username, profile.host);
    ssh_command.arg(connection);

    // Open in system terminal
    #[cfg(target_os = "macos")]
    {
        let ssh_cmd_str = format!("ssh {}",
            ssh_command.get_args()
                .map(|s| s.to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join(" ")
        );

        Command::new("osascript")
            .arg("-e")
            .arg(format!("tell application \"Terminal\" to do script \"{}\"", ssh_cmd_str))
            .arg("-e")
            .arg("tell application \"Terminal\" to activate")
            .spawn()
            .map_err(|e| format!("Failed to launch terminal: {}", e))?;

        // Hide the app window after launching terminal
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.hide();
        }
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .arg("/c")
            .arg("start")
            .arg("cmd")
            .arg("/k")
            .arg(&format!("ssh {}",
                ssh_command.get_args()
                    .map(|s| s.to_string_lossy().to_string())
                    .collect::<Vec<_>>()
                    .join(" ")
            ))
            .spawn()
            .map_err(|e| format!("Failed to launch terminal: {}", e))?;

        // Hide the app window after launching terminal
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.hide();
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Try common terminal emulators
        let terminals = vec!["gnome-terminal", "konsole", "xterm"];
        let ssh_cmd_str = format!("ssh {}",
            ssh_command.get_args()
                .map(|s| s.to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join(" ")
        );

        for terminal in terminals {
            if Command::new(terminal)
                .arg("-e")
                .arg(&ssh_cmd_str)
                .spawn()
                .is_ok()
            {
                // Hide the app window after launching terminal
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.hide();
                }
                return Ok(());
            }
        }

        return Err("No terminal emulator found".to_string());
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
            connect_ssh
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
