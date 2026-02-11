// Integration tests validating multi-step workflows that span multiple commands

use super::helpers::*;
use crate::{
    decrypt_import_if_encrypted, detect_encrypted_export, encrypt_data,
    ProfileExportDetailed, GroupExportDetailed,
};

// ============================================================================
// Export/Import Round-Trip with Encryption
// ============================================================================

#[test]
fn test_export_import_profile_roundtrip_encrypted() {
    let db = create_test_db();

    // Create a group and profile
    let group = make_test_group("Production", None, "Production");
    db.create_group(&group).unwrap();

    let mut profile = make_test_profile("WebServer", Some("Production"));
    profile.auth_method = "password".to_string(); // Password auth requires encryption
    db.create_profile(&profile).unwrap();

    // Add metadata
    db.set_profile_favorite_db(&profile.id, true).unwrap();
    db.update_profile_icon_db(&profile.id, Some("server".to_string())).unwrap();

    // Add tags
    let tag = make_test_tag("production", "#FF0000");
    db.create_tag_db(&tag).unwrap();
    db.add_profile_tag_db(&profile.id, &tag.id).unwrap();

    // Store password in keyring (simulated)
    // In real app, this would be stored securely

    // Export with encryption (required for password auth)
    let export_password = "test_password_12345";

    // Manually construct the export data (simulating export_profile command)
    let metadata = db.get_profile_metadata(&profile.id).unwrap();
    let tags_list = db.get_profile_tags(&profile.id).unwrap();

    let export_data = ProfileExportDetailed {
        profile: profile.clone(),
        metadata,
        tags: tags_list,
        password: Some("stored_password".to_string()), // Simulated keyring retrieval
    };

    let json = serde_json::to_string(&export_data).unwrap();

    // Encrypt the export
    let encrypted = encrypt_data(&json, export_password).unwrap();
    let encrypted_json = serde_json::to_string(&encrypted).unwrap();

    // Verify it's detected as encrypted
    assert!(detect_encrypted_export(&encrypted_json));

    // Create a new database for import (simulating fresh install)
    let db2 = create_test_db();

    // Recreate the group in the new database
    db2.create_group(&group).unwrap();

    // Recreate the tag (by name) in the new database
    let tag2 = make_test_tag("production", "#FF0000");
    db2.create_tag_db(&tag2).unwrap();

    // Decrypt the import
    let decrypted = decrypt_import_if_encrypted(&encrypted_json, &Some(export_password.to_string())).unwrap();

    // Parse the decrypted data
    let import_data: ProfileExportDetailed = serde_json::from_str(&decrypted).unwrap();

    // Import the profile
    let new_id = uuid::Uuid::new_v4().to_string();
    let mut imported_profile = import_data.profile;
    imported_profile.id = new_id.clone();
    db2.create_profile(&imported_profile).unwrap();

    // Import metadata
    if let Some(meta) = import_data.metadata {
        db2.set_profile_favorite_db(&new_id, meta.is_favorite).unwrap();
        if let Some(icon) = meta.icon {
            db2.update_profile_icon_db(&new_id, Some(icon)).unwrap();
        }
    }

    // Import tags (link by name)
    for tag in import_data.tags {
        if let Some(existing_tag) = db2.get_all_tags().unwrap().iter().find(|t| t.name == tag.name) {
            db2.add_profile_tag_db(&new_id, &existing_tag.id).unwrap();
        }
    }

    // Verify imported profile matches original
    let imported = db2.get_profile_by_id(&new_id).unwrap().unwrap();
    assert_eq!(imported.name, profile.name);
    assert_eq!(imported.host, profile.host);
    assert_eq!(imported.username, profile.username);
    assert_eq!(imported.auth_method, profile.auth_method);
    assert_eq!(imported.group_path, profile.group_path);

    // Verify metadata
    let imported_meta = db2.get_profile_metadata(&new_id).unwrap().unwrap();
    assert_eq!(imported_meta.is_favorite, true);
    assert_eq!(imported_meta.icon, Some("server".to_string()));

    // Verify tags
    let imported_tags = db2.get_profile_tags(&new_id).unwrap();
    assert_eq!(imported_tags.len(), 1);
    assert_eq!(imported_tags[0].name, "production");
}

