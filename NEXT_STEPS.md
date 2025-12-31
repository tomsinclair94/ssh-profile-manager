# Next Steps - SSH Profile Manager v0.6.0

## Current Status (5/8 Phases Complete)

**Progress:** 62.5% complete - 5 phases done, 3 phases remaining

### Completed Phases:
1. ✅ Database Schema + Migration System
2. ✅ Recent Connections Backend
3. ✅ Keyboard Shortcuts
4. ✅ Embedded Terminal Core + PTY (single terminal - multi-tab in Phase 5)
7. ✅ Recent Connections UI (with comprehensive keyboard navigation)

### Remaining Phases:
5. ❌ Multi-Tab Terminal UI (tab bar, concurrent sessions)
6. ❌ Terminal Customization (fonts, colors, cursor, scrollback)
8. ❌ Testing & Documentation

### Pending Tasks (Before Phase 5):
⚠️ **Move Recent Connections to Bottom** - Relocate recent connections section from above profiles to below profiles for cleaner look
  - Move HTML elements in index.html
  - Update Tab cycling order in `getAllTabbableItems()` to reflect new position
  - Ensure keyboard navigation still works correctly
  - Test all keyboard shortcuts and Tab navigation after move

⚠️ **Filter Groups Popup Keyboard Control** - Add keyboard navigation for filter checkboxes within the popup (currently mouse-only)

### What Works:
- Database migration system
- Recent connections backend + UI (full implementation)
- Recent connections display with "time ago" formatting
- Collapse/expand recent connections with persistent state
- Keyboard shortcuts (all shortcuts working)
- Comprehensive Tab navigation (search → buttons → recent → groups)
- Group header keyboard navigation (Tab, Enter, Left/Right arrows)
- Confirmation dialog keyboard navigation (Tab cycling, Escape, focus trapping)
- Mouse/keyboard mode switching (blur on hover, refocus on Tab)
- Embedded terminal (single terminal only, no tabs yet)
- Terminal I/O, resize, clear, close
- Status badges
- Auto-scroll after resize

## Known Issues

### 🐛 Terminal Sizing Edge Case (Minor)
**Issue:** After extreme window resize sequences (very small → very large → very small), the terminal bottom line can be slightly cut off.

**Workaround:** Resize window slightly to trigger refit.

**Investigation Needed:**
- Deeper dive into xterm.js FitAddon behavior
- Consider alternative sizing strategies
- Maybe use ResizeObserver instead of window resize events
- Test with different xterm.js versions

**Priority:** Low (works fine in normal usage)

### 🐛 Recent Connections Scrollbar Hover (Minor)
**Issue:** Horizontal scrollbar doesn't appear on mouse hover - only becomes visible after scrolling with trackpad. Once visible, can click/drag with mouse.

**Current Behavior:** Works perfectly with trackpad/scroll gesture. Mouse requires initial scroll to make scrollbar visible.

**Investigation Needed:**
- macOS auto-hides scrollbars at system level, CSS alone can't override
- May need JavaScript-based solution to trigger scrollbar visibility on hover
- Explore alternatives like custom scrollbar overlay

**Priority:** Low (fully functional with trackpad, minor UX issue with mouse-only users)

## Next Steps

### Optional: Enhance Filter Groups Popup Keyboard Control

Before moving to Phase 5, optionally enhance the filter groups popup with:
- Arrow Up/Down to navigate checkboxes
- Space/Enter to toggle selection
- Escape to close popup
- Tab to cycle within popup
- Focus trapping

**Estimated time:** 30-45 minutes

### Phase 5: Multi-Tab Terminal UI

- Tab bar with multiple concurrent sessions
- Tab switching (click, Cmd+Tab, Cmd+Shift+Tab)
- "New Tab" button, "Close All" button
- Independent SSH sessions per tab

### Phase 6: Terminal Customization

- Font family/size settings
- Color scheme presets
- Cursor style settings
- Scrollback size settings
- Live preview in settings

### Phase 8: Testing & Documentation

- Comprehensive testing
- README updates
- Final polish

## Files Modified During v0.6.0 Development

**Backend (Rust):**
- `src-tauri/Cargo.toml` - Added portable-pty, database dependencies
- `src-tauri/src/lib.rs` - Migration system, session registry, recent connections, terminal commands

**Frontend:**
- `dist/index.html` - Recent connections section, xterm.js CDN, terminal modal, toggle button
- `dist/styles.css` - Recent connections styling, terminal styling, focus indicators, collapse states
- `dist/main.js` - Recent connections UI, comprehensive keyboard navigation, Tab cycling, confirmation dialog improvements, filter popup auto-close

**Documentation:**
- `CLAUDE.md` - Updated status, dependencies, known issues
- `NEXT_STEPS.md` - Progress tracking (5/8 phases complete)

## Quick Links

- **Todos:** 5/8 phases complete (see todo list)
- **Dev Server:** Run `npm run dev` from project root

---

**Phase 7 Complete! 62.5% done with v0.6.0. Next: Optional filter popup enhancement or Phase 5 Multi-Tab Terminal.**
