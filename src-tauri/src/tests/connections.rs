use super::helpers::*;

#[test]
fn test_record_connection_creates_new() {
    let db = create_test_db();
    let profile = make_test_profile("Server", None);

    db.create_profile(&profile).unwrap();
    assert!(db.record_connection(&profile.id).is_ok());

    let recent = db.get_recent_connections(None).unwrap();
    assert_eq!(recent.len(), 1);
    assert_eq!(recent[0].profile_id, profile.id);
}

#[test]
fn test_record_connection_updates_existing() {
    let db = create_test_db();
    let profile = make_test_profile("Server", None);

    db.create_profile(&profile).unwrap();

    db.record_connection(&profile.id).unwrap();
    let first_time = db.get_recent_connections(None).unwrap()[0].connected_at.clone();

    // Wait a bit to ensure timestamp changes
    std::thread::sleep(std::time::Duration::from_millis(10));

    db.record_connection(&profile.id).unwrap();
    let recent = db.get_recent_connections(None).unwrap();

    assert_eq!(recent.len(), 1); // Still only one entry
    assert_ne!(recent[0].connected_at, first_time); // Timestamp updated
}

#[test]
fn test_get_recent_connections_with_limit() {
    let db = create_test_db();

    for i in 0..10 {
        let profile = make_test_profile(&format!("Server{}", i), None);
        db.create_profile(&profile).unwrap();
        db.record_connection(&profile.id).unwrap();
    }

    let recent = db.get_recent_connections(Some(5)).unwrap();
    assert_eq!(recent.len(), 5);
}

#[test]
fn test_clear_recent_connections() {
    let db = create_test_db();
    let profile = make_test_profile("Server", None);

    db.create_profile(&profile).unwrap();
    db.record_connection(&profile.id).unwrap();

    assert!(db.clear_recent_connections().is_ok());

    let recent = db.get_recent_connections(None).unwrap();
    assert_eq!(recent.len(), 0);
}

#[test]
fn test_remove_recent_connection() {
    let db = create_test_db();
    let profile1 = make_test_profile("Server1", None);
    let profile2 = make_test_profile("Server2", None);

    db.create_profile(&profile1).unwrap();
    db.create_profile(&profile2).unwrap();
    db.record_connection(&profile1.id).unwrap();
    db.record_connection(&profile2.id).unwrap();

    db.remove_recent_connection(&profile1.id).unwrap();

    let recent = db.get_recent_connections(None).unwrap();
    assert_eq!(recent.len(), 1);
    assert_eq!(recent[0].profile_id, profile2.id);
}