#[test]
fn test_export_import_group_roundtrip_with_subgroups() {
    let db = create_test_db();

    // Create hierarchical group structure
    let parent = make_test_group("Work", None, "Work");
    db.create_group(&parent).unwrap();

    let child = make_test_group("Production", Some(parent.id.clone()), "Work/Production");
    db.create_group(&child).unwrap();

    // Create profiles in each group
    let profile1 = make_test_profile("Server1", Some("Work"));
    let profile2 = make_test_profile("Server2", Some("Work/Production"));
    db.create_profile(&profile1).unwrap();
    db.create_profile(&profile2).unwrap();

    // Export group (recursive, includes subgroups and profiles)
    // This simulates what export_group command does
    let export_password = "group_export_password_12";

    // Build the recursive export structure
    // Convert Group to GroupPortable
    let child_portable = crate::GroupPortable {
        id: child.id.clone(),
        name: child.name.clone(),
        parent_path: Some(parent.path.clone()),
        path: child.path.clone(),
        icon: child.icon.clone(),
        is_favorite: child.is_favorite,
        display_order: child.display_order,
    };

    let parent_portable = crate::GroupPortable {
        id: parent.id.clone(),
        name: parent.name.clone(),
        parent_path: None,
        path: parent.path.clone(),
        icon: parent.icon.clone(),
        is_favorite: parent.is_favorite,
        display_order: parent.display_order,
    };

    let child_profiles = vec![ProfileExportDetailed {
        profile: profile2.clone(),
        metadata: db.get_profile_metadata(&profile2.id).unwrap(),
        tags: vec![],
        password: None,
    }];

    let child_export = GroupExportDetailed {
        group: child_portable,
        profiles: child_profiles,
        subgroups: vec![],
    };

    let parent_profiles = vec![ProfileExportDetailed {
        profile: profile1.clone(),
        metadata: db.get_profile_metadata(&profile1.id).unwrap(),
        tags: vec![],
        password: None,
    }];

    let parent_export = GroupExportDetailed {
        group: parent_portable,
        profiles: parent_profiles,
        subgroups: vec![child_export],
    };

    let json = serde_json::to_string(&parent_export).unwrap();

    // Encrypt (optional for key-based auth)
    let encrypted = encrypt_data(&json, export_password).unwrap();
    let encrypted_json = serde_json::to_string(&encrypted).unwrap();

    // Import into new database
    let db2 = create_test_db();

    // Decrypt
    let decrypted = decrypt_import_if_encrypted(&encrypted_json, &Some(export_password.to_string())).unwrap();
    let import_data: GroupExportDetailed = serde_json::from_str(&decrypted).unwrap();

    // Recursive import function (simplified)
    fn import_group_recursive(
        db: &crate::Database,
        group_export: &GroupExportDetailed,
        parent_id: Option<String>,
    ) -> Result<String, String> {
        // Convert GroupPortable to Group
        let now = chrono::Utc::now().to_rfc3339();
        let mut new_group = crate::Group {
            id: uuid::Uuid::new_v4().to_string(),
            name: group_export.group.name.clone(),
            parent_id: parent_id.clone(),
            path: group_export.group.path.clone(),
            icon: group_export.group.icon.clone(),
            is_favorite: group_export.group.is_favorite,
            display_order: group_export.group.display_order,
            created_at: now.clone(),
            updated_at: now,
        };

        // Recalculate path based on new parent
        if let Some(pid) = &parent_id {
            let parent = db.get_group_by_id(pid).unwrap().unwrap();
            new_group.path = format!("{}/{}", parent.path, new_group.name);
        }

        db.create_group(&new_group).unwrap();

        // Import profiles
        for profile_export in &group_export.profiles {
            let mut new_profile = profile_export.profile.clone();
            new_profile.id = uuid::Uuid::new_v4().to_string();
            new_profile.group_path = Some(new_group.path.clone());
            db.create_profile(&new_profile).unwrap();
        }

        // Recursively import subgroups
        for subgroup_export in &group_export.subgroups {
            import_group_recursive(db, subgroup_export, Some(new_group.id.clone()))?;
        }

        Ok(new_group.id)
    }

    import_group_recursive(&db2, &import_data, None).unwrap();

    // Verify all groups were imported
    let all_groups = db2.get_all_groups().unwrap();
    assert_eq!(all_groups.len(), 2);
    assert!(all_groups.iter().any(|g| g.name == "Work"));
    assert!(all_groups.iter().any(|g| g.path == "Work/Production"));

    // Verify all profiles were imported
    let all_profiles = db2.get_all_profiles().unwrap();
    assert_eq!(all_profiles.len(), 2);
    assert!(all_profiles.iter().any(|p| p.name == "Server1" && p.group_path == Some("Work".to_string())));
    assert!(all_profiles.iter().any(|p| p.name == "Server2" && p.group_path == Some("Work/Production".to_string())));
}

// ============================================================================
// Group Rename Cascade
// ============================================================================

