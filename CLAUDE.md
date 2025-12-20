# SSH Profile Manager - Development Notes

## Project Overview
A lightweight, cross-platform SSH profile manager built with Tauri. Provides a modern GUI alternative to terminal-based SSH clients like Tabby, with a focus on being lightweight and fast.

**Bundle Size:** ~3-5MB (vs 100MB+ for Electron apps)

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JavaScript (no framework bloat)
- **Backend:** Rust with Tauri v2
- **Database:** SQLite (rusqlite)
- **Secure Storage:** System keychain (keyring crate)
- **Platforms:** macOS, Windows (Linux ready)

## Current Features

### Profile Management
- ✅ Create, edit, delete, duplicate SSH profiles
- ✅ Store: name, description, hostname, port, username, group
- ✅ Unique profile names (case-insensitive validation)
- ✅ Three authentication methods:
  - SSH Key (with path to key file)
  - Password (stored securely in system keychain)
  - None (prompt on connect)
- ✅ Collapsible groups for organization
- ✅ Search/filter profiles
- ✅ Custom confirmation dialogs for deletion
- ✅ Export profiles to JSON (with passwords for team sharing)
- ✅ Import profiles from JSON (replaces existing profiles)
- ✅ Delete all profiles with confirmation

### UI/UX
- ✅ Dark/Light theme with system preference detection
- ✅ Theme toggle in settings (Dark, Light, Follow System)
- ✅ Color-coded action buttons:
  - Green: Connect
  - Blue: Edit
  - Gray: Duplicate
  - Red: Delete
- ✅ Toast notifications (green for success, red for errors)
- ✅ Collapsible group headers with counts
- ✅ Smooth hover effects on buttons and cards
- ✅ Required field indicators (red asterisks)
- ✅ Settings modal with About section
- ✅ Developer tools enabled for debugging

### SSH Connection
- ✅ One-click connect launches system terminal
- ✅ App minimizes/hides when connecting
- ✅ Terminal automatically gets focus
- ✅ macOS: Opens in Terminal.app
- ✅ Windows: Opens in cmd/Windows Terminal
- ✅ Linux: Tries common terminals (gnome-terminal, konsole, xterm)

## Project Structure

```
ssh-profile-manager-app/
├── dist/                       # Frontend files
│   ├── index.html             # Main UI structure
│   ├── styles.css             # All styling
│   └── main.js                # Frontend logic
├── src-tauri/                 # Rust backend
│   ├── src/
│   │   └── lib.rs            # Main Tauri app + commands
│   ├── Cargo.toml            # Rust dependencies
│   ├── tauri.conf.json       # Tauri configuration
│   └── icons/                # App icons
├── package.json              # Node dependencies
└── CLAUDE.md                 # This file
```

## Development Commands

```bash
# Start development mode (with hot reload and dev tools)
npm run dev

# Build production app
npm run build

# Output locations:
# - macOS app: src-tauri/target/release/bundle/macos/SSH Profile Manager.app
# - DMG installer: src-tauri/target/release/bundle/dmg/SSH Profile Manager_0.1.0_aarch64.dmg
```

## Data Storage

- **Database:** `~/Library/Application Support/ssh-profile-manager/profiles.db` (macOS)
- **Passwords:** macOS Keychain (service: "ssh-profile-manager", account: profile_id)

## Key Implementation Details

### Tauri Commands (Rust → JavaScript)
- `get_profiles()` - Returns all profiles sorted by group and name
- `create_profile(profile)` - Creates new profile, stores password if provided
- `update_profile(profile)` - Updates existing profile
- `delete_profile(id)` - Deletes profile and associated password
- `export_profiles()` - Exports all profiles to JSON (includes passwords)
- `import_profiles(data)` - Imports profiles from JSON (deletes existing first)
- `save_profiles_to_file(data, filename)` - Shows native save dialog and writes JSON file
- `connect_ssh(profileId)` - Launches SSH connection in system terminal, hides app window

### Custom Confirmation Dialog
- Native browser `confirm()` doesn't work in Tauri
- Built custom modal with Promise-based API
- Styled with formatted messages (colored text for profile name and warning)

### Double-Submit Prevention
- `isSubmitting` flag prevents duplicate profile creation
- Important because form can be submitted via Enter key or button click

