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
- I have tested all items
- I have marked a 'Y' against items that pass
- I have marked a 'N' against items that pass
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
  - [N] Toast notification shows: "Upgraded to v0.7.0 with hierarchical groups!"
  - [N] All groups are expanded (none collapsed)
  - [Y] All groups are visible (no filters active)
  - [Y] Filter badge shows "X/X" (all selected)
  - [Y] Ungrouped profiles appear in "Ungrouped" section
  
Notes:
- UI redesign:
  - New Group button moves to header:
    - Logo | Title (version underneath) | Expandable white space | New Profile | New Group | Settings
    - Due to increating item count (will have to wait until implemented), we may need to tweak how small size (under 800px) is handled
    - New Group button should have a colour, but not as obvious as the blue for New Profile (main action, draws users eyes to it)
  - Below header section revert back to:
    - Search Bar (expandable) | Expand/Collapse Groups | Filter Groups | Profile Count
    - Same collapse behaviour under 800px
  - Fix inconsistency with button names, what is best for the 'new item' actions
    - buttons without +, just text (e.g. New Group)
    - buttons with +, no text (e.g. + Group)
    - buttons with both + and text (e.g. + New Group)
    - review thoughts above on suggested 'new item' action approach

2 tests do not pass:
 - there was a popup notification around not able to colapse/expand due to corrupted data - therefore the new notification about migration never appeared
 - manually had to colapse/expand to get everything to show but after this, everything looks to be fine:
   - all profiles appear
   - all groups appear (including ungrouped)
   - filters reset correctly

#### 2. Group Creation
- [Y] **2.1** Click "+ Add Group" button
- [Y] **2.2** Modal opens with title "New Group"
- [Y] **2.3** Enter group name: "Web Servers"
  - [Y] Character counter shows "11 / 64"
  - [Y] Tooltip shows validation rules - SEE NOTES
- [Y] **2.4** Parent dropdown shows "-- Top Level --" (default)
- [N] **2.5** Click "Save" - verify:
  - [N] Modal closes
  - [N] New group "Web Servers" appears in main list
  - [N] Toast shows: "Group created successfully!"
  - [N] Group is expanded by default
  
Notes:
- Group Name helptext does not fit on the screen, it shows above and covers the 'New Group' title
  - Suggest tooltips are changed to only popup if the field becomes invalid? Maybe tooltip could be shown on each field with a ? button at the end of each field?
  - user types too many or incorrect characters etc. will show the tooltip, otherwise it's hidden when focused and maybe visible by ? button mentioned above
  - review thoughts above on suggested approach
  
5 tests do not pass:
- Unable to create group due to error:
Failed to save group: invalid args `input` for command `create_group`: command create_group missing required key input
- As I cannot create a group, I cannot test:
  - Modal closes
  - New group appears
  - Successfull notification toast
  - Group is expanded by default
- New Group modal should disable Save until all fields populated (consistency with the other settings/profile modal in the app)

#### 3. Sub-Group Creation
- [Y] **3.1** Hover over "Web Servers" group header
  - [Y] Menu button (⋮) appears on hover - SEE NOTES
- [Y] **3.2** Click menu button (⋮)
  - [Y] Context menu appears with: Rename Group, Add Subgroup, Delete Group - SEE NOTES
- [Y] **3.3** Click "Add Subgroup"
  - [Y] Modal opens with title "New Subgroup"
  - [N] Parent dropdown pre-selected to "Web Servers"
- [Y] **3.4** Enter name: "Apache Servers"
- [N] **3.5** Click "Save" - verify:
  - [N] Sub-group appears indented under "Web Servers" (20px indent)
  - [N] Toast shows: "Group created successfully!"
  
Notes:
- Menu button appears. It should be more obvious it's a menu (it's hard to see). It's also to the right of the profile counter, should be to the left.
- As menu button is far right, the menu popup goes to the right and is then partially cut off the screen (fixing above may resolve this)

