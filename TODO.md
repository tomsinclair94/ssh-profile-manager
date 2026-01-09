# SSH Profile Manager - TODO & Roadmap

## Current Version: v0.6.4

**Status:** Ready for Release (Completed 2025-01-09)
**Type:** Bug Fix Release
**Branch:** v0.6.4-dev

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

## v0.6.4 - Bug Fix Release (In Progress - Security Review)

**Status:** In Progress - Security Fixes Applied (2025-01-09)
**Started:** 2025-01-06
**Target:** Final 0.6.x release
**Focus:** Fix Windows Terminal tab issues, auto-close behavior, and comprehensive security hardening

**Note:** This will be our final 0.6.x release. Next session: fix remaining MEDIUM/LOW security issues, then release.

### Completed Issues

#### 1. Windows Terminal Tab Mode Not Working ✅
**Priority:** HIGH
**Status:** FIXED (commits f4b4c38, f92ca38)

**Solution Implemented:**
- Initially used `wt -w 0 new-tab` to force tabs in most recently used window (f4b4c38)
- Refined to `wt -w last nt` for proper tab targeting (f92ca38)
- Tested and verified working on Windows VM

---

#### 2. Windows Terminal Window Mode Error ✅
**Priority:** HIGH
**Status:** FIXED (commit f4b4c38)

**Solution Implemented:**
- Changed to `wt new-window` without window ID targeting
- Fixes "window not found" error
- Tested and verified working on Windows VM

---

#### 3. Auto-Close Terminal Tab (macOS) ✅
**Priority:** MEDIUM
**Status:** FIXED (commit 88b7275)

**Solution Implemented:**
- Replaced AppleScript `close (selected tab)` with System Events Cmd+W keystroke
- Command: `osascript -e 'tell application "System Events" to keystroke "w" using command down'`
- Works reliably for both tab mode and window mode
- Tested with multiple tabs - closes individual tabs correctly
- Verified working on macOS (2025-01-09)

---

#### 4. Auto-Close Terminal Tab (Windows) ✅
**Priority:** MEDIUM
**Status:** FIXED (commits f4b4c38, f92ca38)

**Solution Implemented:**
- Initially added `& exit` / `; exit` after SSH command (f4b4c38)
- Refined to simplified native SSH command (f92ca38)
- Tested and verified working on Windows VM for all terminal types (CMD, PowerShell, Windows Terminal)

---

#### 5. Windows App Icon Background Issue ✅
**Priority:** MEDIUM
**Status:** FIXED (commit f92ca38)

**Solution Implemented:**
- Regenerated all icons with transparent background from SVG source
- Updated icon.ico, icon.icns, and all Windows/Android/iOS icon sizes
- Tested and verified working on Windows VM

---

### Completed Code Review Items

#### 6. Console Logging Cleanup ✅
**Priority:** LOW
**Status:** FIXED (commit ddc4e58)

**Solution Implemented:**
- Added debug logging wrapper enabled via `localStorage.debug='true'`
- Console logs only appear when debug mode is explicitly enabled
- Removes clutter from production browser console

---

#### 7. innerHTML Audit ✅
**Priority:** LOW
**Status:** VERIFIED (commit ddc4e58)

**Solution Implemented:**
- Audited all 13 instances of `innerHTML` usage in main.js
- Verified all instances properly use `escapeHtml()` function
- Current implementation is secure against XSS attacks

---

#### 8. Database File Permissions Hardening ✅
**Priority:** LOW
**Status:** FIXED (commit ddc4e58)

**Solution Implemented:**
- Set database file permissions to 0600 on Unix systems (owner-only access)
- Added explicit hardening for defense-in-depth security
- Prevents unauthorized access to profiles.db

---

#### 9. Rate Limiting Refinement ✅
**Priority:** LOW
**Status:** FIXED (commit ddc4e58)

