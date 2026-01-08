# SSH Profile Manager - TODO & Roadmap

## Current Version: v0.6.4-dev

**Status:** In Development (Started 2025-01-06)
**Type:** Bug Fix Release
**Branch:** Not yet created

---

## v0.6.3 - Released ✅

**Released:** 2025-01-06
**Type:** Security hardening and bug fixes
**Branch:** `v0.6.3-dev` → merged to main via PR #14

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
- ✅ Profile Card Redesign - Vertical layout (User/Host stacked), no truncation issues
  - Removed Auth field (less critical information)
  - Removed description text display (now shows as tooltip on hover)
  - Fixed tooltip behavior: description shows on header/info hover only
  - Fixed tooltip hit areas: field tooltips only appear over actual text

#### Version Management
- ✅ Bumped version to 0.6.3 across all 7 locations
- ✅ Updated CLAUDE.md to clarify version bumping as first step in new dev branch

### Security & Code Review Fixes (v0.6.3)

#### Completed Security Fixes
- ✅ **Critical #1:** Replaced all 26 mutex `.unwrap()` calls with proper error handling
  - Database methods: Use `.expect()` with descriptive messages
  - Registry/rate limit mutexes: Use `.map_err()` for graceful error conversion
- ✅ **Critical #2:** Reduced temporary script cleanup delay from 5s to 2s
  - macOS: Line 2249 (custom terminal script)
  - Windows: Line 2447 (batch script)
  - Minimizes exposure window while allowing terminal to execute
- ✅ **Critical #3:** Gated password logging behind `#[cfg(debug_assertions)]`
  - Removed password operation logs from production builds
  - Logs only appear in debug builds
- ✅ **High #6:** Fixed CSP inconsistency between HTML and config
  - Added `https://cdn.jsdelivr.net` to script-src and style-src (for xterm.js)
  - Added `ipc://localhost` to connect-src
  - Added `frame-ancestors 'none'` to HTML for consistency
- ✅ **Medium #8:** Added profile count validation to import (max 1000)
  - Prevents resource exhaustion via massive profile imports
  - Line 1157-1165 in lib.rs
- ✅ **Medium #9:** Added settings import size limit (1MB max)
  - Prevents resource exhaustion via large JSON payloads
  - Line 1326-1334 in lib.rs

#### Deferred to v0.6.4 (Low Priority)
- [ ] **Console Logging Cleanup:** 76 console.log statements in production JS
  - Priority: Low (cosmetic, development aid)
  - Impact: Minor performance overhead
- [ ] **innerHTML Audit:** 13 instances (already properly escaped via `escapeHtml()`)
  - Priority: Low (already secure, defense-in-depth review)
  - Note: Consider templating library for future versions
- [ ] **Database File Permissions:** Explicit 0600 permissions on profiles.db
  - Priority: Low (macOS provides default protection)
  - Enhancement: Add explicit hardening for defense-in-depth
- [ ] **Rate Limiting Refinement:** Add per-session limits for terminals
  - Priority: Low (current limits acceptable)
  - Suggestion: Max 5 concurrent sessions, exponential backoff
- [ ] **Function Complexity:** Refactor long functions (e.g., `connect_ssh` 300+ lines)
  - Priority: Low (code quality improvement)
  - Target: Cyclomatic complexity < 10 per function
- [ ] **Terminal Dimension Limits:** Consider reducing from 300×100 to 250×80
  - Priority: Low (current limits reasonable)
  - Current: 30,000 cells max, suggested: 20,000 cells
- [ ] **SRI Hashes:** Add Subresource Integrity for CDN resources
  - Priority: Low (nice-to-have security enhancement)
  - Applies to xterm.js from cdn.jsdelivr.net
- [ ] **Production Devtools:** Disable devtools in production builds
  - Priority: Low (currently enabled in tauri.conf.json:19)
  - Change: `"devtools": true` → `"devtools": false`

### Windows Testing Results (v0.6.3)

**Status:** Testing completed on ARM Windows VM (2025-01-06)

#### ✅ Verified Working
- **Password Authentication**: Passwords store and retrieve correctly from Windows Credential Manager
- **UI Elements**: All UI components functioning as expected (profile cards, tooltips, modals)
- **CMD Terminal**: SSH connections launch successfully
- **PowerShell Terminal**: SSH connections launch successfully
- **General UI**: Profile card layout, tooltips, and responsive design working correctly

#### ❌ Issues Found (to fix in v0.6.4)
See v0.6.4 section below for details.

