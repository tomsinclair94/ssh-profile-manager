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

**Major Features:** 🔄 In Progress
- ✅ Hierarchical group system with sub-groups (up to 3 levels)
- ✅ Separate group management (Add, Rename, Delete with cascade/move options)
- ✅ Individual profile/group export/import with append mode
- Encrypted exports with AES-256-GCM and HMAC integrity verification
- ✅ Favorites system for profiles and groups
- ✅ Icon picker for profiles (predefined library)
- Tag system with color-coding and filtering
- ✅ Profile name uniqueness scoped to parent group (allows same name in different groups)
- ✅ Settings Export/Import renamed to Backup/Restore

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

**Phase 4 Progress (Export/Import Modes):** ✅ Completed

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

**Phase 4B (Backend - Individual Export/Import):** ✅ Completed
- ✅ Implement export_profile command (includes metadata, tags, password)
- ✅ Implement export_group command (recursive, includes sub-groups and all profiles)
- ✅ Implement import_profile command (append mode, duplicate detection)
- ✅ Implement import_group command (append mode, duplicate detection, parent selector)
- ✅ Add database methods for metadata and tags (get_profile_metadata, get_profile_tags, etc.)
- ✅ Create export structures (ProfileExportDetailed, GroupExportDetailed)
- ✅ Implement duplicate detection logic (name + group_path - allows same name in different groups)
- ✅ Update frontend validation to match group-scoped uniqueness
- ✅ Register all commands in invoke_handler (export_profile, export_group, import_profile, import_group)
- ✅ Build verification successful (no errors)
- ✅ Add import type detection function to frontend (detectImportType)
- ✅ **REFACTOR:** Migrate from UUID-based group_id to semantic group_path approach
  - ✅ Updated Migration 4 to add group_path column (instead of group_id)
  - ✅ Modified Profile struct to use group_path (removed group and group_id fields)
  - ✅ Removed ProfilePortable struct (Profile already has semantic paths)
  - ✅ Simplified all export functions (no conversion needed - use Profile directly)
  - ✅ Simplified all import functions (direct path comparison for duplicates)
  - ✅ Updated database CRUD methods (create/update/get use group_path)
  - ✅ Renamed get_profiles_by_group_id() → get_profiles_by_group_path()
  - ✅ Updated Tauri command input structs (CreateProfileInput, UpdateProfileInput)
  - ✅ Build verification successful with semantic paths

**Phase 4C (Frontend UI - Individual Export/Import):** ✅ Completed
- ✅ Profile card redesign: Connect, Edit, Actions button
- ✅ Actions menu: Duplicate, Export (new), Delete
- ✅ Group context menu: Add Export option (above Delete)
- ✅ Settings: Rename "Export Profiles" → "Export All Profiles"
- ✅ Import auto-detects type (profile/group/all) and routes accordingly
- ✅ Conflict resolution uses buttons (Skip/Rename/Overwrite for profiles, Skip/Rename/Merge for groups)
- ✅ Proper file naming: `sshpm-profile-{name}-{date}.json`, `sshpm-group-{name}-{date}.json`
- ✅ All export/import testing completed successfully

**Phase 5 Progress (Metadata System - Favorites, Icons, Tags):** Phase 5A ✅ | Phase 5B ✅ | Phase 5C ✅ | Phase 5D ✅ | Phase 5E ✅ COMPLETE

See `plans/v0.7.0-phase-5-detailed-plan.md` and `plans/v0.7.0-phase-5-progress-tracking.md` for full details.

