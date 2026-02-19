use crate::{
    validate_hostname,
    validate_username,
    validate_profile_name,
    validate_port,
    validate_description,
    validate_group,
    validate_host_or_ip,
    validate_ipv4,
};

// Hostname validation
#[test]
fn test_validate_hostname_success() {
    assert!(validate_hostname("example.com").is_ok());
    assert!(validate_hostname("sub.example.com").is_ok());
    assert!(validate_hostname("host-name").is_ok());
    assert!(validate_hostname("host_name").is_ok());
}

#[test]
fn test_validate_hostname_empty() {
    assert!(validate_hostname("").is_err());
}

#[test]
fn test_validate_hostname_too_long() {
    let long_host = "a".repeat(65);
    assert!(validate_hostname(&long_host).is_err());
}

#[test]
fn test_validate_hostname_invalid_chars() {
    assert!(validate_hostname("host;name").is_err());
    assert!(validate_hostname("host&name").is_err());
    assert!(validate_hostname("host|name").is_err());
    assert!(validate_hostname("host`name").is_err());
}

// Username validation
#[test]
fn test_validate_username_success() {
    assert!(validate_username("user").is_ok());
    assert!(validate_username("user123").is_ok());
    assert!(validate_username("user_name").is_ok());
    assert!(validate_username("user-name").is_ok());
    assert!(validate_username("user.name").is_ok());
    assert!(validate_username("user@proxy").is_ok());
    assert!(validate_username("user#1234").is_ok());
}

#[test]
fn test_validate_username_empty() {
    assert!(validate_username("").is_err());
}

#[test]
fn test_validate_username_too_long() {
    let long_user = "a".repeat(129);
    assert!(validate_username(&long_user).is_err());
}

#[test]
fn test_validate_username_invalid_chars() {
    assert!(validate_username("user;name").is_err());
    assert!(validate_username("user&name").is_err());
    assert!(validate_username("user name").is_err()); // spaces not allowed
}

// Profile name validation
#[test]
fn test_validate_profile_name_success() {
    assert!(validate_profile_name("Server 1").is_ok());
    assert!(validate_profile_name("Server-1").is_ok());
    assert!(validate_profile_name("Server_1").is_ok());
    assert!(validate_profile_name("Server (Production)").is_ok());
    assert!(validate_profile_name("Server [Test]").is_ok());
    assert!(validate_profile_name("Server.1").is_ok());
    assert!(validate_profile_name("Server#1").is_ok());
}

#[test]
fn test_validate_profile_name_empty() {
    assert!(validate_profile_name("").is_err());
}

#[test]
fn test_validate_profile_name_too_long() {
    let long_name = "a".repeat(65);
    assert!(validate_profile_name(&long_name).is_err());
}

#[test]
fn test_validate_profile_name_invalid_chars() {
    assert!(validate_profile_name("Server;1").is_err());
    assert!(validate_profile_name("Server&1").is_err());
    assert!(validate_profile_name("Server|1").is_err());
}

// Port validation
#[test]
fn test_validate_port_success() {
    assert_eq!(validate_port(22).unwrap(), 22);
    assert_eq!(validate_port(80).unwrap(), 80);
    assert_eq!(validate_port(443).unwrap(), 443);
    assert_eq!(validate_port(65535).unwrap(), 65535);
}

#[test]
fn test_validate_port_invalid() {
    assert!(validate_port(0).is_err());
    assert!(validate_port(-1).is_err());
    assert!(validate_port(65536).is_err());
}

// Description validation
#[test]
fn test_validate_description_success() {
    assert!(validate_description("A test description").is_ok());
    assert!(validate_description("").is_ok()); // empty is allowed
}

#[test]
fn test_validate_description_too_long() {
    let long_desc = "a".repeat(129);
    assert!(validate_description(&long_desc).is_err());
}

#[test]
fn test_validate_description_invalid_chars() {
    assert!(validate_description("Test <script>").is_err());
    assert!(validate_description("Test >output").is_err());
}

// Group validation
#[test]
fn test_validate_group_success() {
    assert!(validate_group("Work").is_ok());
    assert!(validate_group("Work/Production").is_ok());
    assert!(validate_group("Work/Production/Servers").is_ok());
}

#[test]
fn test_validate_group_empty() {
    assert!(validate_group("").is_ok()); // Group is optional
}

#[test]
fn test_validate_group_too_long() {
    // Max path length is 194 characters (64+1+64+1+64 = 194 for 3 levels)
    // Create a path that's 195 characters
    let long_path = format!("{}/{}/{}", "a".repeat(64), "b".repeat(64), "c".repeat(65));
    assert!(validate_group(&long_path).is_err());
}

#[test]
fn test_validate_group_reserved_name() {
    assert!(validate_group("Ungrouped").is_err());
    assert!(validate_group("ungrouped").is_err());
    assert!(validate_group("UNGROUPED").is_err());
}

#[test]
fn test_validate_group_empty_segments() {
    assert!(validate_group("Work//Production").is_err());
}

// IPv4 validation
#[test]
fn test_validate_ipv4_success() {
    assert!(validate_ipv4("192.168.1.1").is_ok());
    assert!(validate_ipv4("10.0.0.1").is_ok());
    assert!(validate_ipv4("255.255.255.255").is_ok());
    assert!(validate_ipv4("0.0.0.0").is_ok());
}

#[test]
fn test_validate_ipv4_invalid() {
    assert!(validate_ipv4("256.1.1.1").is_err());
    assert!(validate_ipv4("1.1.1").is_err());
    assert!(validate_ipv4("1.1.1.1.1").is_err());
    assert!(validate_ipv4("abc.def.ghi.jkl").is_err());
}

// Host or IP validation
#[test]
fn test_validate_host_or_ip_hostname() {
    assert!(validate_host_or_ip("example.com").is_ok());
}

#[test]
fn test_validate_host_or_ip_ipv4() {
    assert!(validate_host_or_ip("192.168.1.1").is_ok());
}

#[test]
fn test_validate_host_or_ip_empty() {
    assert!(validate_host_or_ip("").is_err());
}