4 tests do not pass:
- Parent dropdown is NOT pre-selected
- Unable to create group due to error (this is the same error as the Group creation):
Failed to save group: invalid args `input` for command `create_group`: command create_group missing required key input
- As I cannot create a group, I cannot test:
  - Modal closes
  - New sub-group appears
  - Successfull notification toast
  - Group is expanded by default
- New Sub-Group modal should disable Save until all fields populated (consistency with the other settings/profile modal in the app)

#### 4. Deep Nesting (3-Level Hierarchy)
- [N] **4.1** Create sub-group under "Apache Servers" named "Staging"
  - [N] Verify 40px indentation (2 levels deep)
- [N] **4.2** Try to create sub-group under "Staging"
  - [N] Backend should reject (max 3 levels)
  - [N] Toast error appears

5 tests do not pass:
- As I cannot create group/sub-group, i cannot test any of these

#### 5. Group Renaming
- [Y] **5.1** Click menu (⋮) on "Web Servers"
- [Y] **5.2** Click "Rename Group"
  - [Y] Modal opens with title "Edit Group"
  - [Y] Current name "Web Servers" is pre-filled
- [Y] **5.3** Change to "Production Web Servers"
- [N] **5.4** Click "Save" - verify:
  - [N] Group name updates in UI
  - [N] Toast shows: "Group updated successfully!"
  - [N] Sub-groups remain under renamed group

4 tests do not pass:
- likely related to the errors above, when updating a Group, there is an error:
Failed to save group: invalid args `input` for command `update_group`: command update_group missing required key input
- Edit Group modal should disable Save until all fields populated (consistency with the other settings/profile modal in the app)

#### 6. Profile Assignment to Groups
- [Y] **6.1** Click "+ New Profile" to create a profile
- [Y] **6.2** In profile form, locate "Group" dropdown
  - [Y] Dropdown shows "-- Ungrouped --" as default
  - [N] Dropdown shows all groups with hierarchical paths:
    - [Y] "Production Web Servers"
    - [N] "Production Web Servers/Apache Servers"
    - [N] "Production Web Servers/Apache Servers/Staging"
    - [N] Other groups...
- [N] **6.3** Select "Production Web Servers/Apache Servers"
- [Y] **6.4** Fill required fields and save
- [Y] **6.5** Verify profile appears under "Apache Servers" sub-group

