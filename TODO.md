# SSH Profile Manager - TODO & Roadmap

## Current Version: v0.6.3-dev

**Status:** In Development (Started 2025-01-05)
**Type:** Bug Fix Release
**Branch:** `v0.6.3-dev` (pushed to GitHub, not merged)

### Completed (v0.6.3)

#### Infrastructure Fixes (merged to main)
- ✅ Auto-Tag CHANGELOG Extraction Fix - PR #12
- ✅ Installer Bundle Zip - PR #13

#### Features (v0.6.3-dev branch)
- ✅ Terminal Tab Setting - "Open profiles in new tabs" checkbox
  - macOS Terminal: Cmd+T via AppleScript
  - Windows Terminal: `wt new-tab` vs `wt new-window`
  - Persists to localStorage, exports/imports correctly
  - **Known Issue:** Auto-close after SSH exit not working on macOS

### Active Bugs (v0.6.3)

1. **Fix Auto-Close Terminal Tabs** (macOS) - Current osascript approach not working
2. **Password Authentication Not Working** - Passwords not being stored in keychain (keyring library reports success but macOS Keychain shows no entries)
3. **Windows Icon Background** - Icon still has white background
4. **Profile Content Auto-sizing** - Optimize display of User/Host/Auth fields
5. **Windows Testing** - Full testing to find Windows-specific bugs

### Branch Status
- **Files Modified:** lib.rs, index.html, main.js
- **Commits:** 6 commits

---

## Roadmap

```
v0.6.2 ✅ → v0.6.3 (in progress) → v0.7.0 → v0.8.0 → v0.9.0 → v1.0.0
```

### v0.7.0 - User Testing Enhancements
**Status:** Planned
**Focus:** Enhancements and features identified from user testing

**Potential Features:**
- TBD based on feedback after v0.6.3

### v0.8.0 - Multi-Tab System
**Status:** Planned
**Focus:** App-level tabs, pop-out windows

See `plans/v0.8.0-multi-tab-system.md` for detailed plan.

### v0.9.0 - Terminal Customization
**Status:** Planned
**Focus:** Fonts, color schemes, accessibility

See `plans/v0.9.0-terminal-customization.md` for detailed plan.

### v1.0.0 - Major Refactoring Sprint
**Status:** Planned
**Focus:** 40-50% complexity reduction, stable release

---

## Feature Backlog

### Medium Priority
- SFTP support
- Port forwarding
- Jump hosts
- Color tags for profiles
- Group management UI
- Profile favorites

### Low Priority
- Cloud sync
- SSH config import
- Custom icons for profiles

---

## Known Issues Archive

### Dismissed in v0.5.2
_(with justification to prevent re-flagging)_
1. **Verbose error messages** - Desktop app context, users have filesystem access
2. **Duplicate validation** - Intentional defense-in-depth architecture
3. **Empty state grammar** - Cosmetic, messages clear
4. **No integrity check on backups** - Comprehensive validation makes HMAC redundant

### macOS Code Signing
- DMGs show "damaged" (not code-signed)
- **Workaround:** Right-click → Open or `xattr -cr "/Applications/SSH Profile Manager.app"`
