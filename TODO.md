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

#### Bug Fixes (v0.6.3-dev branch)
- ✅ Auto-Close Terminal Tabs (macOS) - Fixed AppleScript to close selected tab instead of window
- ✅ Password Authentication - Added keyring native features (apple-native, windows-native, linux-native)
- ✅ Windows Icon Background - Regenerated .ico with transparency using ImageMagick
- ✅ Profile Content Auto-sizing - Improved responsive layout with tooltips and flexible sizing
- ✅ Windows Terminal Tab Setting - Fixed default case to respect user preference

#### UI Enhancements (v0.6.3-dev branch)
- ✅ Password Visibility Toggle - Show/Hide button (text-based, fixed 65px width)
- ✅ Profile Card Spacing - Better horizontal space utilization on wide screens
- ✅ Field Sizing - User/Host/Auth fields size naturally to content
- ✅ Auth Field Protection - Never truncates or gets cut off
- ⚠️ **IN PROGRESS:** User/Host field truncation behavior refinement

### Remaining Tasks

#### Profile Card Field Truncation (In Progress)
**Status:** Near completion, needs final tuning

**Current Behavior:**
- User field: Minimum 16ch, sizes naturally when short
- Host field: Up to 80ch, can truncate
- Auth field: Never truncates, always full

**Issue to Resolve:**
- Need to fine-tune truncation priority and ellipsis display
- User field should show ellipsis when truncated
- Host field should shrink with ellipsis before Auth gets affected
- Short usernames (e.g., "username" = 8 chars) should not have gaps

**Commits:** 24 commits total (13 new commits for UI enhancements)

#### Windows Testing (Requires Windows Machine)
**Status:** Code review completed, manual testing required

**Test Checklist:**
1. **Windows Terminal Integration**
   - [ ] Test new-tab mode with "Open profiles in new tabs" enabled
   - [ ] Test new-window mode with setting disabled
   - [ ] Verify SSH sessions work correctly
   - [ ] Check tab/window auto-close after SSH exits

2. **Command Prompt (cmd)**
   - [ ] Test SSH connections launch correctly
   - [ ] Verify window closes after SSH session ends

3. **PowerShell**
   - [ ] Test SSH connections with PowerShell
   - [ ] Verify proper argument escaping (test with spaces, quotes)
   - [ ] Check window closes after session

4. **Icon Display**
   - [ ] Verify app icon has transparent background (no white box)
   - [ ] Check taskbar, start menu, and title bar icons

5. **Password Authentication**
   - [ ] Create profile with password auth
   - [ ] Verify password saves to Windows Credential Manager
   - [ ] Edit profile and verify password retrieves correctly
   - [ ] Export/import profiles with passwords

6. **Custom Terminal**
   - [ ] Test with custom terminal path (if available)
   - [ ] Verify batch script execution and cleanup

7. **General UI**
   - [ ] Check profile card info display (User/Host/Auth)
   - [ ] Verify tooltips show full values on hover
   - [ ] Test responsive layout at different window sizes

### Branch Status
- **Files Modified:** lib.rs, Cargo.toml, index.html, main.js, styles.css, icon.ico, TODO.md
- **Commits:** 24 commits (11 bug fixes + 13 UI enhancements)
- **Last Updated:** 2025-01-05

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
