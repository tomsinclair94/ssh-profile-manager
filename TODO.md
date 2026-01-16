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

**Phase 3 Progress (Frontend Group UI):** ✅ Completed - Ready for Testing

**Features Implemented:**
- ✅ "Add Group" button in toolbar
- ✅ Group Management Modal (name input, parent selector, character counter)
- ✅ Hierarchical group rendering with visual indentation (20px per level)
- ✅ Group header menu button (⋮) with Rename/Add Subgroup/Delete
- ✅ Context menu for group actions
- ✅ Profile form: group field → hierarchical dropdown
- ✅ Filter popup: shows hierarchical paths, uses group IDs
- ✅ Migration from v0.6.5: automatic group_id population
- ✅ Migration reset: expands all groups, clears filters on first v0.7.0 load
- ✅ Group deletion with two modes: Delete All vs. Move to Parent
- ✅ localStorage migration: group names → group IDs
- ✅ CSS styling: group menu button, context menu, hierarchical indentation

**Phase 3 Cleanup Tasks:** ✅ Completed
- [x] Fix Rust compiler warnings (non-critical):
  - Fixed unused variable `session_id` at `src/lib.rs:305:38` (prefixed with underscore)
  - Fixed unused variable `abandoned_at` at `src/lib.rs:305:58` (prefixed with underscore)
  - Note: These are in thread cleanup code and don't affect functionality

**Phase 3 - Critical Bug Fixes:** ✅ All Phases (A, B, C) Completed

**Phase A - Critical Blockers:** ✅ Completed
- [x] Fix profile validation to allow hierarchical paths (slash character in group paths)
- [x] Fix sub-group visual indentation CSS (20px per level not showing) - Fixed with CSS classes (depth-1, depth-2, depth-3)
- [x] Fix profile card indentation to match parent group - Also uses CSS depth classes
- [x] Fix group deletion FOREIGN KEY constraint error
- [x] Fix group filtering to hide group headers and sub-groups
- [x] Fix cascading profile counts (parent groups now show total including descendants)

**Phase B - High Priority:** ✅ Completed
- [x] Fix context menu positioning (goes off-screen on right side)
- [x] Fix multiple context menus appearing simultaneously
- [x] Fix collapse all button for empty groups containing sub-groups
- [x] Set Ungrouped as default in profile group dropdown

**Phase C - UI Polish:** ✅ Completed
- [x] Fix delete group modal formatting issues
  - Fixed modal styling to match empty group modal (proper divider, centered buttons, consistent font size)
  - Changed modal title to "Delete Empty Group" for empty groups
  - Changed warnings to bulleted list for better readability
- [x] Improve toast error messages (cleaner, user-friendly versions)
  - Created cleanErrorMessage() utility to strip technical jargon
  - Translates UNIQUE constraint errors to user-friendly messages
  - Applied to 20+ error messages throughout codebase
- [x] Fix validation message formatting
  - Multi-line format for special character lists
  - Removed duplicate field name prefixes
- [x] Add save button disable logic for validation errors
  - Profile modal now disables save when fields are invalid
  - Group modal now disables save when field is invalid or too long
- [x] Fix group modal validation state persistence
  - Clears red border when reopening modal
- [x] Optimize group path length validation
  - Reduced maxLength from 255 to 194 characters (64*3 + 2 slashes)
  - Separated group NAME validation (64 chars, no slashes) from group PATH validation (194 chars, with slashes)

**Phase 3 - Extra Features (Nice-to-Have):** ✅ Completed
- [x] Tooltip behavior when field is focused (allow hover even when typing)
  - Simplified: tooltips now always show below (consistent behavior)
  - Hide when typing starts, reappear on hover
- [x] Modal auto-scroll for dropdowns (scroll to show full dropdown)
  - Dynamic padding injection to create scrollable space
  - 20px breathing room below dropdown
  - Padding restored when dropdown closes
- [x] Better sub-group collapse behavior (collapse sub-groups when parent collapses, not just hide)
  - Recursive collapse of all descendant groups when parent collapses

**Phase 4 Progress (New Version Splash Screen):** ✅ Implemented - Ready for Testing

**Features Implemented:**
- ✅ Splash screen on first launch of new version
- ✅ Display high-level changelog (major features/fixes only)
- ✅ Link to GitHub release for full changelog
- ✅ Close button with "Don't show again" checkbox (default checked)
- ✅ Persistence: generic version tracking using localStorage
- ✅ Show again if dismissed without checkbox until finally dismissed
- ✅ Version link in settings/about opens splash screen instead of GitHub
- ✅ Link always points to matching version Git release
- ✅ Proper scrolling: only highlights list scrolls, header/footer fixed
- ✅ Responsive layout: centered checkbox and button at all widths
- ✅ Keyboard navigation: Tab cycles through GitHub link → Checkbox → Close button

