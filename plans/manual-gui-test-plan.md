# Manual GUI Test Plan

**Purpose:** Comprehensive manual testing of frontend/GUI functionality for SSH Profile Manager.
**Scope:** All user-facing features (excludes backend logic covered by automated tests).
**Frequency:** Run before every major release (v0.7.0, v0.8.0, v1.0.0, etc.).

---

## Pre-Testing Setup

### Test Data Creation
- [x] Create 5+ groups (including nested groups: Parent/Child/GrandChild)
- [x] Create 20+ profiles across different groups
- [x] Create 5+ tags with different colors
- [x] Assign tags to various profiles
- [x] Mark 3+ profiles as favourites
- [x] Assign different icons to 5+ profiles
- [x] Connect to 3+ profiles to populate recent connections
- [x] Have at least 2 profiles with password authentication
- [x] Have at least 5 profiles with SSH key authentication

---

## macOS Testing

### 1. Profile Management

#### Profile Creation
- [x] Open "New Profile" modal (button click)
- [x] Open "New Profile" modal (keyboard shortcut: `N`)
- [x] Verify all form fields present (name, description, host, port, username, auth method, key path, group)
- [x] Create profile with SSH key authentication
- [x] Create profile with password authentication
- [x] Verify validation: empty name shows error
- [x] Verify validation: invalid host shows error
- [x] Verify validation: invalid port shows error
- [x] Verify validation: invalid username shows error
- [x] Test SSH key file browser (opens native file picker)
- [x] Test group dropdown (shows all groups)
- [x] Cancel profile creation (ESC key)
- [x] Cancel profile creation (Cancel button)
- [x] Verify modal closes and no profile created
- [x] Create profile and verify it appears in correct group

#### Profile Editing
- [x] Open profile edit modal (click profile card edit button)
- [x] Verify all fields populated with existing data
- [x] Edit profile name and save
- [x] Edit profile host and save
- [x] Edit profile port and save
- [x] Edit profile username and save
- [x] Change auth method from key to password
- [x] Change auth method from password to key
- [x] Change profile group (move to different group)
- [x] Edit description field
- [x] Cancel edit (ESC key) - verify no changes saved
- [x] Cancel edit (Cancel button) - verify no changes saved
- [x] Save with Cmd+S keyboard shortcut

#### Profile Display
- [x] Verify profile cards show correct icon
- [x] Verify profile cards show correct name
- [x] Verify profile cards show correct host
- [x] Verify profile cards show correct username
- [x] Verify profile cards show correct tags (colored badges)
- [x] Verify favourite star is filled gold for favourites
- [x] Verify favourite star is outlined grey for non-favourites
- [x] Hover over profile card (should show hover state, change colour, boarder etc.) 
- [x] Verify multi-line profiles are vertically centered correctly

#### Profile Favourites
- [x] Click star icon to add profile to favourites
- [x] Verify "Favourites" virtual group appears at top
- [x] Verify profile appears in Favourites group
- [x] Verify profile still visible in original group
- [x] Click "Go to Profile" button in Favourites (navigates to real location)
- [x] Click star icon to remove from favourites
- [x] Verify profile removed from Favourites group
- [x] Verify Favourites group auto-hides when empty

#### Profile Icons
- [x] Open icon picker modal (click icon on profile card)
- [x] Verify 40+ icons displayed in grid
- [x] Verify search box present
- [x] Search for "server" (should filter icons)
- [x] Search for "database" (should filter icons)
- [x] Clear search (should show all icons again)
- [x] Select new icon
- [x] Verify icon updates on profile card immediately
- [x] Keyboard navigation: Browse through icons with Up/Down Arrows
- [x] Keyboard navigation: Enter to select icon
- [x] Close modal with ESC key
- [x] Verify 'star', 'star-off', 'settings' NOT in picker (reserved icons)

#### Profile Deletion
- [x] Click delete button on profile card
- [x] Verify confirmation dialog appears
- [x] Verify dialog shows profile name highlighted
- [x] Cancel deletion (Cancel button)
- [x] Verify profile still exists
- [x] Click delete button again
- [x] Confirm deletion (Delete button - danger style)
- [x] Verify profile removed from UI immediately
- [x] Verify profile removed from Favourites if it was favourite

#### Profile Search & Filter
- [x] Open search (Cmd+S keyboard shortcut)
- [x] Search by profile name
- [x] Verify matching profiles highlighted/shown
- [x] Search by host
- [x] Search by username
- [x] Search with no matches (shows "no results" message)
- [x] Clear search (X button)
- [x] Clear search (ESC key)
- [x] Search with `tag:production` syntax
- [x] Search with multiple tags `tag:prod tag:dev` (OR logic)
- [x] Open filter dropdown (Cmd+F)
- [x] Filter by group
- [x] Verify only profiles in selected group shown
- [x] Clear filter
- [x] Verify all profiles shown again

### 2. Group Management

