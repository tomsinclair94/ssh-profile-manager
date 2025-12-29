// Wait for DOM and Tauri to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');

    // Check if Tauri API is available
    if (!window.__TAURI__) {
        console.error('Tauri API not available!');
        alert('Error: Tauri API not loaded');
        return;
    }

    console.log('Tauri API available');
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
        pattern: /^[a-zA-Z0-9\s\-_().\[\]]+$/,
        maxLength: 64,
        message: 'Only letters, numbers, spaces, and - _ ( ) . [ ] allowed'
    },
    description: {
        pattern: /^[^<>]*$/,
        maxLength: 128,
        message: 'Cannot contain < or > characters'
    },
    hostname: {
        pattern: /^[a-zA-Z0-9.\-_]+$/,
        maxLength: 128,
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
        pattern: /^[a-zA-Z0-9_\-.]+$/,
        maxLength: 32,
        message: 'Only letters, numbers, underscores, hyphens, dots allowed'
    },
    group: {
        pattern: /^[a-zA-Z0-9\s\-_().\[\]]+$/,
        maxLength: 32,
        message: 'Only letters, numbers, spaces, and - _ ( ) . [ ] allowed'
    }
};

// State
let profiles = [];
let editingProfileId = null;
let isSubmitting = false;
let collapsedGroups = new Set();
let originalFormValues = {}; // Track original profile form values for change detection
let originalSettingsValues = {}; // Track original settings values for change detection
let filteredGroups = new Set(); // Groups to hide (empty = show all)

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
        default:
            return { valid: true };
    }
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
    const fieldName = fieldId.replace('profile-', '');
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
let profileCountBadge;
let terminalSelect;
let customTerminalGroup;
let customTerminalPath;
let browseTerminalBtn;

// Confirmation promise resolver
let confirmResolver = null;

// Initialize app
async function init() {
    console.log('Initializing app...');

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
    profileCountBadge = document.getElementById('profile-count-badge');
    terminalSelect = document.getElementById('terminal-select');
    customTerminalGroup = document.getElementById('custom-terminal-group');
    customTerminalPath = document.getElementById('custom-terminal-path');
    browseTerminalBtn = document.getElementById('browse-terminal-btn');

    console.log('DOM elements retrieved');

    // Set OS-specific browse hint
    setBrowseHint();

    await loadProfiles();
    loadThemePreference();
    loadAutoUpdatePreference();
    loadIncludeProfilesPreference();
    populateTerminalOptions();
    loadTerminalPreference();
    loadFilterState();
    loadCollapsedState();
    await loadWindowState();
    await setupWindowListeners();
    setupEventListeners();

    // Check for updates on launch if enabled
    if (autoUpdateCheck.checked) {
        checkForUpdates(true); // silent check
    }

    // Setup ResizeObserver to update scrollbar width dynamically
    setupScrollbarObserver();

    console.log('App initialized');
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
        console.warn('Failed to update scrollbar width:', error);
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
    } catch (error) {
        console.error('Failed to load profiles:', error);
        profiles = [];
        updateProfileCount();
        renderProfiles();
    }
}

// Update profile count badge
function updateProfileCount() {
    profileCountBadge.textContent = profiles.length;
}

