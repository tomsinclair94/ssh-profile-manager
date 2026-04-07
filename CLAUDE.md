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

**Latest Release:** v0.9.1 (2026-04-07) ✅
**Next:** v0.10.0 (planned features TBD)

**v0.9.1 Fixes (Released - 2026-04-07):**
- ✅ Windows SSH password auth — replaced temp `.bat` askpass script with bundled `spm-askpass.exe` helper (fixes Access Denied error)
- ✅ Update available modal — current/new version numbers shown on separate lines
- ✅ "What's New" splash — now shows all versions skipped since last update (multi-version upgrade support)
- ✅ Dependencies — rand 0.8 → 0.10, rusqlite 0.32 → 0.39; GitHub Actions updated
- ✅ 163 automated tests; 0 CRITICAL/HIGH after security review

**v0.9.0 Features (Released - 2026-04-05):**
- ✅ SSH_ASKPASS Infrastructure — passwords passed automatically via `SSH_ASKPASS` + `SSH_ASKPASS_REQUIRE=force`
- ✅ Central Passwords Backend — migration 5, structs, DB methods, 7 Tauri commands
- ✅ Export/Import — `central_password_ref` field on all export/import paths
- ✅ Central Passwords Manager UI — key-icon toolbar button, modal, form-based edit mode, bulk select/delete with checkboxes, `P` shortcut
- ✅ Profile Modal Updates — `central_password` option in auth dropdown, searchable CP picker, save/load/duplicate/validate
- ✅ 163 automated tests; functional GUI + migration testing complete; 0 CRITICAL/HIGH after review

**v0.8.0 Features (Released - 2026-02-27):**
- ✅ macOS "open in new tab" — surfaces actionable error when Terminal automation is blocked
- ✅ Move Profile & Move Group — modal + backend (`move_profile` command, shared move modal, menu items)
- ✅ Padlock button (session-only) — toolbar toggle for drag reordering; resets to locked on app relaunch
- ✅ Drag profile between groups — drop onto group headers or directly to a position within a group; 5s undo toast
- ✅ Custom sort order — drag-to-reorder profiles/groups; cross-group drag+position; "Reset to A-Z"; global reset
- ✅ Expand Card Actions setting — optional 6-button layout per profile card
- ✅ 142 automated tests; macOS manual GUI tests (144/144 passed); 0 CRITICAL/HIGH after review

**v0.7.1 Fixes (Released - 2026-02-20):**
- ✅ Parent Group dropdown no longer flickers and disappears when opened
- ✅ Group modal no longer gets stuck at an expanded size after closing
- ✅ "What's New" splash screen no longer reappears on app reload
- ✅ Compact view: improved card layout for standard and favourite profile cards

**v0.7.0 Features (Released - 2026-02-19):**
- ✅ Hierarchical group system with sub-groups (up to 3 levels, semantic paths)
- ✅ Individual profile/group export/import with duplicate detection
- ✅ Favourites system for profiles with virtual group display
- ✅ Icon picker with 40+ Lucide icons (inline SVG, CSP-compliant)
- ✅ Tag system with colour-coding, search filtering, and multi-select management
- ✅ Comprehensive keyboard shortcuts (30+ shortcuts with help modal)
- ✅ Settings renamed: Backup/Restore (instead of Export/Import)
- ✅ Enhanced UI polish: tooltips, animations, responsive layouts
- ✅ Encrypted exports with AES-256-GCM and PBKDF2 key derivation
- ✅ 135 automated tests; comprehensive manual GUI and migration testing

## Branch Naming Conventions

| Branch pattern | Purpose | Example |
|---|---|---|
| `vX.Y.Z-dev` | Feature or patch release development | `v0.8.0-dev`, `v0.7.1-dev` |
| `docs/description` | Documentation-only changes (no code) | `docs/versioning-policy` |

**Doc-only branches** (`docs/*`) skip the security audit and build checks automatically via path filtering — no need to wait for CI before merging.

**Release branches** (`vX.Y.Z-dev`) follow the full release process in the Release Process section below.

## Versioning Policy

**Pre-v1.0.0 release strategy:**

- **Feature releases** (`vX.Y.0`) — new features, shipped when ready; order and timing are flexible
- **Patch releases** (`vX.Y.1`) — bug fixes against the most recent feature release only; issued as needed
- **v1.0.0** — major stable release after a full refactoring sprint; no patch releases planned before this point
- Feature plans are **not locked to a version number** until development begins on that branch
- See `plans/feature-*.md` for feature plans that may ship in any future `vX.Y.0` release

## Version Management

**CRITICAL: When creating a new dev branch (`vX.X.X-dev`), follow these steps:**