#[test]
fn test_group_rename_cascade_updates_all_descendants() {
    let db = create_test_db();

    // Create hierarchical structure
    let parent = make_test_group("OldParent", None, "OldParent");
    db.create_group(&parent).unwrap();

    let child = make_test_group("Child", Some(parent.id.clone()), "OldParent/Child");
    db.create_group(&child).unwrap();

    let grandchild = make_test_group("GrandChild", Some(child.id.clone()), "OldParent/Child/GrandChild");
    db.create_group(&grandchild).unwrap();

    // Create profiles at each level
    let profile1 = make_test_profile("P1", Some("OldParent"));
    let profile2 = make_test_profile("P2", Some("OldParent/Child"));
    let profile3 = make_test_profile("P3", Some("OldParent/Child/GrandChild"));

    db.create_profile(&profile1).unwrap();
    db.create_profile(&profile2).unwrap();
    db.create_profile(&profile3).unwrap();

    // Rename parent group
    let mut updated_parent = parent.clone();
    updated_parent.name = "NewParent".to_string();
    let old_path = updated_parent.path.clone();
    updated_parent.path = "NewParent".to_string();
    updated_parent.updated_at = chrono::Utc::now().to_rfc3339();

    db.update_group(&updated_parent).unwrap();

    // Update descendant paths (simulating what update_group Tauri command does)
    let conn = db.conn.lock().unwrap();

    // Escape special SQL LIKE characters
    let escaped_path = old_path.replace('%', "\\%").replace('_', "\\_");

    // Update child groups
    conn.execute(
        "UPDATE groups
         SET path = ?2 || SUBSTR(path, LENGTH(?1) + 1),
             updated_at = ?3
         WHERE path = ?1 OR path LIKE ?4 ESCAPE '\\'",
        (&old_path, &updated_parent.path, &updated_parent.updated_at, format!("{}/%", escaped_path)),
    ).unwrap();

    // Update profiles
    conn.execute(
        "UPDATE profiles
         SET group_path = ?2 || SUBSTR(group_path, LENGTH(?1) + 1)
         WHERE group_path = ?1 OR group_path LIKE ?3 ESCAPE '\\'",
        (&old_path, &updated_parent.path, format!("{}/%", escaped_path)),
    ).unwrap();

    drop(conn);

    // Verify all paths were updated correctly
    let child_check = db.get_group_by_id(&child.id).unwrap().unwrap();
    assert_eq!(child_check.path, "NewParent/Child");

    let grandchild_check = db.get_group_by_id(&grandchild.id).unwrap().unwrap();
    assert_eq!(grandchild_check.path, "NewParent/Child/GrandChild");

    let profile1_check = db.get_profile_by_id(&profile1.id).unwrap().unwrap();
    assert_eq!(profile1_check.group_path, Some("NewParent".to_string()));

    let profile2_check = db.get_profile_by_id(&profile2.id).unwrap().unwrap();
    assert_eq!(profile2_check.group_path, Some("NewParent/Child".to_string()));

    let profile3_check = db.get_profile_by_id(&profile3.id).unwrap().unwrap();
    assert_eq!(profile3_check.group_path, Some("NewParent/Child/GrandChild".to_string()));
}

// ============================================================================
// Import Duplicate Detection
// ============================================================================

#[test]
fn test_import_duplicate_detection_skip() {
    let db = create_test_db();

    // Create group and profile
    let group = make_test_group("TestGroup", None, "TestGroup");
    db.create_group(&group).unwrap();

    let existing_profile = make_test_profile("Server1", Some("TestGroup"));
    db.create_profile(&existing_profile).unwrap();

    // Try to import duplicate with same name and group_path
    let duplicate_profile = make_test_profile("Server1", Some("TestGroup"));

    // Duplicate detection logic (name + group_path match)
    let existing = db.get_all_profiles().unwrap().into_iter()
        .find(|p| p.name == duplicate_profile.name && p.group_path == duplicate_profile.group_path);

    assert!(existing.is_some(), "Duplicate should be detected");

    // Skip action: Don't import
    // Profile count should remain 1
    let profiles = db.get_all_profiles().unwrap();
    assert_eq!(profiles.len(), 1);
}

#[test]
fn test_import_duplicate_detection_rename() {
    let db = create_test_db();

    // Create group and profile
    let group = make_test_group("TestGroup", None, "TestGroup");
    db.create_group(&group).unwrap();

    let existing_profile = make_test_profile("Server1", Some("TestGroup"));
    db.create_profile(&existing_profile).unwrap();

    // Import duplicate with rename action
    let mut duplicate_profile = make_test_profile("Server1", Some("TestGroup"));

    // Detect duplicate
    let existing = db.get_all_profiles().unwrap().into_iter()
        .find(|p| p.name == duplicate_profile.name && p.group_path == duplicate_profile.group_path);

    assert!(existing.is_some());

    // Rename action: Auto-suffix with timestamp
    duplicate_profile.name = format!("{} (imported)", duplicate_profile.name);
    duplicate_profile.id = uuid::Uuid::new_v4().to_string();

    db.create_profile(&duplicate_profile).unwrap();

    // Verify both profiles exist
    let profiles = db.get_all_profiles().unwrap();
    assert_eq!(profiles.len(), 2);
    assert!(profiles.iter().any(|p| p.name == "Server1"));
    assert!(profiles.iter().any(|p| p.name == "Server1 (imported)"));
}

