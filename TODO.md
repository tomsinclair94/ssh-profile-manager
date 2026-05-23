# SSH Profile Manager - TODO & Roadmap

## Current Version: v0.9.3 — Released 2026-05-23

**Latest Release:** v0.9.3 (2026-05-23) ✅
**Branch:** `main`
**Focus:** SSH connection failure detection for key/none auth; Windows password file ACL race fix; splash screen collapsed history

---

## Versioning Policy

- **Feature releases** (`vX.Y.0`) — new features; order and timing are flexible and not predetermined
- **Patch releases** (`vX.Y.1`) — bug fixes against the most recent feature release only; issued as needed
- **v1.0.0** — major stable release following a full refactoring sprint
- Feature plans are not assigned to a specific version until development begins on that branch

---

## Roadmap

```
... → v0.9.2 ✅ → v0.9.3 ✅ → v0.10.0 → ... → v1.0.0
```

---

## Planned Features

See `plans/feature-multi-tab-system.md` and `plans/feature-terminal-customization.md` for detailed plans.

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
| pbkdf2 | 0.12.2 | 0.13.0 | Stable ✅ — ready (crossed 2026-05-23) |
| aes-gcm | 0.10.3 | 0.11.0 | `0.11.0-rc.3` as of 2026-05-23 — **blocked** |

No current vulnerabilities or conflicts. Once aes-gcm publishes a stable `0.11.0` release, update all four in `Cargo.toml` together and verify the API call sites in `lib.rs` (`pbkdf2_hmac::<Sha256>`, `Hmac<Sha256>`, `Aes256Gcm`).

### keyring (3.6 → 4.x)
The `keyring` crate has been repurposed as a sample application in v4. Production apps must migrate to `keyring-core` instead. The core API (`Entry::new`, `set_password`, `get_password`, `delete_credential`) is similar but the crate identity changes and feature flags are restructured.

| Crate | Current | Target | Status |
|---|---|---|---|
| keyring | 3.6 | keyring-core 1.x | Deferred — medium migration effort; security-critical path requires thorough testing on both platforms |

Check at the start of a future dev branch. Needs full manual GUI testing (macOS + Windows) after migration.

### portable-pty (0.8 → 0.9)
v0.9.0 introduced a Windows ConPTY regression: PTY output returns garbage data due to the `PSEUDOCONSOLE_INHERIT_CURSOR` flag causing unhandled escape sequences. Issue is open and unresolved upstream.

| Crate | Current | Target | Status |
|---|---|---|---|
| portable-pty | 0.8.1 | 0.9.0 | **Do not upgrade** — known Windows regression (ConPTY garbage output); revisit once upstream fix is published |

Monitor upstream for a patched release before revisiting.

---

## Known Issues

### macOS Code Signing
- DMGs show "damaged" (not code-signed)
- **Workaround:** Right-click → Open or `xattr -cr "/Applications/SSH Profile Manager.app"`

---

## Archive

### v0.9.3 - Released 2026-05-23 ✅
**Focus:** SSH Connection Failure Detection & Windows ACL Fix
- Key auth failure toast — SSH key rejected or not authorised triggers an in-app error toast naming the profile
- None/interactive auth failure toast — server closes connection after too many attempts triggers a generic failure toast
- Windows password file ACL race — file now created empty before `icacls` is applied, then content written; eliminates world-readable window
- What's New splash — previously-seen same-minor versions now collapsed (expandable) rather than hidden; unseen versions remain expanded
- 163 automated tests; 0 CRITICAL/HIGH after code + security review

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
