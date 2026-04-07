# SSH Profile Manager - TODO & Roadmap

## Current Version: v0.9.2 — In Development

**Latest Release:** v0.9.1 (2026-04-07) ✅
**Branch:** `v0.9.2-dev`
**Focus:** Windows SSH password auth fixes

### Debugging Setup (do this first)

- [ ] **Get the branch onto the Windows VM** — clone/pull `v0.9.2-dev` and set up the dev environment:
  1. Install prerequisites: [Rust](https://rustup.rs), [Bun](https://bun.sh), [VS Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (MSVC toolchain + Windows SDK)
  2. `git clone https://github.com/tomsinclair94/ssh-profile-manager.git && cd ssh-profile-manager && git checkout v0.9.2-dev`
  3. `bun install`
  4. `bun run dev` — keep the terminal window open; `[DEBUG]` log lines from the Rust backend will appear here
  5. Right-click inside the app → Inspect (or Ctrl+Shift+I) for frontend devtools
  6. Set up a test profile with password auth pointing at a known SSH host
  7. Try connecting with each terminal type (Windows Terminal, CMD, PowerShell) and capture all `[DEBUG]` output from the `bun run dev` terminal

### Work Items

- [ ] **Windows Terminal: Access Denied** — SSH cannot invoke `spm-askpass.exe` when launched via Windows Terminal. Currently a `.bat` file is used for env var injection (`wt cmd /c <bat>`), which runs SSH with `SSH_ASKPASS` set. SSH then invokes `spm-askpass.exe` but receives Access Denied. Debug output will show exact paths — check for spaces, quoting issues.

- [ ] **CMD: Password not passed** — CMD opens, closes, then reopens as if `SSH_ASKPASS` was never set. Possible cause: env vars set via inline `set &` chain may not survive the `cmd /c start cmd /c` double-subprocess boundary. Debug output will show the exact compound command being constructed.

- [ ] **PowerShell (proxy/multi-step auth): `spm-askpass: failed to read password file: os error 2`** — Password correctly passed for initial auth (2FA succeeds), but proxy then requests additional prompts (e.g. reason for login). SSH invokes `spm-askpass.exe` again but the 10s cleanup has already deleted the password file. Fix: tie password file lifetime to the SSH process rather than a fixed timeout.

### Release Checklist

- [ ] All automated tests pass (`cargo test --lib`)
- [ ] Developer tools disabled (`tauri.conf.json`)
- [ ] Code review (voltagent-qa-sec:code-reviewer)
- [ ] Security review (voltagent-infra:security-engineer)
- [ ] Fix any CRITICAL/HIGH/MEDIUM issues from reviews
- [ ] Re-run automated tests after fixes
- [ ] Update `CHANGELOG.md` — full Fixed entry
- [ ] Update `dist/main.js` `VERSION_CHANGELOG` — highlights for in-app splash
- [ ] Update docs: `CLAUDE.md`, `TODO.md`, `SECURITY.md`, `DEVELOPMENT.md`
- [ ] Commit & push
- [ ] Create PR → `main` with `--label "bug"`
- [ ] Enable auto-merge (squash); commit title must start with `Release v0.9.2`

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