### Release Information
- **Release Date:** 2025-01-06
- **Pull Request:** [#14](https://github.com/tomsinclair94/ssh-profile-manager/pull/14) - Merged ✅
- **GitHub Release:** [v0.6.3](https://github.com/tomsinclair94/ssh-profile-manager/releases/tag/v0.6.3)
- **Binaries:** Windows (x64), macOS (aarch64)
- **Infrastructure Fix:** Auto-tag workflow now uses PAT_TOKEN (PR #15) - Merged ✅

---

## v0.6.4 - Bug Fix Release (In Development)

**Status:** Implementation Complete - Pending Testing
**Started:** 2025-01-06
**Updated:** 2025-01-08
**Focus:** Fix Windows Terminal tab issues and auto-close behavior discovered during v0.6.3 testing

**Progress:**
- ✅ Windows Terminal tab/window mode fixes implemented (commit f4b4c38)
- ✅ Auto-close behavior fixes implemented for all Windows terminal types
- ⏳ Testing blocked on ARM64 Windows VM (requires clang/LLVM for Tauri CLI compilation)
- 🔨 Installing build tools to enable testing

### Issues to Fix

#### 1. Windows Terminal Tab Mode Not Working
**Priority:** HIGH
**Status:** ✅ Fixed - Pending Testing

**Problem:**
- Setting "Open profiles in new tabs" enabled still opens new windows in Windows Terminal
- User workaround exists: Set Windows Terminal "New instance behaviour" → "Attach to the most recently used window"
- Users shouldn't need to change Windows Terminal settings for the app to work correctly

**Root Cause:**
- App used `wt new-tab` command which doesn't force tab behavior without Windows Terminal configuration change
- Needed proper command arguments to force tab behavior

**Solution Implemented:**
- Updated `launch_windows_terminal()` to use `wt -w 0 new-tab` to target the most recently used window (window ID 0)
- This forces tab creation in existing window without requiring user to change Windows Terminal settings
- Location: `src-tauri/src/lib.rs:2412-2414` (commit f4b4c38)

---

#### 2. Windows Terminal Window Mode Error
**Priority:** HIGH
**Status:** ✅ Fixed - Pending Testing

**Problem:**
- When "Open profiles in new tabs" is disabled (force new window mode), error occurs: "window not found"
- New window mode should work without requiring existing window

**Root Cause:**
- Implementation was incorrectly targeting a window ID when window mode was selected
- `wt new-window` should not reference any window ID

**Solution Implemented:**
- Updated `launch_windows_terminal()` to use `wt new-window` without window ID targeting
- Tab and window modes now properly separated with correct arguments
- Location: `src-tauri/src/lib.rs:2416-2417` (commit f4b4c38)

---

#### 3. Auto-Close Terminal Tab Not Working (macOS)
**Priority:** MEDIUM
**Status:** ⏸️ Deferred - Requires macOS Environment

**Problem:**
- AppleScript error when trying to close tab after SSH session ends:
  ```
  Terminal got an error: selected tab of window 1 doesn't understand the "close" message. (-1708)
  ```
- v0.6.3 attempted to fix this but the error persists

**Root Cause:**
- AppleScript syntax for closing tabs may be incorrect
- May need different approach (close window instead, or use different AppleScript object reference)

**Next Steps:**
- Deferred to when macOS environment is available for testing
- Review AppleScript in lib.rs for macOS terminal auto-close
- Test alternative approaches:
  - `close (selected tab of window 1)`
  - `close window 1` (if only one tab exists)
  - Check Terminal.app AppleScript dictionary for correct syntax

---

#### 4. Auto-Close Terminal Tab Not Working (Windows)
**Priority:** MEDIUM
**Status:** ✅ Fixed - Pending Testing

**Problem:**
- After SSH session ends, terminal displays: "You can now close this terminal with Ctrl+D"
- Window/tab doesn't close automatically

**Root Cause:**
- Windows Terminal/CMD/PowerShell don't auto-close after SSH process exits by default
- Needed explicit exit commands after SSH session

**Solution Implemented:**
All Windows terminal types now auto-close after SSH session ends:

1. **CMD** - Added `& exit` after SSH command
   - Location: `src-tauri/src/lib.rs:2334-2338`

2. **PowerShell** - Added `; exit` after SSH command
   - Location: `src-tauri/src/lib.rs:2370-2371`

3. **Windows Terminal** - Uses PowerShell wrapper with `; exit`
   - Location: `src-tauri/src/lib.rs:2393-2408`

4. **Custom Terminal** - Batch script auto-closes on success, pauses only on errors
   - Shows "Connection failed. Press any key to close..." on SSH errors
   - Auto-closes silently on successful disconnect
   - Location: `src-tauri/src/lib.rs:2436-2447`

All changes in commit f4b4c38

---

#### 5. Windows App Icon Background Issue
**Priority:** MEDIUM
**Status:** Awaiting screenshot from user

**Problem:**
- Icon appears to have background issue (details pending)
- v0.6.3 attempted transparency fix but issue may persist

**Next Steps:**
- User to provide screenshot showing the issue
- Investigate icon.ico generation process
- May need to regenerate with different tool or settings

---

### Code Review Items (from v0.6.3)

#### 6. Console Logging Cleanup
**Priority:** LOW
**Status:** Not started

**Problem:**
- 76 `console.log/error/warn` statements in production JavaScript (dist/main.js)
- Causes minor performance overhead and clutters browser console

**Solution:**
- Wrap logs with development-only checks or remove non-essential logs
- Consider logging utility that respects environment

---

#### 7. innerHTML Audit
**Priority:** LOW
**Status:** Not started

**Problem:**
- 13 instances of `innerHTML` usage in main.js
- Already properly escaped via `escapeHtml()` but could be more secure with DOM manipulation

**Solution:**
- Audit all HTML construction to ensure `escapeHtml()` is always used
- Consider replacing innerHTML with DOM manipulation (textContent/createElement)
- Low priority as current implementation is already secure

---

#### 8. Database File Permissions Hardening
**Priority:** LOW
**Status:** Not started

**Problem:**
- profiles.db doesn't have explicitly set permissions
- macOS provides default protection but explicit hardening would be better

**Solution:**
- Set 0600 permissions on profiles.db after creation (owner read/write only)
- Add for defense-in-depth security

---

#### 9. Rate Limiting Refinement
**Priority:** LOW
**Status:** Not started

**Problem:**
- Current rate limits may allow resource exhaustion in edge cases
- Terminal session creation: 2-second cooldown allows 30 sessions/minute

**Solution:**
- Add per-session limits (e.g., max 5 concurrent sessions)
- Implement exponential backoff for repeated attempts
- Monitor thread count and memory usage

---

#### 10. Function Complexity Refactoring
**Priority:** LOW
**Status:** Not started

**Problem:**
- Some functions are very long (e.g., `connect_ssh` 300+ lines)
- High cyclomatic complexity makes maintenance harder

**Solution:**
- Refactor into smaller functions
- Target cyclomatic complexity < 10 per function
- Extract platform-specific code into separate functions

---

#### 11. Terminal Dimension Limits
**Priority:** LOW
**Status:** Not started

**Problem:**
- Current limits (300×100 = 30,000 cells max) may be higher than necessary

**Solution:**
- Consider reducing to 250×80 (20,000 cells max)
- More reasonable limits for typical use cases

---

#### 12. SRI Hashes for CDN Resources
**Priority:** LOW
**Status:** Not started

**Problem:**
- xterm.js loaded from cdn.jsdelivr.net without Subresource Integrity hashes
- Could be compromised if CDN is attacked

**Solution:**
- Add SRI hashes to xterm.js script/style tags in index.html
- Example: `integrity="sha384-..." crossorigin="anonymous"`

---

#### 13. Disable Devtools in Production
**Priority:** LOW
**Status:** Not started

**Problem:**
- Devtools currently enabled in production builds (tauri.conf.json:19)
- `"devtools": true`

**Solution:**
- Change to `"devtools": false` for production builds
- Prevents users from accessing developer tools in release builds

---

## Post-v0.6.3 Tasks (Before Next Dev Release)

### Setup Private Backup Repository ✅
**Status:** Complete (2025-01-08)
**Goal:** Backup all development files (CLAUDE.md, TODO.md, plans/, etc.) to private GitHub repo

**Completed:**
1. ✅ Created private GitHub repo: `ssh-profile-manager-private`
2. ✅ Added private remote: `git remote add private git@github.com:tomsinclair94/ssh-profile-manager-private.git`
3. ✅ Created `all-files` branch from `main`
4. ✅ Force-added ignored files: CLAUDE.md, TODO.md, plans/
5. ✅ Pushed to private remote
6. ✅ Configured SSH key for GitHub authentication
7. ✅ Added backup workflow instructions to CLAUDE.md

**Workflow:** See CLAUDE.md "Private Backup Repository" section for checkpoint backup instructions.

---

## Roadmap

```
v0.6.2 ✅ → v0.6.3 ✅ → v0.6.4 (in progress) → v0.7.0 → v0.8.0 → v0.9.0 → v1.0.0
```

### v0.6.4 - Bug Fix Release
**Status:** In Progress
**Focus:** Fix Windows Terminal tab behavior and auto-close issues from v0.6.3 testing

**Issues:**
- Windows Terminal tab mode not working (HIGH)
- Windows Terminal window mode error (HIGH)
- Auto-close terminal tabs (macOS/Windows) (MEDIUM)
- Windows icon background fix (MEDIUM)

### v0.7.0 - User Testing Enhancements
**Status:** Planned
**Focus:** Enhancements and features identified from user testing

**Potential Features:**
- TBD based on feedback after v0.6.4

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
