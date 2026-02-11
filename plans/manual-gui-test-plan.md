# Manual GUI Test Plan

**Purpose:** Comprehensive manual testing of frontend/GUI functionality for SSH Profile Manager.
**Scope:** All user-facing features (excludes backend logic covered by automated tests).
**Frequency:** Run before every major release (v0.7.0, v0.8.0, v1.0.0, etc.).

---

## Pre-Testing Setup

### Test Data Creation
- [ ] Create 5+ groups (including nested groups: Parent/Child/GrandChild)
- [ ] Create 20+ profiles across different groups
- [ ] Create 5+ tags with different colors
- [ ] Assign tags to various profiles
- [ ] Mark 3+ profiles as favourites
- [ ] Assign different icons to 5+ profiles
- [ ] Connect to 3+ profiles to populate recent connections
- [ ] Have at least 2 profiles with password authentication
- [ ] Have at least 5 profiles with SSH key authentication

---

## macOS Testing

### 1. Profile Management

#### Profile Creation
- [ ] Open "New Profile" modal (button click)
- [ ] Open "New Profile" modal (keyboard shortcut: `N`)
- [ ] Verify all form fields present (name, description, host, port, username, auth method, key path, group)
- [ ] Create profile with SSH key authentication
- [ ] Create profile with password authentication
- [ ] Verify validation: empty name shows error
- [ ] Verify validation: invalid host shows error
- [ ] Verify validation: invalid port shows error
- [ ] Verify validation: invalid username shows error
- [ ] Test SSH key file browser (opens native file picker)
- [ ] Test group dropdown (shows all groups)
- [ ] Cancel profile creation (ESC key)
- [ ] Cancel profile creation (Cancel button)
- [ ] Verify modal closes and no profile created
- [ ] Create profile and verify it appears in correct group

#### Profile Editing
- [ ] Open profile edit modal (click profile card edit button)
- [ ] Verify all fields populated with existing data
- [ ] Edit profile name and save
- [ ] Edit profile host and save
- [ ] Edit profile port and save
- [ ] Edit profile username and save
- [ ] Change auth method from key to password
- [ ] Change auth method from password to key
- [ ] Change profile group (move to different group)
- [ ] Edit description field
- [ ] Cancel edit (ESC key) - verify no changes saved
- [ ] Cancel edit (Cancel button) - verify no changes saved
- [ ] Save with Cmd+S keyboard shortcut

#### Profile Display
- [ ] Verify profile cards show correct icon
- [ ] Verify profile cards show correct name
- [ ] Verify profile cards show correct host
- [ ] Verify profile cards show correct username
- [ ] Verify profile cards show correct tags (colored badges)
- [ ] Verify favourite star is filled gold for favourites
- [ ] Verify favourite star is outlined grey for non-favourites
- [ ] Hover over profile card (should show hover state)
- [ ] Verify multi-line profiles are vertically centered correctly

#### Profile Favourites
- [ ] Click star icon to add profile to favourites
- [ ] Verify "Favourites" virtual group appears at top
- [ ] Verify profile appears in Favourites group
- [ ] Verify profile still visible in original group
- [ ] Click "Go to Profile" button in Favourites (navigates to real location)
- [ ] Click star icon to remove from favourites
- [ ] Verify profile removed from Favourites group
- [ ] Verify Favourites group auto-hides when empty

#### Profile Icons
- [ ] Open icon picker modal (click icon on profile card)
- [ ] Verify 40+ icons displayed in grid
- [ ] Verify search box present
- [ ] Search for "server" (should filter icons)
- [ ] Search for "database" (should filter icons)
- [ ] Clear search (should show all icons again)
- [ ] Select new icon
- [ ] Verify icon updates on profile card immediately
- [ ] Keyboard navigation: Tab through icons
- [ ] Keyboard navigation: Enter to select icon
- [ ] Close modal with ESC key
- [ ] Verify 'star', 'star-off', 'settings' NOT in picker (reserved icons)

#### Profile Deletion
- [ ] Click delete button on profile card
- [ ] Verify confirmation dialog appears
- [ ] Verify dialog shows profile name highlighted
- [ ] Cancel deletion (Cancel button)
- [ ] Verify profile still exists
- [ ] Click delete button again
- [ ] Confirm deletion (Delete button - danger style)
- [ ] Verify profile removed from UI immediately
- [ ] Verify profile removed from Favourites if it was favourite