**Phase 4 Known Issues:** ✅ All Resolved
- [x] Modal bottom padding adjustment - Fixed by removing inherited 20px padding and adjusting actions padding to 16px
- [x] GitHub button section stability - Fixed by adding min-height and flex layout to prevent shrinking
- [x] Date positioning - Fixed by changing media query breakpoint from 768px to 500px
- [x] Storage keys cleanup - Implemented cleanupOldStorageKeys() to remove version-specific keys, migrated to generic keys
- [x] Minimum window size - Updated from 560x420 to 640x480 (maintains 4:3 ratio, divisible by 20)
- [x] Migration system future-proofing - Refactored to use CURRENT_APP_VERSION constant, handles skipped versions correctly
- [x] Migration system documentation - Added comprehensive inline docs (~line 1920) and CLAUDE.md reference
- [ ] Full testing against test plan (see Phase 4 Test Plan below)

**Phase 4 Test Plan:** 🧪 Ready for Testing

Use this checklist to thoroughly test Phase 4 functionality. Check off each item as you test it.
- I have tested all items
- I have marked a 'Y' against items that pass
- I have marked a 'N' against items that fail
- I have marked a '/' against items I no longer need to test / will test at a later date
- I have optionally added 'SEE NOTES' to items that pass/fail but have some recommended changes
- Under each Main Test group I have added optional Notes and a test/failure summary with details

#### 1. First Launch Testing
- [ ] **1.1** Clear localStorage to simulate fresh install:
  - [ ] Open browser console (if devtools enabled)
  - [ ] Run: `localStorage.clear()`
  - [ ] Reload app
- [ ] **1.2** Launch v0.7.0 - verify:
  - [ ] Migration toast appears first: "Upgraded to v0.7.0 with hierarchical groups!"
  - [ ] 500ms later, splash screen appears automatically
  - [ ] Splash screen shows "What's New in v0.7.0" title
  - [ ] Release date shows: "Released on 2026-01-16"
  - [ ] Subtitle shows: "Hierarchical Groups & Enhanced Organization"
  - [ ] Highlights list displays 6 bullet points
  - [ ] "View Full Release Notes" GitHub link is visible
  - [ ] "Don't show this again" checkbox is checked by default
  - [ ] "Close" button is visible at bottom-right

Notes:

Results:

#### 2. Splash Screen Content Verification
- [ ] **2.1** Verify all 6 highlights are displayed:
  - [ ] "Hierarchical group system with sub-groups (up to 3 levels)"
  - [ ] "Separate group management with Add, Rename, Delete options"
  - [ ] "Enhanced group filter with hierarchical display"
  - [ ] "Improved keyboard navigation with arrow key support"
  - [ ] "Version splash screen for major release announcements"
  - [ ] "Performance improvements and bug fixes"
- [ ] **2.2** Verify layout:
  - [ ] Header stays visible when scrolling (title + date + subtitle)
  - [ ] Only highlights list scrolls (if content is long)
  - [ ] Footer stays visible (GitHub link)
  - [ ] Actions stay visible (checkbox + Close button)

Notes:

Results:

#### 3. GitHub Link Testing
- [ ] **3.1** Click "View Full Release Notes" link
  - [ ] Opens in new browser tab
  - [ ] URL is: https://github.com/tomsinclair94/ssh-profile-manager/releases/tag/v0.7.0
  - [ ] GitHub release page loads correctly
  - [ ] Splash screen remains open in app

Notes:

Results:

#### 4. Close with Checkbox (Don't Show Again)
- [ ] **4.1** Verify checkbox is checked by default
- [ ] **4.2** Click "Close" button
  - [ ] Splash screen closes
  - [ ] Can continue using app normally
- [ ] **4.3** Reload app
  - [ ] Migration toast does NOT appear (already migrated)
  - [ ] Splash screen does NOT appear (dismissed with checkbox)
- [ ] **4.4** Check localStorage:
  - [ ] Open console and run: `localStorage.getItem('lastSplashVersion')`
  - [ ] Should return: `"0.7.0"`
  - [ ] Run: `localStorage.getItem('splashDismissedUnchecked')`
  - [ ] Should return: `null` (removed when dismissed with checkbox)

Notes:

Results:

#### 5. Close without Checkbox (Show Again)
- [ ] **5.1** Clear localStorage and reload to reset
- [ ] **5.2** Wait for splash screen to appear
- [ ] **5.3** UNCHECK "Don't show this again" checkbox
- [ ] **5.4** Click "Close" button
  - [ ] Splash screen closes
- [ ] **5.5** Reload app
  - [ ] Splash screen appears again (because checkbox was unchecked)
- [ ] **5.6** Check localStorage:
  - [ ] Run: `localStorage.getItem('splashDismissedUnchecked')`
  - [ ] Should return: `"true"`
  - [ ] Run: `localStorage.getItem('lastSplashVersion')`
  - [ ] Should return: `null` or old version (not updated to 0.7.0)
- [ ] **5.7** This time, leave checkbox CHECKED and close
- [ ] **5.8** Reload app
  - [ ] Splash screen should NOT appear anymore

Notes:

Results:

#### 6. Version Link in Settings
- [ ] **6.1** Open Settings (gear icon)
- [ ] **6.2** Scroll to "About" section
- [ ] **6.3** Click on version number "0.7.0" link
  - [ ] Settings modal stays open
  - [ ] Splash screen opens on top of settings