**Phase 5A (Backend Infrastructure):** ✅ Completed (2026-01-22)
- ✅ Database schema: `profile_metadata`, `tags`, `profile_tags` tables (Migration 4)
- ✅ Rust structs: ProfileMetadata, Tag, ProfileWithMetadata
- ✅ Database methods: metadata CRUD, tag CRUD, tag assignments
- ✅ Tauri commands: 11 new commands (toggle_profile_favorite, update_profile_icon, get_tags, create_tag, delete_tag, etc.)
- ✅ Enhanced get_profiles: Returns ProfileWithMetadata with metadata + tags in 2 efficient queries
- ✅ Validation: Tag names (alphanumeric + spaces/hyphens/underscores, max 32 chars), colors (hex #RRGGBB)

**Phase 5B (Icons & Lucide Integration):** ✅ Completed (2026-01-23)
- ✅ Icon system: 40+ Lucide icons as inline SVG (no CDN, CSP-compliant)
- ✅ Searchable dropdown: Inline dropdown with keyboard navigation
- ✅ Profile modal: Icon selector integrated (Name 70% / Icon 30% row layout)
- ✅ Profile cards: Icons display at 32px below name
- ✅ Icon library refinement: Removed 18 irrelevant icons, added 16 SSH-focused icons
- ✅ Export/import: Includes icon, is_favorite, tags metadata
- ✅ Lucide settings icons: Replaced custom SVGs with Lucide 'settings' icon
- ✅ Default icon: 'server' for all profiles
- ✅ Icon visibility filter: Global configuration to exclude star/settings icons from profile selector

**Phase 5C (Favorites Implementation):** ✅ Completed (2026-01-26)
- ✅ Backend: Added `set_profile_favorite()` command for explicit state setting
- ✅ Profile modal: Favorite checkbox (below Name, above Description)
- ✅ Profile cards: Star icon toggle (star-off/star, gray/gold, left of title)
- ✅ Toast notifications: "Added to Favourites" / "Removed from Favourites"
- ✅ Virtual Favourites group: Renders at top with 2px gold/amber (#f59e0b) border
- ✅ Favourites cards: Group path display (at bottom, above actions)
- ✅ Navigation: "Go to Profile" button (collapses Favourites, expands group, scrolls & highlights)
- ✅ Collapse state: localStorage persistence (favouritesCollapsed)
- ✅ Auto-hide: Group hidden when no favorites exist
- ✅ Sorting: Profiles sorted A-Z by group path in Favourites
- ✅ Filtering: Favourites group ignores group filters (respects search only)
- ✅ Styling: Gold/amber theme, star hover animations, highlight pulse animation
- ✅ Icons: Added 'star' and 'star-off' to PROFILE_ICONS

**Phase 5D (Tags & Search Integration):** ✅ Complete (2026-01-29)

**Backend:** ✅ Complete (Phase 5A)
**Implementation Order:** Tag Manager → Profile Editor → Display → Search

**5D-1: Tag Manager Modal** (Create/Delete Tags) ✅ COMPLETE
- ✅ Settings section with "Manage Tags" button
- ✅ Tag Manager modal UI (name input, color picker, tag list)
- ✅ Create tag functionality with validation
- ✅ Delete tag with usage count warning
- ✅ Tag list shows usage counts
- ✅ Fixed alignment and spacing issues (24px spacing, vertical centering)
- ✅ Optimized modal width (320px confirmation modal)
- ✅ Updated default tag color to #3b82f6 (blue)

**5D-2: Profile Editor Tag Selector** (Assign Tags) ✅ COMPLETE
- ✅ Tokenized input (tags as pills inside input field)
- ✅ Searchable dropdown with multi-select
- ✅ Visual feedback (checkmarks, color swatches)
- ✅ + Tag button opens Tag Manager
- ✅ Press Enter creates new tag with default color
- ✅ Backspace removes last tag (when input empty)
- ✅ Click × on pill to remove tag
- ✅ Keyboard navigation (↑↓, Enter, Escape)
- ✅ Save profile updates tags via set_profile_tags command
- ✅ Tags load/save/duplicate correctly

**5D-2: Polish & Refinements** ✅ ALL COMPLETE (2026-01-29)
- ✅ Tag field height fixed (41px total: 10px + 19px + 10px + 2px border)
- ✅ Input min-width reduced (120px → 50px) for better wrapping behavior
- ✅ Explicit line-height and height controls prevent browser default spacing
- ✅ Unfocus behavior: field blurs after tag selection/removal for clean state
- ✅ Modal padding cleanup: defensive fallback prevents stuck padding
- ✅ Consistent button widths: all modal buttons now 85px (Browse, Show/Hide, +Tag, +Group)
- ✅ British spelling: "Color" → "Colour" in Tag Manager
- ✅ Usage count font size increased (12px → 14px) for better readability
- ✅ Form change detection fixed (typo: checkFormChanges → checkFormChanged)
- ✅ Light-colored tags use black text (luminance calculation)
- ✅ Tag dropdown has modal expand/auto-scroll behavior
- ✅ Tag input and +Tag button in tab cycle
- ✅ Tag Manager tab cycle streamlined (removed delete buttons from cycle)

**5D-2: Keyboard Shortcuts Reorganization** ✅ COMPLETE (2026-01-29)
- ✅ **New scheme:** Modified keys (Cmd/Ctrl) for interface controls, single keys for quick actions
- ✅ **Cmd+S** → Focus Search (removed / shortcut)
- ✅ **Cmd+F** → Filter Groups
- ✅ **Cmd+Left/Right Arrow** → Collapse/Expand All Groups (mirrors individual group arrows)
- ✅ **T** → Open Tag Manager (single key)
- ✅ **N, G, S** → New Profile, New Group, Settings (unchanged)
- ✅ Help screen updated with cleaner spacing (Cmd + S instead of Cmd+S)

**5D-3: Tag Display on Cards** (Show Tags + Icon Centering) ✅ COMPLETE
- ✅ Update grid layout - add "tags" area
- ✅ Vertically center icon (align-items: center, remove padding-top: 2px)
- ✅ Render tag badges between info and actions/path
- ✅ Tag badge styling (6px gap, 8px margin-top)
- ✅ Fixed icon centering (align-items: center on .profile-card-body)
- ✅ Fixed tag color timing (loadTags before loadProfiles)

**5D-4: Tag Search Integration** (Filter by Tags) ✅ COMPLETE
- ✅ Clickable badges add to search
- ✅ Parse `tag:` search prefix (OR logic, exact matching)
- ✅ Update search placeholder/tooltip with tag syntax
- ✅ Filter profiles by tags in renderProfiles()
- ✅ Search tooltip behavior matches modal fields (hover only, hide on typing)
- ✅ Search field autocorrect disabled (spellcheck/autocorrect/autocapitalize off)
- ✅ Search clear (×) button with auto-show/hide
- ✅ Hide empty groups during search (only show groups with matching profiles)

**Phase 5E (Polish & Nice-to-Have Features):** ✅ Complete (2026-01-31)
- ✅ Review and fix console warnings/errors (CSP violations fixed - 2026-01-31)
- ✅ Confirmation modal button spacing (420px/480px widths, consistent formatting, British English - 2026-01-31)
- ✅ Multi-tag select in Tag Manager (checkboxes, delete selected with dynamic count, select/unselect all, 600px modal width, 24px spacing - 2026-01-31)
- ✅ Import/export tag handling (auto-create tags on import, match by name, frontend refresh fix - 2026-01-31)
- ✅ Modifier key import shortcuts (Cmd/Ctrl transforms header buttons to Import Profile/Group, 120px fixed width - 2026-01-31)
- ✅ Settings modal UX improvements (section reorganization, Tag Management, delete all tags, minimize toggle, default values, GitHub buttons, British English - 2026-01-31)

See `plans/v0.7.0-phase-5-progress-tracking.md` Phase 5E section for full details.

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
