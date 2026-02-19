use super::helpers::*;

#[test]
fn test_create_group_success() {
    let db = create_test_db();
    let group = make_test_group("Work", None, "Work");

    assert!(db.create_group(&group).is_ok());
}

#[test]
fn test_get_all_groups_empty() {
    let db = create_test_db();
    let groups = db.get_all_groups().unwrap();
    // Migration only creates groups if there are existing profiles
    // With no profiles, no groups are created
    assert_eq!(groups.len(), 0);
}

#[test]
fn test_get_group_by_id_success() {
    let db = create_test_db();
    let group = make_test_group("Work", None, "Work");

    db.create_group(&group).unwrap();
    let retrieved = db.get_group_by_id(&group.id).unwrap().unwrap();

    assert_eq!(retrieved.name, "Work");
    assert_eq!(retrieved.path, "Work");
}

#[test]
fn test_create_hierarchical_groups() {
    let db = create_test_db();
    let parent = make_test_group("Work", None, "Work");
    db.create_group(&parent).unwrap();

    let child = make_test_group("Production", Some(parent.id.clone()), "Work/Production");
    db.create_group(&child).unwrap();

    let grandchild = make_test_group("Servers", Some(child.id.clone()), "Work/Production/Servers");
    db.create_group(&grandchild).unwrap();

    let all_groups = db.get_all_groups().unwrap();
    assert!(all_groups.iter().any(|g| g.path == "Work"));
    assert!(all_groups.iter().any(|g| g.path == "Work/Production"));
    assert!(all_groups.iter().any(|g| g.path == "Work/Production/Servers"));
}

#[test]
fn test_update_group_name_updates_path() {
    let db = create_test_db();
    let mut group = make_test_group("OldName", None, "OldName");

    db.create_group(&group).unwrap();

    group.name = "NewName".to_string();
    group.path = "NewName".to_string();
    group.updated_at = chrono::Utc::now().to_rfc3339();

    db.update_group(&group).unwrap();

    let updated = db.get_group_by_id(&group.id).unwrap().unwrap();
    assert_eq!(updated.name, "NewName");
    assert_eq!(updated.path, "NewName");
}

#[test]
fn test_delete_group_success() {
    let db = create_test_db();
    let group = make_test_group("ToDelete", None, "ToDelete");

    db.create_group(&group).unwrap();
    assert!(db.delete_group(&group.id).is_ok());

    let result = db.get_group_by_id(&group.id).unwrap();
    assert!(result.is_none());
}

#[test]
fn test_delete_group_cascade_deletes_children() {
    let db = create_test_db();
    let parent = make_test_group("Parent", None, "Parent");
    db.create_group(&parent).unwrap();

    let child = make_test_group("Child", Some(parent.id.clone()), "Parent/Child");
    db.create_group(&child).unwrap();

    // Delete parent
    db.delete_group(&parent.id).unwrap();

    // Child should also be deleted due to CASCADE
    let result = db.get_group_by_id(&child.id).unwrap();
    assert!(result.is_none());
}

#[test]
fn test_get_child_groups() {
    let db = create_test_db();
    let parent = make_test_group("Parent", None, "Parent");
    db.create_group(&parent).unwrap();

    let child1 = make_test_group("Child1", Some(parent.id.clone()), "Parent/Child1");
    let child2 = make_test_group("Child2", Some(parent.id.clone()), "Parent/Child2");

    db.create_group(&child1).unwrap();
    db.create_group(&child2).unwrap();

    let children = db.get_child_groups(&parent.id).unwrap();
    assert_eq!(children.len(), 2);
}