// Render profiles in the UI with collapsible groups
function renderProfiles(filter = '') {
    const filteredProfiles = profiles.filter(profile => {
        // First check if profile's group is filtered out
        const group = profile.group || 'Ungrouped';
        if (filteredGroups.has(group)) {
            return false; // Hide this profile because its group is filtered
        }

        // Then apply search filter
        const searchText = filter.toLowerCase();
        return (
            profile.name.toLowerCase().includes(searchText) ||
            profile.host.toLowerCase().includes(searchText) ||
            profile.username.toLowerCase().includes(searchText) ||
            (profile.description && profile.description.toLowerCase().includes(searchText)) ||
            (profile.group && profile.group.toLowerCase().includes(searchText))
        );
    });

    if (filteredProfiles.length === 0) {
        // Determine if there are truly no profiles or just no results from filtering/search
        const hasProfiles = profiles.length > 0;
        const hasActiveFilters = filteredGroups.size > 0;

        let icon, title, text;

        if (!hasProfiles) {
            // Truly no profiles exist
            icon = '💻';
            title = 'No SSH Profiles Yet';
            text = 'Create your first SSH profile to get started.';
        } else if (filter && hasActiveFilters) {
            // Both search and filters active
            icon = '🔍';
            title = 'No Profiles Found';
            text = 'No profiles match your search and active group filters.';
        } else if (filter) {
            // Search active, no filters
            icon = '🔍';
            title = 'No Profiles Found';
            text = 'No profiles match your search.';
        } else if (hasActiveFilters) {
            // Only filters active
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
        return;
    }

    // Group profiles
    const grouped = {};
    filteredProfiles.forEach(profile => {
        const group = profile.group || 'Ungrouped';
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(profile);
    });

    // Render grouped profiles with collapsible sections
    let html = '';
    Object.keys(grouped).sort().forEach(groupName => {
        const isCollapsed = collapsedGroups.has(groupName);
        const chevron = isCollapsed ? '▶' : '▼';

        html += `
            <div class="profile-group">
                <div class="profile-group-header" data-group="${escapeHtml(groupName)}">
                    <span class="group-chevron">${chevron}</span>
                    <span class="group-name">${escapeHtml(groupName)}</span>
                    <span class="badge group-count-badge">${grouped[groupName].length}</span>
                </div>
                <div class="profile-group-content ${isCollapsed ? 'collapsed' : ''}">
        `;

        grouped[groupName].forEach(profile => {
            html += `
                <div class="profile-card" data-id="${profile.id}">
                    <div class="profile-card-header">
                        <div class="profile-card-title" title="${escapeHtml(profile.name)}">${escapeHtml(profile.name)}</div>
                    </div>
                    <div class="profile-card-info">
                        <div class="profile-info-item">
                            <span class="profile-info-label">User:</span>
                            <span>${escapeHtml(profile.username)}</span>
                        </div>
                        <div class="profile-info-item">
                            <span class="profile-info-label">Host:</span>
                            <span>${escapeHtml(profile.host)}${profile.port !== 22 ? ':' + profile.port : ''}</span>
                        </div>
                        <div class="profile-info-item">
                            <span class="profile-info-label">Auth:</span>
                            <span>${escapeHtml(profile.auth_method || 'key')}</span>
                        </div>
                    </div>
                    ${profile.description ? `<div class="profile-card-description" title="${escapeHtml(profile.description)}">${escapeHtml(profile.description)}</div>` : ''}
                    <div class="profile-card-actions">
                        <button class="btn btn-success btn-small connect-btn" data-id="${profile.id}">Connect</button>
                        <button class="btn btn-info btn-small edit-btn" data-id="${profile.id}">Edit</button>
                        <button class="btn btn-secondary btn-small duplicate-btn" data-id="${profile.id}">Duplicate</button>
                        <button class="btn btn-danger btn-small delete-btn" data-id="${profile.id}">Delete</button>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    profilesList.innerHTML = html;

    // Attach event listeners to group headers
    document.querySelectorAll('.profile-group-header').forEach(header => {
        header.addEventListener('click', (e) => {
            const groupName = header.dataset.group;
            toggleGroup(groupName);
        });
    });

    // Update expand/collapse button text
    updateExpandCollapseButton();

    // Update scrollbar width after DOM is rendered
    requestAnimationFrame(() => {
        updateScrollbarWidth();
    });
}

// Toggle group collapse state
function toggleGroup(groupName) {
    if (collapsedGroups.has(groupName)) {
        collapsedGroups.delete(groupName);
    } else {
        collapsedGroups.add(groupName);
    }
    saveCollapsedState();
    renderProfiles(searchInput.value);
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
    console.log('Setting up event listeners...');

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
            console.log('Delete button clicked on card, id:', target.dataset.id);
            await deleteProfile(target.dataset.id);
        }
    });

    newProfileBtn.addEventListener('click', () => {
        console.log('New profile button clicked!');
        openModal();
    });

    cancelBtn.addEventListener('click', async () => {
        await closeModal();
    });

    deleteProfileBtn.addEventListener('click', async () => {
        console.log('Delete button clicked in modal');
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
            console.log('Already submitting, ignoring...');
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
            field.addEventListener('input', checkFormChanged);
            field.addEventListener('change', checkFormChanged);
        }
    });

    // Confirmation dialog buttons
    confirmOkBtn.addEventListener('click', () => {
        if (confirmResolver) {
            confirmResolver(true);
            confirmResolver = null;
        }
        confirmModal.classList.add('hidden');
    });

    confirmCancelBtn.addEventListener('click', () => {
        if (confirmResolver) {
            confirmResolver(false);
            confirmResolver = null;
        }
        confirmModal.classList.add('hidden');
    });

    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            if (confirmResolver) {
                confirmResolver(false);
                confirmResolver = null;
            }
            confirmModal.classList.add('hidden');
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

    // Update checker
    checkUpdatesBtn.addEventListener('click', async () => {
        await checkForUpdates(false); // not silent, show notification
    });

    includeProfilesCheck.addEventListener('change', () => {
        debouncedCheckSettingsChanged();
    });

    // Expand/collapse all groups button
    expandCollapseBtn.addEventListener('click', () => {
        toggleExpandCollapseAll();
    });

    // Filter button and popup
    filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFilterPopup();
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
                showToast('Failed to open link', 'error');
            }
        }
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
    return {
        theme: themeSelect.value,
        autoUpdateCheck: autoUpdateCheck.checked,
        terminalPreference: terminalSelect.value,
        customTerminalPath: customTerminalPath.value,
        includeProfiles: includeProfilesCheck.checked
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

    // Capture original settings values and disable Save button initially
    captureSettingsValues();
    settingsSaveBtn.disabled = true;
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

    // Close modal after saving
    forceCloseSettings();

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

async function checkForUpdates(silent = false) {
    try {
        const updateInfo = await invoke('check_for_updates');

        if (updateInfo.update_available) {
            // Update available
            const message = `A new version is available!\n\nCurrent: v${updateInfo.current_version}\nLatest: v${updateInfo.latest_version}\n\nWould you like to download it?`;
            const shouldDownload = await customConfirm(message, {
                title: 'Update Available',
                okText: 'Download',
                cancelText: 'Later'
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

            // Validate each item is a string with proper format
            // Group names: letters, numbers, spaces, and special chars: - _ ( ) . [ ]
            // Max length: 32 characters
            const groupNameRegex = /^[a-zA-Z0-9 \-_().\[\]]+$/;
            if (!filtersArray.every(item =>
                typeof item === 'string' &&
                item.length > 0 &&
                item.length <= 32 &&
                groupNameRegex.test(item)
            )) {
                throw new Error('Invalid filter group names');
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

            // Validate each item is a string with proper format
            // Group names: letters, numbers, spaces, and special chars: - _ ( ) . [ ]
            // Max length: 32 characters
            const groupNameRegex = /^[a-zA-Z0-9 \-_().\[\]]+$/;
            if (!collapsedArray.every(item =>
                typeof item === 'string' &&
                item.length > 0 &&
                item.length <= 32 &&
                groupNameRegex.test(item)
            )) {
                throw new Error('Invalid collapsed group names');
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
    const allGroups = getAllGroups();
    const hiddenGroups = filteredGroups.size;

    // Only show badge when some groups are hidden
    if (hiddenGroups === 0) {
        // No groups hidden - hide badge
        filterBadge.classList.add('hidden');
    } else {
        // Show number of hidden groups
        filterBadge.textContent = hiddenGroups;
        filterBadge.classList.remove('hidden');
    }
}

function getAllGroups() {
    const groups = new Set();
    profiles.forEach(profile => {
        groups.add(profile.group || 'Ungrouped');
    });
    return Array.from(groups).sort();
}

function buildFilterGroupsList() {
    const allGroups = getAllGroups();

    if (allGroups.length === 0) {
        filterGroupsList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted);">No groups available</div>';
        return;
    }

    let html = '';
    allGroups.forEach(groupName => {
        const isChecked = !filteredGroups.has(groupName);
        const groupProfiles = profiles.filter(p => (p.group || 'Ungrouped') === groupName);

        html += `
            <div class="filter-group-item">
                <label>
                    <input type="checkbox"
                           class="filter-group-checkbox"
                           data-group="${escapeHtml(groupName)}"
                           ${isChecked ? 'checked' : ''}>
                    <span class="filter-group-name">${escapeHtml(groupName)}</span>
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
            const groupName = e.target.dataset.group;
            if (e.target.checked) {
                // Show this group
                filteredGroups.delete(groupName);
            } else {
                // Hide this group
                filteredGroups.add(groupName);
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
                console.warn('Invalid window dimensions in storage, using defaults');
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

    if (os === 'macos') {
        terminalSelect.innerHTML = `
            <option value="default">Default (Terminal.app)</option>
            <option value="custom">Custom Terminal</option>
            <option value="embedded" disabled>Embedded Terminal (Coming Soon)</option>
        `;
    } else if (os === 'windows') {
        terminalSelect.innerHTML = `
            <option value="default">Default (System Default)</option>
            <option value="cmd">Command Prompt</option>
            <option value="powershell">PowerShell</option>
            <option value="windows_terminal">Windows Terminal</option>
            <option value="custom">Custom Terminal</option>
            <option value="embedded" disabled>Embedded Terminal (Coming Soon)</option>
        `;
    } else {
        // Unknown OS - show minimal options
        terminalSelect.innerHTML = `
            <option value="default">Default Terminal</option>
        `;
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
            console.warn('Saved custom terminal path is no longer valid:', error);
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

        const data = await invoke('export_profiles');
        const defaultFilename = `sshpm-profiles-${new Date().toISOString().split('T')[0]}.json`;

        // Call Tauri backend to show save dialog and write file
        const success = await invoke('save_profiles_to_file', {
            data: data,
            defaultFilename: defaultFilename
        });

        if (success) {
            showToast('Profiles exported successfully!');
            console.log('Profiles exported successfully');
        } else {
            // Hide the loading toast
            toastElement.classList.add('hidden');
            console.log('User cancelled save dialog');
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
                console.log('User cancelled import');
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
        console.log('Profiles imported successfully');
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
        console.log('User cancelled delete all');
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
        console.log('All profiles deleted');
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

        // Always include terminal preference (OS-specific setting, will be tagged with OS)
        const terminalPreference = localStorage.getItem('terminalPreference') || 'default';

        // Only include filtered/collapsed groups if profiles are included
        let filteredGroups = null;
        let collapsedGroups = null;

        if (includeProfiles) {
            const filteredGroupsData = localStorage.getItem('filteredGroups') || '[]';
            const collapsedGroupsData = localStorage.getItem('collapsedGroups') || '[]';
            filteredGroups = JSON.parse(filteredGroupsData);
            collapsedGroups = JSON.parse(collapsedGroupsData);
        }

        const data = await invoke('export_settings', {
            theme,
            autoUpdateCheck,
            filteredGroups,
            collapsedGroups,
            terminalPreference: terminalPreference,
            includeProfiles,
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
            console.log('Settings backed up successfully');
        } else {
            toastElement.classList.add('hidden');
            console.log('User cancelled backup dialog');
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
                console.log('User cancelled restore');
                return;
            }
        }

        showToast('Restoring settings...', TOAST_DURATION_LOADING);

        // Validate and restore settings with safe defaults
        // Defense in depth: frontend validation in addition to backend validation

        // Validate theme (must be one of the allowed values)
        const validThemes = ['system', 'dark', 'light'];
        const theme = validThemes.includes(result.settings.theme) ? result.settings.theme : 'system';
        localStorage.setItem('theme', theme);

        // Validate auto update check (must be boolean)
        const autoUpdate = typeof result.settings.auto_update_check === 'boolean'
            ? result.settings.auto_update_check
            : true;
        localStorage.setItem('autoUpdateCheck', autoUpdate.toString());

        // Restore OS-specific settings if present (backend filters cross-platform backups)
        if (result.settings_os_specific && result.settings_os_specific.terminal_preference) {
            // Validate terminal preference based on OS
            const validTerminalPrefs = getOS() === 'macos'
                ? ['default', 'custom', 'embedded']
                : ['default', 'cmd', 'powershell', 'windows_terminal', 'custom', 'embedded'];

            const termPref = validTerminalPrefs.includes(result.settings_os_specific.terminal_preference)
                ? result.settings_os_specific.terminal_preference
                : 'default';
            localStorage.setItem('terminalPreference', termPref);
        } else {
            // No OS-specific settings in backup (different OS or old format) - use default
            localStorage.setItem('terminalPreference', 'default');
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

        // Validate and restore filtered/collapsed groups
        // Must be arrays, with reasonable length limits (max 1000 items to prevent DoS)
        if (result.settings.filtered_groups) {
            if (Array.isArray(result.settings.filtered_groups)
                && result.settings.filtered_groups.length <= 1000
                && result.settings.filtered_groups.every(g => typeof g === 'string' && g.length <= 32)) {
                localStorage.setItem('filteredGroups', JSON.stringify(result.settings.filtered_groups));
            } else {
                console.warn('Invalid filtered_groups in backup, skipping');
            }
        }
        if (result.settings.collapsed_groups) {
            if (Array.isArray(result.settings.collapsed_groups)
                && result.settings.collapsed_groups.length <= 1000
                && result.settings.collapsed_groups.every(g => typeof g === 'string' && g.length <= 32)) {
                localStorage.setItem('collapsedGroups', JSON.stringify(result.settings.collapsed_groups));
            } else {
                console.warn('Invalid collapsed_groups in backup, skipping');
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

        await loadProfiles();

        const successMessage = includesProfiles
            ? `Settings and ${result.profiles.length} ${result.profiles.length === 1 ? 'profile' : 'profiles'} restored successfully!`
            : 'Settings restored successfully!';
        showToast(successMessage);
        console.log('Settings restored successfully');
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
            console.log('User cancelled reset');
            return;
        }

        // Close settings modal after confirmation
        closeSettings();

        showToast('Resetting settings...', TOAST_DURATION_LOADING);

        // Reset to defaults
        localStorage.setItem('theme', 'system');
        localStorage.setItem('autoUpdateCheck', 'true');
        localStorage.setItem('filteredGroups', '[]');
        localStorage.setItem('collapsedGroups', '[]');
        localStorage.setItem('terminalPreference', 'default');
        localStorage.setItem('customTerminalPath', '');

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

        await loadProfiles();

        showToast('Settings reset to defaults!');
        console.log('Settings reset successfully');
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
function openModal(profile = null) {
    console.log('openModal called with profile:', profile);
    editingProfileId = profile ? profile.id : null;

    if (profile) {
        modalTitle.textContent = 'Edit Profile';
        document.getElementById('profile-name').value = profile.name;
        document.getElementById('profile-description').value = profile.description || '';
        document.getElementById('profile-host').value = profile.host;
        document.getElementById('profile-port').value = profile.port || 22;
        document.getElementById('profile-username').value = profile.username;
        document.getElementById('profile-auth-method').value = profile.auth_method || 'none';
        document.getElementById('profile-key-path').value = profile.key_path || '';
        document.getElementById('profile-group').value = profile.group || '';
        deleteProfileBtn.classList.remove('hidden');
    } else {
        modalTitle.textContent = 'New Profile';
        profileForm.reset();
        document.getElementById('profile-port').value = 22;
        document.getElementById('profile-auth-method').value = 'none';
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
    // For new profiles, enable Save button immediately
    // For editing, disable until changes are made
    if (profile) {
        profileSaveBtn.disabled = true;
    } else {
        profileSaveBtn.disabled = false;
    }
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
        group: document.getElementById('profile-group').value
    };
}

// Capture current form values (for tracking changes)
function captureFormValues() {
    originalFormValues = getCurrentFormValues();
}

// Check if form has changed from original values
function checkFormChanged() {
    // If creating a new profile, always keep Save button enabled
    if (!editingProfileId) {
        profileSaveBtn.disabled = false;
        return;
    }

    // Compare current values with original values
    const currentValues = getCurrentFormValues();

    // Check if any field has changed
    const hasChanged = Object.keys(originalFormValues).some(key =>
        currentValues[key] !== originalFormValues[key]
    );

    profileSaveBtn.disabled = !hasChanged;
}

// Check if there are unsaved profile changes
function hasUnsavedProfileChanges() {
    // If creating a new profile, check if any fields have content
    if (!editingProfileId) {
        const currentValues = getCurrentFormValues();
        return currentValues.name || currentValues.host || currentValues.username;
    }

    // For editing, compare current values with original values
    const currentValues = getCurrentFormValues();
    return Object.keys(originalFormValues).some(key =>
        currentValues[key] !== originalFormValues[key]
    );
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
    console.log('saveProfile called, editingProfileId:', editingProfileId);

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
        group: document.getElementById('profile-group').value || null
    };

    try {
        // Capture whether we're editing or creating before closeModal resets editingProfileId
        const isEditing = !!editingProfileId;

        if (editingProfileId) {
            console.log('Updating profile:', profileData);
            await invoke('update_profile', { profile: profileData });
        } else {
            console.log('Creating profile:', profileData);
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

    // Strip existing " (duplicate)" suffix if present to avoid nested duplicates
    let baseName = profile.name;
    const duplicateSuffix = ' (duplicate)';
    if (baseName.endsWith(duplicateSuffix)) {
        baseName = baseName.slice(0, -duplicateSuffix.length);
    }

    // Create a copy of the profile with (duplicate) appended to base name
    const duplicatedProfile = {
        ...profile,
        id: null, // Clear ID so it creates a new profile
        name: baseName + duplicateSuffix
    };

    // Open modal in "new profile" mode with duplicated data
    modalTitle.textContent = 'New Profile';
    editingProfileId = null; // Important: this makes it create a new profile
    deleteProfileBtn.classList.add('hidden');

    // Fill form with duplicated profile data
    document.getElementById('profile-name').value = duplicatedProfile.name;
    document.getElementById('profile-description').value = duplicatedProfile.description || '';
    document.getElementById('profile-host').value = duplicatedProfile.host;
    document.getElementById('profile-port').value = duplicatedProfile.port || 22;
    document.getElementById('profile-username').value = duplicatedProfile.username;
    document.getElementById('profile-auth-method').value = duplicatedProfile.auth_method || 'none';
    document.getElementById('profile-key-path').value = duplicatedProfile.key_path || '';
    document.getElementById('profile-password').value = ''; // Don't copy password for security
    document.getElementById('profile-group').value = duplicatedProfile.group || '';

    updateAuthMethodVisibility();
    profileModal.classList.remove('hidden');
}

// Delete profile
// Returns true if deleted, false if cancelled or failed
async function deleteProfile(id) {
    console.log('deleteProfile called with id:', id);
    const profile = profiles.find(p => p.id === id);

    if (!profile) {
        console.error('Profile not found:', id);
        return false;
    }

    console.log('Found profile to delete:', profile);

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
        console.log('User cancelled deletion');
        return false;
    }

    console.log('User confirmed deletion');
    try {
        console.log('Calling delete_profile with id:', id);
        await invoke('delete_profile', { id });
        console.log('Profile deleted successfully');
        await loadProfiles();
        showToast('Profile deleted successfully!');
        return true;
    } catch (error) {
        console.error('Failed to delete profile:', error);
        showToast('Failed to delete profile: ' + error, TOAST_DURATION_LONG, 'error');
        return false;
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

        await invoke('connect_ssh', {
            profileId: id,
            terminalPreference: terminalPreference,
            customTerminalPath: customTerminalPath
        });
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