Notes:
- Implementation approach was not exactly what I was hoping for
  - Group field should be typable (free-form), but each time you type, it should dynamically search for groups that match
  - User can then select from the items that are popping up (so they don't have to type the full thing)
  - If they contine typing something that does not exist, it will create that group (visual hint that this is what will happen)
  - Use / to denote a Sub-Group in the suggestions and if creating new - for example:
    - User types ParentGroupExample/SubGroupExample
    - 2 new groups created (the 'ParentGroupExample' Group at top level and 'SubGroupExample' as a sub-group of the parent)
    - Profile is saved under Sub-Group 'SubGroupExample'
    
5 tests do not pass:
- Unable to test showing hiertarchical paths as I cannot create sub-groups

#### 7. Hierarchical Rendering
- [N] **7.1** Verify visual hierarchy:
  - [N] Top-level groups have no indentation
  - [N] 1st level sub-groups have 20px left padding on header
  - [N] 2nd level sub-groups have 40px left padding on header
  - [N] Profiles within groups also show indentation
- [N] **7.2** Expand/collapse top-level group
  - [N] All child groups and profiles hide/show together
  - [N] Chevron changes: ▶ (collapsed) ↔ ▼ (expanded)

8 tests do not pass:
- Unable to test hiertarchical rendering as I cannot create sub-groups

#### 8. Group Filtering
- [Y] **8.1** Click "Filter Groups" button
- [N] **8.2** Popup appears showing all groups with hierarchical paths
- [N] **8.3** Uncheck "Production Web Servers"
  - [N] Group and all sub-groups/profiles disappear from main list
  - [N] Badge updates to show "X-1/X"
- [N] **8.4** Re-check the group
  - [N] Group reappears with all contents
  - [N] Badge updates to "X/X"
- [N] **8.5** Click "Clear All Filters"
  - [N] All groups become visible
  - [N] Badge shows "X/X"

Notes:
- It was in the plan that 'Sub Groups' are NOT part of the filters
- Group filters only applies to the top level 'Parent' Groups
- If a Parent Group is unchecked, itself and ANY sub-groups, are hidden from the list
- simplistic approach, does not completely bloat the filter list

10 tests do not pass:
- Unable to test hiertarchical group filters as I cannot create sub-groups

#### 9. Collapse/Expand All
- [Y] **9.1** Collapse several groups manually
- [Y] **9.2** Click "Expand Groups" button
  - [Y] All groups expand
  - [Y] Button text changes to "Collapse Groups"
- [Y] **9.3** Click "Collapse Groups" button
  - [Y] All groups collapse
  - [Y] Button text changes to "Expand Groups"

Notes:
- All tests passed; however I am unable to test this works in full due to not being able to create sub-groups

#### 10. Group Deletion - Empty Group
- [N] **10.1** Create a new empty group "Test Group"
- [N] **10.2** Click menu (⋮) → "Delete Group"
  - [N] Simple confirmation appears: "Are you sure...?"
  - [N] Two buttons: "Delete" (danger), "Cancel"
- [N] **10.3** Click "Delete"
  - [N] Group disappears
  - [N] Toast shows: "Group deleted successfully!"

all tests do not pass:
- Unable to create new Groups/Sub-Groups so cannot test

#### 11. Group Deletion - Delete All Mode
- [N] **11.1** Create group "Temp" with 2 profiles
- [N] **11.2** Click menu (⋮) → "Delete Group"
  - [N] Confirmation shows: "Contains: 2 profile(s) and 0 subgroup(s)"
  - [N] Three buttons: "Delete All", "Move to Parent", "Cancel"
  - [N] Warning text explains both options
- [N] **11.3** Click "Delete All"
  - [N] Group AND all profiles deleted
  - [N] Toast shows: "Group and all contents deleted successfully!"

all tests do not pass:
- Unable to create new Groups/Sub-Groups so cannot test

#### 12. Group Deletion - Move to Parent Mode
- [N] **12.1** Create hierarchy:
  - [N] "Parent Group"
    - [N] "Child Group" (with 2 profiles)
- [N] **12.2** Delete "Child Group" using "Move to Parent"
  - [N] Profiles move to "Parent Group"
  - [N] "Child Group" disappears
  - [N] Toast shows: "Group deleted. Contents moved to parent group."
  - [N] Verify 2 profiles now appear under "Parent Group"

all tests do not pass:
- Unable to create new Groups/Sub-Groups so cannot test

#### 13. Group Deletion - Top-Level Move to Parent
- [N] **13.1** Create top-level group "Temporary" with 2 profiles
- [N] **13.2** Delete using "Move to Parent"
  - [N] Profiles move to "Ungrouped" section
  - [N] Toast shows: "Group deleted. Contents moved to top level."

Notes:
- I like the approach (profiles can move to 'ungrouped' but maybe an additional helptext/tip is shown that this will be the case when deleting a top level group)

all tests do not pass:
- Unable to create new Groups/Sub-Groups so cannot test

#### 14. Persistence Testing
- [Y] **14.1** Create groups, collapse some, filter some
- [Y] **14.2** Close and relaunch app
  - [Y] Groups persist
  - [N] Collapsed state persists
  - [N] Filter state persists
  - [Y] Profiles remain in correct groups

2 tests do not pass:
- collapsed state doesn't seem to persist, launching app shows nothing (like initial launch after migration)
- Filter state doesn't appear to work fully. It does filter the profiles from being visible, but the group header is still shown (it should be completely hidden) - this ties into the notes above about filtering only being done at top group level ad EVERYTHING underneath is then hidden

#### 15. Edge Cases
- [Y] **15.1** Group name with special characters:
  - [Y] Try: "Test-Group_2024 (Production) [v1.0] #main"
  - [Y] Should work (allowed chars: - _ ( ) . [ ] #) - SEE NOTES
- [Y] **15.2** Group name: 64 characters
  - [Y] Should work (max length)
  - [Y] Character counter shows "64 / 64"
- [Y] **15.3** Group name: 65 characters
  - [Y] Should fail validation
- [Y] **15.4** Duplicate group names at same level
  - [N] Should fail (backend enforces uniqueness per parent)
- [N] **15.5** Duplicate group names at different levels
  - [N] Should work (different parent_id)
  
Notes:
- test for 'Test-Group_2024 (Production) [v1.0] #main' did work, but due to error about creating groups, it doesn't create it but there are no validation errors
- noted a UI issue where when you type invalid characters the field does not highlight red around the edge (see the New Profile modal as this has similar validation rules and UI around this - New/Edit Group/Sub-Group modal should be consistent)

3 tests do not pass:
- Duplicate Group name cannot test as I am unable to save a new group due to issue mentioned previously
- Same goes to checking duplicate Sub-Group as I am unable to save a sub-group either

#### 16. Profile Editing
- [Y] **16.1** Edit an existing profile
- [Y] **16.2** Change its group assignment
- [Y] **16.3** Save
  - [Y] Profile moves to new group in UI
  - [Y] Toast shows: "Profile updated successfully!"

#### 17. UI Polish
- [Y] **17.1** Group menu button (⋮):
  - [Y] Hidden by default
  - [Y] Appears on group header hover
  - [Y] Smooth opacity transition - SEE NOTES
- [Y] **17.2** Context menu:
  - [Y] Positioned near click location
  - [Y] Closes when clicking outside
  - [Y] Items have hover effect - SEE NOTES
- [N] **17.3** Hierarchical paths in dropdowns:
  - [N] Clear and readable
  - [N] Sorted alphabetically
  - [N] Top-level option always first

Notes:
- Mentioned previously regarding the Group Menu button:
  - It's quite small so hard to see, also should move to left of profile count.
  - When it's larger/more obvious, transitions may be more obvious, too small at the moment to really see
  - I think it may be best to be perminantly visible, more obvious to user there is a context menu
  
4 tests do not pass:
- Unable to create new Sub-Groups so cannot test Hierarchical paths in dropdowns

#### 18. Migration Edge Cases
- [Y] **18.1** Verify second launch (migration already done):
  - [Y] No toast notification
  - [N] No reset of filters/collapsed state - SEE NOTES
  - [Y] localStorage has `migrationVersion: "0.7.0"`

Notes:
- Mentioned previously, when launching, nothing is visible, have to collapse/expand toggle to see
- Filters appear to be remembered correctly
- Unable to test proper collapsed state due to having to toggle the button to see anything

#### 19. Performance
- [ ] **19.1** Create 20+ groups with deep nesting
  - [ ] UI remains responsive
  - [ ] Rendering is smooth
- [ ] **19.2** Create 100+ profiles across groups
  - [ ] Search works quickly
  - [ ] Expand/collapse is instant
  
Notes:
- Not testing at this time (will do later when everything else is working)

#### 20. Error Handling
- [Y] **20.1** Try to rename group to empty string
  - [Y] Should fail validation
  - [N] Toast error appears
- [N] **20.2** Try to create circular reference (if possible via UI)
  - [N] Backend should prevent
- [N] **20.3** Delete group while profile modal is open referencing that group
  - [N] Should handle gracefully

5 tests do not pass:
- Validation appears to work, sort of, it says 'fill out this field'
  - similar to references above, the consistency of the validation doesn't follow what is used on the profile modal
  - no error toast is displayed either
- Unable to test 20.2 and 20.3 due to not being possible in the GUI


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
