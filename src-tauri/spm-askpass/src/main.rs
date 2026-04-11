// SSH_ASKPASS helper binary for Windows.
// SSH cannot CreateProcess a .bat file, so this tiny exe acts as the
// SSH_ASKPASS program. It is invoked by SSH with the prompt text as the
// first argument each time SSH needs input.
//
// State machine — driven by whether SPM_PASSWORD_FILE still exists:
//
//   File EXISTS (first invocation):
//     Deliver the stored password and delete the file.
//
//   File GONE + non-password prompt (proxy follow-up challenges):
//     Relay the prompt to the console and read the user's reply.
//     Handles any number of follow-up inputs (reason, token, etc.)
//     without assuming prompt text or number of prompts.
//
//   File GONE + password/passphrase prompt (wrong-password retry):
//     Exit with error immediately — fail fast rather than prompting
//     the user interactively. SSH prints "Permission denied" and closes.
//
// Used with SSH_ASKPASS_REQUIRE=force so SSH always routes input through
// this program even when a console window is present (required on Windows —
// "prefer" is ignored when a console exists).

fn main() {
    let pwd_file = match std::env::var("SPM_PASSWORD_FILE") {
        Ok(p) => p,
        Err(_) => {
            eprintln!("spm-askpass: SPM_PASSWORD_FILE not set");
            std::process::exit(1);
        }
    };

    if std::path::Path::new(&pwd_file).exists() {
        // First invocation — deliver the stored password
        deliver_stored_password(&pwd_file);
    } else {
        // Subsequent invocation — file was already consumed
        let args: Vec<String> = std::env::args().collect();
        let prompt = args.get(1).map(|s| s.as_str()).unwrap_or("");
        let prompt_lower = prompt.to_lowercase();

        let is_password_retry = prompt_lower.contains("password") || prompt_lower.contains("passphrase");

        if is_password_retry {
            // The stored password was wrong — SSH is asking again.
            // Fail fast: exit non-zero so SSH aborts with "Permission denied"
            // rather than leaving the user with an interactive password prompt.
            eprintln!("spm-askpass: stored password was rejected; aborting retry");
            std::process::exit(1);
        } else {
            // Proxy or server is asking for additional non-password input
            // (e.g. reason for access, MFA token). Relay to the user.
            relay_console_prompt(prompt);
        }
    }
}

// Read the stored password, delete the file, write the password to stdout.
fn deliver_stored_password(pwd_file: &str) {
    let password = match std::fs::read_to_string(pwd_file) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("spm-askpass: failed to read password file: {}", e);
            std::process::exit(1);
        }
    };

    // Delete immediately — the file's absence is the signal that the password
    // has already been delivered (used by subsequent invocations above).
    let _ = std::fs::remove_file(pwd_file);

    // SSH expects the passphrase on stdout, without a trailing newline
    print!("{}", password.trim_end_matches(['\n', '\r']));
}

// For any prompt after the initial password: relay to the user via the
// console window.  spm-askpass is a child of ssh which is a child of
// cmd.exe, so it shares the same console — CONIN$/CONOUT$ give direct
// access to it even if SSH has piped our stdin/stdout.
fn relay_console_prompt(prompt: &str) {
    use std::io::{self, BufRead, Write};

    // Print the prompt so the user can see what is being asked
    if let Ok(mut conout) = std::fs::OpenOptions::new().write(true).open("CONOUT$") {
        let _ = write!(conout, "{}", prompt);
        let _ = conout.flush();
    } else {
        eprint!("{}", prompt);
        let _ = io::stderr().flush();
    }

    // Read the user's reply from the console input buffer.
    // CONIN$ works even when SSH has piped our stdin, because it reads
    // directly from the console rather than the inherited stdin handle.
    if let Ok(conin) = std::fs::OpenOptions::new().read(true).open("CONIN$") {
        let mut reader = io::BufReader::new(conin);
        let mut input = String::new();
        if reader.read_line(&mut input).is_ok() {
            print!("{}", input.trim_end_matches(['\n', '\r']));
            return;
        }
    }

    // Fall back to stdin (works if SSH inherits console handles directly)
    let stdin = io::stdin();
    let mut input = String::new();
    if stdin.lock().read_line(&mut input).is_ok() {
        print!("{}", input.trim_end_matches(['\n', '\r']));
        return;
    }

    // Last resort: empty string
    print!("");
}
