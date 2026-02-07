# SSH Profile Manager - TODO & Roadmap

## Current Version: v0.6.5

**Released:** 2026-01-09 ✅
**Type:** Bug Fix Release
**Focus:** UX improvements, validation fixes, startup issues

## Current Development Version: v0.7.0

**Type:** Major Feature Release
**Focus:** Enhanced Group Management, Hierarchical Organization, Export/Import Improvements, Favorites, Icons & Tags

---

## Roadmap

```
v0.6.5 ✅ → v0.7.0 → v0.8.0 → v0.9.0 → v1.0.0
```

### v0.7.0 - Hierarchical Groups & Enhanced Organization
**Status:** In Development
**Focus:** Enhanced group management, hierarchical organization, export/import improvements, favorites, icons & tags

See `plans/v0.7.0-hierarchical-groups-and-enhanced-organization.md` for detailed plan.

**Major Features:** 🔄 In Progress (Phase 8 Pending)
- ✅ Hierarchical group system with sub-groups (up to 3 levels)
- ✅ Separate group management (Add, Rename, Delete with cascade/move options)
- ✅ Individual profile/group export/import with append mode
- ✅ Encrypted exports with AES-256-GCM and HMAC integrity verification
- ✅ Favorites system for profiles and groups
- ✅ Icon picker for profiles (predefined library)
- ✅ Tag system with color-coding and filtering
- ✅ Profile name uniqueness scoped to parent group (allows same name in different groups)
- ✅ Settings Export/Import renamed to Backup/Restore

**Phase 1 (Database Migration & Group CRUD):** ✅ Complete

**Phase 2 (Hierarchical Groups & Backend):** ✅ Complete

**Phase 3 (Frontend UI & Version Splash Screen):** ✅ Complete — hierarchical group UI, modal stack system, version splash screen, localStorage migration.

**Phase 4 (Export/Import Modes):** ✅ Complete — 4A export format versioning (1.0/2.0), 4B backend commands with duplicate detection, 4C frontend conflict resolution UI. Refactored from UUID-based group_id to semantic group_path.

**Phase 5 (Metadata System — Favourites, Icons, Tags):** ✅ Complete (2026-01-31) — 5A backend schema, 5B Lucide icons (40+ inline SVG), 5C favourites with virtual group, 5D tags with search (`tag:` syntax), 5E polish. See `plans/v0.7.0-phase-5-progress-tracking.md` for full detail.

**Phase 6 (Encryption & Security):** ✅ Complete (2026-02-05) — AES-256-GCM encryption with PBKDF2 key derivation (600k iterations), HMAC-SHA256 integrity verification, mandatory encryption for password-auth exports, frontend encryption/decryption modals with 5-level password strength meter, 12-128 character password validation. All sub-phases 6A-6E complete. See `plans/v0.7.0-phase-6-encryption.md` for full details.

**Phase 7 (UI Polish & Settings Migration):** ✅ Complete (2026-01-31) — Backup/Restore rename, localStorage migration, tooltips, 30+ keyboard shortcuts, CSS polish.

**Phase 8 (Testing & Documentation):** 🔄 IN PROGRESS — Comprehensive testing, code quality validation, security review, and documentation updates. Sub-phases (A→F): ✅ 8A Complete (Automated Testing - 107 tests across 8 modules), ✅ 8B Complete (Agent Reviews - 20 issues fixed: CRITICAL SQL corruption, HIGH security gaps, MEDIUM XSS/validation/performance/refactoring, LOW optimizations; 12 issues deferred to v1.0.0; all tests passing in ~29s), 8C (Integration Tests - export/import round-trip, group cascade, duplicate detection), 8D (Integration + Windows VM Testing), 8E (Migration Validation), 8F (Documentation). See `plans/v0.7.0-phase-8-testing-and-release-preparation.md` for full details.

---

### v0.8.0 - Multi-Tab System
**Status:** Planned
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