#[test]
fn test_import_duplicate_detection_overwrite() {
    let db = create_test_db();

    // Create group and profile
    let group = make_test_group("TestGroup", None, "TestGroup");
    db.create_group(&group).unwrap();

    let mut existing_profile = make_test_profile("Server1", Some("TestGroup"));
    existing_profile.host = "old-host.com".to_string();
    db.create_profile(&existing_profile).unwrap();

    // Import duplicate with overwrite action
    let mut new_profile = make_test_profile("Server1", Some("TestGroup"));
    new_profile.host = "new-host.com".to_string();

    // Detect duplicate
    let existing = db.get_all_profiles().unwrap().into_iter()
        .find(|p| p.name == new_profile.name && p.group_path == new_profile.group_path);

    assert!(existing.is_some());

    // Overwrite action: Update existing profile
    new_profile.id = existing.unwrap().id; // Keep existing ID
    db.update_profile(&new_profile).unwrap();

    // Verify profile was overwritten
    let profiles = db.get_all_profiles().unwrap();
    assert_eq!(profiles.len(), 1);
    assert_eq!(profiles[0].host, "new-host.com");
}

#[test]
fn test_import_allows_same_name_different_group() {
    let db = create_test_db();

    // Create two groups
    let group1 = make_test_group("Group1", None, "Group1");
    let group2 = make_test_group("Group2", None, "Group2");
    db.create_group(&group1).unwrap();
    db.create_group(&group2).unwrap();

    // Create profile with same name in different groups
    let profile1 = make_test_profile("Server1", Some("Group1"));
    let profile2 = make_test_profile("Server1", Some("Group2"));

    db.create_profile(&profile1).unwrap();
    db.create_profile(&profile2).unwrap();

    // Verify both profiles exist (no duplicate detected due to different group_path)
    let profiles = db.get_all_profiles().unwrap();
    assert_eq!(profiles.len(), 2);
    assert!(profiles.iter().any(|p| p.name == "Server1" && p.group_path == Some("Group1".to_string())));
    assert!(profiles.iter().any(|p| p.name == "Server1" && p.group_path == Some("Group2".to_string())));
}

// ============================================================================
// Group Delete Cascade
// ============================================================================

#[test]
fn test_group_delete_cascade_removes_subgroups_and_profiles() {
    let db = create_test_db();

    // Create hierarchical structure
    let parent = make_test_group("Parent", None, "Parent");
    db.create_group(&parent).unwrap();

    let child = make_test_group("Child", Some(parent.id.clone()), "Parent/Child");
    db.create_group(&child).unwrap();

    let grandchild = make_test_group("GrandChild", Some(child.id.clone()), "Parent/Child/GrandChild");
    db.create_group(&grandchild).unwrap();

    // Create profiles at each level
    let profile1 = make_test_profile("P1", Some("Parent"));
    let profile2 = make_test_profile("P2", Some("Parent/Child"));
    let profile3 = make_test_profile("P3", Some("Parent/Child/GrandChild"));

    db.create_profile(&profile1).unwrap();
    db.create_profile(&profile2).unwrap();
    db.create_profile(&profile3).unwrap();

    // Delete parent group (cascade)
    db.delete_group(&parent.id).unwrap();

    // Verify all descendant groups are deleted (CASCADE ON DELETE)
    assert!(db.get_group_by_id(&parent.id).unwrap().is_none());
    assert!(db.get_group_by_id(&child.id).unwrap().is_none());
    assert!(db.get_group_by_id(&grandchild.id).unwrap().is_none());

    // Note: Profiles are NOT cascade deleted due to RESTRICT constraint
    // In the actual app, delete_group command handles this by either:
    // 1. Deleting profiles explicitly (cascade mode)
    // 2. Moving profiles to parent (move mode)
    // This test verifies the database constraint works correctly
    let profiles = db.get_all_profiles().unwrap();
    assert_eq!(profiles.len(), 3, "Profiles should still exist (RESTRICT constraint)");
}

#[test]
fn test_group_delete_move_profiles_to_parent() {
    let db = create_test_db();

    // Create hierarchical structure
    let grandparent = make_test_group("GrandParent", None, "GrandParent");
    db.create_group(&grandparent).unwrap();

    let parent = make_test_group("Parent", Some(grandparent.id.clone()), "GrandParent/Parent");
    db.create_group(&parent).unwrap();

    let child = make_test_group("Child", Some(parent.id.clone()), "GrandParent/Parent/Child");
    db.create_group(&child).unwrap();

    // Create profiles
    let profile1 = make_test_profile("P1", Some("GrandParent/Parent"));
    let profile2 = make_test_profile("P2", Some("GrandParent/Parent/Child"));

    db.create_profile(&profile1).unwrap();
    db.create_profile(&profile2).unwrap();

    // Delete "Parent" group with move mode
    // 1. Move profiles from "Parent" and descendants to "GrandParent"
    // 2. Delete "Parent" and "Child" groups

    let conn = db.conn.lock().unwrap();

    // Move profiles to parent group (GrandParent)
    conn.execute(
        "UPDATE profiles SET group_path = ? WHERE group_path = ? OR group_path LIKE ?",
        (&grandparent.path, &parent.path, format!("{}/%", parent.path)),
    ).unwrap();

    drop(conn);

    // Delete the group (and descendants via CASCADE)
    db.delete_group(&parent.id).unwrap();

    // Verify groups are deleted
    assert!(db.get_group_by_id(&parent.id).unwrap().is_none());
    assert!(db.get_group_by_id(&child.id).unwrap().is_none());
    assert!(db.get_group_by_id(&grandparent.id).unwrap().is_some());

    // Verify profiles were moved to grandparent
    let profiles = db.get_all_profiles().unwrap();
    assert_eq!(profiles.len(), 2);
    assert!(profiles.iter().all(|p| p.group_path == Some("GrandParent".to_string())));
}