#### Profile Search & Filter
- [ ] Open search (Cmd+S keyboard shortcut)
- [ ] Search by profile name
- [ ] Verify matching profiles highlighted/shown
- [ ] Search by host
- [ ] Search by username
- [ ] Search with no matches (shows "no results" message)
- [ ] Clear search (X button)
- [ ] Clear search (ESC key)
- [ ] Search with `tag:production` syntax
- [ ] Search with multiple tags `tag:prod tag:dev` (OR logic)
- [ ] Open filter dropdown (Cmd+F)
- [ ] Filter by group
- [ ] Verify only profiles in selected group shown
- [ ] Clear filter
- [ ] Verify all profiles shown again

### 2. Group Management

#### Group Creation
- [ ] Open "New Group" modal (button click)
- [ ] Open "New Group" modal (keyboard shortcut: `G`)
- [ ] Create top-level group (no parent)
- [ ] Verify group appears in sidebar
- [ ] Create child group (select parent from dropdown)
- [ ] Verify child appears nested under parent
- [ ] Create grandchild group (3 levels deep)
- [ ] Verify path displays correctly (e.g., "Work/Production/Servers")
- [ ] Try to create 4th level (should be prevented - max 3 levels)
- [ ] Verify validation: empty name shows error
- [ ] Verify validation: invalid characters show error
- [ ] Verify validation: "Ungrouped" name rejected (reserved)
- [ ] Cancel group creation (ESC key)
- [ ] Cancel group creation (Cancel button)
- [ ] Save with Cmd+S keyboard shortcut

#### Group Display
- [ ] Verify groups show in alphabetical order
- [ ] Verify nested groups indented correctly
- [ ] Verify expand/collapse arrows present for parent groups
- [ ] Click expand arrow (should show children)
- [ ] Click collapse arrow (should hide children)
- [ ] Keyboard shortcut: Cmd+Right (expand all groups)
- [ ] Keyboard shortcut: Cmd+Left (collapse all groups)
- [ ] Verify profile count badge on each group
- [ ] Verify "Ungrouped" group shows profiles without group assignment

#### Group Rename
- [ ] Open group rename modal (click group, select "Rename")
- [ ] Edit group name
- [ ] Save changes
- [ ] Verify group name updated in sidebar
- [ ] Verify all child group paths updated (cascade)
- [ ] Verify all profile paths updated (cascade)
- [ ] Verify rename doesn't affect groups with overlapping names (e.g., "Dev" vs "DevOps")
- [ ] Cancel rename (ESC key)
- [ ] Verify no changes applied

#### Group Move
- [ ] Open group move modal (click group, select "Move")
- [ ] Move group to different parent
- [ ] Verify group appears under new parent
- [ ] Verify group path updated
- [ ] Verify all child group paths updated (cascade)
- [ ] Verify all profile paths updated (cascade)
- [ ] Try to move group into its own child (should be prevented - circular reference)
- [ ] Try to move group into its own grandchild (should be prevented)
- [ ] Move group to top level (select "None" as parent)
- [ ] Verify group appears at root level
- [ ] Cancel move (ESC key)

#### Group Deletion
- [ ] Open group delete modal (click group, select "Delete")
- [ ] Verify two options shown: "Cascade Delete" and "Move Profiles"
- [ ] Select "Cascade Delete"
- [ ] Verify warning message shown (profiles will be deleted)
- [ ] Verify confirmation dialog shows group name highlighted
- [ ] Cancel deletion
- [ ] Open delete modal again
- [ ] Select "Move Profiles to Parent"
- [ ] Confirm deletion
- [ ] Verify group deleted
- [ ] Verify profiles moved to parent group
- [ ] Verify child groups also deleted (CASCADE)
- [ ] Delete group with "Cascade Delete" option
- [ ] Verify group AND all profiles deleted

### 3. Tag Management

#### Tag Creation
- [ ] Open Tag Manager (button click)
- [ ] Open Tag Manager (keyboard shortcut: `T`)
- [ ] Click "Create Tag" button
- [ ] Enter tag name
- [ ] Select color from color picker
- [ ] Verify color preview updates
- [ ] Create tag
- [ ] Verify tag appears in tag list
- [ ] Verify validation: empty name shows error
- [ ] Verify validation: duplicate name shows error
- [ ] Verify validation: invalid characters rejected (spaces not allowed)
- [ ] Verify validation: max 32 characters enforced
- [ ] Cancel tag creation (ESC key)
- [ ] Cancel tag creation (Cancel button)

#### Tag Display
- [ ] Verify tags show in alphabetical order
- [ ] Verify tag color displayed correctly
- [ ] Verify tag usage count shown (number of profiles)
- [ ] Verify tags with 0 usage show "0"

