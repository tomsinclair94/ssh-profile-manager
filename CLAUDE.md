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

**v0.7.0 Features (In Development - 90% Complete):**
- ✅ Hierarchical group system with sub-groups (up to 3 levels, semantic paths)
- ✅ Individual profile/group export/import with duplicate detection
- ✅ Favourites system for profiles with virtual group display
- ✅ Icon picker with 40+ Lucide icons (inline SVG, CSP-compliant)
- ✅ Tag system with colour-coding, search filtering, and multi-select management
- ✅ Comprehensive keyboard shortcuts (30+ shortcuts with help modal)
- ✅ Settings renamed: Backup/Restore (instead of Export/Import)
- ✅ Enhanced UI polish: tooltips, animations, responsive layouts
- ✅ Encryption for exports (Phase 6 - all sub-phases 6A-6E complete)
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
2. Develop features/fixes (with tests for all new features)
3. **RUN ALL TESTS** before code reviews: `cargo test --lib` (all 106 tests must pass)
4. **DISABLE DEVELOPER TOOLS** before code reviews: `src-tauri/tauri.conf.json` (line ~19: `"devtools": false`)
5. Code review (`voltagent-qa-sec:code-reviewer` agent)
6. Refactor (`voltagent-dev-exp:refactoring-specialist` agent) - optional, skip if not needed
7. Security review (`voltagent-infra:security-engineer` agent)
8. Fix CRITICAL/HIGH/MEDIUM issues
9. **RE-RUN TESTS** after fixes: `cargo test --lib` (ensure no regressions)
10. Update CHANGELOG.md with **user-facing changes only**: new features and bug fixes (exclude minor security tweaks, dependency updates, or internal refactoring to keep changelog focused)
11. Commit & push

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

## Phase Development Workflow

**CRITICAL: Git Commit/Push Policy**
- **NEVER** commit or push changes unless explicitly instructed by the user
- When user requests a commit, follow the standard git workflow in Release Process section
- Always ask for confirmation before committing changes

**Documentation Updates After Phase Completion**
After completing ANY phase or sub-phase (e.g., Phase 6, Phase 6A, Phase 6B), you MUST update ALL relevant documentation:

**Required Updates:**
1. **TODO.md** - Update phase progress tracker with completion status
2. **Version-specific plan** (e.g., `plans/v0.7.0-hierarchical-groups-and-enhanced-organization.md`) - Update overall progress percentage and phase status
3. **Phase-specific plan** (e.g., `plans/v0.7.0-phase-6-encryption.md`) - Mark sub-phase as complete with detailed notes
4. **CLAUDE.md** - Update command signatures if APIs changed (e.g., new parameters)

**Example: Completing Phase 6B (Export Command Integration)**
- ✅ Update TODO.md: Mark Phase 6B complete, list accomplishments
- ✅ Update plans/v0.7.0-hierarchical-groups-and-enhanced-organization.md: Update progress percentage (e.g., 80% → 82%), mark Phase 6B complete
- ✅ Update plans/v0.7.0-phase-6-encryption.md: Add completion date, mark all tasks as done
- ✅ Update CLAUDE.md: Update export command signatures if parameters changed

**Verification Checklist:**
- [ ] All relevant plan files updated?
- [ ] TODO.md reflects current status?
- [ ] CLAUDE.md updated if APIs changed?
- [ ] User explicitly requested commit/push?

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
export_profile(profile_id: String, include_password: bool, encryption_password: Option<String>) // Individual profile export (v0.7.0, encryption added Phase 6B)
import_profile(data: String, encryption_password: Option<String>) // With duplicate detection (v0.7.0, decryption added Phase 6C)
```

**Group Management (v0.7.0):**
```rust
get_groups() // Returns Vec<Group>
get_group_tree() // Hierarchical structure
create_group(name: String, parent_id: Option<String>)
update_group(id: String, name: String)
delete_group(id: String, mode: String) // "cascade" or "move"
move_group(id: String, new_parent_id: Option<String>)
export_group(group_id: String, include_passwords: bool, encryption_password: Option<String>) // Recursive with sub-groups (encryption added Phase 6B)
import_group(data: String, target_parent_id: Option<String>, encryption_password: Option<String>) // Decryption added Phase 6C
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
export_profiles(include_passwords: bool, encryption_password: Option<String>) // All profiles (now called "Export All Profiles", encryption added Phase 6B)
import_profiles(data: String, encryption_password: Option<String>) // With conflict resolution (decryption added Phase 6C)
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