#### Group Creation
- [x] Open "New Group" modal (button click)
- [x] Open "New Group" modal (keyboard shortcut: `G`)
- [x] Create top-level group (no parent)
- [x] Verify group appears in sidebar
- [x] Create child group (select parent from dropdown)
- [x] Verify child appears nested under parent
- [x] Create grandchild group (3 levels deep)
- [x] Verify path displays correctly (e.g., "Work/Production/Servers")
- [x] Try to create 4th level (should be prevented - max 3 levels)
- [x] Verify validation: empty name shows error
- [x] Verify validation: invalid characters show error
- [x] Verify validation: "Ungrouped" name rejected (reserved)
- [x] Cancel group creation (ESC key)
- [x] Cancel group creation (Cancel button)
- [x] Save with Cmd+S keyboard shortcut

#### Group Display
- [x] Verify groups show in alphabetical order
- [x] Verify nested groups indented correctly
- [x] Verify expand/collapse arrows present for parent groups
- [x] Click expand arrow (should show children)
- [x] Click collapse arrow (should hide children)
- [x] Keyboard shortcut: Cmd+Right (expand all groups)
- [x] Keyboard shortcut: Cmd+Left (collapse all groups)
- [x] Verify profile count badge on each group
- [x] Verify "Ungrouped" group shows profiles without group assignment

#### Group Rename
- [x] Open group rename modal - select 'Edit Group' from the Action Menu
- [x] Edit group name
- [x] Save changes
- [x] Verify group name updated in sidebar
- [x] Verify all child group paths updated (cascade)
- [x] Verify all profile paths updated (cascade)
- [x] Verify rename doesn't affect groups with overlapping names (e.g., "Dev" vs "DevOps")
- [x] Cancel rename (ESC key)
- [x] Verify no changes applied

#### Group Move
- [x] Open group move modal - select 'Edit Group' from the Action Menu
- [x] Move group to different parent
- [x] Verify group appears under new parent
- [x] Verify group path updated
- [x] Verify all child group paths updated (cascade)
- [x] Verify all profile paths updated (cascade)
- [x] Move group to top level (select "None" as parent)
- [x] Verify group appears at root level
- [x] Cancel move (ESC key)

#### Group Deletion
- [x] Open group delete modal (click group, select "Delete")
- [x] Verify two options shown: "Move All" and "Delete All"
- [x] Select "Delete All"
- [x] Verify warning message shown (profiles will be deleted)
- [x] Verify confirmation dialog shows group name highlighted
- [x] Cancel deletion (ESC key or Cancel button)
- [x] Open delete modal again
- [x] Select "Move All"
- [x] Confirm deletion
- [x] Verify group deleted
- [x] Verify profiles moved to parent group
- [x] Verify child groups also deleted

### 3. Tag Management

#### Tag Creation
- [x] Open Tag Manager (button click)
- [x] Open Tag Manager (keyboard shortcut: `T`)
- [x] Click "Create Tag" button
- [x] Enter tag name
- [x] Select color from color picker
- [x] Verify color preview updates
- [x] Create tag
- [x] Verify tag appears in tag list
- [x] Verify validation: empty name shows error
- [x] Verify validation: invalid characters rejected (spaces not allowed)
- [x] Verify validation: max 32 characters enforced
- [x] Cancel tag creation (ESC key)
- [x] Cancel tag creation (Cancel button)

#### Tag Display
- [x] Verify tags show in alphabetical order
- [x] Verify tag color displayed correctly
- [x] Verify tag usage count shown (number of profiles)
- [x] Verify tags with 0 usage show "0"

#### Tag Assignment
- [x] Open profile edit modal
- [x] Open tag assignment dropdown
- [x] Select multiple tags (checkbox selection)
- [x] Save profile
- [x] Verify tags appear on profile card as colored badges
- [x] Verify tag text color is readable (black on light, white on dark backgrounds)
- [x] Remove tag from profile
- [x] Verify tag removed from profile card
- [x] Verify tag usage count decremented in Tag Manager

#### Tag Deletion
- [x] Open Tag Manager
- [x] Click delete button on tag
- [x] Verify confirmation dialog appears
- [x] Verify dialog shows tag name and usage count
- [x] Cancel deletion
- [x] Verify tag still exists
- [x] Delete tag with 0 usage
- [x] Verify tag removed immediately
- [x] Delete tag with active usage
- [x] Verify tag removed from all profiles
- [x] Verify profile cards update (tag badges removed)

### 4. Export/Import Workflows

#### Encryption Checkbox - Optional Scenario (Key-Auth Profile, Require Encryption OFF)
- [ ] Open Settings → Profile Management
- [ ] Verify "Require Encryption for All Exports" is UNCHECKED
- [ ] Verify "Include Passwords in Exports" setting (any state is fine)
- [ ] Select key-auth profile, click "Export Profile"
- [ ] Verify encryption modal appears
- [ ] Verify checkbox "Encrypt this export" is UNCHECKED and ENABLED
- [ ] Verify intro text: "Optionally encrypt this export for additional security"
- [ ] Verify help text: "Check the box above to encrypt this export"
- [ ] Verify password fields are DISABLED (greyed out)
- [ ] Verify Export button is ENABLED (can export without encryption)
- [ ] Click Export without checking checkbox
- [ ] Verify file saves successfully
- [ ] Open exported file - verify plain JSON (no encryption)