#### Tag Assignment
- [ ] Open profile edit modal
- [ ] Open tag assignment dropdown
- [ ] Select multiple tags (checkbox selection)
- [ ] Save profile
- [ ] Verify tags appear on profile card as colored badges
- [ ] Verify tag text color is readable (black on light, white on dark backgrounds)
- [ ] Remove tag from profile
- [ ] Verify tag removed from profile card
- [ ] Verify tag usage count decremented in Tag Manager

#### Tag Deletion
- [ ] Open Tag Manager
- [ ] Click delete button on tag
- [ ] Verify confirmation dialog appears
- [ ] Verify dialog shows tag name and usage count
- [ ] Cancel deletion
- [ ] Verify tag still exists
- [ ] Delete tag with 0 usage
- [ ] Verify tag removed immediately
- [ ] Delete tag with active usage
- [ ] Verify tag removed from all profiles
- [ ] Verify profile cards update (tag badges removed)

### 4. Export/Import Workflows

#### Export Single Profile (No Password Auth)
- [ ] Right-click profile card (or menu button)
- [ ] Select "Export Profile"
- [ ] Verify modal shows two options: "Include Password" (unchecked) and "Encrypt Export" (optional)
- [ ] Export without encryption
- [ ] Verify native file save dialog appears
- [ ] Save file
- [ ] Verify JSON file created
- [ ] Open file in text editor - verify plain JSON (not encrypted)

#### Export Single Profile (Password Auth - Encryption Required)
- [ ] Export profile with password authentication
- [ ] Verify "Encrypt Export" checkbox is CHECKED and DISABLED (mandatory)
- [ ] Verify password strength meter appears
- [ ] Enter password <12 characters (should show error)
- [ ] Enter password exactly 12 characters (should accept)
- [ ] Verify strength meter shows level (Weak/Fair/Good/Strong/Stronger)
- [ ] Export profile
- [ ] Verify native file save dialog appears
- [ ] Save file
- [ ] Open file in text editor - verify encrypted JSON (has "encrypted":true field)

#### Export Group
- [ ] Right-click group in sidebar
- [ ] Select "Export Group"
- [ ] Verify modal shows options: "Include Passwords" and "Encrypt Export"
- [ ] Verify "Recursive" option (includes subgroups)
- [ ] Export group without encryption
- [ ] Verify all profiles in group included
- [ ] Verify subgroups and their profiles included (if recursive)
- [ ] Export group with password-auth profiles
- [ ] Verify encryption is mandatory
- [ ] Enter encryption password
- [ ] Verify password strength meter works
- [ ] Export and save file

#### Export All Profiles (Backup)
- [ ] Open Settings
- [ ] Navigate to "Backup & Restore" section
- [ ] Click "Export All Profiles"
- [ ] Verify modal shows encryption options
- [ ] Export without encryption (if no password-auth profiles)
- [ ] Verify native file save dialog appears
- [ ] Save file
- [ ] Verify all profiles, groups, and tags exported

#### Import Single Profile
- [ ] Click "Import Profile" button (or menu)
- [ ] Verify native file open dialog appears
- [ ] Select previously exported profile file
- [ ] If encrypted: verify password prompt appears
- [ ] Enter correct decryption password
- [ ] Verify duplicate detection modal appears (if duplicate exists)
- [ ] Test "Skip" option (should not import)
- [ ] Import again, test "Rename" option (should add suffix like "(imported)")
- [ ] Import again, test "Overwrite" option (should replace existing)
- [ ] Verify profile appears in correct group
- [ ] Verify metadata imported (icon, favourite status)
- [ ] Verify tags imported (auto-created if missing)
- [ ] Test import with wrong decryption password (should show error)

#### Import Group
- [ ] Click "Import Group" button
- [ ] Select previously exported group file
- [ ] If encrypted: enter decryption password
- [ ] Select target parent group (or "None" for top-level)
- [ ] Verify duplicate detection for group and profiles
- [ ] Import group
- [ ] Verify group structure recreated (including subgroups)
- [ ] Verify all profiles imported with correct paths
- [ ] Verify tags auto-created if they don't exist

#### Import All Profiles (Restore)
- [ ] Open Settings → Backup & Restore
- [ ] Click "Import All Profiles"
- [ ] Verify warning message about overwriting data
- [ ] Select backup file
- [ ] If encrypted: enter decryption password
- [ ] Verify conflict resolution options (Skip/Rename/Overwrite)
- [ ] Import all
- [ ] Verify all profiles, groups, and tags restored
- [ ] Verify existing data preserved (if Skip mode)
- [ ] Verify existing data replaced (if Overwrite mode)

