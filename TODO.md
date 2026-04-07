# SSH Profile Manager - TODO & Roadmap

## Current Version: v0.9.1 — In Development

**Latest Release:** v0.9.0 (2026-04-05) ✅
**Branch:** `v0.9.1-dev`
**Focus:** Dependency updates + GitHub Actions maintenance

### Work Items

- [x] **Update available modal** — version info crammed onto one line; reformat so current/latest versions are clearly presented on separate lines with better visual hierarchy
- [x] **rand 0.8.5 → 0.10.0** — `thread_rng()` removed; update 2 call sites in encryption code to `rand::rng()`
- [ ] **sha2 0.10.9 → 0.11.0 + hmac 0.12.1 → 0.13.0** — RustCrypto ecosystem split (`digest 0.10` → `0.11`); must update sha2, hmac, pbkdf2, and aes-gcm together; **blocked** — pbkdf2 is on `0.13.0-rc.10` and aes-gcm on `0.11.0-rc.3` (both still RC as of 2026-04-07); no current conflict or vulnerability, revisit once both reach stable release
- [x] **rusqlite 0.32.1 → 0.39.0** — 7 major versions; audit breaking API changes at all call sites before updating
- [x] **GitHub Actions: actions/checkout@v4 → v5** — Node.js 20 deprecated on runners from June 2026; update in all 4 workflow files (`auto-tag.yml`, `release.yml`, `security-audit.yml`, `pr-checks.yml`)
- [ ] Run `cargo update` + verify build
- [ ] Re-run all automated tests (163 must pass)

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
- [ ] Enable auto-merge (squash); commit title must start with `Release v0.9.1`

---

## Versioning Policy

- **Feature releases** (`vX.Y.0`) — new features; order and timing are flexible and not predetermined
- **Patch releases** (`vX.Y.1`) — bug fixes against the most recent feature release only; issued as needed
- **v1.0.0** — major stable release following a full refactoring sprint
- Feature plans are not assigned to a specific version until development begins on that branch

---

## Roadmap

```
... → v0.9.0 ✅ → v0.9.1 → v0.10.0 → ... → v1.0.0
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

## Known Issues

### macOS Code Signing
- DMGs show "damaged" (not code-signed)
- **Workaround:** Right-click → Open or `xattr -cr "/Applications/SSH Profile Manager.app"`

---

## Archive

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
