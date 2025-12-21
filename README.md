<div align="center">

# SSH Profile Manager

**A lightweight, native SSH profile manager built with Tauri and Rust**

[![macOS](https://img.shields.io/badge/macOS-14.0+-000000?style=flat&logo=apple&logoColor=white)](https://github.com/tomsinclair94/ssh-profile-manager/releases)
[![Windows](https://img.shields.io/badge/Windows-10+-0078D6?style=flat&logo=windows&logoColor=white)](https://github.com/tomsinclair94/ssh-profile-manager/releases)
[![Rust](https://img.shields.io/badge/Rust-1.77+-orange?style=flat&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?style=flat&logo=tauri&logoColor=white)](https://tauri.app/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.1-blue?style=flat)](https://github.com/tomsinclair94/ssh-profile-manager/releases)

### [📥 Download Latest Release (v0.2.1)](https://github.com/tomsinclair94/ssh-profile-manager/releases/latest)

<sub>**macOS 14.0+ | Windows 10+ | ~3-5 MB | Native Performance**</sub>

<sub>⚠️ **macOS Note:** Right-click and select "Open" on first launch to bypass Gatekeeper (unsigned app)</sub>

</div>

---

## Why SSH Profile Manager?

Tired of memorising SSH commands and digging through your bash history? Want a GUI for managing SSH connections but don't want to install a 100MB+ Electron app? SSH Profile Manager gives you the best of both worlds:

- **Lightweight:** ~3-5MB bundle size (vs 100MB+ for Electron apps)
- **Fast:** Built with Tauri and Rust for native performance
- **Secure:** Passwords stored in your system's keychain (macOS Keychain, Windows Credential Manager)
- **Simple:** Clean interface focused on managing and connecting to SSH hosts
- **Native:** Uses your system's terminal for actual SSH connections

## Features

### Profile Management
- Create, edit, delete, and duplicate SSH profiles
- Organise profiles into collapsible groups
- Search and filter profiles by name, host, or group
- Group filtering with persistent state
- Three authentication methods:
  - SSH Key (with file browser)
  - Password (securely stored in system keychain)
  - None (Keyboard-Interactive prompt)
- Export profiles to JSON for team sharing
- Import profiles from JSON

### Modern UI/UX
- Dark and Light themes with system preference detection
- Colour-coded action buttons for quick recognition
- Toast notifications for success/error feedback
- Smooth animations and hover effects
- Keyboard-friendly interface
- Minimum window size enforcement
- Auto-update checker (toggleable)

### SSH Connection
- One-click connect launches your system terminal
- App automatically minimises when connecting
- Terminal gets focus automatically
- Works with native terminals:
  - macOS: Terminal.app
  - Windows: Windows Terminal / cmd
  - Linux: gnome-terminal / konsole / xterm

## Installation

### macOS
1. Download the latest `.dmg` from [Releases](https://github.com/tomsinclair94/ssh-profile-manager/releases)
2. Open the DMG and drag "SSH Profile Manager" to Applications
3. Launch from Applications folder
4. **Important:** Right-click the app and select "Open" the first time to bypass Gatekeeper (or run `xattr -cr "/Applications/SSH Profile Manager.app"`)

### Windows
1. Download the latest `.msi` installer from [Releases](https://github.com/tomsinclair94/ssh-profile-manager/releases)
2. Run the installer
3. Launch from Start Menu

## Usage

### Creating a Profile
1. Click the "New Profile" button
2. Fill in the required fields:
   - **Name:** A unique identifier for this profile
   - **Host:** The SSH server address
   - **Username:** Your username on the remote server
3. Optional fields:
   - **Description:** Notes about this connection
   - **Port:** SSH port (defaults to 22)
   - **Group:** Organise profiles into groups
   - **Auth Method:** Choose how to authenticate

### Connecting
1. Find your profile in the list (use search if needed)
2. Click the green "Connect" button
3. Your system terminal will open with the SSH connection
4. The app minimises automatically

### Organising Profiles
- Use the **Group** field to organise related profiles
- Click the chevron (▶/▼) next to group names to collapse/expand
- Use the "Expand/Collapse Groups" button to toggle all groups at once
- Use the filter dropdown to show/hide specific groups
- Use the search bar to filter profiles

### Import/Export
- **Export:** Click Settings → Export Profiles to save all profiles to JSON
- **Import:** Click Settings → Import Profiles to load profiles from JSON
- Note: Importing replaces all existing profiles

## Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or later)
- [Rust](https://www.rust-lang.org/tools/install)
- Platform-specific dependencies:
  - **macOS:** Xcode Command Line Tools
  - **Windows:** Microsoft C++ Build Tools

### Setup
```bash
# Clone the repository
git clone https://github.com/tomsinclair94/ssh-profile-manager.git
cd ssh-profile-manager

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Building
```bash
# Build for production
npm run build

# Output locations:
# macOS: src-tauri/target/release/bundle/macos/
# Windows: src-tauri/target/release/bundle/msi/
```

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JavaScript (no framework bloat)
- **Backend:** Rust with Tauri v2
- **Database:** SQLite (rusqlite)
- **Secure Storage:** System keychain (keyring crate)
- **Build Tool:** Tauri CLI

## Project Structure

```
ssh-profile-manager/
├── dist/               # Frontend files (HTML, CSS, JS)
├── src-tauri/          # Rust backend
│   ├── src/           # Rust source code
│   ├── icons/         # App icons
│   └── Cargo.toml     # Rust dependencies
├── package.json       # Node dependencies
└── README.md          # This file
```

## Data Storage

- **Profiles:** SQLite database in application data directory
  - macOS: `~/Library/Application Support/ssh-profile-manager/profiles.db`
  - Windows: `%APPDATA%\ssh-profile-manager\profiles.db`
- **Passwords:** Stored securely in system keychain/credential manager

## Platform Support

- ✅ macOS (Apple Silicon / ARM64)
- ✅ Windows (builds via GitHub Actions)
- ⚠️ Linux (untested)

## License

MIT License - See [LICENSE](LICENSE) file for details

## Acknowledgements

Built with [Tauri](https://tauri.app/) - a framework for building tiny, fast binaries for all major platforms.

---

<div align="center">

**Author:** Tom Sinclair
**AI Assistant:** Claude (Anthropic)

[Report Issues](https://github.com/tomsinclair94/ssh-profile-manager/issues) • [View Releases](https://github.com/tomsinclair94/ssh-profile-manager/releases)

</div>
