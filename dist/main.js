/*
 * SSH Profile Manager
 * Copyright (C) 2025 Thomas Sinclair
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// Debug logging - only enabled in development (can be toggled via localStorage)
const DEBUG = localStorage.getItem('debug') === 'true' || false;
const debug = {
    log: (...args) => DEBUG && console.log(...args),
    warn: (...args) => DEBUG && console.warn(...args),
    error: (...args) => console.error(...args), // Always show errors
    info: (...args) => DEBUG && console.info(...args)
};

// Wait for DOM and Tauri to be ready
document.addEventListener('DOMContentLoaded', function() {
    debug.log('DOM loaded');

    // Check if Tauri API is available
    if (!window.__TAURI__) {
        console.error('Tauri API not available!');
        alert('Error: Tauri API not loaded');
        return;
    }

    debug.log('Tauri API available');
    init();
});

// Use Tauri's injected API
const invoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.tauri?.invoke;
const shell = window.__TAURI__?.shell;
const { getCurrentWindow, LogicalSize } = window.__TAURI__?.window;

// Constants
const TOAST_DURATION_SHORT = 3000;  // 3 seconds
const TOAST_DURATION_LONG = 4000;   // 4 seconds
const TOAST_DURATION_LOADING = 10000; // 10 seconds (for loading states)
const DEBOUNCE_DELAY = 100;         // 100ms debounce for filter updates

// Validation patterns and rules
const VALIDATION = {
    name: {
        pattern: /^[a-zA-Z0-9\s\-_().\[\]#]+$/,
        maxLength: 64,
        message: 'Only letters, numbers, spaces, and - _ ( ) . [ ] # allowed'
    },
    description: {
        pattern: /^[^<>]*$/,
        maxLength: 128,
        message: 'Cannot contain < or > characters'
    },
    hostname: {
        pattern: /^[a-zA-Z0-9.\-_]+$/,
        maxLength: 64,
        message: 'Only letters, numbers, dots, hyphens, underscores allowed'
    },
    ipv4: {
        pattern: /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
        message: 'Must be valid IPv4 (e.g., 192.168.1.1)'
    },
    port: {
        pattern: /^\d+$/,
        min: 1,
        max: 65535,
        message: 'Must be between 1 and 65535'
    },
    username: {
        pattern: /^[a-zA-Z0-9_\-.@#]+$/,
        maxLength: 128,
        message: 'Only letters, numbers, underscores, hyphens, dots, @, # allowed'
    },
    group: {
        pattern: /^[a-zA-Z0-9\s\-_().\[\]#\/]+$/,
        maxLength: 255, // Increased to accommodate full hierarchical paths (e.g., "Group1/Group2/Group3")
        message: 'Only letters, numbers, spaces, and - _ ( ) . [ ] # / allowed'
    }
};

// State
let profiles = [];
let groups = []; // All groups (flat list)
let groupTree = []; // Hierarchical group structure
let editingProfileId = null;
let editingGroupId = null; // Currently editing group ID
let isSubmitting = false;
let collapsedGroups = new Set();
let originalFormValues = {}; // Track original profile form values for change detection
let originalSettingsValues = {}; // Track original settings values for change detection
let filteredGroups = new Set(); // Groups to hide (empty = show all)
let lastImportTime = 0; // Track last settings import time for rate limiting
let keyboardShortcutsEnabled = true; // Enable/disable keyboard shortcuts
let selectedProfileId = null; // Currently selected profile for keyboard navigation
let selectedGroupName = null; // Currently selected group header for keyboard navigation
let selectedRecentConnectionId = null; // Currently selected recent connection for keyboard navigation
let activeNavigationSection = 'profiles'; // Current navigation section: 'recent', 'profiles'
let activeTerminalSession = null; // Active embedded terminal session {sessionId, term, fitAddon, unlisten}
let mouseHasMoved = false; // Track if mouse has actually moved (vs elements scrolling under stationary cursor)
let lastHoveredProfileId = null; // Track last hovered profile to resume keyboard nav from that position
let recentConnections = []; // Recent connections list

// Utility: Debounce function to prevent rapid successive calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Validation Functions

// IPv4 octet range validator
function isValidIPv4(ip) {
    const match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match) return false;
    for (let i = 1; i <= 4; i++) {
        const octet = parseInt(match[i], 10);
        if (octet < 0 || octet > 255) return false;
    }
    return true;
}

// Field-specific validators
function validateName(name) {
    if (name.length === 0) {
        return { valid: false, error: 'Profile name is required' };
    }
    if (name.length > VALIDATION.name.maxLength) {
        return { valid: false, error: `Maximum ${VALIDATION.name.maxLength} characters` };
    }
    if (!VALIDATION.name.pattern.test(name)) {
        return { valid: false, error: VALIDATION.name.message };
    }
    return { valid: true };
}

function validateDescription(description) {
    if (description.length > VALIDATION.description.maxLength) {
        return { valid: false, error: `Maximum ${VALIDATION.description.maxLength} characters` };
    }
    if (!VALIDATION.description.pattern.test(description)) {
        return { valid: false, error: VALIDATION.description.message };
    }
    return { valid: true };
}

function validateHostOrIp(host) {
    if (host.length === 0) {
        return { valid: false, error: 'Hostname or IP is required' };
    }

    // Check if it looks like an IPv4 address
    if (VALIDATION.ipv4.pattern.test(host)) {
        if (!isValidIPv4(host)) {
            return { valid: false, error: VALIDATION.ipv4.message };
        }
        return { valid: true };
    }

    // Validate as hostname
    if (host.length > VALIDATION.hostname.maxLength) {
        return { valid: false, error: `Maximum ${VALIDATION.hostname.maxLength} characters` };
    }
    if (!VALIDATION.hostname.pattern.test(host)) {
        return { valid: false, error: VALIDATION.hostname.message };
    }
    return { valid: true };
}

function validatePortField(port) {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum)) {
        return { valid: false, error: 'Port must be a number' };
    }
    if (portNum < VALIDATION.port.min || portNum > VALIDATION.port.max) {
        return { valid: false, error: VALIDATION.port.message };
    }
    return { valid: true };
}

function validateUsernameField(username) {
    if (username.length === 0) {
        return { valid: false, error: 'Username is required' };
    }
    if (username.length > VALIDATION.username.maxLength) {
        return { valid: false, error: `Maximum ${VALIDATION.username.maxLength} characters` };
    }
    if (!VALIDATION.username.pattern.test(username)) {
        return { valid: false, error: VALIDATION.username.message };
    }
    return { valid: true };
}

function validateGroup(group) {
    if (group.length === 0) {
        return { valid: true }; // Group is optional
    }
    if (group.length > VALIDATION.group.maxLength) {
        return { valid: false, error: `Maximum ${VALIDATION.group.maxLength} characters` };
    }
    if (!VALIDATION.group.pattern.test(group)) {
        return { valid: false, error: VALIDATION.group.message };
    }
    return { valid: true };
}

// Master validator
function validateField(fieldId, value) {
    const trimmedValue = value.trim();

    switch (fieldId) {
        case 'profile-name':
            return validateName(trimmedValue);
        case 'profile-description':
            return validateDescription(value); // Don't trim
        case 'profile-host':
            return validateHostOrIp(trimmedValue);
        case 'profile-port':
            return validatePortField(value);
        case 'profile-username':
            return validateUsernameField(trimmedValue);
        case 'profile-group':
            return validateGroup(trimmedValue);
        case 'group-name':
            // Group name is required (unlike profile-group which is optional)
            if (trimmedValue.length === 0) {
                return { valid: false, error: 'Group name is required' };
            }
            return validateGroup(trimmedValue);
        default:
            return { valid: true };
    }
}

// Clear all validation errors from form fields
function clearAllValidationErrors() {
    const formFields = [
        'profile-name',
        'profile-description',
        'profile-host',
        'profile-port',
        'profile-username',
        'profile-key-path',
        'profile-password',
        'profile-group'
    ];

    formFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.classList.remove('validation-error');
        }
    });
}

// Real-time validation (on input)
function handleRealtimeValidation(fieldId, value) {
    const field = document.getElementById(fieldId);
    const result = validateField(fieldId, value);

    if (result.valid) {
        field.classList.remove('validation-error');
    } else {
        field.classList.add('validation-error');
    }
}

// Character counter updater
function updateCharCounter(fieldId, value) {
    const counter = document.getElementById(`${fieldId}-counter`);
    if (!counter) return;

    // Map field IDs to validation config keys
    const fieldName = fieldId.replace('profile-', '').replace('group-', '');
    const configKey = fieldName === 'host' ? 'hostname' : fieldName;
    const config = VALIDATION[configKey];
    if (!config || !config.maxLength) return;

    const currentLength = value.length;
    const maxLength = config.maxLength;

    counter.textContent = `${currentLength} / ${maxLength}`;

    if (currentLength > maxLength) {
        counter.classList.add('over-limit');
    } else {
        counter.classList.remove('over-limit');
    }
}

// Initialize all character counters based on current field values
function initializeCharCounters() {
    const fieldsWithCounters = [
        'profile-name',
        'profile-description',
        'profile-host',
        'profile-username',
        'profile-group'
    ];

    fieldsWithCounters.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            updateCharCounter(fieldId, field.value);
        }
    });
}

// Pre-save validation
function validateAllFields() {
    const fieldsToValidate = [
        'profile-name',
        'profile-description',
        'profile-host',
        'profile-port',
        'profile-username',
        'profile-group'
    ];

    // Field name mapping for user-friendly error messages
    const fieldNames = {
        'profile-name': 'Profile Name',
        'profile-description': 'Description',
        'profile-host': 'Hostname / IP Address',
        'profile-port': 'Port',
        'profile-username': 'Username',
        'profile-group': 'Group'
    };

    let firstInvalidField = null;
    const errors = [];

    fieldsToValidate.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        const value = field.value;
        const result = validateField(fieldId, value);

        if (!result.valid) {
            field.classList.add('validation-error');
            errors.push({
                field: fieldId,
                fieldName: fieldNames[fieldId],
                message: result.error
            });

            if (!firstInvalidField) {
                firstInvalidField = field;
            }
        } else {
            field.classList.remove('validation-error');
        }
    });

    if (errors.length > 0) {
        firstInvalidField.focus();
        const errorMessage = `${errors[0].fieldName}: ${errors[0].message}`;
        showToast(errorMessage, TOAST_DURATION_LONG, 'error');
        return false;
    }

    return true;
}

// DOM Elements
let profilesList;
let searchInput;
let newProfileBtn;
let profileModal;
let profileForm;
let cancelBtn; // Profile close button in header
let profileSaveBtn; // Profile save button in header
let deleteProfileBtn;
let modalTitle;
let authMethodSelect;
let keyPathGroup;
let passwordGroup;
let confirmModal;
let confirmMessage;
let confirmOkBtn;
let confirmCancelBtn;
let settingsBtn;
let settingsModal;
let settingsCloseBtn; // Settings close button in header
let settingsSaveBtn; // Settings save button in header
let themeSelect;
let exportProfilesBtn;
let importProfilesBtn;
let importFileInput;
let deleteAllProfilesBtn;
let confirmTitle;
let toastElement;
let toastMessage;
let saveProfileBtn;
let browseKeyBtn;
let togglePasswordBtn;
let checkUpdatesBtn;
let autoUpdateCheck;
let filterBtn;
let filterPopup;
let filterGroupsList;
let clearFiltersBtn;
let filterBadge;
let expandCollapseBtn;
let backupSettingsBtn;
let restoreSettingsBtn;
let restoreSettingsInput;
let resetSettingsBtn;
let includeProfilesCheck;
let includePasswordsCheck;
let profileCountBadge;
let terminalSelect;
let customTerminalGroup;
let customTerminalPath;
let browseTerminalBtn;
// Group Management Modal Elements
let addGroupBtn;
let groupModal;
let groupForm;
let groupModalTitle;
let groupNameInput;
let groupParentSelect;
let groupSaveBtn;
let groupCloseBtn;

// Confirmation promise resolver
let confirmResolver = null;

// Keyboard Shortcuts
function loadKeyboardShortcuts() {
    const stored = localStorage.getItem('keyboardShortcutsEnabled');
    keyboardShortcutsEnabled = stored === null ? true : stored === 'true';
}

function loadKeyboardShortcutsCheckbox() {
    const keyboardShortcutsCheck = document.getElementById('keyboard-shortcuts-check');
    if (keyboardShortcutsCheck) {
        keyboardShortcutsCheck.checked = keyboardShortcutsEnabled;
    }
}

function saveKeyboardShortcutsPreference() {
    const keyboardShortcutsCheck = document.getElementById('keyboard-shortcuts-check');
    if (keyboardShortcutsCheck) {
        keyboardShortcutsEnabled = keyboardShortcutsCheck.checked;
        localStorage.setItem('keyboardShortcutsEnabled', keyboardShortcutsEnabled);
    }
}

function setupKeyboardShortcutListeners() {
    document.addEventListener('keydown', (e) => {
        if (!keyboardShortcutsEnabled) return;

        // Check if filter popup is open
        const filterPopupOpen = !filterPopup.classList.contains('hidden');
        if (filterPopupOpen) {
            // Handle filter popup keyboard navigation
            const handled = handleFilterPopupKeyboard(e);
            if (handled) return;
        }

        // Detect if we're in an input field
        const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
        const inModal = !profileModal.classList.contains('hidden') ||
                       !settingsModal.classList.contains('hidden') ||
                       !confirmModal.classList.contains('hidden');

        // Handle modal shortcuts (always active in modals)
        if (inModal) {
            handleModalShortcuts(e);
            return;
        }

        // Handle global shortcuts (not in input fields)
        if (!inInput) {
            handleGlobalShortcuts(e);
        }

        // Handle profile navigation (only when profile list is visible)
        if (!inInput && !inModal) {
            handleProfileNavigation(e);
        }
    });
}

function handleGlobalShortcuts(e) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    // Cmd/Ctrl+N - New Profile
    if (cmdOrCtrl && e.key === 'n') {
        e.preventDefault();
        openModal();
        return;
    }

    // Cmd/Ctrl+F or / - Focus Search
    if ((cmdOrCtrl && e.key === 'f') || e.key === '/') {
        e.preventDefault();
        searchInput.focus();
        return;
    }

    // Cmd/Ctrl+, - Open Settings
    if (cmdOrCtrl && e.key === ',') {
        e.preventDefault();
        openSettings();
        return;
    }

    // ? - Show keyboard shortcuts help (Shift+/)
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        showKeyboardShortcutsHelp();
        return;
    }

    // N - New Profile (single key)
    if ((e.key === 'n' || e.key === 'N') && !cmdOrCtrl) {
        e.preventDefault();
        openModal();
        return;
    }

    // S - Open Settings (single key)
    if ((e.key === 's' || e.key === 'S') && !cmdOrCtrl) {
        e.preventDefault();
        openSettings();
        return;
    }
}

// Get all tabbable items in Profile modal
function getProfileModalTabbableItems() {
    const items = [];

    // Form fields (in order)
    const profileName = document.getElementById('profile-name');
    if (profileName) items.push(profileName);

    const profileDescription = document.getElementById('profile-description');
    if (profileDescription) items.push(profileDescription);

    const profileHost = document.getElementById('profile-host');
    if (profileHost) items.push(profileHost);

    const profilePort = document.getElementById('profile-port');
    if (profilePort) items.push(profilePort);

    const profileUsername = document.getElementById('profile-username');
    if (profileUsername) items.push(profileUsername);

    const profileAuthMethod = document.getElementById('profile-auth-method');
    if (profileAuthMethod) items.push(profileAuthMethod);

    // Conditionally visible fields
    const keyPathGroup = document.getElementById('key-path-group');
    if (keyPathGroup && !keyPathGroup.classList.contains('hidden')) {
        const profileKeyPath = document.getElementById('profile-key-path');
        if (profileKeyPath) items.push(profileKeyPath);

        const browseKeyBtn = document.getElementById('browse-key-btn');
        if (browseKeyBtn) items.push(browseKeyBtn);
    }

    const passwordGroup = document.getElementById('password-group');
    if (passwordGroup && !passwordGroup.classList.contains('hidden')) {
        const profilePassword = document.getElementById('profile-password');
        if (profilePassword) items.push(profilePassword);

        const togglePasswordBtn = document.getElementById('toggle-password-btn');
        if (togglePasswordBtn) items.push(togglePasswordBtn);
    }

    const profileGroup = document.getElementById('profile-group');
    if (profileGroup) items.push(profileGroup);

    // Header buttons (Save/Close/Delete at the end)
    const deleteBtn = document.getElementById('delete-profile-btn');
    if (deleteBtn && !deleteBtn.classList.contains('hidden') && !deleteBtn.disabled) {
        items.push(deleteBtn);
    }

    const saveBtn = document.getElementById('profile-save-btn');
    if (saveBtn && !saveBtn.disabled) items.push(saveBtn);

    const closeBtn = document.getElementById('profile-close-btn');
    if (closeBtn && !closeBtn.disabled) items.push(closeBtn);

    return items;
}

// Get all tabbable items in Settings modal
function getSettingsModalTabbableItems() {
    const items = [];

    // Theme settings
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) items.push(themeSelect);

    // Keyboard shortcuts
    const keyboardShortcutsCheck = document.getElementById('keyboard-shortcuts-check');
    if (keyboardShortcutsCheck) items.push(keyboardShortcutsCheck);

    const shortcutsHelpBtn = document.getElementById('shortcuts-help-btn');
    if (shortcutsHelpBtn) items.push(shortcutsHelpBtn);

    // Recent connections
    const recentConnectionsLimit = document.getElementById('recent-connections-limit');
    if (recentConnectionsLimit) items.push(recentConnectionsLimit);

    // Terminal settings
    const terminalSelect = document.getElementById('terminal-select');
    if (terminalSelect) items.push(terminalSelect);

    const customTerminalGroup = document.getElementById('custom-terminal-group');
    if (customTerminalGroup && !customTerminalGroup.classList.contains('hidden')) {
        const customTerminalPath = document.getElementById('custom-terminal-path');
        if (customTerminalPath) items.push(customTerminalPath);

        const browseTerminalBtn = document.getElementById('browse-terminal-btn');
        if (browseTerminalBtn) items.push(browseTerminalBtn);
    }

    // Profile management buttons
    const exportProfilesBtn = document.getElementById('export-profiles-btn');
    if (exportProfilesBtn) items.push(exportProfilesBtn);

    const importProfilesBtn = document.getElementById('import-profiles-btn');
    if (importProfilesBtn) items.push(importProfilesBtn);

    const deleteAllProfilesBtn = document.getElementById('delete-all-profiles-btn');
    if (deleteAllProfilesBtn) items.push(deleteAllProfilesBtn);

    // Settings management
    const includeProfilesCheck = document.getElementById('include-profiles-check');
    if (includeProfilesCheck) items.push(includeProfilesCheck);

    const backupSettingsBtn = document.getElementById('backup-settings-btn');
    if (backupSettingsBtn) items.push(backupSettingsBtn);

    const restoreSettingsBtn = document.getElementById('restore-settings-btn');
    if (restoreSettingsBtn) items.push(restoreSettingsBtn);

    const resetSettingsBtn = document.getElementById('reset-settings-btn');
    if (resetSettingsBtn) items.push(resetSettingsBtn);

    // Updates
    const autoUpdateCheck = document.getElementById('auto-update-check');
    if (autoUpdateCheck) items.push(autoUpdateCheck);

    const checkUpdatesBtn = document.getElementById('check-updates-btn');
    if (checkUpdatesBtn) items.push(checkUpdatesBtn);

    // Header buttons (Save/Close at the end)
    const saveBtn = document.getElementById('settings-save-btn');
    if (saveBtn && !saveBtn.disabled) items.push(saveBtn);

    const closeBtn = document.getElementById('settings-close-btn');
    if (closeBtn && !closeBtn.disabled) items.push(closeBtn);

    return items;
}

async function handleModalShortcuts(e) {
    // Tab - Special handling for all modals
    if (e.key === 'Tab') {
        // Confirm modal
        if (!confirmModal.classList.contains('hidden')) {
            e.preventDefault();
            const focusedElement = document.activeElement;

            // If nothing is focused (mouse mode), focus cancel button as default
            if (focusedElement !== confirmOkBtn && focusedElement !== confirmCancelBtn) {
                confirmCancelBtn.focus();
                return;
            }

            if (e.shiftKey) {
                // Shift+Tab - Cycle backwards
                if (focusedElement === confirmCancelBtn) {
                    confirmOkBtn.focus();
                } else {
                    confirmCancelBtn.focus();
                }
            } else {
                // Tab - Cycle forwards
                if (focusedElement === confirmOkBtn) {
                    confirmCancelBtn.focus();
                } else {
                    confirmOkBtn.focus();
                }
            }
            return;
        }

        // Profile modal
        if (!profileModal.classList.contains('hidden')) {
            e.preventDefault();
            const items = getProfileModalTabbableItems();
            if (items.length > 0) {
                const currentIndex = items.indexOf(document.activeElement);
                let nextIndex;

                if (e.shiftKey) {
                    // Shift+Tab - backwards
                    nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
                } else {
                    // Tab - forwards
                    nextIndex = currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
                }

                items[nextIndex].focus();
            }
            return;
        }

        // Settings modal
        if (!settingsModal.classList.contains('hidden')) {
            e.preventDefault();
            const items = getSettingsModalTabbableItems();
            if (items.length > 0) {
                const currentIndex = items.indexOf(document.activeElement);
                let nextIndex;

                if (e.shiftKey) {
                    // Shift+Tab - backwards
                    nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
                } else {
                    // Tab - forwards
                    nextIndex = currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
                }

                items[nextIndex].focus();
            }
            return;
        }
    }

    // Escape - Close modal or cancel
    if (e.key === 'Escape') {
        e.preventDefault();

        // Close terminal modal first if open
        const terminalModal = document.getElementById('terminal-modal');
        if (terminalModal && !terminalModal.classList.contains('hidden')) {
            closeEmbeddedTerminal();
            return;
        }

        // Close confirm modal first if open
        if (!confirmModal.classList.contains('hidden')) {
            if (confirmResolver) {
                confirmResolver(false);
                confirmResolver = null;
            }
            confirmModal.classList.add('hidden');
            return;
        }

        // Close settings modal
        if (!settingsModal.classList.contains('hidden')) {
            closeSettings();
            return;
        }

        // Close profile modal
        if (!profileModal.classList.contains('hidden')) {
            await closeModal();
            return;
        }
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    // Cmd/Ctrl+S - Save (in profile or settings modal)
    if (cmdOrCtrl && e.key === 's') {
        e.preventDefault();

        if (!profileModal.classList.contains('hidden')) {
            saveProfile();
            return;
        }

        if (!settingsModal.classList.contains('hidden')) {
            saveSettings();
            return;
        }
    }

    // Enter - Activate buttons
    if (e.key === 'Enter') {
        const activeElement = document.activeElement;

        // Only handle if it's a button (not input fields which handle Enter naturally)
        if (activeElement && activeElement.tagName === 'BUTTON') {
            e.preventDefault();
            activeElement.click();
            return;
        }
    }

    // Space - Activate buttons and toggle checkboxes
    if (e.key === ' ') {
        const activeElement = document.activeElement;

        // Handle buttons
        if (activeElement && activeElement.tagName === 'BUTTON') {
            e.preventDefault();
            activeElement.click();
            return;
        }

        // Handle checkboxes
        if (activeElement && activeElement.tagName === 'INPUT' && activeElement.type === 'checkbox') {
            // Let default behavior handle the toggle
            return;
        }
    }

    // Arrow keys - Navigate dropdowns
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const activeElement = document.activeElement;

        // Handle select dropdowns
        if (activeElement && activeElement.tagName === 'SELECT') {
            // Let the browser handle default dropdown navigation
            return;
        }
    }
}

function handleProfileNavigation(e) {
    const visibleProfiles = getVisibleProfiles();
    const visibleRecentConnections = getVisibleRecentConnections();

    // Reset mouse movement flag when using keyboard navigation
    // This prevents mouseenter events from interfering when elements scroll under cursor
    mouseHasMoved = false;

    // Tab - Cycle through sections
    if (e.key === 'Tab') {
        e.preventDefault();
        cycleNavigationSection(visibleRecentConnections, visibleProfiles, e.shiftKey);
        return;
    }

    // Section-specific navigation
    if (activeNavigationSection === 'recent') {
        handleRecentConnectionsNavigation(e, visibleRecentConnections);
    } else if (activeNavigationSection === 'profiles') {
        handleProfilesNavigation(e, visibleProfiles);
    }
}

// Get all tabbable items in order
function getAllTabbableItems() {
    const items = [];

    // 1. New Profile button
    const newProfileBtn = document.getElementById('new-profile-btn');
    if (newProfileBtn) {
        items.push({ type: 'button', element: newProfileBtn, id: 'new-profile-btn' });
    }

    // 2. Settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        items.push({ type: 'button', element: settingsBtn, id: 'settings-btn' });
    }

    // 3. Search bar
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        items.push({ type: 'input', element: searchInput, id: 'search-input' });
    }

    // 4. Expand/Collapse groups button (comes before filter in DOM)
    const expandCollapseBtn = document.getElementById('expand-collapse-btn');
    if (expandCollapseBtn) {
        items.push({ type: 'button', element: expandCollapseBtn, id: 'expand-collapse-btn' });
    }

    // 5. Filter button
    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) {
        items.push({ type: 'button', element: filterBtn, id: 'filter-btn' });
    }

    // 6. All group headers (from profiles list - now comes before recent connections)
    const groupHeaders = document.querySelectorAll('.profile-group-header');
    groupHeaders.forEach(header => {
        items.push({
            type: 'group',
            element: header,
            name: header.dataset.group
        });
    });

    // 7. Toggle recent button
    const toggleBtn = document.getElementById('toggle-recent-btn');
    if (toggleBtn) {
        items.push({ type: 'button', element: toggleBtn, id: 'toggle-recent-btn' });
    }

    // 8. Clear button
    const clearBtn = document.getElementById('clear-recent-btn');
    if (clearBtn) {
        items.push({ type: 'button', element: clearBtn, id: 'clear-recent-btn' });
    }

    // 9. Recent connections (first one)
    const recentConnections = getVisibleRecentConnections();
    if (recentConnections.length > 0) {
        items.push({
            type: 'recent',
            element: recentConnections[0],
            profileId: recentConnections[0].dataset.profileId
        });
    }

    return items;
}

function cycleNavigationSection(visibleRecentConnections, visibleProfiles, reverse) {
    const items = getAllTabbableItems();
    if (items.length === 0) return;

    // Find current item index based on what's selected/focused
    let currentIndex = -1;
    const activeElement = document.activeElement;

    // Check if any focusable element is currently focused
    const newProfileBtn = document.getElementById('new-profile-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const searchInput = document.getElementById('search-input');
    const filterBtn = document.getElementById('filter-btn');
    const expandCollapseBtn = document.getElementById('expand-collapse-btn');
    const toggleBtn = document.getElementById('toggle-recent-btn');
    const clearBtn = document.getElementById('clear-recent-btn');

    if (activeElement === newProfileBtn) {
        currentIndex = items.findIndex(item => item.id === 'new-profile-btn');
    } else if (activeElement === settingsBtn) {
        currentIndex = items.findIndex(item => item.id === 'settings-btn');
    } else if (activeElement === searchInput) {
        currentIndex = items.findIndex(item => item.id === 'search-input');
    } else if (activeElement === filterBtn) {
        currentIndex = items.findIndex(item => item.id === 'filter-btn');
    } else if (activeElement === expandCollapseBtn) {
        currentIndex = items.findIndex(item => item.id === 'expand-collapse-btn');
    } else if (activeElement === toggleBtn) {
        currentIndex = items.findIndex(item => item.id === 'toggle-recent-btn');
    } else if (activeElement === clearBtn) {
        currentIndex = items.findIndex(item => item.id === 'clear-recent-btn');
    } else if (selectedRecentConnectionId) {
        currentIndex = items.findIndex(item => item.type === 'recent');
    } else if (selectedGroupName) {
        currentIndex = items.findIndex(item => item.type === 'group' && item.name === selectedGroupName);
    } else if (selectedProfileId) {
        // Find the group this profile belongs to
        const profileCard = document.querySelector(`.profile-card[data-id="${selectedProfileId}"]`);
        if (profileCard) {
            const groupHeader = profileCard.closest('.profile-group').querySelector('.profile-group-header');
            if (groupHeader) {
                currentIndex = items.findIndex(item => item.type === 'group' && item.name === groupHeader.dataset.group);
            }
        }
    }

    // If we couldn't determine current position, start at beginning (or end for reverse)
    if (currentIndex === -1) {
        currentIndex = reverse ? items.length : -1;
    }

    // Cycle to next/previous item
    if (reverse) {
        currentIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
    } else {
        currentIndex = (currentIndex + 1) % items.length;
    }

    const nextItem = items[currentIndex];

    // Select/focus the next item
    if (nextItem.type === 'input') {
        // Clear all selections
        clearAllSelections();
        // Focus the input
        nextItem.element.focus();
    } else if (nextItem.type === 'button') {
        // Clear all selections
        clearAllSelections();
        // Focus the button
        nextItem.element.focus();
    } else if (nextItem.type === 'recent') {
        // Blur any focused button or input
        if (document.activeElement && (document.activeElement.tagName === 'BUTTON' || document.activeElement.tagName === 'INPUT')) {
            document.activeElement.blur();
        }
        activeNavigationSection = 'recent';
        selectRecentConnection(nextItem.profileId);
    } else if (nextItem.type === 'group') {
        // Blur any focused button or input
        if (document.activeElement && (document.activeElement.tagName === 'BUTTON' || document.activeElement.tagName === 'INPUT')) {
            document.activeElement.blur();
        }
        activeNavigationSection = 'profiles';
        selectGroup(nextItem.name);
        nextItem.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Clear all selections (helper function)
function clearAllSelections() {
    // Clear profile selection
    if (selectedProfileId) {
        const prevProfile = document.querySelector(`.profile-card[data-id="${selectedProfileId}"]`);
        if (prevProfile) prevProfile.classList.remove('selected');
        selectedProfileId = null;
    }

    // Clear group selection
    if (selectedGroupName) {
        const prevGroup = document.querySelector(`.profile-group-header[data-group="${selectedGroupName}"]`);
        if (prevGroup) prevGroup.classList.remove('selected');
        selectedGroupName = null;
    }

    // Clear recent connection selection
    if (selectedRecentConnectionId) {
        const prevRecent = document.querySelector(`.recent-connection-item[data-profile-id="${selectedRecentConnectionId}"]`);
        if (prevRecent) prevRecent.classList.remove('selected');
        selectedRecentConnectionId = null;
    }
}

function handleRecentConnectionsNavigation(e, visibleRecentConnections) {
    // Arrow Up - Collapse recent connections section
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        const list = document.getElementById('recent-connections-list');
        const toggleBtn = document.getElementById('toggle-recent-btn');
        if (list && !list.classList.contains('collapsed')) {
            toggleRecentConnections();
        }
        return;
    }

    // Arrow Down - Expand recent connections section
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        const list = document.getElementById('recent-connections-list');
        const toggleBtn = document.getElementById('toggle-recent-btn');
        if (list && list.classList.contains('collapsed')) {
            toggleRecentConnections();
        }
        return;
    }

    // C - Clear ALL recent connections
    if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        clearRecentConnections();
        return;
    }

    if (visibleRecentConnections.length === 0) return;

    // D - Delete selected recent connection (individual)
    if ((e.key === 'd' || e.key === 'D') && selectedRecentConnectionId) {
        e.preventDefault();
        removeRecentConnection(selectedRecentConnectionId);
        return;
    }

    // Delete/Backspace - Delete selected recent connection (individual)
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRecentConnectionId) {
        e.preventDefault();
        removeRecentConnection(selectedRecentConnectionId);
        return;
    }

    // Arrow Left/Right - Navigate recent connections
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        selectPreviousRecentConnection(visibleRecentConnections);
        return;
    }

    if (e.key === 'ArrowRight') {
        e.preventDefault();
        selectNextRecentConnection(visibleRecentConnections);
        return;
    }

    // Enter - Connect to selected recent connection
    if (e.key === 'Enter' && selectedRecentConnectionId) {
        e.preventDefault();
        connectToProfile(selectedRecentConnectionId);
        return;
    }
}

function handleProfilesNavigation(e, visibleProfiles) {
    const visibleGroups = getVisibleGroupHeaders();
    if (visibleProfiles.length === 0 && visibleGroups.length === 0) return;

    // If we're on a group header, handle group-specific keys
    if (selectedGroupName) {
        // Enter - Toggle group collapse/expand
        if (e.key === 'Enter') {
            e.preventDefault();
            toggleGroupByName(selectedGroupName);
            return;
        }

        // Left Arrow - Collapse group
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (!collapsedGroups.has(selectedGroupName)) {
                toggleGroupByName(selectedGroupName);
            }
            return;
        }

        // Right Arrow - Expand group
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (collapsedGroups.has(selectedGroupName)) {
                toggleGroupByName(selectedGroupName);
            }
            return;
        }

        // Arrow Down - Navigate to first profile in this group
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            // Find the first profile in the currently selected group
            const groupHeader = document.querySelector(`.profile-group-header[data-group="${selectedGroupName}"]`);
            if (groupHeader) {
                const group = groupHeader.closest('.profile-group');
                const groupContent = group.querySelector('.profile-group-content');

                // Only navigate into group if it's expanded
                if (!groupContent.classList.contains('collapsed')) {
                    const firstProfile = group.querySelector('.profile-card');
                    if (firstProfile) {
                        // Clear group selection
                        selectedGroupName = null;
                        groupHeader.classList.remove('selected');
                        // Select first profile in group
                        selectProfile(firstProfile.dataset.id);
                        firstProfile.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        return;
                    }
                }
            }
            // If group is collapsed or no profiles, just clear group selection and navigate
            selectedGroupName = null;
            const prevHeader = document.querySelector('.profile-group-header.selected');
            if (prevHeader) {
                prevHeader.classList.remove('selected');
            }
            selectNextItem(visibleGroups, visibleProfiles);
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            // Navigate to last profile in previous group
            const items = getNavigableItems();
            const currentGroupIndex = items.findIndex(item => item.type === 'group' && item.name === selectedGroupName);

            if (currentGroupIndex > 0) {
                // Find previous profiles (going backwards from current group)
                for (let i = currentGroupIndex - 1; i >= 0; i--) {
                    if (items[i].type === 'profile') {
                        // Found a profile, select it
                        selectedGroupName = null;
                        const prevHeader = document.querySelector('.profile-group-header.selected');
                        if (prevHeader) {
                            prevHeader.classList.remove('selected');
                        }
                        selectProfile(items[i].id);
                        items[i].element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        return;
                    }
                }
            }

            // If no profile found above, wrap to last profile overall
            selectedGroupName = null;
            const prevHeader = document.querySelector('.profile-group-header.selected');
            if (prevHeader) {
                prevHeader.classList.remove('selected');
            }
            selectPreviousItem(visibleGroups, visibleProfiles);
            return;
        }
    } else {
        // We're on a profile (or starting navigation), handle profile-specific keys
        // Arrow Down - Select next profile
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectNextItem(visibleGroups, visibleProfiles);
            return;
        }

        // Arrow Up - Select previous profile
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectPreviousItem(visibleGroups, visibleProfiles);
            return;
        }

        // Enter - Connect to selected profile
        if (e.key === 'Enter' && selectedProfileId) {
            e.preventDefault();
            connectToProfile(selectedProfileId);
            return;
        }

        // E - Edit selected profile
        if ((e.key === 'e' || e.key === 'E') && selectedProfileId) {
            e.preventDefault();
            editProfile(selectedProfileId);
            return;
        }

        // D - Duplicate selected profile
        if ((e.key === 'd' || e.key === 'D') && selectedProfileId) {
            e.preventDefault();
            duplicateProfile(selectedProfileId);
            return;
        }

        // Delete/Backspace - Delete selected profile
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedProfileId) {
            e.preventDefault();
            deleteProfile(selectedProfileId);
            return;
        }
    }
}

function getVisibleProfiles() {
    const profileCards = Array.from(document.querySelectorAll('.profile-card'));
    return profileCards.filter(card => {
        const groupContent = card.closest('.profile-group-content');
        return !groupContent || !groupContent.classList.contains('collapsed');
    });
}

function getVisibleGroupHeaders() {
    return Array.from(document.querySelectorAll('.profile-group-header'));
}

// Build ordered list of all navigable items (groups and their visible profiles)
function getNavigableItems() {
    const items = [];
    const groups = document.querySelectorAll('.profile-group');

    groups.forEach(group => {
        const header = group.querySelector('.profile-group-header');
        const groupName = header.dataset.group;

        // Add group header
        items.push({ type: 'group', name: groupName, element: header });

        // Add profiles if group is expanded
        const content = group.querySelector('.profile-group-content');
        if (!content.classList.contains('collapsed')) {
            const profiles = Array.from(group.querySelectorAll('.profile-card'));
            profiles.forEach(profile => {
                items.push({ type: 'profile', id: profile.dataset.id, element: profile });
            });
        }
    });

    return items;
}

function selectNextItem(visibleGroups, visibleProfiles) {
    // Only navigate through profiles, not group headers
    if (visibleProfiles.length === 0) return;

    let currentIndex = -1;

    // Find current selection (only look at profiles)
    if (selectedProfileId) {
        currentIndex = visibleProfiles.findIndex(profile => profile.dataset.id === selectedProfileId);
    } else if (lastHoveredProfileId) {
        // Start from last hovered profile if no selection exists
        currentIndex = visibleProfiles.findIndex(profile => profile.dataset.id === lastHoveredProfileId);
    }

    // Move to next profile
    const nextIndex = (currentIndex + 1) % visibleProfiles.length;
    const nextProfile = visibleProfiles[nextIndex];

    selectProfile(nextProfile.dataset.id);
    nextProfile.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function selectPreviousItem(visibleGroups, visibleProfiles) {
    // Only navigate through profiles, not group headers
    if (visibleProfiles.length === 0) return;

    let currentIndex = -1;

    // Find current selection (only look at profiles)
    if (selectedProfileId) {
        currentIndex = visibleProfiles.findIndex(profile => profile.dataset.id === selectedProfileId);
    } else if (lastHoveredProfileId) {
        // Start from last hovered profile if no selection exists
        currentIndex = visibleProfiles.findIndex(profile => profile.dataset.id === lastHoveredProfileId);
    }

    // Move to previous profile
    const prevIndex = currentIndex <= 0 ? visibleProfiles.length - 1 : currentIndex - 1;
    const prevProfile = visibleProfiles[prevIndex];

    selectProfile(prevProfile.dataset.id);
    prevProfile.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function selectGroup(groupName) {
    // Clear profile selection
    if (selectedProfileId) {
        const prevProfile = document.querySelector(`.profile-card[data-id="${selectedProfileId}"]`);
        if (prevProfile) {
            prevProfile.classList.remove('selected');
        }
        selectedProfileId = null;
    }

    // Clear recent connection selection
    if (selectedRecentConnectionId) {
        const prevRecent = document.querySelector(`.recent-connection-item[data-profile-id="${selectedRecentConnectionId}"]`);
        if (prevRecent) {
            prevRecent.classList.remove('selected');
        }
        selectedRecentConnectionId = null;
    }

    // Clear previous group selection
    if (selectedGroupName) {
        const prevGroup = document.querySelector(`.profile-group-header[data-group="${selectedGroupName}"]`);
        if (prevGroup) {
            prevGroup.classList.remove('selected');
        }
    }

    // Set new group selection
    selectedGroupName = groupName;
    const groupHeader = document.querySelector(`.profile-group-header[data-group="${groupName}"]`);
    if (groupHeader) {
        groupHeader.classList.add('selected');
    }
}

function toggleGroupByName(groupName) {
    const groupHeader = document.querySelector(`.profile-group-header[data-group="${groupName}"]`);
    if (groupHeader) {
        groupHeader.click(); // Trigger existing click handler
    }
}

function selectProfile(profileId) {
    // Remove previous selection
    document.querySelectorAll('.profile-card.selected').forEach(card => {
        card.classList.remove('selected');
    });

    // Clear recent connection selection
    selectedRecentConnectionId = null;
    document.querySelectorAll('.recent-connection-item.selected').forEach(item => {
        item.classList.remove('selected');
    });

    // Clear group header selection
    if (selectedGroupName) {
        const prevGroup = document.querySelector(`.profile-group-header[data-group="${selectedGroupName}"]`);
        if (prevGroup) {
            prevGroup.classList.remove('selected');
        }
        selectedGroupName = null;
    }

    // Add selection to new profile
    selectedProfileId = profileId;
    activeNavigationSection = 'profiles';
    const profileCard = document.querySelector(`.profile-card[data-id="${profileId}"]`);
    if (profileCard) {
        profileCard.classList.add('selected');
        // Disable hover effect when keyboard navigation is active
        profilesList.classList.add('keyboard-nav-active');
    }
}

function selectRecentConnection(profileId) {
    // Remove previous selection from profiles
    selectedProfileId = null;
    document.querySelectorAll('.profile-card.selected').forEach(card => {
        card.classList.remove('selected');
    });
    profilesList.classList.remove('keyboard-nav-active');

    // Clear group header selection
    if (selectedGroupName) {
        const prevGroup = document.querySelector(`.profile-group-header[data-group="${selectedGroupName}"]`);
        if (prevGroup) {
            prevGroup.classList.remove('selected');
        }
        selectedGroupName = null;
    }

    // Remove previous selection from recent connections
    document.querySelectorAll('.recent-connection-item.selected').forEach(item => {
        item.classList.remove('selected');
    });

    // Add selection to new recent connection
    selectedRecentConnectionId = profileId;
    activeNavigationSection = 'recent';
    const recentItem = document.querySelector(`.recent-connection-item[data-profile-id="${profileId}"]`);
    if (recentItem) {
        recentItem.classList.add('selected');
    }
}

function getVisibleRecentConnections() {
    return Array.from(document.querySelectorAll('.recent-connection-item'));
}

function selectNextRecentConnection(visibleRecentConnections) {
    if (visibleRecentConnections.length === 0) return;

    let currentIndex = -1;
    if (selectedRecentConnectionId) {
        currentIndex = visibleRecentConnections.findIndex(item => item.dataset.profileId === selectedRecentConnectionId);
    }

    const nextIndex = (currentIndex + 1) % visibleRecentConnections.length;
    const nextItem = visibleRecentConnections[nextIndex];

    selectRecentConnection(nextItem.dataset.profileId);
    nextItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

function selectPreviousRecentConnection(visibleRecentConnections) {
    if (visibleRecentConnections.length === 0) return;

    let currentIndex = -1;
    if (selectedRecentConnectionId) {
        currentIndex = visibleRecentConnections.findIndex(item => item.dataset.profileId === selectedRecentConnectionId);
    }

    const prevIndex = currentIndex <= 0 ? visibleRecentConnections.length - 1 : currentIndex - 1;
    const prevItem = visibleRecentConnections[prevIndex];

    selectRecentConnection(prevItem.dataset.profileId);
    prevItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

function showKeyboardShortcutsHelp() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? 'Cmd' : 'Ctrl';

    const shortcuts = [
        { category: 'Global', items: [
            { keys: 'N', action: 'New Profile' },
            { keys: 'S', action: 'Open Settings' },
            { keys: `${modKey}+F or /`, action: 'Focus Search' },
            { keys: '?', action: 'Show This Help' },
        ]},
        { category: 'Navigation', items: [
            { keys: 'Tab', action: 'Cycle: Search → Actions → Recent → Groups' },
            { keys: 'Shift+Tab', action: 'Cycle Backwards' },
            { keys: 'Enter', action: 'Activate Focused Button/Item' },
        ]},
        { category: 'Recent Connections', items: [
            { keys: '← / →', action: 'Navigate Connections' },
            { keys: '↑', action: 'Collapse Section' },
            { keys: '↓', action: 'Expand Section' },
            { keys: 'Enter', action: 'Connect to Selected' },
            { keys: 'D', action: 'Delete Selected Connection' },
            { keys: 'C', action: 'Clear All Recent Connections' },
        ]},
        { category: 'Profile List', items: [
            { keys: '↑ / ↓', action: 'Navigate Profiles' },
            { keys: 'Enter', action: 'Connect (Profile) / Toggle (Group)' },
            { keys: '← / →', action: 'Collapse / Expand Group' },
            { keys: 'E', action: 'Edit Selected Profile' },
            { keys: 'D', action: 'Duplicate Selected Profile' },
            { keys: 'Backspace / Delete', action: 'Delete Selected Profile' },
        ]},
        { category: 'Modals', items: [
            { keys: 'Escape', action: 'Close Modal/Cancel' },
            { keys: `${modKey}+S`, action: 'Save' },
        ]},
    ];

    // Remove existing if present
    const existing = document.querySelector('.shortcuts-help-modal');
    if (existing) existing.remove();

    // Create modal structure using DOM methods
    const modal = document.createElement('div');
    modal.className = 'shortcuts-help-modal';

    const content = document.createElement('div');
    content.className = 'shortcuts-help-content';

    // Create header
    const header = document.createElement('div');
    header.className = 'modal-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'modal-header-left';
    const title = document.createElement('h2');
    title.textContent = 'Keyboard Shortcuts';
    headerLeft.appendChild(title);

    const headerRight = document.createElement('div');
    headerRight.className = 'modal-header-right';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.id = 'shortcuts-help-close';
    closeBtn.className = 'btn btn-secondary';
    closeBtn.textContent = 'Close';
    headerRight.appendChild(closeBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // Create body
    const body = document.createElement('div');
    body.className = 'shortcuts-help-body';

    const grid = document.createElement('div');
    grid.className = 'shortcuts-grid';

    // Build shortcut sections
    shortcuts.forEach(section => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'shortcuts-section';

        const heading = document.createElement('h3');
        heading.textContent = section.category;
        sectionDiv.appendChild(heading);

        const table = document.createElement('table');
        table.className = 'shortcuts-table';

        section.items.forEach(item => {
            const row = document.createElement('tr');

            const keysCell = document.createElement('td');
            keysCell.className = 'shortcut-keys';
            keysCell.textContent = item.keys;

            const actionCell = document.createElement('td');
            actionCell.textContent = item.action;

            row.appendChild(keysCell);
            row.appendChild(actionCell);
            table.appendChild(row);
        });

        sectionDiv.appendChild(table);
        grid.appendChild(sectionDiv);
    });

    body.appendChild(grid);

    // Assemble modal
    content.appendChild(header);
    content.appendChild(body);
    modal.appendChild(content);

    // Add to document
    document.body.appendChild(modal);

    // Add close handler
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });

    // Close on Escape
    const closeOnEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    };
    document.addEventListener('keydown', closeOnEscape);
}

// Initialize app
async function init() {
    debug.log('Initializing app...');

    // Get DOM elements
    profilesList = document.getElementById('profiles-list');
    searchInput = document.getElementById('search-input');
    newProfileBtn = document.getElementById('new-profile-btn');
    profileModal = document.getElementById('profile-modal');
    profileForm = document.getElementById('profile-form');
    cancelBtn = document.getElementById('profile-close-btn'); // Profile close button in header
    profileSaveBtn = document.getElementById('profile-save-btn'); // Profile save button in header
    deleteProfileBtn = document.getElementById('delete-profile-btn');
    modalTitle = document.getElementById('modal-title');
    authMethodSelect = document.getElementById('profile-auth-method');
    keyPathGroup = document.getElementById('key-path-group');
    passwordGroup = document.getElementById('password-group');
    confirmModal = document.getElementById('confirm-modal');
    confirmMessage = document.getElementById('confirm-message');
    confirmOkBtn = document.getElementById('confirm-ok');
    confirmCancelBtn = document.getElementById('confirm-cancel');
    settingsBtn = document.getElementById('settings-btn');
    settingsModal = document.getElementById('settings-modal');
    settingsCloseBtn = document.getElementById('settings-close-btn'); // Settings close button in header
    settingsSaveBtn = document.getElementById('settings-save-btn'); // Settings save button in header
    themeSelect = document.getElementById('theme-select');
    exportProfilesBtn = document.getElementById('export-profiles-btn');
    importProfilesBtn = document.getElementById('import-profiles-btn');
    importFileInput = document.getElementById('import-file-input');
    deleteAllProfilesBtn = document.getElementById('delete-all-profiles-btn');
    confirmTitle = document.getElementById('confirm-title');
    toastElement = document.getElementById('toast');
    toastMessage = document.getElementById('toast-message');
    saveProfileBtn = document.getElementById('save-profile-btn');
    browseKeyBtn = document.getElementById('browse-key-btn');
    togglePasswordBtn = document.getElementById('toggle-password-btn');
    checkUpdatesBtn = document.getElementById('check-updates-btn');
    autoUpdateCheck = document.getElementById('auto-update-check');
    filterBtn = document.getElementById('filter-btn');
    filterPopup = document.getElementById('filter-popup');
    filterGroupsList = document.getElementById('filter-groups-list');
    clearFiltersBtn = document.getElementById('clear-filters-btn');
    filterBadge = document.getElementById('filter-badge');
    expandCollapseBtn = document.getElementById('expand-collapse-btn');
    backupSettingsBtn = document.getElementById('backup-settings-btn');
    restoreSettingsBtn = document.getElementById('restore-settings-btn');
    restoreSettingsInput = document.getElementById('restore-settings-input');
    resetSettingsBtn = document.getElementById('reset-settings-btn');
    includeProfilesCheck = document.getElementById('include-profiles-check');
    includePasswordsCheck = document.getElementById('include-passwords-check');
    profileCountBadge = document.getElementById('profile-count-badge');
    terminalSelect = document.getElementById('terminal-select');
    customTerminalGroup = document.getElementById('custom-terminal-group');
    customTerminalPath = document.getElementById('custom-terminal-path');
    browseTerminalBtn = document.getElementById('browse-terminal-btn');
    // Group Management Modal Elements
    addGroupBtn = document.getElementById('add-group-btn');
    groupModal = document.getElementById('group-modal');
    groupForm = document.getElementById('group-form');
    groupModalTitle = document.getElementById('group-modal-title');
    groupNameInput = document.getElementById('group-name');
    groupParentSelect = document.getElementById('group-parent');
    groupSaveBtn = document.getElementById('group-save-btn');
    groupCloseBtn = document.getElementById('group-close-btn');

    debug.log('DOM elements retrieved');

    // Set OS-specific browse hint
    setBrowseHint();

    // Check migration FIRST before loading any state
    // This prevents loading corrupted v0.6.5 data
    checkAndPerformMigration();

    // Load filter and collapsed states BEFORE loading profiles
    // so that renderProfiles() can apply filters immediately
    loadFilterState();
    loadCollapsedState();

    await loadProfiles();
    await loadGroups(); // Load groups for hierarchical UI
    await loadRecentConnections(); // Load recent connections after profiles
    loadRecentConnectionsLimit(); // Load recent connections limit into settings
    loadRecentConnectionsCollapsedState(); // Load recent connections collapsed state
    loadThemePreference();
    loadAutoUpdatePreference();
    loadIncludeProfilesPreference();
    populateTerminalOptions();
    loadTerminalPreference();
    loadKeyboardShortcuts();
    await loadWindowState();
    await setupWindowListeners();
    setupEventListeners();
    setupKeyboardShortcutListeners();

    // Track actual mouse movement to distinguish from elements scrolling under cursor
    document.addEventListener('mousemove', () => {
        mouseHasMoved = true;
    });

    // Check for updates on launch if enabled
    if (autoUpdateCheck.checked) {
        checkForUpdates(true); // silent check
    }

    // Setup ResizeObserver to update scrollbar width dynamically
    setupScrollbarObserver();

    debug.log('App initialized');
}

// Set OS-specific hint for browse button
function setBrowseHint() {
    const browseHint = document.getElementById('browse-hint');
    if (!browseHint) return;

    // Detect OS using navigator.platform or userAgent
    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();

    if (platform.includes('mac') || userAgent.includes('mac')) {
        browseHint.textContent = 'Tip: Press Cmd+Shift+. to show hidden files in browser';
    } else if (platform.includes('win') || userAgent.includes('win')) {
        browseHint.textContent = 'Tip: Enable "Show hidden files" in File Explorer settings to see hidden folders';
    } else {
        // Linux or other - could add Linux-specific tip if needed
        browseHint.textContent = 'Tip: Browser opens in ~/.ssh directory';
    }
}

// Update scrollbar width CSS variable for search-bar alignment
function updateScrollbarWidth() {
    const BASE_PADDING = 24; // Match .search-bar base padding
    const profilesContainer = document.getElementById('profiles-list');
    if (!profilesContainer) return;

    try {
        // Calculate scrollbar width: offsetWidth (includes scrollbar) - clientWidth (excludes scrollbar)
        const scrollbarWidth = profilesContainer.offsetWidth - profilesContainer.clientWidth;

        // Validate scrollbar width is reasonable (0-30px typical range for most systems)
        const safeScrollbarWidth = (isNaN(scrollbarWidth) || scrollbarWidth < 0 || scrollbarWidth > 30) ? 0 : scrollbarWidth;

        document.documentElement.style.setProperty('--scrollbar-width', `${BASE_PADDING + safeScrollbarWidth}px`);
    } catch (error) {
        debug.warn('Failed to update scrollbar width:', error);
        // Fallback to base padding
        document.documentElement.style.setProperty('--scrollbar-width', `${BASE_PADDING}px`);
    }
}

// Setup ResizeObserver to dynamically update scrollbar width
function setupScrollbarObserver() {
    const profilesContainer = document.getElementById('profiles-list');
    if (!profilesContainer) return;

    // Create ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(() => {
        updateScrollbarWidth();
    });

    // Start observing the profiles container
    resizeObserver.observe(profilesContainer);

    // Also update on window resize
    window.addEventListener('resize', updateScrollbarWidth);
}

// Load profiles from backend
async function loadProfiles() {
    try {
        profiles = await invoke('get_profiles');
        updateProfileCount();
        renderProfiles();
        updateFilterBadge(); // Update badge after profiles are loaded
    } catch (error) {
        console.error('Failed to load profiles:', error);
        profiles = [];
        updateProfileCount();
        renderProfiles();
        updateFilterBadge(); // Update badge even on error
    }
}

// Load groups from backend
async function loadGroups() {
    try {
        groups = await invoke('get_groups');
        groupTree = await invoke('get_group_tree');
        debug.log('Groups loaded:', groups.length);

        // Perform one-time migration from v0.6.5 to v0.7.0
        performV070Migration();

        // Re-render profiles now that groups are loaded
        // This is needed because loadProfiles() was called before groups were loaded
        renderProfiles(searchInput?.value || '');

        // Update filter badge after groups are loaded
        updateFilterBadge();
    } catch (error) {
        console.error('Failed to load groups:', error);
        groups = [];
        groupTree = [];
        // Re-render profiles even on error
        renderProfiles(searchInput?.value || '');
        // Update badge even on error
        updateFilterBadge();
    }
}

// Check and perform migration EARLY (before loading state)
// This prevents loading corrupted v0.6.5 data
function checkAndPerformMigration() {
    const MIGRATION_VERSION_KEY = 'migrationVersion';
    const MIGRATION_TOAST_SHOWN_KEY = 'migrationToastShown_0.7.0';
    const CURRENT_VERSION = '0.7.0';

    // Check if migration has already been performed
    const lastMigrationVersion = localStorage.getItem(MIGRATION_VERSION_KEY);

    if (lastMigrationVersion === CURRENT_VERSION) {
        // Migration already done, skip
        return false;
    }

    debug.log('Performing v0.7.0 migration (early)...');

    // Clear localStorage keys that contain v0.6.5 data (group names instead of IDs)
    // This prevents validation errors when loading state
    localStorage.removeItem('filteredGroups');
    localStorage.removeItem('collapsedGroups');

    // Mark migration as complete
    localStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_VERSION);
    // Remove toast flag to ensure toast shows after migration
    localStorage.removeItem(MIGRATION_TOAST_SHOWN_KEY);

    debug.log('v0.7.0 migration (early) complete - cleared old state');

    return true; // Migration performed
}

// Complete migration after groups are loaded
// This shows the user notification and re-renders
function performV070Migration() {
    const MIGRATION_VERSION_KEY = 'migrationVersion';
    const MIGRATION_TOAST_SHOWN_KEY = 'migrationToastShown_0.7.0';
    const CURRENT_VERSION = '0.7.0';

    // Check if migration has already been performed
    const lastMigrationVersion = localStorage.getItem(MIGRATION_VERSION_KEY);

    if (lastMigrationVersion !== CURRENT_VERSION) {
        // This should not happen since checkAndPerformMigration() runs first
        debug.warn('Migration marker not found in performV070Migration()');
        return;
    }

    // Check if migration toast was already shown
    const migrationToastShown = localStorage.getItem(MIGRATION_TOAST_SHOWN_KEY);
    if (migrationToastShown) {
        return; // Already shown
    }

    debug.log('Completing v0.7.0 migration...');

    // Re-render profiles with new expanded state
    renderProfiles(searchInput?.value || '');

    // Show user notification
    showToast('Upgraded to v0.7.0 with hierarchical groups! All groups are now visible and expanded.', TOAST_DURATION_LONG, 'success');

    // Mark toast as shown permanently
    localStorage.setItem(MIGRATION_TOAST_SHOWN_KEY, 'true');

    debug.log('v0.7.0 migration complete');
}

// Update profile count badge
function updateProfileCount(visibleCount = null) {
    const totalCount = profiles.length;

    if (visibleCount === null) {
        // No filter info provided, assume all visible
        visibleCount = totalCount;
    }

    profileCountBadge.textContent = `${visibleCount}/${totalCount}`;

    // Update badge width class based on total count digits
    profileCountBadge.classList.remove('badge-2-digit', 'badge-3-digit');
    if (totalCount >= 100) {
        profileCountBadge.classList.add('badge-3-digit');
    } else if (totalCount >= 10) {
        profileCountBadge.classList.add('badge-2-digit');
    }
    // 1-9 uses default min-width (no extra class needed)
}

// Recent Connections Functions

// Get recent connections limit from localStorage (default: 5)
function getRecentConnectionsLimit() {
    const saved = localStorage.getItem('recentConnectionsLimit');
    if (saved === null) return 5; // Default to 5
    const limit = parseInt(saved, 10);
    // Validate: must be 0-20
    if (isNaN(limit) || limit < 0 || limit > 20) return 5;
    return limit;
}

// Save recent connections limit to localStorage
function saveRecentConnectionsLimit() {
    const input = document.getElementById('recent-connections-limit');
    if (!input) return;

    const limit = parseInt(input.value, 10);
    // Validate: must be 0-20
    if (isNaN(limit) || limit < 0 || limit > 20) {
        showToast('Recent connections limit must be between 0 and 20', TOAST_DURATION_SHORT, 'error');
        input.value = getRecentConnectionsLimit(); // Reset to current value
        return;
    }

    localStorage.setItem('recentConnectionsLimit', limit.toString());
}

// Load recent connections limit into settings input
function loadRecentConnectionsLimit() {
    const input = document.getElementById('recent-connections-limit');
    if (!input) return;

    input.value = getRecentConnectionsLimit();
}

// Load recent connections from backend
async function loadRecentConnections() {
    try {
        const limit = getRecentConnectionsLimit();

        // If limit is 0, hide the section and don't fetch
        const section = document.getElementById('recent-connections-section');
        if (limit === 0) {
            if (section) section.classList.add('hidden');
            recentConnections = [];
            return;
        }

        // Show section and fetch recent connections
        if (section) section.classList.remove('hidden');
        recentConnections = await invoke('get_recent_connections', { limit });
        debug.log('Recent connections loaded:', recentConnections);
        renderRecentConnections();
    } catch (error) {
        console.error('Failed to load recent connections:', error);
        recentConnections = [];
        renderRecentConnections();
    }
}

// Render recent connections in the UI
function renderRecentConnections() {
    const list = document.getElementById('recent-connections-list');
    if (!list) return;

    // Clear existing items
    list.innerHTML = '';

    // If no recent connections, show empty state
    if (recentConnections.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'recent-connections-empty';
        empty.textContent = 'No recent connections yet. Connect to a profile to see it here.';
        list.appendChild(empty);
        return;
    }

    // Create items for each recent connection
    recentConnections.forEach(recent => {
        const item = document.createElement('div');
        item.className = 'recent-connection-item';
        item.dataset.profileId = recent.profile_id;

        const name = document.createElement('div');
        name.className = 'recent-connection-name';
        name.textContent = recent.name;

        const host = document.createElement('div');
        host.className = 'recent-connection-host';
        host.textContent = `${recent.username}@${recent.host}:${recent.port}`;

        const time = document.createElement('div');
        time.className = 'recent-connection-time';
        time.textContent = formatTimeAgo(recent.connected_at);

        // Delete button (X)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'recent-connection-delete';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Remove from recent connections';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering reconnect
            removeRecentConnection(recent.profile_id);
        });

        item.appendChild(name);
        item.appendChild(host);
        item.appendChild(time);
        item.appendChild(deleteBtn);

        // Click to reconnect
        item.addEventListener('click', () => {
            connectToProfile(recent.profile_id);
        });

        list.appendChild(item);
    });
}

// Format timestamp as "time ago" (e.g., "2 minutes ago")
function formatTimeAgo(timestamp) {
    try {
        const now = new Date();
        const then = new Date(timestamp);
        const seconds = Math.floor((now - then) / 1000);

        if (seconds < 60) {
            return seconds === 1 ? '1 second ago' : `${seconds} seconds ago`;
        }

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
        }

        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
        }

        const days = Math.floor(hours / 24);
        if (days < 30) {
            return days === 1 ? '1 day ago' : `${days} days ago`;
        }

        const months = Math.floor(days / 30);
        if (months < 12) {
            return months === 1 ? '1 month ago' : `${months} months ago`;
        }

        const years = Math.floor(months / 12);
        return years === 1 ? '1 year ago' : `${years} years ago`;
    } catch (error) {
        console.error('Error formatting time ago:', error);
        return 'recently';
    }
}

// Remove individual recent connection
async function removeRecentConnection(profileId) {
    try {
        await invoke('remove_recent_connection', { profileId });

        // Remove from local array
        recentConnections = recentConnections.filter(rc => rc.profile_id !== profileId);

        // Clear selection if the deleted item was selected
        if (selectedRecentConnectionId === profileId) {
            selectedRecentConnectionId = null;
        }

        // Re-render
        renderRecentConnections();
        showToast('Removed from recent connections', TOAST_DURATION_SHORT);
    } catch (error) {
        console.error('Failed to remove recent connection:', error);
        showToast('Failed to remove recent connection: ' + error, TOAST_DURATION_LONG, 'error');
    }
}

// Clear all recent connections
async function clearRecentConnections() {
    const confirmed = await customConfirm(
        'Are you sure you want to clear all recent connections?',
        {
            title: 'Clear Recent Connections',
            okText: 'Clear',
            cancelText: 'Cancel',
            okClass: 'btn-danger'
        }
    );

    if (!confirmed) return;

    try {
        await invoke('clear_recent_connections');
        recentConnections = [];
        renderRecentConnections();
        showToast('Recent connections cleared', TOAST_DURATION_SHORT);
    } catch (error) {
        console.error('Failed to clear recent connections:', error);
        showToast('Failed to clear recent connections: ' + error, TOAST_DURATION_LONG, 'error');
    }
}

// Toggle recent connections collapsed state
function toggleRecentConnections() {
    const list = document.getElementById('recent-connections-list');
    const toggleBtn = document.getElementById('toggle-recent-btn');
    if (!list || !toggleBtn) return;

    const isCollapsed = list.classList.contains('collapsed');

    if (isCollapsed) {
        list.classList.remove('collapsed');
        toggleBtn.textContent = '▼';
        localStorage.setItem('recentConnectionsCollapsed', 'false');
    } else {
        list.classList.add('collapsed');
        toggleBtn.textContent = '▶';
        localStorage.setItem('recentConnectionsCollapsed', 'true');
    }

    // Focus the toggle button after action (for keyboard navigation)
    setTimeout(() => toggleBtn.focus(), 50);
}

// Load recent connections collapsed state from localStorage
function loadRecentConnectionsCollapsedState() {
    const list = document.getElementById('recent-connections-list');
    const toggleBtn = document.getElementById('toggle-recent-btn');
    if (!list || !toggleBtn) return;

    const isCollapsed = localStorage.getItem('recentConnectionsCollapsed') === 'true';

    if (isCollapsed) {
        list.classList.add('collapsed');
        toggleBtn.textContent = '▶';
    } else {
        list.classList.remove('collapsed');
        toggleBtn.textContent = '▼';
    }
}

// Render profiles in the UI with hierarchical collapsible groups
function renderProfiles(filter = '') {
    const searchText = filter.toLowerCase();

    // Filter profiles
    const filteredProfiles = profiles.filter(profile => {
        // First check if profile's group or any ancestor is filtered out
        const groupId = profile.group_id;
        if (groupId && isGroupOrAncestorFiltered(groupId)) {
            return false; // Hide this profile because its group or an ancestor is filtered
        }

        // Also check for ungrouped if "ungrouped" is filtered
        if (!groupId && filteredGroups.has('ungrouped')) {
            return false;
        }

        // Then apply search filter
        if (!searchText) return true;

        return (
            profile.name.toLowerCase().includes(searchText) ||
            profile.host.toLowerCase().includes(searchText) ||
            profile.username.toLowerCase().includes(searchText) ||
            (profile.description && profile.description.toLowerCase().includes(searchText))
        );
    });

    if (filteredProfiles.length === 0) {
        // Determine if there are truly no profiles or just no results from filtering/search
        const hasProfiles = profiles.length > 0;
        const hasActiveFilters = filteredGroups.size > 0;

        let icon, title, text;

        if (!hasProfiles) {
            icon = '💻';
            title = 'No SSH Profiles Yet';
            text = 'Create your first SSH profile to get started.';
        } else if (filter && hasActiveFilters) {
            icon = '🔍';
            title = 'No Profiles Found';
            text = 'No profiles match your search and active group filters.';
        } else if (filter) {
            icon = '🔍';
            title = 'No Profiles Found';
            text = 'No profiles match your search.';
        } else if (hasActiveFilters) {
            icon = '🔍';
            title = 'No Profiles Found';
            text = 'No profiles match the active group filters.';
        }

        profilesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${icon}</div>
                <div class="empty-state-title">${title}</div>
                <div class="empty-state-text">${text}</div>
            </div>
        `;
        updateProfileCount(0);
        return;
    }

    // Group profiles by group_id (null = ungrouped)
    const profilesByGroupId = {};
    filteredProfiles.forEach(profile => {
        const groupId = profile.group_id || null;
        if (!profilesByGroupId[groupId]) profilesByGroupId[groupId] = [];
        profilesByGroupId[groupId].push(profile);
    });

    // Build HTML using hierarchical structure
    let html = '';

    // Render top-level groups (parent_id = null)
    const topLevelGroups = groups.filter(g => !g.parent_id).sort((a, b) => a.name.localeCompare(b.name));

    topLevelGroups.forEach(group => {
        html += renderGroupNode(group, profilesByGroupId, 0);
    });

    // Render ungrouped profiles
    if (profilesByGroupId[null] && profilesByGroupId[null].length > 0) {
        html += renderUngroupedProfiles(profilesByGroupId[null]);
    }

    profilesList.innerHTML = html;
    attachProfileEventListeners();

    updateExpandCollapseButton();
    updateProfileCount(filteredProfiles.length);

    requestAnimationFrame(() => {
        updateScrollbarWidth();
    });
}

// Recursively count profiles in a group and all its descendants
function countProfilesRecursive(groupId, profilesByGroupId) {
    let count = 0;

    // Count profiles in this group
    const groupProfiles = profilesByGroupId[groupId] || [];
    count += groupProfiles.length;

    // Count profiles in child groups recursively
    const childGroups = groups.filter(g => g.parent_id === groupId);
    childGroups.forEach(childGroup => {
        count += countProfilesRecursive(childGroup.id, profilesByGroupId);
    });

    return count;
}

// Recursively render a group node and its children
function renderGroupNode(group, profilesByGroupId, depth) {
    // Skip rendering if this group is filtered out
    if (isGroupOrAncestorFiltered(group.id)) {
        return ''; // Don't render this group or its children
    }

    const isCollapsed = collapsedGroups.has(group.id);
    const chevron = isCollapsed ? '▶' : '▼';
    // Add depth class for CSS-based indentation
    const depthClass = depth > 0 ? `depth-${depth}` : '';

    // Count profiles in this group (direct only, for rendering)
    const groupProfiles = profilesByGroupId[group.id] || [];

    // Count total profiles including descendants (for badge display)
    const totalProfileCount = countProfilesRecursive(group.id, profilesByGroupId);

    let html = `
        <div class="profile-group" data-group-id="${group.id}">
            <div class="profile-group-header ${depthClass}" data-group-id="${group.id}">
                <span class="group-chevron">${chevron}</span>
                <span class="group-name">${escapeHtml(group.name)}</span>
                <button class="btn btn-icon group-menu-btn" data-group-id="${group.id}" title="Group actions">
                    <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor">
                        <path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/>
                    </svg>
                </button>
                <span class="badge group-count-badge">${totalProfileCount}</span>
            </div>
            <div class="profile-group-content ${isCollapsed ? 'collapsed' : ''}">
    `;

    // Render profiles in this group
    groupProfiles.forEach(profile => {
        html += renderProfileCard(profile, depth);
    });

    // Render child groups
    const childGroups = groups.filter(g => g.parent_id === group.id).sort((a, b) => a.name.localeCompare(b.name));
    childGroups.forEach(childGroup => {
        html += renderGroupNode(childGroup, profilesByGroupId, depth + 1);
    });

    html += `
            </div>
        </div>
    `;

    return html;
}

// Render ungrouped profiles
function renderUngroupedProfiles(ungroupedProfiles) {
    const isCollapsed = collapsedGroups.has('ungrouped');
    const chevron = isCollapsed ? '▶' : '▼';

    let html = `
        <div class="profile-group">
            <div class="profile-group-header" data-group-id="ungrouped">
                <span class="group-chevron">${chevron}</span>
                <span class="group-name">Ungrouped</span>
                <span class="badge group-count-badge">${ungroupedProfiles.length}</span>
            </div>
            <div class="profile-group-content ${isCollapsed ? 'collapsed' : ''}">
    `;

    ungroupedProfiles.forEach(profile => {
        html += renderProfileCard(profile, 0);
    });

    html += `
            </div>
        </div>
    `;

    return html;
}

// Render a single profile card
function renderProfileCard(profile, depth) {
    // Add depth class for CSS-based indentation
    const depthClass = depth > 0 ? `depth-${depth}` : '';

    return `
        <div class="profile-card ${depthClass}" data-id="${profile.id}">
            <div class="profile-card-header"${profile.description ? ` title="${escapeHtml(profile.description)}"` : ''}>
                <div class="profile-card-title" title="${escapeHtml(profile.name)}">${escapeHtml(profile.name)}</div>
            </div>
            <div class="profile-card-info"${profile.description ? ` title="${escapeHtml(profile.description)}"` : ''}>
                <div class="profile-info-item">
                    <span class="profile-info-label">User:</span>
                    <span class="profile-info-value" title="${escapeHtml(profile.username)}">${escapeHtml(profile.username)}</span>
                </div>
                <div class="profile-info-item">
                    <span class="profile-info-label">Host:</span>
                    <span class="profile-info-value" title="${escapeHtml(profile.host)}${profile.port !== 22 ? ':' + profile.port : ''}">${escapeHtml(profile.host)}${profile.port !== 22 ? ':' + profile.port : ''}</span>
                </div>
            </div>
            <div class="profile-card-actions">
                <button class="btn btn-success btn-small connect-btn" data-id="${profile.id}">Connect</button>
                <button class="btn btn-info btn-small edit-btn" data-id="${profile.id}">Edit</button>
                <button class="btn btn-secondary btn-small duplicate-btn" data-id="${profile.id}">Duplicate</button>
                <button class="btn btn-danger btn-small delete-btn" data-id="${profile.id}">Delete</button>
            </div>
        </div>
    `;
}

// Attach event listeners after rendering
function attachProfileEventListeners() {
    // Group headers
    document.querySelectorAll('.profile-group-header').forEach(header => {
        // Toggle on click (but not on menu button)
        header.addEventListener('click', (e) => {
            if (e.target.classList.contains('group-menu-btn')) return; // Skip if clicking menu button

            const groupId = header.dataset.groupId;
            toggleGroup(groupId);
        });

        // Clear keyboard selection when hovering with mouse
        header.addEventListener('mouseenter', (e) => {
            if (!mouseHasMoved) return;

            if (selectedGroupName) {
                const previouslySelected = document.querySelector('.profile-group-header.selected');
                if (previouslySelected) {
                    previouslySelected.classList.remove('selected');
                }
                selectedGroupName = null;
            }
        });
    });

    // Group menu buttons
    document.querySelectorAll('.group-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent group toggle
            const groupId = btn.dataset.groupId;
            showGroupMenu(groupId, e);
        });
    });

    // Profile cards
    document.querySelectorAll('.profile-card').forEach(card => {
        card.addEventListener('mouseenter', (e) => {
            if (!mouseHasMoved) return;

            lastHoveredProfileId = card.dataset.id;

            if (selectedProfileId) {
                const previouslySelected = document.querySelector('.profile-card.selected');
                if (previouslySelected) {
                    previouslySelected.classList.remove('selected');
                }
                selectedProfileId = null;
            }
            profilesList.classList.remove('keyboard-nav-active');
        });
    });
}

// Toggle group collapse state
function toggleGroup(groupId) {
    if (collapsedGroups.has(groupId)) {
        collapsedGroups.delete(groupId);
    } else {
        collapsedGroups.add(groupId);
    }
    saveCollapsedState();

    // Save current selection to restore after render
    const wasGroupSelected = selectedGroupName === groupId;

    renderProfiles(searchInput.value);

    // Restore group selection if it was selected before toggle
    if (wasGroupSelected) {
        const groupHeader = document.querySelector(`.profile-group-header[data-group-id="${groupId}"]`);
        if (groupHeader) {
            groupHeader.classList.add('selected');
        }
    }
}

// Show context menu for group actions
function showGroupMenu(groupId, event) {
    // For now, use simple confirm dialogs
    // TODO: In future, create a proper context menu UI

    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    // Close any existing context menus first
    const existingMenus = document.querySelectorAll('.group-context-menu');
    existingMenus.forEach(existingMenu => {
        if (document.body.contains(existingMenu)) {
            document.body.removeChild(existingMenu);
        }
    });

    // Create a simple inline menu (temporary solution)
    const menu = document.createElement('div');
    menu.className = 'group-context-menu';
    menu.style.position = 'absolute';

    menu.innerHTML = `
        <button class="group-menu-item" data-action="rename">Rename Group</button>
        <button class="group-menu-item" data-action="add-subgroup">Add Subgroup</button>
        <button class="group-menu-item" data-action="delete">Delete Group</button>
    `;

    document.body.appendChild(menu);

    // Calculate menu dimensions
    const menuRect = menu.getBoundingClientRect();
    const menuWidth = menuRect.width;
    const menuHeight = menuRect.height;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Calculate position, adjusting if menu would go off-screen
    let left = event.clientX;
    let top = event.clientY;

    // Check right edge
    if (left + menuWidth > windowWidth) {
        left = windowWidth - menuWidth - 10; // 10px margin from edge
    }

    // Check bottom edge
    if (top + menuHeight > windowHeight) {
        top = windowHeight - menuHeight - 10; // 10px margin from edge
    }

    // Ensure menu doesn't go off left or top edge
    if (left < 10) left = 10;
    if (top < 10) top = 10;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    // Handle menu item clicks
    menu.querySelectorAll('.group-menu-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            const action = item.dataset.action;
            document.body.removeChild(menu);

            if (action === 'rename') {
                await renameGroup(groupId);
            } else if (action === 'add-subgroup') {
                openGroupModal(null, groupId); // Create new group with this as parent
            } else if (action === 'delete') {
                await deleteGroup(groupId);
            }
        });
    });

    // Close menu when clicking outside
    setTimeout(() => {
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                if (document.body.contains(menu)) {
                    document.body.removeChild(menu);
                }
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    }, 0);
}

// Rename a group
async function renameGroup(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    openGroupModal(group);
}

// Delete a group
async function deleteGroup(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    // Count profiles and subgroups
    const profileCount = profiles.filter(p => p.group_id === groupId).length;
    const subgroupCount = groups.filter(g => g.parent_id === groupId).length;

    // If group is empty (no profiles or subgroups), just delete it
    if (profileCount === 0 && subgroupCount === 0) {
        const confirmed = await customConfirm(
            `Are you sure you want to delete the group "${group.name}"?`,
            {
                title: 'Delete Group',
                okText: 'Delete',
                cancelText: 'Cancel',
                okClass: 'btn-danger'
            }
        );

        if (!confirmed) return;

        try {
            await invoke('delete_group', {
                input: {
                    id: groupId,
                    delete_profiles: true
                }
            });

            await loadGroups();
            await loadProfiles();
            showToast('Group deleted successfully!');
        } catch (error) {
            console.error('Failed to delete group:', error);
            showToast('Failed to delete group: ' + error, TOAST_DURATION_LONG, 'error');
        }
        return;
    }

    // Group has content - offer two deletion modes
    const parentText = group.parent_id ? 'parent group' : 'top level';
    const confirmMessage = buildConfirmMessage({
        lines: [
            { prefix: 'Group: ', highlight: `"${group.name}"`, highlightClass: 'group-name' },
            `Contains: ${profileCount} profile(s) and ${subgroupCount} subgroup(s)`,
            '',
            'Choose how to handle the contents:'
        ],
        warnings: [
            `Delete All: Permanently deletes all profiles and subgroups`,
            `Move to Parent: Moves profiles/subgroups to ${parentText}, then deletes group`
        ],
        question: ''
    });

    // Create a custom confirmation dialog with three buttons
    const result = await new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';

        modal.innerHTML = `
            <div class="modal-content modal-content-small">
                <div class="modal-header">
                    <h2>Delete Group</h2>
                </div>
                <div class="modal-body" id="delete-group-confirm-body"></div>
                <div class="modal-footer">
                    <button id="delete-all-btn" class="btn btn-danger">Delete All</button>
                    <button id="move-to-parent-btn" class="btn btn-primary">Move to Parent</button>
                    <button id="cancel-delete-btn" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bodyEl = document.getElementById('delete-group-confirm-body');
        bodyEl.appendChild(confirmMessage);

        document.getElementById('delete-all-btn').onclick = () => {
            document.body.removeChild(modal);
            resolve('delete-all');
        };
        document.getElementById('move-to-parent-btn').onclick = () => {
            document.body.removeChild(modal);
            resolve('move-to-parent');
        };
        document.getElementById('cancel-delete-btn').onclick = () => {
            document.body.removeChild(modal);
            resolve('cancel');
        };
    });

    if (result === 'cancel') return;

    try {
        const deleteProfiles = result === 'delete-all';

        await invoke('delete_group', {
            input: {
                id: groupId,
                delete_profiles: deleteProfiles
            }
        });

        await loadGroups();
        await loadProfiles();

        if (deleteProfiles) {
            showToast('Group and all contents deleted successfully!');
        } else {
            showToast(`Group deleted. Contents moved to ${parentText}.`);
        }
    } catch (error) {
        console.error('Failed to delete group:', error);
        showToast('Failed to delete group: ' + error, TOAST_DURATION_LONG, 'error');
    }
}

// Update expand/collapse button text
function updateExpandCollapseButton() {
    const allGroups = getAllGroups();

    // If any group is collapsed, show "Expand Groups"
    const anyCollapsed = allGroups.some(group => collapsedGroups.has(group));

    if (anyCollapsed) {
        expandCollapseBtn.textContent = 'Expand Groups';
    } else {
        expandCollapseBtn.textContent = 'Collapse Groups';
    }
}

// Expand all groups
function expandAllGroups() {
    collapsedGroups.clear();
    saveCollapsedState();
    renderProfiles(searchInput.value);
}

// Collapse all groups
function collapseAllGroups() {
    const allGroups = getAllGroups();
    allGroups.forEach(group => collapsedGroups.add(group));
    saveCollapsedState();
    renderProfiles(searchInput.value);
}

// Toggle expand/collapse all groups
function toggleExpandCollapseAll() {
    const allGroups = getAllGroups();
    const anyCollapsed = allGroups.some(group => collapsedGroups.has(group));

    if (anyCollapsed) {
        expandAllGroups();
    } else {
        collapseAllGroups();
    }
}

// Setup event listeners
function setupEventListeners() {
    debug.log('Setting up event listeners...');

    searchInput.addEventListener('input', (e) => {
        renderProfiles(e.target.value);
    });

    // Event delegation for profile card buttons (prevents memory leaks)
    profilesList.addEventListener('click', async (e) => {
        const target = e.target;

        if (target.classList.contains('connect-btn')) {
            e.stopPropagation();
            connectToProfile(target.dataset.id);
        } else if (target.classList.contains('edit-btn')) {
            e.stopPropagation();
            editProfile(target.dataset.id);
        } else if (target.classList.contains('duplicate-btn')) {
            e.stopPropagation();
            duplicateProfile(target.dataset.id);
        } else if (target.classList.contains('delete-btn')) {
            e.stopPropagation();
            debug.log('Delete button clicked on card, id:', target.dataset.id);
            await deleteProfile(target.dataset.id);
        }
    });

    newProfileBtn.addEventListener('click', () => {
        debug.log('New profile button clicked!');
        openModal();
    });

    cancelBtn.addEventListener('click', async () => {
        await closeModal();
    });

    deleteProfileBtn.addEventListener('click', async () => {
        debug.log('Delete button clicked in modal');
        if (editingProfileId) {
            // Check for unsaved changes before proceeding with deletion
            if (hasUnsavedProfileChanges()) {
                const confirmed = await customConfirm(
                    'You have unsaved changes. Do you want to proceed with deletion?',
                    {
                        title: 'Unsaved Changes',
                        okText: 'Proceed with Delete',
                        cancelText: 'Cancel',
                        okClass: 'btn-danger'
                    }
                );

                if (!confirmed) {
                    return; // User cancelled, keep modal open with unsaved changes
                }
            }

            // Proceed with deletion
            const deleted = await deleteProfile(editingProfileId);
            // Only close modal if deletion was successful
            if (deleted) {
                forceCloseModal(); // Force close without confirmation after deletion
            }
        }
    });

    // Removed: backdrop click to close (users should use close/cancel buttons)
    // profileModal.addEventListener('click', (e) => {
    //     if (e.target === profileModal) {
    //         closeModal();
    //     }
    // });

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Prevent double submission
        if (isSubmitting) {
            debug.log('Already submitting, ignoring...');
            return;
        }

        isSubmitting = true;
        try {
            await saveProfile();
        } finally {
            isSubmitting = false;
        }
    });

    authMethodSelect.addEventListener('change', () => {
        updateAuthMethodVisibility();
        checkFormChanged();
    });

    // Real-time validation listeners
    const validatedFields = [
        'profile-name', 'profile-description', 'profile-host',
        'profile-port', 'profile-username', 'profile-group'
    ];

    validatedFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', (e) => {
                handleRealtimeValidation(fieldId, e.target.value);
                updateCharCounter(fieldId, e.target.value);
            });
        }
    });

    // Listen for changes on all form fields to enable/disable Save button
    const formFields = [
        'profile-name',
        'profile-description',
        'profile-host',
        'profile-port',
        'profile-username',
        'profile-auth-method',
        'profile-key-path',
        'profile-password',
        'profile-group'
    ];

    formFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            // Skip profile-group since it has custom handlers
            if (fieldId === 'profile-group') return;

            field.addEventListener('input', checkFormChanged);
            field.addEventListener('change', checkFormChanged);
        }
    });

    // Profile group searchable dropdown handlers
    const profileGroupInput = document.getElementById('profile-group');
    if (profileGroupInput) {
        profileGroupInput.addEventListener('input', (e) => {
            showProfileGroupDropdown(e.target.value);
        });

        profileGroupInput.addEventListener('focus', () => {
            showProfileGroupDropdown(profileGroupInput.value);
        });

        profileGroupInput.addEventListener('keydown', handleProfileGroupKeydown);
    }

    // Add Group button from profile modal
    const addGroupFromProfileBtn = document.getElementById('add-group-from-profile-btn');
    if (addGroupFromProfileBtn) {
        addGroupFromProfileBtn.addEventListener('click', async () => {
            // Hide profile group dropdown if open
            hideProfileGroupDropdown();
            // Open group modal to create new group
            await openGroupModal();
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const profileGroupDropdown = document.getElementById('profile-group-dropdown');
        const profileGroupInput = document.getElementById('profile-group');
        const addGroupBtn = document.getElementById('add-group-from-profile-btn');

        if (profileGroupDropdown && !profileGroupDropdown.classList.contains('hidden')) {
            if (!profileGroupInput.contains(e.target) &&
                !profileGroupDropdown.contains(e.target) &&
                !addGroupBtn.contains(e.target)) {
                hideProfileGroupDropdown();
            }
        }
    });

    // Confirmation dialog buttons
    confirmOkBtn.addEventListener('click', () => {
        if (confirmResolver) {
            confirmResolver(true);
            confirmResolver = null;
        }
        confirmModal.classList.add('hidden');
        // Clear keyboard selections to prevent accidental actions after modal closes
        clearAllSelections();
    });

    confirmCancelBtn.addEventListener('click', () => {
        if (confirmResolver) {
            confirmResolver(false);
            confirmResolver = null;
        }
        confirmModal.classList.add('hidden');
        // Clear keyboard selections to prevent accidental actions after modal closes
        clearAllSelections();
    });

    // Clear focus when mouse hovers over buttons (switch to mouse mode)
    confirmOkBtn.addEventListener('mouseenter', () => {
        if (document.activeElement === confirmOkBtn || document.activeElement === confirmCancelBtn) {
            document.activeElement.blur();
        }
    });

    confirmCancelBtn.addEventListener('mouseenter', () => {
        if (document.activeElement === confirmOkBtn || document.activeElement === confirmCancelBtn) {
            document.activeElement.blur();
        }
    });

    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            if (confirmResolver) {
                confirmResolver(false);
                confirmResolver = null;
            }
            confirmModal.classList.add('hidden');
            // Clear keyboard selections to prevent accidental actions after modal closes
            clearAllSelections();
        }
    });

    // Keyboard navigation for confirm modal
    confirmModal.addEventListener('keydown', (e) => {
        if (confirmModal.classList.contains('hidden')) return;

        // Escape - Cancel (trigger cancel button)
        if (e.key === 'Escape') {
            e.preventDefault();
            confirmCancelBtn.click();
            return;
        }

        // Enter - Activate focused button
        if (e.key === 'Enter') {
            e.preventDefault();
            const focusedElement = document.activeElement;

            if (focusedElement === confirmOkBtn || focusedElement === confirmCancelBtn) {
                focusedElement.click();
            }
        }
    });

    // Settings modal
    settingsBtn.addEventListener('click', () => {
        openSettings();
    });

    settingsCloseBtn.addEventListener('click', async () => {
        await closeSettings();
    });

    settingsSaveBtn.addEventListener('click', () => {
        saveSettings();
    });

    // Removed: backdrop click to close (users should use close button)
    // settingsModal.addEventListener('click', (e) => {
    //     if (e.target === settingsModal) {
    //         closeSettings();
    //     }
    // });

    // Theme toggle - don't apply immediately, just track changes
    themeSelect.addEventListener('change', () => {
        debouncedCheckSettingsChanged();
    });

    autoUpdateCheck.addEventListener('change', () => {
        debouncedCheckSettingsChanged();
    });

    // Keyboard shortcuts
    const keyboardShortcutsCheck = document.getElementById('keyboard-shortcuts-check');
    if (keyboardShortcutsCheck) {
        keyboardShortcutsCheck.addEventListener('change', () => {
            // Don't save immediately - just track changes for Save button
            debouncedCheckSettingsChanged();
        });
    }

    const shortcutsHelpBtn = document.getElementById('shortcuts-help-btn');
    if (shortcutsHelpBtn) {
        shortcutsHelpBtn.addEventListener('click', () => {
            showKeyboardShortcutsHelp();
        });
    }

    // Export/Import
    exportProfilesBtn.addEventListener('click', async () => {
        await exportProfiles();
    });

    importProfilesBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            await importProfiles(e.target.files[0]);
            e.target.value = ''; // Reset file input
        }
    });

    deleteAllProfilesBtn.addEventListener('click', async () => {
        await deleteAllProfiles();
    });

    // Browse for SSH key file
    browseKeyBtn.addEventListener('click', async () => {
        await browseSshKey();
    });

    // Toggle password visibility
    togglePasswordBtn.addEventListener('click', () => {
        const passwordInput = document.getElementById('profile-password');

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            togglePasswordBtn.textContent = 'Hide';
            togglePasswordBtn.title = 'Hide password';
        } else {
            passwordInput.type = 'password';
            togglePasswordBtn.textContent = 'Show';
            togglePasswordBtn.title = 'Show password';
        }
    });

    // Update checker
    checkUpdatesBtn.addEventListener('click', async () => {
        await checkForUpdates(false); // not silent, show notification
    });

    includeProfilesCheck.addEventListener('change', () => {
        debouncedCheckSettingsChanged();
    });

    includePasswordsCheck.addEventListener('change', () => {
        debouncedCheckSettingsChanged();
    });

    // Use tabs in terminal checkbox
    const useTabsInTerminalCheck = document.getElementById('use-tabs-in-terminal-check');
    if (useTabsInTerminalCheck) {
        useTabsInTerminalCheck.addEventListener('change', () => {
            debouncedCheckSettingsChanged();
        });
    }

    // Expand/collapse all groups button
    expandCollapseBtn.addEventListener('click', () => {
        toggleExpandCollapseAll();
    });

    // Add keyboard support for expand/collapse button
    expandCollapseBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            expandCollapseBtn.click();
        }
    });

    // Add Group button
    addGroupBtn.addEventListener('click', () => {
        openGroupModal();
    });

    // Group modal close button
    groupCloseBtn.addEventListener('click', async () => {
        await closeGroupModal();
    });

    // Group form submit
    groupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Prevent double submission
        if (isSubmitting) {
            debug.log('Already submitting, ignoring...');
            return;
        }

        await saveGroup();
    });

    // Group name input validation and character counter
    if (groupNameInput) {
        groupNameInput.addEventListener('input', (e) => {
            handleRealtimeValidation('group-name', e.target.value);
            updateCharCounter('group-name', e.target.value);
            checkGroupFormChanged();
        });
    }

    // Group parent dropdown change
    if (groupParentSelect) {
        groupParentSelect.addEventListener('change', () => {
            checkGroupFormChanged();
        });
    }

    // Filter button and popup
    filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFilterPopup();
    });

    // Add keyboard support for filter button
    filterBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            filterBtn.click();
        }
    });

    // Close filter popup when focus leaves the button and popup area
    filterBtn.addEventListener('blur', (e) => {
        // Small delay to allow focus to shift and check new focus target
        setTimeout(() => {
            const activeElement = document.activeElement;
            const isInPopup = filterPopup.contains(activeElement);
            const isFilterBtn = activeElement === filterBtn;

            // Only close if focus moved outside both button and popup
            if (!isInPopup && !isFilterBtn && !filterPopup.classList.contains('hidden')) {
                filterPopup.classList.add('hidden');
            }
        }, 100);
    });

    // Also close popup when focus leaves any popup item
    document.addEventListener('focusin', (e) => {
        if (filterPopup.classList.contains('hidden')) return;

        const activeElement = document.activeElement;
        const isInPopup = filterPopup.contains(activeElement);
        const isFilterBtn = activeElement === filterBtn;

        // Close if focus moved outside both button and popup
        if (!isInPopup && !isFilterBtn) {
            filterPopup.classList.add('hidden');
        }
    });

    clearFiltersBtn.addEventListener('click', () => {
        clearGroupFilters();
    });

    // Settings backup/restore
    backupSettingsBtn.addEventListener('click', async () => {
        await backupSettings();
    });

    restoreSettingsBtn.addEventListener('click', () => {
        restoreSettingsInput.click();
    });

    restoreSettingsInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            await restoreSettings(e.target.files[0]);
            e.target.value = '';
        }
    });

    resetSettingsBtn.addEventListener('click', async () => {
        await resetSettings();
    });

    // Terminal preference
    terminalSelect.addEventListener('change', () => {
        updateTerminalVisibility();
        debouncedCheckSettingsChanged();
    });

    customTerminalPath.addEventListener('input', () => {
        debouncedCheckSettingsChanged();
    });

    browseTerminalBtn.addEventListener('click', async () => {
        await browseTerminalApp();
    });

    // Close filter popup when clicking outside
    document.addEventListener('click', (e) => {
        if (!filterPopup.classList.contains('hidden') &&
            !filterPopup.contains(e.target) &&
            !filterBtn.contains(e.target)) {
            filterPopup.classList.add('hidden');
        }
    });

    // Handle external links (open in browser)
    document.addEventListener('click', async (e) => {
        const target = e.target.closest('a[target="_blank"]');
        if (target && target.href) {
            e.preventDefault();
            try {
                await shell.open(target.href);
            } catch (error) {
                console.error('Failed to open link:', error);
                showToast('Failed to open link: ' + error, TOAST_DURATION_LONG, 'error');
            }
        }
    });

    // Recent connections
    const clearRecentBtn = document.getElementById('clear-recent-btn');
    const toggleRecentBtn = document.getElementById('toggle-recent-btn');
    const recentConnectionsLimitInput = document.getElementById('recent-connections-limit');

    if (clearRecentBtn) {
        clearRecentBtn.addEventListener('click', async () => {
            await clearRecentConnections();
        });
    }

    if (toggleRecentBtn) {
        toggleRecentBtn.addEventListener('click', () => {
            toggleRecentConnections();
        });
    }

    if (recentConnectionsLimitInput) {
        recentConnectionsLimitInput.addEventListener('input', () => {
            debouncedCheckSettingsChanged();
        });
    }

    // Terminal modal buttons
    const terminalCloseBtn = document.getElementById('terminal-close-btn');
    const terminalClearBtn = document.getElementById('terminal-clear-btn');

    if (terminalCloseBtn) {
        terminalCloseBtn.addEventListener('click', () => {
            closeEmbeddedTerminal();
        });
    }

    if (terminalClearBtn) {
        terminalClearBtn.addEventListener('click', () => {
            clearTerminal();
        });
    }

    // Setup dynamic tooltip positioning
    setupTooltipPositioning();
}

// Setup dynamic tooltip positioning based on available viewport space
function setupTooltipPositioning() {
    // Find all inputs and selects that have tooltips
    const inputsWithTooltips = document.querySelectorAll('.form-group input, .form-group select');

    inputsWithTooltips.forEach(input => {
        const tooltip = input.nextElementSibling;
        if (!tooltip || !tooltip.classList.contains('input-tooltip')) return;

        // On focus, check if there's enough space below to show tooltip
        input.addEventListener('focus', () => {
            // Get input position relative to viewport
            const inputRect = input.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            // Tooltip typically needs about 150px height (can vary based on content)
            // Check if there's enough space below the input
            const spaceBelow = viewportHeight - inputRect.bottom;
            const tooltipHeight = 150; // Approximate tooltip height

            if (spaceBelow < tooltipHeight) {
                // Not enough space below, show tooltip above
                tooltip.classList.add('tooltip-above');
            } else {
                // Enough space below, show tooltip normally
                tooltip.classList.remove('tooltip-above');
            }
        });
    });
}

// Custom confirm dialog
function customConfirm(message, options = {}) {
    return new Promise((resolve) => {
        const title = options.title || 'Confirm';
        const okText = options.okText || 'Yes';
        const cancelText = options.cancelText || 'No';
        const okClass = options.okClass || 'btn-danger';

        confirmTitle.textContent = title;

        // Clear previous content
        confirmMessage.innerHTML = '';

        // Support both DOM elements and strings (for backward compatibility)
        // Prefer passing DOM elements for security
        if (message instanceof Node) {
            confirmMessage.appendChild(message);
        } else if (typeof message === 'string') {
            // For string messages, use textContent for safety (no HTML)
            // If HTML formatting is needed, caller should create DOM elements
            const textNode = document.createTextNode(message);
            confirmMessage.appendChild(textNode);
        }

        confirmOkBtn.textContent = okText;
        confirmCancelBtn.textContent = cancelText;
        confirmOkBtn.className = `btn ${okClass}`;

        confirmModal.classList.remove('hidden');
        confirmResolver = resolve;

        // Focus cancel button by default (safer option)
        setTimeout(() => confirmCancelBtn.focus(), 100);
    });
}

// Toast notification
function showToast(message, duration = TOAST_DURATION_SHORT, type = 'success') {
    // Clear previous content
    toastMessage.textContent = '';

    // Safely handle multi-line messages using DOM manipulation
    if (message.includes('\n')) {
        message.split('\n').forEach((line, index) => {
            if (index > 0) toastMessage.appendChild(document.createElement('br'));
            toastMessage.appendChild(document.createTextNode(line));
        });
    } else {
        toastMessage.textContent = message;
    }

    toastElement.classList.remove('hidden', 'toast-error', 'toast-success');

    // Add appropriate class based on type
    if (type === 'error') {
        toastElement.classList.add('toast-error');
    } else {
        toastElement.classList.add('toast-success');
    }

    setTimeout(() => {
        toastElement.classList.add('hidden');
    }, duration);
}

// Update form based on selected auth method
function updateAuthMethodVisibility() {
    const method = authMethodSelect.value;

    keyPathGroup.classList.toggle('hidden', method !== 'key');
    passwordGroup.classList.toggle('hidden', method !== 'password');
}

// Settings modal functions
// Get current settings values from localStorage and DOM
function getCurrentSettingsValues() {
    const recentConnectionsLimitInput = document.getElementById('recent-connections-limit');
    const keyboardShortcutsCheck = document.getElementById('keyboard-shortcuts-check');
    const useTabsInTerminalCheck = document.getElementById('use-tabs-in-terminal-check');
    return {
        theme: themeSelect.value,
        autoUpdateCheck: autoUpdateCheck.checked,
        terminalPreference: terminalSelect.value,
        customTerminalPath: customTerminalPath.value,
        includeProfiles: includeProfilesCheck.checked,
        includePasswords: includePasswordsCheck.checked,
        recentConnectionsLimit: recentConnectionsLimitInput ? recentConnectionsLimitInput.value : '5',
        keyboardShortcutsEnabled: keyboardShortcutsCheck ? keyboardShortcutsCheck.checked : true,
        useTabsInTerminal: useTabsInTerminalCheck ? useTabsInTerminalCheck.checked : true
    };
}

// Capture current settings values for change detection
function captureSettingsValues() {
    originalSettingsValues = getCurrentSettingsValues();
}

// Check if settings have changed
function hasUnsavedSettingsChanges() {
    const currentValues = getCurrentSettingsValues();
    return Object.keys(originalSettingsValues).some(key =>
        currentValues[key] !== originalSettingsValues[key]
    );
}

// Check settings changes and update Save button state
function checkSettingsChanged() {
    settingsSaveBtn.disabled = !hasUnsavedSettingsChanges();
}

// Debounced version to prevent race conditions with rapid changes (50ms delay)
const debouncedCheckSettingsChanged = debounce(checkSettingsChanged, 50);

function openSettings() {
    settingsModal.classList.remove('hidden');

    // Scroll to top of modal content
    const modalContent = settingsModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.scrollTop = 0;
    }

    // Load current settings values into form
    loadRecentConnectionsLimit();
    loadKeyboardShortcutsCheckbox();
    loadIncludePasswordsPreference();
    loadUseTabsInTerminalPreference();

    // Capture original settings values and disable Save button initially
    captureSettingsValues();
    settingsSaveBtn.disabled = true;

    // Focus first field for keyboard navigation
    setTimeout(() => {
        const firstField = document.getElementById('theme-select');
        if (firstField) {
            firstField.focus();
        }
    }, 0);
}

// Force close settings without confirmation
function forceCloseSettings() {
    settingsModal.classList.add('hidden');
    originalSettingsValues = {};
}

// Close settings with unsaved changes check
async function closeSettings() {
    // Check if there are unsaved changes
    if (hasUnsavedSettingsChanges()) {
        const confirmed = await customConfirm(
            'You have unsaved changes. Are you sure you want to close without saving?',
            {
                title: 'Unsaved Changes',
                okText: 'Close Without Saving',
                cancelText: 'Cancel',
                okClass: 'btn-danger'
            }
        );

        if (!confirmed) {
            return; // User cancelled, keep modal open
        }

        // User confirmed - revert any changes made in the UI
        revertSettingsUI();
    }

    // No unsaved changes or user confirmed - close the modal
    forceCloseSettings();
}

// Revert settings UI to original values (without saving)
// SECURITY: Validate all values before applying to prevent corrupted localStorage from breaking UI
function revertSettingsUI() {
    // Validate theme with safe default
    const validThemes = ['system', 'light', 'dark'];
    themeSelect.value = validThemes.includes(originalSettingsValues.theme)
        ? originalSettingsValues.theme
        : 'system';

    // Validate boolean values with safe defaults
    autoUpdateCheck.checked = typeof originalSettingsValues.autoUpdateCheck === 'boolean'
        ? originalSettingsValues.autoUpdateCheck
        : true;

    // Validate terminal preference - must exist in dropdown options
    const validTerminalOptions = Array.from(terminalSelect.options).map(opt => opt.value);
    terminalSelect.value = validTerminalOptions.includes(originalSettingsValues.terminalPreference)
        ? originalSettingsValues.terminalPreference
        : 'default';

    // Validate custom terminal path - must be string, can be empty
    customTerminalPath.value = typeof originalSettingsValues.customTerminalPath === 'string'
        ? originalSettingsValues.customTerminalPath
        : '';

    // Validate boolean value with safe default
    includeProfilesCheck.checked = typeof originalSettingsValues.includeProfiles === 'boolean'
        ? originalSettingsValues.includeProfiles
        : false;

    // Validate recent connections limit - must be string representation of number 0-20
    const recentConnectionsLimitInput = document.getElementById('recent-connections-limit');
    if (recentConnectionsLimitInput) {
        const limit = parseInt(originalSettingsValues.recentConnectionsLimit, 10);
        recentConnectionsLimitInput.value = (!isNaN(limit) && limit >= 0 && limit <= 20)
            ? limit
            : 5;
    }

    // Validate keyboard shortcuts enabled - boolean with safe default
    const keyboardShortcutsCheck = document.getElementById('keyboard-shortcuts-check');
    if (keyboardShortcutsCheck) {
        keyboardShortcutsCheck.checked = typeof originalSettingsValues.keyboardShortcutsEnabled === 'boolean'
            ? originalSettingsValues.keyboardShortcutsEnabled
            : true;
    }

    updateTerminalVisibility();
}

// Save all settings changes
function saveSettings() {
    // Apply theme
    applyTheme(themeSelect.value);

    // Save auto-update preference
    saveAutoUpdatePreference();

    // Save terminal preference
    saveTerminalPreference();

    // Save include profiles preference
    saveIncludeProfilesPreference();

    // Save include passwords preference
    saveIncludePasswordsPreference();

    // Save use tabs in terminal preference
    saveUseTabsInTerminalPreference();

    // Save recent connections limit
    saveRecentConnectionsLimit();

    // Save keyboard shortcuts preference
    saveKeyboardShortcutsPreference();

    // Reload recent connections with new limit
    loadRecentConnections();

    // Capture new settings values and disable Save button
    captureSettingsValues();
    settingsSaveBtn.disabled = true;

    showToast('Settings saved successfully!');
}

// Update checker functions
function loadAutoUpdatePreference() {
    const autoUpdate = localStorage.getItem('autoUpdateCheck');
    // Default to true (checked) if not set
    if (autoUpdate === null) {
        autoUpdateCheck.checked = true;
        saveAutoUpdatePreference();
    } else {
        autoUpdateCheck.checked = autoUpdate === 'true';
    }
}

function loadIncludeProfilesPreference() {
    const includeProfiles = localStorage.getItem('includeProfiles');
    // Default to true (checked) if not set
    if (includeProfiles === null) {
        includeProfilesCheck.checked = true;
        saveIncludeProfilesPreference();
    } else {
        includeProfilesCheck.checked = includeProfiles === 'true';
    }
}

function saveAutoUpdatePreference() {
    localStorage.setItem('autoUpdateCheck', autoUpdateCheck.checked);
}

function saveIncludeProfilesPreference() {
    localStorage.setItem('includeProfiles', includeProfilesCheck.checked);
}

function loadIncludePasswordsPreference() {
    const includePasswords = localStorage.getItem('includePasswords');
    // Default to true (checked) if not set
    if (includePasswords === null) {
        includePasswordsCheck.checked = true;
        saveIncludePasswordsPreference();
    } else {
        includePasswordsCheck.checked = includePasswords === 'true';
    }
}

function saveIncludePasswordsPreference() {
    localStorage.setItem('includePasswords', includePasswordsCheck.checked);
}

function loadUseTabsInTerminalPreference() {
    const useTabsInTerminalCheck = document.getElementById('use-tabs-in-terminal-check');
    if (useTabsInTerminalCheck) {
        const useTabsInTerminal = localStorage.getItem('useTabsInTerminal');
        // Default to true (checked) if not set
        if (useTabsInTerminal === null) {
            useTabsInTerminalCheck.checked = true;
            saveUseTabsInTerminalPreference();
        } else {
            useTabsInTerminalCheck.checked = useTabsInTerminal === 'true';
        }
    }
}

function saveUseTabsInTerminalPreference() {
    const useTabsInTerminalCheck = document.getElementById('use-tabs-in-terminal-check');
    if (useTabsInTerminalCheck) {
        localStorage.setItem('useTabsInTerminal', useTabsInTerminalCheck.checked);
    }
}

async function checkForUpdates(silent = false) {
    try {
        const updateInfo = await invoke('check_for_updates');

        if (updateInfo.update_available) {
            // Update available
            const message = `A new version is available!\n\nCurrent: v${updateInfo.current_version}\nLatest: v${updateInfo.latest_version}\n\nWould you like to download it?`;
            const shouldDownload = await customConfirm(message, {
                title: 'Update Available',
                okText: 'Download',
                cancelText: 'Later',
                okClass: 'btn-primary'
            });

            if (shouldDownload) {
                // Open download URL in browser
                await shell.open(updateInfo.download_url);
            }
        } else if (!silent) {
            // No update available, only show if not silent
            showToast('You are running the latest version!');
        }
    } catch (error) {
        console.error('Failed to check for updates:', error);
        if (!silent) {
            showToast('Failed to check for updates: ' + error, TOAST_DURATION_LONG, 'error');
        }
    }
}

// Filter functions
function loadFilterState() {
    const savedFilters = localStorage.getItem('filteredGroups');
    if (savedFilters) {
        try {
            const filtersArray = JSON.parse(savedFilters);

            // Validate data structure
            if (!Array.isArray(filtersArray)) {
                throw new Error('Invalid filter data structure');
            }

            // Validate array length (max 1000 to prevent DoS)
            if (filtersArray.length > 1000) {
                throw new Error('Too many filtered groups');
            }

            // Validate UUIDs or "ungrouped"
            // UUID pattern: 8-4-4-4-12 hex digits
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const validItems = filtersArray.every(item =>
                typeof item === 'string' &&
                item.length > 0 &&
                (item === 'ungrouped' || uuidRegex.test(item))
            );

            if (!validItems) {
                throw new Error('Invalid filter group identifiers');
            }

            filteredGroups = new Set(filtersArray);
            updateFilterBadge();
        } catch (error) {
            console.error('Failed to load filter state:', error);
            filteredGroups = new Set();

            // Clear corrupted data
            localStorage.removeItem('filteredGroups');

            // Notify user
            showToast('Filter preferences were reset due to corrupted data', TOAST_DURATION_LONG, 'error');
        }
    }
}

function saveFilterState() {
    const filtersArray = Array.from(filteredGroups);
    localStorage.setItem('filteredGroups', JSON.stringify(filtersArray));
    updateFilterBadge();
}

function loadCollapsedState() {
    const savedCollapsed = localStorage.getItem('collapsedGroups');
    if (savedCollapsed) {
        try {
            const collapsedArray = JSON.parse(savedCollapsed);

            // Validate data structure
            if (!Array.isArray(collapsedArray)) {
                throw new Error('Invalid collapsed groups data structure');
            }

            // Validate array length (max 1000 to prevent DoS)
            if (collapsedArray.length > 1000) {
                throw new Error('Too many collapsed groups');
            }

            // Validate UUIDs or "ungrouped"
            // UUID pattern: 8-4-4-4-12 hex digits
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const validItems = collapsedArray.every(item =>
                typeof item === 'string' &&
                item.length > 0 &&
                (item === 'ungrouped' || uuidRegex.test(item))
            );

            if (!validItems) {
                throw new Error('Invalid collapsed group identifiers');
            }

            collapsedGroups = new Set(collapsedArray);
        } catch (error) {
            console.error('Failed to load collapsed state:', error);
            collapsedGroups = new Set();

            // Clear corrupted data
            localStorage.removeItem('collapsedGroups');

            // Notify user
            showToast('Collapsed groups state was reset due to corrupted data', TOAST_DURATION_LONG, 'error');
        }
    }
}

function saveCollapsedState() {
    const collapsedArray = Array.from(collapsedGroups);
    localStorage.setItem('collapsedGroups', JSON.stringify(collapsedArray));
}

function updateFilterBadge() {
    const topLevelGroups = getTopLevelGroups();
    const selectedGroups = topLevelGroups.length - filteredGroups.size;

    // Always show badge with X/Y format
    filterBadge.textContent = `${selectedGroups}/${topLevelGroups.length}`;
}

function getAllGroups() {
    // Return all group IDs (including empty groups that only have sub-groups)
    const allGroupIds = new Set();

    // Add all groups from the groups array
    groups.forEach(group => {
        allGroupIds.add(group.id);
    });

    // Add ungrouped if there are ungrouped profiles
    const hasUngroupedProfiles = profiles.some(profile => !profile.group_id);
    if (hasUngroupedProfiles) {
        allGroupIds.add('ungrouped');
    }

    return Array.from(allGroupIds);
}

function getTopLevelGroups() {
    // Return only top-level group IDs (no parent)
    const topLevelGroupIds = [];

    // Get top-level groups from the groups array
    groups.forEach(group => {
        if (!group.parent_id) {
            topLevelGroupIds.push(group.id);
        }
    });

    // Add ungrouped if there are ungrouped profiles
    const hasUngrouped = profiles.some(p => !p.group_id);
    if (hasUngrouped) {
        topLevelGroupIds.push('ungrouped');
    }

    return topLevelGroupIds;
}

// Check if a profile belongs to a group or any of its descendants
function isProfileInGroupOrDescendants(profile, groupId) {
    if (!profile.group_id) return false;

    // Check if profile's group matches
    if (profile.group_id === groupId) return true;

    // Check if profile's group is a descendant
    const profileGroup = groups.find(g => g.id === profile.group_id);
    if (!profileGroup) return false;

    // Walk up the parent chain to see if we find the target group
    let currentGroup = profileGroup;
    while (currentGroup && currentGroup.parent_id) {
        if (currentGroup.parent_id === groupId) return true;
        currentGroup = groups.find(g => g.id === currentGroup.parent_id);
    }

    return false;
}

// Check if any ancestor of a group is filtered
function isGroupOrAncestorFiltered(groupId) {
    if (!groupId) return false;

    // Check if this group itself is filtered
    if (filteredGroups.has(groupId)) return true;

    // Check if any ancestor is filtered
    const group = groups.find(g => g.id === groupId);
    if (!group || !group.parent_id) return false;

    // Recursively check parent
    return isGroupOrAncestorFiltered(group.parent_id);
}

function buildFilterGroupsList() {
    // Get only TOP-LEVEL groups (no parent_id)
    // This simplifies the filter UI and prevents bloat
    const topLevelGroups = groups.filter(g => !g.parent_id);

    // Add ungrouped if there are ungrouped profiles
    const hasUngrouped = profiles.some(p => !p.group_id);
    if (hasUngrouped) {
        topLevelGroups.push({ id: 'ungrouped', name: 'Ungrouped', path: 'Ungrouped' });
    }

    if (topLevelGroups.length === 0) {
        filterGroupsList.innerHTML = '<div class="filter-empty-state">No groups available</div>';
        return;
    }

    // Sort by name
    topLevelGroups.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    let html = '';
    topLevelGroups.forEach(group => {
        const isChecked = !filteredGroups.has(group.id);

        // Count profiles in this group AND all its descendants
        const groupProfiles = profiles.filter(p => {
            if (group.id === 'ungrouped') {
                return !p.group_id;
            }
            // Check if profile is in this group or any descendant
            return isProfileInGroupOrDescendants(p, group.id);
        });

        html += `
            <div class="filter-group-item">
                <label>
                    <input type="checkbox"
                           class="filter-group-checkbox"
                           data-group-id="${group.id}"
                           tabindex="0"
                           ${isChecked ? 'checked' : ''}>
                    <span class="filter-group-name">${escapeHtml(group.name)}</span>
                </label>
                <span class="filter-group-count">${groupProfiles.length}</span>
            </div>
        `;
    });

    filterGroupsList.innerHTML = html;

    // Debounced update function to prevent race conditions
    const updateFilters = debounce(() => {
        saveFilterState();
        renderProfiles(searchInput.value);
    }, DEBOUNCE_DELAY);

    // Add event listeners to checkboxes
    document.querySelectorAll('.filter-group-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const groupId = e.target.dataset.groupId;
            if (e.target.checked) {
                // Show this group
                filteredGroups.delete(groupId);
            } else {
                // Hide this group
                filteredGroups.add(groupId);
            }
            updateFilters();
        });
    });
}

function toggleFilterPopup() {
    const isHidden = filterPopup.classList.contains('hidden');

    if (isHidden) {
        // Build the list before showing
        buildFilterGroupsList();

        // Position popup to align with filter button (works in both normal and compact views)
        const filterBtnRect = filterBtn.getBoundingClientRect();
        const searchBarRect = filterPopup.parentElement.getBoundingClientRect();

        // Calculate horizontal position (left edge of button)
        const leftOffset = filterBtnRect.left - searchBarRect.left;
        filterPopup.style.left = `${leftOffset}px`;

        // Calculate vertical position (directly below button)
        const topOffset = filterBtnRect.bottom - searchBarRect.top + 8; // 8px margin
        filterPopup.style.top = `${topOffset}px`;

        filterPopup.classList.remove('hidden');

        // Focus the first item (Clear All button) when opening
        setTimeout(() => {
            const items = getFilterPopupItems();
            if (items.length > 0) {
                items[0].focus();
            }
        }, 0);
    } else {
        filterPopup.classList.add('hidden');
    }
}

function clearGroupFilters() {
    filteredGroups.clear();
    saveFilterState();
    buildFilterGroupsList();
    renderProfiles(searchInput.value);
}

// Get all focusable items in the filter popup
function getFilterPopupItems() {
    const items = [];

    // Add Clear All button first
    if (clearFiltersBtn) {
        items.push(clearFiltersBtn);
    }

    // Add all checkboxes
    const checkboxes = document.querySelectorAll('.filter-group-checkbox');
    checkboxes.forEach(checkbox => {
        items.push(checkbox);
    });

    return items;
}

// Handle keyboard navigation in filter popup
function handleFilterPopupKeyboard(e) {
    const items = getFilterPopupItems();
    if (items.length === 0) return false;

    const currentIndex = items.indexOf(document.activeElement);

    // Arrow keys - navigate through items
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentIndex < items.length - 1) {
            items[currentIndex + 1].focus();
        } else {
            // Wrap to first item
            items[0].focus();
        }
        return true;
    }

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentIndex > 0) {
            items[currentIndex - 1].focus();
        } else {
            // Wrap to last item
            items[items.length - 1].focus();
        }
        return true;
    }

    // Enter key
    if (e.key === 'Enter') {
        e.preventDefault();
        const focused = document.activeElement;

        // If it's the Clear All button, click it
        if (focused === clearFiltersBtn) {
            clearFiltersBtn.click();
            return true;
        }

        // If it's a checkbox, toggle it
        if (focused.classList.contains('filter-group-checkbox')) {
            focused.checked = !focused.checked;
            focused.dispatchEvent(new Event('change'));
            return true;
        }

        return true;
    }

    // Space key - toggle checkboxes only (not Clear All button)
    if (e.key === ' ') {
        e.preventDefault();
        const focused = document.activeElement;

        // Only toggle if it's a checkbox (not the Clear All button)
        if (focused.classList.contains('filter-group-checkbox')) {
            focused.checked = !focused.checked;
            focused.dispatchEvent(new Event('change'));
            return true;
        }

        return false;
    }

    // Tab key - close popup and return focus to filter button
    if (e.key === 'Tab') {
        e.preventDefault();
        filterPopup.classList.add('hidden');
        filterBtn.focus();
        return true;
    }

    // Escape key - close popup and refocus filter button
    if (e.key === 'Escape') {
        e.preventDefault();
        filterPopup.classList.add('hidden');
        filterBtn.focus();
        return true;
    }

    return false;
}

// Window state functions
async function loadWindowState() {
    try {
        const savedWidth = localStorage.getItem('windowWidth');
        const savedHeight = localStorage.getItem('windowHeight');

        // Only restore if we have saved values, otherwise use defaults (800x600)
        if (savedWidth && savedHeight) {
            const MIN_WIDTH = 600;
            const MIN_HEIGHT = 450;
            const MAX_WIDTH = 4000;
            const MAX_HEIGHT = 3000;

            let width = parseInt(savedWidth);
            let height = parseInt(savedHeight);

            // Validate and clamp to valid range
            if (isNaN(width) || isNaN(height) ||
                width < MIN_WIDTH || width > MAX_WIDTH ||
                height < MIN_HEIGHT || height > MAX_HEIGHT) {
                debug.warn('Invalid window dimensions in storage, using defaults');
                await resetWindowState();
                return;
            }

            const window = getCurrentWindow();
            const size = new LogicalSize(width, height);
            await window.setSize(size);
        }
    } catch (error) {
        console.error('Error loading window state:', error);
        // Fall back to defaults on error
        await resetWindowState();
    }
}

async function saveWindowState() {
    try {
        const window = getCurrentWindow();

        // Fetch size and scale factor concurrently to avoid race conditions
        const [size, scale] = await Promise.all([
            window.innerSize(),
            window.scaleFactor()
        ]);

        // Use logical size (not physical pixels) - important for Retina displays
        const logicalSize = size.toLogical(scale);

        localStorage.setItem('windowWidth', Math.round(logicalSize.width));
        localStorage.setItem('windowHeight', Math.round(logicalSize.height));
    } catch (error) {
        console.error('Error saving window state:', error);
    }
}

async function resetWindowState() {
    try {
        // Reset to defaults (800x600)
        localStorage.setItem('windowWidth', '800');
        localStorage.setItem('windowHeight', '600');

        const window = getCurrentWindow();
        const size = new LogicalSize(800, 600);
        await window.setSize(size);
    } catch (error) {
        console.error('Error resetting window state:', error);
    }
}

// Setup window resize listener with debouncing to prevent race conditions
async function setupWindowListeners() {
    try {
        const window = getCurrentWindow();
        // Debounce save to prevent multiple rapid async writes during window dragging
        const debouncedSaveWindowState = debounce(saveWindowState, 250);

        await window.listen('tauri://resize', async () => {
            await debouncedSaveWindowState();
        });
    } catch (error) {
        console.error('Error setting up window listeners:', error);
    }
}

// Theme functions
function loadThemePreference() {
    const savedTheme = localStorage.getItem('theme') || 'system';
    themeSelect.value = savedTheme;
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    localStorage.setItem('theme', theme);

    if (theme === 'system') {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.toggle('light-mode', !prefersDark);
    } else if (theme === 'light') {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (themeSelect.value === 'system') {
        document.body.classList.toggle('light-mode', !e.matches);
    }
});

// Terminal preference functions
function getOS() {
    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();

    if (platform.includes('mac') || userAgent.includes('mac')) {
        return 'macos';
    } else if (platform.includes('win') || userAgent.includes('win')) {
        return 'windows';
    }
    return 'unknown';
}

function populateTerminalOptions() {
    const os = getOS();
    terminalSelect.innerHTML = ''; // Clear existing options

    // Get the help text element for terminal settings
    // Find the help text that follows the use-tabs checkbox
    const terminalSection = document.getElementById('use-tabs-in-terminal-check')?.closest('.settings-section');
    const helpText = terminalSection?.querySelector('p.settings-help');

    if (os === 'macos') {
        terminalSelect.innerHTML = `
            <option value="default">Default (Terminal.app)</option>
            <option value="custom">Custom Terminal</option>
            <option value="embedded">Embedded Terminal (beta)</option>
        `;
        if (helpText) {
            helpText.textContent = 'Choose which terminal application to use when connecting to SSH profiles. When enabled, profiles open as tabs in existing terminal windows (macOS Terminal, Windows Terminal).';
        }
    } else if (os === 'windows') {
        terminalSelect.innerHTML = `
            <option value="default">Default (System Default)</option>
            <option value="cmd">Command Prompt</option>
            <option value="powershell">PowerShell</option>
            <option value="windows_terminal">Windows Terminal</option>
            <option value="custom">Custom Terminal</option>
            <option value="embedded">Embedded Terminal (beta)</option>
        `;
        if (helpText) {
            helpText.innerHTML = 'Choose which terminal application to use when connecting to SSH profiles. When enabled, profiles open as tabs in existing terminal windows.<br><strong>Note:</strong> Windows Terminal tabs remain open after SSH exits. To enable auto-close, configure "closeOnExit" in Windows Terminal settings.';
        }
    } else {
        // Unknown OS - show minimal options
        terminalSelect.innerHTML = `
            <option value="default">Default Terminal</option>
        `;
        if (helpText) {
            helpText.textContent = 'Choose which terminal application to use when connecting to SSH profiles.';
        }
    }
}

async function loadTerminalPreference() {
    const savedPreference = localStorage.getItem('terminalPreference') || 'default';
    const savedCustomPath = localStorage.getItem('customTerminalPath') || '';

    // If custom terminal was selected, validate the path still exists and is valid
    if (savedPreference === 'custom' && savedCustomPath) {
        try {
            // Validate the saved custom path
            await invoke('validate_custom_terminal', { path: savedCustomPath });
            // Path is valid, use saved preferences
            terminalSelect.value = savedPreference;
            customTerminalPath.value = savedCustomPath;
        } catch (error) {
            // Path is no longer valid, fall back to default
            debug.warn('Saved custom terminal path is no longer valid:', error);
            terminalSelect.value = 'default';
            customTerminalPath.value = '';
            localStorage.setItem('terminalPreference', 'default');
            localStorage.removeItem('customTerminalPath');
            showToast('Custom terminal path is no longer valid. Switched to default terminal.', TOAST_DURATION_LONG, 'info');
        }
    } else {
        terminalSelect.value = savedPreference;
        customTerminalPath.value = savedCustomPath;
    }

    // Show/hide custom terminal path input
    updateTerminalVisibility();
}

function saveTerminalPreference() {
    localStorage.setItem('terminalPreference', terminalSelect.value);
    localStorage.setItem('customTerminalPath', customTerminalPath.value);
}

function updateTerminalVisibility() {
    const isCustom = terminalSelect.value === 'custom';
    customTerminalGroup.classList.toggle('hidden', !isCustom);
}

async function browseTerminalApp() {
    try {
        const result = await invoke('browse_terminal_app');
        if (result) {
            // User selected a terminal app
            customTerminalPath.value = result;
            saveTerminalPreference();
        }
        // If result is null, user cancelled - do nothing
    } catch (error) {
        console.error('Failed to browse for terminal app:', error);
        showToast('Failed to open application browser: ' + error, TOAST_DURATION_LONG, 'error');
    }
}

// Export profiles to JSON
async function exportProfiles() {
    try {
        // Show loading feedback
        showToast('Exporting profiles...', TOAST_DURATION_LOADING);

        // Check if passwords should be included (read from localStorage)
        const includePasswords = localStorage.getItem('includePasswords') !== 'false';

        const data = await invoke('export_profiles', { includePasswords });
        const defaultFilename = `sshpm-profiles-${new Date().toISOString().split('T')[0]}.json`;

        // Call Tauri backend to show save dialog and write file
        const success = await invoke('save_profiles_to_file', {
            data: data,
            defaultFilename: defaultFilename
        });

        if (success) {
            showToast('Profiles exported successfully!');
            debug.log('Profiles exported successfully');
        } else {
            // Hide the loading toast
            toastElement.classList.add('hidden');
            debug.log('User cancelled save dialog');
        }
    } catch (error) {
        console.error('Failed to export profiles:', error);
        showToast('Failed to export profiles: ' + error, TOAST_DURATION_LONG, 'error');
    }
}

// Validate profile import JSON structure
function validateProfileImportData(data) {
    // Must have a profiles array
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Invalid JSON structure' };
    }

    // Check if this is a settings file (has settings object)
    // Settings files should use "Restore Settings", not "Import Profiles"
    if (data.settings && typeof data.settings === 'object') {
        return {
            valid: false,
            error: 'This appears to be a settings backup file.\nPlease use "Restore Settings" instead of "Import Profiles"'
        };
    }

    if (!data.profiles || !Array.isArray(data.profiles)) {
        return { valid: false, error: 'Missing or invalid "profiles" array' };
    }

    if (data.profiles.length === 0) {
        return { valid: false, error: 'No profiles found in file' };
    }

    // Validate each profile has required fields
    const requiredFields = ['name', 'host', 'username', 'auth_method'];
    for (let i = 0; i < data.profiles.length; i++) {
        const profile = data.profiles[i];

        for (const field of requiredFields) {
            if (!profile.hasOwnProperty(field) || profile[field] === null) {
                return {
                    valid: false,
                    error: `Profile ${i + 1} is missing required field: "${field}"`
                };
            }
        }

        // Validate auth_method is one of the allowed values
        const validAuthMethods = ['none', 'key', 'password'];
        if (!validAuthMethods.includes(profile.auth_method)) {
            return {
                valid: false,
                error: `Profile ${i + 1} has invalid auth_method: "${profile.auth_method}"`
            };
        }
    }

    return { valid: true };
}

// Import profiles from JSON
async function importProfiles(file) {
    try {
        // Show loading feedback
        showToast('Reading import file...', TOAST_DURATION_LOADING);

        // Note: file.text() is a modern File API method (not supported in older browsers)
        // This is fine for Tauri apps as they use a modern WebView (WKWebView on macOS, WebView2 on Windows)
        const text = await file.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            showToast('Invalid JSON file: File is not valid JSON format', TOAST_DURATION_LONG, 'error');
            return;
        }

        // Validate the JSON structure
        const validation = validateProfileImportData(data);
        if (!validation.valid) {
            showToast(`Invalid profile file: ${validation.error}`, TOAST_DURATION_LONG, 'error');
            return;
        }

        // Close settings modal first to avoid visibility issues
        closeSettings();

        // Check if we have existing profiles
        if (profiles.length > 0) {
            // Hide loading toast while showing confirmation
            toastElement.classList.add('hidden');

            const existingCount = profiles.length;
            const importCount = data.profiles?.length || 0;
            const existingText = existingCount === 1 ? 'existing profile' : 'existing profiles';
            const importText = importCount === 1 ? 'new profile' : 'new profiles';

            const confirmMessage = buildConfirmMessage({
                lines: [
                    { prefix: 'You have ', highlight: `${existingCount} ${existingText}`, suffix: '.' }
                ],
                warnings: [
                    `Importing will add ${importCount} ${importText} and override all existing profiles.`
                ],
                question: 'Are you sure you want to import these profiles?'
            });

            const confirmImport = await customConfirm(confirmMessage, {
                title: 'Confirm Import',
                okText: 'Import',
                cancelText: 'Cancel',
                okClass: 'btn-primary'
            });

            if (!confirmImport) {
                debug.log('User cancelled import');
                return;
            }
        }

        // Show importing feedback
        showToast('Importing profiles...', TOAST_DURATION_LOADING);

        // Import profiles via backend
        await invoke('import_profiles', { data: text });

        // Reload profiles
        await loadProfiles();

        const count = data.profiles?.length || 0;
        const message = count === 1
            ? 'Successfully imported 1 profile!'
            : `Successfully imported ${count} profiles!`;
        showToast(message);
        debug.log('Profiles imported successfully');
    } catch (error) {
        console.error('Failed to import profiles:', error);
        showToast('Failed to import profiles: ' + error, TOAST_DURATION_LONG, 'error');
    }
}

// Delete all profiles
async function deleteAllProfiles() {
    if (profiles.length === 0) {
        showToast('No profiles to delete!', TOAST_DURATION_SHORT, 'error');
        return;
    }

    const count = profiles.length;
    const profileText = count === 1 ? 'profile' : 'profiles';

    const confirmMessage = buildConfirmMessage({
        lines: [
            { prefix: 'You currently have ', highlight: `${count} ${profileText}`, suffix: '.' }
        ],
        warnings: [
            'This will permanently delete all profiles and their stored passwords.',
            'This action cannot be undone.'
        ],
        question: 'Are you sure you want to delete all profiles?'
    });

    const confirmed = await customConfirm(confirmMessage, {
        title: 'Delete All Profiles',
        okText: 'Delete All',
        cancelText: 'Cancel',
        okClass: 'btn-danger'
    });

    if (!confirmed) {
        debug.log('User cancelled delete all');
        return;
    }

    // Close settings modal after confirmation
    closeSettings();

    try {
        // Delete all profiles
        for (const profile of profiles) {
            await invoke('delete_profile', { id: profile.id });
        }

        await loadProfiles();
        showToast('All profiles deleted successfully!');
        debug.log('All profiles deleted');
    } catch (error) {
        console.error('Failed to delete all profiles:', error);
        showToast('Failed to delete all profiles: ' + error, TOAST_DURATION_LONG, 'error');
    }
}

// Backup settings to JSON file
async function backupSettings() {
    try {
        showToast('Backing up settings...', TOAST_DURATION_LOADING);

        const theme = localStorage.getItem('theme') || 'system';
        const autoUpdateCheck = localStorage.getItem('autoUpdateCheck') === 'true';
        const includeProfiles = includeProfilesCheck.checked;
        const windowWidth = parseInt(localStorage.getItem('windowWidth') || '800');
        const windowHeight = parseInt(localStorage.getItem('windowHeight') || '600');
        const recentConnectionsLimit = getRecentConnectionsLimit();

        // Always include terminal preference (OS-specific setting, will be tagged with OS)
        const terminalPreference = localStorage.getItem('terminalPreference') || 'default';
        const useTabsInTerminal = localStorage.getItem('useTabsInTerminal') !== 'false'; // Default to true

        // Only include filtered/collapsed groups if profiles are included
        let filteredGroups = null;
        let collapsedGroups = null;

        if (includeProfiles) {
            const filteredGroupsData = localStorage.getItem('filteredGroups') || '[]';
            const collapsedGroupsData = localStorage.getItem('collapsedGroups') || '[]';
            filteredGroups = JSON.parse(filteredGroupsData);
            collapsedGroups = JSON.parse(collapsedGroupsData);
        }

        // Check if passwords should be included (from Profile Management setting)
        const includePasswords = localStorage.getItem('includePasswords') !== 'false';

        const data = await invoke('export_settings', {
            theme,
            autoUpdateCheck,
            recentConnectionsLimit,
            filteredGroups,
            collapsedGroups,
            terminalPreference: terminalPreference,
            useTabsInTerminal: useTabsInTerminal,
            includeProfiles,
            includePasswords,
            windowWidth,
            windowHeight
        });

        const defaultFilename = `sshpm-settings-${new Date().toISOString().split('T')[0]}.json`;

        const success = await invoke('save_profiles_to_file', {
            data: data,
            defaultFilename: defaultFilename
        });

        if (success) {
            showToast('Settings backed up successfully!');
            debug.log('Settings backed up successfully');
        } else {
            toastElement.classList.add('hidden');
            debug.log('User cancelled backup dialog');
        }
    } catch (error) {
        console.error('Failed to backup settings:', error);
        showToast('Failed to backup settings: ' + error, TOAST_DURATION_LONG, 'error');
    }
}

// Validate settings restore JSON structure
function validateSettingsRestoreData(data) {
    // Must have basic structure
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Invalid JSON structure' };
    }

    // Check if this is a profile-only export file (has profiles but no settings)
    // Profile files should use "Import Profiles", not "Restore Settings"
    if (data.profiles && !data.settings) {
        return {
            valid: false,
            error: 'This appears to be a profile export file.\nPlease use "Import Profiles" instead of "Restore Settings"'
        };
    }

    // Must have version field
    if (!data.version || typeof data.version !== 'string') {
        return { valid: false, error: 'Missing or invalid "version" field' };
    }

    // Must have settings object
    if (!data.settings || typeof data.settings !== 'object') {
        return { valid: false, error: 'Missing or invalid "settings" object' };
    }

    // Validate required settings fields
    const requiredSettings = ['theme', 'auto_update_check', 'window_width', 'window_height'];
    for (const field of requiredSettings) {
        if (!data.settings.hasOwnProperty(field)) {
            return {
                valid: false,
                error: `Settings missing required field: "${field}"`
            };
        }
    }

    // Validate theme value
    const validThemes = ['system', 'dark', 'light'];
    if (!validThemes.includes(data.settings.theme)) {
        return {
            valid: false,
            error: `Invalid theme value: "${data.settings.theme}"`
        };
    }

    // If profiles are included, validate them
    if (data.profiles) {
        if (!Array.isArray(data.profiles)) {
            return { valid: false, error: 'Invalid "profiles" field (must be an array)' };
        }

        // Use the same validation as profile imports
        const profileValidation = validateProfileImportData({ profiles: data.profiles });
        if (!profileValidation.valid) {
            return profileValidation;
        }
    }

    return { valid: true };
}

// Restore settings from JSON file
async function restoreSettings(file) {
    try {
        // Rate limiting: prevent rapid successive imports (5-second cooldown)
        const now = Date.now();
        const timeSinceLastImport = now - lastImportTime;
        const IMPORT_COOLDOWN_MS = 5000; // 5 seconds

        if (timeSinceLastImport < IMPORT_COOLDOWN_MS) {
            const remainingSeconds = Math.ceil((IMPORT_COOLDOWN_MS - timeSinceLastImport) / 1000);
            showToast(`Please wait ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''} before importing again`, TOAST_DURATION_LONG, 'error');
            return;
        }

        lastImportTime = now;

        showToast('Reading settings file...', TOAST_DURATION_LOADING);

        const text = await file.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            showToast('Invalid JSON file: File is not valid JSON format', TOAST_DURATION_LONG, 'error');
            return;
        }

        // Validate the JSON structure
        const validation = validateSettingsRestoreData(data);
        if (!validation.valid) {
            showToast(`Invalid settings file: ${validation.error}`, TOAST_DURATION_LONG, 'error');
            return;
        }

        closeSettings();

        const result = await invoke('import_settings', { data: text });
        const includesProfiles = result.profiles && result.profiles.length > 0;

        // Check if backup OS matches current OS
        const backupOS = data.os || 'unknown';
        const currentOS = getOS();
        const osMatches = backupOS === currentOS;

        // Check if we have existing settings or profiles
        const hasSettings = localStorage.getItem('theme') ||
                          localStorage.getItem('autoUpdateCheck') ||
                          localStorage.getItem('filteredGroups') ||
                          localStorage.getItem('collapsedGroups');
        const hasProfiles = profiles.length > 0;

        if (hasSettings || (includesProfiles && hasProfiles) || !osMatches) {
            toastElement.classList.add('hidden');

            // Build confirmation message based on what's included
            const lines = [];
            const warnings = [];

            if (includesProfiles) {
                const importCount = result.profiles.length;
                const profileText = importCount === 1 ? 'profile' : 'profiles';
                lines.push({ prefix: 'This backup contains ', highlight: `${importCount} ${profileText}`, suffix: '.' });
                warnings.push(`Restoring will replace all your current settings${hasProfiles ? ' and profiles' : ''}.`);
            } else {
                lines.push('You have existing settings configured.');
                warnings.push('Restoring will replace all your current settings.');
            }

            // Add OS mismatch warning
            if (!osMatches) {
                const osNames = { 'macos': 'macOS', 'windows': 'Windows', 'unknown': 'Unknown OS' };
                warnings.push(`This backup is from ${osNames[backupOS] || backupOS}. OS-specific settings will use ${osNames[currentOS] || currentOS} defaults.`);
            }

            const confirmMessage = buildConfirmMessage({
                lines,
                warnings,
                question: 'Are you sure you want to restore this backup?'
            });

            const confirmRestore = await customConfirm(confirmMessage, {
                title: 'Confirm Restore',
                okText: 'Restore',
                cancelText: 'Cancel',
                okClass: 'btn-primary'
            });

            if (!confirmRestore) {
                debug.log('User cancelled restore');
                return;
            }
        }

        showToast('Restoring settings...', TOAST_DURATION_LOADING);

        // Validate and restore settings with safe defaults
        // Defense in depth: frontend validation in addition to backend validation
        // SECURITY: Whitelist approach - only explicitly validated fields are written to localStorage
        // This prevents arbitrary localStorage injection even if backend validation is bypassed

        // Validate theme (must be string and one of the allowed values)
        const validThemes = ['system', 'dark', 'light'];
        const theme = (typeof result.settings.theme === 'string' && validThemes.includes(result.settings.theme))
            ? result.settings.theme
            : 'system';
        localStorage.setItem('theme', theme);

        // Validate auto update check (must be boolean)
        const autoUpdate = typeof result.settings.auto_update_check === 'boolean'
            ? result.settings.auto_update_check
            : true;
        localStorage.setItem('autoUpdateCheck', autoUpdate.toString());

        // Restore OS-specific settings if present (backend filters cross-platform backups)
        if (result.settings_os_specific && result.settings_os_specific.terminal_preference) {
            // Validate terminal preference based on OS (must be string and in whitelist)
            const validTerminalPrefs = getOS() === 'macos'
                ? ['default', 'custom', 'embedded']
                : ['default', 'cmd', 'powershell', 'windows_terminal', 'custom', 'embedded'];

            const termPref = (typeof result.settings_os_specific.terminal_preference === 'string'
                && validTerminalPrefs.includes(result.settings_os_specific.terminal_preference))
                ? result.settings_os_specific.terminal_preference
                : 'default';
            localStorage.setItem('terminalPreference', termPref);

            // Restore use_tabs_in_terminal if present (default to true if not specified)
            const useTabsInTerminal = result.settings_os_specific.use_tabs_in_terminal !== false;
            localStorage.setItem('useTabsInTerminal', useTabsInTerminal.toString());
        } else {
            // No OS-specific settings in backup (different OS or old format) - use defaults
            localStorage.setItem('terminalPreference', 'default');
            localStorage.setItem('useTabsInTerminal', 'true');
        }

        // Restore window state if available with validation
        if (result.settings.window_width && result.settings.window_height) {
            // Validate window dimensions (reasonable bounds: 560-5000 width, 420-3000 height)
            const width = typeof result.settings.window_width === 'number'
                && result.settings.window_width >= 560
                && result.settings.window_width <= 5000
                ? result.settings.window_width
                : 800;

            const height = typeof result.settings.window_height === 'number'
                && result.settings.window_height >= 420
                && result.settings.window_height <= 3000
                ? result.settings.window_height
                : 600;

            localStorage.setItem('windowWidth', width.toString());
            localStorage.setItem('windowHeight', height.toString());

            try {
                const window = getCurrentWindow();
                const size = new LogicalSize(width, height);
                await window.setSize(size);
            } catch (error) {
                console.error('Error restoring window size:', error);
            }
        }

        // Validate and restore recent connections limit
        if (result.settings.recent_connections_limit !== undefined) {
            // Validate limit (must be number between 0-20)
            const limit = typeof result.settings.recent_connections_limit === 'number'
                && result.settings.recent_connections_limit >= 0
                && result.settings.recent_connections_limit <= 20
                ? result.settings.recent_connections_limit
                : 5;
            localStorage.setItem('recentConnectionsLimit', limit.toString());
        }

        // Validate and restore filtered/collapsed groups
        // Must be arrays, with reasonable length limits (max 1000 items to prevent DoS)
        if (result.settings.filtered_groups) {
            if (Array.isArray(result.settings.filtered_groups)
                && result.settings.filtered_groups.length <= 1000
                && result.settings.filtered_groups.every(g => typeof g === 'string' && g.length <= 32)) {
                localStorage.setItem('filteredGroups', JSON.stringify(result.settings.filtered_groups));
            } else {
                debug.warn('Invalid filtered_groups in backup, skipping');
            }
        }
        if (result.settings.collapsed_groups) {
            if (Array.isArray(result.settings.collapsed_groups)
                && result.settings.collapsed_groups.length <= 1000
                && result.settings.collapsed_groups.every(g => typeof g === 'string' && g.length <= 32)) {
                localStorage.setItem('collapsedGroups', JSON.stringify(result.settings.collapsed_groups));
            } else {
                debug.warn('Invalid collapsed_groups in backup, skipping');
            }
        }

        themeSelect.value = theme;
        applyTheme(theme);

        autoUpdateCheck.checked = autoUpdate;

        // Reload terminal preference UI
        loadTerminalPreference();

        // Restore profiles if included
        if (includesProfiles) {
            // Delete all existing profiles first
            for (const profile of profiles) {
                await invoke('delete_profile', { id: profile.id });
            }

            // Import the profiles
            let successCount = 0;
            let failedProfiles = [];

            for (const profileExport of result.profiles) {
                try {
                    // Profile fields are flattened, not nested
                    const profileInput = {
                        name: profileExport.name,
                        description: profileExport.description || null,
                        host: profileExport.host,
                        port: profileExport.port,
                        username: profileExport.username,
                        auth_method: profileExport.auth_method,
                        key_path: profileExport.key_path || null,
                        password: profileExport.password || null,
                        group: profileExport.group || null
                    };

                    await invoke('create_profile', { profile: profileInput });
                    successCount++;
                } catch (error) {
                    console.error(`Failed to restore profile "${profileExport.name}":`, error);
                    failedProfiles.push(profileExport.name);
                }
            }

            // Show warning if some profiles failed
            if (failedProfiles.length > 0) {
                const failedNames = failedProfiles.join(', ');
                showToast(`Warning: ${failedProfiles.length} profile(s) failed to restore: ${failedNames}`, TOAST_DURATION_LONG, 'error');
            }
        }

        loadFilterState();
        loadCollapsedState();
        loadRecentConnectionsLimit(); // Reload recent connections limit into settings input

        await loadProfiles();
        await loadRecentConnections(); // Reload recent connections with new limit

        const successMessage = includesProfiles
            ? `Settings and ${result.profiles.length} ${result.profiles.length === 1 ? 'profile' : 'profiles'} restored successfully!`
            : 'Settings restored successfully!';
        showToast(successMessage);
        debug.log('Settings restored successfully');
    } catch (error) {
        console.error('Failed to restore settings:', error);
        showToast('Failed to restore settings: ' + error, TOAST_DURATION_LONG, 'error');
    }
}

// Reset all settings to defaults
async function resetSettings() {
    try {
        const confirmMessage = buildConfirmMessage({
            warnings: ['This will reset all settings to their default values:'],
            list: [
                'Theme: System',
                'Terminal: Default',
                'Auto-update check: Enabled',
                'Window size: 800 × 600',
                'Recent connections limit: 5',
                'Filtered groups: Cleared',
                'Collapsed groups: Cleared'
            ],
            lines: ['Profiles will not be affected.'],
            question: 'Are you sure you want to reset all settings?'
        });

        const confirmReset = await customConfirm(confirmMessage, {
            title: 'Reset Settings',
            okText: 'Reset',
            cancelText: 'Cancel',
            okClass: 'btn-danger'
        });

        if (!confirmReset) {
            debug.log('User cancelled reset');
            return;
        }

        // Close settings modal after confirmation
        closeSettings();

        showToast('Resetting settings...', TOAST_DURATION_LOADING);

        // Reset to defaults
        localStorage.setItem('theme', 'system');
        localStorage.setItem('autoUpdateCheck', 'true');
        localStorage.setItem('includePasswords', 'true');
        localStorage.setItem('filteredGroups', '[]');
        localStorage.setItem('collapsedGroups', '[]');
        localStorage.setItem('terminalPreference', 'default');
        localStorage.setItem('customTerminalPath', '');
        localStorage.setItem('recentConnectionsLimit', '5');

        // Reset window to default size
        await resetWindowState();

        // Apply defaults to UI
        themeSelect.value = 'system';
        applyTheme('system');
        autoUpdateCheck.checked = true;

        // Reset terminal preference UI
        loadTerminalPreference();

        // Reload states
        loadFilterState();
        loadCollapsedState();
        loadRecentConnectionsLimit(); // Reload recent connections limit into settings input

        await loadProfiles();
        await loadRecentConnections(); // Reload recent connections with new limit

        showToast('Settings reset to defaults!');
        debug.log('Settings reset successfully');
    } catch (error) {
        console.error('Failed to reset settings:', error);
        showToast('Failed to reset settings: ' + error, TOAST_DURATION_LONG, 'error');
    }
}

// Browse for SSH key file
async function browseSshKey() {
    try {
        const result = await invoke('browse_ssh_key');
        if (result) {
            // User selected a file, populate the key path input
            document.getElementById('profile-key-path').value = result;
            // Trigger form change detection
            checkFormChanged();
        }
        // If result is null, user cancelled - do nothing
    } catch (error) {
        console.error('Failed to browse for SSH key:', error);
        showToast('Failed to open file browser: ' + error, TOAST_DURATION_LONG, 'error');
    }
}

// Open modal for new or edit profile
async function openModal(profile = null) {
    debug.log('openModal called with profile:', profile);
    editingProfileId = profile ? profile.id : null;

    // Clear any validation errors from previous modal sessions
    clearAllValidationErrors();

    // Populate group dropdown
    populateProfileGroupSelect();

    if (profile) {
        modalTitle.textContent = 'Edit Profile';
        document.getElementById('profile-name').value = profile.name;
        document.getElementById('profile-description').value = profile.description || '';
        document.getElementById('profile-host').value = profile.host;
        document.getElementById('profile-port').value = profile.port || 22;
        document.getElementById('profile-username').value = profile.username;
        document.getElementById('profile-auth-method').value = profile.auth_method || 'none';
        document.getElementById('profile-key-path').value = profile.key_path || '';

        // Set group display and ID fields
        const group = groups.find(g => g.id === profile.group_id);
        if (group) {
            document.getElementById('profile-group').value = group.path;
            document.getElementById('profile-group-id').value = group.id;
        } else {
            document.getElementById('profile-group').value = '';
            document.getElementById('profile-group-id').value = '';
        }

        // Retrieve password from keychain if auth method is password
        if (profile.auth_method === 'password') {
            debug.log('Profile has password auth, attempting to retrieve password for:', profile.id);
            try {
                const password = await invoke('get_profile_password', { profileId: profile.id });
                debug.log('Password retrieved successfully, length:', password ? password.length : 0);
                document.getElementById('profile-password').value = password || '';
            } catch (error) {
                console.error('Failed to retrieve password:', error);
                document.getElementById('profile-password').value = '';
            }
        } else {
            debug.log('Profile auth method is not password:', profile.auth_method);
            document.getElementById('profile-password').value = '';
        }

        deleteProfileBtn.classList.remove('hidden');
    } else {
        modalTitle.textContent = 'New Profile';
        profileForm.reset();
        document.getElementById('profile-port').value = 22;
        document.getElementById('profile-auth-method').value = 'none';
        // Set default group to Ungrouped (empty values)
        document.getElementById('profile-group').value = '';
        document.getElementById('profile-group-id').value = '';
        deleteProfileBtn.classList.add('hidden');
    }

    updateAuthMethodVisibility();
    profileModal.classList.remove('hidden');

    // Scroll to top of modal content
    const modalContent = profileModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.scrollTop = 0;
    }

    // Initialize character counters based on current field values
    initializeCharCounters();

    // Capture original form values and reset Save button state
    captureFormValues();
    // For new profiles, disable Save until required fields are populated
    // For editing, disable until changes are made
    if (profile) {
        profileSaveBtn.disabled = true;
    } else {
        profileSaveBtn.disabled = true; // Will be enabled when required fields populated
    }

    // Focus first field for keyboard navigation
    setTimeout(() => {
        const firstField = document.getElementById('profile-name');
        if (firstField) {
            firstField.focus();
        }
    }, 0);
}

// Get current form values as an object
function getCurrentFormValues() {
    return {
        name: document.getElementById('profile-name').value,
        description: document.getElementById('profile-description').value,
        host: document.getElementById('profile-host').value,
        port: document.getElementById('profile-port').value,
        username: document.getElementById('profile-username').value,
        auth_method: document.getElementById('profile-auth-method').value,
        key_path: document.getElementById('profile-key-path').value,
        password: document.getElementById('profile-password').value,
        group: document.getElementById('profile-group-id').value // Use hidden field for group ID
    };
}

// Capture current form values (for tracking changes)
function captureFormValues() {
    originalFormValues = getCurrentFormValues();
}

// Check if form has changed from original values
// Check if all required fields are populated
function areRequiredFieldsPopulated() {
    const name = document.getElementById('profile-name').value.trim();
    const host = document.getElementById('profile-host').value.trim();
    const username = document.getElementById('profile-username').value.trim();
    return name && host && username;
}

function checkFormChanged() {
    // Check if required fields are populated (for both new and edit)
    const requiredFieldsPopulated = areRequiredFieldsPopulated();

    // If creating a new profile, enable Save only when required fields are populated
    if (!editingProfileId) {
        profileSaveBtn.disabled = !requiredFieldsPopulated;
        return;
    }

    // For editing: check both required fields AND changes
    // Compare current values with original values
    const currentValues = getCurrentFormValues();

    // Check if any field has changed
    const hasChanged = Object.keys(originalFormValues).some(key =>
        currentValues[key] !== originalFormValues[key]
    );

    // Enable Save only if required fields are populated AND something changed
    profileSaveBtn.disabled = !requiredFieldsPopulated || !hasChanged;
}

// Check if there are unsaved profile changes
function hasUnsavedProfileChanges() {
    const currentValues = getCurrentFormValues();

    // If we have captured original form values (from edit or duplicate), compare against them
    if (Object.keys(originalFormValues).length > 0) {
        return Object.keys(originalFormValues).some(key =>
            currentValues[key] !== originalFormValues[key]
        );
    }

    // If creating a brand new profile (no baseline captured), check if any fields have content
    if (!editingProfileId) {
        return currentValues.name || currentValues.host || currentValues.username;
    }

    return false;
}

// Check if group form has required fields and handle Save button state
function checkGroupFormChanged() {
    const groupName = groupNameInput.value.trim();
    const parentId = groupParentSelect.value || null;

    // Group name is required
    if (!groupName) {
        groupSaveBtn.disabled = true;
        return;
    }

    // Validate group name
    const validationResult = validateField('group-name', groupName);
    if (!validationResult.valid) {
        groupSaveBtn.disabled = true;
        return;
    }

    // If creating new group, enable if name is valid
    if (!editingGroupId) {
        groupSaveBtn.disabled = false;
        return;
    }

    // For editing: check if anything changed
    const group = groups.find(g => g.id === editingGroupId);
    if (!group) {
        groupSaveBtn.disabled = true;
        return;
    }

    const hasChanged = groupName !== group.name || parentId !== group.parent_id;
    groupSaveBtn.disabled = !hasChanged;
}

// Close modal (force close without confirmation)
function forceCloseModal() {
    profileModal.classList.add('hidden');
    editingProfileId = null;
    profileForm.reset();
    originalFormValues = {};
}

// Close modal with unsaved changes check
async function closeModal() {
    // Check if there are unsaved changes
    if (hasUnsavedProfileChanges()) {
        const confirmed = await customConfirm(
            'You have unsaved changes. Are you sure you want to close without saving?',
            {
                title: 'Unsaved Changes',
                okText: 'Close Without Saving',
                cancelText: 'Cancel',
                okClass: 'btn-danger'
            }
        );

        if (!confirmed) {
            return; // User cancelled, keep modal open
        }
    }

    // No unsaved changes or user confirmed - close the modal
    forceCloseModal();
}

// Save profile (create or update)
async function saveProfile() {
    debug.log('saveProfile called, editingProfileId:', editingProfileId);

    // Validate all fields before proceeding
    if (!validateAllFields()) {
        return; // Stop if validation fails
    }

    const profileName = document.getElementById('profile-name').value.trim();

    // Explicit empty string validation (defense in depth, even though validateAllFields should catch this)
    if (profileName.length === 0) {
        showToast('Profile name cannot be empty', TOAST_DURATION_LONG, 'error');
        return;
    }

    // Check for duplicate names (case-insensitive)
    const duplicateProfile = profiles.find(p =>
        p.name.toLowerCase() === profileName.toLowerCase() &&
        p.id !== editingProfileId
    );

    if (duplicateProfile) {
        showToast(`A profile named "${profileName}" already exists. Please choose a different name.`, TOAST_DURATION_LONG, 'error');
        return;
    }

    const profileData = {
        id: editingProfileId,
        name: profileName,
        description: document.getElementById('profile-description').value || null,
        host: document.getElementById('profile-host').value,
        port: parseInt(document.getElementById('profile-port').value) || 22,
        username: document.getElementById('profile-username').value,
        auth_method: document.getElementById('profile-auth-method').value,
        key_path: document.getElementById('profile-key-path').value || null,
        password: document.getElementById('profile-password').value || null,
        group_id: document.getElementById('profile-group-id').value || null // Use hidden field
    };

    try {
        // Capture whether we're editing or creating before closeModal resets editingProfileId
        const isEditing = !!editingProfileId;

        if (editingProfileId) {
            debug.log('Updating profile:', profileData);
            await invoke('update_profile', { profile: profileData });
        } else {
            debug.log('Creating profile:', profileData);
            await invoke('create_profile', { profile: profileData });
        }

        await loadProfiles();
        forceCloseModal(); // Force close without confirmation after successful save
        showToast(isEditing ? 'Profile updated successfully!' : 'Profile created successfully!');
    } catch (error) {
        console.error('Failed to save profile:', error);
        showToast('Failed to save profile: ' + error, TOAST_DURATION_LONG, 'error');
    }
}

// Edit profile
function editProfile(id) {
    const profile = profiles.find(p => p.id === id);
    if (profile) {
        openModal(profile);
    }
}

// Duplicate profile
function duplicateProfile(id) {
    const profile = profiles.find(p => p.id === id);
    if (!profile) return;

    // Create a copy of the profile with the same name
    // User will be forced to change it due to duplicate name validation
    const duplicatedProfile = {
        ...profile,
        id: null // Clear ID so it creates a new profile
    };

    // Open modal in "new profile" mode with duplicated data
    modalTitle.textContent = 'New Profile';
    editingProfileId = null; // Important: this makes it create a new profile
    deleteProfileBtn.classList.add('hidden');

    // Populate group dropdown
    populateProfileGroupSelect();

    // Fill form with duplicated profile data
    document.getElementById('profile-name').value = duplicatedProfile.name;
    document.getElementById('profile-description').value = duplicatedProfile.description || '';
    document.getElementById('profile-host').value = duplicatedProfile.host;
    document.getElementById('profile-port').value = duplicatedProfile.port || 22;
    document.getElementById('profile-username').value = duplicatedProfile.username;
    document.getElementById('profile-auth-method').value = duplicatedProfile.auth_method || 'none';
    document.getElementById('profile-key-path').value = duplicatedProfile.key_path || '';
    document.getElementById('profile-password').value = ''; // Don't copy password for security
    document.getElementById('profile-group').value = duplicatedProfile.group_id || '';

    updateAuthMethodVisibility();

    // Initialize character counters
    initializeCharCounters();

    // Capture form values as baseline so no changes are detected yet
    captureFormValues();

    // Disable save button until user makes a change
    profileSaveBtn.disabled = true;

    profileModal.classList.remove('hidden');
}

// Delete profile
// Returns true if deleted, false if cancelled or failed
async function deleteProfile(id) {
    debug.log('deleteProfile called with id:', id);
    const profile = profiles.find(p => p.id === id);

    if (!profile) {
        console.error('Profile not found:', id);
        return false;
    }

    debug.log('Found profile to delete:', profile);

    const confirmMessage = buildConfirmMessage({
        lines: [
            { prefix: 'Profile: ', highlight: `"${profile.name}"`, highlightClass: 'profile-name' },
            `Host: ${profile.username}@${profile.host}`
        ],
        warnings: ['This action cannot be undone.'],
        question: 'Are you sure you want to delete this profile?'
    });

    const confirmDelete = await customConfirm(confirmMessage, {
        title: 'Confirm Delete',
        okText: 'Delete',
        cancelText: 'Cancel',
        okClass: 'btn-danger'
    });

    if (!confirmDelete) {
        debug.log('User cancelled deletion');
        return false;
    }

    debug.log('User confirmed deletion');
    try {
        debug.log('Calling delete_profile with id:', id);
        await invoke('delete_profile', { id });
        debug.log('Profile deleted successfully');
        await loadProfiles();
        showToast('Profile deleted successfully!');
        return true;
    } catch (error) {
        console.error('Failed to delete profile:', error);
        showToast('Failed to delete profile: ' + error, TOAST_DURATION_LONG, 'error');
        return false;
    }
}

// ========== Group Management Functions ==========

// Open group modal for creating or editing a group
async function openGroupModal(group = null, preselectedParentId = null) {
    debug.log('openGroupModal called with group:', group, 'preselectedParentId:', preselectedParentId);
    editingGroupId = group ? group.id : null;

    // Populate parent group dropdown FIRST
    populateParentGroupSelect(editingGroupId);

    if (group) {
        groupModalTitle.textContent = 'Edit Group';
        groupNameInput.value = group.name;
        groupParentSelect.value = group.parent_id || '';
    } else {
        groupModalTitle.textContent = preselectedParentId ? 'New Subgroup' : 'New Group';
        groupForm.reset();
        // Set parent AFTER populating dropdown
        groupParentSelect.value = preselectedParentId || '';
    }

    groupModal.classList.remove('hidden');

    // Initialize character counter
    updateCharCounter('group-name', groupNameInput.value);

    // Set initial Save button state
    // For new groups: disabled until name is entered
    // For editing: disabled until changes are made
    checkGroupFormChanged();

    // Focus first field
    setTimeout(() => {
        groupNameInput.focus();
    }, 0);
}

// Populate parent group dropdown with hierarchical options
function populateParentGroupSelect(excludeGroupId = null) {
    // Clear existing options except the first one
    groupParentSelect.innerHTML = '<option value="">-- Top Level --</option>';

    // Add groups as options (exclude current group if editing to prevent circular reference)
    groups.forEach(group => {
        if (group.id === excludeGroupId) return; // Skip current group

        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.path; // Show full path
        groupParentSelect.appendChild(option);
    });
}

// Populate profile group searchable dropdown
let profileGroupDropdownVisible = false;
let focusedDropdownIndex = -1;
let filteredGroupOptions = [];

function populateProfileGroupSelect() {
    // This function is now called to initialize the searchable dropdown
    // Actual population happens in showProfileGroupDropdown()
}

function showProfileGroupDropdown(filterText = '') {
    const profileGroupInput = document.getElementById('profile-group');
    const profileGroupDropdown = document.getElementById('profile-group-dropdown');
    if (!profileGroupInput || !profileGroupDropdown) return;

    // Sort groups by path (hierarchical)
    const sortedGroups = [...groups].sort((a, b) => a.path.localeCompare(b.path));

    // Filter groups based on input
    filteredGroupOptions = sortedGroups.filter(g =>
        g.path.toLowerCase().includes(filterText.toLowerCase())
    );

    // Add "Ungrouped" option at the beginning
    filteredGroupOptions.unshift({ id: '', name: 'Ungrouped', path: 'Ungrouped' });

    // Build dropdown HTML
    let html = '';
    if (filteredGroupOptions.length === 0) {
        html = '<div class="searchable-dropdown-empty">No groups found</div>';
    } else {
        const currentGroupId = document.getElementById('profile-group-id').value;
        filteredGroupOptions.forEach((group, index) => {
            const isSelected = group.id === currentGroupId;
            html += `
                <div class="searchable-dropdown-item ${isSelected ? 'selected' : ''}"
                     data-group-id="${group.id}"
                     data-index="${index}">
                    ${escapeHtml(group.path)}
                </div>
            `;
        });
    }

    profileGroupDropdown.innerHTML = html;
    profileGroupDropdown.classList.remove('hidden');
    profileGroupDropdownVisible = true;
    focusedDropdownIndex = -1;

    // Attach click handlers
    profileGroupDropdown.querySelectorAll('.searchable-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const groupId = e.currentTarget.dataset.groupId;
            const group = filteredGroupOptions.find(g => g.id === groupId);
            selectProfileGroup(group);
        });
    });
}

function hideProfileGroupDropdown() {
    const profileGroupDropdown = document.getElementById('profile-group-dropdown');
    if (profileGroupDropdown) {
        profileGroupDropdown.classList.add('hidden');
        profileGroupDropdownVisible = false;
        focusedDropdownIndex = -1;
    }
}

function selectProfileGroup(group) {
    const profileGroupInput = document.getElementById('profile-group');
    const profileGroupIdInput = document.getElementById('profile-group-id');

    if (group && group.id !== '') {
        profileGroupInput.value = group.path;
        profileGroupIdInput.value = group.id;
    } else {
        // Ungrouped
        profileGroupInput.value = '';
        profileGroupIdInput.value = '';
    }

    hideProfileGroupDropdown();
    checkFormChanged();
}

function handleProfileGroupKeydown(e) {
    if (!profileGroupDropdownVisible) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            const profileGroupInput = document.getElementById('profile-group');
            showProfileGroupDropdown(profileGroupInput.value);
        }
        return;
    }

    const items = document.querySelectorAll('.searchable-dropdown-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusedDropdownIndex = Math.min(focusedDropdownIndex + 1, items.length - 1);
        updateFocusedDropdownItem(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusedDropdownIndex = Math.max(focusedDropdownIndex - 1, -1);
        updateFocusedDropdownItem(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedDropdownIndex >= 0 && focusedDropdownIndex < filteredGroupOptions.length) {
            selectProfileGroup(filteredGroupOptions[focusedDropdownIndex]);
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        hideProfileGroupDropdown();
    }
}

function updateFocusedDropdownItem(items) {
    items.forEach((item, index) => {
        if (index === focusedDropdownIndex) {
            item.classList.add('focused');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('focused');
        }
    });
}

// Close group modal
async function closeGroupModal() {
    groupModal.classList.add('hidden');
    editingGroupId = null;
    groupForm.reset();
}

// Save group (create or update)
async function saveGroup() {
    const groupName = groupNameInput.value.trim();

    // Validate group name
    if (!groupName) {
        showToast('Group name is required', TOAST_DURATION_SHORT, 'error');
        return;
    }

    // Validate against pattern
    if (!VALIDATION.group.pattern.test(groupName)) {
        showToast(VALIDATION.group.message, TOAST_DURATION_LONG, 'error');
        return;
    }

    // Validate length
    if (groupName.length > VALIDATION.group.maxLength) {
        showToast(`Group name must be ${VALIDATION.group.maxLength} characters or less`, TOAST_DURATION_LONG, 'error');
        return;
    }

    const parentId = groupParentSelect.value || null;

    isSubmitting = true;
    groupSaveBtn.disabled = true;

    try {
        if (editingGroupId) {
            // Update existing group
            await invoke('update_group', {
                input: {
                    id: editingGroupId,
                    name: groupName,
                    icon: null // Icons will be added in Phase 4
                }
            });
            showToast('Group updated successfully!');
        } else {
            // Create new group
            await invoke('create_group', {
                input: {
                    name: groupName,
                    parent_id: parentId,
                    icon: null
                }
            });
            showToast('Group created successfully!');
        }

        await loadGroups();
        await loadProfiles(); // Reload profiles to update group references
        closeGroupModal();
    } catch (error) {
        console.error('Failed to save group:', error);
        showToast('Failed to save group: ' + error, TOAST_DURATION_LONG, 'error');
    } finally {
        isSubmitting = false;
        groupSaveBtn.disabled = false;
    }
}

// Connect to SSH profile
async function connectToProfile(id) {
    const profile = profiles.find(p => p.id === id);
    if (!profile) return;

    try {
        // Get terminal preference from localStorage
        const terminalPreference = localStorage.getItem('terminalPreference') || 'default';
        const customTerminalPath = localStorage.getItem('customTerminalPath') || null;
        const useTabsInTerminal = localStorage.getItem('useTabsInTerminal') !== 'false'; // Default to true

        // Route to embedded terminal or external terminal
        if (terminalPreference === 'embedded') {
            await openEmbeddedTerminal(id);
        } else {
            await invoke('connect_ssh', {
                profileId: id,
                terminalPreference: terminalPreference,
                customTerminalPath: customTerminalPath,
                useTabsInTerminal: useTabsInTerminal
            });
        }

        // Reload recent connections after successful connection
        await loadRecentConnections();
    } catch (error) {
        console.error('Failed to connect:', error);
        showToast('Failed to connect: ' + error, TOAST_DURATION_LONG, 'error');
    }
}

// Utility: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Utility: Build confirmation message using safe DOM manipulation
// Returns a DocumentFragment with safely constructed message elements
function buildConfirmMessage(config) {
    // Validate config parameter
    if (!config || typeof config !== 'object') {
        console.error('Invalid config passed to buildConfirmMessage:', config);
        return document.createDocumentFragment();
    }

    const fragment = document.createDocumentFragment();

    // Helper to create a div with optional class and text
    const createDiv = (text, className = null, isTextContent = true) => {
        const div = document.createElement('div');
        if (className) div.className = className;
        if (isTextContent) {
            div.textContent = text;
        }
        return div;
    };

    // Helper to create a span with text
    const createSpan = (text, className = null) => {
        const span = document.createElement('span');
        if (className) span.className = className;
        span.textContent = text;
        return span;
    };

    // Add main message lines
    if (config.lines) {
        config.lines.forEach(line => {
            const div = createDiv('');
            if (typeof line === 'string') {
                div.textContent = line;
            } else if (line.text) {
                // Line can have parts with different styling
                if (line.prefix) div.appendChild(document.createTextNode(line.prefix));
                if (line.highlight) {
                    const span = createSpan(line.highlight, line.highlightClass || 'profile-name');
                    div.appendChild(span);
                }
                if (line.suffix) div.appendChild(document.createTextNode(line.suffix));
                if (!line.prefix && !line.highlight && !line.suffix) {
                    div.textContent = line.text;
                }
            }
            fragment.appendChild(div);
        });
    }

    // Add warning messages
    if (config.warnings) {
        config.warnings.forEach(warning => {
            fragment.appendChild(createDiv(warning, 'warning'));
        });
    }

    // Add list if provided
    if (config.list) {
        const ul = document.createElement('ul');
        ul.className = 'confirmation-list';
        config.list.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            ul.appendChild(li);
        });
        fragment.appendChild(ul);
    }

    // Add final question
    if (config.question) {
        const questionDiv = createDiv(config.question);
        questionDiv.style.marginTop = '12px';
        fragment.appendChild(questionDiv);
    }

    return fragment;
}

// ===========================
// Embedded Terminal Functions
// ===========================

async function openEmbeddedTerminal(profileId) {
    try {
        // Get profile to set title
        const profile = profiles.find(p => p.id === profileId);
        if (!profile) {
            showToast('Profile not found', 'error');
            return;
        }

        // Show terminal modal
        const terminalModal = document.getElementById('terminal-modal');
        const terminalContainer = document.getElementById('terminal-container');
        const terminalTitle = document.getElementById('terminal-title');
        const terminalStatus = document.getElementById('terminal-status');

        terminalTitle.textContent = `Terminal - ${profile.name}`;
        terminalStatus.textContent = 'Connecting...';
        terminalStatus.className = 'terminal-status connecting';

        terminalModal.classList.remove('hidden');

        // Initialize xterm.js
        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
                background: '#000000',
                foreground: '#ffffff',
                cursor: '#ffffff',
                selection: '#555555'
            },
            scrollback: 10000,
            allowTransparency: false
        });

        // Load FitAddon
        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);

        // Open terminal in container
        term.open(terminalContainer);

        // Small delay to let DOM settle, then fit terminal
        await new Promise(resolve => setTimeout(resolve, 50));
        fitAddon.fit();

        // Get terminal dimensions
        const cols = term.cols;
        const rows = term.rows;

        // Create backend terminal session
        const sessionId = await invoke('create_terminal_session', {
            profileId: profileId,
            cols: cols,
            rows: rows
        });

        // Keep status as "Connecting..." - will update based on terminal output
        let connectionStatus = 'connecting'; // Track status: 'connecting', 'connected', 'failed'

        // SSH error patterns that indicate connection failure
        const sshErrorPatterns = [
            /Connection refused/i,
            /Network is unreachable/i,
            /No route to host/i,
            /Host key verification failed/i,
            /Permission denied/i,
            /Could not resolve hostname/i,
            /Connection timed out/i,
            /ssh: connect to host .* port \d+: /i
        ];

        // Listen for terminal output events
        const unlistenOutput = await window.__TAURI__.event.listen(
            `terminal-output-${sessionId}`,
            (event) => {
                // Convert Vec<u8> to Uint8Array and write to terminal
                const data = new Uint8Array(event.payload);
                term.write(data);

                // Monitor connection status
                if (connectionStatus === 'connecting') {
                    const output = new TextDecoder().decode(data);

                    // Check for SSH errors
                    const hasError = sshErrorPatterns.some(pattern => pattern.test(output));
                    if (hasError) {
                        connectionStatus = 'failed';
                        terminalStatus.textContent = 'Connection Failed';
                        terminalStatus.className = 'terminal-status failed';
                        // Update session status
                        if (activeTerminalSession) {
                            activeTerminalSession.connectionStatus = 'failed';
                        }
                    }
                    // Check for successful connection indicators
                    // (password prompt, shell prompt, welcome message, etc.)
                    else if (
                        output.includes('password:') ||
                        output.includes('Password:') ||
                        output.includes('Welcome') ||
                        output.includes('Last login') ||
                        output.match(/[$#>]\s*$/) || // Shell prompt
                        output.match(/\w+@\w+[:#$]/) // user@host prompt
                    ) {
                        connectionStatus = 'connected';
                        terminalStatus.textContent = 'Connected';
                        terminalStatus.className = 'terminal-status connected';
                        // Update session status
                        if (activeTerminalSession) {
                            activeTerminalSession.connectionStatus = 'connected';
                        }
                    }
                }
            }
        );

        // Listen for terminal session end event (auto-close on exit/disconnect)
        const unlistenEnded = await window.__TAURI__.event.listen(
            `terminal-ended-${sessionId}`,
            (event) => {
                // Mark session as ended so we don't prompt on close
                if (activeTerminalSession) {
                    activeTerminalSession.sessionEnded = true;
                    // Disable input immediately to prevent user from typing during cleanup
                    activeTerminalSession.term.options.disableStdin = true;
                }

                // Check if session ended due to connection failure or normal exit
                // Use connectionStatus to determine - if still 'connecting' or 'failed', keep modal open
                const connectionFailed = connectionStatus === 'connecting' || connectionStatus === 'failed';
                const hasErrorPayload = event.payload && typeof event.payload === 'string' && event.payload.trim().length > 0;

                if (connectionFailed || hasErrorPayload) {
                    // Connection failed - keep modal open so user can read output
                    if (hasErrorPayload) {
                        showToast(event.payload, 'error');
                    }
                } else {
                    // Normal exit (user typed 'exit' after successful connection) - auto-close after brief delay
                    setTimeout(() => {
                        closeEmbeddedTerminal();
                    }, 100);
                }
            }
        );

        // FALLBACK: Timeout-based connection detection
        // If no SSH error after 5 seconds, assume connected (handles minimal servers, custom shells)
        const connectionTimeout = setTimeout(() => {
            if (connectionStatus === 'connecting') {
                connectionStatus = 'connected';
                terminalStatus.textContent = 'Connected';
                terminalStatus.className = 'terminal-status connected';
                if (activeTerminalSession) {
                    activeTerminalSession.connectionStatus = 'connected';
                }
            }
        }, 5000);

        // Send user input to backend
        term.onData((data) => {
            invoke('write_to_terminal', {
                sessionId: sessionId,
                data: data
            }).catch(err => {
                console.error('Failed to write to terminal:', err);
            });
        });

        // Handle terminal resize
        let resizeTimeout;
        term.onResize(({ cols, rows }) => {
            // PERFORMANCE FIX: Debounce resize events with 250ms delay
            // Prevents race conditions between resize and I/O operations
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                invoke('resize_terminal', {
                    sessionId: sessionId,
                    cols: cols,
                    rows: rows
                }).catch(err => {
                    console.error('Failed to resize terminal:', err);
                });
            }, 250);
        });

        // Handle terminal container resize with ResizeObserver (more reliable than window resize)
        // ResizeObserver fires after layout is complete, eliminating need for double-fit workaround
        let windowResizeTimeout;
        const resizeObserver = new ResizeObserver(() => {
            clearTimeout(windowResizeTimeout);
            windowResizeTimeout = setTimeout(() => {
                try {
                    fitAddon.fit();
                    term.scrollToBottom();
                } catch (err) {
                    console.error('Failed to fit terminal:', err);
                }
            }, 250);
        });
        resizeObserver.observe(terminalContainer);

        // Intercept Escape key to close terminal (before xterm processes it)
        term.attachCustomKeyEventHandler((e) => {
            if (e.type === 'keydown' && e.key === 'Escape') {
                closeEmbeddedTerminal();
                return false; // Prevent xterm from processing
            }
            return true; // Let xterm process other keys
        });

        // Store session info
        activeTerminalSession = {
            sessionId,
            term,
            fitAddon,
            unlistenOutput,
            unlistenEnded,
            resizeObserver,
            resizeTimeout,
            windowResizeTimeout,
            connectionTimeout, // Timeout for connection detection fallback
            connectionStatus: 'connecting', // Track connection status
            sessionEnded: false // Track if session ended naturally (exit/disconnect)
        };

        // Focus terminal
        term.focus();

    } catch (error) {
        console.error('Failed to open terminal:', error);
        showToast('Failed to open terminal: ' + error, 'error');
        closeEmbeddedTerminal();
    }
}

async function closeEmbeddedTerminal() {
    if (!activeTerminalSession) {
        // Just hide modal if no active session
        const terminalModal = document.getElementById('terminal-modal');
        terminalModal.classList.add('hidden');
        return;
    }

    // Skip confirmation if:
    // - Connection failed (no established session to lose)
    // - Session ended naturally (user typed exit, connection dropped)
    const skipConfirmation = activeTerminalSession.connectionStatus === 'failed' ||
                             activeTerminalSession.sessionEnded === true;

    if (!skipConfirmation) {
        // Show confirmation dialog for active/connecting sessions
        const confirmed = await customConfirm(
            'Are you sure you want to close this terminal session?',
            {
                title: 'Close Terminal',
                okText: 'Close',
                cancelText: 'Cancel',
                okClass: 'btn-danger'
            }
        );

        if (!confirmed) {
            return; // User cancelled
        }
    }

    const { sessionId, term, unlistenOutput, unlistenEnded, resizeObserver, resizeTimeout, windowResizeTimeout, connectionTimeout } = activeTerminalSession;

    try {
        // Update status
        const terminalStatus = document.getElementById('terminal-status');
        terminalStatus.textContent = 'Disconnecting...';
        terminalStatus.className = 'terminal-status disconnected';

        // Clear any pending timeouts
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        if (windowResizeTimeout) {
            clearTimeout(windowResizeTimeout);
        }
        if (connectionTimeout) {
            clearTimeout(connectionTimeout);
        }

        // Remove event listeners
        if (unlistenOutput) {
            unlistenOutput();
        }
        if (unlistenEnded) {
            unlistenEnded();
        }
        if (resizeObserver) {
            resizeObserver.disconnect();
        }

        // Dispose terminal
        if (term) {
            term.dispose();
        }

        // Close backend session
        if (sessionId) {
            await invoke('close_terminal_session', {
                sessionId: sessionId
            });
        }

    } catch (error) {
        console.error('Error closing terminal:', error);
    } finally {
        // Clear session and hide modal
        activeTerminalSession = null;
        const terminalModal = document.getElementById('terminal-modal');
        const terminalContainer = document.getElementById('terminal-container');
        terminalModal.classList.add('hidden');
        terminalContainer.innerHTML = '<!-- xterm.js terminal will be mounted here -->';
    }
}

function clearTerminal() {
    if (activeTerminalSession && activeTerminalSession.term) {
        activeTerminalSession.term.clear();
    }
}