#### Export/Import Settings
- [ ] Open Settings → Backup & Restore
- [ ] Click "Export Settings"
- [ ] Save settings file
- [ ] Open file in text editor - verify JSON structure
- [ ] Change some settings in app
- [ ] Click "Import Settings"
- [ ] Select settings file
- [ ] Verify settings restored to previous values
- [ ] Verify OS-specific settings ignored (if imported from different OS)

### 5. Connection Management

#### SSH Connection (Terminal Spawning)
- [ ] Click "Connect" button on profile card
- [ ] Verify terminal preference modal appears (if not set)
- [ ] Select terminal application from dropdown
- [ ] Verify "Minimize on Connect" checkbox present
- [ ] Connect to profile
- [ ] Verify native terminal application opens
- [ ] Verify SSH command executed (ssh username@host -p port)
- [ ] Verify SSH key path passed (if key auth)
- [ ] For password auth: verify terminal prompts for password (not auto-filled - expected behavior)
- [ ] Verify connection recorded in recent connections
- [ ] Connect again with "Minimize on Connect" enabled
- [ ] Verify main window minimizes after connection

#### Recent Connections
- [ ] Verify recent connections panel shows latest connections
- [ ] Verify connections show profile name, host, and timestamp
- [ ] Verify connections sorted by most recent first
- [ ] Click connection entry (should connect again)
- [ ] Verify maximum 10 recent connections shown
- [ ] Verify oldest connections removed when limit exceeded
- [ ] Click "Clear All" button
- [ ] Verify confirmation dialog appears
- [ ] Confirm clear
- [ ] Verify all recent connections removed

### 6. Settings UI

#### General Settings
- [ ] Open Settings (button click)
- [ ] Open Settings (keyboard shortcut: `S`)
- [ ] Verify all settings tabs present
- [ ] Navigate through all tabs (click + keyboard arrows)
- [ ] Verify tab content changes correctly

#### Terminal Preferences
- [ ] Open Terminal Preferences tab
- [ ] Verify terminal application dropdown populated (system terminals detected)
- [ ] Select different terminal (e.g., iTerm2)
- [ ] Verify selection saved
- [ ] Enable "Minimize on Connect"
- [ ] Disable "Minimize on Connect"
- [ ] Verify checkbox state persists

#### SSH Key Browser
- [ ] Click "Browse" button for default SSH key path
- [ ] Verify native file picker opens
- [ ] Select SSH key file
- [ ] Verify path populated in text field
- [ ] Verify tilde (~) expansion works (~/. ssh/id_rsa)

#### Keyboard Shortcuts
- [ ] Open Keyboard Shortcuts tab
- [ ] Verify all 30+ shortcuts listed
- [ ] Verify platform-specific modifiers shown (Cmd on macOS)
- [ ] Verify toggle to enable/disable shortcuts
- [ ] Disable shortcuts
- [ ] Test that shortcuts no longer work
- [ ] Enable shortcuts again
- [ ] Test that shortcuts work again
- [ ] Open keyboard shortcuts help modal (? key)
- [ ] Verify all shortcuts documented with descriptions

#### Reset Settings
- [ ] Open Settings
- [ ] Modify several settings
- [ ] Click "Reset to Defaults" button
- [ ] Verify confirmation dialog appears
- [ ] Cancel reset
- [ ] Verify settings unchanged
- [ ] Click "Reset to Defaults" again
- [ ] Confirm reset
- [ ] Verify all settings restored to defaults

### 7. Keyboard Navigation & Shortcuts

#### Global Shortcuts
- [ ] Press `N` (New Profile modal opens)
- [ ] Press `G` (New Group modal opens)
- [ ] Press `T` (Tag Manager opens)
- [ ] Press `S` (Settings opens)
- [ ] Press `?` (Keyboard shortcuts help modal opens)
- [ ] Press `Cmd+S` (Search activates)
- [ ] Press `Cmd+F` (Filter dropdown opens)
- [ ] Press `Cmd+Left` (Collapse all groups)
- [ ] Press `Cmd+Right` (Expand all groups)
- [ ] Press `ESC` in any modal (modal closes)