#[test]
fn test_rename_group_with_overlapping_names() {
    // Verify that renaming a group doesn't corrupt groups with overlapping names
    // (e.g., renaming "Dev" to "Development" should not affect "DevOps")
    let db = create_test_db();

    // Create two groups with overlapping names
    let dev_group = make_test_group("Dev", None, "Dev");
    let devops_group = make_test_group("DevOps", None, "DevOps");

    db.create_group(&dev_group).unwrap();
    db.create_group(&devops_group).unwrap();

    // Create profiles in each group
    let dev_profile = make_test_profile("DevServer", Some("Dev"));
    let devops_profile = make_test_profile("DevOpsServer", Some("DevOps"));

    db.create_profile(&dev_profile).unwrap();
    db.create_profile(&devops_profile).unwrap();

    // Rename "Dev" to "Development"
    // This would incorrectly affect "DevOps" if using REPLACE() instead of SUBSTR()
    let mut updated_dev = dev_group.clone();
    let old_path = updated_dev.path.clone();
    updated_dev.name = "Development".to_string();
    updated_dev.path = "Development".to_string();
    db.update_group(&updated_dev).unwrap();

    // Manually perform cascade update (simulating what update_group command does)
    // This tests the SQL fix directly
    let conn = db.conn.lock().unwrap();
    let escaped_path = old_path.replace('%', "\\%").replace('_', "\\_");
    conn.execute(
        "UPDATE profiles
         SET group_path = ?2 || SUBSTR(group_path, LENGTH(?1) + 1)
         WHERE group_path = ?1 OR group_path LIKE ?3 ESCAPE '\\'",
        (&old_path, &updated_dev.path, format!("{}/%", escaped_path)),
    ).unwrap();
    drop(conn);

    // Verify "DevOps" group is unchanged
    let devops_check = db.get_group_by_id(&devops_group.id).unwrap().unwrap();
    assert_eq!(devops_check.path, "DevOps", "DevOps group path should not be affected");

    // Verify "DevOps" profile is unchanged
    let devops_profile_check = db.get_profile_by_id(&devops_profile.id).unwrap().unwrap();
    assert_eq!(devops_profile_check.group_path, Some("DevOps".to_string()), "DevOps profile group_path should not be affected");

    // Verify "Dev" profile was updated correctly
    let dev_profile_check = db.get_profile_by_id(&dev_profile.id).unwrap().unwrap();
    assert_eq!(dev_profile_check.group_path, Some("Development".to_string()), "Dev profile group_path should be updated");
}

#[test]
fn test_rename_group_cascade_updates_sub_group_profiles() {
    // Verify that renaming a parent group correctly updates profile group_paths
    // in sub-groups using SQL SUBSTR (not Rust replace() which corrupts overlapping names)
    let db = create_test_db();

    // Create parent and a sub-group whose name starts with the parent name
    // This is the edge case where Rust's replace() would corrupt paths
    let parent = make_test_group("Dev", None, "Dev");
    let child = make_test_group("DevOps", Some(parent.id.clone()), "Dev/DevOps");

    db.create_group(&parent).unwrap();
    db.create_group(&child).unwrap();

    // Create profiles at both levels
    let parent_profile = make_test_profile("ParentServer", Some("Dev"));
    let child_profile = make_test_profile("ChildServer", Some("Dev/DevOps"));

    db.create_profile(&parent_profile).unwrap();
    db.create_profile(&child_profile).unwrap();

    // Simulate the update_group command: rename "Dev" to "Development"
    let mut updated_parent = parent.clone();
    let old_path = updated_parent.path.clone();
    updated_parent.name = "Development".to_string();
    updated_parent.path = "Development".to_string();
    updated_parent.updated_at = chrono::Utc::now().to_rfc3339();
    db.update_group(&updated_parent).unwrap();

    // Apply cascade using SQL SUBSTR (the fixed approach)
    let conn = db.conn.lock().unwrap();
    let escaped_path = old_path.replace('%', "\\%").replace('_', "\\_");
    let like_pattern = format!("{}/%", escaped_path);
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE groups
         SET path = ?2 || SUBSTR(path, LENGTH(?1) + 1),
             updated_at = ?3
         WHERE path LIKE ?4 ESCAPE '\\'",
        (&old_path, &updated_parent.path, &now, &like_pattern),
    ).unwrap();

    conn.execute(
        "UPDATE profiles
         SET group_path = ?2 || SUBSTR(group_path, LENGTH(?1) + 1)
         WHERE group_path = ?1 OR group_path LIKE ?3 ESCAPE '\\'",
        (&old_path, &updated_parent.path, &like_pattern),
    ).unwrap();
    drop(conn);

    // Sub-group path should be "Development/DevOps" (NOT "Development/DevelopmentOps")
    let child_check = db.get_group_by_id(&child.id).unwrap().unwrap();
    assert_eq!(child_check.path, "Development/DevOps");

    // Parent profile path should be updated
    let parent_profile_check = db.get_profile_by_id(&parent_profile.id).unwrap().unwrap();
    assert_eq!(parent_profile_check.group_path, Some("Development".to_string()));

    // Sub-group profile path must be "Development/DevOps" (not "Development/DevelopmentOps")
    let child_profile_check = db.get_profile_by_id(&child_profile.id).unwrap().unwrap();
    assert_eq!(child_profile_check.group_path, Some("Development/DevOps".to_string()));
}