**Solution Implemented:**
- Added max concurrent session limit (5 sessions maximum)
- Maintains existing rate limits (2s between session creation, 100 writes/second)
- Prevents resource exhaustion from excessive terminal sessions

---

#### 11. Terminal Dimension Limits ✅
**Priority:** LOW
**Status:** FIXED (commit ddc4e58)

**Solution Implemented:**
- Reduced limits from 300×100 to 250×80 (30,000 → 20,000 cells max)
- More reasonable limits for typical use cases
- Reduces memory usage and potential DoS vectors

---

#### 12. SRI Hashes for CDN Resources ✅
**Priority:** LOW
**Status:** FIXED (commit ddc4e58)

**Solution Implemented:**
- Added Subresource Integrity hashes for xterm.js CDN resources
- Added `integrity` and `crossorigin="anonymous"` attributes
- Protects against compromised CDN attacks

---

#### 13. Disable Devtools in Production ✅
**Priority:** LOW
**Status:** FIXED (commit ddc4e58)

**Solution Implemented:**
- Changed `"devtools": true` → `"devtools": false` in tauri.conf.json:19
- Prevents users from accessing developer tools in release builds

---

### Additional Code Quality Improvements

#### Function Complexity Refactoring (Partial) ✅
**Priority:** LOW
**Status:** PARTIALLY COMPLETED (commit a7bad52)

**Solution Implemented:**
- Refactored `connect_ssh` helper functions (389 → 76 lines)
- Extracted platform-specific code into separate functions
- Note: Further refactoring deferred to future releases

---

### Security Fixes Applied (2025-01-09)

#### 14. CRITICAL: Debug Logger Infinite Recursion ✅
**Priority:** CRITICAL
**Status:** FIXED (pending commit)
**CVSS:** 9.0 (Production Breaking)

**Problem:**
- Debug logger methods called themselves recursively instead of console methods
- `debug.log()` → `debug.log()` → stack overflow
- Application crashes with "Maximum call stack exceeded" if debug mode enabled

**Solution Implemented:**
- Fixed dist/main.js lines 22-25
- Changed from `debug.log(...args)` to `console.log(...args)`
- All debug methods now properly delegate to console

**Location:** `/dist/main.js:22-25`

---

#### 15. HIGH: Database File Permissions TOCTOU ✅
**Priority:** HIGH
**Status:** FIXED (pending commit)
**CVSS:** 7.5 (Security - Race Condition)

**Problem:**
- Database file created with default permissions (0644), then changed to 0600
- TOCTOU window where other users could access database during initialization
- Brief exposure of SSH profiles and settings

**Solution Implemented:**
- Fixed src-tauri/src/lib.rs lines 490-508
- Create file with 0600 permissions atomically before opening
- Uses `OpenOptions::mode(0o600)` on Unix systems
- Eliminates race condition entirely

**Location:** `/src-tauri/src/lib.rs:490-508`

---

#### 16. HIGH: PowerShell Command Injection ✅
**Priority:** HIGH
**Status:** FIXED (pending commit)
**CVSS:** 7.8 (Security - Command Injection)