**Export Encryption (v0.7.0 - Phase 6 - ✅ Complete):**
- AES-256-GCM authenticated encryption for exports
- PBKDF2-HMAC-SHA256 key derivation (600k iterations - OWASP 2023)
- Additional HMAC-SHA256 integrity verification (fail-fast)
- Mandatory encryption when password-authenticated profiles included
- Password requirements: 12–128 characters (character count, not byte count; enforced front- and back-end)
- Zeroization: Passwords/keys cleared from memory after use
- Random salt (16 bytes) and IV (12 bytes) per export
- Constant-time HMAC comparison prevents timing attacks
- Strength meter: 5-level scale (Weak / Fair / Good / Strong / Stronger), non-enforcing
- WKWebView-compatible spinner: Fixed negative margins instead of transform-based centering

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

## Testing

### Test Structure

All backend tests are located in `src-tauri/src/tests/` with a modular structure (refactored from monolithic to separate modules for maintainability):

```
src-tauri/src/tests/
├── helpers.rs        # Shared test utilities
├── encryption.rs     # 38 tests - AES-256-GCM encryption
├── validation.rs     # 27 tests - Input validation
├── profiles.rs       # 11 tests - Profile CRUD
├── groups.rs         #  8 tests - Hierarchical groups
├── tags.rs           #  9 tests - Tag system
├── connections.rs    #  5 tests - Recent connections
├── settings.rs       #  3 tests - User settings
└── migrations.rs     #  5 tests - Schema migrations

Total: 106 tests (all must pass before release)
```

**Test declaration in lib.rs:**
```rust
#[cfg(test)]
mod tests {
    mod helpers;      // Shared utilities
    mod encryption;   // Individual test modules
    mod validation;
    // ... etc
}
```

### Test Helpers (helpers.rs)

**Shared test utilities used across all test modules:**

- `create_test_db() -> Database` - Creates in-memory SQLite database with full schema
- `make_test_profile(name, group_path) -> Profile` - Profile factory with defaults
- `make_test_group(name, parent_id, path) -> Group` - Group factory
- `make_test_tag(name, color) -> Tag` - Tag factory

**Pattern:** All tests use in-memory databases for isolation (no shared state between tests)

### Running Tests

```bash
cd src-tauri

# Run all tests (required before every release)
cargo test --lib

# Run specific module
cargo test --lib tests::encryption
cargo test --lib tests::profiles

# Run specific test
cargo test --lib test_create_profile_success

# Run with output
cargo test --lib -- --nocapture

# Coverage analysis (requires cargo-llvm-cov)
cargo llvm-cov --lib --open
```

**Expected result:** `106 passed; 0 failed` in ~27 seconds

### Writing Tests for New Features

**CRITICAL: All new features MUST include tests before merging to main.**

**1. Choose the appropriate test module:**
- Profile operations → `tests/profiles.rs`
- Group operations → `tests/groups.rs`
- Validation → `tests/validation.rs`
- New feature domain → Create new module (e.g., `tests/new_feature.rs`)

**2. Follow existing patterns:**

```rust
// In tests/your_module.rs
use super::helpers::*;  // Import test utilities
use crate::X;           // Import lib.rs functions

#[test]
fn test_feature_success() {
    let db = create_test_db();
    let profile = make_test_profile("Test", None);

    // Test implementation
    assert!(db.your_function(&profile).is_ok());
}

#[test]
fn test_feature_validation_fails() {
    // Test failure case
    assert!(validate_input("").is_err());
}
```