#### Encryption Checkbox - Toggling Behavior
- [ ] Export key-auth profile again (modal appears)
- [ ] Checkbox should be UNCHECKED and password fields DISABLED
- [ ] CHECK the "Encrypt this export" checkbox
- [ ] Verify password fields become ENABLED
- [ ] Verify Export button becomes DISABLED (needs password)
- [ ] Enter password <12 characters
- [ ] Verify Export button stays DISABLED
- [ ] Enter password ≥12 characters in both fields (matching)
- [ ] Verify Export button becomes ENABLED
- [ ] Verify strength meter shows appropriate level
- [ ] UNCHECK the checkbox again
- [ ] Verify password fields become DISABLED
- [ ] Verify password fields are CLEARED
- [ ] Verify strength meter is RESET
- [ ] Verify Export button becomes ENABLED again (no password needed)
- [ ] Click Export (checkbox unchecked)
- [ ] Verify export succeeds without encryption

#### Encryption Checkbox - Mandatory Scenario (Password-Auth Profile)
- [ ] Select password-auth profile, click "Export Profile"
- [ ] Verify "Include Passwords in Exports" is ON (Settings → Profile Management)
- [ ] Verify encryption modal appears
- [ ] Verify checkbox "Encrypt this export" is CHECKED and DISABLED
- [ ] Verify intro text: "Encryption is mandatory when exporting password-authenticated profiles"
- [ ] Verify help text: "Encryption is required and cannot be disabled"
- [ ] Verify password fields are ENABLED (not greyed out)
- [ ] Verify Export button is DISABLED (needs password)
- [ ] Try to UNCLICK the checkbox
- [ ] Verify checkbox remains CHECKED (disabled, cannot uncheck)
- [ ] Enter password ≥12 characters in both fields (matching)
- [ ] Verify Export button becomes ENABLED
- [ ] Click Export
- [ ] Verify file saves successfully
- [ ] Open exported file - verify encrypted JSON (has "encrypted": true)

#### Encryption Checkbox - Global "Require Encryption" Setting ON
- [ ] Open Settings → Profile Management
- [ ] CHECK "Require Encryption for All Exports"
- [ ] Save settings
- [ ] Select ANY profile (key-auth or password-auth), click "Export Profile"
- [ ] Verify encryption modal appears
- [ ] Verify checkbox "Encrypt this export" is CHECKED and DISABLED
- [ ] Verify intro text: "Encryption is required by your security settings"
- [ ] Verify help text: "Encryption is required and cannot be disabled"
- [ ] Verify password fields are ENABLED
- [ ] Verify Export button is DISABLED (needs password)
- [ ] Try to UNCLICK the checkbox
- [ ] Verify checkbox remains CHECKED (cannot uncheck due to global setting)
- [ ] Enter password ≥12 characters in both fields (matching)
- [ ] Click Export
- [ ] Verify file saves successfully
- [ ] Open exported file - verify encrypted JSON
- [ ] Turn OFF "Require Encryption for All Exports" when done testing

#### Encryption Checkbox - Group Export with Mixed Profiles
- [ ] Create/select group containing BOTH key-auth AND password-auth profiles
- [ ] Verify "Include Passwords in Exports" is ON
- [ ] Verify "Require Encryption for All Exports" is OFF
- [ ] Click "Export Group"
- [ ] Verify encryption modal appears
- [ ] Verify checkbox is CHECKED and DISABLED (mandatory due to password-auth profiles)
- [ ] Verify intro text: "Encryption is mandatory when exporting password-authenticated profiles"
- [ ] Enter password and export
- [ ] Verify encrypted export successful

#### Encryption Checkbox - Export All Profiles
- [ ] Have mix of key-auth and password-auth profiles
- [ ] Verify "Include Passwords in Exports" is ON
- [ ] Verify "Require Encryption for All Exports" is OFF
- [ ] Open Settings → Backup & Restore
- [ ] Click "Export All Profiles"
- [ ] Verify encryption modal appears
- [ ] Verify checkbox is CHECKED and DISABLED (mandatory due to password-auth profiles)
- [ ] Enter password and export
- [ ] Verify encrypted export successful

#### Encryption Checkbox - Backup Settings with Profiles
- [ ] Open Settings → Backup & Restore
- [ ] CHECK "Include Profiles in Settings Backup"
- [ ] Have at least one password-auth profile in database
- [ ] Verify "Include Passwords in Exports" is ON
- [ ] Click "Backup Settings"
- [ ] Verify encryption modal appears
- [ ] Verify checkbox is CHECKED and DISABLED (mandatory)
- [ ] Enter password and export
- [ ] Verify backup successful

#### Encryption Checkbox - Cancel vs Uncheck
- [ ] Export any profile (modal appears)
- [ ] If mandatory: checkbox is checked+disabled
- [ ] If optional: checkbox is unchecked+enabled
- [ ] Click Cancel button
- [ ] Verify export is ABORTED (no file saved)
- [ ] Export same profile again
- [ ] If optional: UNCHECK checkbox and click Export
- [ ] Verify export SUCCEEDS (plain JSON file saved)
- [ ] This confirms: Cancel = abort, Uncheck+Export = export without encryption

