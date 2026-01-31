# SSH Profile Manager - Development Guide

## Project Overview
Lightweight, cross-platform SSH profile manager built with Tauri v2. Modern GUI alternative to terminal SSH clients.

**Bundle Size:** ~3-5MB | **Platforms:** macOS (Apple Silicon), Windows
**Tech Stack:** Vanilla JS/HTML/CSS frontend, Rust backend, SQLite database, system keychain

**IMPORTANT: British English**
- All user-facing text must use British English spelling and terminology
- Examples: "Colour" not "Color", "Organising" not "Organizing", "Favourites" not "Favorites"
- Settings labels, tooltips, help text, notifications, and error messages must follow British conventions
- Code comments and developer documentation can use either variant

## Quick Start

```bash
bun run dev      # Development with hot reload
bun run build    # Production build
```

**Files:** `dist/` (frontend) | `src-tauri/` (Rust backend)

## Current Status

**In Development:** v0.7.0
**See:** TODO.md for roadmap and feature backlog

**v0.7.0 Features (In Development - 75% Complete):**
- ✅ Hierarchical group system with sub-groups (up to 3 levels, semantic paths)
- ✅ Individual profile/group export/import with duplicate detection
- ✅ Favourites system for profiles with virtual group display
- ✅ Icon picker with 40+ Lucide icons (inline SVG, CSP-compliant)
- ✅ Tag system with colour-coding, search filtering, and multi-select management
- ✅ Comprehensive keyboard shortcuts (30+ shortcuts with help modal)
- ✅ Settings renamed: Backup/Restore (instead of Export/Import)
- ✅ Enhanced UI polish: tooltips, animations, responsive layouts
- ⏸️ Encryption for exports (Phase 6 - pending)
- ⏸️ Testing & documentation (Phase 8 - pending)

## Version Management

**CRITICAL: When creating a new dev branch (`vX.X.X-dev`), follow these steps:**

**Step 1: Bump version in ALL locations:**
1. `src-tauri/tauri.conf.json` (line ~4: `"version": "X.X.X"`)
2. `src-tauri/Cargo.toml` (line ~3: `version = "X.X.X"`)
3. `package.json` (line ~3: `"version": "X.X.X"`)
4. `dist/index.html` (line ~22 + ~393: `vX.X.X` and `X.X.X`)
5. `README.md` (line ~14 + ~16: badge versions)
6. `dist/main.js` (line ~56: `CURRENT_APP_VERSION = 'X.X.X'`)
7. `dist/main.js` (line ~59-72: Add new `VERSION_CHANGELOG` entry with version, releaseDate, subtitle, highlights, and githubUrl)

**Step 2: Enable Developer Tools:**
Enable devtools for debugging during development:
1. `src-tauri/tauri.conf.json` (line ~19: `"devtools": true`)

**Step 3: Update all dependencies to latest versions:**
```bash
# Update JavaScript dependencies
bun update

# Update Rust dependencies
cd src-tauri && cargo update && cd ..

# Verify builds still work
bun run build
```

**Step 4: Commit changes:**
```bash
git add -A
git commit -m "Bump version to X.X.X for dev branch"
```

**Why update dependencies?** Keeping dependencies current at the start of each release prevents Dependabot from creating many PRs during development. This gives you control over when updates happen and ensures all updates are tested together with your new features.

**Developer Tools:** With devtools enabled, you can right-click in the application to access the console for debugging during development. This helps with frontend debugging and Tauri command inspection.

## Release Process

**Dev Branch (`vX.X.X-dev`):**
1. **VERSION ALREADY BUMPED** (see Version Management above)
2. Develop features/fixes
3. **DISABLE DEVELOPER TOOLS** before code reviews: `src-tauri/tauri.conf.json` (line ~19: `"devtools": false`)
4. Code review (`code-reviewer` agent)
5. Refactor (`refactoring-specialist` agent) - optional, skip if not needed
6. Security review (`security-engineer` agent)
7. Fix CRITICAL/HIGH/MEDIUM issues
8. Update CHANGELOG.md with **user-facing changes only**: new features and bug fixes (exclude minor security tweaks, dependency updates, or internal refactoring to keep changelog focused)
9. Commit & push

