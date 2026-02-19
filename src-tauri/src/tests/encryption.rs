use crate::{
    decrypt_data,
    decrypt_import_if_encrypted,
    detect_encrypted_export,
    derive_key,
    encrypt_data,
    export_requires_encryption,
    generate_hmac,
    validate_encryption_password,
    verify_hmac,
    EncryptedExport,
    Profile,
};

// --------------------------------------------------------------
// Password validation
// --------------------------------------------------------------

#[test]
fn test_password_validation_empty() {
    assert!(validate_encryption_password("").is_err());
}

#[test]
fn test_password_validation_too_short() {
    // 11 characters — one short of the 12-character minimum
    assert!(validate_encryption_password("abcdefghijk").is_err());
}

#[test]
fn test_password_validation_minimum_length() {
    // Exactly 12 characters — the lower boundary that should pass
    assert!(validate_encryption_password("abcdefghijkl").is_ok());
}

#[test]
fn test_password_validation_unicode() {
    // 6 Cyrillic chars + 6 ASCII chars = 12 characters exactly (lower boundary)
    assert!(validate_encryption_password("пароль123456").is_ok());
}

#[test]
fn test_password_validation_max_length() {
    // Exactly 128 characters — the upper boundary that should pass
    let password: String = "a".repeat(128);
    assert!(validate_encryption_password(&password).is_ok());
}

#[test]
fn test_password_validation_too_long() {
    // 129 characters — one over the 128-character maximum
    let password: String = "a".repeat(129);
    assert!(validate_encryption_password(&password).is_err());
}

#[test]
fn test_password_validation_max_length_unicode() {
    // 128 multibyte characters — max boundary with non-ASCII (chars, not bytes)
    let password: String = "п".repeat(128);
    assert!(validate_encryption_password(&password).is_ok());
}

#[test]
fn test_password_validation_too_long_unicode() {
    // 129 multibyte characters — confirms the limit is on chars, not bytes
    let password: String = "п".repeat(129);
    assert!(validate_encryption_password(&password).is_err());
}

// --------------------------------------------------------------
// Key derivation
// --------------------------------------------------------------

#[test]
fn test_derive_key_deterministic() {
    // Same password + same salt must always produce the same key
    let salt = [0x42u8; 16];
    let key_a = derive_key("test_password_1!", &salt).unwrap();
    let key_b = derive_key("test_password_1!", &salt).unwrap();
    assert_eq!(key_a, key_b);
}

#[test]
fn test_derive_key_different_salt_produces_different_key() {
    let key_a = derive_key("test_password_1!", &[0x01u8; 16]).unwrap();
    let key_b = derive_key("test_password_1!", &[0x02u8; 16]).unwrap();
    assert_ne!(key_a, key_b);
}

#[test]
fn test_derive_key_invalid_salt_length() {
    assert!(derive_key("test_password_1!", &[0u8; 8]).is_err());  // too short
    assert!(derive_key("test_password_1!", &[0u8; 32]).is_err()); // too long
}

// --------------------------------------------------------------
// HMAC generation & verification
// --------------------------------------------------------------

#[test]
fn test_hmac_round_trip() {
    let salt = [0x01u8; 16];
    let iv = [0x02u8; 12];
    let ciphertext = b"sample ciphertext payload";
    let key = [0x03u8; 32];

    let hmac = generate_hmac(&salt, &iv, ciphertext, &key);
    assert!(verify_hmac(&hmac, &salt, &iv, ciphertext, &key));
}

#[test]
fn test_hmac_fails_on_any_tampered_input() {
    let salt = [0x01u8; 16];
    let iv = [0x02u8; 12];
    let ciphertext = b"original ciphertext";
    let key = [0x03u8; 32];

    let hmac = generate_hmac(&salt, &iv, ciphertext, &key);

    // Each single-field modification must invalidate the HMAC
    assert!(!verify_hmac(&hmac, &[0xFFu8; 16], &iv, ciphertext, &key)); // salt
    assert!(!verify_hmac(&hmac, &salt, &[0xFFu8; 12], ciphertext, &key)); // IV
    assert!(!verify_hmac(&hmac, &salt, &iv, b"tampered ciphertext", &key)); // data
    assert!(!verify_hmac(&[0xFFu8; 32], &salt, &iv, ciphertext, &key)); // HMAC itself
}

// --------------------------------------------------------------
// Encrypt / decrypt round-trips
// --------------------------------------------------------------

#[test]
fn test_round_trip_basic() {
    let plaintext = r#"{"name":"server1","host":"example.com","port":22}"#;
    let encrypted = encrypt_data(plaintext, "secure_password_1").unwrap();
    assert_eq!(decrypt_data(&encrypted, "secure_password_1").unwrap(), plaintext);
}

