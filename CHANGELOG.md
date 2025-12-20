# Changelog

All notable changes to SSH Profile Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
