# SSH Profile Manager - TODO & Roadmap

## Current Version: v0.9.2 — In Development

**Latest Release:** v0.9.1 (2026-04-07) ✅
**Branch:** `v0.9.2-dev` (Windows dev complete; macOS parity implemented, needs testing)
**Focus:** Windows SSH password auth fixes + in-app failure toast; macOS parity

---

### Work Items

#### Bug 1: Windows Terminal — ✅ Tested (good/bad password both working via CMD-in-WT)
- Same bat file approach as CMD used (`wt cmd /c <bat>`)
- Root cause of detection failure: bat file deleted after 5s — same race condition as CMD; fixed with 90s cleanup delay
- Applied `SSHCODE=%ERRORLEVEL%` pattern (replaces `if errorlevel 1`)
- Tab closes automatically on exit (user's WT "close on exit" setting)
- Note: tested as "CMD via Windows Terminal" (CMD is the default shell in WT for this user)

#### Bug 2: CMD — ✅ Tested (good/bad password both working)
- Root cause: broken `set_file_permissions_windows` (DENY ACL locked out current user from their own files) — fixed with `icacls /inheritance:r /grant:r USERNAME:F`
- Env var injection: replaced inline compound command with temp bat file (avoids quoting mangling through `cmd → start → cmd` chain)
- DB file was also locked by the broken ACL — fixed by always re-applying permissions on init

#### Bug 3: PowerShell — ✅ Tested (good/bad password working; proxy untested)
- Root cause of silent failure: `| Out-Null` was piping SSH stdout to nothing, preventing PTY allocation — SSH launched but produced no output and appeared to hang
- Fix: removed `| Out-Null` from both the askpass and non-askpass PS command variants
- Earlier fixes still in place: `SSH_ASKPASS_REQUIRE=force`, spm-askpass state machine, `NumberOfPasswordPrompts=1`
- Proxy multi-step auth still untested (requires work proxy setup)

#### In-app SSH failure toast — ✅ Tested (CMD, WT, PowerShell)
Goal: when wrong password causes the terminal to close silently, pop an error toast in the app.

**Mechanism:**
- bat/PS script sets `SPM_STATUS_FILE=<path>` and writes `FAIL` or `OK` after SSH exits
- Background monitoring thread polls for the status file every 2s for up to 60s
- On `FAIL`: restores window (unminimize/show/focus) then emits `ssh-connection-failed` event
- On `OK`: stops early (clean session close, no toast)
- Frontend listener calls `showToast(event.payload, TOAST_DURATION_LONG, 'error')`
- Toast message includes profile name on second line: `"Edit the profile 'NAME' to update the password."`

**Key fixes:**
- bat file cleanup delay: 5s → 90s (cmd.exe re-reads the file after SSH exits; 5s was a race condition)
- `SSHCODE=%ERRORLEVEL%` pattern applied to CMD and WT launchers (captures exit code before any subsequent command resets it)
- Monitor timeout: 30s → 60s (covers slow proxy auth, 2FA, typed reason fields)
- PowerShell: removed `| Out-Null` which was breaking PTY allocation

**Before release:**
- [x] Removed all `[DEBUG ...]` println! statements and `spm-bat-debug.txt` instrumentation from `launch_windows_cmd`
- [x] Applied `SSHCODE=%ERRORLEVEL%` + `OK`/`FAIL` writes + 90s cleanup to default and custom bat launchers
- [x] Removed `launch_windows_default_terminal`; Windows terminal selector now shows WT as default, no "Default" option
- [x] Migration v0.9.2: `terminalPreference = 'default'` → `'windows_terminal'` on Windows on first launch
- [ ] Test proxy multi-step auth at work (CMD, PowerShell, Windows Terminal)

#### macOS parity — ✅ Implemented, needs testing

**Same mechanism as Windows, adapted for macOS:**
- `launch_macos_default_terminal`: after SSH exits, writes OK/FAIL via `&&`/`||` before the auto-close osascript (uses `&&`/`||` rather than `$?` variable — `applescript_escape()` would mangle `$` in the inline string)
- `launch_macos_custom_terminal`: script captures `SPMCODE=$?` after SSH exits, writes OK/FAIL to status file
- Background polling thread (60s, 2s interval) emits `ssh-connection-failed` event on FAIL — same as Windows
- Frontend toast listener already handles this event (shared between platforms)
- macOS askpass `.sh` script upgraded to full state machine:
  - First call: delivers password, deletes pwd file
  - Subsequent call with password/passphrase prompt → exits 1 (fail fast, no retry)
  - Subsequent call with non-password prompt → relays to `/dev/tty` (proxy 2FA, reason field, etc.)

**Needs testing (macOS):**
- [ ] Test Terminal.app (default) — good password (connects cleanly, tab auto-closes)
- [ ] Test Terminal.app (default) — bad password (tab auto-closes, toast fires)
- [ ] Test custom terminal (e.g. iTerm2) — good password
- [ ] Test custom terminal (e.g. iTerm2) — bad password (toast fires)
- [ ] Confirm no regression on key-auth and no-auth profiles

---

### Release Checklist

- [x] Resolve toast debug — root cause was bat file deleted (5s) before cmd.exe re-read it post-SSH; fixed with 90s cleanup delay
- [x] Test CMD with good and bad passwords — confirmed working, toast fires on failure, app restores from minimised
- [x] Test Windows Terminal with good and bad passwords — confirmed working (CMD-in-WT)
- [x] Test PowerShell with good and bad passwords — confirmed working after removing `| Out-Null`
- [x] Removed all `[DEBUG ...]` println! statements and `spm-bat-debug.txt` instrumentation from `lib.rs`
- [x] Applied `SSHCODE=%ERRORLEVEL%` + `OK`/`FAIL` writes + 90s cleanup to all Windows bat launchers
- [x] Removed `launch_windows_default_terminal`; Windows terminal selector now shows WT as default, no "Default" option
- [x] Migration v0.9.2: `terminalPreference = 'default'` → `'windows_terminal'` on Windows on first launch
- [x] macOS askpass script upgraded to state machine (fail-fast on retry, relay non-password prompts to TTY)
- [x] macOS failure toast implemented — status file + polling thread, same mechanism as Windows
- [ ] Test macOS connections — good password, bad password, key auth (see macOS parity section above)
- [ ] Update `CHANGELOG.md` — full Fixed entry
- [ ] Update `dist/main.js` `VERSION_CHANGELOG` — highlights for in-app splash
- [ ] All automated tests pass (`cargo test --lib`)
- [ ] Developer tools disabled (`tauri.conf.json`)
- [ ] Code review (voltagent-qa-sec:code-reviewer)
- [ ] Security review (voltagent-infra:security-engineer)
- [ ] Fix any CRITICAL/HIGH/MEDIUM issues from reviews
- [ ] Re-run automated tests after fixes
- [ ] Update docs: `CLAUDE.md`, `TODO.md`, `SECURITY.md`, `DEVELOPMENT.md`
- [ ] Commit & push
- [ ] Create PR → `main` with `--label "bug"`
- [ ] Enable auto-merge (squash); commit title must start with `Release v0.9.2`

**Note — proxy multi-step auth:** All three terminal types are expected to work based on the spm-askpass state machine design, but confirmation requires the work proxy/2FA environment. Testing to be done before or after release; any issues will be addressed in a v0.9.3 patch.

---

## Versioning Policy

- **Feature releases** (`vX.Y.0`) — new features; order and timing are flexible and not predetermined
- **Patch releases** (`vX.Y.1`) — bug fixes against the most recent feature release only; issued as needed
- **v1.0.0** — major stable release following a full refactoring sprint
- Feature plans are not assigned to a specific version until development begins on that branch

---

## Roadmap

```
... → v0.9.1 ✅ → v0.9.2 → v0.10.0 → ... → v1.0.0
```

---

## Planned Features

See `plans/feature-multi-tab-system.md` and `plans/feature-terminal-customization.md` for detailed plans.

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

### v0.8.0 - Released 2026-02-27 ✅
**Focus:** Profile & Group Moving + Custom Sort Order
- Move Profile & Move Group modals, drag between groups with 5s undo
- Custom sort order with drag-to-reorder; padlock button to enable
- Expand Card Actions — optional 6-button layout per profile card
- 142 automated tests

See `CHANGELOG.md` for full release history.
