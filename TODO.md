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

**Phase 3 Cleanup Tasks:**
- [ ] Fix Rust compiler warnings (non-critical):
  - Unused variable `session_id` at `src/lib.rs:305:38` (prefix with underscore)
  - Unused variable `abandoned_at` at `src/lib.rs:305:58` (prefix with underscore)
  - Note: These are in thread cleanup code and don't affect functionality

**Phase 3 - Critical Bug Fixes:** 🔧 In Progress

**Phase A - Critical Blockers:** ✅ Completed
- [x] Fix profile validation to allow hierarchical paths (slash character in group paths)
- [x] Fix sub-group visual indentation CSS (20px per level not showing) - Fixed with CSS classes (depth-1, depth-2, depth-3)
- [x] Fix profile card indentation to match parent group - Also uses CSS depth classes
- [x] Fix group deletion FOREIGN KEY constraint error
- [x] Fix group filtering to hide group headers and sub-groups
- [x] Fix cascading profile counts (parent groups now show total including descendants)

**Phase B - High Priority:**
- [ ] Fix context menu positioning (goes off-screen on right side)
- [ ] Fix multiple context menus appearing simultaneously
- [ ] Fix collapse all button for empty groups containing sub-groups
- [ ] Set Ungrouped as default in profile group dropdown

**Phase C - UI Polish:**
- [ ] Fix delete group modal formatting issues
- [ ] Improve toast error messages (cleaner, user-friendly versions)

**Phase 3 - Extra Features (Nice-to-Have):**
- [ ] Tooltip behavior when field is focused (allow hover even when typing)
- [ ] Modal auto-scroll for dropdowns (scroll to show full dropdown)
- [ ] Better sub-group collapse behavior (collapse sub-groups when parent collapses, not just hide)

**Phase 4 Progress (New Version Splash Screen):** 📋 Planned

**Features:**
- [ ] Splash screen on first launch of new version
- [ ] Display high-level changelog (major features/fixes only)
- [ ] Link to GitHub release for full changelog
- [ ] Close button with "Don't show again" checkbox (default enabled)
- [ ] Persistence: don't show again if dismissed with checkbox
- [ ] Show again if dismissed without checkbox until finally dismissed
- [ ] Version/GitHub link in settings/about should show splash screen
- [ ] Link should always point to matching version Git release

**Phase 3 Test Plan:** 🧪 Ready for Testing

Use this checklist to thoroughly test Phase 3 functionality. Check off each item as you test it.
- I have tested all items
- I have marked a 'Y' against items that pass
- I have marked a 'N' against items that pass
- I have marked a '/' against items I no longer need to test / will test at a later date
- I have optionally added 'SEE NOTES' to items that pass/fail but have some recommended changes
- Under each Main Test group I have added optional Notes and a test/failure summary with details
- All tests were conducted using my existing production 0.6.5 build and upgrading to the 0.7.0 production build from the project

#### 1. Migration Testing (v0.6.5 → v0.7.0)
- [Y] **1.1** Fresh install: Delete `~/Library/Application Support/ssh-profile-manager/` directory
- [Y] **1.2** Install v0.6.5 and create test data:
  - [Y] Create 3-5 profiles with group names (e.g., "Production", "Development", "Testing")
  - [Y] Create 2-3 ungrouped profiles
  - [Y] Collapse some groups
  - [Y] Filter out some groups (hide them)
- [Y] **1.3** Close v0.6.5 and install v0.7.0
- [Y] **1.4** Launch v0.7.0 - verify:
  - [Y] All profiles appear under their correct groups (migrated by name)
  - [Y] Toast notification shows: "Upgraded to v0.7.0 with hierarchical groups!" - SEE NOTES
  - [Y] All groups are expanded (none collapsed)
  - [Y] All groups are visible (no filters active)
  - [Y] Filter badge shows "X/X" (all selected)
  - [Y] Ungrouped profiles appear in "Ungrouped" section
  
Notes:
- toast notification worked after successful upgrade/migration... However, I think it might be good to present a splash screen on first launch of a new version that states high level changelog
  - the new splash screen should contain a high level of features/fixes (only major stuff) and a link to the release on GitHub to see full change log
  - the splash screen should have a close button and a check box that says 'don't show again' (default enabled)
  - if user closes splash screen, it doesn't show on subsequence launches
  - if user closes splash screen and unticks 'don't show again', it shows the next time (until user finally dismisses with the option ticked)
- with the new splash screen approach, it should always have a link to the matching version Git release
  - the version/github link current in the settings/about section instead of going to the GitHub release, should show the new splash screen instead

