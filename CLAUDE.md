# SSH Profile Manager - Development Notes

## Project Overview
A lightweight, cross-platform SSH profile manager built with Tauri. Provides a modern GUI alternative to terminal-based SSH clients like Tabby, with a focus on being lightweight and fast.

**Bundle Size:** ~3-5MB (vs 100MB+ for Electron apps)

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JavaScript (no framework bloat)
- **Backend:** Rust with Tauri v2
- **Database:** SQLite (rusqlite)
- **Secure Storage:** System keychain (keyring crate)
- **Platforms:** macOS (Apple Silicon), Windows

## Current Features

### Profile Management
- ✅ Create, edit, delete, duplicate SSH profiles
- ✅ Store: name, description, hostname, port, username, group
- ✅ Unique profile names (case-insensitive validation)
- ✅ Three authentication methods: SSH Key, Password (keychain), None (Keyboard-Interactive)
- ✅ SSH Key file browser with OS-specific hidden file hints
- ✅ Collapsible groups for organization
- ✅ Expand/Collapse all groups button (dynamic text based on state)
- ✅ Search/filter profiles
- ✅ Group filtering (show/hide groups with persistent state)
- ✅ Export/Import profiles to JSON (with passwords)
- ✅ Delete all profiles with confirmation

### UI/UX
- ✅ Dark/Light theme with system preference detection
- ✅ Color-coded action buttons (Green: Connect, Blue: Edit, Gray: Duplicate, Red: Delete)
- ✅ Toast notifications (green for success, red for errors)
- ✅ Smart Save button (disabled until changes made when editing)
- ✅ Spell check disabled on technical fields
- ✅ Update checker with auto-check on launch (toggleable in settings)
- ✅ Settings modal with About section

### SSH Connection
- ✅ One-click connect launches system terminal
- ✅ App minimizes when connecting (restorable from dock/taskbar)
- ✅ macOS: Opens in Terminal.app
- ✅ Windows: Opens in cmd/Windows Terminal

## Project Structure

```
ssh-profile-manager/
├── dist/                       # Frontend files
│   ├── index.html             # Main UI structure
│   ├── styles.css             # All styling
│   └── main.js                # Frontend logic
├── src-tauri/                 # Rust backend
│   ├── src/lib.rs            # Main Tauri app + commands
│   ├── Cargo.toml            # Rust dependencies
│   └── tauri.conf.json       # Tauri configuration
└── CLAUDE.md                 # This file
```

## Development Commands

```bash
npm run dev      # Start development mode (with hot reload)
npm run build    # Build production app
```

## Release Management

### Current Version: 0.2.1 (Released)

### Creating a New Release

**IMPORTANT:** When the user says they're ready to prep for the next release (or similar context), follow this process:

1. **Code Review First** - Suggest using the code-reviewer agent to review all code changes before releasing:
   ```
   Let me use the code-reviewer agent to review the code changes before we prepare the release.
   ```
   Use the Task tool with subagent_type='code-reviewer' to review src-tauri/src/lib.rs and dist/main.js

2. **Ask for Version Number** - Follow semantic versioning: MAJOR.MINOR.PATCH

3. **Update All Version References** - Update the version in these FIVE locations:
   - `src-tauri/tauri.conf.json` (line 4)
   - `src-tauri/Cargo.toml` (line 3)
   - `package.json` (line 3)
   - `dist/index.html` (line 17 - header version)
   - `dist/index.html` (line ~178 - About section)

4. **Create Git Tag**
   ```bash
   git add .
   git commit -m "Release vX.X.X"
   git tag vX.X.X
   git push origin main
   git push origin vX.X.X
   ```

5. **GitHub Actions** will automatically build DMG (macOS) and create the release

### Known Release Issues

**macOS "App is Damaged" Error:**
- GitHub-built DMGs show this error because the app is **not code-signed**
- **User workaround:** Right-click app → "Open" (instead of double-click)
- **Or run:** `xattr -cr "/Applications/SSH Profile Manager.app"`
- **Production fix:** Requires Apple Developer certificate ($99/year)

## Data Storage

- **Database:** `~/Library/Application Support/ssh-profile-manager/profiles.db`
- **Passwords:** System keychain (service: "ssh-profile-manager")

## Key Implementation Details

### Tauri Commands (Rust → JavaScript)
- `get_profiles()` - Returns all profiles sorted by group and name
- `create_profile(profile)` - Creates new profile, stores password if provided
- `update_profile(profile)` - Updates existing profile
- `delete_profile(id)` - Deletes profile and associated password
- `export_profiles()` - Exports all profiles to JSON (includes passwords)
- `import_profiles(data)` - Imports profiles from JSON (deletes existing first)
- `save_profiles_to_file(data, filename)` - Shows native save dialog and writes JSON file
- `browse_ssh_key()` - Opens file picker in ~/.ssh directory
- `connect_ssh(profileId)` - Launches SSH connection in system terminal, minimizes app

### Important Notes
- **Custom Confirmation Dialog**: Native `confirm()` doesn't work in Tauri - built custom modal with Promise-based API
- **Double-Submit Prevention**: `isSubmitting` flag prevents duplicate profile creation
- **Form Change Detection**: Save button disabled until changes detected when editing profiles
- **Collapsible Groups**: State tracked in `collapsedGroups` Set, persists during search/filter