**Merge to Main:**
1. PR `vX.X.X-dev` → `main` with auto-merge enabled
   - Create PR: `gh pr create --title "..." --body "..."`
   - Enable auto-merge: `gh pr merge <PR_NUMBER> --auto --squash`
   - PR will auto-merge with squash once all checks pass
2. Squash merge with title: `Release vX.X.X - Description`
3. Auto-tag workflow creates git tag with CHANGELOG content
4. Auto-release workflow builds binaries (macOS aarch64, Windows x86_64)
5. GitHub release published automatically

**Critical:** Commit message MUST start with `Release vX.X.X` for auto-tagging.
**Note:** Auto-tag workflow uses PAT_TOKEN (fixed in v0.6.3) to properly trigger release builds.
**Workflow:** See DEVELOPMENT.md for branch protection rules and PAT_TOKEN setup.

## Dependabot Dependency Updates

**Automatic Handling:**
- Dependabot PRs automatically have auto-merge enabled via GitHub Actions workflow
- PRs auto-merge with squash once all checks pass (security audit, build verification)
- No manual intervention needed for dependency updates

**How it works:**
- Updates dependencies on `main` branch between releases
- Does NOT trigger new releases (no version bump or git tag)
- Next dev branch inherits updates when branched from `main`
- Example: v0.6.5 released → Dependabot updates `main` → v0.6.6-dev branches from updated `main`

**Configuration:**
- Weekly limit: 10 Rust PRs, 10 JavaScript PRs, 5 GitHub Actions PRs
- Workflow: `.github/workflows/dependabot-auto-merge.yml`
- Config: `.github/dependabot.yml`

## Key Implementation Patterns

### Tauri Commands

**Profile Management:**
```rust
get_profiles()  // Returns Vec<ProfileWithMetadata> (includes icon, is_favorite, tags)
create_profile(input: CreateProfileInput)
update_profile(input: UpdateProfileInput)
delete_profile(id: String)
export_profile(profile_id: String) // Individual profile export (v0.7.0)
import_profile(data: String) // With duplicate detection (v0.7.0)
```

**Group Management (v0.7.0):**
```rust
get_groups() // Returns Vec<Group>
get_group_tree() // Hierarchical structure
create_group(name: String, parent_id: Option<String>)
update_group(id: String, name: String)
delete_group(id: String, mode: String) // "cascade" or "move"
move_group(id: String, new_parent_id: Option<String>)
export_group(group_id: String) // Recursive with sub-groups
import_group(data: String, target_parent_id: Option<String>)
get_profiles_by_group_path(group_path: String)
```

**Metadata & Favourites (v0.7.0):**
```rust
toggle_profile_favorite(profile_id: String) // Returns new state
set_profile_favorite(profile_id: String, is_favorite: bool)
update_profile_icon(profile_id: String, icon: Option<String>)
get_profile_metadata(profile_id: String)
```

**Tags (v0.7.0):**
```rust
get_tags() // Returns Vec<Tag>
create_tag(input: CreateTagInput) // name + color
delete_tag(tag_id: String)
get_tag_usage_counts() // Returns Vec<(Tag, i32)>
get_profile_tags(profile_id: String)
set_profile_tags(profile_id: String, tag_ids: Vec<String>)
add_profile_tag(profile_id: String, tag_id: String)
remove_profile_tag(profile_id: String, tag_id: String)
```

**Settings & Export/Import:**
```rust
export_profiles() // All profiles (legacy, now called "Export All Profiles")
import_profiles(data: String) // With conflict resolution
export_settings() // Now displayed as "Backup Settings" in UI
import_settings(data: String) // Now displayed as "Restore Settings" in UI
browse_ssh_key()
browse_terminal_app()
```

**Connections & Terminal:**
```rust
connect_ssh(profile_id: String, terminal_preference: String, custom_terminal_path: Option<String>, should_minimize: bool)
record_connection(profile_id: String)
get_recent_connections()
clear_recent_connections()
create_terminal_session(profile_id: String)
write_to_session(session_id: String, data: String)
resize_session(session_id: String, cols: u16, rows: u16)
close_session(session_id: String)
```

**Updates:**
```rust
check_for_updates()
```

### Critical Patterns

