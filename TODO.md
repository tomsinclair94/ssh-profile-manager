# SSH Profile Manager - TODO & Roadmap

## Current Version: v0.6.5

**Released:** 2026-01-09 ✅
**Type:** Bug Fix Release
**Focus:** UX improvements, validation fixes, startup issues

---

## Roadmap

```
v0.6.3 ✅ → v0.6.4 ✅ → v0.6.5 ✅ → v0.7.0 → v0.8.0 → v0.9.0 → v1.0.0
```

### v0.7.0 - Hierarchical Groups & Enhanced Organization
**Status:** In Development
**Focus:** Enhanced group management, hierarchical organization, export/import improvements, favorites & tags

See `plans/v0.7.0-hierarchical-groups-and-enhanced-organization.md` for detailed plan.

**Major Features:**
- Hierarchical group system with sub-groups (up to 3 levels)
- Separate group management (Add, Rename, Delete with cascade/move options)
- Individual profile/group export/import with append mode
- Encrypted exports with AES-256-GCM and HMAC integrity verification
- Favorites system for profiles and groups
- Icon picker for profiles (predefined library)
- Tag system with color-coding and filtering
- Profile name uniqueness scoped to parent group
- Settings Export/Import renamed to Backup/Restore

**Phase 1 Progress (Database Migration & Group CRUD):** ✅ Completed
- ✅ Created migration script (version 4) with new tables
- ✅ Implemented groups, profile_metadata, tags, profile_tags, and group_tags tables
- ✅ Wrote migration logic to extract groups from profiles
- ✅ Added group_id column to profiles table and populated from group_name
- ✅ Created Group, Tag, and ProfileMetadata structs
- ✅ Implemented get_groups, create_group, update_group, delete_group commands
- ✅ Registered commands in invoke_handler
- ✅ Build successful - ready for Phase 2

**Phase 2 Progress (Hierarchical Groups & Backend):** ✅ Completed
- ✅ Sub-group creation with parent_id support (already in Phase 1)
- ✅ Path calculation on group create/rename (already in Phase 1)
- ✅ Recursive path updates on rename (already in Phase 1)
- ✅ Group deletion modes - cascade vs. move profiles (already in Phase 1)
- ✅ Depth limit validation - max 3 levels (already in Phase 1)
- ✅ Implemented move_group command with path recalculation
- ✅ Implemented get_group_tree command (hierarchical structure)
- ✅ Registered new commands in invoke_handler
- ✅ Build successful - ready for Phase 3

**Phase 3 Progress (Frontend UI & Version Splash Screen):** ✅ Completed
- ✅ Hierarchical group management UI with visual indentation (20px per level, depth-1/2/3 CSS classes)
- ✅ Group Management Modal with parent selector and character counter
- ✅ Group header menu button (⋮) with Rename/Add Subgroup/Delete options
- ✅ Context menu for group actions (fixed positioning, single-instance)
- ✅ Profile form with hierarchical group dropdown
- ✅ Enhanced filter popup with hierarchical paths and group IDs
- ✅ Migration system from v0.6.5 (automatic group_id population, expanded groups on first load)
- ✅ Group deletion modes (Delete All vs. Move to Parent)
- ✅ localStorage migration (group names → group IDs)
- ✅ Fixed Rust compiler warnings (unused variables prefixed with underscore)
- ✅ Critical bug fixes: profile validation for hierarchical paths, sub-group indentation, FOREIGN KEY constraints, cascading profile counts, group filtering
- ✅ UI polish: modal formatting, toast error messages (cleanErrorMessage utility), validation message formatting, save button disable logic, group path validation optimization (194 chars max)
- ✅ Extra features: tooltip behavior improvements, modal auto-scroll for dropdowns, recursive sub-group collapse
- ✅ Version splash screen on first launch with changelog display
- ✅ Splash screen features: GitHub link, "Don't show again" checkbox, generic version tracking, keyboard navigation, responsive layout
- ✅ Version links (main header + settings/about) open splash screen
- ✅ Migration system future-proofing (CURRENT_APP_VERSION constant, comprehensive inline docs)
- ✅ Dynamic modal stack system for proper keyboard navigation priority
- ✅ UI refinements: backdrop click disabled, Tab focus trapping, GitHub button hover effect
- ✅ Header and section padding optimization (consistent 12px left/right across all sections)
- ✅ Typography improvements (title 24px, version 14px, logo 64px)

**Phase 4 Progress (Export/Import Modes):** In Progress

**Phase 4A (Version Tracking Foundation):** ✅ Completed
- ✅ Add `exportFormatVersion` field to all profile export commands
- ✅ Implement export format versioning (semantic: major.minor)
- ✅ Format 1.0: v0.6.x and earlier (flat groups, no metadata)
- ✅ Format 2.0: v0.7.0+ (hierarchical groups, metadata, tags)
- ✅ Implement compatibility checking on import (allow older major versions with migration, block newer major versions)
- ✅ Implement format 1.0 → 2.0 migration for backward compatibility
- ✅ Add error messaging with version guidance (direct users to correct app version)
- ✅ Missing `exportFormatVersion` defaults to 1.0 for backward compatibility
- ✅ Build successful with no warnings

**Phase 4B (Individual Export/Import):** Not started
- Implement export_profile command (includes metadata, tags, password with optional encryption)
- Implement export_group command (recursive, includes sub-groups and all profiles)
- Implement import_profile command (append mode, duplicate detection)
- Implement import_group command (append mode, duplicate detection, parent selector)
- Build export modal UI: Radio (Profile/Group/All), dropdown selector, include passwords checkbox
- Build import modal UI: File picker, duplicate resolution (Skip/Rename/Overwrite per conflict)
- Implement duplicate detection logic (name + host + username + group_path)
- Add conflict resolution UI with "Apply to All" option
- Export file naming: `sshpm-profile-{name}-{date}.json`, `sshpm-group-{name}-{date}.json`
- Test all export/import modes with conflicts and nested groups

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