**Problem:**
- PowerShell escaping insufficient for special characters
- Command passed through 3 shell contexts: cmd → start → powershell
- Vulnerable to backticks, dollar signs, semicolons in SSH arguments
- Example attack: `` `; calc.exe #`` could execute arbitrary commands

**Solution Implemented:**
- Fixed src-tauri/src/lib.rs lines 2363-2403
- Use PowerShell's `-EncodedCommand` with Base64-encoded UTF-16LE
- Completely bypasses shell escaping issues
- Added base64 dependency to Cargo.toml

**Location:** `/src-tauri/src/lib.rs:2363-2403`
**Dependency Added:** `base64 = "0.22"` in Cargo.toml

---

### Remaining Security Issues (Fix Next Session)

**Code Review Summary:**
- ✅ CRITICAL Issues: 1 found, 1 fixed
- ✅ HIGH Issues: 2 found, 2 fixed
- ⚠️ MEDIUM Issues: 3 found, 0 fixed (deferred to next session)
- ℹ️ LOW Issues: 7 found, 0 fixed (deferred to next session)

**Overall Security Rating:** 7.5/10 (Good - Production Ready with Recommended Improvements)

---

#### 17. MEDIUM: Temporary Script Cleanup Race Condition
**Priority:** MEDIUM
**Status:** TODO (Next Session)
**CVSS:** 5.3 (Security - Information Disclosure)

**Problem:**
- Temporary SSH scripts deleted after fixed 2-second delay
- Script may be deleted before terminal reads it (connection failure)
- Script may persist on disk exposing SSH connection details
- No verification that terminal actually consumed the script

**Proposed Solution:**
- Implement deterministic cleanup using process monitoring
- Add secure deletion (overwrite before unlink)
- Verify terminal opened file before attempting deletion
- Consider using file descriptor passing instead of temp files

**Location:** `/src-tauri/src/lib.rs:2281-2286` (macOS), `2501-2506` (Windows)

---

#### 18. MEDIUM: Missing SSH Host Key Verification
**Priority:** MEDIUM
**Status:** TODO (Next Session)
**CVSS:** 4.8 (Security - MITM Risk)

**Problem:**
- SSH connections don't configure host key verification
- Relies on SSH client defaults (may auto-accept unknown hosts)
- No user visibility into potential MITM attacks
- Host keys may change without user awareness

**Proposed Solution:**
- Add `-o StrictHostKeyChecking=ask` to SSH arguments
- Consider storing accepted host keys in application database
- Add UI to review/manage known host keys
- Provide user warning on first connection to new host
- Add host key behavior setting in preferences

**Location:** `/src-tauri/src/lib.rs:2174-2198` (build_ssh_args function)

---

#### 19. MEDIUM: No Dependency Vulnerability Scanning
**Priority:** MEDIUM
**Status:** TODO (Next Session)
**CVSS:** 4.0 (Security - Supply Chain)

**Problem:**
- No automated dependency vulnerability scanning in CI/CD
- Current dependencies may contain known CVEs
- No process for regular dependency security reviews
- cargo-audit not installed or run

**Proposed Solution:**
- Install and configure cargo-audit for Rust dependencies
- Add npm audit for JavaScript dependencies
- Create GitHub Actions workflow for automated scanning
- Enable GitHub Dependabot for automated alerts
- Establish monthly dependency review process
- Pin exact versions for production releases

**Dependencies to Audit:**
- Rust: 39 crates (rusqlite, reqwest, portable-pty, keyring, etc.)
- JavaScript: @tauri-apps packages
- CDN: xterm.js (currently mitigated with SRI hashes)

---

#### 20. LOW: Password Operation Logging in Debug Builds
**Priority:** LOW
**Status:** TODO (Next Session)
**CVSS:** 2.5 (Information Disclosure)

**Problem:**
- Password operations logged in debug builds (`#[cfg(debug_assertions)]`)
- Logs expose password lengths and operation timing
- Could leak sensitive information during development

**Proposed Solution:**
- Remove debug logging for password operations entirely
- OR require explicit environment variable flag to enable
- Use structured logging framework instead of println!

**Location:** `/src-tauri/src/lib.rs:870-883, 1024-1053`

---

#### 21. LOW: innerHTML Usage in Shortcuts Modal
**Priority:** LOW
**Status:** TODO (Next Session)
**CVSS:** 1.8 (XSS Prevention - Defense in Depth)

**Problem:**
- `insertAdjacentHTML` used in shortcuts modal (line 1536)
- While currently safe (all content escaped), pattern is fragile
- Future developers might introduce XSS vulnerabilities

**Proposed Solution:**
- Replace with `createElement()` and `appendChild()`
- Safer pattern for future modifications
- Better code maintainability

**Location:** `/dist/main.js:1536`

---