**Confirmation Dialogs:**
- Action verbs (Delete/Import/Reset), not Yes/No
- Secondary button: "Cancel"
- Classes: `btn-danger` (destructive), `btn-primary` (safe)
- Use `buildConfirmMessage()` for consistent formatting with highlighted names
- British English in all text ("Colour", "Organising", "Favourites")

**Adding Settings:**
Update: `SettingsData` struct (Rust) + `export/import_settings` commands + `backupSettings/restoreSettings` (JS) + `resetSettings` (JS)

**OS-Specific Settings:**
- Export includes `os` field ("macos"/"windows")
- `settings_os_specific` for OS-dependent values
- Import ignores OS-specific on mismatch

**Keyboard Navigation:**
- Selection states: `selectedProfileId`, `selectedGroupName`, `selectedRecentConnectionId`
- Clear selections on modal open/close
- Focus: blur on mouseenter, refocus on Tab
- Modal trapping: `getAllTabbableItems()` for Tab cycling
- Focus style: 2px outline + box-shadow
- Popup auto-close: 100ms delay on blur

**Modal Stack System:**
- Dynamic stack tracking ensures keyboard navigation always targets the topmost modal
- Stack: `modalStack` array (line ~484), functions: `pushModal()`, `popModal()`, `getTopmostModal()`
- **Adding New Modals:**
  1. Call `pushModal('modalId')` when showing modal (after `classList.remove('hidden')`)
  2. Call `popModal('modalId')` when hiding modal (after `classList.add('hidden')`)
  3. Add case to `handleModalShortcuts()` switch statements for Tab, Escape, Cmd/Ctrl+S
  4. Create `getModalIdTabbableItems()` function if modal has focusable elements
- **Example:**
  ```javascript
  function openMyModal() {
      myModal.classList.remove('hidden');
      pushModal('myModal');  // Add to stack
  }

  function closeMyModal() {
      myModal.classList.add('hidden');
      popModal('myModal');  // Remove from stack
  }
  ```
- Handles nested modals automatically (e.g., splash screen over settings, confirm over profile)
- No manual priority ordering needed - stack handles it dynamically

**Security:**
- Backend validation: XSS, command injection, path traversal
- Custom confirm() for Tauri
- Double-submit prevention: `isSubmitting` flag
- CSP-compliant: All styles applied via JavaScript (no inline `style=""` attributes)
- Tag/group name validation: Alphanumeric + limited special chars only
- localStorage: Group IDs (not names) for filter/collapse state

**Migration System:**
- Automatic version detection using `CURRENT_APP_VERSION` constant
- Generic storage keys: `migrationVersion`, `migrationToastShown`, `lastSplashVersion`
- Version-specific migrations use "less than" checks (handles skipped versions)
- Two-phase: `checkAndPerformMigration()` (early, before data load) + `performPostLoadMigration()` (optional, for UI updates)
- See detailed inline documentation in `dist/main.js` around line ~1920 for adding new migrations
- Version splash screen automatically shows changelog on version changes

**Tag System (v0.7.0):**
- Tags stored in separate `tags` table with many-to-many relationship
- Tag names: Alphanumeric + hyphens/underscores only (NO spaces), max 32 chars
- Colours: Hex format `#RRGGBB`, validated and normalised to uppercase
- Auto-create on import: Tags matched by name, created if missing
- Search syntax: `tag:production tag:dev` (OR logic, exact match)
- Display: Colour-coded badges with automatic text contrast (black/white based on luminance)

**Favourites System (v0.7.0):**
- Virtual "Favourites" group at top of profile list (auto-hides when empty)
- Star icon toggle on all profile cards (filled gold when active, outlined grey when inactive)
- Profiles sorted A-Z by group path in Favourites view
- "Go to Profile" button navigates to real location in group hierarchy
- Gold/amber theme (#f59e0b) throughout

**Icon System (v0.7.0):**
- 40+ Lucide icons as inline SVG paths (no CDN, CSP-compliant)
- Default icon: 'server' for all profiles
- Searchable dropdown with keyboard navigation
- Icons excluded from picker: 'star', 'star-off', 'settings' (reserved for UI)
- Display: 32px on profile cards, vertically centred with multi-row content

**Keyboard Shortcuts (v0.7.0):**
- Toggle via Settings (enabled by default)
- 30+ shortcuts: N (New Profile), G (New Group), T (Tag Manager), S (Settings)
- Cmd/Ctrl modifiers: Cmd+S (Search), Cmd+F (Filter), Cmd+Left/Right (Collapse/Expand All)
- Help modal accessible with `?` key
- Platform-aware (Cmd on macOS, Ctrl on Windows/Linux)

**Password Authentication Limitations:**
- Passwords stored securely in system keychain for reference and export purposes
- **IMPORTANT:** Stored passwords are NOT automatically passed to SSH during connection
- Users must manually enter passwords when prompted by SSH in the terminal
- Automatic password passing would require additional tools (e.g., `sshpass`) which introduce security risks
- For automated connections, SSH key authentication is strongly recommended
- Future versions may implement SSH agent integration for improved password handling

## Database Schema
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
    group_path TEXT  -- Semantic hierarchical path (e.g., "Work/Production")
);