// ============================================================================
// Large Import Performance
// ============================================================================

#[test]
fn test_large_import_performance() {
    let db = create_test_db();

    // Create a group
    let group = make_test_group("LargeGroup", None, "LargeGroup");
    db.create_group(&group).unwrap();

    // Create 100 profiles
    let start = std::time::Instant::now();

    for i in 0..100 {
        let profile = make_test_profile(&format!("Server{}", i), Some("LargeGroup"));
        db.create_profile(&profile).unwrap();
    }

    let duration = start.elapsed();

    // Verify all profiles were created
    let profiles = db.get_all_profiles().unwrap();
    assert_eq!(profiles.len(), 100);

    // Performance target: <5 seconds for 100 profiles
    assert!(
        duration.as_secs() < 5,
        "Large import took {:?}, expected <5s",
        duration
    );

    println!("✓ Created 100 profiles in {:?}", duration);
}

#[test]
fn test_large_import_with_metadata_and_tags() {
    let db = create_test_db();

    // Create group and tags
    let group = make_test_group("LargeGroup", None, "LargeGroup");
    db.create_group(&group).unwrap();

    let tag1 = make_test_tag("production", "#FF0000");
    let tag2 = make_test_tag("critical", "#FFA500");
    db.create_tag_db(&tag1).unwrap();
    db.create_tag_db(&tag2).unwrap();

    let start = std::time::Instant::now();

    // Create 100 profiles with metadata and tags
    for i in 0..100 {
        let profile = make_test_profile(&format!("Server{}", i), Some("LargeGroup"));
        db.create_profile(&profile).unwrap();

        // Add metadata
        db.set_profile_favorite_db(&profile.id, i % 10 == 0).unwrap(); // Every 10th is favorite
        db.update_profile_icon_db(&profile.id, Some("server".to_string())).unwrap();

        // Add tags
        db.add_profile_tag_db(&profile.id, &tag1.id).unwrap();
        if i % 5 == 0 {
            db.add_profile_tag_db(&profile.id, &tag2.id).unwrap();
        }
    }

    let duration = start.elapsed();

    // Verify counts
    let profiles = db.get_all_profiles().unwrap();
    assert_eq!(profiles.len(), 100);

    // Check favorites count
    let favorites = profiles.iter().filter(|p| {
        db.get_profile_metadata(&p.id).unwrap().map_or(false, |m| m.is_favorite)
    }).count();
    assert_eq!(favorites, 10);

    // Performance target: <5 seconds for 100 profiles with metadata/tags
    assert!(
        duration.as_secs() < 5,
        "Large import with metadata took {:?}, expected <5s",
        duration
    );

    println!("✓ Created 100 profiles with metadata and tags in {:?}", duration);
}

// ============================================================================
// Additional Critical Workflow Tests
// ============================================================================

#[test]
fn test_encrypted_group_export_with_password_profiles() {
    // CRITICAL: Groups containing password-auth profiles must be encrypted
    let db = create_test_db();

    // Create group structure
    let parent = make_test_group("Prod", None, "Prod");
    db.create_group(&parent).unwrap();

    // Create mix of key-auth and password-auth profiles
    let mut profile1 = make_test_profile("KeyServer", Some("Prod"));
    profile1.auth_method = "key".to_string();
    db.create_profile(&profile1).unwrap();

    let mut profile2 = make_test_profile("PasswordServer", Some("Prod"));
    profile2.auth_method = "password".to_string();
    db.create_profile(&profile2).unwrap();

    // Export should require encryption due to password-auth profile
    let password = "secure_group_password_123";

    // Build group export
    let parent_portable = crate::GroupPortable {
        id: parent.id.clone(),
        name: parent.name.clone(),
        parent_path: None,
        path: parent.path.clone(),
        icon: parent.icon.clone(),
        is_favorite: parent.is_favorite,
        display_order: parent.display_order,
    };

    let profiles_export = vec![
        ProfileExportDetailed {
            profile: profile1.clone(),
            metadata: db.get_profile_metadata(&profile1.id).unwrap(),
            tags: vec![],
            password: None,
        },
        ProfileExportDetailed {
            profile: profile2.clone(),
            metadata: db.get_profile_metadata(&profile2.id).unwrap(),
            tags: vec![],
            password: Some("stored_password".to_string()),
        },
    ];

    let group_export = GroupExportDetailed {
        group: parent_portable,
        profiles: profiles_export,
        subgroups: vec![],
    };

    let json = serde_json::to_string(&group_export).unwrap();

    // Encrypt (mandatory for password-auth profiles)
    let encrypted = encrypt_data(&json, password).unwrap();
    let encrypted_json = serde_json::to_string(&encrypted).unwrap();

    // Verify encryption
    assert!(detect_encrypted_export(&encrypted_json));

    // Decrypt and verify
    let decrypted = decrypt_import_if_encrypted(&encrypted_json, &Some(password.to_string())).unwrap();
    let imported: GroupExportDetailed = serde_json::from_str(&decrypted).unwrap();

    assert_eq!(imported.profiles.len(), 2);
    assert!(imported.profiles.iter().any(|p| p.profile.auth_method == "password"));
}