Results:
All tests passed!

#### 2. Group Creation
- [Y] **2.1** Click "+ Add Group" button
- [Y] **2.2** Modal opens with title "New Group"
- [Y] **2.3** Enter group name: "Web Servers"
  - [Y] Character counter shows "11 / 64"
  - [Y] Tooltip shows validation rules - SEE NOTES
- [Y] **2.4** Parent dropdown shows "-- Top Level --" (default)
- [Y] **2.5** Click "Save" - verify:
  - [Y] Modal closes
  - [Y] New group "Web Servers" appears in main list
  - [Y] Toast shows: "Group created successfully!"
  - [Y] Group is expanded by default
  
Notes:
- tool tip functions better (only on hover of field), not persistent - also on hover of the field name
  - when field is in focus (to type) it is not possible to hover any more. Can this be changed so it's possible to still hover over the field even when it is focused?
  - if you focus field and start typing, the mouse is hidden anyway. so if use selected box, types but then moves mouse to hover the field, even if it's still in focus to type, the tooltip should show

Results:
All tests passed!

#### 3. Sub-Group Creation
- [Y] **3.1** Hover over "Web Servers" group header
  - [Y] Menu button (⋮) appears on hover - we changed this to a persistent cog icon, but working
- [Y] **3.2** Click menu button (⋮)
  - [Y] Context menu appears with: Rename Group, Add Subgroup, Delete Group - SEE NOTES
- [Y] **3.3** Click "Add Subgroup"
  - [Y] Modal opens with title "New Subgroup"
  - [Y] Parent dropdown pre-selected to "Web Servers"
- [Y] **3.4** Enter name: "Apache Servers"
- [Y] **3.5** Click "Save" - verify:
  - [N] Sub-group appears indented under "Web Servers" (20px indent)
  - [Y] Toast shows: "Group created successfully!"
  
Notes:
- As menu button is far right, the menu popup goes to the right and is then partially cut off the screen so need to adjust
- Menu button also retains the pop up if you then select a setting cog on another group, then you have 2 menus showing etc. this needs to be fixed so only 1 menu can ever be displayed at a time

Results:
1 test did not pass fully
- The Sub-Group did appear, however there was no indent so it is not obvious it is a nested Sub-Group. It looks like another top level group but with slightly smaller margin between the two. It needs to be more obvious it is a nested Sub-Group

#### 4. Deep Nesting (3-Level Hierarchy)
- [Y] **4.1** Create sub-group under "Apache Servers" named "Staging"
  - [N] Verify 40px indentation (2 levels deep)
- [Y] **4.2** Try to create sub-group under "Staging"
  - [Y] Backend should reject (max 3 levels)
  - [Y] Toast error appears - SEE NOTES
  
Notes:
- Toast worked fine but error message needs refinging and maybe adopt a 'Error' on 1 line then the actual Error on a 2nd line. We likely need to fix consistency for all the Toast notifications (good and bad) so maybe this can be part of a larger code base fix for all Toasts?