CREATE TABLE groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    path TEXT NOT NULL UNIQUE,  -- Semantic hierarchical path
    icon TEXT,
    is_favorite INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE TABLE profile_metadata (
    profile_id TEXT PRIMARY KEY,
    icon TEXT,  -- Always set (default: 'server')
    is_favorite INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE profile_tags (
    profile_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (profile_id, tag_id),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT);
CREATE TABLE active_sessions (id TEXT PRIMARY KEY, profile_id TEXT, tab_id TEXT, started_at TEXT, last_activity_at TEXT);
CREATE TABLE recent_connections (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id TEXT, connected_at TEXT);
CREATE TABLE user_settings (key TEXT PRIMARY KEY, value TEXT);
```

**Important Notes:**
- All profiles automatically receive default metadata on creation (icon='server', is_favorite=false, display_order=0)
- Migration 4 backfills metadata for existing profiles and creates hierarchical group structure
- Groups use semantic paths (e.g., "Work/Production") for hierarchy, max 3 levels deep
- Profile names are unique within parent group only (allows "Server1" in multiple groups)
- Tag names must be unique globally (case-sensitive)

**Database Location:** `~/Library/Application Support/ssh-profile-manager/profiles.db` (macOS)
**Keychain:** System keychain (service: "ssh-profile-manager")

## Dependencies

**Rust:** tauri, rusqlite, serde/serde_json, uuid (fast-rng), keyring, dirs, shellexpand, chrono, rfd, portable-pty, windows-acl (Windows)
**Node:** @tauri-apps/cli, @tauri-apps/api
**Frontend:** xterm.js 5.3.0, xterm-addon-fit 0.8.0 (CDN)

**Known Warnings (Linux-only, does not affect macOS/Windows):**
- `glib` 0.18.5: RUSTSEC-2024-0429 (unsoundness in Iterator impl) - via Tauri GTK3 bindings
- `serial` 0.4.0: RUSTSEC-2017-0008 (unmaintained) - via `portable-pty`
- Multiple GTK3 crates announced unmaintained March 2024 (Tauri migration to GTK4 in progress)

These warnings only affect Linux builds, which are not supported. Application targets macOS (Apple Silicon) and Windows (x86_64) only.

## Quick Reference

**Add Tauri Command:** `#[tauri::command]` in lib.rs → `invoke_handler!` → `invoke('command_name', { params })`
**Add Setting:** Update `SettingsData`/`SettingsOsSpecific` (Rust) + export/import + JS backup/restore/reset
**Add Migration:** See inline docs in `dist/main.js` line ~1920 - use `< 'X.X.X'` pattern for version checks
**Add Icon:** Add to `PROFILE_ICONS` object + update `PROFILE_ICON_VISIBILITY` if should be hidden from picker
**Add Modal:** Call `pushModal('modalId')` on open, `popModal('modalId')` on close, add to `handleModalShortcuts()`
**British English:** All user-facing text (tooltips, labels, notifications) must use British spelling

## Development Agents

Available in `~/.claude/agents/`:
- **code-reviewer**, **refactoring-specialist**, **security-engineer** (release process)
- **rust-engineer**, **performance-engineer**, **debugger** (development)

Usage: `Task(subagent_type='agent-name')`

## Resources

- **GitHub:** https://github.com/tomsinclair94/ssh-profile-manager
- **Tauri Docs:** https://tauri.app/
- **Tasks:** TODO.md
- **Workflow:** DEVELOPMENT.md
- **Changes:** CHANGELOG.md
