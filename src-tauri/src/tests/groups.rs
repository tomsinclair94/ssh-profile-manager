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