**Step 1: Bump version in ALL locations:**
1. `src-tauri/tauri.conf.json` (line ~4: `"version": "X.X.X"`)
2. `src-tauri/Cargo.toml` (line ~3: `version = "X.X.X"`)
3. `package.json` (line ~3: `"version": "X.X.X"`)
4. `dist/index.html` (line ~22 + ~393: `vX.X.X` and `X.X.X`)
5. `README.md` (line ~14 + ~16: badge versions)
6. `dist/main.js` (line ~56: `CURRENT_APP_VERSION = 'X.X.X'`)
7. `dist/main.js` (line ~59-72: Add new `VERSION_CHANGELOG` entry — placeholder highlights are fine at this stage; finalize during the documentation step before release)

**Step 2: Enable Developer Tools:**
`src-tauri/tauri.conf.json` (line ~19: `"devtools": true`)

**Step 3: Update dependencies:**
```bash
bun update
cd src-tauri && cargo update && cd ..
bun run build  # Verify builds work
```

**Step 4: Commit:**
```bash
git add -A
git commit -m "Bump version to X.X.X for dev branch"
```

## Release Process

**Dev Branch (`vX.X.X-dev`):**
1. **VERSION ALREADY BUMPED** (see Version Management above)
2. Develop features/fixes (with tests for all new features)
3. **RUN ALL AUTOMATED TESTS** before code reviews: `cargo test --lib` (all 163 tests must pass)
4. **DISABLE DEVELOPER TOOLS** before code reviews: `src-tauri/tauri.conf.json` (line ~19: `"devtools": false`)
5. Code review (`voltagent-qa-sec:code-reviewer` agent)
6. Refactor (`voltagent-dev-exp:refactoring-specialist` agent) - optional, skip if not needed
7. Security review (`voltagent-infra:security-engineer` agent)
8. Fix CRITICAL/HIGH/MEDIUM issues
9. **RE-RUN AUTOMATED TESTS** after fixes: `cargo test --lib` (ensure no regressions)
10. **RUN MANUAL GUI TESTS**: Copy template from `plans/templates/manual-gui-test-plan-template.md` to `plans/test-results/vX.X.X-test-results.md` and complete all tests (macOS + Windows, ~3-4 hours total)
11. Fix any GUI bugs found during manual testing
12. **RUN MIGRATION TESTS** (if database migrations present): Open version-specific plan `plans/vX.X.X-migration-testing.md` and complete all migration validation tests (~1.5 hours total)
13. Fix any migration issues found during testing
14. Update **both changelogs**:
    - `CHANGELOG.md` — full user-facing entry (Added/Changed/Fixed/Security); exclude internal refactoring, dependency updates, minor security tweaks
    - `dist/main.js` `VERSION_CHANGELOG` — 5–7 high-level highlights for the in-app splash screen; pull the key points from CHANGELOG.md
15. **Review and update all documentation** to reflect the new version:
    - `CLAUDE.md` — Update "Current Status" section with the new version, features/fixes, and test count if changed
    - `TODO.md` — Update "Current Version", roadmap line, and move the release to "Archive"
    - `SECURITY.md` — Add a new entry to the Security Review History
    - `DEVELOPMENT.md` — Update any version-specific references in the pre-release checklist
    - Verify `README.md` version badges are correct (usually handled by version bump step)
16. Commit & push

**Merge to Main:**
1. PR `vX.X.X-dev` → `main` with auto-merge enabled
   - Create PR: `gh pr create --title "..." --body "..." --label "LABEL"`
   - Labels: `bug` (patch/bug-fix release), `enhancement` (feature release), `documentation` (docs-only)
   - Enable auto-merge: `gh pr merge <PR_NUMBER> --auto --squash`
2. Squash merge with title: `Release vX.X.X - Description`
3. Auto-tag workflow creates git tag with CHANGELOG content
4. Auto-release workflow builds binaries (macOS aarch64, Windows x86_64)
5. GitHub release published automatically

**Critical:** Commit message MUST start with `Release vX.X.X` for auto-tagging.
**Workflow:** See DEVELOPMENT.md for branch protection rules and PAT_TOKEN setup.

## Phase Development Workflow

**CRITICAL: Git Commit/Push Policy**
- **NEVER** commit or push changes unless explicitly instructed by the user
- When user requests a commit, follow the standard git workflow in Release Process section
- Always ask for confirmation before committing changes

**Documentation Updates After Phase Completion**
After completing ANY phase or sub-phase, update ALL relevant documentation:

**Required Updates:**
1. **TODO.md** - Update phase progress tracker with completion status
2. **Version-specific plan** (e.g., `plans/v0.8.0-feature-name.md`) - Update overall progress and phase status
3. **CLAUDE.md** - Update command signatures if APIs changed (e.g., new parameters)

## Dependabot Dependency Updates

**Automatic Handling:**
- Dependabot PRs automatically have auto-merge enabled via GitHub Actions workflow
- PRs auto-merge with squash once all checks pass (security audit, build verification)
- No manual intervention needed for dependency updates

**How it works:**
- Updates dependencies on `main` branch between releases
- Does NOT trigger new releases (no version bump or git tag)
- Next dev branch inherits updates when branched from `main`

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
export_profile(profile_id: String, include_password: bool, encryption_password: Option<String>)
import_profile(data: String, encryption_password: Option<String>)
```

**Group Management (v0.7.0):**
```rust
get_groups() // Returns Vec<Group>
get_group_tree() // Hierarchical structure
create_group(name: String, parent_id: Option<String>)
update_group(id: String, name: String)
delete_group(id: String, mode: String) // "cascade" or "move"
move_group(id: String, new_parent_id: Option<String>)
move_profile(profile_id: String, new_group_path: Option<String>) // None = ungrouped
reorder_profiles(orders: Vec<{profile_id: String, display_order: i32}>) // v0.8.0+
reorder_groups(orders: Vec<{group_id: String, display_order: i32}>)     // v0.8.0+
export_group(group_id: String, include_passwords: bool, encryption_password: Option<String>)
import_group(data: String, target_parent_id: Option<String>, encryption_password: Option<String>)
get_profiles_by_group_path(group_path: String)
```

**Metadata & Favourites (v0.7.0):**
```rust
toggle_profile_favorite(profile_id: String)
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

**Central Passwords (v0.9.0):**
```rust
get_central_passwords() // Returns Vec<CentralPassword>
create_central_password(input: CreateCentralPasswordInput) // name + description + password; stores in keychain as "central-{id}"; returns new id
update_central_password(input: UpdateCentralPasswordInput) // name + description only
update_central_password_value(central_password_id: String, password: String) // updates keychain entry
get_central_password_value(central_password_id: String) // retrieves from keychain (show button)
delete_central_password(central_password_id: String) // reverts linked profiles → removes keychain → deletes row; returns revert count
get_profiles_using_central_password(central_password_id: String) // Returns Vec<String> of profile names
```

**Settings & Export/Import:**
```rust
export_profiles(include_passwords: bool, encryption_password: Option<String>)
import_profiles(data: String, encryption_password: Option<String>)
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

**Security:**
- Backend validation: XSS, command injection, path traversal
- Custom confirm() for Tauri
- Double-submit prevention: `isSubmitting` flag
- CSP-compliant: All styles applied via JavaScript (no inline `style=""` attributes)
- Tag/group name validation: Alphanumeric + limited special chars only
- localStorage: Group IDs (not names) for filter/collapse state

**Export Encryption (v0.7.0):**
- AES-256-GCM authenticated encryption for exports
- PBKDF2-HMAC-SHA256 key derivation (600k iterations - OWASP 2023)
- Additional HMAC-SHA256 integrity verification (fail-fast)
- Mandatory encryption when password-authenticated profiles included
- Password requirements: 12–128 characters (enforced front- and back-end)
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
- Version splash screen shows all versions skipped since `lastSplashVersion` (multi-version upgrade support); always includes current version so manual opens via the version link are never blank

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

**Password Authentication (v0.9.0+):**
- Passwords stored securely in system keychain
- Passed automatically to SSH via `SSH_ASKPASS` + `SSH_ASKPASS_REQUIRE=force` — no manual entry required
- `connect_ssh` creates a temp password file (`0600`) + askpass script (`0700`); both securely deleted after 10s
- Injection strategy varies by terminal: inline env vars (macOS default, cmd, PowerShell), script prepend (macOS custom, Windows custom), temp `.bat` + `cmd /c` (Windows Terminal, Windows default wt path)
- If no password stored, a clear error toast is shown directing the user to edit the profile
- Central Passwords (shared credentials for multiple profiles) — backend complete (Phase 2), UI complete (Phase 4)
- Central Passwords manager: key-icon toolbar button + `P` shortcut; modal with create/edit form at top (Edit populates form, fetches password), list with Show/Edit/Delete actions, bulk select/delete with checkboxes
- SSH key authentication remains recommended for automated/scripted connections

## Database Schema
```sql
CREATE TABLE profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    username TEXT NOT NULL,
    auth_method TEXT NOT NULL DEFAULT 'key',  -- "key", "password", "central_password", or "none"
    key_path TEXT,
    group_path TEXT,  -- Semantic hierarchical path (e.g., "Work/Production")
    central_password_id TEXT  -- v0.9.0+: FK to central_passwords.id (no ON DELETE constraint)
);