**3. Test both success and failure paths:**
- Happy path (valid input, successful operation)
- Edge cases (empty, max length, boundary values)
- Validation failures (invalid input, missing data)
- Error conditions (not found, conflicts, cascades)

**4. Descriptive test names:**
- `test_create_profile_success` ✅
- `test_create_profile_duplicate_in_same_group` ✅
- `test_delete_group_cascade_deletes_children` ✅
- `test1` ❌

**5. If creating a new test module:**

```rust
// In lib.rs #[cfg(test)] mod tests block:
mod your_new_module;  // Add declaration

// Create src-tauri/src/tests/your_new_module.rs
use super::helpers::*;

#[test]
fn test_something() {
    // Your tests
}
```

**6. Verify tests pass:**
```bash
cargo test --lib
```

### Coverage Goals

- **60%+ coverage** on critical functions (Tauri commands, DB operations, validation)
- **All Tauri commands** should have at least basic success/failure tests
- **Security-critical code** (encryption, validation) requires comprehensive tests

### Test Philosophy

- **Fast:** In-memory databases, no I/O, no network (~27s for 106 tests)
- **Isolated:** Each test uses fresh database (no shared state)
- **Deterministic:** No flaky tests, no time-based tests, no randomness in assertions
- **Readable:** Clear test names, focused assertions, minimal setup

### Pre-Release Testing Checklist

Before creating a release PR:

- [ ] Run `cargo test --lib` → All 106 tests pass
- [ ] New features have corresponding tests
- [ ] Tests run in <30 seconds (performance check)
- [ ] No warnings from test compilation
- [ ] CI/CD tests pass on both macOS and Windows

## Quick Reference

**Add Tauri Command:** `#[tauri::command]` in lib.rs → `invoke_handler!` → `invoke('command_name', { params })` → **Write tests!**
**Add Setting:** Update `SettingsData`/`SettingsOsSpecific` (Rust) + export/import + JS backup/restore/reset
**Add Migration:** See inline docs in `dist/main.js` line ~1920 - use `< 'X.X.X'` pattern for version checks
**Add Icon:** Add to `PROFILE_ICONS` object + update `PROFILE_ICON_VISIBILITY` if should be hidden from picker
**Add Modal:** Call `pushModal('modalId')` on open, `popModal('modalId')` on close, add to `handleModalShortcuts()`
**Add Test:** Create in appropriate `src-tauri/src/tests/*.rs` module, use helpers, test success + failure, run `cargo test --lib`
**British English:** All user-facing text (tooltips, labels, notifications) must use British spelling

## Development Agents

Specialized agents for code quality, security, and development tasks:

**Testing & QA (Phase 8):**
- `voltagent-qa-sec:test-automator` - Design and implement automated test frameworks (Phase 8A)
- `voltagent-qa-sec:code-reviewer` - Code quality, design patterns, best practices (Phase 8B)
- `voltagent-infra:security-engineer` - Security audit, vulnerability assessment (Phase 8B)

**Development Support:**
- `voltagent-lang:rust-engineer` - Rust-specific development and optimization
- `voltagent-qa-sec:performance-engineer` - Performance testing and optimization
- `voltagent-qa-sec:debugger` - Complex issue diagnosis and troubleshooting
- `voltagent-qa-sec:qa-expert` - QA strategy, test planning, quality metrics

**Future (v1.0.0):**
- `voltagent-dev-exp:refactoring-specialist` - Code complexity reduction (40-50% target)

**Usage:** `Task(subagent_type='voltagent-qa-sec:test-automator', prompt='...')`

## Resources

- **GitHub:** https://github.com/tomsinclair94/ssh-profile-manager
- **Tauri Docs:** https://tauri.app/
- **Tasks:** TODO.md
- **Workflow:** DEVELOPMENT.md
- **Changes:** CHANGELOG.md
