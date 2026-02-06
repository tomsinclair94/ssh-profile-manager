use super::helpers::*;
use rusqlite::Connection;

#[test]
fn test_migrations_create_required_tables() {
    let db = create_test_db();
    let conn = db.conn.lock().unwrap();

    // Check that all tables exist
    let tables: Vec<String> = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    assert!(tables.contains(&"profiles".to_string()));
    assert!(tables.contains(&"groups".to_string()));
    assert!(tables.contains(&"profile_metadata".to_string()));
    assert!(tables.contains(&"tags".to_string()));
    assert!(tables.contains(&"profile_tags".to_string()));
    assert!(tables.contains(&"recent_connections".to_string()));
    assert!(tables.contains(&"user_settings".to_string()));
    assert!(tables.contains(&"schema_version".to_string()));
}

#[test]
fn test_migrations_are_idempotent() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute("PRAGMA foreign_keys = ON", []).unwrap();

    conn.execute(
        "CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
        [],
    ).unwrap();

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
    ).unwrap();

    // Apply migrations twice
    crate::Database::apply_migrations(&conn).unwrap();
    let result = crate::Database::apply_migrations(&conn);

    // Should not error
    assert!(result.is_ok());
}

#[test]
fn test_schema_version_tracked() {
    let db = create_test_db();
    let conn = db.conn.lock().unwrap();

    let version: i32 = conn
        .query_row("SELECT MAX(version) FROM schema_version", [], |row| row.get(0))
        .unwrap();

    // Should have applied all migrations (currently 4)
    assert_eq!(version, 4);
}

#[test]
fn test_migration_creates_ungrouped_group() {
    use rusqlite::Connection;
    use std::sync::Mutex;

    // Create a fresh database and insert a profile BEFORE running migrations
    let conn = Connection::open_in_memory().unwrap();
    conn.execute("PRAGMA foreign_keys = ON", []).unwrap();

    // Create schema_version table
    conn.execute(
        "CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
        [],
    ).unwrap();

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
    ).unwrap();

    // Insert a profile without a group (group_name = NULL) BEFORE migration
    let profile_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO profiles (id, name, host, port, username, auth_method, group_name)
         VALUES (?1, 'Test', 'test.com', 22, 'user', 'key', NULL)",
        [&profile_id],
    ).unwrap();

    // Now run migrations (migration 4 will create Ungrouped group for NULL group_name)
    crate::Database::apply_migrations(&conn).unwrap();

    let db = crate::Database {
        conn: Mutex::new(conn),
    };

    let groups = db.get_all_groups().unwrap();

    // Migration should have created an "Ungrouped" group for the NULL group_name
    assert!(groups.iter().any(|g| g.name == "Ungrouped" && g.parent_id.is_none()));
}

#[test]
fn test_migration_backfills_profile_metadata() {
    use rusqlite::Connection;
    use std::sync::Mutex;

    // Create a fresh database and manually insert a profile BEFORE running migration 4
    let conn = Connection::open_in_memory().unwrap();
    conn.execute("PRAGMA foreign_keys = ON", []).unwrap();

    // Create schema_version table
    conn.execute(
        "CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
        [],
    ).unwrap();

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
    ).unwrap();

    // Insert a profile BEFORE migration 4
    let profile_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO profiles (id, name, host, port, username, auth_method, group_name)
         VALUES (?1, 'Test', 'test.com', 22, 'user', 'key', NULL)",
        [&profile_id],
    ).unwrap();

    // Now run migrations (including migration 4 which backfills metadata)
    crate::Database::apply_migrations(&conn).unwrap();

    let db = crate::Database {
        conn: Mutex::new(conn),
    };

    // Metadata should exist with defaults from migration 4
    let metadata = db.get_profile_metadata(&profile_id).unwrap();
    assert!(metadata.is_some());
    assert_eq!(metadata.unwrap().icon, Some("server".to_string()));
}