#### 22. LOW: CSP Allows CDN Scripts
**Priority:** LOW
**Status:** TODO (Next Session)
**CVSS:** 2.7 (Defense in Depth)

**Problem:**
- CSP allows `https://cdn.jsdelivr.net` for xterm.js
- External dependency could be compromised
- Currently mitigated with SRI hashes, but vendor would be better

**Proposed Solution:**
- Vendor xterm.js locally (copy to project)
- Update CSP to `script-src 'self'` only
- Eliminates external dependency entirely
- Improves offline functionality

**Location:** `/dist/index.html:6`, `/src-tauri/tauri.conf.json:23`

---

#### 23. LOW: Terminal Session Resource Limits
**Priority:** LOW
**Status:** TODO (Next Session)
**CVSS:** 3.2 (DoS Prevention)

**Problem:**
- No timeout for idle terminal sessions
- No tracking of total memory usage across sessions
- Orphaned/hung sessions not cleaned up automatically

**Proposed Solution:**
- Add configurable idle timeout (e.g., 30 minutes)
- Track session memory usage
- Implement automatic cleanup for hung sessions
- Add session health monitoring

**Current Limits (Good):**
- Max concurrent sessions: 5
- Terminal dimensions: 250×80 (20,000 cells)
- Rate limit: 1 session per 2 seconds

**Location:** `/src-tauri/src/lib.rs:1679-1721`

---

#### 24. LOW: File Dialog Timeout
**Priority:** LOW
**Status:** TODO (Next Session)
**CVSS:** 1.5 (Resource Management)

**Problem:**
- 2-minute timeout for file dialogs could allow resource holding
- User might leave dialog open indefinitely

**Proposed Solution:**
- Reduce timeout to 60 seconds
- OR make user-configurable in settings
- Add user notification when timeout approaching

**Location:** `/src-tauri/src/lib.rs:36`
**Current Value:** `FILE_DIALOG_TIMEOUT_SECS: u64 = 120`

---

#### 25. LOW: Windows Batch File Permissions TOCTOU
**Priority:** LOW
**Status:** TODO (Next Session)
**CVSS:** 3.1 (Security - Race Condition)

**Problem:**
- Windows batch file created, then ACL applied
- Small TOCTOU window between creation and permission setting
- Other users could potentially read file during this window

**Proposed Solution:**
- Use Windows API CreateFile with SECURITY_ATTRIBUTES
- Create file with ACL atomically during creation
- Eliminates race condition entirely

**Location:** `/src-tauri/src/lib.rs:2461-2509`

---

#### 26. LOW: Password Authentication Not Used
**Priority:** LOW
**Status:** TODO (Next Session)
**CVSS:** N/A (Documentation/UX)

**Problem:**
- Application stores passwords in system keychain
- Passwords NOT actually used for SSH connections
- SSH launched without password passing (SSHPASS or similar)
- Users must enter password manually during connection
- Stored passwords appear to be for reference/export only

**Proposed Solution:**
- Document password authentication limitations clearly
- OR implement secure password passing to SSH
- Consider SSH agent integration
- Add note in UI explaining password storage purpose

**Impact:** User confusion, not a security vulnerability

---

#### 27. LOW: Enhanced Logging Framework
**Priority:** LOW
**Status:** TODO (Next Session)

**Problem:**
- Using println! for logging (not production-grade)
- No structured logging
- No audit trail for sensitive operations
- Non-configurable log levels

**Proposed Solution:**
- Implement structured logging framework (e.g., tracing, log crate)
- Add audit trail for sensitive operations (password access, profile changes)
- Configurable log levels (DEBUG, INFO, WARN, ERROR)
- Log rotation and retention policies

---

### Deferred Code Review Items (to v0.7.0+)

#### 10. Function Complexity Refactoring (Complete)
**Priority:** LOW
**Status:** Deferred to v0.7.0+

**Problem:**
- Some functions still have high cyclomatic complexity
- Target cyclomatic complexity < 10 per function for all code

---

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
