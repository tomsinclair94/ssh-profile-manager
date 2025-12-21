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

### v0.2.1 (Released - 2024-12-21) - Code Quality & Bug Fixes
- Fixed 10 deferred issues from v0.2.0 code review (4 medium, 6 low priority)
- **Key Fixes**: Linux SSH error reporting, update validation, filter badge UX, smart duplicate naming
- **Code Quality**: Standardized error handling, eliminated duplicates, replaced magic numbers with constants
- **UI**: Compact About section, minimum window size (600x450)

### v0.2.0 (Released - 2024-12-20) - UX Improvements & Features
- **New**: Group filtering, Expand/Collapse all, Update checker, SSH Key browser
- **Fixed**: Window restoration, password deletion, memory leak, file dialog timeout
- **UX**: Smart Save button, loading feedback, persistent filters

### v0.1.2 (Released - 2024-12-20) - Security Fixes
- Fixed critical command injection and path traversal vulnerabilities
- Added comprehensive input validation and Content Security Policy

### v0.1.1 (Released - 2024-12-20) - Initial Release
- Core profile management, theming, export/import, macOS/Windows support

## Contact & Resources

- **GitHub Repository:** https://github.com/tomsinclair94/ssh-profile-manager
- **Tauri Docs:** https://tauri.app/
