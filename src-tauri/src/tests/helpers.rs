use rusqlite::Connection;
use std::sync::Mutex;

/// Helper: Create an in-memory SQLite database for isolated testing
pub fn create_test_db() -> crate::Database {
    let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
    conn.execute("PRAGMA foreign_keys = ON", []).expect("Failed to enable foreign keys");

    // Create schema_version table
    conn.execute(
        "CREATE TABLE schema_version (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        )",
        [],
    ).expect("Failed to create schema_version table");

    // Create profiles table (migration 0)
    conn.execute(
        "CREATE TABLE profiles (
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
    ).expect("Failed to create profiles table");

    // Apply all migrations
    crate::Database::apply_migrations(&conn).expect("Failed to apply migrations");

    crate::Database {
        conn: Mutex::new(conn),
    }
}

/// Helper: Create a test profile with minimal required fields
pub fn make_test_profile(name: &str, group_path: Option<&str>) -> crate::Profile {
    crate::Profile {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.to_string(),
        description: Some(format!("Test profile: {}", name)),
        host: "test.example.com".to_string(),
        port: 22,
        username: "testuser".to_string(),
        auth_method: "key".to_string(),
        key_path: Some("~/.ssh/id_rsa".to_string()),
        group_path: group_path.map(|s| s.to_string()),
        central_password_id: None,
    }
}

/// Helper: Create a test group with minimal required fields
pub fn make_test_group(name: &str, parent_id: Option<String>, path: &str) -> crate::Group {
    let now = chrono::Utc::now().to_rfc3339();
    crate::Group {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.to_string(),
        parent_id,
        path: path.to_string(),
        icon: None,
        is_favorite: false,
        display_order: 0,
        created_at: now.clone(),
        updated_at: now,
    }
}

/// Helper: Create a test tag
pub fn make_test_tag(name: &str, color: &str) -> crate::Tag {
    crate::Tag {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.to_string(),
        color: color.to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    }
}
