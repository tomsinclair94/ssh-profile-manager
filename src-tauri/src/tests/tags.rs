use super::helpers::*;

#[test]
fn test_create_tag_success() {
    let db = create_test_db();
    let tag = make_test_tag("production", "#FF5733");

    assert!(db.create_tag_db(&tag).is_ok());
}

#[test]
fn test_get_all_tags_empty() {
    let db = create_test_db();
    let tags = db.get_all_tags().unwrap();
    assert_eq!(tags.len(), 0);
}

#[test]
fn test_get_all_tags_returns_created() {
    let db = create_test_db();
    let tag = make_test_tag("production", "#FF5733");

    db.create_tag_db(&tag).unwrap();
    let tags = db.get_all_tags().unwrap();

    assert_eq!(tags.len(), 1);
    assert_eq!(tags[0].name, "production");
    assert_eq!(tags[0].color, "#FF5733");
}

#[test]
fn test_delete_tag_success() {
    let db = create_test_db();
    let tag = make_test_tag("production", "#FF5733");

    db.create_tag_db(&tag).unwrap();
    assert!(db.delete_tag_db(&tag.id).is_ok());

    let tags = db.get_all_tags().unwrap();
    assert_eq!(tags.len(), 0);
}

#[test]
fn test_add_profile_tag() {
    let db = create_test_db();
    let profile = make_test_profile("Server", None);
    let tag = make_test_tag("production", "#FF5733");

    db.create_profile(&profile).unwrap();
    db.create_tag_db(&tag).unwrap();

    assert!(db.add_profile_tag_db(&profile.id, &tag.id).is_ok());

    let tags = db.get_profile_tags(&profile.id).unwrap();
    assert_eq!(tags.len(), 1);
    assert_eq!(tags[0].name, "production");
}

#[test]
fn test_remove_profile_tag() {
    let db = create_test_db();
    let profile = make_test_profile("Server", None);
    let tag = make_test_tag("production", "#FF5733");

    db.create_profile(&profile).unwrap();
    db.create_tag_db(&tag).unwrap();
    db.add_profile_tag_db(&profile.id, &tag.id).unwrap();

    assert!(db.remove_profile_tag_db(&profile.id, &tag.id).is_ok());

    let tags = db.get_profile_tags(&profile.id).unwrap();
    assert_eq!(tags.len(), 0);
}

#[test]
fn test_set_profile_tags_replaces_all() {
    let db = create_test_db();
    let profile = make_test_profile("Server", None);
    let tag1 = make_test_tag("production", "#FF5733");
    let tag2 = make_test_tag("critical", "#00FF00");
    let tag3 = make_test_tag("monitored", "#0000FF");

    db.create_profile(&profile).unwrap();
    db.create_tag_db(&tag1).unwrap();
    db.create_tag_db(&tag2).unwrap();
    db.create_tag_db(&tag3).unwrap();

    // Set initial tags
    db.set_profile_tags_db(&profile.id, &[tag1.id.clone(), tag2.id.clone()]).unwrap();
    let tags = db.get_profile_tags(&profile.id).unwrap();
    assert_eq!(tags.len(), 2);

    // Replace with different tags
    db.set_profile_tags_db(&profile.id, &[tag3.id.clone()]).unwrap();
    let tags = db.get_profile_tags(&profile.id).unwrap();
    assert_eq!(tags.len(), 1);
    assert_eq!(tags[0].name, "monitored");
}

#[test]
fn test_get_tag_usage_counts() {
    let db = create_test_db();
    let profile1 = make_test_profile("Server1", None);
    let profile2 = make_test_profile("Server2", None);
    let tag = make_test_tag("production", "#FF5733");

    db.create_profile(&profile1).unwrap();
    db.create_profile(&profile2).unwrap();
    db.create_tag_db(&tag).unwrap();

    db.add_profile_tag_db(&profile1.id, &tag.id).unwrap();
    db.add_profile_tag_db(&profile2.id, &tag.id).unwrap();

    let usage = db.get_tag_usage_counts_db().unwrap();
    assert_eq!(usage.len(), 1);
    assert_eq!(usage[0].0.name, "production");
    assert_eq!(usage[0].1, 2);
}

#[test]
fn test_delete_tag_removes_associations() {
    let db = create_test_db();
    let profile = make_test_profile("Server", None);
    let tag = make_test_tag("production", "#FF5733");

    db.create_profile(&profile).unwrap();
    db.create_tag_db(&tag).unwrap();
    db.add_profile_tag_db(&profile.id, &tag.id).unwrap();

    // Delete tag should cascade delete from profile_tags
    db.delete_tag_db(&tag.id).unwrap();

    let tags = db.get_profile_tags(&profile.id).unwrap();
    assert_eq!(tags.len(), 0);
}