#### Encryption Checkbox - Keyboard Navigation
- [ ] Export any profile (modal appears)
- [ ] Verify checkbox is first tabbable element
- [ ] Press Tab
- [ ] Verify focus moves to password input (if enabled) or next element (if disabled)
- [ ] Press Shift+Tab from password input
- [ ] Verify focus moves back to checkbox
- [ ] Press ESC
- [ ] Verify modal closes and export is ABORTED

#### Encryption Checkbox - Settings Persistence
- [ ] Open Settings → Profile Management
- [ ] CHECK "Require Encryption for All Exports"
- [ ] Save settings
- [ ] Close and reopen app
- [ ] Open Settings → Profile Management
- [ ] Verify "Require Encryption for All Exports" is still CHECKED
- [ ] Export any profile
- [ ] Verify encryption is mandatory (checkbox checked+disabled)
- [ ] UNCHECK "Require Encryption for All Exports"
- [ ] Save settings
- [ ] Close and reopen app
- [ ] Verify setting persisted as UNCHECKED
- [ ] Export key-auth profile
- [ ] Verify encryption is optional (checkbox unchecked+enabled)

#### Import Single Profile
- [x] Click "Import Profile" button (or menu)
- [x] Verify native file open dialog appears
- [x] Select previously exported profile file
- [x] If encrypted: verify password prompt appears
- [x] Enter correct decryption password
- [x] Verify duplicate detection modal appears (if duplicate exists)
- [x] Test "Skip" option (should not import)
- [x] Import again, test "Keep Both" option (should add suffix like "(imported)")
- [x] Import again, test "Overwrite" option (should replace existing)
- [x] Verify profile appears in correct group
- [x] Verify metadata imported (icon, favourite status)
- [x] Verify tags imported (auto-created if missing)
- [x] Test import with wrong decryption password (should show error)

#### Import Group
- [ ] Click "Import Group" button (or hold ⌘/Ctrl and click "+ New Group")
- [ ] Select previously exported group file (unencrypted)
- [ ] If no duplicate: verify group imported to correct parent location
- [ ] Verify group structure recreated (including subgroups)
- [ ] Verify all profiles imported with correct paths
- [ ] Verify tags auto-created if they don't exist
- [ ] Import same group again (duplicate detection)
- [ ] Verify duplicate group dialog appears with Skip/Keep Both/Merge options
- [ ] Test "Skip" option (should cancel import, no changes)
- [ ] Import again, test "Keep Both" option (should rename to "GroupName (imported)")
- [ ] Verify renamed group appears under original parent
- [ ] Import again, test "Merge" option (should merge profiles into existing group)
- [ ] Verify no duplicate profiles created
- [ ] Import encrypted group file
- [ ] Enter correct decryption password
- [ ] Verify group imported to **correct parent location** (not forced to top-level)
- [ ] Import same encrypted group again (duplicate detection with encryption)
- [ ] Enter decryption password
- [ ] Verify duplicate detection dialog appears (Skip/Keep Both/Merge)
- [ ] Test "Keep Both" option
- [ ] Verify renamed group imported under **original parent** (not top-level)
- [ ] Test import encrypted group with wrong password (should show error)
- [ ] Verify can retry with correct password
- [ ] Create nested group "Parent/Child/Grandchild" with profiles at each level
- [ ] Export parent group (includes all subgroups)
- [ ] Delete parent group and all descendants
- [ ] Import the export
- [ ] Verify full 3-level hierarchy recreated correctly
- [ ] Verify all profiles imported at correct hierarchy levels

#### Import All Profiles (Restore)
- [x] Open Settings → Backup & Restore
- [x] Click "Import All Profiles"
- [x] Select backup file
- [x] If encrypted: enter decryption password
- [x] Verify warning message about overwriting data
- [x] Verify conflict resolution options (Cancel/Overwrite)
- [x] Import all
- [x] Verify all profiles, groups, and tags restored
- [x] Verify existing data replaced

#### Export/Import Settings
- [x] Open Settings → Backup & Restore
- [x] Click "Export Settings"
- [x] Save settings file
- [x] Open file in text editor - verify JSON structure
- [x] Change some settings in app
- [x] Click "Import Settings"
- [x] Select settings file
- [x] Verify settings restored to previous values
- [x] Verify OS-specific settings ignored (if imported from different OS)

### 5. Connection Management

#### SSH Connection (Terminal Spawning)
- [x] Click "Connect" button on profile card
- [x] Verify "Minimize on Connect" checkbox present
- [x] Connect to profile
- [x] Verify native terminal application opens
- [x] Verify SSH command executed (ssh username@host -p port)
- [x] Verify SSH key path passed (if key auth)
- [x] For password auth: verify terminal prompts for password (not auto-filled - expected behavior)
- [x] Verify connection recorded in recent connections
- [x] Connect again with "Minimize on Connect" enabled
- [x] Verify main window minimizes after connection

