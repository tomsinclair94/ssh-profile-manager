# Changelog

All notable changes to SSH Profile Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.3] - 2026-05-23

### Fixed
- **SSH key auth failure toast** — if SSH exits non-zero when using key authentication (key rejected or not authorised on the server), the app restores from minimised and shows a clear error toast naming the profile and directing the user to check the key path
- **No-auth / keyboard-interactive failure toast** — if the server closes the connection after too many failed keyboard-interactive attempts, a clear error toast is shown
- **Windows password file security** — `create_file_windows_secure` now creates the file empty before applying `icacls` restrictions, then writes content; eliminates the brief window where file content was world-readable before the ACL was applied

### Changed
- **"What's New" splash screen** — previously-seen versions within the current minor series are now shown collapsed (expandable via `<details>`/`<summary>`) rather than fully expanded; unseen versions remain expanded; versions from a different minor series remain hidden; manual "What's New" views always show only the current version expanded

## [0.9.2] - 2026-04-12

### Fixed
- **Windows SSH password authentication (CMD)** — incorrect Windows ACL setup created a DENY entry that locked the current user out of their own temp files, including the database file on first launch; fixed by correctly setting `icacls` inheritance and explicit user grants
- **Windows SSH password authentication (CMD)** — `SSH_ASKPASS` env vars were silently dropped when passed as inline compounds through the `cmd → start → cmd` launch chain; replaced with a temp bat file that sets variables directly in the correct process
- **Windows SSH password authentication (PowerShell)** — `| Out-Null` appended to the SSH invocation was piping stdout to nothing and preventing PTY allocation; SSH appeared to launch but produced no visible output or response
- **SSH askpass helper (all platforms)** — upgraded to a file-existence state machine: delivers the stored password on the first call, fails fast on password-retry prompts to prevent silent retry loops, and relays non-password prompts (proxy 2FA challenges, reason fields) to the terminal for interactive input
- **In-app SSH authentication failure toast (Windows + macOS)** — when SSH exits with a non-zero code (e.g. wrong password), the app now restores from minimised, shows a clear error toast naming the affected profile, and directs the user to edit it; previously the terminal closed silently with no feedback in the app

### Changed
- **Windows terminal selector** — removed the generic "Default" option; Windows Terminal is now shown explicitly as the first and default option (pre-installed on Windows 11 since 22H2, October 2022); existing users with "Default" are automatically migrated to "Windows Terminal" on first launch
- **macOS terminal selector** — renamed "Default (Terminal.app)" to "Terminal" for consistency with Windows naming; existing users with "Default" are automatically migrated to "Terminal" on first launch

## [0.9.1] - 2026-04-07

### Fixed
- **Windows SSH password authentication** — SSH could not invoke the `.bat` askpass script (`CreateProcess` returns `ERROR_ACCESS_DENIED`); replaced the per-connection temp `.bat` file with a bundled `spm-askpass.exe` helper that SSH can execute directly
- **Update available notification** — current and new version numbers are now shown on separate lines with clear labels; previously crammed onto one line

### Changed
- **"What's New" splash screen** now shows all versions skipped since the last update; users upgrading across multiple versions (e.g. v0.8.0 → v0.9.1) see a combined view with each version's highlights in clearly labelled sections
- Updated rand `0.8 → 0.10` and rusqlite `0.32 → 0.39` to latest stable versions
- Updated GitHub Actions workflows (`actions/checkout@v4 → v5`) to address Node.js 20 deprecation on runners

## [0.9.0] - 2026-04-05

### Added
- **Central Passwords Manager** — shared credentials that can be linked to multiple profiles; change the password once and all linked profiles immediately use the new value (ideal for AD accounts and shared jump hosts)
- **Central Password auth method** — new "Central Password" option in the profile auth method dropdown; a searchable picker lets you select which central password to use
- **"Manage Central Passwords" link** — opens the Central Password Manager directly from the profile editor without losing your place
- **SSH_ASKPASS integration** — passwords stored in the system keychain are now passed to SSH automatically via `SSH_ASKPASS` + `SSH_ASKPASS_REQUIRE=force`; no interactive password prompt appears in the terminal
- **Central password export/import** — exports include a `central_password_ref` field (the central password name, never the value); on import, profiles are re-linked by name, or an empty shell is created if the name is not found on the destination machine
- **Bulk select and delete** in the Central Password Manager — checkboxes on each item, Select All, and a "Delete N Passwords" button with confirmation
- **Custom terminal disclaimer** — when "Custom Terminal (unsupported)" is selected in Settings, a note explains that password authentication may not work with all custom terminals
- **Profile modal save button validation** — Save is now disabled until all auth-method-specific required fields are filled: key path for SSH Key, password for Password, and a selected entry for Central Password

### Changed
- Windows minimum requirement raised to Windows 11 (OpenSSH 8.4+ required for `SSH_ASKPASS_REQUIRE=force`)

### Fixed
- Central Password Manager bulk delete button now correctly shows a confirmation dialog before deleting
- Tab cycling in the Central Password Manager now correctly includes the Close button when the Add Password form is incomplete
- "Add Password" button focus highlight is now clearly visible (blue outline with gap matches the rest of the app)

## [0.8.0] - 2026-02-27

### Added
- **Move Profile** — new modal to move a profile to any group, or to ungrouped, without deleting and recreating it
- **Move Group** — new modal to move any group (including top-level groups) to a new parent, with full cascade path updates
- **Drag profile between groups** — drag a profile card onto a group header to move it instantly; a 5-second undo toast lets you reverse the action
- **Custom sort order** — drag profiles and groups into a custom order within their parent; order persists across app restarts
- **Cross-group drag + position** — drag a profile from one group and drop it at a specific position within another group in a single gesture
- **Padlock button** — toolbar toggle for drag reordering; session-only (always starts locked on app launch, resets on quit)
- **"Reset to A-Z"** — group context menu option to restore alphabetical order for a single group's profiles and child groups
- **"Reset Sorting Order"** — Settings button to reset all profiles and groups back to alphabetical order globally
- **Expand Card Actions** — optional Appearance setting to display all six profile actions (Connect, Edit, Move, Duplicate, Export, Delete) as individual buttons on each profile card; automatically reverts to the Actions menu in compact view

### Fixed
- **macOS:** "Open in new tab" now surfaces an actionable error message when macOS blocks Terminal automation (Accessibility permission), instead of silently failing — includes instructions for resolving the permission issue
- Profiles can now be dragged to the Ungrouped section even when no ungrouped profiles currently exist
- Text in profile titles, group names, and info values no longer becomes selected unexpectedly during drag operations
- Settings modal Tab key now correctly cycles within the modal on macOS (fix for WKWebView treating overflow scroll containers as Tab stops)
- Settings sections now display a visible divider between all section boundaries

## [0.7.1] - 2026-02-20

### Fixed
- Parent Group dropdown no longer flickers and disappears when opened
- Group modal no longer occasionally gets stuck at an expanded size after closing
- "What's New" splash screen no longer reappears on app reload — now only shown on genuine app launch
- Compact view: improved card layout for both standard and favourite profile cards

## [0.7.0] - 2026-02-19

### Added
- **Hierarchical groups** — organise profiles with nested sub-groups up to 3 levels deep (e.g., Work/Production/WebServers)
- **Sub-group management** — add, rename, move, and delete groups with cascade or move-profiles options
- **Favourites** — star any profile for quick access from the virtual "Favourites" group at the top of the list
- **Profile icons** — choose from 40+ icons for instant visual recognition on profile cards
- **Tag system** — colour-coded tags with multi-select management and `tag:name` search syntax
- **Individual export/import** — export or import a single profile or an entire group tree with duplicate detection (skip, rename, or overwrite)
- **Encrypted exports** — AES-256-GCM encryption with PBKDF2-HMAC-SHA256 key derivation for secure profile sharing
- **Password strength metre** — 5-level scale (Weak / Fair / Good / Strong / Stronger) when setting an encryption password
- **Version splash screen** — highlights changelog features automatically on first launch after an update
- **30+ keyboard shortcuts** — comprehensive navigation throughout the app; press `?` to view all shortcuts