(Results:
1 test did not pass fully
- The Sub-Group did appear, however there was no indent so it is not obvious it is a nested Sub-Group. Similar to above, it looks like 3 Groups now all together, there is no indenting for the 1st or 2nd level Sub-Group

#### 5. Group Renaming
- [Y] **5.1** Click menu (⋮) on "Web Servers"
- [Y] **5.2** Click "Rename Group"
  - [Y] Modal opens with title "Edit Group"
  - [Y] Current name "Web Servers" is pre-filled
- [Y] **5.3** Change to "Production Web Servers"
- [Y] **5.4** Click "Save" - verify:
  - [Y] Group name updates in UI
  - [Y] Toast shows: "Group updated successfully!"
  - [Y] Sub-groups remain under renamed group

Results:
All tests passed!

#### 6. Profile Assignment to Groups
- [Y] **6.1** Click "+ New Profile" to create a profile
- [Y] **6.2** In profile form, locate "Group" dropdown - SEE NOTES
  - [N] Dropdown shows "-- Ungrouped --" as default
  - [Y] Dropdown shows all groups with hierarchical paths:
    - [Y] "Production Web Servers"
    - [Y] "Production Web Servers/Apache Servers"
    - [Y] "Production Web Servers/Apache Servers/Staging"
    - [Y] Other groups...
- [Y] **6.3** Select "Production Web Servers/Apache Servers"
- [Y] **6.4** Fill required fields and save
- [N] **6.5** Verify profile appears under "Apache Servers" sub-group

Notes:
- Drop-Down loads okay, however there is no margin at the bottom of the dropdown and the modal (can send screenshot to show)
  - as the drop-down opening means the modal needs to scroll down a bit to see it, it should probably auto scroll. current behaviour opens drop-down but you can only see the first few entries and the whole modal needs to be scrolled to see the entire drop-down window space
    
Results:
2 tests do not pass:
- Ungrouped was not the default group selected
- Unable to save Profile. When you select a Sub-Group which therefor uses a path like 'group/sub-group' it products an error:
  - Group: Only letters, numbers, spaces, and - _ ( ) . [ ] # allowed

#### 7. Hierarchical Rendering
- [Y] **7.1** Verify visual hierarchy:
  - [Y] Top-level groups have no indentation
  - [N] 1st level sub-groups have 20px left padding on header
  - [N] 2nd level sub-groups have 40px left padding on header
  - [N] Profiles within groups also show indentation
- [Y] **7.2** Expand/collapse top-level group
  - [Y] All child groups and profiles hide/show together - SEE NOTES
  - [Y] Chevron changes: ▶ (collapsed) ↔ ▼ (expanded)

Notes:
- although all sub-groups become hidden, they aren't actually collapsed. the behaviour if you collapse a group/sub-group, the subsequent sub-group(s) below should be collapsed AND hidden

Results:
3 tests do not pass:
- Mentioned in a previous section, the indentation is not shown for the Sub-Group (both layers)
- Unabled to test indentation as I cannot create a profile in a Sub-Group (issue mentioned above)

#### 8. Group Filtering
- [Y] **8.1** Click "Filter Groups" button
- [Y] **8.2** Popup appears showing all groups with hierarchical paths - we changed this to only show top-level groups (it does and does not show sub-groups, which is correct)
- [Y] **8.3** Uncheck "Production Web Servers"
  - [N] Group and all sub-groups/profiles disappear from main list
  - [Y] Badge updates to show "X-1/X"
- [Y] **8.4** Re-check the group
  - [Y] Group reappears with all contents
  - [Y] Badge updates to "X/X"
- [Y] **8.5** Click "Clear All Filters"
  - [Y] All groups become visible
  - [Y] Badge shows "X/X"

Results:
1 test does not pass:
- When unselecting a Group, it does not remove from the list
  - I tested further and it looks like any profiles under the group become 'hidden' but any Sub-Groups and the Group itself do not hide like in previous versions - the top-level group when filtered out should hide, including all it's potential Sub-groups (all layers) and all Profiles

#### 9. Collapse/Expand All
- [Y] **9.1** Collapse several groups manually
- [Y] **9.2** Click "Expand Groups" button
  - [Y] All groups expand
  - [Y] Button text changes to "Collapse Groups"
- [Y] **9.3** Click "Collapse Groups" button
  - [N] All groups collapse
  - [Y] Button text changes to "Expand Groups"

Results:
1 test does not pass:
- the Collapse button at the top does NOT seem to collapse a Group that contains a Sub-Group - this seems to be the case when the Group/Sub-Group has no profiles (it did collapse a Group that contain a Sub-Group and Profiles)

#### 10. Group Deletion - Empty Group
- [Y] **10.1** Create a new empty group "Test Group"
- [Y] **10.2** Click menu (⋮) → "Delete Group"
  - [Y] Simple confirmation appears: "Are you sure...?" - SEE NOTES
  - [Y] Two buttons: "Delete" (danger), "Cancel"
- [Y] **10.3** Click "Delete"
  - [Y] Group disappears
  - [Y] Toast shows: "Group deleted successfully!"

Notes:
- Confirmation modal is fine but similar to Profile delete, should be a bigger warning (e.g. This action cannot be undone.)

Results:
All tests passed!

#### 11. Group Deletion - Delete All Mode
- [Y] **11.1** Create group "Temp" with 2 profiles
- [Y] **11.2** Click menu (⋮) → "Delete Group"
  - [Y] Confirmation shows: "Contains: 2 profile(s) and 0 subgroup(s)" - 
  - [Y] Three buttons: "Delete All", "Move to Parent", "Cancel"
  - [Y] Warning text explains both options
- [Y] **11.3** Click "Delete All"
  - [N] Group AND all profiles deleted
  - [N] Toast shows: "Group and all contents deleted successfully!"

Notes:
- Delete Group Modal shows but the formatting is all wrong (can provide screenshot)

Results:
2 tests do not pass:
- Unabled to delete group (so also get no deleted success Toast). Error when attempting to delete:
  - Failed to delete group: Failed to delete group: FOREIGN KEY constraint failed

#### 12. Group Deletion - Move to Parent Mode
- [/] **12.1** Create hierarchy:
  - [/] "Parent Group"
    - [/] "Child Group" (with 2 profiles)
- [/] **12.2** Delete "Child Group" using "Move to Parent"
  - [/] Profiles move to "Parent Group"
  - [/] "Child Group" disappears
  - [/] Toast shows: "Group deleted. Contents moved to parent group."
  - [/] Verify 2 profiles now appear under "Parent Group"

Unable to test - as I cannot create a profile in a Sub-Group, I cannot test this

#### 13. Group Deletion - Top-Level Move to Parent
- [Y] **13.1** Create top-level group "Temporary" with 2 profiles
- [Y] **13.2** Delete using "Move to Parent"
  - [Y] Profiles move to "Ungrouped" section
  - [Y] Toast shows: "Group deleted. Contents moved to top level."

Results:
All tests passed!

#### 14. Persistence Testing
- [Y] **14.1** Create groups, collapse some, filter some
- [Y] **14.2** Close and relaunch app
  - [Y] Groups persist
  - [Y] Collapsed state persists
  - [Y] Filter state persists
  - [Y] Profiles remain in correct groups

Results:
All tests passed!

#### 15. Edge Cases
- [Y] **15.1** Group name with special characters:
  - [Y] Try: "Test-Group_2024 (Production) [v1.0] #main"
  - [Y] Should work (allowed chars: - _ ( ) . [ ] #)
- [Y] **15.2** Group name: 64 characters
  - [Y] Should work (max length)
  - [Y] Character counter shows "64 / 64"
- [Y] **15.3** Group name: 65 characters
  - [Y] Should fail validation
- [Y] **15.4** Duplicate group names at same level
  - [Y] Should fail (backend enforces uniqueness per parent) - SEE NOTES
- [Y] **15.5** Duplicate group names at different levels
  - [Y] Should work (different parent_id)
  
Notes:
- error toast worked for duplicate but needs a bit of cleaning up. User probably only wants to see a user friendly error
  - Failed to save group: Failed to update group: UNIQUE constraint failed: index 'idx_groups_unique_name_parent'

Results:
All tests passed!

#### 16. Profile Editing
- [Y] **16.1** Edit an existing profile
- [Y] **16.2** Change its group assignment
- [Y] **16.3** Save
  - [Y] Profile moves to new group in UI
  - [Y] Toast shows: "Profile updated successfully!"

Results:
All tests passed!

#### 17. UI Polish
- [/] **17.1** Group menu button (⋮):
  - [/] Hidden by default
  - [/] Appears on group header hover
  - [/] Smooth opacity transition
- [Y] **17.2** Context menu:
  - [Y] Positioned near click location
  - [Y] Closes when clicking outside
  - [Y] Items have hover effect
- [Y] **17.3** Hierarchical paths in dropdowns:
  - [Y] Clear and readable
  - [Y] Sorted alphabetically
  - [Y] Top-level option always first

Notes:
- 17.1 no longer required - we changed to persistent cog icon
  
Results:
All tests passed!

#### 18. Migration Edge Cases
- [Y] **18.1** Verify second launch (migration already done):
  - [Y] No toast notification
  - [Y] No reset of filters/collapsed state
  - [Y] localStorage has `migrationVersion: "0.7.0"`

Results:
All tests passed!

#### 19. Performance
- [/] **19.1** Create 20+ groups with deep nesting
  - [/] UI remains responsive
  - [/] Rendering is smooth
- [/] **19.2** Create 100+ profiles across groups
  - [/] Search works quickly
  - [/] Expand/collapse is instant
  
Notes:
- Not testing at this time (will do later when everything else is working)

#### 20. Error Handling
- [Y] **20.1** Try to rename group to empty string
  - [/] Should fail validation - not required, no longer even lets you save
  - [/] Toast error appears - not required, no longer even lets you save
- [/] **20.2** Try to create circular reference (if possible via UI)
  - [/] Backend should prevent
- [/] **20.3** Delete group while profile modal is open referencing that group
  - [/] Should handle gracefully

Notes:
- Unable to test 20.2 and 20.3 due to not being possible in the GUI

Results:
All tests passed!

**Test Results Summary:**
- Total Tests: 20 categories, ~80 individual checks
- Passed: ___
- Failed: ___
- Blockers: ___

**Found Issues:**
See all the annotation embedded in the testing plan above

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
