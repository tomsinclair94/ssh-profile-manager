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

**Phase 3 Test Plan:** 🧪 Ready for Testing

Use this checklist to thoroughly test Phase 3 functionality. Check off each item as you test it.

#### 1. Migration Testing (v0.6.5 → v0.7.0)
- [ ] **1.1** Fresh install: Delete `~/Library/Application Support/ssh-profile-manager/` directory
- [ ] **1.2** Install v0.6.5 and create test data:
  - [ ] Create 3-5 profiles with group names (e.g., "Production", "Development", "Testing")
  - [ ] Create 2-3 ungrouped profiles
  - [ ] Collapse some groups
  - [ ] Filter out some groups (hide them)
- [ ] **1.3** Close v0.6.5 and install v0.7.0
- [ ] **1.4** Launch v0.7.0 - verify:
  - [ ] All profiles appear under their correct groups (migrated by name)
  - [ ] Toast notification shows: "Upgraded to v0.7.0 with hierarchical groups!"
  - [ ] All groups are expanded (none collapsed)
  - [ ] All groups are visible (no filters active)
  - [ ] Filter badge shows "X/X" (all selected)
  - [ ] Ungrouped profiles appear in "Ungrouped" section

#### 2. Group Creation
- [ ] **2.1** Click "+ Add Group" button
- [ ] **2.2** Modal opens with title "New Group"
- [ ] **2.3** Enter group name: "Web Servers"
  - [ ] Character counter shows "11 / 64"
  - [ ] Tooltip shows validation rules
- [ ] **2.4** Parent dropdown shows "-- Top Level --" (default)
- [ ] **2.5** Click "Save" - verify:
  - [ ] Modal closes
  - [ ] New group "Web Servers" appears in main list
  - [ ] Toast shows: "Group created successfully!"
  - [ ] Group is expanded by default

#### 3. Sub-Group Creation
- [ ] **3.1** Hover over "Web Servers" group header
  - [ ] Menu button (⋮) appears on hover
- [ ] **3.2** Click menu button (⋮)
  - [ ] Context menu appears with: Rename Group, Add Subgroup, Delete Group
- [ ] **3.3** Click "Add Subgroup"
  - [ ] Modal opens with title "New Subgroup"
  - [ ] Parent dropdown pre-selected to "Web Servers"
- [ ] **3.4** Enter name: "Apache Servers"
- [ ] **3.5** Click "Save" - verify:
  - [ ] Sub-group appears indented under "Web Servers" (20px indent)
  - [ ] Toast shows: "Group created successfully!"

#### 4. Deep Nesting (3-Level Hierarchy)
- [ ] **4.1** Create sub-group under "Apache Servers" named "Staging"
  - [ ] Verify 40px indentation (2 levels deep)
- [ ] **4.2** Try to create sub-group under "Staging"
  - [ ] Backend should reject (max 3 levels)
  - [ ] Toast error appears

#### 5. Group Renaming
- [ ] **5.1** Click menu (⋮) on "Web Servers"
- [ ] **5.2** Click "Rename Group"
  - [ ] Modal opens with title "Edit Group"
  - [ ] Current name "Web Servers" is pre-filled
- [ ] **5.3** Change to "Production Web Servers"
- [ ] **5.4** Click "Save" - verify:
  - [ ] Group name updates in UI
  - [ ] Toast shows: "Group updated successfully!"
  - [ ] Sub-groups remain under renamed group

#### 6. Profile Assignment to Groups
- [ ] **6.1** Click "+ New Profile" to create a profile
- [ ] **6.2** In profile form, locate "Group" dropdown
  - [ ] Dropdown shows "-- Ungrouped --" as default
  - [ ] Dropdown shows all groups with hierarchical paths:
    - [ ] "Production Web Servers"
    - [ ] "Production Web Servers/Apache Servers"
    - [ ] "Production Web Servers/Apache Servers/Staging"
    - [ ] Other groups...
- [ ] **6.3** Select "Production Web Servers/Apache Servers"
- [ ] **6.4** Fill required fields and save
- [ ] **6.5** Verify profile appears under "Apache Servers" sub-group

#### 7. Hierarchical Rendering
- [ ] **7.1** Verify visual hierarchy:
  - [ ] Top-level groups have no indentation
  - [ ] 1st level sub-groups have 20px left padding on header
  - [ ] 2nd level sub-groups have 40px left padding on header
  - [ ] Profiles within groups also show indentation
- [ ] **7.2** Expand/collapse top-level group
  - [ ] All child groups and profiles hide/show together
  - [ ] Chevron changes: ▶ (collapsed) ↔ ▼ (expanded)

#### 8. Group Filtering
- [ ] **8.1** Click "Filter Groups" button
- [ ] **8.2** Popup appears showing all groups with hierarchical paths
- [ ] **8.3** Uncheck "Production Web Servers"
  - [ ] Group and all sub-groups/profiles disappear from main list
  - [ ] Badge updates to show "X-1/X"
- [ ] **8.4** Re-check the group
  - [ ] Group reappears with all contents
  - [ ] Badge updates to "X/X"