### Changed
- Settings "Export/Import" tab renamed to "Backup/Restore" for clarity
- Profile names are now unique within the parent group only — the same profile name is permitted across different groups
- Group filter and collapse state now persists between sessions

### Fixed
- **Windows:** SSH key path validation now works correctly for Windows home directory paths (e.g., `C:\Users\name\.ssh\id_ed25519`)
- **Cross-platform:** Checkbox text is now properly vertically centred on both macOS and Windows
- Group rename and move no longer corrupts sub-group paths when group names share a common prefix (e.g., renaming "Dev" no longer affects "Dev/DevOps")
- Tag manager modal no longer expands to fill all available space when empty or when only a few tags are present

### Security
- Exports containing password-authenticated profiles now require encryption (mandatory enforcement)
- HMAC-SHA256 integrity verification on all encrypted imports detects tampering before decryption
- Encryption password requirements enforced on both frontend and backend: 12–128 characters
- Encryption keys and passwords are zeroised from memory immediately after use

## [0.6.5] - 2026-01-09

### Fixed
- **Hash Character Support**: Hash (#) character now supported in Username, Profile Name, and Group Name fields
  - Updated frontend and backend validation patterns
  - Updated field tooltips to show hash as allowed character
- **Group Filter Badge on Startup**: Groups filter no longer shows "0/0" on app load
  - Fixed initialization order: filter state now loads before profiles
  - Badge updates correctly after profiles load
- **Filter State on Startup**: Filters now apply correctly when app launches
  - Fixed initialization order issue that prevented filters from applying
  - Group selections now properly filter profiles on startup
- **Group Name Validation**: Fixed corrupted group state errors from character limit mismatch
  - Updated validation regex to match 64-character limit (was incorrectly checking for 32)
  - Eliminates localStorage corruption errors for valid group names
- **Duplicate Profile Workflow**: Improved user experience when duplicating profiles
  - Removed automatic "(duplicate)" suffix from duplicated profile names
  - Users can now choose their own name (validation prevents actual duplicates)
  - Save button properly disabled until changes made
- **Modal Close Button**: Close button now skips confirmation when no changes have been made
  - Eliminates unnecessary confirmation dialog when editing without changes
  - Works correctly for edit, duplicate, and new profile scenarios

## [0.6.4] - 2025-01-09

### Fixed
- **Windows Terminal Tab Mode**: Fixed tab mode to properly open in most recently used window
  - Changed from `wt new-tab` to `wt -w last nt` for correct window targeting
  - Tabs now open in existing Windows Terminal window instead of creating new windows
  - Tested and verified working on Windows 11
- **Windows Terminal Window Mode**: Fixed "window not found" error when opening new windows
  - Changed to `wt new-window` without window ID targeting
  - Eliminates errors from invalid window ID references
  - Tested and verified working on Windows 11
- **Auto-Close Terminal Tab (macOS)**: Terminal tabs now close reliably using keyboard shortcut simulation
  - Replaced AppleScript `close (selected tab)` with System Events Cmd+W keystroke
  - Works correctly for both tab mode and window mode
  - Tested with multiple tabs - closes individual tabs correctly without affecting other tabs
- **Auto-Close Terminal Tab (Windows)**: Auto-close now works correctly for all terminal types
  - Simplified SSH command execution to use native terminal exit behavior
  - Works with CMD, PowerShell, and Windows Terminal
  - Session closes cleanly when SSH connection ends
- **Windows App Icon Transparency**: Fixed white background visible in taskbar and title bar
  - Regenerated all icons with transparent background from SVG source
  - Updated icon.ico, icon.icns, and all platform-specific icon sizes
  - Clean transparency now matches macOS appearance
- **Group Filter Counter**: Fixed inverted logic showing unselected groups instead of selected
  - Counter now correctly shows number of selected groups, not hidden groups
  - Badge stays visible at all times showing X/Y format (selected/total)
- **Profile Count Badge Shifting**: Fixed badge size changing when numbers updated
  - Implemented fixed widths: 32px (1 digit), 42px (2 digits), 52px (3 digits)
  - Badges no longer shift size when profile counts change
  - Smooth, consistent UI experience
- **CSP Warning on Windows**: Removed frame-ancestors directive from meta tag
  - Directive is only valid in HTTP headers, not meta elements
  - Kept frame-ancestors in tauri.conf.json where it's properly supported
  - Eliminates console warning on Windows
- **Rust Unused Import Warning**: Removed unused std::fs import
  - Cleaned up after refactoring to use create_file_windows_secure helper
  - Zero compiler warnings on all platforms

### Changed
- **Console Logging**: Debug logging now requires explicit opt-in via localStorage
  - Console logs only appear when `localStorage.debug='true'` is set
  - Removes development clutter from production browser console
  - Cleaner user experience for non-developers
- **Database File Permissions**: Enhanced security with explicit file permissions on Unix systems
  - Database file now set to 0600 permissions (owner-only access)
  - Prevents unauthorized access to profiles.db from other local users
  - Defense-in-depth security enhancement
- **Rate Limiting**: Added maximum concurrent session limit
  - Maximum 5 concurrent terminal sessions allowed
  - Maintains existing rate limits (2s between sessions, 100 writes/second)
  - Prevents resource exhaustion from excessive terminal connections
- **Terminal Dimension Limits**: Reduced maximum terminal size for better resource management
  - Reduced from 300×100 to 250×80 (30,000 → 20,000 cells max)
  - More reasonable limits for typical use cases
  - Reduces memory usage and potential DoS vectors
- **CDN Resource Integrity**: Added Subresource Integrity hashes for xterm.js
  - Added `integrity` and `crossorigin="anonymous"` attributes to CDN resources
  - Protects against compromised CDN attacks
  - Ensures loaded resources match expected cryptographic hash
- **Developer Tools**: Disabled devtools in production builds
  - Changed `"devtools": true` → `"devtools": false` in tauri.conf.json
  - Prevents users from accessing developer tools in release builds
  - Can be re-enabled for debugging if needed
- **Badge Format**: Changed to X/Y format for better clarity
  - Filter badge shows "selected/total" groups (e.g., "3/5")
  - Profile badge shows "visible/total" profiles (e.g., "14/17")
  - Always visible, providing consistent context at a glance
- **Filter Reset Button**: Renamed "Clear All" to "Reset"
  - More accurately describes behavior (resets to show all, not clears selection)
  - Reduces confusion about button purpose
- **Maximum Import Limit**: Reduced from 1000 to 999 profiles
  - Cleaner 3-digit maximum for UI consistency
  - Simplifies badge width calculations (no 4-digit support needed)

### Security
- **Temporary Script Cleanup**: Enhanced security for temporary SSH launch scripts
  - Increased cleanup delay from 2s to 5s for safer terminal script execution
  - Added secure deletion: overwrites with random data before unlinking
  - Prevents information disclosure from lingering temporary files
- **SSH Host Key Verification**: Added MITM attack protection
  - All SSH connections now use `-o StrictHostKeyChecking=ask`
  - Users prompted to verify host keys on first connection
  - Protects against man-in-the-middle attacks
- **Password Operation Logging**: Removed sensitive debug logging
  - Eliminated all password-related debug logs (lengths, operation timing)
  - No longer exposes sensitive information during development
  - Simplified password storage logic
- **XSS Prevention**: Refactored shortcuts modal for defense-in-depth
  - Replaced `insertAdjacentHTML` with `createElement()` and `appendChild()`
  - Safer pattern prevents future XSS vulnerabilities
  - Better code maintainability
- **Content Security Policy**: Strengthened CSP and eliminated CDN dependencies
  - Vendored xterm.js locally (eliminates external CDN dependency)
  - Updated CSP to `script-src 'self'` and `style-src 'self'` only
  - Added `frame-ancestors 'none'` for clickjacking protection
  - Improved offline functionality and security
- **Terminal Session Management**: Added automatic cleanup for idle sessions
  - Idle timeout: 30 minutes of inactivity
  - Background monitor checks every 5 minutes
  - Automatically closes inactive sessions and frees resources
  - Prevents resource exhaustion from hung/abandoned sessions
- **File Dialog Timeout**: Reduced timeout for better resource management
  - Reduced from 120 seconds to 60 seconds
  - Prevents indefinite resource holding
- **Windows Batch File TOCTOU**: Eliminated race condition in file creation
  - Created `create_file_windows_secure()` helper function
  - Files created with restrictive permissions atomically
  - Eliminates time-of-check-to-time-of-use window
- **Password Authentication Documentation**: Clarified password storage behavior
  - Added documentation explaining passwords stored for reference/export only
  - Clarified manual password entry required for SSH connections
  - Recommended SSH key authentication for automated workflows
- **Dependency Vulnerability**: Fixed rkyv undefined behavior vulnerability (RUSTSEC-2026-0001)
  - Updated rkyv from 0.7.45 to 0.7.46
  - Fixes potential undefined behavior in Arc<T>/Rc<T> on out-of-memory conditions
  - Indirect dependency through tauri-plugin-log
  - Discovered via cargo audit on 2026-01-09

### Infrastructure
- **Dependency Vulnerability Scanning**: Automated security auditing
  - Added GitHub Actions workflow for weekly security scans
  - Configured Dependabot for automatic dependency updates
  - Uses `cargo audit` for Rust and `bun audit` for JavaScript
  - Runs on pull requests, weekly schedule, and manual dispatch
- **CI Workflow Optimization**: Improved efficiency with path filtering
  - Security audit and build checks now run only on PRs (not every push)
  - Path filtering skips checks for documentation-only PRs
  - Maintains weekly scheduled scans and manual dispatch options
  - Saves CI minutes while ensuring code quality
- **Git Repository Consolidation**: Merged development documentation into main repository
  - Added CLAUDE.md, TODO.md, and plans/ to public repository
  - Removed private backup repository setup
  - Simplified multi-machine development workflow
  - Verified no sensitive information in documentation files
- **Code Refactoring**: Reduced complexity in SSH connection handler
  - Extracted platform-specific helper functions from `connect_ssh`
  - Reduced main function from 389 lines to 76 lines
  - Improved code maintainability and readability

## [0.6.3] - 2025-01-06

### Added
- **Terminal Tab Setting**: New "Open profiles in new tabs" checkbox in Settings modal
  - macOS: Opens profiles in new Terminal.app tabs (Cmd+T) instead of new windows
  - Windows: Uses `wt new-tab` for Windows Terminal instead of `wt new-window`
  - Setting persists to localStorage and included in settings backup/restore
- **Password Visibility Toggle**: Show/hide button for password fields
  - Text-based toggle with fixed 65px width for consistent layout
  - Improves usability when entering/verifying passwords

### Changed
- **Profile Card Layout**: Redesigned for better space utilization and readability
  - User and Host now stacked vertically instead of horizontally
  - Removed Auth field from card display (less critical information)
  - Description moved to tooltip (shows on hover)
  - Improved tooltips: field values show on text hover, description shows on card header hover
  - Better responsive behavior with long values

### Fixed
- **Password Authentication**: Password storage now works correctly with system keychain
  - Added keyring native features (apple-native, windows-native, linux-native) to Cargo.toml
  - Passwords properly stored and retrieved from macOS Keychain / Windows Credential Manager
  - Resolves v0.6.2 known issue where passwords reported success but weren't actually saved
- **Auto-Close Terminal Tabs (macOS)**: Terminal tabs now close correctly after SSH session ends
  - Fixed AppleScript to close selected tab instead of entire window
  - Custom terminals continue to use separate windows (tabs not supported)
- **Windows Icon Transparency**: Regenerated icon.ico with proper transparency
  - Removed white background box visible in Windows taskbar/title bar
  - Regenerated using ImageMagick with PNG32/RGBA format
- **Windows Terminal Tab Preference**: Fixed default case to respect user's tab setting
  - Previously always opened new windows when using default preference
  - Now correctly uses user's "Open profiles in new tabs" setting

### Security
- **CRITICAL**: Fixed mutex poisoning risk across 26 instances (CVSS 7.5)
  - Replaced all `.unwrap()` calls on mutex locks with proper error handling
  - Database methods use `.expect()` with descriptive messages
  - Registry/rate limit mutexes use `.map_err()` for graceful error conversion
  - Prevents application crashes from poisoned mutexes
- **CRITICAL**: Reduced temporary script exposure window from 5s to 2s (CVSS 6.5)
  - macOS custom terminal scripts and Windows batch scripts cleanup faster
  - Minimizes window for information disclosure on multi-user systems
  - Scripts still readable by terminal but exposure time reduced 60%
- **MEDIUM**: Removed password operation logging from production builds (CVSS 4.0)
  - Password retrieval/storage operations no longer logged in release builds
  - Logs gated behind `#[cfg(debug_assertions)]` compile-time flag
  - Reduces information leakage risk
- **MEDIUM**: Fixed CSP inconsistency between HTML and Tauri config (CVSS 3.5)
  - Synchronized Content Security Policy across index.html and tauri.conf.json
  - Added `https://cdn.jsdelivr.net` for xterm.js CDN resources
  - Added `frame-ancestors 'none'` for clickjacking protection
- **MEDIUM**: Added profile import size validation (CVSS 4.5)
  - Maximum 1000 profiles per import to prevent resource exhaustion
  - Rejects oversized imports with clear error message
- **MEDIUM**: Added settings import size validation (CVSS 4.5)
  - Maximum 1MB JSON payload for settings import
  - Prevents DoS via massive backup files

### Infrastructure
- **Auto-Tag CHANGELOG Extraction**: Fixed release workflow CHANGELOG parsing
  - Corrected version number extraction to handle bracketed format `[X.X.X]`
  - Auto-tagging now creates releases with correct CHANGELOG content
- **Installer Bundle Zip**: Release artifacts now include bundled zip for easier distribution
  - Windows: MSI + zip archive
  - macOS: DMG + app bundle in zip

## [0.6.2] - 2025-01-05

### Changed
- **Green Color Scheme**: Updated success color from various greens to consistent #34C759 (macOS-style green)
  - Base button color: #34C759, hover: #2A9F47
  - Applied to success buttons, toast notifications, and terminal status indicators
- **Settings Modal Behavior**: Save button no longer closes settings modal
  - Allows multiple saves without re-opening modal
  - Button disables after save until new changes detected
  - Improved user experience for iterative settings adjustments

### Added
- **Password Export Toggle**: New "Include Passwords in Export" checkbox in Profile Management
  - Defaults to checked (enabled)
  - Persisted to localStorage as user preference
  - Requires clicking Save to apply (follows settings pattern)
  - Settings Management respects this toggle when including profiles in backup
- **Enhanced Username Validation**: Username field now supports @ symbol
  - Max length increased from 32 to 128 characters
  - Supports formats like `user@proxyuser` for complex SSH scenarios
  - Backend and frontend validation updated
- **Backend Password Retrieval**: Added `get_profile_password` command
  - Retrieves passwords from system keychain for editing profiles
  - Enables password field population when editing existing profiles

### Fixed
- **Hostname Validation**: Reduced max length from 128 to 64 characters (more realistic limit)
- **Group Name Validation**: Increased max length from 32 to 64 characters (more flexibility)
- **Field Tooltips**: Updated all validation tooltips to reflect new character limits and rules
- **Windows Scrollbar**: Hidden persistent scrollbar arrows in Recent Connections on Windows
  - Arrows no longer show when scrolling not needed
  - CSS: `scrollbar-button { display: none }`
- **Windows Button Hover**: Fixed text rendering issues during button hover scale animation
  - Added `backface-visibility: hidden` and `-webkit-font-smoothing: subpixel-antialiased`
  - Text no longer appears blurry or zoomed during hover
- **Windows Icons**: Regenerated all icons with transparent backgrounds (PNG32/RGBA format)
  - Removed white box background visible on Windows
  - All icon sizes regenerated from SVG: 32x32, 128x128, 128x128@2x, Square logos (30-310px), StoreLogo, icon.ico
  - Icons now match macOS appearance with clean transparency

### Security
- **Password Export Warning**: Updated security warnings to reflect conditional password inclusion
  - Profile Management warning: Only warns when "Include Passwords in Export" is enabled
  - Settings Management warning: References Profile Management toggle state
  - More accurate risk communication to users

### Known Issues
- **Password Authentication Not Working**: Passwords are not being stored in system keychain despite success messages
  - The keyring library reports success but macOS Keychain Access shows no entries created
  - Passwords cannot be retrieved when editing profiles or exporting
  - Export shows `password: null` even with "Include Passwords" enabled
  - **Workaround**: Use SSH Key authentication or None (Keyboard-Interactive) instead
  - **Fix planned for v0.6.3**: Will investigate keychain permissions and alternative storage methods

## [0.6.1] - 2025-01-03

### Changed
- **Update Modal Download Button**: Changed from red (`btn-danger`) to green (`btn-primary`)
  - More intuitive color for positive action (downloading update)
  - Matches standard UI patterns (green = go/proceed)
- **README Download Button**: Converted plain download link to bright green shields.io badge
  - More prominent, GitHub-style download button
  - `for-the-badge` style for better visibility
  - Includes GitHub logo for clarity

### Infrastructure
- **GitHub Actions CI**: Added PR checks workflow with smart conditional execution
  - Runs `cargo check`, `cargo test`, and build verification on PRs to main
  - Path filtering skips expensive checks for documentation-only changes
  - Always runs on `v*-dev` branches for full pre-release validation
  - Multi-platform testing (macOS aarch64 + Windows x86_64)
- **Development Agents**: Added `voltagent-dev-exp:refactoring-specialist` agent to development workflow
  - Integrated into release process: Code Review → Refactoring → Security Review
  - Available alongside `voltagent-qa-sec:code-reviewer`, `voltagent-infra:security-engineer`, `voltagent-lang:rust-engineer`, `voltagent-qa-sec:performance-engineer`, and `voltagent-qa-sec:debugger`

## [0.6.0] - 2025-01-01

### Added
- **Database Schema Migrations**: Automatic schema versioning and migration system
  - New `schema_version` table tracks database version
  - Migration system applies updates automatically on app start
  - New tables: `active_sessions`, `recent_connections`, `user_settings`
  - Future-proof architecture for database changes
- **Recent Connections Tracking**: Automatically tracks and displays recently connected profiles
  - Backend: `record_connection()`, `get_recent_connections()`, `clear_recent_connections()` commands
  - Database integration with automatic deduplication (updates timestamp on repeat connections)
  - Persistent across app restarts
- **Recent Connections UI**: Visual recent connections bar below profile list
  - Shows last 5 connections with "time ago" formatting (e.g., "2 minutes ago")
  - Click to quickly reconnect to recent servers
  - Individual delete with red X button (hover to reveal, or use 'D' key)
  - Collapse/expand with up/down arrows
  - Keyboard shortcuts: C to clear all, D to delete selected
  - Responsive box sizing: exactly 3 boxes fit at 800px width (adjusts for scrollbar presence)
- **Keyboard Shortcuts System**: Comprehensive keyboard navigation throughout the app
  - Global shortcuts: N (new profile), S (settings), / (search), ? (help)
  - Profile navigation: ↑/↓ (navigate profiles), Enter (connect), E (edit), D (duplicate), Delete (remove)
  - Recent connections: ←/→ (navigate), ↑ (collapse), ↓ (expand), Enter (connect), D (delete), C (clear all)
  - Group navigation: Tab (select group header), Enter (toggle), ←/→ (collapse/expand)
  - Filter popup: ↑/↓ (navigate options), Enter/Space (toggle), Tab/Escape (close)
  - Modal shortcuts: Escape (close/cancel), Cmd/Ctrl+S (save)
  - Comprehensive Tab navigation: search → new profile → settings → filter → groups → profiles → recent
  - Enable/disable in Settings modal
  - ? key shows help modal with all shortcuts
- **Embedded Terminal**: Connect via embedded terminal with full PTY support
  - Cross-platform PTY using `portable-pty` crate (macOS + Windows)
  - Real terminal emulation with xterm.js 5.3.0 frontend
  - Full bidirectional I/O, terminal resize support, cleanup on close
  - Session management with thread-safe registry
  - Terminal status badges: Connecting (orange) → Connected (green) / Connection Failed (red)
  - Smart error detection from SSH output
  - Automatic cleanup on session end
  - Modal UI with Clear and Close buttons
  - Single session support (multi-tab planned for v0.7.0)

### Changed
- **Keyboard Shortcuts**: Changed from Cmd/Ctrl+N and Cmd/Ctrl+, to single keys N and S
  - N now opens new profile modal (no modifier needed)
  - S now opens settings modal (no modifier needed)
  - Cmd/Ctrl+N and Cmd/Ctrl+, still work as alternatives
- **Settings Modal Behavior**: All settings changes now require explicit Save
  - Keyboard shortcuts checkbox no longer saves immediately
  - All checkboxes, text fields, and dropdowns follow Save/Cancel pattern
  - Matches existing Close/Save pattern for consistency
- **Profile Modal Save Button**: New profiles disable Save until all required fields populated
  - Save button disabled on open for new profiles
  - Enables when name, host, and username are filled
  - Edit profiles: disabled until changes detected AND required fields populated
  - Provides clear visual feedback for form completion
- **Terminal Connection Status**: Intelligent status monitoring based on SSH output
  - Status stays "Connecting..." until SSH success or failure detected
  - Detects errors (network unreachable, connection refused, etc.) → "Connection Failed" (red)
  - Detects success (password prompt, shell prompt, welcome message) → "Connected" (green)
  - No more premature "Connected" status
- **Terminal Close Confirmation**: Skip confirmation dialog for failed connections
  - Failed connections close immediately (no prompt)
  - Active/connecting sessions still show confirmation
  - Better UX - no pointless confirmation for connections that never worked
- **Success Color**: Updated green color from #16c60c to #00CA4E across the app
  - Softer, less bright green for success buttons and notifications
  - Applied to toast notifications, terminal badges, and success buttons
  - Better visual consistency
- **Recent Connections Box Sizing**: Dynamic width calculation based on scrollbar presence
  - Uses CSS `calc()` with `--scrollbar-width` variable
  - Exactly 3 boxes fit at 800px whether scrollbar is present or not
  - Boxes auto-adjust when scrollbar appears/disappears

### Fixed
- **Modal Keyboard Navigation**: Tab focus now properly trapped within modals
  - Tab cycles only through modal elements (doesn't escape to background)
  - Confirmation dialogs support Tab cycling between buttons
  - Prevents accidental background interactions
- **Selection State Management**: All selection states cleared when modals close
  - Prevents dangerous actions after canceling dialogs
  - Fixes bug where profile stayed selected after cancel → could accidentally delete wrong profile
  - Applies to: selectedProfileId, selectedGroupName, selectedRecentConnectionId
- **Mouse/Keyboard Mode Switching**: Improved focus management
  - Mouse hover blurs elements (switches to mouse mode)
  - Tab key refocuses elements (switches to keyboard mode)
  - Prevents mouse cursor from interfering with keyboard navigation
- **Validation Error Persistence**: Form validation errors now clear between modal opens
  - Fixed bug where validation errors from previous session showed on new modal open
  - Added `clearAllValidationErrors()` function called on modal open
  - Red borders no longer incorrectly persist

### Performance
- **PTY Output Batching**: Terminal output now batched to prevent event flooding
  - Collects data in 32KB buffer
  - Emits every 16ms (~60fps) OR when buffer reaches 16KB
  - Reduces event rate from potentially thousands to max 60/second
  - Maintains smooth terminal rendering while preventing UI freezing
- **PTY Session Cleanup**: Implemented timeout for reader thread termination
  - 5-second timeout prevents indefinite blocking during cleanup
  - Polls thread status every 100ms
  - Logs warning if thread doesn't exit gracefully
  - Prevents resource leaks from hung SSH processes
- **Race Condition Prevention**: Atomic session cleanup
  - All three registry locks (sessions, writers, pairs) acquired atomically
  - Prevents race window between sequential lock acquisitions
  - Eliminates potential for partial cleanup state
- **Terminal Resize Debouncing**: Increased debounce from 100ms to 250ms
  - Prevents race conditions between resize and I/O operations
  - Better stability during rapid window resize
  - Reduces PTY resize calls for better performance

### Security
- **MEDIUM**: Reduced temporary script cleanup window from 30s to 5s (CVSS 5.3)
  - Minimizes exposure time for SSH connection details in temp scripts
  - Balances cleanup timing with terminal launch requirements
  - Reduces information disclosure risk on multi-user systems
- **MEDIUM**: Implemented server-side rate limiting for settings import (CVSS 4.5)
  - Added 5-second cooldown enforced in Rust backend
  - Prevents localStorage DoS via rapid import attempts
  - Client-side rate limiting can be bypassed; server-side cannot
- **MEDIUM**: Reduced terminal dimension limits to prevent resource exhaustion (CVSS 4.3)
  - Max columns reduced from 500 to 300
  - Max rows reduced from 200 to 100
  - Added total cell limit validation (max 30,000 cells)
  - Prevents memory exhaustion with extreme terminal sizes

## [0.5.2] - 2024-12-29

### Fixed
- **Windows ACL Implementation**: Enhanced Windows temporary script security
  - Fixed compilation error using correct windows-acl API with helper::string_to_sid()
  - Convert Path to &str for ACL::from_file_path compatibility
  - Use well-known SIDs for Everyone (S-1-1-0) and Users (S-1-5-32-545) groups
  - Use winapi constants (FILE_GENERIC_READ) for permission masks
  - Added explicit deny rules for Everyone and Users groups
  - Improved error handling with detailed logging
  - Each ACL operation now validated separately for robustness
  - Ensures temporary scripts are truly restricted to current user only
- **localStorage Injection Prevention**: Strengthened settings restore validation
  - Added strict string type checking before whitelist validation
  - Theme validation now checks type AND whitelist membership
  - Terminal preference validation enhanced with type safety
  - Documented whitelist approach in code comments for maintainability
- **Tooltip Positioning**: Implemented dynamic viewport-aware positioning
  - Tooltips now detect available space below input field
  - Automatically show above input when viewport space is limited
  - JavaScript-based positioning replaces static CSS rules
  - Prevents tooltips from appearing off-screen in scrolled modals
- **CSP Compliance**: Removed inline styles from JavaScript
  - Replaced inline style in filter popup with CSS class
  - Added .filter-empty-state class to stylesheet
  - Maintains strict Content Security Policy without unsafe-inline

### Added
- **Rate Limiting**: Added 5-second cooldown on settings import
  - Prevents accidental rapid successive imports
  - User-friendly countdown message shows remaining wait time
  - Tracked via lastImportTime timestamp
  - Mitigates potential DoS via localStorage writes

### Changed
- **Error Message Consistency**: Standardized error messages across the application
  - All system failures now include error details in user-facing toast messages
  - Consistent pattern: console.error() for debugging + showToast() with details for users
  - Improves troubleshooting and user support experience

### Security
- **MEDIUM**: Enhanced Windows temp script ACL with explicit deny rules (CVSS 5.5)
  - Windows temporary scripts now have comprehensive ACL protection
  - Denies read access to Everyone and Users groups before granting to current user
  - Prevents other local users from reading SSH connection details
  - Detailed error logging for troubleshooting without exposing info to user
- **MEDIUM**: Strengthened localStorage validation against injection (CVSS 5.0)
  - Added type checking to all settings fields before localStorage writes
  - Whitelist approach documented and enforced consistently
  - Defense-in-depth: frontend validation complements backend validation
  - Prevents arbitrary localStorage injection even if backend bypassed
- **LOW**: Improved UUID entropy for temporary script names (CVSS 3.5)
  - Added fast-rng feature to uuid crate ensuring CSPRNG usage
  - Reduces predictability of temporary script filenames
  - Additional defense against race condition attacks

## [0.5.1] - 2024-12-29

### Fixed
- **macOS Default Terminal Launch**: Fixed critical bug preventing Default Terminal option from working
  - Removed incorrect single-quote escaping in AppleScript double-quoted strings
  - Terminal.app now launches correctly with "Default" preference selected
  - Custom terminals continue to work via temporary script approach
- **Filter Dropdown Alignment**: Filter popup now aligns correctly with button in all layouts
  - Dynamic JavaScript positioning replaces fixed CSS positioning
  - Works correctly in both normal view and compact view (<800px width)
  - Popup appears below button even when buttons wrap to second row
- **Import Validation**: Added comprehensive JSON validation for profile and settings imports
  - Profile imports now reject settings backup files with helpful error message
  - Settings restores now reject profile-only files with helpful error message
  - Validates required fields and array structures
  - Multi-line error messages display correctly in toast notifications
- **Multi-line Toast Messages**: Toast notifications now properly display multi-line error messages
  - Safe DOM manipulation using split() and createTextNode()
  - Preserves line breaks for better readability
  - No excessive spacing around short messages
- **Confirmation Dialog Validation**: Added null reference protection to buildConfirmMessage()
  - Function now validates config parameter before use
  - Returns empty fragment if invalid config provided
  - Prevents runtime errors from malformed dialog configurations

### Security
- **MEDIUM**: Fixed XSS risk in confirmation dialog construction (CVSS 5.4)
  - Added input validation to buildConfirmMessage() function
  - Validates config structure before processing
  - Defense-in-depth protection against future misuse
- **MEDIUM**: Fixed HTML injection risk in toast messages (CVSS 4.5)
  - Replaced innerHTML with safe DOM manipulation
  - Uses document.createTextNode() and createElement('br')
  - Prevents potential XSS if user input ever reaches toast function

## [0.5.0] - 2024-12-24

### Added
- **Close/Save Pattern**: Profile Editor and Settings modals now have Close/Save buttons
  - Save button enabled/disabled based on changes detection
  - Confirmation dialog when closing with unsaved changes
  - "Close Without Saving" option with warning
  - Improved UX prevents accidental data loss
- **Settings Revert Validation**: Settings restore now validates all values with safe defaults
  - Validates theme against allowed values (system/light/dark)
  - Validates terminal preferences against available options
  - Validates boolean values with type checking
  - Prevents corrupted localStorage from breaking UI
- **Search Tooltip**: Added informative tooltip to search bar
  - Explains search scope (names, hosts, usernames)
  - Notes that results are filtered by active group filters
  - Helpful tip to clear group filters for searching all profiles
- **Context-Aware Empty States**: Improved empty state messages with appropriate icons
  - "No SSH Profiles Yet" when no profiles exist (💻 icon)
  - "No Profiles Found" with context-specific explanations (🔍 icon)
  - Different messages for search-only vs search+filter combinations
  - Better user guidance for different scenarios

### Changed
- **Modal Button Layout**: Replaced X buttons with Close buttons in modals
  - Profile Editor: Delete | Save | Close (left to right)
  - Settings Modal: Save | Close (left to right)
  - Close button positioned as rightmost element
  - Cleaner, less cluttered appearance
- **Dropdown Heights**: All select dropdowns now match text input height (42px)
  - Consistent visual alignment across forms
  - Applied to Profile Editor and Settings modals
  - Better visual harmony

### Fixed
- **Custom Terminal Support (macOS)**: Custom terminals now execute SSH commands correctly
  - Switched from AppleScript `do script` to temporary shell script approach
  - Works with any terminal app (Ghostty, iTerm2, Wezterm, etc.)
  - Shell scripts placed in temp directory with UUID naming
  - Scripts made executable with 0o700 permissions
  - 30-second delayed cleanup prevents accumulation
- **Custom Terminal Support (Windows)**: Custom terminals now work correctly
  - Temporary batch script approach for compatibility
  - Works with any terminal that can execute .bat files
  - 30-second delayed cleanup mechanism
- **Form Spacing**: Removed wasted space at bottom of Profile Editor form
  - Tooltips for last form group now appear above input
  - Cleaner, more compact layout
- **Unsaved Changes Detection**: Confirmation dialogs now work correctly
  - Fixed confirmation dialog function call (customConfirm instead of confirm)
  - Proper Promise handling for async confirmations
  - Consistent behaviour across Profile Editor and Settings modals

### Security
- **CRITICAL**: Fixed command injection in macOS temporary scripts
  - Profile names now properly escaped in shell scripts using `escape_bash_double_quote()`
  - Escapes: backslash, double quote, dollar sign, backtick
  - Prevents command injection via malicious profile names
  - CVSS Score: 9.8
- **CRITICAL**: Fixed command injection in Windows batch scripts
  - Profile names escaped for batch echo context using `escape_batch_echo()`
  - SSH arguments escaped using `escape_batch_arg()`
  - Escapes: ^, &, |, <, >, %, !, double quotes
  - Prevents command execution via batch special characters
  - CVSS Score: 9.8
- **CRITICAL**: Implemented temporary script cleanup mechanism
  - Background thread deletes scripts after 30-second timeout
  - Prevents accumulation of sensitive data in temp directories
  - Applied to both macOS (.sh) and Windows (.bat) scripts
  - Reduces disk space usage and privacy risks
  - CVSS Score: 7.5
- **HIGH**: Added comprehensive validation to settings revert
  - All settings values validated before applying to UI
  - Safe defaults used for invalid/missing values
  - Prevents corrupted localStorage from breaking application
  - Type checking for boolean, string, and enum values
  - CVSS Score: 6.5

## [0.4.3] - 2024-12-23

### Added
- **ResizeObserver**: Dynamic scrollbar width updates on window resize and content changes
  - Automatically adjusts search bar alignment when scrollbar appears/disappears
  - Monitors profile container size changes for optimal layout
- **Content Security Policy**: Strengthened XSS protection with meta tag and Tauri config
  - Restricted script sources to 'self' only
  - Added connect-src whitelist (GitHub API only)
  - Added base-uri, form-action, and frame-ancestors restrictions
- **Security Warnings**: Export functionality now warns about plaintext passwords
  - Warning in Profile Management section
  - Warning in Settings Backup section (when profiles included)
  - Recommends secure file storage and filesystem encryption
- **Custom Terminal Validation**: Terminal paths validated on app load
  - Falls back to default terminal if saved path no longer valid
  - Shows user-friendly notification when path becomes invalid

### Changed
- **Badge Styling**: Standardised all badge sizes with shared `.badge` class
  - Profile count badge, filter badge, and group count badge now consistent
  - Unified padding (2px 6px), font size (11px), and styling
- **Modal Headings**: Increased font size from 18px to 24px
  - Settings and Profile modals more prominent
  - Better visual hierarchy
- **Minimum Window Size**: Reduced from 600x450 to 560x420
  - Maintains 4:3 aspect ratio
  - Better support for smaller displays
- **Responsive Layout**: Search bar moves below buttons on narrow screens (<800px)
  - Buttons appear first for better mobile UX
  - Search input takes full width on second row

### Fixed
- **Filter Group Checkboxes**: Large gap between checkbox and text resolved
  - Removed flex constraints causing layout issues
  - Fixed CSS selector specificity (`.search-bar input[type="text"]`)
  - Native OS checkbox spacing now works correctly
- **Accessibility**: Removed CSS `order` properties violating WCAG 2.1
  - HTML restructured to match visual order
  - Screen readers now follow correct reading order
  - Keyboard navigation improved
- **Window Resize Race Condition**: Debounced save to prevent data corruption
  - 250ms debounce prevents multiple rapid localStorage writes
  - Fixes potential race conditions during window dragging
- **Scrollbar Calculation**: More robust error handling and validation

### Security
- **Terminal Path Validation**: Comprehensive security for custom terminal paths
  - Path canonicalization resolves symlinks and `..` components
  - Platform-specific whitelisting (Applications directories on macOS, Program Files on Windows)
  - File extension validation (.app for macOS, .exe for Windows)
  - App bundle structure validation on macOS
  - TOCTOU race condition fixed: re-validation immediately before terminal execution
- **macOS Terminal Whitelist**: Expanded to include legitimate terminal locations
  - Added `/System/Library/CoreServices/Applications` (default Terminal.app location)
  - Added `/usr/local` (Homebrew)
  - Added `/opt/homebrew` (Apple Silicon Homebrew)
  - Added `/opt/local` (MacPorts)
  - Added `~/Applications` (user-installed apps)
- **Removed Linux Support**: Cleaned up unsupported platform code
  - App officially supports macOS and Windows only
  - Prevents confusion and reduces attack surface

## [0.4.2] - 2024-12-23

### Changed
- **Header Logo Size**: Increased app logo from 32px to 56px for better visibility
- **Header Layout**: Moved version number underneath title instead of inline
  - Creates cleaner visual hierarchy
  - Reduces horizontal space pressure in header
- **Total Profiles Location**: Moved profile counter from header to search bar area
  - Positioned to right of "Filter Groups" button
  - Styled to match surrounding buttons but non-clickable
  - Better visual grouping with search/filter controls
- **Responsive Button Layout**: Improved button behaviour at narrow widths (<800px)
  - Search input moves to separate row below buttons
  - Three buttons (Expand Groups, Filter Groups, Total Profiles) scale dynamically with equal width
  - Prevents UI crushing on smaller window sizes

### Fixed
- **Scrollbar Alignment**: Total Profiles button right edge now aligns with profile boxes
  - Dynamic calculation accounts for scrollbar presence
  - Works correctly on both macOS and Windows (different scrollbar widths)
  - JavaScript function calculates scrollbar width and updates CSS variable
  - Includes validation and error handling for edge cases
- **Code Quality**: Enhanced scrollbar width calculation function
  - Added input validation (0-30px range for scrollbar width)
  - Added error handling with fallback to base padding
  - Uses named constant for base padding value
  - Prevents layout breaking from invalid calculations
- **CSS Cleanup**: Removed duplicate .app-logo rule definition

## [0.4.1] - 2024-12-23

### Changed
- **New Application Logo**: Replaced Tauri logo with custom SSH-themed logo
  - Blue padlock with terminal prompt design
  - Generated in all required formats (.png, .icns, .ico)
  - Consistent branding across all platforms
- **GitHub Actions Workflow**: Switched to official `tauri-apps/tauri-action` for more reliable builds
  - Added Rust caching for faster build times
  - Pinned action version to v0.5 for stability
  - Simplified workflow configuration
- **README Documentation**: Converted all text to British English
  - "Organise" instead of "Organize"
  - "Colour-coded" instead of "Color-coded"
  - "Minimises" instead of "Minimizes"
- **Version Update Process**: Added README.md locations to version update checklist
  - README.md line 14: Version badge
  - README.md line 16: Download link text

### Fixed
- **Modal Dismiss Behaviour**: Removed ability to close modals by clicking outside
  - Profile creation/edit modals now require explicit close/cancel button click
  - Settings modal now requires explicit close button click
  - Prevents accidental loss of unsaved form data
  - Improves UX consistency across the application
- **Windows Build**: Re-enabled Windows MSI builds in GitHub Actions
  - Official tauri-action handles Windows-specific requirements automatically
  - MSI packages now generated successfully alongside macOS DMG

### Security
- **CRITICAL**: Fixed command injection vulnerabilities in Windows SSH terminal handling
  - **CMD Terminal**: Replaced unsafe `raw_arg()` with separate arguments (src-tauri/src/lib.rs:1192)
  - **Custom Terminal**: Replaced unsafe `raw_arg()` with separate arguments (src-tauri/src/lib.rs:1262)
  - **Default Terminal**: Fixed undefined variable that caused compilation error (src-tauri/src/lib.rs:1287)
  - All Windows terminals now use safe argument passing instead of shell string concatenation
  - Prevents arbitrary command execution via malicious profile data
- **HIGH**: Enhanced AppleScript escaping for macOS custom terminals
  - Added escaping for single quotes, dollar signs, and backticks
  - Prevents command injection through terminal application names and SSH commands
  - Comprehensive escaping now covers all shell metacharacters

## [0.4.0] - 2024-12-22

### Added
- **Terminal Preferences**: Choose your preferred terminal application for SSH connections
  - **macOS**: Default (Terminal.app), Custom (.app bundles), Embedded (coming soon)
  - **Windows**: Default (system default), Command Prompt, PowerShell, Windows Terminal, Custom (.exe), Embedded (coming soon)
  - Custom terminal browser with native file picker for selecting applications
  - OS-specific terminal options automatically shown based on platform
  - Terminal preference included in settings backup/restore with OS filtering
- **Window State Persistence**: Window size now saved between app launches
  - Size persisted in localStorage and included in settings backup/restore
  - Defaults to 800×600 on first launch
  - Validation ensures window dimensions stay within safe bounds (600-4000 × 450-3000)
  - Retina display support with logical pixel handling
- **OS-Specific Settings Architecture**: Settings backup/restore now handles OS-specific settings intelligently
  - Top-level `os` field identifies backup platform ("macos" or "windows")
  - Separate `settings_os_specific` section for OS-dependent settings
  - Cross-platform restore automatically ignores incompatible settings
  - Warning dialog shown when restoring backup from different OS
- **Responsive Profile Layout**: Profile cards adapt to window width
  - Buttons move to right side of cards at ≥800px for better space utilization
  - Actions stack vertically on narrow windows (<800px)
- **Responsive Header**: Header layout adapts to narrow windows
  - Version number stays inline with title
  - Profile counter wraps to new line when needed
- **Windows Build Support**: GitHub Actions now builds Windows MSI installers automatically on release

### Changed
- **Confirmation Dialog Pattern**: All user prompts now use context-specific action buttons
  - Delete profile: "Delete" / "Cancel" (was "Yes" / "No")
  - Delete all profiles: "Delete All" / "Cancel" (was "Yes" / "No")
  - Import profiles: "Import" / "Cancel" (was "Yes" / "No")
  - Reset settings: "Reset" / "Cancel" (was "Yes" / "No")
  - Restore backup: "Restore" / "Cancel"
  - All prompts end with "Are you sure you want to [action]?" for clarity
  - Reduces cognitive load and prevents errors
- **Modal Scroll Position**: Settings and Profile modals now always open scrolled to top
- **Authentication Label**: Changed "Authentication" to "Auth" in profile cards for better fit on narrow layouts
- **Minimum Window Width**: Reduced from 700px to 600px for better compatibility
- **Default Window Size**: Changed from fixed to 800×600 (was not configurable)

### Fixed
- **Window Size on Retina Displays**: Window dimensions now correctly use logical pixels instead of physical pixels
  - Fixes issue where saved size was 2x larger than intended on Retina displays
  - Window restore now validates bounds and resets to defaults if corrupted
- **Profile Card Text Truncation**: Long profile names and descriptions now truncate properly with ellipsis
  - Prevents layout breaking on narrow windows
  - Uses CSS text-overflow for clean presentation
- **Sticky Modal Headers**: Settings and Profile modal headers remain visible when scrolling
  - Improves UX for long forms/settings lists
  - Headers use position: sticky with proper z-index

### Security
- **CRITICAL**: Fixed command injection vulnerability in custom terminal handling (macOS)
  - Added proper AppleScript string escaping for terminal paths and commands
  - Terminal app names now escaped to prevent shell injection
  - Custom terminal paths validated (must be .app bundles on macOS)
- **CRITICAL**: Fixed race condition in window size persistence
  - Window scale factor now fetched once and reused for both dimensions
  - Prevents inconsistent sizes when window moves between displays during save
- **HIGH**: Improved Windows command escaping
  - PowerShell commands now use proper single-quote escaping
  - Removed incorrect double-quote escaping that didn't work with cmd.exe
  - Windows Terminal uses direct argument passing (safest method)
- **HIGH**: Added terminal path validation
  - macOS custom terminals must be .app bundles
  - Windows custom terminals must be .exe files
  - Paths validated for existence before execution
- **MEDIUM**: Added window dimension validation on restore
  - Settings restore now validates window width/height before applying
  - Invalid or corrupted dimensions trigger fallback to defaults
  - Prevents unusable window sizes (too small/large)

## [0.3.0] - 2024-12-21

### Added
- **Settings Backup/Restore**: New unified backup system that can optionally include profiles
  - "Include Profiles" checkbox (default enabled) to include all profiles in settings backup
  - Smart backup: only includes filtered/collapsed groups when profiles are included
  - Cross-platform JSON format compatible between Mac and Windows
  - Default filename: `sshpm-settings-YYYY-MM-DD.json`
  - Confirmation dialog adapts based on whether backup contains profiles
  - Settings apply immediately after restore (no app restart needed)
- **Reset Settings**: New button to reset all settings to defaults with confirmation dialog
  - Resets: theme (system), auto-update (enabled), filtered groups (cleared), collapsed groups (cleared)
  - Profiles are not affected by reset
  - Red danger button with Yes/No confirmation
- **Profile Counter**: Total profiles count displayed in header with blue badge
- **Group Counter Badges**: Each collapsible group header now shows profile count in blue badge style
- **Version Link**: Version number in About section now links to GitHub release page
- **Collapsed Groups Persistence**: Group collapse state now persists across app restarts
- **Include Profiles Preference**: "Include Profiles" checkbox state persists in localStorage

### Changed
- **File Naming**: Updated export filenames to use `sshpm-` prefix for consistency
  - Profile exports: `sshpm-profiles-YYYY-MM-DD.json`
  - Settings exports: `sshpm-settings-YYYY-MM-DD.json`
- **Export Versioning**: Both profile and settings exports now include app version (e.g., "0.3.0") instead of format version
- **Button Alignment**: All settings buttons now have equal width for clean layout
  - Profile Management: Export, Import, Delete All (3 buttons)
  - Settings Management: Backup, Restore, Reset (3 buttons)
- **Filter Groups Button**: Now has same minimum width (150px) as Expand/Collapse button for alignment
- **Confirmation Dialogs**: Standardized to use Yes/No buttons with No as default (safer)
  - Delete All Profiles: Yes/No with red Yes button
  - Reset Settings: Yes/No with red Yes button
  - Restore Settings: Restore/Cancel with blue Restore button
- **Modal Z-Index**: Confirmation dialogs now appear above settings modal (z-index: 1500 vs 1000)
- **Bundle Identifier**: Updated from `com.sshprofilemanager.app` to `com.tomsinclair.sshprofilemanager`

### Fixed
- **Settings Modal Behavior**: Confirmation dialogs no longer close settings window when user clicks No/Cancel
- **Settings Import Validation**: Group names in settings import now validated using same rules as profile creation
  - Prevents XSS attacks via malicious group names
  - Validates character set (alphanumeric + space - _ ( ) . [ ])
  - Enforces 32 character maximum
- **Profile Restore Error Handling**: Settings restore with profiles now handles individual profile failures gracefully
  - Shows warning toast listing failed profiles by name
  - Successful profiles are still restored even if some fail
  - Does not abort entire restore on single profile error
- **Checkbox Spacing**: Improved spacing between checkboxes and labels (8px margin)

### Security
- **Input Validation**: Settings import now validates group names to prevent XSS (MED-001)
- **Error Handling**: Profile creation during settings restore now properly catches and reports errors (MED-002)

## [0.2.1] - 2024-12-21

### Fixed

#### Medium Priority Issues
- **Error Reporting (Linux)**: Improved error handling in SSH connection for Linux - now reports which terminal emulators were tried and why they failed
- **Update Validation**: Added comprehensive validation for update version format from GitHub API, including empty string checks and better error messages
- **Port Validation**: Added explicit documentation and debug assertions for port validation to ensure safe i32 to u16 casting
- **Filter Badge UX**: Changed filter badge to show number of HIDDEN groups instead of selected groups for clearer user experience

#### Low Priority Issues
- **Error Handling**: Standardized error handling across all platforms (macOS, Windows, Linux) for SSH connections
- **Code Quality**: Eliminated duplicate code in form value capture by creating `getCurrentFormValues()` helper function
- **Smart Duplicates**: Implemented smart duplicate naming that strips existing "(duplicate)" suffixes to prevent nested duplicates like "Profile (duplicate) (duplicate)"
- **User Feedback**: Added loading toast notifications during import/export operations ("Reading import file...", "Importing profiles...", "Exporting profiles...")
- **Code Maintainability**: Replaced all hardcoded magic numbers with named constants:
  - `TOAST_DURATION_SHORT` (3000ms)
  - `TOAST_DURATION_LONG` (4000ms)
  - `TOAST_DURATION_LOADING` (10000ms)
  - `DEBOUNCE_DELAY` (100ms)
  - `FILE_DIALOG_TIMEOUT_SECS` (120s)
- **Documentation**: Added comment explaining `file.text()` browser compatibility (not an issue for Tauri apps using modern WebViews)

### Changed
- **UI Refinement**: Reduced spacing in About section (Settings modal) from 12px to 8px for a more compact layout
- **Window Constraints**: Added minimum window size constraints (600x450) to prevent UI from becoming unusable when resized too small

## [0.2.0] - 2024-12-20

### Added
- **Group Filtering**: Dropdown filter button to show/hide specific groups with persistent state across app restarts
- **Expand/Collapse All**: Button to expand or collapse all groups at once with dynamic text based on current state
- **Update Checker**: Manual update check button + auto-check on launch (toggleable in settings)
- **SSH Key Browser**: Browse button for SSH key selection with OS-specific hints for showing hidden files
  - Opens directly in ~/.ssh directory
  - macOS hint: "Press Cmd+Shift+. to show hidden files"
  - Windows hint: "Enable 'Show hidden files' in File Explorer settings"

### Fixed
- **Window Restoration**: Changed `window.hide()` to `window.minimize()` for proper dock/taskbar restoration
- **Password Deletion**: Fixed error when editing profiles with non-password authentication methods
- **Update Checker**: Changed from blocking to async HTTP to prevent UI freezing during update checks
- **Filter State**: Added debouncing to filter state updates to prevent race conditions
- **Memory Leak**: Implemented event delegation for profile card buttons to prevent memory leaks
- **File Dialogs**: Added 2-minute timeout to file dialogs to prevent indefinite hangs
- **Filter State Validation**: Added validation and user notification for corrupted localStorage filter data

### Changed
- **Smart Save Button**: Disabled until changes detected when editing existing profiles
- **Better Notifications**: Differentiated "Created" vs "Updated" messages for profiles
- **Spell Check**: Disabled on technical fields (hostname, username, port, key path, password, group)
- **Auth Method Rename**: Changed "None" to "None (Keyboard-Interactive)" for clarity
- **Filter Badge**: Shows number of selected groups (hidden when all groups selected)
- **Persistent Filters**: Group filter state persists across app restarts

## [0.1.2] - 2024-12-20

### Security
- **CRITICAL**: Fixed command injection vulnerability in SSH connection handler
  - Added comprehensive input validation for hostname, username, and port
  - Implemented proper shell escaping for all platforms (macOS, Windows, Linux)
  - Prevents arbitrary command execution via malicious profile data
- **HIGH**: Fixed path traversal vulnerability in SSH key paths
  - Key paths now validated to be within home directory
  - Prevents access to arbitrary filesystem locations
- **HIGH**: Added backend port validation (1-65535 range)
- **HIGH**: Fixed password deletion error handling (no longer silently fails)
- **MEDIUM**: Fixed stored XSS vulnerability via auth_method field
  - Consistent HTML escaping now applied to all user-controlled data
- **MEDIUM**: Enabled Content Security Policy for XSS protection
  - CSP configured to prevent content injection attacks

### Added
- Input validation functions for all user inputs:
  - `validate_hostname()` - prevents shell injection characters
  - `validate_username()` - max 32 chars, alphanumeric + _-. only
  - `validate_profile_name()` - max 100 chars, no control/HTML chars
  - `validate_port()` - ensures valid port range
  - `validate_key_path()` - restricts to safe filesystem locations

### Changed
- All profile creation and updates now validate inputs before database storage
- SSH connection process now validates all inputs before launching terminal
- Password deletion errors now properly propagated (not silently ignored)

### Fixed
- Command injection vulnerability (SEC-001) - CRITICAL
- Input validation missing (SEC-002) - CRITICAL
- Path traversal in SSH keys (SEC-003) - HIGH
- Port validation missing (SEC-004) - HIGH
- Password deletion silent failures (SEC-005) - HIGH
- Inconsistent HTML escaping (SEC-007) - MEDIUM
- Missing Content Security Policy (SEC-010) - MEDIUM

## [0.1.1] - 2024-12-20

### Added
- Version number now displayed in app header
- Author and AI assistant credits in About section
- Tauri shell plugin for opening external links

### Changed
- Default authentication method changed to "None (Prompt on Connect)" for new profiles
- Upgraded header icon from 32x32 to 128x128@2x for better visual quality
- SSH Key Path field now hidden by default (only shown when "SSH Key" auth method is selected)

### Fixed
- GitHub link in About section now opens correctly in system browser
- Tauri v2 permissions properly configured for shell operations and app window management
- Build errors related to missing shell plugin resolved

## [0.1.0] - 2024-12-19

### Added
- Initial release
- Profile management (create, edit, delete, duplicate)
- Three authentication methods: SSH Key, Password, None
- Organise profiles into collapsible groups
- Search and filter profiles
- Dark/Light theme with system preference detection
- Export/Import profiles to/from JSON
- Delete all profiles feature
- Custom confirmation dialogs
- Toast notifications (green for success, red for errors)
- Colour-coded action buttons
- Settings modal with About section
- One-click SSH connections (launches system terminal)
- App automatically minimises when connecting
- macOS Keychain integration for secure password storage
- SQLite database for profile storage
- GitHub Actions workflow for automated releases (macOS DMG only)

### Platform Support
- macOS (Apple Silicon / ARM64)
- Windows (builds but untested)
