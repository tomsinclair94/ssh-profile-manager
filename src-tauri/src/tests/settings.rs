use super::helpers::*;

#[test]
fn test_save_and_get_setting() {
    let db = create_test_db();

    db.save_setting("theme", "dark").unwrap();
    let setting = db.get_setting("theme").unwrap().unwrap();

    assert_eq!(setting.key, "theme");
    assert_eq!(setting.value, "dark");
}

#[test]
fn test_get_setting_not_found() {
    let db = create_test_db();
    let setting = db.get_setting("non_existent").unwrap();
    assert!(setting.is_none());
}

#[test]
fn test_save_setting_upserts() {
    let db = create_test_db();

    db.save_setting("theme", "light").unwrap();
    db.save_setting("theme", "dark").unwrap();

    let setting = db.get_setting("theme").unwrap().unwrap();
    assert_eq!(setting.value, "dark");
}