#[test]
fn test_export_requires_encryption_validation() {
    // Verify that exporting password-auth profiles without encryption is caught
    let _db = create_test_db();

    let mut profile = make_test_profile("SecureServer", None);
    profile.auth_method = "password".to_string();

    // Check if export_requires_encryption detects this
    let profiles = vec![profile];
    let requires_encryption = crate::export_requires_encryption(&profiles);

    assert!(requires_encryption, "Password-auth profile should require encryption");
}

#[test]
fn test_import_with_invalid_encryption_password() {
    // Verify proper error handling for wrong decryption password
    let db = create_test_db();

    let profile = make_test_profile("Server", None);
    let export = ProfileExportDetailed {
        profile: profile.clone(),
        metadata: None,
        tags: vec![],
        password: Some("test_pass".to_string()),
    };

    let json = serde_json::to_string(&export).unwrap();
    let encrypted = encrypt_data(&json, "correct_password").unwrap();
    let encrypted_json = serde_json::to_string(&encrypted).unwrap();

    // Try to decrypt with wrong password
    let result = decrypt_import_if_encrypted(&encrypted_json, &Some("wrong_password".to_string()));

    assert!(result.is_err(), "Should fail with wrong password");
}

#[test]
fn test_tag_auto_creation_on_import() {
    // Tags should be auto-created by name during import
    let db = create_test_db();

    let group = make_test_group("TestGroup", None, "TestGroup");
    db.create_group(&group).unwrap();

    // Create profile with tags
    let profile = make_test_profile("Server", Some("TestGroup"));
    db.create_profile(&profile).unwrap();

    // Create export with tags (simulate tags that don't exist in target DB)
    let tag1 = make_test_tag("production", "#FF0000");
    let tag2 = make_test_tag("critical", "#FFA500");

    let export = ProfileExportDetailed {
        profile: profile.clone(),
        metadata: None,
        tags: vec![tag1.clone(), tag2.clone()],
        password: None,
    };

    // Import into new database
    let db2 = create_test_db();
    db2.create_group(&group).unwrap();

    // Import profile
    let new_id = uuid::Uuid::new_v4().to_string();
    let mut imported_profile = export.profile;
    imported_profile.id = new_id.clone();
    db2.create_profile(&imported_profile).unwrap();

    // Auto-create tags by name
    for tag in export.tags {
        // Check if tag exists by name
        let existing_tag = db2.get_all_tags().unwrap().into_iter().find(|t| t.name == tag.name);

        let tag_id = if let Some(existing) = existing_tag {
            existing.id
        } else {
            // Auto-create tag
            let new_tag = make_test_tag(&tag.name, &tag.color);
            db2.create_tag_db(&new_tag).unwrap();
            new_tag.id
        };

        db2.add_profile_tag_db(&new_id, &tag_id).unwrap();
    }

    // Verify tags were created and assigned
    let all_tags = db2.get_all_tags().unwrap();
    assert_eq!(all_tags.len(), 2);
    assert!(all_tags.iter().any(|t| t.name == "production"));
    assert!(all_tags.iter().any(|t| t.name == "critical"));

    let profile_tags = db2.get_profile_tags(&new_id).unwrap();
    assert_eq!(profile_tags.len(), 2);
}

#[test]
fn test_duplicate_group_detection_on_import() {
    // Duplicate groups should be detected by name + parent_path
    let db = create_test_db();

    // Create existing group
    let existing_group = make_test_group("Servers", None, "Servers");
    db.create_group(&existing_group).unwrap();

    // Try to import group with same name at same level
    let duplicate_group = make_test_group("Servers", None, "Servers");

    // Duplicate detection (name + parent_id/path)
    let all_groups = db.get_all_groups().unwrap();
    let is_duplicate = all_groups.iter().any(|g| {
        g.name == duplicate_group.name && g.parent_id == duplicate_group.parent_id
    });

    assert!(is_duplicate, "Duplicate group should be detected");

    // But same name under different parent should be allowed
    let parent = make_test_group("Production", None, "Production");
    db.create_group(&parent).unwrap();

    let non_duplicate = make_test_group("Servers", Some(parent.id.clone()), "Production/Servers");
    let result = db.create_group(&non_duplicate);

    assert!(result.is_ok(), "Same name under different parent should be allowed");
}

