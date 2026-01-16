# SSH Profile Manager - Development Guide

## Project Overview
Lightweight, cross-platform SSH profile manager built with Tauri v2. Modern GUI alternative to terminal SSH clients.

**Bundle Size:** ~3-5MB | **Platforms:** macOS (Apple Silicon), Windows
**Tech Stack:** Vanilla JS/HTML/CSS frontend, Rust backend, SQLite database, system keychain

## Quick Start

```bash
bun run dev      # Development with hot reload
bun run build    # Production build
```

**Files:** `dist/` (frontend) | `src-tauri/` (Rust backend)

## Current Status

**In Development:** v0.7.0
**See:** TODO.md for roadmap and feature backlog

**v0.7.0 Focus:**
- Hierarchical group system with sub-groups (up to 3 levels)
- Separate group management with Add, Rename, Delete options
- Enhanced group filter with hierarchical display
- Improved keyboard navigation with arrow key support
- Version splash screen for major release announcements
- Migration system documentation

## Version Management

**CRITICAL: When creating a new dev branch (`vX.X.X-dev`), follow these steps:**

**Step 1: Bump version in ALL 7 locations:**
1. `src-tauri/tauri.conf.json` (line ~4: `"version": "X.X.X"`)
2. `src-tauri/Cargo.toml` (line ~3: `version = "X.X.X"`)
3. `package.json` (line ~3: `"version": "X.X.X"`)
4. `dist/index.html` (line ~22 + ~393: `vX.X.X` and `X.X.X`)
5. `README.md` (line ~14 + ~16: badge versions)

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
```rust
get_profiles(), create_profile(), update_profile(), delete_profile()
export_profiles(), import_profiles(data)
export_settings(), import_settings(data)  // OS-specific filtering
browse_ssh_key(), browse_terminal_app()
connect_ssh(profileId, terminalPreference, customTerminalPath)
check_for_updates()
record_connection(profileId), get_recent_connections(), clear_recent_connections()
create_terminal_session(profileId), write_to_session(), resize_session(), close_session()
```

### Critical Patterns

**Confirmation Dialogs:**
- Action verbs (Delete/Import/Reset), not Yes/No
- Secondary button: "Cancel"
- Classes: `btn-danger` (destructive), `btn-primary` (safe)

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

**Security:**
- Backend validation: XSS, command injection, path traversal
- Custom confirm() for Tauri
- Double-submit prevention: `isSubmitting` flag
- Collapsible groups: localStorage

**Migration System:**
- Automatic version detection using `CURRENT_APP_VERSION` constant
- Generic storage keys: `migrationVersion`, `migrationToastShown`, `lastSplashVersion`
- Version-specific migrations use "less than" checks (handles skipped versions)
- Two-phase: `checkAndPerformMigration()` (early, before data load) + `performPostLoadMigration()` (optional, for UI updates)
- See detailed inline documentation in `dist/main.js` around line ~1920 for adding new migrations
- Version splash screen automatically shows changelog on version changes

**Password Authentication Limitations:**
- Passwords are stored securely in the system keychain for reference and export purposes
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
    group_name TEXT
);

CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT);
CREATE TABLE active_sessions (id TEXT PRIMARY KEY, profile_id TEXT, created_at TEXT);
CREATE TABLE recent_connections (profile_id TEXT PRIMARY KEY, last_connected_at TEXT);
CREATE TABLE user_settings (key TEXT PRIMARY KEY, value TEXT);
```

**Location:** `~/Library/Application Support/ssh-profile-manager/profiles.db`
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