#### Recent Connections
- [x] Verify recent connections panel shows latest connections
- [x] Verify connections show profile name, host, and timestamp
- [x] Verify connections sorted by most recent first
- [x] Click connection entry (should connect again)
- [x] Verify maximum 10 recent connections shown
- [x] Verify oldest connections removed when limit exceeded
- [x] Click "Clear All" button
- [x] Verify confirmation dialog appears
- [x] Confirm clear
- [x] Verify all recent connections removed

### 6. Settings UI

#### General Settings
- [x] Open Settings (button click)
- [x] Open Settings (keyboard shortcut: `S`)
- [x] Verify all settings tabs present
- [x] Navigate through all tabs (click + keyboard arrows)
- [x] Verify tab content changes correctly

#### Terminal Preferences
- [x] Open Terminal Preferences tab
- [x] Verify terminal application dropdown populated (system terminals detected)
- [x] Select different terminal (e.g., iTerm2)
- [x] Verify selection saved
- [x] Enable "Minimize on Connect"
- [x] Disable "Minimize on Connect"
- [x] Verify checkbox state persists

#### SSH Key Browser
- [x] Click "Browse" button for default SSH key path
- [x] Verify native file picker opens
- [x] Select SSH key file
- [x] Verify path populated in text field
- [x] Verify tilde (~) expansion works (~/. ssh/id_rsa)

#### Keyboard Shortcuts
- [x] Open Keyboard Shortcuts tab
- [x] Verify all 30+ shortcuts listed
- [x] Verify platform-specific modifiers shown (Cmd on macOS)
- [x] Verify toggle to enable/disable shortcuts
- [x] Disable shortcuts
- [x] Test that shortcuts no longer work
- [x] Enable shortcuts again
- [x] Test that shortcuts work again
- [x] Open keyboard shortcuts help modal (? key)
- [x] Verify all shortcuts documented with descriptions

#### Reset Settings
- [x] Open Settings
- [x] Modify several settings
- [x] Click "Reset to Defaults" button
- [x] Verify confirmation dialog appears
- [x] Cancel reset
- [x] Verify settings unchanged
- [x] Click "Reset to Defaults" again
- [x] Confirm reset
- [x] Verify all settings restored to defaults

### 7. Keyboard Navigation & Shortcuts

#### Global Shortcuts
- [x] Press `N` (New Profile modal opens)
- [x] Press `G` (New Group modal opens)
- [x] Press `T` (Tag Manager opens)
- [x] Press `S` (Settings opens)
- [x] Press `?` (Keyboard shortcuts help modal opens)
- [x] Press `Cmd+S` (Search activates)
- [x] Press `Cmd+F` (Filter dropdown opens)
- [x] Press `Cmd+Left` (Collapse all groups)
- [x] Press `Cmd+Right` (Expand all groups)
- [x] Press `ESC` in any modal (modal closes)