## Known Issues / Bugs

### Current
- None

### Very Low Priority (From v0.2.1 Code Review)
- **VLP-001**: Debounce function doesn't preserve `this` context - not currently an issue as only used with arrow functions, but could use `.apply(this, args)` for future-proofing
- **VLP-002**: Linux error messages show OS-level errors (e.g., "No such file or directory") - could simplify to "not installed" for better UX
- **VLP-003**: Port validation debug assertion is redundant with validation check above it - consider removing or making message more specific
- **VLP-004**: Toast hiding on export cancel is abrupt - could use existing toast hiding mechanism for consistency

## Pending Tasks (Next Session)

- [ ] Add limitations and syntax checking to the profile editor

## Future Feature Ideas

### High Priority
- [x] **SSH Key file browser** (v0.2.0)
- [x] **Update checker** (v0.2.0)
- [x] **Auto-update check** (v0.2.0)
- [ ] **Settings export/import**: Backup and restore settings
- [ ] Embedded terminal (xterm.js)
- [ ] Recent connections list
- [ ] Keyboard shortcuts for common actions

### Medium Priority
- [ ] SFTP support
- [ ] Port forwarding configuration
- [ ] Jump host chains
- [ ] Connection history/logs
- [ ] Custom color tags for profiles
- [ ] Bulk operations (select multiple profiles)

### Low Priority
- [ ] Multiple windows
- [ ] Cloud sync (optional)
- [ ] SSH config file import
- [ ] Custom app icon per profile

## Quick Reference

### Adding a New Tauri Command
1. Add Rust function in `src-tauri/src/lib.rs` with `#[tauri::command]`
2. Add to `invoke_handler!` macro in `run()` function
3. Call from JavaScript: `await invoke('command_name', { params })`

### Database Schema
```sql
CREATE TABLE profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    username TEXT NOT NULL,
    auth_method TEXT NOT NULL DEFAULT 'key',
    key_path TEXT,
    group_name TEXT
)
```

### Key Dependencies
**Rust:** tauri, rusqlite, serde/serde_json, uuid, keyring, dirs, shellexpand, chrono, rfd
**Node:** @tauri-apps/cli, @tauri-apps/api

## Recent Changes

### v0.2.1 (Ready for Release) - Code Quality & Bug Fixes
1. **Bug Fixes**:
   - Linux SSH connection: Now reports which terminal emulators were tried and why they failed
   - Update checker: Added comprehensive validation for version format from GitHub API
   - Port validation: Added explicit documentation and debug assertions for safe casting
   - Filter badge: Changed to show HIDDEN groups instead of selected groups (clearer UX)
2. **Code Quality**:
   - Standardized error handling across all platforms
   - Eliminated duplicate code in form value capture
   - Implemented smart duplicate naming (strips existing "(duplicate)" suffixes)
   - Added loading toast notifications during import/export
   - Replaced all hardcoded magic numbers with named constants
   - Added browser compatibility documentation
3. **UI Enhancements**:
   - Reduced spacing in About section for more compact layout
   - Added minimum window size constraints (600x450)

### v0.2.0 (Released) - UX Improvements & Bug Fixes
1. **Bug Fixes**:
   - Window restoration: Changed `window.hide()` to `window.minimize()`
   - Password deletion: Fixed error when editing non-password auth profiles
   - Update checker: Changed from blocking to async HTTP (prevents UI freezing)
   - Filter state: Added debouncing to prevent race conditions
   - Memory leak: Implemented event delegation for profile card buttons
   - File dialogs: Added 2-minute timeout to prevent indefinite hangs
   - Filter state: Added validation and user notification for corrupted localStorage data
2. **New Features**:
   - Group filtering: Show/hide groups with dropdown filter button next to search
   - Expand/Collapse all groups button with dynamic text
   - Update checker: Manual check button + auto-check on launch (toggleable)
   - SSH Key file browser with Browse button (opens in ~/.ssh, OS-specific hidden file hints)
3. **UX Enhancements**:
   - Smart Save button: Disabled until changes detected when editing
   - Notification improvements: "Created" vs "Updated" messages
   - Spell check disabled on technical fields (hostname, username, port, key path, password, group)
   - Auth method renamed to "None (Keyboard-Interactive)"
   - Filter badge shows number of selected groups (hidden when all selected)
   - Persistent filter state across app restarts

### v0.1.2 (Released) - Security Fixes
- Fixed critical command injection vulnerability (SEC-001)
- Added comprehensive input validation for all profile fields (SEC-002)
- Fixed path traversal vulnerability in SSH key paths (SEC-003)
- Backend port validation (SEC-004)
- Password deletion error handling (SEC-005)
- Content Security Policy enabled (SEC-010)

### v0.1.1 (Released) - Initial Release
- Initial public release with core functionality
- Profile management, theming, export/import
- macOS and Windows support
- GitHub Actions automated releases

## Contact & Resources

- **GitHub Repository:** https://github.com/tomsinclair94/ssh-profile-manager
- **Tauri Docs:** https://tauri.app/
