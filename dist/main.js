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

// Constants
const TOAST_DURATION_SHORT = 3000;  // 3 seconds
const TOAST_DURATION_LONG = 4000;   // 4 seconds
const TOAST_DURATION_LOADING = 10000; // 10 seconds (for loading states)
const DEBOUNCE_DELAY = 100;         // 100ms debounce for filter updates

// State
let profiles = [];
let editingProfileId = null;
let isSubmitting = false;
let collapsedGroups = new Set();
let originalFormValues = {};
let filteredGroups = new Set(); // Groups to hide (empty = show all)

// Utility: Debounce function to prevent rapid successive calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// DOM Elements
let profilesList;
let searchInput;
let newProfileBtn;
let profileModal;
let profileForm;
let closeModalBtn;
let cancelBtn;
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
let closeSettingsBtn;
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
    closeModalBtn = document.getElementById('close-modal');
    cancelBtn = document.getElementById('cancel-btn');
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
    closeSettingsBtn = document.getElementById('close-settings');
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

    console.log('DOM elements retrieved');

    // Set OS-specific browse hint
    setBrowseHint();

    await loadProfiles();
    loadThemePreference();
    loadAutoUpdatePreference();
    loadFilterState();
    setupEventListeners();

    // Check for updates on launch if enabled
    if (autoUpdateCheck.checked) {
        checkForUpdates(true); // silent check
    }

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

// Load profiles from backend
async function loadProfiles() {
    try {
        profiles = await invoke('get_profiles');
        renderProfiles();
    } catch (error) {
        console.error('Failed to load profiles:', error);
        profiles = [];
        renderProfiles();
    }
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
        profilesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔌</div>
                <div class="empty-state-title">No SSH Profiles Yet</div>
                <div class="empty-state-text">
                    ${filter ? 'No profiles match your search.' : 'Create your first SSH profile to get started.'}
                </div>
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
                    <span class="group-count">${grouped[groupName].length}</span>
                </div>
                <div class="profile-group-content ${isCollapsed ? 'collapsed' : ''}">
        `;

        grouped[groupName].forEach(profile => {
            html += `
                <div class="profile-card" data-id="${profile.id}">
                    <div class="profile-card-header">
                        <div class="profile-card-title">${escapeHtml(profile.name)}</div>
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
                    ${profile.description ? `<div class="profile-card-description">${escapeHtml(profile.description)}</div>` : ''}
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
}

// Toggle group collapse state
function toggleGroup(groupName) {
    if (collapsedGroups.has(groupName)) {
        collapsedGroups.delete(groupName);
    } else {
        collapsedGroups.add(groupName);
    }
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
    renderProfiles(searchInput.value);
}

// Collapse all groups
function collapseAllGroups() {
    const allGroups = getAllGroups();
    allGroups.forEach(group => collapsedGroups.add(group));
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

    closeModalBtn.addEventListener('click', () => {
        closeModal();
    });

    cancelBtn.addEventListener('click', () => {
        closeModal();
    });

    deleteProfileBtn.addEventListener('click', async () => {
        console.log('Delete button clicked in modal');
        if (editingProfileId) {
            const deleted = await deleteProfile(editingProfileId);
            // Only close modal if deletion was successful
            if (deleted) {
                closeModal();
            }
        }
    });

    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            closeModal();
        }
    });

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

    closeSettingsBtn.addEventListener('click', () => {
        closeSettings();
    });

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettings();
        }
    });

    // Theme toggle
    themeSelect.addEventListener('change', () => {
        applyTheme(themeSelect.value);
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

    autoUpdateCheck.addEventListener('change', () => {
        saveAutoUpdatePreference();
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
        confirmMessage.innerHTML = message;
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
    toastMessage.textContent = message;
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
function openSettings() {
    settingsModal.classList.remove('hidden');
}

function closeSettings() {
    settingsModal.classList.add('hidden');
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

function saveAutoUpdatePreference() {
    localStorage.setItem('autoUpdateCheck', autoUpdateCheck.checked);
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

            // Validate each item is a string
            if (!filtersArray.every(item => typeof item === 'string')) {
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

// Export profiles to JSON
async function exportProfiles() {
    try {
        // Show loading feedback
        showToast('Exporting profiles...', TOAST_DURATION_LOADING);

        const data = await invoke('export_profiles');
        const defaultFilename = `ssh-profiles-${new Date().toISOString().split('T')[0]}.json`;

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

// Import profiles from JSON
async function importProfiles(file) {
    try {
        // Show loading feedback
        showToast('Reading import file...', TOAST_DURATION_LOADING);

        // Note: file.text() is a modern File API method (not supported in older browsers)
        // This is fine for Tauri apps as they use a modern WebView (WKWebView on macOS, WebView2 on Windows)
        const text = await file.text();
        const data = JSON.parse(text);

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

            const confirmMessage = `
                <div>You have <span class="profile-name">${existingCount} ${existingText}</span>.</div>
                <div class="host-info">Importing will add ${importCount} ${importText} and override all existing profiles.</div>
                <div class="warning">Do you want to continue?</div>
            `;

            const confirmImport = await customConfirm(confirmMessage, {
                title: 'Confirm Import',
                okText: 'Yes',
                cancelText: 'No',
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

    // Close settings modal first
    closeSettings();

    const count = profiles.length;
    const profileText = count === 1 ? 'profile' : 'profiles';

    const confirmMessage = `
        <div>You currently have <span class="profile-name">${count} ${profileText}</span>.</div>
        <div class="warning">This will permanently delete all profiles and their stored passwords.</div>
        <div class="warning">This action cannot be undone.</div>
        <div style="margin-top: 12px;">Are you sure you want to continue?</div>
    `;

    const confirmed = await customConfirm(confirmMessage, {
        title: 'Delete All Profiles',
        okText: 'Yes',
        cancelText: 'No',
        okClass: 'btn-danger'
    });

    if (!confirmed) {
        console.log('User cancelled delete all');
        return;
    }

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

    // Capture original form values and reset Save button state
    captureFormValues();
    // For new profiles, enable Save button immediately
    // For editing, disable until changes are made
    if (profile) {
        saveProfileBtn.disabled = true;
    } else {
        saveProfileBtn.disabled = false;
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
        saveProfileBtn.disabled = false;
        return;
    }

    // Compare current values with original values
    const currentValues = getCurrentFormValues();

    // Check if any field has changed
    const hasChanged = Object.keys(originalFormValues).some(key =>
        currentValues[key] !== originalFormValues[key]
    );

    saveProfileBtn.disabled = !hasChanged;
}

// Close modal
function closeModal() {
    profileModal.classList.add('hidden');
    editingProfileId = null;
    profileForm.reset();
    originalFormValues = {};
}

// Save profile (create or update)
async function saveProfile() {
    console.log('saveProfile called, editingProfileId:', editingProfileId);

    const profileName = document.getElementById('profile-name').value.trim();

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
        closeModal();
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

    const confirmMessage = `
        <div>Are you sure you want to delete <span class="profile-name">"${escapeHtml(profile.name)}"</span>?</div>
        <div class="host-info">Host: ${escapeHtml(profile.username)}@${escapeHtml(profile.host)}</div>
        <div class="warning">This action cannot be undone.</div>
    `;

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
        await invoke('connect_ssh', { profileId: id });
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