- [ ] **6.4** Close splash screen
  - [ ] Returns to settings modal
  - [ ] Can close settings normally
- [ ] **6.5** Click version link multiple times
  - [ ] Splash screen can be reopened repeatedly
  - [ ] Each time shows same content
  - [ ] Checkbox resets to checked each time

Notes:

Results:

#### 7. Keyboard Navigation
- [ ] **7.1** Open splash screen (via version link or fresh launch)
- [ ] **7.2** Press Tab key repeatedly:
  - [ ] First focus: GitHub link (blue outline)
  - [ ] Second Tab: Checkbox (blue outline)
  - [ ] Third Tab: Close button (blue outline)
  - [ ] Fourth Tab: Cycles back to GitHub link
- [ ] **7.3** Press Shift+Tab to cycle backwards:
  - [ ] From Close → Checkbox → GitHub link → Close
- [ ] **7.4** With checkbox focused, press Space:
  - [ ] Checkbox toggles on/off
- [ ] **7.5** Press Escape key:
  - [ ] Splash screen closes
  - [ ] Saves preference based on checkbox state

Notes:

Results:

#### 8. Backdrop Click
- [ ] **8.1** Open splash screen
- [ ] **8.2** Click on dark area outside modal
  - [ ] Splash screen closes
  - [ ] Saves preference based on checkbox state

Notes:

Results:

#### 9. Responsive Layout Testing
- [ ] **9.1** Test at various window widths:
  - [ ] Full width: Checkbox and Close button centered, on same row
  - [ ] Medium width: Still on same row, centered
  - [ ] Minimum width: Checkbox and Close stay on same row (never wrap)
- [ ] **9.2** Verify spacing:
  - [ ] No excessive padding at bottom
  - [ ] Balanced spacing above and below checkbox/button section
- [ ] **9.3** Verify scrolling:
  - [ ] Modal itself never scrolls
  - [ ] Only highlights list scrolls when content is too long
  - [ ] Header (title, date, subtitle) always visible at top
  - [ ] Footer (GitHub link) always visible above actions

Notes:

Results:

#### 10. Version Upgrade Simulation
- [ ] **10.1** Simulate being on old version:
  - [ ] Run: `localStorage.setItem('lastSplashVersion', '0.6.5')`
  - [ ] Run: `localStorage.removeItem('splashDismissedUnchecked')`
- [ ] **10.2** Reload app
  - [ ] Splash screen should appear (version change detected)
  - [ ] Shows v0.7.0 content
- [ ] **10.3** Dismiss with checkbox checked
- [ ] **10.4** Reload app
  - [ ] Splash screen should NOT appear
  - [ ] localStorage should have `lastSplashVersion: "0.7.0"`

Notes:

Results:

#### 11. localStorage Keys Review
- [ ] **11.1** Check for old version-specific keys:
  - [ ] Run: `Object.keys(localStorage).filter(k => k.includes('splash'))`
  - [ ] Should only see: `lastSplashVersion` and possibly `splashDismissedUnchecked`
  - [ ] Should NOT see: `splashScreenShown_0.7.0` or similar version-specific keys
- [ ] **11.2** Verify migration keys:
  - [ ] Run: `localStorage.getItem('migrationVersion')`
  - [ ] Should return: `"0.7.0"`
  - [ ] Run: `localStorage.getItem('migrationToastShown_0.7.0')`
  - [ ] Should return: `"true"` (after first launch)

Notes:

Results:

#### 12. Visual Polish
- [ ] **12.1** Verify header layout:
  - [ ] Title and date on same row
  - [ ] Date aligned to right
  - [ ] Subtitle below title (one line)
- [ ] **12.2** Verify footer layout:
  - [ ] GitHub button centered
  - [ ] Button has GitHub icon on left
  - [ ] Hover shows background color change
  - [ ] Focus shows blue outline
- [ ] **12.3** Verify actions layout:
  - [ ] Checkbox and Close button centered together
  - [ ] Both on same row at all widths
  - [ ] Adequate spacing between checkbox and button
- [ ] **12.4** Test in light and dark themes:
  - [ ] All text is readable
  - [ ] Borders are visible
  - [ ] Colors match app theme

Notes:

Results:

#### 13. Edge Cases
- [ ] **13.1** Open splash screen while another modal is open:
  - [ ] Opens settings modal
  - [ ] Click version link
  - [ ] Splash should open on top
  - [ ] Close splash → returns to settings
- [ ] **13.2** Rapid clicking:
  - [ ] Click Close button multiple times rapidly
  - [ ] Should only save once, close cleanly
- [ ] **13.3** Multiple browser windows (if applicable):
  - [ ] Open two app windows
  - [ ] Dismiss in one window
  - [ ] Reload other window
  - [ ] Should respect dismissal (shared localStorage)

Notes:

Results:

**Test Results Summary:**
- Total Tests: 13 categories, ~60 individual checks
- Passed: ___
- Failed: ___
- Blockers: ___

**Found Issues:**
(Add notes for any issues found during testing)

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
