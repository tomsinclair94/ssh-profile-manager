use super::helpers::*;

#[test]
fn test_create_profile_success() {
    let db = create_test_db();
    let profile = make_test_profile("Test Server", None);

    assert!(db.create_profile(&profile).is_ok());
}

#[test]
fn test_get_all_profiles_empty() {
    let db = create_test_db();
    let profiles = db.get_all_profiles().unwrap();
    assert_eq!(profiles.len(), 0);
}

#[test]
fn test_get_all_profiles_returns_created() {
    let db = create_test_db();
    let profile = make_test_profile("Test Server", None);

    db.create_profile(&profile).unwrap();
    let profiles = db.get_all_profiles().unwrap();

    assert_eq!(profiles.len(), 1);
    assert_eq!(profiles[0].name, "Test Server");
}

#[test]
fn test_update_profile_success() {
    let db = create_test_db();
    let mut profile = make_test_profile("Original Name", None);

    db.create_profile(&profile).unwrap();

    profile.name = "Updated Name".to_string();
    profile.description = Some("Updated description".to_string());

    assert!(db.update_profile(&profile).is_ok());

    let updated = db.get_profile_by_id(&profile.id).unwrap().unwrap();
    assert_eq!(updated.name, "Updated Name");
    assert_eq!(updated.description, Some("Updated description".to_string()));
}

#[test]
fn test_delete_profile_success() {
    let db = create_test_db();
    let profile = make_test_profile("To Delete", None);

    db.create_profile(&profile).unwrap();
    assert!(db.delete_profile(&profile.id).is_ok());

    let result = db.get_profile_by_id(&profile.id).unwrap();
    assert!(result.is_none());
}

#[test]
fn test_get_profile_by_id_not_found() {
    let db = create_test_db();
    let result = db.get_profile_by_id("non-existent-id").unwrap();
    assert!(result.is_none());
}

#[test]
fn test_get_all_profiles_with_metadata() {
    let db = create_test_db();
    let profile = make_test_profile("Test Server", None);

    db.create_profile(&profile).unwrap();
    db.upsert_profile_metadata_db(&profile.id, Some("server".to_string()), false).unwrap();

    let profiles = db.get_all_profiles_with_metadata().unwrap();

    assert_eq!(profiles.len(), 1);
    assert_eq!(profiles[0].name, "Test Server");
    assert_eq!(profiles[0].icon, Some("server".to_string()));
    assert!(!profiles[0].is_favorite);
}

#[test]
fn test_get_profiles_by_group_path() {
    let db = create_test_db();
    let group = make_test_group("Work", None, "Work");
    db.create_group(&group).unwrap();

    let profile1 = make_test_profile("Server 1", Some("Work"));
    let profile2 = make_test_profile("Server 2", Some("Work"));
    let profile3 = make_test_profile("Server 3", None);

    db.create_profile(&profile1).unwrap();
    db.create_profile(&profile2).unwrap();
    db.create_profile(&profile3).unwrap();

    let work_profiles = db.get_profiles_by_group_path("Work").unwrap();
    assert_eq!(work_profiles.len(), 2);
}

#[test]
fn test_toggle_profile_favorite() {
    let db = create_test_db();
    let profile = make_test_profile("Test Server", None);

    db.create_profile(&profile).unwrap();
    db.upsert_profile_metadata_db(&profile.id, Some("server".to_string()), false).unwrap();

    // Toggle to true
    let is_fav = db.toggle_profile_favorite_db(&profile.id).unwrap();
    assert!(is_fav);

    // Toggle back to false
    let is_fav = db.toggle_profile_favorite_db(&profile.id).unwrap();
    assert!(!is_fav);
}

#[test]
fn test_set_profile_favorite() {
    let db = create_test_db();
    let profile = make_test_profile("Test Server", None);

    db.create_profile(&profile).unwrap();

    db.set_profile_favorite_db(&profile.id, true).unwrap();
    let metadata = db.get_profile_metadata(&profile.id).unwrap().unwrap();
    assert!(metadata.is_favorite);

    db.set_profile_favorite_db(&profile.id, false).unwrap();
    let metadata = db.get_profile_metadata(&profile.id).unwrap().unwrap();
    assert!(!metadata.is_favorite);
}

#[test]
fn test_update_profile_icon() {
    let db = create_test_db();
    let profile = make_test_profile("Test Server", None);

    db.create_profile(&profile).unwrap();

    db.update_profile_icon_db(&profile.id, Some("database".to_string())).unwrap();
    let metadata = db.get_profile_metadata(&profile.id).unwrap().unwrap();
    assert_eq!(metadata.icon, Some("database".to_string()));
}