#[test]
fn test_round_trip_unicode_password() {
    let plaintext = r#"{"name":"test"}"#;
    let password = "пароль_пароль_12"; // Cyrillic + ASCII, well over 12 bytes

    let encrypted = encrypt_data(plaintext, password).unwrap();
    assert_eq!(decrypt_data(&encrypted, password).unwrap(), plaintext);
}

#[test]
fn test_round_trip_special_characters_in_plaintext() {
    let plaintext =
        r#"{"name":"srv™ ©®","desc":"héllo wörld café","path":"C:\\Users\\test"}"#;

    let encrypted = encrypt_data(plaintext, "secure_password_1").unwrap();
    assert_eq!(decrypt_data(&encrypted, "secure_password_1").unwrap(), plaintext);
}

#[test]
fn test_round_trip_large_payload() {
    // ~100 serialised profile entries to simulate a full backup
    let entry = r#"{"id":"a","name":"profile","host":"h.com","port":22,"username":"u","auth_method":"key"}"#;
    let plaintext = format!(r#"{{"profiles":[{}]}}"#, vec![entry; 100].join(","));

    let encrypted = encrypt_data(&plaintext, "secure_password_1").unwrap();
    assert_eq!(decrypt_data(&encrypted, "secure_password_1").unwrap(), plaintext);
}

#[test]
fn test_round_trip_empty_plaintext() {
    let encrypted = encrypt_data("", "secure_password_1").unwrap();
    assert_eq!(decrypt_data(&encrypted, "secure_password_1").unwrap(), "");
}

// --------------------------------------------------------------
// Randomness — each encryption must produce distinct output
// --------------------------------------------------------------

#[test]
fn test_encrypt_produces_unique_ciphertexts() {
    let plaintext = r#"{"name":"test"}"#;
    let password = "secure_password_1";

    let enc_a = encrypt_data(plaintext, password).unwrap();
    let enc_b = encrypt_data(plaintext, password).unwrap();

    // Random salt and IV must differ; ciphertext and HMAC follow
    assert_ne!(enc_a.salt, enc_b.salt);
    assert_ne!(enc_a.iv, enc_b.iv);
    assert_ne!(enc_a.data, enc_b.data);
    assert_ne!(enc_a.hmac, enc_b.hmac);
}

// --------------------------------------------------------------
// EncryptedExport metadata
// --------------------------------------------------------------

#[test]
fn test_encrypted_export_metadata_fields() {
    let encrypted = encrypt_data(r#"{}"#, "secure_password_1").unwrap();

    assert_eq!(encrypted.version, "2.0");
    assert!(encrypted.encrypted);
    assert_eq!(encrypted.cipher, "AES-256-GCM");
    assert_eq!(encrypted.kdf, "PBKDF2-HMAC-SHA256");
    assert_eq!(encrypted.kdf_iterations, 600_000);
}

// --------------------------------------------------------------
// Wrong password
// --------------------------------------------------------------

#[test]
fn test_wrong_password_rejected() {
    let encrypted = encrypt_data(r#"{"name":"test"}"#, "correct_password_").unwrap();

    // Wrong password → different derived key → HMAC fails before
    // AES-GCM is attempted (fail-fast).  Wrong-password and tampering
    // intentionally produce the same error to avoid information leakage.
    let err = decrypt_data(&encrypted, "wrong_password__").unwrap_err();
    assert!(err.contains("has been tampered with"));
}

// --------------------------------------------------------------
// HMAC tampering detection — each exported field independently
// --------------------------------------------------------------

#[test]
fn test_tampered_data_field_detected() {
    let mut enc = encrypt_data(r#"{"name":"test"}"#, "secure_password_1").unwrap();
    enc.data = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        b"this is not the real ciphertext",
    );
    assert!(decrypt_data(&enc, "secure_password_1").is_err());
}

#[test]
fn test_tampered_hmac_field_detected() {
    let mut enc = encrypt_data(r#"{"name":"test"}"#, "secure_password_1").unwrap();
    enc.hmac = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &[0u8; 32],
    );
    assert!(decrypt_data(&enc, "secure_password_1").is_err());
}

#[test]
fn test_tampered_salt_field_detected() {
    let mut enc = encrypt_data(r#"{"name":"test"}"#, "secure_password_1").unwrap();
    enc.salt = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &[0xFFu8; 16],
    );
    assert!(decrypt_data(&enc, "secure_password_1").is_err());
}

#[test]
fn test_tampered_iv_field_detected() {
    let mut enc = encrypt_data(r#"{"name":"test"}"#, "secure_password_1").unwrap();
    enc.iv = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &[0xFFu8; 12],
    );
    assert!(decrypt_data(&enc, "secure_password_1").is_err());
}

// --------------------------------------------------------------
// Unsupported algorithm rejection
// --------------------------------------------------------------

#[test]
fn test_decrypt_rejects_unsupported_cipher() {
    let enc = EncryptedExport {
        version: "2.0".to_string(),
        encrypted: true,
        cipher: "AES-128-CBC".to_string(),
        kdf: "PBKDF2-HMAC-SHA256".to_string(),
        kdf_iterations: 600_000,
        salt: String::new(),
        iv: String::new(),
        data: String::new(),
        hmac: String::new(),
    };

    let err = decrypt_data(&enc, "secure_password_1").unwrap_err();
    assert!(err.contains("Unsupported cipher"));
}

#[test]
fn test_decrypt_rejects_unsupported_kdf() {
    let enc = EncryptedExport {
        version: "2.0".to_string(),
        encrypted: true,
        cipher: "AES-256-GCM".to_string(),
        kdf: "scrypt".to_string(),
        kdf_iterations: 600_000,
        salt: String::new(),
        iv: String::new(),
        data: String::new(),
        hmac: String::new(),
    };

    let err = decrypt_data(&enc, "secure_password_1").unwrap_err();
    assert!(err.contains("Unsupported KDF"));
}

// --------------------------------------------------------------
// export_requires_encryption
// --------------------------------------------------------------

/// Minimal Profile with only auth_method varied; all other fields
/// are irrelevant to the encryption-requirement check.
fn make_profile(auth_method: &str) -> Profile {
    Profile {
        id: "test-id".to_string(),
        name: "Test Profile".to_string(),
        description: None,
        host: "example.com".to_string(),
        port: 22,
        username: "user".to_string(),
        auth_method: auth_method.to_string(),
        key_path: None,
        group_path: None,
    }
}

#[test]
fn test_export_requires_encryption_password_profile() {
    assert!(export_requires_encryption(&[make_profile("password")]));
}

#[test]
fn test_export_requires_encryption_key_auth_only() {
    assert!(!export_requires_encryption(&[make_profile("key")]));
}

#[test]
fn test_export_requires_encryption_mixed() {
    // One password-auth profile among key-auth is enough to require encryption
    assert!(export_requires_encryption(&[
        make_profile("key"),
        make_profile("password"),
    ]));
}

#[test]
fn test_export_requires_encryption_empty() {
    let empty: &[Profile] = &[];
    assert!(!export_requires_encryption(empty));
}

// --------------------------------------------------------------
// detect_encrypted_export
// --------------------------------------------------------------

#[test]
fn test_detect_encrypted_export_true() {
    assert!(detect_encrypted_export(
        r#"{"encrypted":true,"version":"2.0"}"#
    ));
}

#[test]
fn test_detect_encrypted_export_plain_json() {
    assert!(!detect_encrypted_export(
        r#"{"version":"1.0","profiles":[]}"#
    ));
}

#[test]
fn test_detect_encrypted_export_encrypted_false() {
    // Explicit false must not be treated as encrypted
    assert!(!detect_encrypted_export(
        r#"{"encrypted":false,"version":"1.0"}"#
    ));
}

#[test]
fn test_detect_encrypted_export_invalid_json() {
    assert!(!detect_encrypted_export("not json at all"));
    assert!(!detect_encrypted_export(""));
}

// --------------------------------------------------------------
// decrypt_import_if_encrypted
// --------------------------------------------------------------

#[test]
fn test_decrypt_import_plain_passthrough() {
    // Plain (non-encrypted) data must pass through unchanged
    let plain = r#"{"version":"1.0","profiles":[]}"#;
    assert_eq!(
        decrypt_import_if_encrypted(plain, &None).unwrap(),
        plain
    );
}

#[test]
fn test_decrypt_import_encrypted_no_password_fails() {
    // Encrypted payload with no password supplied must error
    let encrypted = encrypt_data(r#"{"name":"test"}"#, "secure_password_1").unwrap();
    let json = serde_json::to_string(&encrypted).unwrap();

    let err = decrypt_import_if_encrypted(&json, &None).unwrap_err();
    assert!(err.contains("encrypted"));
}

#[test]
fn test_decrypt_import_encrypted_with_correct_password() {
    let plaintext = r#"{"name":"test"}"#;
    let password = "secure_password_1";

    let encrypted = encrypt_data(plaintext, password).unwrap();
    let json = serde_json::to_string(&encrypted).unwrap();

    let result =
        decrypt_import_if_encrypted(&json, &Some(password.to_string())).unwrap();
    assert_eq!(result, plaintext);
}