### Collapsible Groups
- State tracked in `collapsedGroups` Set
- Persists during search/filter operations
- Click chevron (▶/▼) to toggle

## Known Issues / Bugs

### Fixed
- ✅ Duplicate profiles on create (double-submit bug)
- ✅ Groups not displaying properly
- ✅ Delete button not working (native confirm() issue)
- ✅ Profile cards shifting on hover
- ✅ Edit button hover effect missing
- ✅ Confirmation dialog spacing too wide
- ✅ Required field asterisks not obvious enough

### Current
- None reported

## Future Feature Ideas

### High Priority
- [ ] Embedded terminal (xterm.js) - like Tabby
- [ ] Recent connections list
- [ ] Profile templates
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
- [ ] Backup/restore settings
- [ ] Cloud sync (optional)
- [ ] SSH config file import
- [ ] Custom app icon per profile

## Windows Support

Currently untested but should work. Need to test:
- [ ] SSH connection launching in Windows Terminal
- [ ] Password storage in Windows Credential Manager
- [ ] Build and installer creation
- [ ] Path handling (backslashes vs forward slashes)

## Tips for Next Session

### Adding a New Tauri Command
1. Add Rust function in `src-tauri/src/lib.rs` with `#[tauri::command]`
2. Add to `invoke_handler!` macro in `run()` function
3. Call from JavaScript: `await invoke('command_name', { params })`

### Modifying the UI
- HTML: `dist/index.html`
- CSS: `dist/styles.css` (all styles in one file)
- JS: `dist/main.js` (vanilla JavaScript, no build step)
- Dev server auto-reloads on changes

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

### Accessing Dev Console
- Right-click in app → "Inspect Element"
- Console tab shows all `console.log()` output
- Network tab for debugging Tauri commands

## Dependencies

### Rust (Cargo.toml)
- `tauri` - Main framework
- `rusqlite` - SQLite database
- `serde/serde_json` - JSON serialization
- `uuid` - Unique IDs for profiles
- `keyring` - Secure password storage
- `dirs` - Cross-platform directory paths
- `shellexpand` - Expand ~ in file paths
- `chrono` - Timestamp for exports
- `rfd` - Native file dialogs (save/open)

### Node (package.json)
- `@tauri-apps/cli` - Build tooling
- `@tauri-apps/api` - Frontend API (imported via window.__TAURI__)

## Useful File Locations

- **Tauri config:** `src-tauri/tauri.conf.json`
- **Bundle ID:** `com.sshprofilemanager.app` (currently ends with .app, warned by Tauri)
- **App version:** 0.1.0
- **Window size:** 800x600 (resizable)

## Recent Changes

### Latest Session (December 2024)
1. **Theme System**: Added light/dark mode toggle with system preference detection
2. **Export/Import**: Implemented JSON export/import with native save dialogs (using `rfd` crate)
3. **Delete All Profiles**: Added bulk delete feature with confirmation dialog
4. **Duplicate Profiles**: One-click duplicate with "(duplicate)" suffix
5. **Unique Names**: Case-insensitive validation prevents duplicate profile names
6. **Toast Notifications**: Color-coded notifications (green=success, red=error)
7. **Button Colors**: Green connect, blue edit, gray duplicate, red delete
8. **Auth Methods**: Removed SSH Agent, added "None (prompt on connect)"
9. **Terminal Focus**: App minimizes and terminal gets focus when connecting
10. **Settings Page**: Added About section with app info and GitHub link
11. **Grammar Fixes**: Proper singular/plural in all messages
12. **Import Behavior**: Now properly deletes existing profiles before importing

### Initial Session
1. Initial Tauri setup with Rust + Node.js
2. Created profile management UI with groups
3. Implemented SQLite database for profiles
4. Added keychain integration for passwords
5. Built custom confirmation dialog (native confirm() doesn't work)
6. Fixed double-submit bug
7. Added collapsible groups with chevrons
8. Enhanced button hover effects
9. Improved delete confirmation styling
10. Made required field asterisks more visible (bold + red)

## Contact & Resources

- **Tauri Docs:** https://tauri.app/
- **GitHub Repository:** https://github.com/tomsinclair94/ssh-profile-manager
- **Original bash script:** `../ssh-profile-manager.sh` (for reference)