#### Modal Navigation
- [ ] Open any modal
- [ ] Press `Tab` (focus moves to next element)
- [ ] Press `Shift+Tab` (focus moves to previous element)
- [ ] Verify focus cycles through all tabbable elements
- [ ] Verify focus trapped in modal (doesn't escape to background)
- [ ] Verify first element focused when modal opens
- [ ] Press `Cmd+S` in profile modal (saves profile)
- [ ] Press `ESC` in modal (closes without saving)

#### List Navigation
- [ ] Click profile list
- [ ] Press `↑` arrow (selects previous profile)
- [ ] Press `↓` arrow (selects next profile)
- [ ] Press `Enter` on selected profile (opens edit modal)
- [ ] Press `Delete` on selected profile (opens delete confirmation)
- [ ] Click group list
- [ ] Press `→` arrow (expands group)
- [ ] Press `←` arrow (collapses group)

#### Keyboard Shortcuts Settings
- [ ] Verify shortcuts can be toggled off globally
- [ ] When disabled, verify letter keys don't trigger modals
- [ ] When disabled, verify Cmd+S still works (search)
- [ ] When disabled, verify ESC still works (close modals)

### 8. Visual & Layout Testing

#### Responsive Layout
- [ ] Resize window to minimum width (verify no horizontal scroll)
- [ ] Resize window to minimum height (verify scrolling works)
- [ ] Resize window to maximum (verify elements scale appropriately)
- [ ] Verify profile cards adjust to window width
- [ ] Verify sidebar width appropriate
- [ ] Verify modals centered on screen

#### Tooltips
- [ ] Hover over profile card icons (verify tooltips appear)
- [ ] Hover over buttons (verify tooltips appear)
- [ ] Hover over settings labels (verify help text appears)
- [ ] Verify tooltip positioning (doesn't overflow screen)
- [ ] Verify tooltip delays appropriate (~300ms)

#### Loading States
- [ ] Verify loading spinner shown during encryption/decryption
- [ ] Verify loading spinner centered correctly (no transform issues)
- [ ] Verify loading message clear ("Encrypting...", "Decrypting...")
- [ ] Verify loading state doesn't allow interaction (buttons disabled)

#### Error States
- [ ] Trigger validation error (empty required field)
- [ ] Verify error message shown in red
- [ ] Verify error message describes problem clearly
- [ ] Verify error message positioned near problem field
- [ ] Trigger connection error (invalid host)
- [ ] Verify error notification appears
- [ ] Verify error notification auto-dismisses after 5 seconds

#### Animations & Transitions
- [ ] Verify modal open/close animations smooth
- [ ] Verify group expand/collapse animations smooth
- [ ] Verify profile card hover transitions smooth
- [ ] Verify tag badge colors transition smoothly
- [ ] Verify no janky animations or layout shifts

#### Empty States
- [ ] Delete all profiles (verify "no profiles" empty state shown)
- [ ] Delete all groups (verify "no groups" empty state shown)
- [ ] Delete all tags (verify "no tags" empty state in Tag Manager)
- [ ] Clear search with no matches (verify "no results" message)
- [ ] Clear recent connections (verify "no recent connections" message)

### 9. Version & Update Info

#### Splash Screen
- [ ] Launch app for first time (after version change)
- [ ] Verify splash screen appears with version number
- [ ] Verify changelog/release notes shown
- [ ] Verify "What's New" highlights listed
- [ ] Click "Get Started" button
- [ ] Verify splash screen dismissed
- [ ] Relaunch app (splash should not appear again for same version)

#### About/Version Info
- [ ] Open Settings
- [ ] Verify version number displayed (e.g., "v0.7.0")
- [ ] Verify "Check for Updates" button present (if applicable)
- [ ] Verify GitHub link present and clickable

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

## Test Results Template

**Version:** [e.g., v0.7.0]
**Tester:** [Your Name]
**Date:** [Test Date]
**Platform:** macOS [version] / Windows [version]

### Summary
- **Total Tests:** [X]
- **Passed:** [X]
- **Failed:** [X]
- **Blocked:** [X]

### Failed Tests
| Test Case | Expected | Actual | Severity | Notes |
|-----------|----------|--------|----------|-------|
| Example | Modal opens | Modal doesn't open | High | Keyboard shortcut not working |

### Performance Notes
[Optional: Note any performance issues observed during testing. Users will report significant performance problems as bugs.]

### Additional Observations
[Any other bugs found, usability issues, or recommendations]

---

## Post-Testing Checklist

- [ ] All critical tests passed on macOS
- [ ] All critical tests passed on Windows
- [ ] No console errors observed
- [ ] No visual glitches or layout issues
- [ ] Export/Import workflows validated
- [ ] Keyboard navigation fully functional
- [ ] Terminal integration working on both platforms
- [ ] Test results documented
- [ ] Failed tests logged as issues (if any)

**Sign-off:** Manual GUI Testing Complete ✅

---

## Notes on Performance Testing

Performance testing has been intentionally excluded from this checklist to keep testing focused on functional correctness. Performance issues will be addressed as they arise through user feedback and bug reports. If you observe any significant performance problems during functional testing (e.g., UI freezing, slow search, laggy animations), note them in the "Performance Notes" section of the test results template.