CREATE TABLE central_passwords (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
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
- Migration 5 adds `central_passwords` table and `central_password_id` column to `profiles` (schema version 5)
- Groups use semantic paths (e.g., "Work/Production") for hierarchy, max 3 levels deep
- Profile names are unique within parent group only (allows "Server1" in multiple groups)
- Tag names must be unique globally (case-sensitive)
- Central password keychain key format: `"central-{uuid}"` (same service `"ssh-profile-manager"`, distinct from profile keys)
- Deletion of a central password reverts all linked profiles to `auth_method='none'` (keyboard-interactive)

**Database Location:** `~/Library/Application Support/ssh-profile-manager/profiles.db` (macOS)
**Keychain:** System keychain (service: "ssh-profile-manager")

## Dependencies

**Rust:** tauri, rusqlite, serde/serde_json, uuid (fast-rng), keyring, dirs, shellexpand, chrono, rfd, portable-pty, windows-acl (Windows)
**Node:** @tauri-apps/cli, @tauri-apps/api
**Frontend:** xterm.js 5.3.0, xterm-addon-fit 0.8.0 (vendored locally)

**Known Warnings (Linux-only, does not affect macOS/Windows):**
- `glib` 0.18.5: RUSTSEC-2024-0429 (unsoundness in Iterator impl) - via Tauri GTK3 bindings
- `serial` 0.4.0: RUSTSEC-2017-0008 (unmaintained) - via `portable-pty`
- Multiple GTK3 crates announced unmaintained March 2024 (Tauri migration to GTK4 in progress)

These warnings only affect Linux builds, which are not supported. Application targets macOS (Apple Silicon) and Windows (x86_64) only.

## Testing

### Test Structure

All backend tests are located in `src-tauri/src/tests/` with a modular structure:

```
src-tauri/src/tests/
├── helpers.rs        # Shared test utilities
├── encryption.rs          # 38 tests - AES-256-GCM encryption
├── validation.rs          # 27 tests - Input validation
├── profiles.rs            # 17 tests - Profile CRUD + move + reorder + CP linkage
├── groups.rs              # 11 tests - Hierarchical groups + move + reorder
├── tags.rs                #  9 tests - Tag system
├── connections.rs         #  5 tests - Recent connections
├── settings.rs            #  3 tests - User settings
├── migrations.rs          #  6 tests - Schema migrations (incl. migration 5)
├── central_passwords.rs   # 17 tests - Central passwords DB layer (v0.9.0)
└── integration.rs         # 24 tests - Multi-step workflows (incl. 2 CP workflows)

Total: 163 tests (all must pass before release)
```

**Integration tests (integration.rs):** 24 comprehensive tests validating multi-step workflows including export/import round-trips, group operations (rename/move cascades), duplicate detection, tag auto-creation, full backup/restore, central password lifecycle, and performance benchmarks. These catch issues in transaction boundaries, cascading updates, and command orchestration that unit tests miss.

**Test helpers (helpers.rs):** Shared utilities (`create_test_db()`, `make_test_profile()`, `make_test_group()`, `make_test_tag()`) used across all test modules. All tests use in-memory databases for isolation.

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

**Expected result:** `142 passed; 0 failed` in ~41 seconds

### Writing Tests for New Features

**CRITICAL: All new features MUST include tests before merging to main.**

1. **Choose appropriate test module:** Profile operations → `tests/profiles.rs`, Group operations → `tests/groups.rs`, etc.
2. **Follow existing patterns:** Use `create_test_db()`, `make_test_*()` helpers
3. **Test both success and failure paths:** Happy path, edge cases, validation failures, error conditions
4. **Descriptive test names:** `test_create_profile_success` ✅, `test1` ❌
5. **If creating new module:** Add declaration in `lib.rs` #[cfg(test)] mod tests block
6. **Verify tests pass:** `cargo test --lib`
7. **Test comment guidelines:** NO phase-specific references, NO test numbering, NO issue references. Keep comments generic and high-level.

**Example:**
```rust
use super::helpers::*;
use crate::X;

#[test]
fn test_feature_success() {
    let db = create_test_db();
    let profile = make_test_profile("Test", None);
    assert!(db.your_function(&profile).is_ok());
}
```

### Test Philosophy

- **Fast:** In-memory databases, no I/O, no network (~41s for 163 tests)
- **Isolated:** Each test uses fresh database (no shared state)
- **Deterministic:** No flaky tests, no time-based tests, no randomness in assertions
- **Comprehensive:** Unit tests + 22 integration tests covering all backend logic

### Pre-Release Testing Checklist

Before creating a release PR:

**Automated Tests:**
- [ ] Run `cargo test --lib` → All 163 tests pass
- [ ] New features have corresponding automated tests
- [ ] Tests run in <45 seconds
- [ ] No warnings from test compilation
- [ ] CI/CD tests pass on both macOS and Windows

**Manual GUI Tests:**
- [ ] Copy template: `cp plans/templates/manual-gui-test-plan-template.md plans/test-results/vX.X.X-test-results.md`
- [ ] Complete macOS testing section (~2-3 hours)
- [ ] Complete Windows testing section (~45 minutes)
- [ ] Document test results (fill in summary, issues fixed, observations)
- [ ] Log any failed tests as GitHub issues
- [ ] Verify no console errors during testing
- [ ] Commit completed test results file

**Migration Tests** (if database migrations present):
- [ ] Open version-specific migration plan: `plans/vX.X.X-migration-testing.md`
- [ ] Create v[PREVIOUS_VERSION] test database with minimal realistic data
- [ ] Export JSON backup (recommended user method)
- [ ] Run migration to v[NEW_VERSION], monitor console for errors
- [ ] Validate 100% data integrity (zero profiles lost)
- [ ] Test new features with migrated data
- [ ] Document migration results in plan file
- [ ] Update plan status to "✅ Complete"
- [ ] Commit completed migration plan

## Manual GUI Testing

**Template:** `plans/templates/manual-gui-test-plan-template.md`
**Results:** `plans/test-results/vX.X.X-test-results.md`

**Purpose:** Comprehensive manual testing of all GUI/frontend functionality before each major release.

**When to Run:** After all automated tests pass and before creating release PR (step 10 in Release Process).

**What's Tested:** Profile management UI, group management UI, tag management UI, export/import workflows, connection management, settings UI, keyboard navigation (30+ shortcuts), visual & layout testing, platform-specific behaviors.

**How to Use:** Copy template to test-results, create test data per checklist, complete macOS testing (~2-3 hours), complete Windows testing (~45 minutes), document results, log issues, commit completed results.

**Test Results Storage:**
- **Template:** `plans/templates/manual-gui-test-plan-template.md` (never modified, always blank)
- **Completed Results:** `plans/test-results/vX.X.X-test-results.md` (one per release)
- **Version Prefix:** Use `vX.X.X-` prefix for chronological sorting

## Migration Testing

**Guidelines:** `plans/templates/migration-testing-guidelines.md`
**Version-Specific Plans:** `plans/vX.X.X-migration-testing.md`

**Purpose:** Validate database and frontend migrations when upgrading between versions.

**When to Run:** After all automated and GUI tests pass, before creating release PR (step 12 in Release Process).

**Approach:** Unlike GUI testing (same features across versions), migration testing is **version-specific**. Each upgrade has different schema changes, data transformations, and new features.

**Two-Part System:**
1. **Guidelines:** Reusable checklist and procedures for all migrations
2. **Version-Specific Plan:** Detailed test plan for specific version upgrade (e.g., `plans/v0.7.0-migration-testing.md`)

**What's Tested:** Database schema migrations, data integrity (zero data loss requirement), frontend localStorage migrations, new features work with migrated data, JSON export/import validation (recommended user backup method).

**Test Duration:** ~1.5 hours total (20min setup, 5min migration, 20min data validation, 30min feature validation, 15min documentation)

**Success Criteria:**
- Migration completes without errors (no console warnings/errors)
- 100% data integrity (zero profiles lost, all groups preserved)
- All user settings preserved
- Keychain entries intact (password-auth profiles)
- New features work correctly with migrated data
- Migration time <30 seconds

**Migration Testing Notes:**
- **Backup via Export:** Always recommend users export profiles (JSON) before upgrading, NOT database file backups
- **No Backward Compatibility:** Users cannot downgrade to previous versions with a migrated database
- **Zero Data Loss:** Any data loss (even 1 profile) is a CRITICAL blocker requiring investigation
- **Minimal Test Data:** Use minimal realistic data (e.g., 4 profiles, 3 groups) - not extreme datasets
- **Version-Specific:** Each migration is unique - don't assume the same tests apply across versions

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

**Testing & QA:**
- `voltagent-qa-sec:test-automator` - Design and implement automated test frameworks
- `voltagent-qa-sec:code-reviewer` - Code quality, design patterns, best practices
- `voltagent-infra:security-engineer` - Security audit, vulnerability assessment

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
