# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.9.3   | :white_check_mark: |
| < 0.9.3 | :x:                |

## Reporting a Vulnerability

We take the security of SSH Profile Manager seriously. If you discover a security vulnerability, please follow these steps:

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please use **GitHub Security Advisories**:

1. Go to the [Security tab](https://github.com/tomsinclair94/ssh-profile-manager/security/advisories)
2. Click "Report a vulnerability"
3. Fill out the form with details

Your report will be received privately and you will be kept updated throughout the process.

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., command injection, XSS, path traversal)
- Full paths of affected source files
- Location of the affected code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability (what an attacker could do)

### What to Expect

- **Acknowledgment:** We'll acknowledge receipt within 48 hours
- **Assessment:** We'll investigate and assess severity within 5 business days
- **Updates:** We'll keep you informed of progress
- **Fix Timeline:**
  - Critical/High: 7 days for patch
  - Medium: 30 days for patch
  - Low: Next scheduled release
- **Disclosure:** We'll coordinate disclosure timing with you
- **Credit:** We'll credit you in release notes (unless you prefer to remain anonymous)

## Security Features

SSH Profile Manager includes several security measures:

- **Password Storage:** System keychain integration (not stored in database)
- **Input Validation:** All user inputs validated on backend to prevent injection attacks
- **Path Traversal Protection:** SSH key paths sanitized and validated
- **Command Injection Prevention:** Shell commands properly escaped
- **Rate Limiting:** Protection against DoS via rapid operations
- **Temp File Security:** Temporary password files created atomically with restricted permissions (Unix: `O_CREAT|mode 0600`; Windows: `icacls /inheritance:r` grants only the current user — resolved via `whoami` for domain account safety); askpass helper deletes password file immediately after first read; 30s background safety-net cleanup for unreachable-host scenarios
- **SSH_ASKPASS Integration:** Passwords retrieved from keychain and zeroized in memory immediately after temp file write; state machine askpass (v0.9.2) fails fast on bad-password retry and relays proxy/2FA prompts to the terminal
- **Central Passwords:** Shared credentials stored exclusively in the system keychain (never in the database); keychain operations gated on DB existence checks to prevent arbitrary keychain writes
- **Encrypted Exports:** AES-256-GCM authenticated encryption with PBKDF2-HMAC-SHA256 key derivation (600k iterations)
- **Export Integrity:** HMAC-SHA256 verification detects tampering before decryption begins
- **Mandatory Encryption:** Exports containing password-authenticated profiles require encryption (cannot be bypassed)
- **CSP Compliance:** Strict Content Security Policy with no external CDN dependencies (xterm.js vendored locally)

## Security Updates

Security updates are released as patch versions (e.g., 0.6.1) and documented in CHANGELOG.md with CVSS scores where applicable.

Subscribe to [GitHub releases](https://github.com/tomsinclair94/ssh-profile-manager/releases) to be notified of security updates.

## Security Review History

This project undergoes regular security reviews:
- **v0.9.3:** Patch release — code review + security review scoped to branch changes only (0 CRITICAL, 0 HIGH, 0 MEDIUM, 2 LOW — both accepted as intentional); key fixes: SSH failure toast extended to key and none auth methods, Windows password file ACL race eliminated (create-empty-before-write pattern). Dependency audit: 0 vulnerabilities.
- **v0.9.2:** Patch release — code review + security review scoped to branch changes only (1 CRITICAL, 1 HIGH, 2 MEDIUM — all resolved); key fixes: batch argument escaping applied consistently across all Windows launchers, `whoami` replaces `%USERNAME%` for domain-safe ACL grants, `&&`/`||` logic bug in macOS status write replaced with `if/then/else`, status file cleanup race between polling thread and safety-net removed. Dependency audit: 0 vulnerabilities.
- **v0.9.1:** Patch release — security review scoped to new code only (0 CRITICAL, 0 HIGH, 0 MEDIUM); Windows `spm-askpass.exe` helper assessed as net security improvement over previous temp `.bat` approach (bundled exe in admin-protected install dir vs. user-writable `%TEMP%`). Dependency audit: 0 vulnerabilities.
- **v0.9.0:** Feature release — code review (1 CRITICAL, 4 HIGH, 6 MEDIUM — all resolved) + security review (0 CRITICAL, 1 HIGH, 5 MEDIUM — all resolved); key fixes: TOCTOU-safe temp file creation, password zeroization after use, DB existence checks before keychain access, custom `Debug` impl redacting passwords, input validation on central password descriptions and import paths. Dependency audit (`cargo audit`): 0 vulnerabilities; 19 Linux-only GTK3 warnings (pre-existing, not applicable to macOS/Windows targets).
- **v0.8.0:** Feature release — code review (0 CRITICAL, 0 HIGH after fixes) + security review (0 CRITICAL, 0 HIGH, 1 MEDIUM, 3 LOW — all resolved)
- **v0.7.1:** Patch release — no security-specific findings; 4 UI/UX bug fixes only
- **v0.7.0:** Comprehensive security review (1 CRITICAL, 6 HIGH, 9 MEDIUM, 4 LOW findings — 20 resolved, 12 deferred to v1.0.0)
- **v0.6.4:** Security hardening sprint (16+ fixes — temp file security, SSH host key verification, session management, CDN elimination)
- **v0.6.3:** Security fixes (2 CRITICAL mutex/script exposure, 3 MEDIUM findings resolved)
- **v0.6.0:** Comprehensive security review (0 CRITICAL, 0 HIGH, 3 MEDIUM, 2 LOW findings — all resolved)
- **v0.5.2:** Security enhancements (2 MEDIUM, 1 LOW findings resolved)
- **v0.5.1:** Security fixes (3 MEDIUM XSS/injection fixes)
- **v0.5.0:** Critical security fixes (2 CRITICAL command injection, 1 HIGH fixes)

See CHANGELOG.md for detailed security fix history.
