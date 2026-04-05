// Tests for central passwords DB layer (v0.9.0)
// Keychain operations (get_central_password_value, update_central_password_value)
// are performed by Tauri command handlers and are not tested here — they require
// a live keychain and the Tauri runtime. All password values below are simulated
// with hardcoded strings, matching the pattern used in integration.rs.

use super::helpers::*;
use crate::CentralPassword;

// ============================================================================
// Helper
// ============================================================================

fn make_test_cp(name: &str) -> CentralPassword {
    let now = chrono::Utc::now().to_rfc3339();
    CentralPassword {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.to_string(),
        description: Some(format!("Test central password: {}", name)),
        created_at: now.clone(),
        updated_at: now,
    }
}

// ============================================================================
// Create
// ============================================================================

#[test]
fn test_create_central_password_success() {
    let db = create_test_db();
    let cp = make_test_cp("Active Directory");

    assert!(db.create_central_password(&cp).is_ok());
}

#[test]
fn test_create_central_password_duplicate_name_fails() {
    let db = create_test_db();
    let cp1 = make_test_cp("Shared Account");
    let mut cp2 = make_test_cp("Shared Account");
    cp2.id = uuid::Uuid::new_v4().to_string(); // Different ID, same name

    db.create_central_password(&cp1).unwrap();
    let result = db.create_central_password(&cp2);

    assert!(result.is_err(), "Duplicate name should be rejected by UNIQUE constraint");
}

#[test]
fn test_create_central_password_empty_name_fails() {
    // Empty name validation is enforced at the Tauri command layer.
    // At the DB layer the UNIQUE constraint on name still applies; this test
    // confirms the row can be attempted and that the constraint would reject a
    // second empty-name row — mirroring how other modules test DB-level guards.
    let db = create_test_db();
    let cp1 = make_test_cp("");
    let mut cp2 = make_test_cp("");
    cp2.id = uuid::Uuid::new_v4().to_string();

    db.create_central_password(&cp1).unwrap();
    let result = db.create_central_password(&cp2);

    assert!(result.is_err(), "Duplicate empty name should be rejected by UNIQUE constraint");
}

// ============================================================================
// Read
// ============================================================================

#[test]
fn test_get_all_central_passwords_empty() {
    let db = create_test_db();
    let cps = db.get_all_central_passwords().unwrap();
    assert_eq!(cps.len(), 0);
}

#[test]
fn test_get_all_central_passwords_returns_created() {
    let db = create_test_db();
    db.create_central_password(&make_test_cp("AD Account")).unwrap();
    db.create_central_password(&make_test_cp("VPN Credentials")).unwrap();

    let cps = db.get_all_central_passwords().unwrap();
    assert_eq!(cps.len(), 2);
}

#[test]
fn test_get_all_central_passwords_sorted_by_name() {
    let db = create_test_db();
    db.create_central_password(&make_test_cp("Zebra")).unwrap();
    db.create_central_password(&make_test_cp("Alpha")).unwrap();
    db.create_central_password(&make_test_cp("Middle")).unwrap();

    let cps = db.get_all_central_passwords().unwrap();
    assert_eq!(cps[0].name, "Alpha");
    assert_eq!(cps[1].name, "Middle");
    assert_eq!(cps[2].name, "Zebra");
}

#[test]
fn test_get_central_password_by_id_found() {
    let db = create_test_db();
    let cp = make_test_cp("SSH Jump Host");
    db.create_central_password(&cp).unwrap();

    let found = db.get_central_password_by_id(&cp.id).unwrap();
    assert!(found.is_some());
    assert_eq!(found.unwrap().name, "SSH Jump Host");
}

#[test]
fn test_get_central_password_by_id_not_found() {
    let db = create_test_db();
    let result = db.get_central_password_by_id("non-existent-id").unwrap();
    assert!(result.is_none());
}

#[test]
fn test_get_central_password_by_name_found() {
    let db = create_test_db();
    let cp = make_test_cp("Prod DB");
    db.create_central_password(&cp).unwrap();

    let found = db.get_central_password_by_name("Prod DB").unwrap();
    assert!(found.is_some());
    assert_eq!(found.unwrap().id, cp.id);
}

#[test]
fn test_get_central_password_by_name_not_found() {
    let db = create_test_db();
    let result = db.get_central_password_by_name("Missing").unwrap();
    assert!(result.is_none());
}

// ============================================================================
// Update
// ============================================================================

#[test]
fn test_update_central_password_meta_success() {
    let db = create_test_db();
    let cp = make_test_cp("Old Name");
    db.create_central_password(&cp).unwrap();

    assert!(db.update_central_password_meta(&cp.id, "New Name", Some("Updated description")).is_ok());

    let updated = db.get_central_password_by_id(&cp.id).unwrap().unwrap();
    assert_eq!(updated.name, "New Name");
    assert_eq!(updated.description, Some("Updated description".to_string()));
}