#### Modal Navigation
- [x] Open any modal
- [x] Press `Tab` (focus moves to next element)
- [x] Press `Shift+Tab` (focus moves to previous element)
- [x] Verify focus cycles through all tabbable elements
- [x] Verify focus trapped in modal (doesn't escape to background)
- [x] Verify first element focused when modal opens
- [x] Press `Cmd+S` in profile modal (saves profile)
- [x] Press `ESC` in modal (closes without saving)

#### List Navigation
- [x] Click profile list
- [x] Press `↑` arrow (selects previous profile)
- [x] Press `↓` arrow (selects next profile)
- [x] Press `Enter` on selected profile (opens edit modal)
- [x] Press `Delete` on selected profile (opens delete confirmation)
- [x] Click group list
- [x] Press `→` arrow (expands group)
- [x] Press `←` arrow (collapses group)

#### Keyboard Shortcuts Settings
- [x] Verify shortcuts can be toggled off globally
- [x] When disabled, verify letter keys don't trigger modals
- [x] When disabled, verify Cmd+S doesn't work (search)
- [x] When disabled, verify ESC doesn't work (close modals)

### 8. Visual & Layout Testing

#### Responsive Layout
- [x] Resize window to minimum width (verify no horizontal scroll)
- [x] Resize window to minimum height (verify scrolling works)
- [x] Resize window to maximum (verify elements scale appropriately)
- [x] Verify profile cards adjust to window width
- [x] Verify sidebar width appropriate
- [x] Verify modals centered on screen

#### Tooltips
- [x] Hover over profile card icons (verify tooltips appear)
- [x] Hover over buttons (verify tooltips appear)
- [x] Hover over settings labels (verify help text appears)
- [x] Verify tooltip positioning (doesn't overflow screen)
- [x] Verify tooltip delays appropriate (~300ms)

#### Loading States
- [x] Verify loading spinner shown during encryption/decryption
- [x] Verify loading spinner centered correctly (no transform issues)
- [x] Verify loading message clear ("Encrypting...", "Decrypting...")
- [x] Verify loading state doesn't allow interaction (buttons disabled)

#### Error States
- [x] Trigger validation error (empty required field)
- [x] Verify error message shown in red
- [x] Verify error message describes problem clearly
- [x] Verify error message positioned near problem field
- [x] Trigger connection error (invalid host)
- [x] Verify error notification appears
- [x] Verify error notification auto-dismisses after 5 seconds

#### Animations & Transitions
- [x] Verify modal open/close animations smooth
- [x] Verify group expand/collapse animations smooth
- [x] Verify profile card hover transitions smooth
- [x] Verify tag badge colors transition smoothly
- [x] Verify no janky animations or layout shifts

#### Empty States
- [x] Delete all profiles (verify "no profiles" empty state shown)
- [x] Delete all groups (verify "no groups" empty state shown)
- [x] Delete all tags (verify "no tags" empty state in Tag Manager)
- [x] Clear search with no matches (verify "no results" message)
- [x] Clear recent connections (verify "no recent connections" message)

### 9. Version & Update Info

#### Splash Screen
- [x] Launch app for first time (after version change)
- [x] Verify splash screen appears with version number
- [x] Verify changelog/release notes shown
- [x] Verify "What's New" highlights listed
- [x] Click "Get Started" button
- [x] Verify splash screen dismissed
- [x] Relaunch app (splash should not appear again for same version)

#### About/Version Info
- [x] Open Settings
- [x] Verify version number displayed (e.g., "v0.7.0")
- [x] Verify "Check for Updates" button present (if applicable)
- [x] Verify GitHub link present and clickable

---

## Windows Testing

**Note:** Windows testing focuses on platform-specific behaviors and critical GUI tests. Full GUI coverage is done on macOS.

### 1. Platform-Specific Terminal Integration

#### Windows Terminal
- [ ] Set terminal preference to "Windows Terminal"
- [ ] Connect to profile
- [ ] Verify Windows Terminal opens (not CMD/PowerShell)
- [ ] Verify SSH command executed correctly
- [ ] Verify connection successful

#### Command Prompt (CMD)
- [ ] Set terminal preference to "Command Prompt"
- [ ] Connect to profile
- [ ] Verify CMD opens
- [ ] Verify SSH command executed
- [ ] Verify connection successful

#### PowerShell
- [ ] Set terminal preference to "PowerShell"
- [ ] Connect to profile
- [ ] Verify PowerShell opens
- [ ] Verify SSH command executed
- [ ] Verify connection successful

### 2. Keyboard Shortcuts (Windows-Specific)

#### Modifier Keys
- [ ] Verify shortcuts use `Ctrl` instead of `Cmd`
- [ ] Press `Ctrl+S` (Search activates)
- [ ] Press `Ctrl+F` (Filter opens)
- [ ] Press `Ctrl+Left` (Collapse all groups)
- [ ] Press `Ctrl+Right` (Expand all groups)
- [ ] Verify keyboard shortcuts help modal shows `Ctrl` (not `Cmd`)

### 3. File System Integration

#### File Pickers
- [ ] Test SSH key file browser (Windows native dialog)
- [ ] Verify Windows paths work (C:\Users\...\. ssh\id_rsa)
- [ ] Test export file save dialog (Windows native dialog)
- [ ] Test import file open dialog (Windows native dialog)
- [ ] Verify file extensions filter correctly (.json)

#### Path Handling
- [ ] Create profile with Windows-style SSH key path (C:\Users\...)
- [ ] Verify path stored correctly
- [ ] Verify path displayed correctly in UI
- [ ] Test tilde expansion works (if applicable)

### 4. Critical GUI Tests (Smoke Test)

**Run a subset of critical macOS tests to ensure cross-platform compatibility:**

- [ ] Create profile (key auth)
- [ ] Create profile (password auth)
- [ ] Edit profile
- [ ] Delete profile
- [ ] Create group
- [ ] Rename group
- [ ] Delete group
- [ ] Create tag
- [ ] Assign tag to profile
- [ ] Delete tag
- [ ] Toggle favourite
- [ ] Change profile icon
- [ ] Search profiles
- [ ] Filter by group
- [ ] Export profile (encrypted)
- [ ] Import profile (encrypted)
- [ ] Export all profiles
- [ ] Import all profiles
- [ ] Connect to profile
- [ ] Verify recent connections
- [ ] Open Settings
- [ ] Change terminal preference
- [ ] Test keyboard shortcuts (N, G, T, S, ?)
- [ ] Modal navigation (Tab, ESC, Ctrl+S)

### 5. Visual Validation

- [ ] Verify fonts render correctly (no missing glyphs)
- [ ] Verify colors consistent with macOS
- [ ] Verify icons render correctly (SVG support)
- [ ] Verify layout matches macOS (no Windows-specific issues)
- [ ] Verify window chrome appropriate (Windows title bar)

---

## Test Results

**Version:** v0.7.0
**Date:** 14/02/2026
**Platform:** macOS 26.3 / Windows [version]

### Summary
- **Total Tests:** [X] (includes 100+ new encryption checkbox tests added 2026-02-14)
- **Passed:** [X]
- **Failed:** [X]
- **Blocked:** [X]

### Performance Notes
None

### Additional Observations
None

---

## Issues Found During macOS Testing (2026-02-14)

### 🔴 CRITICAL (Blocking Release)

**C-1: Group Deletion Locks Up Application** ✅ FIXED
- **Location:** Lines 180-191
- **Issue:** Both "Delete All" and "Move All" modes cause spinning wheel and application freeze
- **Details:**
  - Selecting either deletion mode locks up the app
  - ESC key doesn't work to cancel delete modal
  - Users cannot delete groups at all
- **Impact:** Showstopper - core functionality completely broken
- **Status:** ✅ Fixed 2026-02-14

**C-2: Group Move Functionality Missing** ✅ FIXED
- **Location:** Lines 164-175
- **Issue:** Entire "Move Group" functionality appears to be missing
- **Details:**
  - No "Move" option in group action menu
  - Cannot move groups between parents at all
  - All move-related tests blocked
- **Impact:** Major feature completely absent
- **Status:** ✅ Fixed 2026-02-14

**C-3: Profile Duplication Doesn't Copy Tags or Group Path** ✅ FIXED
- **Location:** Additional Observations, lines 9128-9147
- **Issue:** When duplicating a profile, tags and group path were not copied correctly
- **Details:**
  - **Tag Issue:** Throws error "ReferenceError: Can't find variable: tags"
    - Root cause: Typo - code referenced `tags` instead of `allTags` (line 9143)
  - **Group Path Issue:** Duplicated profiles always saved to "Ungrouped"
    - Root cause: Code set `profile-group` dropdown but not `profile-group-id` hidden field
    - `saveProfile()` uses `profile-group-id` to determine group (line 9022)
- **Impact:** Data loss (tags + group membership) + error state
- **Status:** ✅ Fixed 2026-02-14
  - Tag fix: Typo corrected `tags` → `allTags`
  - Group fix: Added logic to set both `profile-group` and `profile-group-id` fields

---

### 🟡 HIGH (Should Fix Before Release)

**H-1: Export/Import Encryption UX Mismatch** ✅ FIXED
- **Location:** Lines 245, 254, 266, 281, 306
- **Issue:** Current design doesn't match expected encryption workflow
- **Details:**
  - Expected: User chooses encryption per export (with mandatory enforcement for password-auth)
  - Actual: Global setting controls encryption implicitly
  - Multiple test cases flagged as "not the design"
  - Question: Should non-password profiles offer encryption option?
- **Impact:** User confusion, potential security gaps
- **Status:** ✅ Fixed 2026-02-14 (encryption checkbox feature implemented)

**H-2: Decryption Spinner Persists After Cancel** ✅ FIXED
- **Location:** Line 444
- **Issue:** After cancelling decryption with wrong password, "Decrypting import..." toast still shows
- **Details:**
  - Spinner/toast doesn't dismiss when user cancels
  - Previously reported in Phase 6, thought to be fixed
- **Impact:** Poor UX, confusing state
- **Status:** ✅ Fixed 2026-02-14 (toast now hidden on cancel in both import and settings restore)

**H-3: Search Clear (ESC) Not Working** ✅ FIXED
- **Location:** Line 114
- **Issue:** ESC key doesn't clear search
- **Details:**
  - Test expects ESC to clear search
  - Feature was never configured
  - X button works, ESC doesn't
- **Impact:** Inconsistent keyboard navigation
- **Status:** ✅ Fixed 2026-02-14 (ESC key now clears search and blurs input)

---

### 🟢 MEDIUM (Nice to Fix)

**M-1: Import All Has No Conflict Resolution** ✅ NOT AN ISSUE
- **Location:** Lines 316, 319
- **Issue:** Import All doesn't follow expected duplicate handling workflow
- **Details:**
  - Warning appears AFTER file selection/decryption (not before)
  - No conflict resolution options (Skip/Rename/Overwrite)
  - Appears to be full overwrite/restore only
  - User notes: "more about restoring all profiles, no duplicate or merging"
- **Impact:** Limited flexibility, potential data loss if user misunderstands
- **Status:** ✅ Working as intended - this is a RESTORE function, not a merge function

**M-2: Tag Sorting Case-Sensitive** ✅ FIXED
- **Location:** Line 212
- **Issue:** Tags sorted alphabetically but capitals come first
- **Details:**
  - 'Test' appears before 'abc'
  - Should be case-insensitive alphabetical sort
- **Impact:** Minor UX inconsistency
- **Status:** ✅ Fixed 2026-02-14 (added COLLATE NOCASE to 3 SQL queries)

**M-3: Settings Tab Cycle Incomplete** ✅ FIXED
- **Location:** Line 462
- **Issue:** Tab cycling doesn't include the 3 buttons at bottom properly
- **Details:**
  - Keyboard navigation through settings modal incomplete
  - Save/Close buttons (header) came after GitHub buttons (bottom) in tab order
  - Expected: top-to-bottom visual order
- **Impact:** Accessibility issue
- **Status:** ✅ Fixed 2026-02-14 (reordered tab items: Save/Close → Settings → GitHub buttons)

**M-4: Keyboard Shortcuts Partially Disabled** ✅ FIXED & VERIFIED
- **Location:** Lines 781-806 + 735-741
- **Issue:** When shortcuts globally disabled, Cmd key still toggles +new buttons
- **Details:**
  - Modifier key tracking didn't check keyboardShortcutsEnabled
  - Buttons could get stuck in "Import" state when shortcuts toggled off
- **Impact:** Inconsistent behavior, unexpected for users who disable shortcuts
- **Status:** ✅ Fixed 2026-02-14 (2-part fix)
  - Part 1: Added keyboardShortcutsEnabled check to modifier event listeners
  - Part 2: Reset button state when shortcuts toggled off (prevents stuck "Import" state)
- **Verified:** User tested - working correctly ✅

**M-5: Group Rename UI Terminology** ✅ FIXED
- **Location:** Line 154
- **Issue:** Minor UI terminology inconsistency
- **Details:**
  - Test expects "Rename" option
  - Actual UI shows "Edit Group" option
  - Functionality works, just different label
- **Impact:** Very minor, test needs updating
- **Status:** ✅ Fixed 2026-02-14 (test plan updated to match actual UI)

**M-6: Terminal Connection Flow Changed** ✅ FIXED
- **Location:** Line 480
- **Issue:** Test expects terminal preference modal during connect, but design changed
- **Details:**
  - Test expects: Terminal modal appears on connect
  - Actual: Profile itself has terminal option configured
  - Design changed but test not updated
- **Impact:** Test needs updating, not a bug
- **Status:** ✅ Fixed 2026-02-14 (test plan updated to match actual design)

**M-7: Recent Connections Timestamp Static** ✅ FIXED
- **Location:** Line 493
- **Issue:** Timestamp doesn't refresh automatically
- **Details:**
  - Timestamps show correctly but don't update (e.g., "5 minutes ago" → "6 minutes ago")
  - Static timestamps look stale during long-running sessions
- **Impact:** Minor UX, potentially confusing for long-running sessions
- **Implementation:**
  - ✅ **Dynamic refresh interval** based on recency:
    - Any connection < 1 minute: **5-second** refresh (rapid updates)
    - All connections ≥ 1 minute: **60-second** refresh (efficient)
  - ✅ Only refresh when Recent Connections panel is expanded/visible
  - ✅ Trigger immediate refresh when panel is toggled open
  - ✅ Pause refresh when any modal is open
  - ✅ Update only timestamp text (not entire UI re-render)
  - ✅ Stop interval when panel is collapsed
  - ✅ Auto-adjusts interval when connections age past 1-minute threshold
- **Status:** ✅ Fixed 2026-02-14 (auto-refresh with dynamic interval + modal-aware pause/resume)

---

### 🔵 LOW (Clarifications/Polish)

**L-1: Profile Card Hover Test Unclear** ✅ CLARIFIED
- **Location:** Line 68
- **Issue:** User needs clarification what "hover state" test is checking for
- **Impact:** Test clarification needed
- **Clarification:**
  - **Regular cards:** Background lightens, border turns blue, shadow appears
  - **Favourite cards:** Border turns gold (#f59e0b)
  - Visual feedback that card is interactive/clickable
- **Status:** ✅ Clarified 2026-02-14

**L-2: Icon Picker Tab Navigation** ✅ FIXED
- **Location:** Line 90
- **Issue:** Tab through icons not possible
- **Details:**
  - User notes: "was not intended, test can be removed"
  - Updated test to reflect actual behavior (arrow key navigation)
- **Impact:** None - test documentation updated
- **Status:** ✅ Fixed 2026-02-14 (test updated to match actual behavior)

**L-3: Create Tag Button Should Disable** ✅ FIXED
- **Location:** Lines 204, 206
- **Issue:** Button should be disabled when input invalid
- **Details:**
  - Now disables "Create Tag" button when tag name is empty or has invalid characters
  - Real-time validation on every keystroke
  - Matches UX pattern of other buttons (e.g., Export, Decrypt)
- **Implementation:**
  - `validateTagNameInput()` function checks name is non-empty and matches `/^[a-zA-Z0-9\-_]+$/`
  - Called on every `input` event via `updateTagNameCounter()`
  - Button disabled by default when modal opens
  - Re-disabled after successful tag creation
- **Impact:** Better UX - prevents invalid submission attempts
- **Status:** ✅ Fixed 2026-02-14 (button disable validation implemented)

**L-4: Group Deletion Option Names** ✅ FIXED
- **Location:** Line 179
- **Issue:** Minor terminology difference
- **Details:**
  - Test expects: "Move Profiles to Parent" and "Cascade Delete"
  - Actual UI shows: "Move All" and "Delete All"
  - Functionality works, just different labels
- **Impact:** Very minor, test needs updating
- **Status:** ✅ Fixed 2026-02-14 (user updated test documentation)

---

## Post-Testing Checklist

- [x] All critical tests passed on macOS
- [ ] All critical tests passed on Windows
- [ ] No console errors observed
- [x] No visual glitches or layout issues
- [x] Export/Import workflows validated
- [x] Keyboard navigation fully functional
- [ ] Terminal integration working on both platforms
- [ ] Test results documented
- [ ] Failed tests logged as issues (if any)

**Sign-off:** Manual GUI Testing Complete ✅

---

## Notes on Performance Testing

Performance testing has been intentionally excluded from this checklist to keep testing focused on functional correctness. Performance issues will be addressed as they arise through user feedback and bug reports. If you observe any significant performance problems during functional testing (e.g., UI freezing, slow search, laggy animations), note them in the "Performance Notes" section of the test results template.
