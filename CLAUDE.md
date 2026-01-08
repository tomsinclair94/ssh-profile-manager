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

**Version:** 0.6.4-dev (planning)
**Released:** 0.6.3 (2025-01-06)
**See:** TODO.md for active bugs, roadmap, and feature backlog

**Latest Release Notes (v0.6.3):**
- Security hardening: Fixed 6 critical/medium security issues
- Password authentication fix (keyring native features)
- Terminal tab setting for macOS/Windows
- Profile card UI redesign
- Auto-tag workflow fix (PAT_TOKEN)

**Next Release (v0.6.4) - Focus:**
- Fix Windows Terminal tab/window mode issues (HIGH priority)
- Fix auto-close terminal behavior on macOS/Windows (MEDIUM priority)
- Windows icon background fix (MEDIUM priority)
- Address code review items from v0.6.3 (LOW priority)

## Version Management

**CRITICAL: When creating a new dev branch (`vX.X.X-dev`), FIRST update version in ALL 7 locations:**
1. `src-tauri/tauri.conf.json` (line ~4: `"version": "X.X.X"`)
2. `src-tauri/Cargo.toml` (line ~3: `version = "X.X.X"`)
3. `package.json` (line ~3: `"version": "X.X.X"`)
4. `dist/index.html` (line ~22 + ~393: `vX.X.X` and `X.X.X`)
5. `README.md` (line ~14 + ~16: badge versions)

**Then commit:** `git commit -m "Bump version to X.X.X for dev branch"`

## Release Process

**Dev Branch (`vX.X.X-dev`):**
1. **VERSION ALREADY BUMPED** (see Version Management above)
2. Develop features/fixes
3. Code review (`code-reviewer` agent)
4. Refactor (`refactoring-specialist` agent)
5. Security review (`security-engineer` agent)
6. Fix CRITICAL/HIGH/MEDIUM issues
7. Update CHANGELOG.md with all changes
8. Commit & push

**Merge to Main:**
1. PR `vX.X.X-dev` → `main`
2. Squash merge with title: `Release vX.X.X - Description`
3. Auto-tag workflow creates git tag with CHANGELOG content
4. Auto-release workflow builds binaries (macOS aarch64, Windows x86_64)
5. GitHub release published automatically

**Critical:** Commit message MUST start with `Release vX.X.X` for auto-tagging.
**Note:** Auto-tag workflow uses PAT_TOKEN (fixed in v0.6.3) to properly trigger release builds.
**Workflow:** See DEVELOPMENT.md for branch protection rules and PAT_TOKEN setup.

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

## Quick Reference

**Add Tauri Command:** `#[tauri::command]` in lib.rs → `invoke_handler!` → `invoke('command_name', { params })`
**Add Setting:** Update `SettingsData`/`SettingsOsSpecific` (Rust) + export/import + JS backup/restore/reset

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
