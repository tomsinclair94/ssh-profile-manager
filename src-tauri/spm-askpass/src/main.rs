// SSH_ASKPASS helper binary for Windows.
// SSH cannot CreateProcess a .bat file, so this tiny exe acts as the
// SSH_ASKPASS program. It reads the password from the file path given
// in SPM_PASSWORD_FILE and writes it to stdout for SSH to consume.
fn main() {
    let pwd_file = match std::env::var("SPM_PASSWORD_FILE") {
        Ok(p) => p,
        Err(_) => {
            eprintln!("spm-askpass: SPM_PASSWORD_FILE not set");
            std::process::exit(1);
        }
    };

    let password = match std::fs::read_to_string(&pwd_file) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("spm-askpass: failed to read password file: {}", e);
            std::process::exit(1);
        }
    };

    // SSH expects the passphrase on stdout, without a trailing newline.
    print!("{}", password.trim_end_matches(['\n', '\r']));
}
