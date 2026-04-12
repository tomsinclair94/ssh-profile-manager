# SSH Profile Manager - TODO & Roadmap

## Current Version: v0.9.2 — Release Ready

**Latest Release:** v0.9.2 (2026-04-12) ✅
**Branch:** `v0.9.2-dev` (all work complete; PR pending)
**Focus:** Windows SSH password auth fixes + in-app failure toast; macOS parity

---

### Release Checklist

- [x] All development complete and tested (Windows CMD, WT, PowerShell; macOS Terminal.app)
- [x] All automated tests pass (`cargo test --lib`) — 163/163
- [x] Developer tools disabled (`tauri.conf.json`)
- [x] Code review + security review complete; all CRITICAL/HIGH/MEDIUM issues resolved
- [x] Both changelogs updated (`CHANGELOG.md` + `dist/main.js` `VERSION_CHANGELOG`)
- [x] Docs updated (`CLAUDE.md`, `TODO.md`, `SECURITY.md`, `DEVELOPMENT.md`)
- [x] Committed & pushed
- [ ] Create PR → `main` with `--label "bug"`
- [ ] Enable auto-merge (squash); commit title must start with `Release v0.9.2`

**Note — proxy multi-step auth:** Expected to work based on the spm-askpass state machine design; confirmation requires work proxy/2FA environment. Any issues addressed in v0.9.3.

---

## Versioning Policy

- **Feature releases** (`vX.Y.0`) — new features; order and timing are flexible and not predetermined
- **Patch releases** (`vX.Y.1`) — bug fixes against the most recent feature release only; issued as needed
- **v1.0.0** — major stable release following a full refactoring sprint
- Feature plans are not assigned to a specific version until development begins on that branch

---

## Roadmap

```
... → v0.9.1 ✅ → v0.9.2 → v0.9.3 → v0.10.0 → ... → v1.0.0
```

---

## Planned Features

See `plans/feature-multi-tab-system.md` and `plans/feature-terminal-customization.md` for detailed plans.

### v0.9.3 - Planned

**Focus:** SSH connection failure detection for key and no-auth profiles

- **Key auth failure toast** — expand polling/status mechanism to `auth_method = 'key'`; if the key is rejected (SSH exits non-zero), surface a toast: "SSH key not permitted — check the key is authorised on the server. Edit the profile to update the key path."
- **None/interactive auth failure toast** — expand to `auth_method = 'none'`; if the user fails keyboard-interactive auth (too many attempts, SSH exits non-zero), surface a generic toast: "SSH connection failed — the server closed the connection."
- Both use the same status file + polling thread mechanism already in place for password auth; the main change is spawning the monitor thread and writing OK/FAIL in the terminal script for non-password profiles
- **Windows password file world-readable window** — refactor `create_file_windows_secure` to write content only after icacls has been applied (create empty → icacls → write content), eliminating the brief window where the file exists with default permissions before ACL restriction

---

### Feature Backlog
- Tag hierarchy
- SFTP support
- Port forwarding
- Jump hosts
- SSH config modification
- Multi-Tab System — app-level tabs and pop-out windows
- Terminal Customisation — fonts, colour schemes, accessibility
- Audit logging for security events

### v1.0.0 - Major Refactoring Sprint
**Status:** Planned (after all feature releases)
**Focus:** 40-50% complexity reduction, stable release

- Modularise backend: split `lib.rs` (~6300 lines) into `db.rs`, `validation.rs`, `crypto.rs`, `export_import.rs`, `terminal.rs`, `ssh.rs`
- Modularise frontend: split `main.js` (~10,800 lines) with ES modules + esbuild or Vite bundler

---

## Deferred Upgrades

These upgrades are blocked on upstream crates reaching stable release. **Check at the start of every new dev branch** before adding to that version's work items.

### RustCrypto ecosystem (sha2 / hmac / pbkdf2 / aes-gcm)
All four must move together due to the `digest 0.10 → 0.11` type split. Cannot do a partial upgrade.

| Crate | Current | Target | Status |
|---|---|---|---|
| sha2 | 0.10.9 | 0.11.0 | Stable ✅ — ready |
| hmac | 0.12.1 | 0.13.0 | Stable ✅ — ready |
| pbkdf2 | 0.12.2 | 0.13.0 | `0.13.0-rc.10` as of 2026-04-07 — **blocked** |
| aes-gcm | 0.10.3 | 0.11.0 | `0.11.0-rc.3` as of 2026-04-07 — **blocked** |

No current vulnerabilities or conflicts. Once pbkdf2 and aes-gcm both publish stable releases, update all four in `Cargo.toml` together and verify the API call sites in `lib.rs` (`pbkdf2_hmac::<Sha256>`, `Hmac<Sha256>`, `Aes256Gcm`).

---

## Known Issues

### macOS Code Signing
- DMGs show "damaged" (not code-signed)
- **Workaround:** Right-click → Open or `xattr -cr "/Applications/SSH Profile Manager.app"`

---

## Archive

### v0.9.2 - Released 2026-04-12 ✅
**Focus:** SSH Password Auth Fixes — Windows & macOS
- Windows CMD — fixed broken ACL (icacls replaces windows_acl DENY approach); temp bat file fixes env var quoting mangling through subprocess chain
- Windows PowerShell — removed `| Out-Null` which blocked PTY allocation
- In-app failure toast — status file + background polling thread (60s, 2s interval); app restores from minimised on bad password (Windows + macOS)
- spm-askpass state machine — fail-fast on bad password retry; relay proxy/2FA prompts to terminal
- Windows terminal selector — "Default" removed, "Windows Terminal" is now explicit default; v0.9.2 migration for existing users
- macOS terminal selector — "Default (Terminal.app)" renamed to "Terminal"
- 163 automated tests; 0 CRITICAL/HIGH after code + security review

### v0.9.1 - Released 2026-04-07 ✅
**Focus:** Windows Fix & Dependency Updates
- Windows SSH password auth Access Denied — replaced temp `.bat` askpass with bundled `spm-askpass.exe` workspace crate; bundled via `externalBin` (avoids tauri-build `canonicalize()` Windows CI bug)
- Update available modal — current/new version numbers on separate lines
- What's New splash — shows all versions skipped since last update (multi-version upgrade support)
- rand 0.8 → 0.10, rusqlite 0.32 → 0.39; GitHub Actions Node.js 20 deprecation fixed
- 163 automated tests; 0 CRITICAL/HIGH after security review

### v0.9.0 - Released 2026-04-05 ✅
**Focus:** SSH Password Auth & Central Passwords
- Central Passwords Manager — shared credentials across multiple profiles; rotate once, all linked profiles update
- SSH_ASKPASS integration — keychain passwords passed to SSH automatically; no interactive prompt
- Central Password auth method in profile editor with searchable picker
- Export/import support for central password references
- 163 automated tests; 0 CRITICAL/HIGH after code + security review

See `CHANGELOG.md` for full release history.