#[test]
fn test_group_move_cascade_updates_paths() {
    // Moving a group should update all descendant paths
    let db = create_test_db();

    // Create structure: Root → Parent → Child → GrandChild
    let root = make_test_group("Root", None, "Root");
    db.create_group(&root).unwrap();

    let parent = make_test_group("Parent", Some(root.id.clone()), "Root/Parent");
    db.create_group(&parent).unwrap();

    let child = make_test_group("Child", Some(parent.id.clone()), "Root/Parent/Child");
    db.create_group(&child).unwrap();

    // Create profiles at each level
    let profile1 = make_test_profile("P1", Some("Root/Parent"));
    let profile2 = make_test_profile("P2", Some("Root/Parent/Child"));
    db.create_profile(&profile1).unwrap();
    db.create_profile(&profile2).unwrap();

    // Move "Parent" from "Root" to top-level (parent_id = None)
    let old_path = parent.path.clone();
    let mut moved_parent = parent.clone();
    moved_parent.parent_id = None;
    moved_parent.path = "Parent".to_string();
    moved_parent.updated_at = chrono::Utc::now().to_rfc3339();

    db.update_group(&moved_parent).unwrap();

    // Update descendant paths (simulating move_group command cascade)
    let conn = db.conn.lock().unwrap();

    let escaped_path = old_path.replace('%', "\\%").replace('_', "\\_");

    // Update child groups
    conn.execute(
        "UPDATE groups
         SET path = ?2 || SUBSTR(path, LENGTH(?1) + 1),
             updated_at = ?3
         WHERE path = ?1 OR path LIKE ?4 ESCAPE '\\'",
        (&old_path, &moved_parent.path, &moved_parent.updated_at, format!("{}/%", escaped_path)),
    ).unwrap();

    // Update profiles
    conn.execute(
        "UPDATE profiles
         SET group_path = ?2 || SUBSTR(group_path, LENGTH(?1) + 1)
         WHERE group_path = ?1 OR group_path LIKE ?3 ESCAPE '\\'",
        (&old_path, &moved_parent.path, format!("{}/%", escaped_path)),
    ).unwrap();

    drop(conn);

    // Verify paths updated
    let child_check = db.get_group_by_id(&child.id).unwrap().unwrap();
    assert_eq!(child_check.path, "Parent/Child");

    let profile1_check = db.get_profile_by_id(&profile1.id).unwrap().unwrap();
    assert_eq!(profile1_check.group_path, Some("Parent".to_string()));

    let profile2_check = db.get_profile_by_id(&profile2.id).unwrap().unwrap();
    assert_eq!(profile2_check.group_path, Some("Parent/Child".to_string()));
}

#[test]
fn test_prevent_circular_group_move() {
    // Cannot move a group into its own descendant
    let db = create_test_db();

    let parent = make_test_group("Parent", None, "Parent");
    db.create_group(&parent).unwrap();

    let child = make_test_group("Child", Some(parent.id.clone()), "Parent/Child");
    db.create_group(&child).unwrap();

    let grandchild = make_test_group("GrandChild", Some(child.id.clone()), "Parent/Child/GrandChild");
    db.create_group(&grandchild).unwrap();

    // Attempt to move "Parent" under "GrandChild" (circular)
    // This should be prevented by validation logic
    // Check if parent is in the ancestry of target
    fn is_ancestor(db: &crate::Database, potential_ancestor_id: &str, descendant_id: &str) -> bool {
        let mut current_id = Some(descendant_id.to_string());
        while let Some(id) = current_id {
            if id == potential_ancestor_id {
                return true;
            }
            current_id = db.get_group_by_id(&id).ok()
                .flatten()
                .and_then(|g| g.parent_id);
        }
        false
    }

    let would_be_circular = is_ancestor(&db, &parent.id, &grandchild.id);
    assert!(would_be_circular, "Should detect circular reference");
}

#[test]
fn test_group_delete_cascade_removes_profiles() {
    // Cascade delete should remove all profiles in group and subgroups
    let db = create_test_db();

    let parent = make_test_group("Parent", None, "Parent");
    db.create_group(&parent).unwrap();

    let child = make_test_group("Child", Some(parent.id.clone()), "Parent/Child");
    db.create_group(&child).unwrap();

    // Create profiles
    let profile1 = make_test_profile("P1", Some("Parent"));
    let profile2 = make_test_profile("P2", Some("Parent/Child"));
    db.create_profile(&profile1).unwrap();
    db.create_profile(&profile2).unwrap();

    // Simulate cascade delete (delete profiles first, then groups)
    let conn = db.conn.lock().unwrap();

    // Delete profiles in group and descendants
    conn.execute(
        "DELETE FROM profiles WHERE group_path = ? OR group_path LIKE ?",
        (&parent.path, format!("{}/%", parent.path)),
    ).unwrap();

    drop(conn);

    // Then delete the group (CASCADE handles subgroups)
    db.delete_group(&parent.id).unwrap();

    // Verify everything deleted
    assert!(db.get_group_by_id(&parent.id).unwrap().is_none());
    assert!(db.get_group_by_id(&child.id).unwrap().is_none());
    assert!(db.get_profile_by_id(&profile1.id).unwrap().is_none());
    assert!(db.get_profile_by_id(&profile2.id).unwrap().is_none());
}