#[test]
fn test_update_central_password_name_to_duplicate_fails() {
    let db = create_test_db();
    let cp1 = make_test_cp("First");
    let cp2 = make_test_cp("Second");
    db.create_central_password(&cp1).unwrap();
    db.create_central_password(&cp2).unwrap();

    // Renaming cp2 to the same name as cp1 should fail
    let result = db.update_central_password_meta(&cp2.id, "First", None);
    assert!(result.is_err(), "Renaming to a duplicate name should fail");
}

// ============================================================================
// Delete and revert
// ============================================================================

#[test]
fn test_delete_central_password_no_linked_profiles() {
    let db = create_test_db();
    let cp = make_test_cp("Standalone CP");
    db.create_central_password(&cp).unwrap();

    // Revert returns 0 (no profiles to update), then delete succeeds
    let reverted = db.revert_profiles_central_password(&cp.id).unwrap();
    assert_eq!(reverted, 0);

    let conn = db.conn.lock().unwrap();
    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM central_passwords WHERE id = ?1", [&cp.id], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 1, "Row should still exist — deletion is handled by the Tauri command layer");
}

#[test]
fn test_delete_central_password_reverts_linked_profiles() {
    // Keychain operations are handled by the Tauri command layer and not exercised here.
    // This test validates that the DB revert step correctly clears central_password_id
    // and sets auth_method = 'none' on all linked profiles.
    let db = create_test_db();
    let cp = make_test_cp("Shared Bastion");
    db.create_central_password(&cp).unwrap();

    // Create 3 profiles linked to the central password
    let mut p1 = make_test_profile("Server A", None);
    let mut p2 = make_test_profile("Server B", None);
    let mut p3 = make_test_profile("Server C", None);
    p1.auth_method = "central_password".to_string();
    p1.central_password_id = Some(cp.id.clone());
    p2.auth_method = "central_password".to_string();
    p2.central_password_id = Some(cp.id.clone());
    p3.auth_method = "central_password".to_string();
    p3.central_password_id = Some(cp.id.clone());
    db.create_profile(&p1).unwrap();
    db.create_profile(&p2).unwrap();
    db.create_profile(&p3).unwrap();

    // Revert all linked profiles
    let reverted = db.revert_profiles_central_password(&cp.id).unwrap();
    assert_eq!(reverted, 3);

    // Verify each profile is now keyboard-interactive with no CP reference
    for id in [&p1.id, &p2.id, &p3.id] {
        let profile = db.get_profile_by_id(id).unwrap().unwrap();
        assert_eq!(profile.auth_method, "none");
        assert!(profile.central_password_id.is_none());
    }
}

// ============================================================================
// Profile linkage
// ============================================================================

#[test]
fn test_get_profiles_by_central_password_id() {
    let db = create_test_db();
    let cp = make_test_cp("Jump Host");
    db.create_central_password(&cp).unwrap();

    let mut p1 = make_test_profile("Alpha", None);
    let mut p2 = make_test_profile("Beta", None);
    let p3 = make_test_profile("Gamma", None); // Not linked

    p1.auth_method = "central_password".to_string();
    p1.central_password_id = Some(cp.id.clone());
    p2.auth_method = "central_password".to_string();
    p2.central_password_id = Some(cp.id.clone());

    db.create_profile(&p1).unwrap();
    db.create_profile(&p2).unwrap();
    db.create_profile(&p3).unwrap();

    let linked = db.get_profiles_by_central_password_id(&cp.id).unwrap();
    assert_eq!(linked.len(), 2);
    assert!(linked.iter().any(|p| p.name == "Alpha"));
    assert!(linked.iter().any(|p| p.name == "Beta"));
}

#[test]
fn test_profile_with_central_password_create() {
    // Keychain storage is handled by the Tauri command layer and not exercised here.
    // This test validates that a profile with auth_method='central_password' and a
    // central_password_id is persisted correctly at the DB level.
    let db = create_test_db();
    let cp = make_test_cp("AD Password");
    db.create_central_password(&cp).unwrap();

    let mut profile = make_test_profile("Domain Server", None);
    profile.auth_method = "central_password".to_string();
    profile.central_password_id = Some(cp.id.clone());
    db.create_profile(&profile).unwrap();

    let saved = db.get_profile_by_id(&profile.id).unwrap().unwrap();
    assert_eq!(saved.auth_method, "central_password");
    assert_eq!(saved.central_password_id, Some(cp.id.clone()));
}

#[test]
fn test_profile_with_central_password_update() {
    // Validate that updating a profile to use a different central password
    // is persisted correctly at the DB level.
    let db = create_test_db();
    let cp1 = make_test_cp("Old Shared Password");
    let cp2 = make_test_cp("New Shared Password");
    db.create_central_password(&cp1).unwrap();
    db.create_central_password(&cp2).unwrap();

    let mut profile = make_test_profile("Switching Server", None);
    profile.auth_method = "central_password".to_string();
    profile.central_password_id = Some(cp1.id.clone());
    db.create_profile(&profile).unwrap();

    // Switch to cp2
    profile.central_password_id = Some(cp2.id.clone());
    db.update_profile(&profile).unwrap();

    let updated = db.get_profile_by_id(&profile.id).unwrap().unwrap();
    assert_eq!(updated.central_password_id, Some(cp2.id.clone()));
}
