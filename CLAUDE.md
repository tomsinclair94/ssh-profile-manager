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

## Release Management

### Current Version: 0.1.2

### Automated Release Process

The app uses GitHub Actions to automatically build and release installers when a version tag is pushed.

**GitHub Actions Workflow:** `.github/workflows/release.yml`
- Builds DMG for macOS (Apple Silicon only)
- Windows build currently disabled during development (commented out)
- Creates GitHub release with installers attached
- Requires `contents: write` permission to create releases

### Creating a New Release

**IMPORTANT:** When the user asks to create a new release, follow this process:

1. **Ask for Version Number**
   - Ask the user: "What version number would you like to use for this release? (e.g., 0.2.0, 1.0.0)"
   - Follow semantic versioning: MAJOR.MINOR.PATCH

2. **Update All Version References**
   Update the version in these FIVE locations:
   - `src-tauri/tauri.conf.json` (line 4: "version": "X.X.X")
   - `src-tauri/Cargo.toml` (line 3: version = "X.X.X")
   - `package.json` (line 3: "version": "X.X.X")
   - `dist/index.html` (line 17: `<span class="version">vX.X.X</span>` - header)
   - `dist/index.html` (line 175: `<span class="about-value">X.X.X</span>` - About section)

3. **Create Git Tag**
   After updating files, prepare the git commands but DON'T execute them:
   ```bash
   git add .
   git commit -m "Release vX.X.X"
   git tag vX.X.X
   git push origin main
   git push origin vX.X.X
   ```

4. **Inform the User**
   Tell the user:
   - Version has been updated in all locations
   - Git commands are ready to execute (show them the commands)
   - Once pushed, GitHub Actions will automatically build and create the release

### Version Update Locations (Reference)

1. **Tauri Config** (`src-tauri/tauri.conf.json`):
   ```json
   "version": "0.1.2"
   ```

2. **Cargo Manifest** (`src-tauri/Cargo.toml`):
   ```toml
   version = "0.1.2"
   ```

3. **Package.json** (`package.json`):
   ```json
   "version": "0.1.2"
   ```

4. **Header Version** (`dist/index.html`):
   ```html
   <span class="version">v0.1.2</span>
   ```

5. **About Section** (`dist/index.html`):
   ```html
   <span class="about-value">0.1.2</span>
   ```

### Release Output

After GitHub Actions completes:
- Release appears at: https://github.com/tomsinclair94/ssh-profile-manager/releases
- Contains:
  - macOS DMG (Apple Silicon / ARM64)
  - Windows MSI installer (currently disabled during development)

### Known Release Issues

**macOS "App is Damaged" Error:**
- DMG files built by GitHub Actions show "damaged and can't be opened" error
- This happens because the app is **not code-signed**
- Local builds work fine because macOS doesn't quarantine locally-built apps
- Downloaded apps require an Apple Developer certificate ($99/year) to avoid this

**Solutions:**
1. **For users:** Right-click app → "Open" (instead of double-click) to bypass Gatekeeper
2. **Or run:** `xattr -cr "/Applications/SSH Profile Manager.app"` to remove quarantine flag
3. **For production:** Need to add code signing to GitHub Actions workflow (requires Apple Developer account)

**Current Status:** App works perfectly when built locally. GitHub releases require manual override by users.

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
- **App version:** 0.1.2
- **Window size:** 800x600 (resizable)

## Recent Changes

### Latest Session (December 2024 - v0.1.2 Security Fixes) ✅ RELEASED
1. **Code Review**: Comprehensive code review identified 2 critical, 3 high, and 5 medium security vulnerabilities
2. **SEC-001 Fixed**: Command injection vulnerability in SSH connection handler - CRITICAL
   - Added input validation for hostname, username, port
   - Implemented proper shell escaping for all platforms (macOS, Windows, Linux)
3. **SEC-002 Fixed**: Input validation for all profile fields - CRITICAL
   - Added validate_hostname(), validate_username(), validate_profile_name(), validate_port(), validate_key_path()
4. **SEC-003 Fixed**: Path traversal vulnerability in SSH key paths - HIGH
   - Key paths now restricted to home directory
5. **SEC-004 Fixed**: Backend port validation - HIGH
6. **SEC-005 Fixed**: Password deletion error handling - HIGH
7. **SEC-007 Fixed**: Consistent HTML escaping - MEDIUM
8. **SEC-010 Fixed**: Content Security Policy enabled - MEDIUM
9. **Version Updates**: Bumped to v0.1.2 in all 5 locations
10. **CHANGELOG**: Updated with comprehensive v0.1.2 security fixes
11. **Release Completed**: Successfully tagged and pushed v0.1.2 to GitHub (commit: 7dac596)

### Previous Session (December 2024 - v0.1.1 Release)
1. **GitHub Link Fix**: Added Tauri shell plugin to open external links in browser
2. **Icon Quality**: Upgraded header icon from 32x32 to 128x128@2x for better resolution
3. **Default Auth Method**: Changed from "SSH Key" to "None (Prompt on Connect)"
4. **About Section**: Added author credits (Tom Sinclair) and AI assistant credit (Claude)
5. **Tauri v2 Permissions**: Added required capabilities for shell:open and app:hide
6. **Header Version Display**: Added version number (v0.1.1) to app header in smaller font
7. **Version Updates**: Bumped to v0.1.1 in all 5 locations (2 in index.html, tauri.conf.json, Cargo.toml, package.json)
8. **README Cleanup**: Converted to British English, removed Roadmap and Contributing sections for private use
9. **CHANGELOG**: Created CHANGELOG.md following Keep a Changelog format with v0.1.0 and v0.1.1 entries
10. **Shell Plugin**: Added tauri-plugin-shell dependency and registration in lib.rs

### Previous Session (December 2024 - Release Setup)
1. **Automated Releases**: Created GitHub Actions workflow for automatic DMG/MSI builds
2. **Version Management**: Documented release process in CLAUDE.md
3. **README Updates**: Removed all Linux references (macOS and Windows only)
4. **Release Process**: Set up automated release workflow triggered by version tags

### Previous Session (December 2024)
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