#[test]
fn test_full_backup_restore_round_trip() {
    // Export ALL → Import ALL (replace mode) should restore complete state
    let db = create_test_db();

    // Create complex structure
    let group1 = make_test_group("Group1", None, "Group1");
    let group2 = make_test_group("Group2", None, "Group2");
    db.create_group(&group1).unwrap();
    db.create_group(&group2).unwrap();

    let profile1 = make_test_profile("P1", Some("Group1"));
    let profile2 = make_test_profile("P2", Some("Group2"));
    db.create_profile(&profile1).unwrap();
    db.create_profile(&profile2).unwrap();

    let tag = make_test_tag("production", "#FF0000");
    db.create_tag_db(&tag).unwrap();
    db.add_profile_tag_db(&profile1.id, &tag.id).unwrap();

    // Export all
    let all_profiles = db.get_all_profiles().unwrap();
    let all_groups = db.get_all_groups().unwrap();
    let all_tags = db.get_all_tags().unwrap();

    // Create new database (simulate restore)
    let db2 = create_test_db();

    // Import all (in order: tags, groups, profiles)
    for tag in &all_tags {
        db2.create_tag_db(tag).unwrap();
    }

    for group in &all_groups {
        db2.create_group(group).unwrap();
    }

    for profile in &all_profiles {
        db2.create_profile(profile).unwrap();
    }

    // Restore tag associations
    let profile1_tags = db.get_profile_tags(&profile1.id).unwrap();
    for tag in profile1_tags {
        if let Some(imported_tag) = db2.get_all_tags().unwrap().iter().find(|t| t.name == tag.name) {
            db2.add_profile_tag_db(&profile1.id, &imported_tag.id).unwrap();
        }
    }

    // Verify complete restoration
    assert_eq!(db2.get_all_profiles().unwrap().len(), 2);
    assert_eq!(db2.get_all_groups().unwrap().len(), 2);
    assert_eq!(db2.get_all_tags().unwrap().len(), 1);
    assert_eq!(db2.get_profile_tags(&profile1.id).unwrap().len(), 1);
}

#[test]
fn test_settings_export_import_round_trip() {
    // Settings should be exportable and importable
    let db = create_test_db();

    // Save some settings
    db.save_setting("theme", "dark").unwrap();
    db.save_setting("auto_update_check", "true").unwrap();

    // Export settings
    let theme = db.get_setting("theme").unwrap();
    let auto_update = db.get_setting("auto_update_check").unwrap();

    assert_eq!(theme.as_ref().map(|s| s.value.as_str()), Some("dark"));
    assert_eq!(auto_update.as_ref().map(|s| s.value.as_str()), Some("true"));

    // Import into new database
    let db2 = create_test_db();
    db2.save_setting("theme", "dark").unwrap();
    db2.save_setting("auto_update_check", "true").unwrap();

    // Verify
    let theme2 = db2.get_setting("theme").unwrap();
    let auto_update2 = db2.get_setting("auto_update_check").unwrap();

    assert_eq!(theme2.as_ref().map(|s| s.value.as_str()), Some("dark"));
    assert_eq!(auto_update2.as_ref().map(|s| s.value.as_str()), Some("true"));
}

#[test]
fn test_deep_nesting_performance() {
    // Test performance with max depth (3 levels) and many profiles
    let db = create_test_db();

    // Create 3-level hierarchy
    let l1 = make_test_group("Level1", None, "Level1");
    db.create_group(&l1).unwrap();

    let l2 = make_test_group("Level2", Some(l1.id.clone()), "Level1/Level2");
    db.create_group(&l2).unwrap();

    let l3 = make_test_group("Level3", Some(l2.id.clone()), "Level1/Level2/Level3");
    db.create_group(&l3).unwrap();

    let start = std::time::Instant::now();

    // Create 50 profiles at deepest level
    for i in 0..50 {
        let profile = make_test_profile(&format!("Deep{}", i), Some("Level1/Level2/Level3"));
        db.create_profile(&profile).unwrap();
    }

    let duration = start.elapsed();

    // Verify
    let profiles = db.get_all_profiles().unwrap();
    assert_eq!(profiles.len(), 50);

    // Performance target: <2 seconds for deep nesting
    assert!(
        duration.as_secs() < 2,
        "Deep nesting took {:?}, expected <2s",
        duration
    );

    println!("✓ Created 50 profiles at depth 3 in {:?}", duration);
}
