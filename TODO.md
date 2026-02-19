# SSH Profile Manager - TODO & Roadmap

## Current Version: v0.7.0

**Released:** 2026-02-19 ✅
**Type:** Major Feature Release
**Focus:** Hierarchical groups, encrypted exports, favourites, icons, tags, keyboard shortcuts

## Current Development Version: v0.8.0

**Type:** Feature Release
**Focus:** Multi-tab system, pop-out windows

---

## Roadmap

```
v0.6.5 ✅ → v0.7.0 ✅ → v0.8.0 → v0.9.0 → v1.0.0
```

### v0.8.0 - Multi-Tab System
**Status:** Next Up
**Focus:** App-level tabs, pop-out windows

See `plans/v0.8.0-multi-tab-system.md` for detailed plan.

### v0.9.0 - Terminal Customization
**Status:** Planned
**Focus:** Fonts, color schemes, accessibility

See `plans/v0.9.0-terminal-customization.md` for detailed plan.

### v1.0.0 - Major Refactoring Sprint
**Status:** Planned
**Focus:** 40-50% complexity reduction, stable release

**Key Refactoring Tasks:**
- **Modularize Backend (M-13):** Split `lib.rs` (5190 lines) into modules:
  - `db.rs` (~700 lines) - Database operations
  - `validation.rs` (~200 lines) - Input validation
  - `crypto.rs` (~200 lines) - Encryption/decryption
  - `export_import.rs` (~900 lines) - Export/import logic
  - `terminal.rs` (~500 lines) - Terminal session management
  - `ssh.rs` (~300 lines) - SSH connection logic
  - Improves maintainability, reduces merge conflicts, enables parallel development

- **Modularize Frontend (M-14):** Refactor `main.js` (10,771 lines) with ES modules + bundler:
  - Use esbuild or Vite for module bundling
  - Split into logical modules (profiles, groups, tags, settings, modals, etc.)
  - Improves code organization, enables tree-shaking, faster dev rebuilds

- **Additional Optimization:** Apply deferred performance improvements (M-5, L-1 done, others remaining)

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

### v0.6.5 - Released 2026-01-09 ✅
**Focus:** UX improvements and validation fixes
- Hash (#) character support in Username, Profile Name, and Group Name fields
- Fixed group filter badge showing "0/0" on startup
- Fixed filters not applying correctly on startup
- Fixed group name validation (64-char limit)
- Improved duplicate profile workflow
- Fixed modal close button confirmation logic

### v0.6.4 - Released 2025-01-09 ✅
**Focus:** Windows Terminal fixes and security hardening
- Windows Terminal tab mode fixes
- Auto-close terminal behavior (macOS/Windows)
- Windows icon background fix
- Comprehensive security hardening (16+ fixes)

### v0.6.3 - Released 2025-01-06 ✅
**Focus:** Security hardening and UX improvements
- Terminal tab setting for macOS/Windows
- Password authentication fix (keyring native features)
- Profile card UI redesign
- Auto-tag workflow fix (PAT_TOKEN)
- 6 critical/medium security fixes
