# Changelog

All notable changes to SSH Profile Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