- [ ] **8.5** Click "Clear All Filters"
  - [ ] All groups become visible
  - [ ] Badge shows "X/X"

#### 9. Collapse/Expand All
- [ ] **9.1** Collapse several groups manually
- [ ] **9.2** Click "Expand Groups" button
  - [ ] All groups expand
  - [ ] Button text changes to "Collapse Groups"
- [ ] **9.3** Click "Collapse Groups" button
  - [ ] All groups collapse
  - [ ] Button text changes to "Expand Groups"

#### 10. Group Deletion - Empty Group
- [ ] **10.1** Create a new empty group "Test Group"
- [ ] **10.2** Click menu (⋮) → "Delete Group"
  - [ ] Simple confirmation appears: "Are you sure...?"
  - [ ] Two buttons: "Delete" (danger), "Cancel"
- [ ] **10.3** Click "Delete"
  - [ ] Group disappears
  - [ ] Toast shows: "Group deleted successfully!"

#### 11. Group Deletion - Delete All Mode
- [ ] **11.1** Create group "Temp" with 2 profiles
- [ ] **11.2** Click menu (⋮) → "Delete Group"
  - [ ] Confirmation shows: "Contains: 2 profile(s) and 0 subgroup(s)"
  - [ ] Three buttons: "Delete All", "Move to Parent", "Cancel"
  - [ ] Warning text explains both options
- [ ] **11.3** Click "Delete All"
  - [ ] Group AND all profiles deleted
  - [ ] Toast shows: "Group and all contents deleted successfully!"

#### 12. Group Deletion - Move to Parent Mode
- [ ] **12.1** Create hierarchy:
  - [ ] "Parent Group"
    - [ ] "Child Group" (with 2 profiles)
- [ ] **12.2** Delete "Child Group" using "Move to Parent"
  - [ ] Profiles move to "Parent Group"
  - [ ] "Child Group" disappears
  - [ ] Toast shows: "Group deleted. Contents moved to parent group."
  - [ ] Verify 2 profiles now appear under "Parent Group"

#### 13. Group Deletion - Top-Level Move to Parent
- [ ] **13.1** Create top-level group "Temporary" with 2 profiles
- [ ] **13.2** Delete using "Move to Parent"
  - [ ] Profiles move to "Ungrouped" section
  - [ ] Toast shows: "Group deleted. Contents moved to top level."

#### 14. Persistence Testing
- [ ] **14.1** Create groups, collapse some, filter some
- [ ] **14.2** Close and relaunch app
  - [ ] Groups persist
  - [ ] Collapsed state persists
  - [ ] Filter state persists
  - [ ] Profiles remain in correct groups

#### 15. Edge Cases
- [ ] **15.1** Group name with special characters:
  - [ ] Try: "Test-Group_2024 (Production) [v1.0] #main"
  - [ ] Should work (allowed chars: - _ ( ) . [ ] #)
- [ ] **15.2** Group name: 64 characters
  - [ ] Should work (max length)
  - [ ] Character counter shows "64 / 64"
- [ ] **15.3** Group name: 65 characters
  - [ ] Should fail validation
- [ ] **15.4** Duplicate group names at same level
  - [ ] Should fail (backend enforces uniqueness per parent)
- [ ] **15.5** Duplicate group names at different levels
  - [ ] Should work (different parent_id)

#### 16. Profile Editing
- [ ] **16.1** Edit an existing profile
- [ ] **16.2** Change its group assignment
- [ ] **16.3** Save
  - [ ] Profile moves to new group in UI
  - [ ] Toast shows: "Profile updated successfully!"

#### 17. UI Polish
- [ ] **17.1** Group menu button (⋮):
  - [ ] Hidden by default
  - [ ] Appears on group header hover
  - [ ] Smooth opacity transition
- [ ] **17.2** Context menu:
  - [ ] Positioned near click location
  - [ ] Closes when clicking outside
  - [ ] Items have hover effect
- [ ] **17.3** Hierarchical paths in dropdowns:
  - [ ] Clear and readable
  - [ ] Sorted alphabetically
  - [ ] Top-level option always first

#### 18. Migration Edge Cases
- [ ] **18.1** Verify second launch (migration already done):
  - [ ] No toast notification
  - [ ] No reset of filters/collapsed state
  - [ ] localStorage has `migrationVersion: "0.7.0"`

#### 19. Performance
- [ ] **19.1** Create 20+ groups with deep nesting
  - [ ] UI remains responsive
  - [ ] Rendering is smooth
- [ ] **19.2** Create 100+ profiles across groups
  - [ ] Search works quickly
  - [ ] Expand/collapse is instant

#### 20. Error Handling
- [ ] **20.1** Try to rename group to empty string
  - [ ] Should fail validation
  - [ ] Toast error appears
- [ ] **20.2** Try to create circular reference (if possible via UI)
  - [ ] Backend should prevent
- [ ] **20.3** Delete group while profile modal is open referencing that group
  - [ ] Should handle gracefully

**Test Results Summary:**
- Total Tests: 20 categories, ~80 individual checks
- Passed: ___
- Failed: ___
- Blockers: ___

**Found Issues:**
(Document any bugs or issues discovered during testing here)

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
