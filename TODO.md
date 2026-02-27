# SSH Profile Manager - TODO & Roadmap

## Current Version: TBD

**Previous Release:** v0.8.0 (2026-02-27) ✅

---

## Versioning Policy

- **Feature releases** (`vX.Y.0`) — new features; order and timing are flexible and not predetermined
- **Patch releases** (`vX.Y.1`) — bug fixes against the most recent feature release only; issued as needed
- **v1.0.0** — major stable release following a full refactoring sprint
- Feature plans are not assigned to a specific version until development begins on that branch

---

## Roadmap

```
v0.7.0 ✅ → v0.7.1 ✅ → v0.8.0 ✅ → ... → v1.0.0
```

---

## Planned Features

### Multi-Tab System
**Status:** Planned
**Focus:** App-level tabs, pop-out windows
**Dependency:** None

See `plans/feature-multi-tab-system.md` for detailed plan.

### Terminal Customisation
**Status:** Planned
**Focus:** Fonts, colour schemes, accessibility
**Dependency:** Multi-tab system should be complete first (per-tab customisation requires tab infrastructure)

See `plans/feature-terminal-customization.md` for detailed plan.

### v1.0.0 - Major Refactoring Sprint
**Status:** Planned (after all feature releases)
**Focus:** 40-50% complexity reduction, stable release

**Key Refactoring Tasks:**
- **Modularise Backend (M-13):** Split `lib.rs` (5190 lines) into modules:
  - `db.rs` (~700 lines) - Database operations
  - `validation.rs` (~200 lines) - Input validation
  - `crypto.rs` (~200 lines) - Encryption/decryption
  - `export_import.rs` (~900 lines) - Export/import logic
  - `terminal.rs` (~500 lines) - Terminal session management
  - `ssh.rs` (~300 lines) - SSH connection logic
  - Improves maintainability, reduces merge conflicts, enables parallel development

- **Modularise Frontend (M-14):** Refactor `main.js` (10,771 lines) with ES modules + bundler:
  - Use esbuild or Vite for module bundling
  - Split into logical modules (profiles, groups, tags, settings, modals, etc.)
  - Improves code organisation, enables tree-shaking, faster dev rebuilds

- **Additional Optimisation:** Apply deferred performance improvements (M-5, L-1 done, others remaining)

---

## Feature Backlog

### Medium Priority
- Audit logging for security events (connections, exports, settings changes, failed auth attempts)
- SFTP support
- Port forwarding
- Jump hosts

### Low Priority
- Cloud sync
- SSH config import
- Custom icon upload (v0.7.0 includes predefined icons)
- Tag hierarchy (v0.7.0 includes flat tags)

---

## Known Issues

### macOS Code Signing
- DMGs show "damaged" (not code-signed)
- **Workaround:** Right-click → Open or `xattr -cr "/Applications/SSH Profile Manager.app"`

---

## Archive

### v0.8.0 - Released 2026-02-27 ✅
**Focus:** Profile & Group Moving + Custom Sort Order
- Move Profile & Move Group modals — reorganise without deleting and recreating
- Drag profiles between groups — instant move with 5-second undo toast
- Custom sort order — drag to reorder profiles and groups; persists across restarts
- Padlock button — session-only toggle for drag reordering
- Expand Card Actions — optional 6-button layout per profile card
- macOS: "open in new tab" silent failure now surfaces actionable error toast
- 142 automated tests (16 profile + 11 group + 22 integration + others)

### v0.7.1 - Released 2026-02-20 ✅
**Focus:** Bug fixes
- Parent Group dropdown flickering fixed
- Group modal stuck at expanded size fixed
- Version splash screen reappearing on app reload fixed
- Compact view card layout polished

### v0.7.0 - Released 2026-02-19 ✅
**Focus:** Hierarchical groups, encrypted exports, favourites, icons, tags
- Hierarchical group system with sub-groups (up to 3 levels)
- Individual profile/group export/import with duplicate detection
- Encrypted exports with AES-256-GCM and PBKDF2 key derivation
- Favourites system for profiles with virtual Favourites group
- Profile icon picker with 40+ Lucide icons
- Tag system with colour-coding and `tag:` search filtering
- 30+ keyboard shortcuts with help modal
- Settings Export/Import renamed to Backup/Restore
- 135 automated tests (107 unit + 22 integration + 6 additional from Phase 8E)

See `CHANGELOG.md` for full release history.
