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

// Version and Changelog Constants
// IMPORTANT: Update this for each release - used by migration system and splash screen
const CURRENT_APP_VERSION = '0.7.1';

const VERSION_CHANGELOG = {
    '0.7.1': {
        title: 'Bug Fixes & UI Polish',
        subtitle: 'Bug Fixes & UI Polish',
        highlights: [
            'Fixed Parent Group dropdown flickering and disappearing when opened',
            'Fixed group modal occasionally getting stuck at an expanded size',
            'Fixed "What\'s New" splash showing on app reload instead of only on launch',
            'Compact view improvements: polished card layout for standard and favourite profile cards'
        ],
        releaseDate: '',
        githubUrl: 'https://github.com/tomsinclair94/ssh-profile-manager/releases/tag/v0.7.1'
    },
    '0.7.0': {
        title: 'Groups, Favourites, Tags & Encryption',
        subtitle: 'Groups, Favourites, Tags & Encryption',
        highlights: [
            'Hierarchical groups — sub-groups up to 3 levels deep (e.g., Work/Production/WebServers)',
            'Favourites — star your most-used profiles for instant access',
            'Encrypted exports — AES-256-GCM encryption for secure profile sharing',
            'Profile icons — choose from 40+ icons for instant visual recognition',
            'Tag system — colour-coded tags with tag:name search filtering',
            'Individual export/import — share single profiles or entire group trees',
            '30+ keyboard shortcuts — press ? to view all shortcuts'
        ],
        releaseDate: '2026-02-19',
        githubUrl: 'https://github.com/tomsinclair94/ssh-profile-manager/releases/tag/v0.7.0'
    }
};

// Export Format Versioning
// IMPORTANT: Only bump version when export/import structure changes
// Format: major.minor (semantic versioning)
// - Major: Breaking changes (incompatible structure)
// - Minor: Backward-compatible additions (new optional fields)
const CURRENT_EXPORT_FORMAT = '2.0';

const EXPORT_FORMAT_INFO = {
    '1.0': {
        description: 'v0.6.x and earlier (flat groups, no metadata)',
        minAppVersion: '0.1.0',
        maxAppVersion: '0.6.5'
    },
    '2.0': {
        description: 'v0.7.0+ (hierarchical groups, metadata, tags)',
        minAppVersion: '0.7.0',
        maxAppVersion: null  // Current format, no max
    }
};

// Icon system - Lucide icon SVG paths (24x24 viewBox)
// Default icon for profiles without a custom icon
const DEFAULT_PROFILE_ICON = 'server';

// Curated list of Lucide icons for SSH profiles
// Global icon visibility configuration
// Icons marked as false are used in the app UI but excluded from profile selection
const PROFILE_ICON_VISIBILITY = {
    'star': false,          // Used for favorites feature
    'star-off': false,      // Used for favorites feature
    'settings': false       // Used for settings/menu buttons
};

// Each entry: [icon_name, svg_path]
const PROFILE_ICONS = {
    'server': 'M4 2h16c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zM2 14c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-4zM6 6h.01M6 16h.01',
    'server-cog': ['m10.852 14.772-.383.923', 'M13.148 14.772a3 3 0 1 0-2.296-5.544l-.383-.923', 'm13.148 9.228.383-.923', 'm13.53 15.696-.382-.924a3 3 0 1 1-2.296-5.544', 'm14.772 10.852.923-.383', 'm14.772 13.148.923.383', 'M4.5 10H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-.5', 'M4.5 14H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-.5', 'M6 18h.01', 'M6 6h.01', 'm9.228 10.852-.923-.383', 'm9.228 13.148-.923.383'],
    'server-off': ['M7 2h13a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-5', 'M10 10 2.5 2.5C2 2 2 2.5 2 5v3a2 2 0 0 0 2 2h6z', 'M22 17v-1a2 2 0 0 0-2-2h-1', 'M4 14a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16.5l1-.5.5.5-8-8H4z', 'M6 18h.01', 'm2 2 20 20'],
    'database': 'M12 2C6.5 2 2 3.34 2 5v14c0 1.66 4.5 3 10 3s10-1.34 10-3V5c0-1.66-4.5-3-10-3zM2 9c0 1.66 4.5 3 10 3s10-1.34 10-3M2 14c0 1.66 4.5 3 10 3s10-1.34 10-3',
    'database-backup': [
        { type: 'ellipse', attrs: { cx: 12, cy: 5, rx: 9, ry: 3 } },
        { type: 'path', attrs: { d: 'M3 12a9 3 0 0 0 5 2.69' } },
        { type: 'path', attrs: { d: 'M21 9.3V5' } },
        { type: 'path', attrs: { d: 'M3 5v14a9 3 0 0 0 6.47 2.88' } },
        { type: 'path', attrs: { d: 'M12 12v4h4' } },
        { type: 'path', attrs: { d: 'M13 20a5 5 0 0 0 9-3 4.5 4.5 0 0 0-4.5-4.5c-1.33 0-2.54.54-3.41 1.41L12 16' } }
    ],
    'hard-drive': 'M22 12v5c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-5M3.5 15h.01M7 15h.01M22 7v5H2V7c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2z',
    'monitor': 'M20 3H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM8 21h8M12 17v4',
    'laptop': 'M20 16V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v11M2 19h20',
    'terminal': 'M4 17l6-6-6-6M12 19h8',
    'globe': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM2 12h20M12 2c2.5 0 4.5 4.5 4.5 10S14.5 22 12 22 7.5 17.5 7.5 12 9.5 2 12 2z',
    'cloud': 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z',
    'package': [
        { type: 'path', attrs: { d: 'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z' } },
        { type: 'path', attrs: { d: 'M12 22V12' } },
        { type: 'polyline', attrs: { points: '3.29 7 12 12 20.71 7' } },
        { type: 'path', attrs: { d: 'm7.5 4.27 9 5.15' } }
    ],
    'shield': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'lock': 'M19 11H5c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7c0-1.1-.9-2-2-2zM7 11V7c0-2.76 2.24-5 5-5s5 2.24 5 5v4',
    'key': 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
    'folder': 'M22 19c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h5l2 3h9c1.1 0 2 .9 2 2v11z',
    'file': 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM14 2v6h6',
    'layers': 'M12 2l9 4.5-9 4.5-9-4.5L12 2zM3 11l9 4.5 9-4.5M3 16l9 4.5 9-4.5',
    'wifi': 'M5 13a10 10 0 0114 0M8.5 16.5a5 5 0 017 0M12 20h.01',
    'tool': 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
    'code': 'M16 18l6-6-6-6M8 6l-6 6 6 6',
    'smartphone': 'M17 2H7c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM12 20h.01',
    'tablet': 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM12 18h.01',
    'desktop': 'M7 22h10M2 17V5c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2z',
    'computer': [
        { type: 'rect', attrs: { width: 14, height: 8, x: 5, y: 2, rx: 2 } },
        { type: 'rect', attrs: { width: 20, height: 8, x: 2, y: 14, rx: 2 } },
        { type: 'path', attrs: { d: 'M6 18h2' } },
        { type: 'path', attrs: { d: 'M12 18h6' } }
    ],
    'pc-case': [
        { type: 'rect', attrs: { width: 14, height: 20, x: 5, y: 2, rx: 2 } },
        { type: 'path', attrs: { d: 'M15 14h.01' } },
        { type: 'path', attrs: { d: 'M9 6h6' } },
        { type: 'path', attrs: { d: 'M9 10h6' } }
    ],
    'ethernet-port': ['m15 20 3-3h2a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2l3 3z', 'M6 8v1', 'M10 8v1', 'M14 8v1', 'M18 8v1'],
    'cable': ['M17 19a1 1 0 0 1-1-1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1z', 'M17 21v-2', 'M19 14V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V10', 'M21 21v-2', 'M3 5V3', 'M4 10a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2z', 'M7 5V3'],
    'plug': ['M12 22v-5', 'M15 8V2', 'M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z', 'M9 8V2'],
    'usb': ['M4.7 19.3 19 5', 'm21 3-3 1 2 2Z', 'M9.26 7.68 5 12l2 5', 'm10 14 5 2 3.5-3.5', 'm18 12 1-1 1 1-1 1Z'],
    'router': [
        { type: 'rect', attrs: { width: 20, height: 8, x: 2, y: 14, rx: 2 } },
        { type: 'path', attrs: { d: 'M6.01 18H6' } },
        { type: 'path', attrs: { d: 'M10.01 18H10' } },
        { type: 'path', attrs: { d: 'M15 10v4' } },
        { type: 'path', attrs: { d: 'M17.84 7.17a4 4 0 0 0-5.66 0' } },
        { type: 'path', attrs: { d: 'M20.66 4.34a8 8 0 0 0-11.31 0' } }
    ],
    'bluetooth': 'm7 7 10 10-5 5V2l5 5L7 17',
    'key-round': 'M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z',
    'key-square': ['M12.4 2.7a2.5 2.5 0 0 1 3.4 0l5.5 5.5a2.5 2.5 0 0 1 0 3.4l-3.7 3.7a2.5 2.5 0 0 1-3.4 0L8.7 9.8a2.5 2.5 0 0 1 0-3.4z', 'm14 7 3 3', 'm9.4 10.6-6.814 6.814A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814'],
    'shield-check': ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', 'm9 12 2 2 4-4'],
    'cloud-cog': ['m10.852 19.772-.383.924', 'm13.148 14.228.383-.923', 'M13.148 19.772a3 3 0 1 0-2.296-5.544l-.383-.923', 'm13.53 20.696-.382-.924a3 3 0 1 1-2.296-5.544', 'm14.772 15.852.923-.383', 'm14.772 18.148.923.383', 'M4.2 15.1a7 7 0 1 1 9.93-9.858A7 7 0 0 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.2', 'm9.228 15.852-.923-.383', 'm9.228 18.148-.923.383'],
    'workflow': [
        { type: 'rect', attrs: { width: 8, height: 8, x: 3, y: 3, rx: 2 } },
        { type: 'path', attrs: { d: 'M7 11v4a2 2 0 0 0 2 2h4' } },
        { type: 'rect', attrs: { width: 8, height: 8, x: 13, y: 13, rx: 2 } }
    ],
    'settings': [
        { type: 'path', attrs: { d: 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915' } },
        { type: 'circle', attrs: { cx: 12, cy: 12, r: 3 } }
    ],
    'star': [
        { type: 'polygon', attrs: { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2', fill: 'currentColor', stroke: 'currentColor' } }
    ],
    'star-off': 'M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z'
};

// Helper function to create SVG icon element
function createIcon(iconName, size = 20, className = '') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    if (className) {
        svg.setAttribute('class', className);
    }

    const iconData = PROFILE_ICONS[iconName] || PROFILE_ICONS[DEFAULT_PROFILE_ICON];

    // Support: string (single path), array of strings (multiple paths), array of objects (mixed elements)
    const elements = Array.isArray(iconData) ? iconData : [iconData];

    elements.forEach(elementData => {
        if (typeof elementData === 'string') {
            // Simple path string
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', elementData);
            svg.appendChild(path);
        } else if (typeof elementData === 'object') {
            // Object with element type and attributes
            const element = document.createElementNS('http://www.w3.org/2000/svg', elementData.type);
            Object.keys(elementData.attrs).forEach(attr => {
                element.setAttribute(attr, elementData.attrs[attr]);
            });
            svg.appendChild(element);
        }
    });

    return svg;
}

// Validation patterns and rules
const VALIDATION = {
    name: {
        pattern: /^[a-zA-Z0-9\s\-_().\[\]#]+$/,
        maxLength: 64,
        message: 'Only letters, numbers, spaces, and the following special characters are allowed:\n- _ ( ) . [ ] #'
    },
    description: {
        pattern: /^[^<>]*$/,
        maxLength: 128,
        message: 'Cannot contain < or > characters'
    },
    hostname: {
        pattern: /^[a-zA-Z0-9.\-_]+$/,
        maxLength: 64,
        message: 'Only letters, numbers, and the following special characters are allowed:\n. - _'
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
        message: 'Only letters, numbers, and the following special characters are allowed:\n_ - . @ #'
    },
    group: {
        pattern: /^[a-zA-Z0-9\s\-_().\[\]#\/]+$/,
        maxLength: 194, // Max path: 64 chars * 3 levels + 2 slashes = 194 chars
        message: 'Group Name: Only letters, numbers, spaces, and the following special characters are allowed:\n- _ ( ) . [ ] # /'
    }
};

// State
let profiles = [];
let groups = []; // All groups (flat list)
let groupTree = []; // Hierarchical group structure
let allTags = []; // All available tags
let selectedProfileTags = new Set(); // Selected tags for current profile being edited
let editingProfileId = null;
let editingGroupId = null; // Currently editing group ID
let isSubmitting = false;
let collapsedGroups = new Set();
let favouritesCollapsed = false; // Track Favourites group collapse state
let isModifierKeyHeld = false; // Track Cmd/Ctrl key for New Profile button modifier
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

// M-1: HTML escaping utility to prevent XSS in dynamic content
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

function validateGroupName(groupName) {
    // Group names (not paths) have a max length of 64 characters
    const MAX_GROUP_NAME_LENGTH = 64;

    if (groupName.length === 0) {
        return { valid: false, error: 'Group name is required' };
    }
    // Check for reserved name "Ungrouped" (case-insensitive)
    if (groupName.toLowerCase() === 'ungrouped') {
        return { valid: false, error: '"Ungrouped" is a reserved name for profiles without a group' };
    }
    if (groupName.length > MAX_GROUP_NAME_LENGTH) {
        return { valid: false, error: `Maximum ${MAX_GROUP_NAME_LENGTH} characters` };
    }
    // Remove '/' from pattern for group names (not paths)
    const groupNamePattern = /^[a-zA-Z0-9\s\-_().\[\]#]+$/;
    if (!groupNamePattern.test(groupName)) {
        return { valid: false, error: 'Only letters, numbers, spaces, and the following special characters are allowed:\n- _ ( ) . [ ] #' };
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
            // Validate group name (64 char limit, no slashes)
            return validateGroupName(trimmedValue);
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

// Auto-resize textarea to fit content
function autoResizeTextarea(textarea) {
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Set height to scrollHeight (content height)
    // Constrained by CSS max-height of 200px
    textarea.style.height = textarea.scrollHeight + 'px';
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
let searchClearBtn;
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
let toastTimeoutId = null;
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
let requireEncryptionCheck;
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
// Version Splash Screen Elements
let versionSplashModal;
let versionSplashCloseBtn;
let versionSplashDontShowCheckbox;
let versionSplashGithubLink;
let versionLink; // About section in settings
let mainVersionLink; // Main screen header
// Tag Manager Elements
let openTagManagerBtn;
let tagManagerModal;
let tagManagerCloseBtn;
let newTagNameInput;
let newTagColorInput;
let createTagBtn;
let tagListContainer;
// Encryption/Decryption Password Modal Elements
let encryptionPasswordModal;
let encryptionPasswordInput;
let encryptionPasswordConfirm;
let encryptionStrengthBar;
let encryptionStrengthLabel;
let encryptionPasswordError;
let encryptionPasswordCancel;
let encryptionPasswordSubmit;
let decryptionPasswordModal;
let decryptionPasswordInput;
let decryptionPasswordError;
let decryptionPasswordCancel;
let decryptionPasswordSubmit;
// Encryption modal state
let encryptionModalResolver = null;
let decryptionModalResolver = null;
let encryptExportCheck;
let encryptExportHelp;
let encryptionPasswordIntro;
let decryptionModalTryDecrypt = null;

// Modal Stack System - tracks which modal is topmost
// When multiple modals are open (e.g., splash screen over settings),
// this ensures keyboard navigation always targets the topmost modal
const modalStack = [];

function pushModal(modalId) {
    if (!modalStack.includes(modalId)) {
        modalStack.push(modalId);
        debug.log(`Modal stack: pushed ${modalId}. Stack: [${modalStack.join(', ')}]`);

        // Pause recent connections timestamp refresh when modal opens
        pauseRecentConnectionsTimestampRefresh();
    }
}

function popModal(modalId) {
    const index = modalStack.indexOf(modalId);
    if (index > -1) {
        modalStack.splice(index, 1);
        debug.log(`Modal stack: popped ${modalId}. Stack: [${modalStack.join(', ')}]`);

        // Resume recent connections timestamp refresh when all modals are closed
        if (modalStack.length === 0) {
            resumeRecentConnectionsTimestampRefresh();
        }
    }
}

function getTopmostModal() {
    return modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;
}

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

        // When shortcuts are disabled, reset modifier key state and button text
        if (!keyboardShortcutsEnabled) {
            isModifierKeyHeld = false;

            // Reset buttons to default state
            const profileBtn = document.getElementById('new-profile-btn');
            const groupBtn = document.getElementById('add-group-btn');

            if (profileBtn) {
                profileBtn.textContent = '+ New Profile';
                profileBtn.title = 'Create a new SSH profile';
            }
            if (groupBtn) {
                groupBtn.textContent = '+ New Group';
                groupBtn.title = 'Create a new group to organise profiles';
            }
        }
    }
}

function setupModifierKeyTracking() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    // Update button text and tooltips based on modifier key state
    function updateHeaderButtons() {
        const profileBtn = document.getElementById('new-profile-btn');
        const groupBtn = document.getElementById('add-group-btn');

        if (profileBtn) {
            if (isModifierKeyHeld) {
                profileBtn.textContent = 'Import Profile';
                profileBtn.title = 'Import a profile from JSON file';
            } else {
                profileBtn.textContent = '+ New Profile';
                profileBtn.title = 'Create a new SSH profile';
            }
            // Force tooltip refresh by removing and re-adding title
            const title = profileBtn.title;
            profileBtn.removeAttribute('title');
            setTimeout(() => profileBtn.setAttribute('title', title), 0);
        }

        if (groupBtn) {
            if (isModifierKeyHeld) {
                groupBtn.textContent = 'Import Group';
                groupBtn.title = 'Import a group from JSON file';
            } else {
                groupBtn.textContent = '+ New Group';
                groupBtn.title = 'Create a new group to organise profiles';
            }
            // Force tooltip refresh by removing and re-adding title
            const title = groupBtn.title;
            groupBtn.removeAttribute('title');
            setTimeout(() => groupBtn.setAttribute('title', title), 0);
        }
    }

    // Track modifier key state (Cmd on Mac, Ctrl on Windows/Linux)
    document.addEventListener('keydown', (e) => {
        if (!keyboardShortcutsEnabled) return;  // Respect keyboard shortcuts setting

        const modifierPressed = isMac ? e.metaKey : e.ctrlKey;

        if (modifierPressed && !isModifierKeyHeld) {
            isModifierKeyHeld = true;
            updateHeaderButtons();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (!keyboardShortcutsEnabled) return;  // Respect keyboard shortcuts setting

        // Check if the modifier key was released
        const modifierPressed = isMac ? e.metaKey : e.ctrlKey;

        if (!modifierPressed && isModifierKeyHeld) {
            isModifierKeyHeld = false;
            updateHeaderButtons();
        }
    });

    // Reset state when window loses focus (modifier keys released outside window)
    window.addEventListener('blur', () => {
        if (!keyboardShortcutsEnabled) return;  // Respect keyboard shortcuts setting

        if (isModifierKeyHeld) {
            isModifierKeyHeld = false;
            updateHeaderButtons();
        }
    });
}

function setupKeyboardShortcutListeners() {
    document.addEventListener('keydown', (e) => {
        if (!keyboardShortcutsEnabled) return;

        // Check if context menu is open
        const groupMenu = document.querySelector('.group-context-menu');
        const profileMenu = document.querySelector('.profile-action-menu');
        const contextMenuOpen = groupMenu || profileMenu;

        if (contextMenuOpen) {
            // Handle context menu keyboard navigation
            const handled = handleContextMenuKeyboard(e, contextMenuOpen);
            if (handled) return;
        }

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
                       !confirmModal.classList.contains('hidden') ||
                       !versionSplashModal.classList.contains('hidden') ||
                       !groupModal.classList.contains('hidden') ||
                       !tagManagerModal.classList.contains('hidden') ||
                       !encryptionPasswordModal.classList.contains('hidden') ||
                       !decryptionPasswordModal.classList.contains('hidden');

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

function handleContextMenuKeyboard(e, menu) {
    const menuItems = Array.from(menu.querySelectorAll('.group-menu-item, .profile-menu-item'));
    if (menuItems.length === 0) return false;

    // Get currently focused item
    let focusedIndex = menuItems.findIndex(item => item === document.activeElement);

    // Arrow Down - Move to next item
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (focusedIndex === -1) {
            // No item focused, focus first item
            menuItems[0].focus();
        } else {
            // Move to next item (wrap around)
            const nextIndex = (focusedIndex + 1) % menuItems.length;
            menuItems[nextIndex].focus();
        }
        return true;
    }

    // Arrow Up - Move to previous item
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (focusedIndex === -1) {
            // No item focused, focus last item
            menuItems[menuItems.length - 1].focus();
        } else {
            // Move to previous item (wrap around)
            const prevIndex = focusedIndex <= 0 ? menuItems.length - 1 : focusedIndex - 1;
            menuItems[prevIndex].focus();
        }
        return true;
    }

    // Enter or Space - Select focused item
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (focusedIndex !== -1) {
            menuItems[focusedIndex].click();
        }
        return true;
    }

    // Escape - Close menu
    if (e.key === 'Escape') {
        e.preventDefault();
        closeAllGroupMenus();
        closeAllProfileActionMenus();
        return true;
    }

    return false;
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

    // Cmd/Ctrl+S - Focus Search
    if (cmdOrCtrl && e.key === 's') {
        e.preventDefault();
        searchInput.focus();
        return;
    }

    // Cmd/Ctrl+F - Filter Groups
    if (cmdOrCtrl && e.key === 'f') {
        e.preventDefault();
        toggleFilterPopup();
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

    // G - New Group (single key)
    if ((e.key === 'g' || e.key === 'G') && !cmdOrCtrl) {
        e.preventDefault();
        openGroupModal();
        return;
    }

    // Cmd/Ctrl+Right Arrow - Expand All Groups
    if (cmdOrCtrl && e.key === 'ArrowRight') {
        e.preventDefault();
        expandAllGroups();
        return;
    }

    // Cmd/Ctrl+Left Arrow - Collapse All Groups
    if (cmdOrCtrl && e.key === 'ArrowLeft') {
        e.preventDefault();
        collapseAllGroups();
        return;
    }

    // T - Open Tag Manager (single key)
    if ((e.key === 't' || e.key === 'T') && !cmdOrCtrl) {
        e.preventDefault();
        openTagManager();
        return;
    }

    // Escape - Close context menus
    if (e.key === 'Escape') {
        // Check if there are any open context menus
        const groupMenu = document.querySelector('.group-context-menu');
        const profileMenu = document.querySelector('.profile-action-menu');

        if (groupMenu || profileMenu) {
            e.preventDefault();
            closeAllGroupMenus();
            closeAllProfileActionMenus();
            return;
        }
    }
}

// Get all tabbable items in Profile modal
function getProfileModalTabbableItems() {
    const items = [];

    // Form fields (in order matching the modal layout)
    const profileName = document.getElementById('profile-name');
    if (profileName) items.push(profileName);

    // Icon selector (Row 2, left side)
    const profileIcon = document.getElementById('profile-icon');
    if (profileIcon) items.push(profileIcon);

    // Favorite checkbox (Row 2, right side)
    const profileFavoriteCheckbox = document.getElementById('profile-favorite-checkbox');
    if (profileFavoriteCheckbox) items.push(profileFavoriteCheckbox);

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

    // +Group button
    const addGroupBtn = document.getElementById('add-group-from-profile-btn');
    if (addGroupBtn) items.push(addGroupBtn);

    // Tags input
    const profileTagsInput = document.getElementById('profile-tags-input');
    if (profileTagsInput) items.push(profileTagsInput);

    // +Tag button
    const addTagBtn = document.getElementById('add-tag-from-profile-btn');
    if (addTagBtn) items.push(addTagBtn);

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

    // Header buttons first (visually at top of modal)
    const saveBtn = document.getElementById('settings-save-btn');
    if (saveBtn && !saveBtn.disabled) items.push(saveBtn);

    const closeBtn = document.getElementById('settings-close-btn');
    if (closeBtn && !closeBtn.disabled) items.push(closeBtn);

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

    const useTabsInTerminalCheck = document.getElementById('use-tabs-in-terminal-check');
    if (useTabsInTerminalCheck) items.push(useTabsInTerminalCheck);

    const minimizeOnLaunchCheck = document.getElementById('minimize-on-launch-check');
    if (minimizeOnLaunchCheck) items.push(minimizeOnLaunchCheck);

    // Profile management
    const includePasswordsCheck = document.getElementById('include-passwords-check');
    if (includePasswordsCheck) items.push(includePasswordsCheck);
    const requireEncryptionCheck = document.getElementById('require-encryption-check');
    if (requireEncryptionCheck) items.push(requireEncryptionCheck);

    // Profile management buttons
    const exportProfilesBtn = document.getElementById('export-profiles-btn');
    if (exportProfilesBtn) items.push(exportProfilesBtn);

    const importProfilesBtn = document.getElementById('import-profiles-btn');
    if (importProfilesBtn) items.push(importProfilesBtn);

    const deleteAllProfilesBtn = document.getElementById('delete-all-profiles-btn');
    if (deleteAllProfilesBtn) items.push(deleteAllProfilesBtn);

    // Tag management
    const openTagManagerBtn = document.getElementById('open-tag-manager-btn');
    if (openTagManagerBtn) items.push(openTagManagerBtn);

    const deleteAllTagsBtn = document.getElementById('delete-all-tags-btn');
    if (deleteAllTagsBtn) items.push(deleteAllTagsBtn);

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

    // About - GitHub buttons
    const githubStarBtn = document.getElementById('github-star-btn');
    if (githubStarBtn) items.push(githubStarBtn);

    const githubBugBtn = document.getElementById('github-bug-btn');
    if (githubBugBtn) items.push(githubBugBtn);

    const githubFeatureBtn = document.getElementById('github-feature-btn');
    if (githubFeatureBtn) items.push(githubFeatureBtn);

    return items;
}

function getGroupModalTabbableItems() {
    const items = [];

    // Group name input
    const groupNameInput = document.getElementById('group-name');
    if (groupNameInput) items.push(groupNameInput);

    // Parent group select
    const groupParentSelect = document.getElementById('group-parent');
    if (groupParentSelect) items.push(groupParentSelect);

    // Header buttons (Save/Close at the end)
    const saveBtn = document.getElementById('group-save-btn');
    if (saveBtn && !saveBtn.disabled) items.push(saveBtn);

    const closeBtn = document.getElementById('group-close-btn');
    if (closeBtn && !closeBtn.disabled) items.push(closeBtn);

    return items;
}

function getTagManagerModalTabbableItems() {
    const items = [];

    // Create tag form inputs
    const tagNameInput = document.getElementById('new-tag-name-input');
    if (tagNameInput) items.push(tagNameInput);

    const tagColorInput = document.getElementById('new-tag-color-input');
    if (tagColorInput) items.push(tagColorInput);

    const createTagBtn = document.getElementById('create-tag-btn');
    if (createTagBtn) items.push(createTagBtn);

    // Bulk action buttons (only if visible)
    const bulkActions = document.getElementById('tag-bulk-actions');
    if (bulkActions && !bulkActions.classList.contains('hidden')) {
        const selectAllBtn = document.getElementById('select-all-tags-btn');
        if (selectAllBtn) items.push(selectAllBtn);

        const deleteSelectedBtn = document.getElementById('delete-selected-tags-btn');
        if (deleteSelectedBtn) items.push(deleteSelectedBtn);
    }

    // Close button
    const closeBtn = document.getElementById('tag-manager-close-btn');
    if (closeBtn) items.push(closeBtn);

    return items;
}

async function handleModalShortcuts(e) {
    // Get the topmost modal from the stack
    const topmostModal = getTopmostModal();

    if (!topmostModal) return; // No modals open

    // Tab - Special handling for all modals
    if (e.key === 'Tab') {
        e.preventDefault();

        switch (topmostModal) {
            case 'confirm': {
                // Get all visible buttons (default or custom)
                const tabbableButtons = Array.from(confirmModal.querySelectorAll('button:not(.hidden)'))
                    .filter(btn => btn.offsetParent !== null);

                if (tabbableButtons.length === 0) return;

                const focusedElement = document.activeElement;
                const currentIndex = tabbableButtons.indexOf(focusedElement);

                // If nothing is focused or focused element is not in the list
                if (currentIndex === -1) {
                    // Focus first button
                    tabbableButtons[0].focus();
                    return;
                }

                // Calculate next index
                let nextIndex;
                if (e.shiftKey) {
                    // Shift+Tab - backwards
                    nextIndex = currentIndex <= 0 ? tabbableButtons.length - 1 : currentIndex - 1;
                } else {
                    // Tab - forwards
                    nextIndex = currentIndex >= tabbableButtons.length - 1 ? 0 : currentIndex + 1;
                }

                tabbableButtons[nextIndex].focus();
                return;
            }

            case 'versionSplash': {
                // Tabbable items: GitHub link -> Checkbox -> Close button
                const items = [versionSplashGithubLink, versionSplashDontShowCheckbox, versionSplashCloseBtn].filter(item => item);

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

            case 'profile': {
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

            case 'settings': {
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

            case 'group': {
                const items = getGroupModalTabbableItems();
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

            case 'tag-manager': {
                const items = getTagManagerModalTabbableItems();
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

            case 'encryptionPassword': {
                // Filter out disabled elements from tab order
                const allItems = [encryptExportCheck, encryptionPasswordInput, encryptionPasswordConfirm, encryptionPasswordSubmit, encryptionPasswordCancel];
                const items = allItems.filter(item => item && !item.disabled);

                if (items.length === 0) return;

                const currentIndex = items.indexOf(document.activeElement);
                let nextIndex;
                if (e.shiftKey) {
                    nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
                } else {
                    nextIndex = currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
                }
                items[nextIndex].focus();
                return;
            }

            case 'decryptionPassword': {
                const items = [decryptionPasswordInput, decryptionPasswordSubmit, decryptionPasswordCancel];
                const currentIndex = items.indexOf(document.activeElement);
                let nextIndex;
                if (e.shiftKey) {
                    nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
                } else {
                    nextIndex = currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
                }
                items[nextIndex].focus();
                return;
            }

            case 'terminal':
                // Terminal modal handles Tab internally via xterm.js
                // Don't prevent default, let xterm process it
                return;
        }
    }

    // Space - Toggle checkbox in version splash screen
    if (e.key === ' ' && topmostModal === 'versionSplash') {
        if (document.activeElement === versionSplashDontShowCheckbox) {
            // Let default behavior handle it
            return;
        }
    }

    // Escape - Close topmost modal
    if (e.key === 'Escape') {
        e.preventDefault();

        switch (topmostModal) {
            case 'terminal':
                closeEmbeddedTerminal();
                return;

            case 'versionSplash':
                closeVersionSplashScreen();
                return;

            case 'confirm':
                if (confirmResolver) {
                    confirmResolver(false);
                    confirmResolver = null;
                }
                confirmModal.classList.add('hidden');
                popModal('confirm');
                return;

            case 'settings':
                closeSettings();
                return;

            case 'profile':
                await closeModal();
                return;

            case 'group':
                await closeGroupModal();
                return;

            case 'tag-manager':
                closeTagManager();
                return;

            case 'encryptionPassword':
                closeEncryptionPasswordModal(undefined); // undefined = user cancelled
                return;

            case 'decryptionPassword':
                setDecryptionLoading(false);
                closeDecryptionPasswordModal(null);
                return;
        }
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    // Cmd/Ctrl+S - Save (in specific modals)
    if (cmdOrCtrl && e.key === 's') {
        e.preventDefault();

        switch (topmostModal) {
            case 'profile': {
                const saveBtn = document.getElementById('profile-save-btn');
                if (saveBtn && !saveBtn.disabled) {
                    saveProfile();
                }
                return;
            }

            case 'settings': {
                const saveBtn = document.getElementById('settings-save-btn');
                if (saveBtn && !saveBtn.disabled) {
                    saveSettings();
                }
                return;
            }

            case 'group': {
                const saveBtn = document.getElementById('group-save-btn');
                if (saveBtn && !saveBtn.disabled) {
                    saveGroup();
                }
                return;
            }
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

    // Close any open context menus when navigating
    closeAllGroupMenus();
    closeAllProfileActionMenus();

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

    // 2. Add Group button
    const addGroupBtn = document.getElementById('add-group-btn');
    if (addGroupBtn) {
        items.push({ type: 'button', element: addGroupBtn, id: 'add-group-btn' });
    }

    // 3. Settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        items.push({ type: 'button', element: settingsBtn, id: 'settings-btn' });
    }

    // 4. Search bar
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        items.push({ type: 'input', element: searchInput, id: 'search-input' });
    }

    // 5. Expand/Collapse groups button (comes before filter in DOM)
    const expandCollapseBtn = document.getElementById('expand-collapse-btn');
    if (expandCollapseBtn) {
        items.push({ type: 'button', element: expandCollapseBtn, id: 'expand-collapse-btn' });
    }

    // 6. Filter button
    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) {
        items.push({ type: 'button', element: filterBtn, id: 'filter-btn' });
    }

    // 7. All top-level group headers only (no subgroups)
    const groupHeaders = document.querySelectorAll('.profile-group-header');
    groupHeaders.forEach(header => {
        const groupContent = header.closest('.profile-group-content');
        // Only include top-level groups (no parent group-content)
        if (!groupContent) {
            items.push({
                type: 'group',
                element: header,
                id: header.dataset.groupId
            });
        }
    });

    // 8-10. Recent Connections section (conditional based on settings and state)
    const recentLimit = getRecentConnectionsLimit();

    // Only include Recent Connections in Tab cycle if enabled (limit > 0)
    if (recentLimit > 0) {
        const recentList = document.getElementById('recent-connections-list');
        const isCollapsed = recentList && recentList.classList.contains('collapsed');
        const recentConnections = getVisibleRecentConnections();

        // If expanded and has profiles, include the first recent connection
        if (!isCollapsed && recentConnections.length > 0) {
            items.push({
                type: 'recent',
                element: recentConnections[0],
                profileId: recentConnections[0].dataset.profileId
            });
        }

        // Always include Toggle button if Recent Connections are enabled
        const toggleBtn = document.getElementById('toggle-recent-btn');
        if (toggleBtn) {
            items.push({ type: 'button', element: toggleBtn, id: 'toggle-recent-btn' });
        }

        // Always include Clear button if Recent Connections are enabled
        const clearBtn = document.getElementById('clear-recent-btn');
        if (clearBtn) {
            items.push({ type: 'button', element: clearBtn, id: 'clear-recent-btn' });
        }
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
    const addGroupBtn = document.getElementById('add-group-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const searchInput = document.getElementById('search-input');
    const filterBtn = document.getElementById('filter-btn');
    const expandCollapseBtn = document.getElementById('expand-collapse-btn');
    const toggleBtn = document.getElementById('toggle-recent-btn');
    const clearBtn = document.getElementById('clear-recent-btn');

    if (activeElement === newProfileBtn) {
        currentIndex = items.findIndex(item => item.id === 'new-profile-btn');
    } else if (activeElement === addGroupBtn) {
        currentIndex = items.findIndex(item => item.id === 'add-group-btn');
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
        currentIndex = items.findIndex(item => item.type === 'group' && item.id === selectedGroupName);
    } else if (selectedProfileId) {
        // Find the group this profile belongs to
        const profileCard = document.querySelector(`.profile-card[data-id="${selectedProfileId}"]`);
        if (profileCard) {
            const groupHeader = profileCard.closest('.profile-group').querySelector('.profile-group-header');
            if (groupHeader) {
                currentIndex = items.findIndex(item => item.type === 'group' && item.id === groupHeader.dataset.groupId);
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
        selectGroup(nextItem.id);
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
        const prevGroup = document.querySelector(`.profile-group-header[data-group-id="${selectedGroupName}"]`);
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
    const items = getNavigableItems();
    if (items.length === 0) return;

    // Find current selection
    let currentIndex = -1;
    if (selectedGroupName) {
        currentIndex = items.findIndex(item => item.type === 'group' && item.id === selectedGroupName);
    } else if (selectedProfileId) {
        currentIndex = items.findIndex(item => item.type === 'profile' && item.id === selectedProfileId);
    }

    // Arrow Down - Navigate to next item (linear navigation through everything)
    if (e.key === 'ArrowDown') {
        e.preventDefault();

        if (currentIndex === -1 || currentIndex >= items.length - 1) {
            // Start from beginning or wrap around
            currentIndex = 0;
        } else {
            currentIndex++;
        }

        const nextItem = items[currentIndex];
        if (nextItem.type === 'profile') {
            selectProfile(nextItem.id);
        } else if (nextItem.type === 'group') {
            selectGroup(nextItem.id);
        }
        nextItem.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
    }

    // Arrow Up - Navigate to previous item (linear navigation through everything)
    if (e.key === 'ArrowUp') {
        e.preventDefault();

        if (currentIndex <= 0) {
            // Wrap to end
            currentIndex = items.length - 1;
        } else {
            currentIndex--;
        }

        const prevItem = items[currentIndex];
        if (prevItem.type === 'profile') {
            selectProfile(prevItem.id);
        } else if (prevItem.type === 'group') {
            selectGroup(prevItem.id);
        }
        prevItem.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
    }

    // Left Arrow - Collapse group (only works if on a group)
    if (e.key === 'ArrowLeft' && selectedGroupName) {
        e.preventDefault();
        if (!collapsedGroups.has(selectedGroupName)) {
            toggleGroupByName(selectedGroupName);
        }
        return;
    }

    // Right Arrow - Expand group (only works if on a group)
    if (e.key === 'ArrowRight' && selectedGroupName) {
        e.preventDefault();
        if (collapsedGroups.has(selectedGroupName)) {
            toggleGroupByName(selectedGroupName);
        }
        return;
    }

    // Enter - Toggle group OR connect to profile
    if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedGroupName) {
            // On a group - toggle collapse/expand
            toggleGroupByName(selectedGroupName);
        } else if (selectedProfileId) {
            // On a profile - connect
            connectToProfile(selectedProfileId);
        }
        return;
    }

    // Space - Toggle group OR connect to profile (same as Enter)
    if (e.key === ' ') {
        e.preventDefault();
        if (selectedGroupName) {
            // On a group - toggle collapse/expand
            toggleGroupByName(selectedGroupName);
        } else if (selectedProfileId) {
            // On a profile - connect
            connectToProfile(selectedProfileId);
        }
        return;
    }

    // Profile-specific shortcuts (only work when on a profile)
    if (selectedProfileId) {
        // E - Edit selected profile
        if (e.key === 'e' || e.key === 'E') {
            e.preventDefault();
            editProfile(selectedProfileId);
            return;
        }

        // D - Duplicate selected profile
        if (e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            duplicateProfile(selectedProfileId);
            return;
        }

        // A - Open Actions menu for selected profile
        if (e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            // Find the profile card to position the menu
            const profileCard = document.querySelector(`.profile-card[data-id="${selectedProfileId}"]`);
            if (profileCard) {
                // Find the Actions button within the card to use for positioning
                const actionsBtn = profileCard.querySelector('.actions-btn');
                if (actionsBtn) {
                    showProfileActionMenu(selectedProfileId, actionsBtn);
                }
            }
            return;
        }

        // X - Export selected profile
        if (e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            exportSingleProfile(selectedProfileId);
            return;
        }

        // Delete/Backspace - Delete selected profile
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            deleteProfile(selectedProfileId);
            return;
        }
    }

    // Group-specific shortcuts (only work when on a group)
    if (selectedGroupName) {
        // E - Edit selected group
        if (e.key === 'e' || e.key === 'E') {
            e.preventDefault();
            editGroup(selectedGroupName);
            return;
        }

        // G - Add subgroup to selected group
        if (e.key === 'g' || e.key === 'G') {
            e.preventDefault();
            openGroupModal(null, selectedGroupName); // Create new group with this as parent
            return;
        }

        // A - Open Actions menu for selected group
        if (e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            // Find the group header to position the menu
            const groupHeader = document.querySelector(`.profile-group-header[data-group-id="${selectedGroupName}"]`);
            if (groupHeader) {
                // Create a fake event with coordinates from the group header
                const rect = groupHeader.getBoundingClientRect();
                const fakeEvent = {
                    clientX: rect.right - 10, // Position near right edge of header
                    clientY: rect.bottom + 5   // Just below the header
                };
                showGroupMenu(selectedGroupName, fakeEvent);
            }
            return;
        }

        // X - Export selected group
        if (e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            exportSingleGroup(selectedGroupName);
            return;
        }

        // Delete/Backspace - Delete selected group
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            deleteGroup(selectedGroupName);
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

    // Helper function to recursively process a group and its children
    function processGroup(groupElement) {
        const header = groupElement.querySelector(':scope > .profile-group-header');
        if (!header) return;

        const groupId = header.dataset.groupId;

        // Add group header
        items.push({ type: 'group', id: groupId, element: header });

        // Check if group is expanded
        const content = groupElement.querySelector(':scope > .profile-group-content');
        if (content && !content.classList.contains('collapsed')) {
            // Process children in DOM order (profiles and subgroups mixed)
            const children = content.children;
            for (let child of children) {
                if (child.classList.contains('profile-card')) {
                    // It's a profile
                    items.push({ type: 'profile', id: child.dataset.id, element: child });
                } else if (child.classList.contains('profile-group')) {
                    // It's a subgroup - recursively process it
                    processGroup(child);
                }
            }
        }
    }

    // Start with all top-level groups (direct children of #profiles-list)
    const profilesList = document.getElementById('profiles-list');
    if (!profilesList) return items;

    const children = profilesList.children;
    for (let child of children) {
        if (child.classList.contains('profile-group')) {
            processGroup(child);
        }
    }

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

function selectGroup(groupId) {
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
        const prevGroup = document.querySelector(`.profile-group-header[data-group-id="${selectedGroupName}"]`);
        if (prevGroup) {
            prevGroup.classList.remove('selected');
        }
    }

    // Set new group selection (note: selectedGroupName now stores group ID for consistency with existing code)
    selectedGroupName = groupId;
    const groupHeader = document.querySelector(`.profile-group-header[data-group-id="${groupId}"]`);
    if (groupHeader) {
        groupHeader.classList.add('selected');
    }
}

function toggleGroupByName(groupId) {
    const groupHeader = document.querySelector(`.profile-group-header[data-group-id="${groupId}"]`);
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
        const prevGroup = document.querySelector(`.profile-group-header[data-group-id="${selectedGroupName}"]`);
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
        const prevGroup = document.querySelector(`.profile-group-header[data-group-id="${selectedGroupName}"]`);
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
        { category: 'Global Actions', items: [
            { keys: 'N', action: 'New Profile' },
            { keys: 'G', action: 'New Group' },
            { keys: 'S', action: 'Open Settings' },
            { keys: 'T', action: 'Open Tag Manager' },
            { keys: `${modKey} + S`, action: 'Focus Search' },
            { keys: `${modKey} + F`, action: 'Filter Groups' },
            { keys: `${modKey} + ← / →`, action: 'Collapse / Expand All Groups' },
            { keys: '?', action: 'Show This Help' },
        ]},
        { category: 'Navigation', items: [
            { keys: 'Tab', action: 'Cycle Through Interface Elements' },
            { keys: 'Shift + Tab', action: 'Cycle Backwards' },
            { keys: '↑ / ↓', action: 'Navigate Items' },
            { keys: 'Enter / Space', action: 'Activate Selected Item' },
        ]},
        { category: 'Profile Actions', items: [
            { keys: 'Enter', action: 'Connect to Profile' },
            { keys: 'E', action: 'Edit Profile' },
            { keys: 'D', action: 'Duplicate Profile' },
            { keys: 'A', action: 'Open Actions Menu' },
            { keys: 'X', action: 'Export Profile' },
            { keys: 'Backspace / Delete', action: 'Delete Profile' },
        ]},
        { category: 'Group Actions', items: [
            { keys: 'Enter', action: 'Toggle Group Expand/Collapse' },
            { keys: '← / →', action: 'Collapse / Expand Group' },
            { keys: 'E', action: 'Edit Group' },
            { keys: 'G', action: 'Add Subgroup' },
            { keys: 'A', action: 'Open Actions Menu' },
            { keys: 'X', action: 'Export Group' },
            { keys: 'Backspace / Delete', action: 'Delete Group' },
        ]},
        { category: 'Recent Connections', items: [
            { keys: '← / →', action: 'Navigate Connections' },
            { keys: '↑ / ↓', action: 'Collapse / Expand Section' },
            { keys: 'Enter', action: 'Connect' },
            { keys: 'D', action: 'Delete Connection' },
            { keys: 'C', action: 'Clear All' },
        ]},
        { category: 'Modals', items: [
            { keys: 'Escape', action: 'Close / Cancel' },
            { keys: 'Tab', action: 'Cycle Through Fields/Buttons' },
            { keys: 'Shift + Tab', action: 'Cycle Backwards' },
            { keys: 'Enter / Space', action: 'Activate Focused Button' },
            { keys: `${modKey} + S`, action: 'Save (if applicable)' },
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

    // Detect platform and add CSS class for platform-specific styles
    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
    if (platform.includes('mac') || userAgent.includes('mac')) {
        document.body.classList.add('platform-macos');
    } else if (platform.includes('win') || userAgent.includes('win')) {
        document.body.classList.add('platform-windows');
    } else {
        document.body.classList.add('platform-linux');
    }

    // Listen for bundle identifier migration event
    window.__TAURI__.event.listen('migration-success', () => {
        showToast('Successfully migrated from v0.6.5!', TOAST_DURATION_LONG, 'success');
    });

    // Get DOM elements
    profilesList = document.getElementById('profiles-list');
    searchInput = document.getElementById('search-input');
    searchClearBtn = document.getElementById('search-clear-btn');
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
    requireEncryptionCheck = document.getElementById('require-encryption-check');
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
    // Version Splash Screen Elements
    versionSplashModal = document.getElementById('version-splash-modal');
    versionSplashCloseBtn = document.getElementById('version-splash-close-btn');
    versionSplashDontShowCheckbox = document.getElementById('version-splash-dont-show-checkbox');
    versionSplashGithubLink = document.getElementById('version-splash-github-link');
    versionLink = document.getElementById('settings-version-link');
    mainVersionLink = document.getElementById('main-version-link');
    // Tag Manager Elements
    openTagManagerBtn = document.getElementById('open-tag-manager-btn');
    tagManagerModal = document.getElementById('tag-manager-modal');
    tagManagerCloseBtn = document.getElementById('tag-manager-close-btn');
    newTagNameInput = document.getElementById('new-tag-name-input');
    newTagColorInput = document.getElementById('new-tag-color-input');
    createTagBtn = document.getElementById('create-tag-btn');
    tagListContainer = document.getElementById('tag-list-container');
    // Encryption/Decryption Password Modal Elements
    encryptionPasswordModal = document.getElementById('encryption-password-modal');
    encryptionPasswordInput = document.getElementById('encryption-password-input');
    encryptionPasswordConfirm = document.getElementById('encryption-password-confirm');
    encryptionStrengthBar = document.getElementById('encryption-strength-bar');
    encryptionStrengthLabel = document.getElementById('encryption-strength-label');
    encryptionPasswordError = document.getElementById('encryption-password-error');
    encryptionPasswordCancel = document.getElementById('encryption-password-cancel');
    encryptionPasswordSubmit = document.getElementById('encryption-password-submit');
    encryptionPasswordCounter = document.getElementById('encryption-password-counter');
    encryptionPasswordConfirmCounter = document.getElementById('encryption-password-confirm-counter');
    decryptionPasswordModal = document.getElementById('decryption-password-modal');
    decryptionPasswordInput = document.getElementById('decryption-password-input');
    decryptionPasswordError = document.getElementById('decryption-password-error');
    decryptionPasswordCancel = document.getElementById('decryption-password-cancel');
    decryptionPasswordSubmit = document.getElementById('decryption-password-submit');
    encryptExportCheck = document.getElementById('encrypt-export-check');
    encryptExportHelp = document.getElementById('encrypt-export-help');
    encryptionPasswordIntro = document.getElementById('encryption-password-intro');

    debug.log('DOM elements retrieved');

    // Set OS-specific browse hint
    setBrowseHint();

    // Clean up any old version-specific storage keys on app startup
    cleanupOldStorageKeys();

    // Check migration FIRST before loading any state
    // This prevents loading corrupted v0.6.5 data
    checkAndPerformMigration();

    // Load filter and collapsed states BEFORE loading profiles
    // so that renderProfiles() can apply filters immediately
    loadFilterState();
    loadCollapsedState();
    loadFavouritesCollapsedState();

    await loadTags(); // Load tags BEFORE profiles (needed for tag badge colors)
    await loadProfiles();
    await loadGroups(); // Load groups for hierarchical UI
    await loadRecentConnections(); // Load recent connections after profiles
    loadRecentConnectionsLimit(); // Load recent connections limit into settings
    loadRecentConnectionsCollapsedState(); // Load recent connections collapsed state

    // Check and show version splash screen if needed
    checkAndShowVersionSplash();

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
    setupModifierKeyTracking();

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
    const BASE_PADDING = 12; // Match .search-bar base padding
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

        // Perform post-load migration (shows toast, updates UI if needed)
        performPostLoadMigration();

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

// Load tags from backend
async function loadTags() {
    try {
        allTags = await invoke('get_tags');
        debug.log('Tags loaded:', allTags.length);
    } catch (error) {
        console.error('Failed to load tags:', error);
        allTags = [];
    }
}

// ============================================================================
// MIGRATION SYSTEM
// ============================================================================
// This system handles version upgrades and data migrations automatically.
//
// HOW IT WORKS:
// 1. On every app startup, checks if version has changed (compares stored version
//    with CURRENT_APP_VERSION constant)
// 2. If version changed, runs any necessary version-specific migrations
// 3. Migrations use "less than" checks (e.g., < '0.7.0') so they run even if
//    user skips versions (e.g., v0.6.5 → v0.8.0 will still run v0.7.0 migration)
// 4. After all migrations, updates stored version to current version
//
// STORAGE KEYS:
// - migrationVersion: Stores the last version user ran (e.g., "0.7.0")
// - migrationToastShown: Boolean flag to show migration toast once per version
// - lastSplashVersion: Stores last version where splash screen was shown
// - splashDismissedUnchecked: Temporary flag if splash dismissed without checkbox
//
// ADDING NEW MIGRATIONS:
// When creating v0.8.0, add migration logic in checkAndPerformMigration():
//   if (lastMigrationVersion && lastMigrationVersion < '0.8.0') {
//       // Migration logic here
//   }
// Optionally add post-load logic in performPostLoadMigration() for UI updates.
// ============================================================================

// Clean up old version-specific storage keys from previous versions
// This removes legacy keys like "migrationToastShown_0.6.5" that accumulated
// before we switched to generic keys in v0.7.0
function cleanupOldStorageKeys() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('migrationToastShown_')) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        debug.log(`Cleaned up old storage key: ${key}`);
    });

    if (keysToRemove.length > 0) {
        debug.log(`Removed ${keysToRemove.length} old version-specific storage key(s)`);
    }
}

// Check and perform migration EARLY (before loading state)
// Runs version-specific data migrations when version changes are detected.
// Called before any data is loaded to prevent incompatible state from being loaded.
function checkAndPerformMigration() {
    const MIGRATION_VERSION_KEY = 'migrationVersion';
    const MIGRATION_TOAST_SHOWN_KEY = 'migrationToastShown';

    const lastMigrationVersion = localStorage.getItem(MIGRATION_VERSION_KEY);

    if (lastMigrationVersion === CURRENT_APP_VERSION) {
        // Already on current version, no migration needed
        return false;
    }

    debug.log(`Version change detected: ${lastMigrationVersion || 'new install'} → ${CURRENT_APP_VERSION}`);

    // === Version-Specific Migration Logic ===
    // IMPORTANT: Use "less than" comparisons to handle skipped versions.
    // Example: If user goes v0.6.5 → v0.8.0 (skipping v0.7.0), the v0.7.0
    // migration will still run because "0.6.5" < "0.7.0" is true.

    // v0.6.x → v0.7.0: Clear old group state (group names → group IDs)
    // This migration clears localStorage keys that stored group names instead of IDs
    if (lastMigrationVersion && lastMigrationVersion < '0.7.0') {
        debug.log(`Running ${lastMigrationVersion} → v0.7.0 migration...`);
        localStorage.removeItem('filteredGroups');
        localStorage.removeItem('collapsedGroups');
    }

    // EXAMPLE: Future v0.8.0 migration
    // if (lastMigrationVersion && lastMigrationVersion < '0.8.0') {
    //     debug.log(`Running ${lastMigrationVersion} → v0.8.0 migration...`);
    //     // Add migration logic here (clear old keys, transform data, etc.)
    // }

    // Mark migration as complete for current version
    localStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_APP_VERSION);
    // Clear toast flag so migration toast shows once after upgrade
    localStorage.removeItem(MIGRATION_TOAST_SHOWN_KEY);

    debug.log(`Migration to ${CURRENT_APP_VERSION} complete`);

    return true; // Migration performed
}

// Complete migration after data is loaded
// Handles UI updates and shows user notifications after version-specific migrations.
// Called after profiles/groups are loaded so UI can be updated properly.
// NOTE: This is OPTIONAL - only needed if migration requires UI updates or toast notifications.
function performPostLoadMigration() {
    const MIGRATION_VERSION_KEY = 'migrationVersion';
    const MIGRATION_TOAST_SHOWN_KEY = 'migrationToastShown';

    const currentMigrationVersion = localStorage.getItem(MIGRATION_VERSION_KEY);

    if (currentMigrationVersion !== CURRENT_APP_VERSION) {
        // This should not happen since checkAndPerformMigration() runs first
        debug.warn('Migration marker mismatch in performPostLoadMigration()');
        return;
    }

    // Check if migration toast was already shown
    const migrationToastShown = localStorage.getItem(MIGRATION_TOAST_SHOWN_KEY);
    if (migrationToastShown) {
        return; // Already shown
    }

    debug.log(`Completing post-load migration for ${CURRENT_APP_VERSION}...`);

    // === Version-Specific Post-Load Migration ===
    // Use this section to show migration toasts or update UI after data loads.
    // Most versions won't need this - only if you want to notify users of changes.

    // v0.7.0: Re-render with expanded groups, show migration toast
    if (CURRENT_APP_VERSION === '0.7.0') {
        renderProfiles(searchInput?.value || '');
        showToast('Upgraded to v0.7.0 with hierarchical groups! All groups are now visible and expanded.', TOAST_DURATION_LONG, 'success');
    }

    // EXAMPLE: Future v0.8.0 post-load migration
    // if (CURRENT_APP_VERSION === '0.8.0') {
    //     showToast('Upgraded to v0.8.0 with new multi-tab system!', TOAST_DURATION_LONG, 'success');
    // }

    // Mark toast as shown permanently
    localStorage.setItem(MIGRATION_TOAST_SHOWN_KEY, 'true');

    debug.log(`Post-load migration for ${CURRENT_APP_VERSION} complete`);
}

// Version Splash Screen Functions

/**
 * Check if the version splash screen should be shown
 * Compares current version with last shown version
 * @returns {boolean} - True if splash should be shown, false otherwise
 */
function shouldShowVersionSplash() {
    const LAST_SPLASH_VERSION_KEY = 'lastSplashVersion';
    const SPLASH_DISMISSED_UNCHECKED_KEY = 'splashDismissedUnchecked';
    const SESSION_SPLASH_SHOWN_KEY = 'splashShownThisSession';

    // sessionStorage persists across page reloads (Cmd+R) but is cleared on app quit/relaunch.
    // If the splash was already shown this session, skip it to avoid showing on hot reload.
    if (sessionStorage.getItem(SESSION_SPLASH_SHOWN_KEY)) {
        return false;
    }

    const lastShownVersion = localStorage.getItem(LAST_SPLASH_VERSION_KEY);
    const dismissedUnchecked = localStorage.getItem(SPLASH_DISMISSED_UNCHECKED_KEY) === 'true';

    // Show splash if:
    // 1. Never shown before (first launch)
    // 2. Current version is different from last shown version
    // 3. Was dismissed without checkbox on this version (show again next launch)
    if (!lastShownVersion) {
        return true; // First time
    }

    if (lastShownVersion !== CURRENT_APP_VERSION) {
        return true; // New version
    }

    if (dismissedUnchecked) {
        return true; // Show again this session
    }

    return false;
}

/**
 * Mark the version splash screen as shown with preference
 * @param {boolean} dontShowAgain - True if user checked "Don't show again"
 */
function markVersionSplashShown(dontShowAgain) {
    const LAST_SPLASH_VERSION_KEY = 'lastSplashVersion';
    const SPLASH_DISMISSED_UNCHECKED_KEY = 'splashDismissedUnchecked';

    if (dontShowAgain) {
        // User checked "Don't show again" - mark this version as shown
        localStorage.setItem(LAST_SPLASH_VERSION_KEY, CURRENT_APP_VERSION);
        localStorage.removeItem(SPLASH_DISMISSED_UNCHECKED_KEY);
        debug.log(`Version splash ${CURRENT_APP_VERSION} permanently dismissed`);
    } else {
        // User dismissed without checkbox - mark for showing again next launch
        localStorage.setItem(SPLASH_DISMISSED_UNCHECKED_KEY, 'true');
        // Don't update lastSplashVersion - keep it as old version or empty
        debug.log(`Version splash ${CURRENT_APP_VERSION} dismissed until next launch`);
    }
}

/**
 * Populate the version splash screen with changelog data
 * @param {string} version - The version to display (e.g., '0.7.0')
 */
function populateVersionSplash(version) {
    const changelog = VERSION_CHANGELOG[version];

    if (!changelog) {
        debug.warn(`No changelog data found for version ${version}`);
        return false;
    }

    // Set title and subtitle
    const titleElement = document.getElementById('version-splash-title');
    const subtitleElement = document.getElementById('version-splash-subtitle');
    const descriptionElement = document.getElementById('version-splash-description');

    if (titleElement) {
        titleElement.textContent = `What's New in v${version}`;
    }

    if (subtitleElement) {
        subtitleElement.textContent = changelog.subtitle || changelog.title;
    }

    if (descriptionElement) {
        descriptionElement.textContent = `Released on ${changelog.releaseDate}`;
    }

    // Populate highlights list
    const highlightsList = document.getElementById('version-splash-highlights');
    if (highlightsList) {
        highlightsList.innerHTML = ''; // Clear existing items

        changelog.highlights.forEach(highlight => {
            const li = document.createElement('li');
            li.textContent = highlight;
            highlightsList.appendChild(li);
        });
    }

    // Set GitHub link
    if (versionSplashGithubLink) {
        versionSplashGithubLink.href = changelog.githubUrl;
    }

    debug.log(`Version splash populated for ${version}`);
    return true;
}

/**
 * Show the version splash screen modal
 * @param {string} version - The version to display (e.g., '0.7.0')
 */
function showVersionSplashScreen(version) {
    // Populate with changelog data
    const populated = populateVersionSplash(version);

    if (!populated) {
        // If no changelog data, open GitHub URL directly
        const changelog = VERSION_CHANGELOG[version];
        if (changelog && changelog.githubUrl) {
            shell.open(changelog.githubUrl);
        }
        return;
    }

    // Reset checkbox to checked (default)
    if (versionSplashDontShowCheckbox) {
        versionSplashDontShowCheckbox.checked = true;
    }

    // Show modal
    versionSplashModal.classList.remove('hidden');
    pushModal('versionSplash');

    // Mark as shown this session so a hot reload (Cmd+R) doesn't re-trigger it
    sessionStorage.setItem('splashShownThisSession', 'true');

    // Focus GitHub link as first tabbable element
    if (versionSplashGithubLink) {
        versionSplashGithubLink.focus();
    }

    debug.log(`Version splash screen shown for ${version}`);
}

/**
 * Close the version splash screen modal and save preference
 */
function closeVersionSplashScreen() {
    const dontShowAgain = versionSplashDontShowCheckbox?.checked || false;

    // Mark splash as shown with user preference
    markVersionSplashShown(dontShowAgain);

    // Hide modal
    versionSplashModal.classList.add('hidden');
    popModal('versionSplash');

    debug.log('Version splash screen closed');
}

/**
 * Check and show version splash screen if needed
 * Called during app initialization after migration completes
 */
function checkAndShowVersionSplash() {
    // Check if splash should be shown
    if (shouldShowVersionSplash()) {
        // Wait 500ms after migration toast to show splash
        setTimeout(() => {
            showVersionSplashScreen(CURRENT_APP_VERSION);
        }, 500);
    }
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

        // Trigger immediate timestamp refresh if panel is expanded
        const list = document.getElementById('recent-connections-list');
        if (list && !list.classList.contains('collapsed') && recentConnections.length > 0) {
            refreshRecentConnectionsTimestamps();
        }
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

// Recent Connections Timestamp Auto-Refresh
// Refresh interval ID (null when not running)
let recentConnectionsTimestampInterval = null;
// Paused state (true when modals are open)
let recentConnectionsTimestampPaused = false;
// Current interval duration (for detecting changes)
let recentConnectionsCurrentInterval = null;

// Calculate dynamic refresh interval based on most recent connection
// Returns interval in milliseconds
function calculateTimestampRefreshInterval() {
    // If no recent connections, use default 60 seconds
    if (!recentConnections || recentConnections.length === 0) return 60000;

    const now = new Date();

    // Find the most recent connection (shortest time ago)
    let mostRecentSeconds = Infinity;
    for (const recent of recentConnections) {
        try {
            const then = new Date(recent.connected_at);
            const seconds = Math.floor((now - then) / 1000);
            if (seconds < mostRecentSeconds) {
                mostRecentSeconds = seconds;
            }
        } catch (error) {
            console.error('Error calculating recency:', error);
        }
    }

    // Dynamic interval based on most recent connection:
    // - Any connection < 1 minute: refresh every 5 seconds (rapid updates)
    // - All connections ≥ 1 minute: refresh every 60 seconds (efficient)
    return mostRecentSeconds < 60 ? 5000 : 60000;
}

// Refresh only the timestamps in recent connections (no full re-render)
function refreshRecentConnectionsTimestamps() {
    // Only refresh if panel is visible (not collapsed)
    const list = document.getElementById('recent-connections-list');
    if (!list || list.classList.contains('collapsed')) return;

    // Only refresh if we have recent connections data
    if (!recentConnections || recentConnections.length === 0) return;

    // Update each timestamp element
    const items = list.querySelectorAll('.recent-connection-item');
    items.forEach((item, index) => {
        const recent = recentConnections[index];
        if (!recent) return;

        const timeElement = item.querySelector('.recent-connection-time');
        if (timeElement) {
            timeElement.textContent = formatTimeAgo(recent.connected_at);
        }
    });

    // Check if interval should change (e.g., most recent connection aged past 1 minute)
    // Only check if we're currently running (not during initial call from start function)
    if (recentConnectionsTimestampInterval !== null) {
        const newInterval = calculateTimestampRefreshInterval();
        if (newInterval !== recentConnectionsCurrentInterval) {
            debug.log(`Timestamp refresh interval changing from ${recentConnectionsCurrentInterval}ms to ${newInterval}ms`);
            // Restart interval with new duration
            stopRecentConnectionsTimestampRefresh();
            startRecentConnectionsTimestampRefresh();
        }
    }
}

// Start the timestamp refresh interval (dynamic: 5s or 60s based on recency)
function startRecentConnectionsTimestampRefresh() {
    // Don't start if already running
    if (recentConnectionsTimestampInterval !== null) return;

    // Calculate dynamic interval based on most recent connection
    const interval = calculateTimestampRefreshInterval();
    recentConnectionsCurrentInterval = interval;

    // Refresh immediately
    refreshRecentConnectionsTimestamps();

    // Start dynamic interval
    recentConnectionsTimestampInterval = setInterval(() => {
        // Only refresh if not paused (i.e., no modals open)
        if (!recentConnectionsTimestampPaused) {
            refreshRecentConnectionsTimestamps();
        }
    }, interval);
}

// Stop the timestamp refresh interval
function stopRecentConnectionsTimestampRefresh() {
    if (recentConnectionsTimestampInterval !== null) {
        clearInterval(recentConnectionsTimestampInterval);
        recentConnectionsTimestampInterval = null;
        recentConnectionsCurrentInterval = null;
    }
}

// Pause timestamp refresh (when modal opens)
function pauseRecentConnectionsTimestampRefresh() {
    recentConnectionsTimestampPaused = true;
}

// Resume timestamp refresh (when all modals close)
function resumeRecentConnectionsTimestampRefresh() {
    recentConnectionsTimestampPaused = false;
    // Trigger immediate refresh when resuming
    if (recentConnectionsTimestampInterval !== null) {
        refreshRecentConnectionsTimestamps();
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
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
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
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
    }
}

// Toggle recent connections collapsed state
function toggleRecentConnections() {
    const list = document.getElementById('recent-connections-list');
    const toggleBtn = document.getElementById('toggle-recent-btn');
    if (!list || !toggleBtn) return;

    const isCollapsed = list.classList.contains('collapsed');

    if (isCollapsed) {
        // Expanding: show panel
        list.classList.remove('collapsed');
        toggleBtn.textContent = '▼';
        localStorage.setItem('recentConnectionsCollapsed', 'false');

        // Start timestamp auto-refresh when panel is expanded
        startRecentConnectionsTimestampRefresh();
    } else {
        // Collapsing: hide panel
        list.classList.add('collapsed');
        toggleBtn.textContent = '▶';
        localStorage.setItem('recentConnectionsCollapsed', 'true');

        // Stop timestamp auto-refresh when panel is collapsed
        stopRecentConnectionsTimestampRefresh();
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
        // Don't start refresh when collapsed
    } else {
        list.classList.remove('collapsed');
        toggleBtn.textContent = '▼';
        // Start timestamp auto-refresh on initial load if panel is expanded
        startRecentConnectionsTimestampRefresh();
    }
}

// Render tag badges for a profile
function renderTagBadges(tags) {
    if (!tags || tags.length === 0) {
        return ''; // Return empty string if no tags
    }

    // Map tag names to tag objects with colors
    const tagObjects = tags.map(tagName => {
        const tag = allTags.find(t => t.name === tagName);
        return tag || { name: tagName, color: '#6b7280' }; // Fallback gray if tag not found
    });

    // Generate badge HTML with CSP-compliant color application
    const badgesHtml = tagObjects.map(tag => {
        // Calculate text color based on background luminance (same as tag pills)
        const textColor = getContrastTextColor(tag.color);
        return `<span class="tag-badge" data-tag-name="${escapeHtml(tag.name)}" data-tag-color="${tag.color}" data-text-color="${textColor}">${escapeHtml(tag.name)}</span>`;
    }).join('');

    return `<div class="profile-card-tags">${badgesHtml}</div>`;
}

// Apply colors to tag badges (CSP-compliant - colors via JavaScript, not inline styles)
function applyTagBadgeColors() {
    const badges = document.querySelectorAll('.tag-badge');
    badges.forEach(badge => {
        const bgColor = badge.dataset.tagColor;
        const textColor = badge.dataset.textColor;
        if (bgColor) {
            badge.style.backgroundColor = bgColor;
        }
        if (textColor) {
            badge.style.color = textColor;
        }
    });
}

// Render profiles in the UI with hierarchical collapsible groups
// Render the Favourites group (virtual group showing favorited profiles)
function renderFavouritesGroup(favoritedProfiles) {
    if (favoritedProfiles.length === 0) {
        return ''; // Don't render if no favorites
    }

    // Sort favorited profiles A-Z by group path
    const sorted = favoritedProfiles.sort((a, b) => {
        const pathA = a.group_path || 'Ungrouped';
        const pathB = b.group_path || 'Ungrouped';
        return pathA.localeCompare(pathB);
    });

    const count = sorted.length;
    const chevron = favouritesCollapsed ? '▶' : '▼';
    const starIcon = createIcon('star', 22, 'favourites-group-icon');

    let html = `
        <div class="profile-group favourites-group">
            <div class="profile-group-header" data-group-id="__favourites__">
                <span class="group-chevron">${chevron}</span>
                <span class="group-name">Favourites</span>
                ${starIcon.outerHTML}
                <span class="badge group-count-badge">${count}</span>
            </div>
    `;

    if (!favouritesCollapsed) {
        html += '<div class="profile-group-content">';
        sorted.forEach(profile => {
            html += renderFavouriteProfileCard(profile);
        });
        html += '</div>';
    }

    html += '</div>';

    return html;
}

// Render a profile card in the Favourites view (with group path and "Go to Profile" button)
function renderFavouriteProfileCard(profile) {
    const groupPath = profile.group_path || 'Ungrouped';
    const iconName = profile.icon || DEFAULT_PROFILE_ICON;
    const iconSvg = createIcon(iconName, 32, 'profile-card-icon');

    // Favorite star icon (always active in Favourites view)
    const starIconName = 'star';
    const starClass = 'favorite-star-active';
    const starTitle = 'Remove from Favourites';
    const starSvg = createIcon(starIconName, 18, `favorite-star-toggle ${starClass}`);

    // Group path icon
    const folderIcon = createIcon('folder', 14, 'group-path-icon');

    return `
        <div class="profile-card favourite-card" data-id="${profile.id}">
            <div class="profile-card-header">
                <span class="favorite-star-wrapper" data-profile-id="${profile.id}" title="${starTitle}">${starSvg.outerHTML}</span>
                <div class="profile-card-title" title="${escapeHtml(profile.name)}">${escapeHtml(profile.name)}</div>
            </div>
            <div class="profile-card-body">
                <div class="profile-card-icon-section">
                    ${iconSvg.outerHTML}
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
            </div>
            ${renderTagBadges(profile.tags)}
            <div class="profile-group-path">
                ${folderIcon.outerHTML}
                <span>${escapeHtml(groupPath.replace(/\//g, ' / '))}</span>
            </div>
            <div class="profile-card-actions favourite-card-actions">
                <div class="favourite-actions-row">
                    <button class="btn btn-success btn-small connect-btn" data-id="${profile.id}" title="Connect to this SSH profile">Connect</button>
                    <button class="btn btn-primary btn-small actions-btn" data-id="${profile.id}" title="Show profile actions">Actions</button>
                </div>
                <button class="btn btn-secondary btn-small goto-profile-btn" data-id="${profile.id}" title="Go to profile's real location"><span class="goto-label-wide">Go to Profile</span><span class="goto-label-compact">Go to...</span></button>
            </div>
        </div>
    `;
}

// Add tag to search input when tag badge is clicked
function addTagToSearch(tagName) {
    const currentSearch = searchInput.value.trim();
    const tagSearchTerm = `tag:${tagName}`;

    // Check if this tag is already in the search
    const tagPattern = new RegExp(`\\btag:${tagName}\\b`, 'i');
    if (tagPattern.test(currentSearch)) {
        return; // Tag already in search, don't add again
    }

    // Add tag to search (with space separator if there's existing content)
    const newSearch = currentSearch ? `${currentSearch} ${tagSearchTerm}` : tagSearchTerm;
    searchInput.value = newSearch;

    // Trigger search
    renderProfiles(newSearch);

    // Focus search input
    searchInput.focus();
}

function renderProfiles(filter = '') {
    // Parse search filter to extract tag searches and regular text search
    const tagPattern = /tag:([^\s]+)/gi;
    const tagMatches = [...filter.matchAll(tagPattern)];
    const tagSearches = tagMatches.map(match => match[1].toLowerCase());
    const regularSearch = filter.replace(tagPattern, '').trim().toLowerCase();

    // Filter profiles
    const filteredProfiles = profiles.filter(profile => {
        // First check if profile's group or any ancestor is filtered out
        const groupPath = profile.group_path;
        if (groupPath) {
            // Find the group by path
            const group = groups.find(g => g.path === groupPath);
            if (group && isGroupOrAncestorFiltered(group.id)) {
                return false; // Hide this profile because its group or an ancestor is filtered
            }
        }

        // Also check for ungrouped if "ungrouped" is filtered
        if (!groupPath && filteredGroups.has('ungrouped')) {
            return false;
        }

        // Apply tag filter (OR logic - profile must have at least one of the searched tags)
        // Uses exact matching, not wildcard
        if (tagSearches.length > 0) {
            const profileTags = (profile.tags || []).map(t => t.toLowerCase());
            const hasMatchingTag = tagSearches.some(searchTag =>
                profileTags.includes(searchTag)
            );
            if (!hasMatchingTag) return false;
        }

        // Apply regular text search filter
        if (!regularSearch) return true;

        return (
            profile.name.toLowerCase().includes(regularSearch) ||
            profile.host.toLowerCase().includes(regularSearch) ||
            profile.username.toLowerCase().includes(regularSearch) ||
            (profile.description && profile.description.toLowerCase().includes(regularSearch))
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

    // Group profiles by group_path (null = ungrouped)
    const profilesByGroupPath = {};
    filteredProfiles.forEach(profile => {
        const groupPath = profile.group_path || null;
        if (!profilesByGroupPath[groupPath]) profilesByGroupPath[groupPath] = [];
        profilesByGroupPath[groupPath].push(profile);
    });

    // Build HTML using hierarchical structure
    let html = '';

    // Extract favorited profiles from filtered profiles (for Favourites group)
    // Important: Favourites group ignores group filters but respects search filter
    const favoritedProfiles = profiles.filter(profile => {
        // Only include favorited profiles
        if (!profile.is_favorite) return false;

        // Apply tag filter (OR logic - profile must have at least one of the searched tags)
        // Uses exact matching, not wildcard
        if (tagSearches.length > 0) {
            const profileTags = (profile.tags || []).map(t => t.toLowerCase());
            const hasMatchingTag = tagSearches.some(searchTag =>
                profileTags.includes(searchTag)
            );
            if (!hasMatchingTag) return false;
        }

        // Apply regular text search filter
        if (!regularSearch) return true;

        return (
            profile.name.toLowerCase().includes(regularSearch) ||
            profile.host.toLowerCase().includes(regularSearch) ||
            profile.username.toLowerCase().includes(regularSearch) ||
            (profile.description && profile.description.toLowerCase().includes(regularSearch))
        );
    });

    // Render Favourites group FIRST (if any favorites exist)
    html += renderFavouritesGroup(favoritedProfiles);

    // Render top-level groups (parent_id = null)
    // Sort with "Ungrouped" always at the bottom
    const topLevelGroups = groups.filter(g => !g.parent_id).sort((a, b) => {
        const aIsUngrouped = a.name.toLowerCase() === 'ungrouped';
        const bIsUngrouped = b.name.toLowerCase() === 'ungrouped';
        if (aIsUngrouped) return 1;  // a goes to bottom
        if (bIsUngrouped) return -1; // b goes to bottom
        return a.name.localeCompare(b.name);
    });

    topLevelGroups.forEach(group => {
        html += renderGroupNode(group, profilesByGroupPath, 0, filter);
    });

    // Render ungrouped profiles
    if (profilesByGroupPath[null] && profilesByGroupPath[null].length > 0) {
        html += renderUngroupedProfiles(profilesByGroupPath[null]);
    }

    profilesList.innerHTML = html;
    attachProfileEventListeners();
    applyTagBadgeColors(); // Apply colors to tag badges (CSP-compliant)

    updateExpandCollapseButton();
    updateProfileCount(filteredProfiles.length);

    requestAnimationFrame(() => {
        updateScrollbarWidth();
    });
}

// Recursively count profiles in a group and all its descendants
function countProfilesRecursive(groupPath, profilesByGroupPath) {
    let count = 0;

    // Count profiles in this group
    const groupProfiles = profilesByGroupPath[groupPath] || [];
    count += groupProfiles.length;

    // Count profiles in child groups recursively
    // Find the group by path to get its ID for finding children
    const group = groups.find(g => g.path === groupPath);
    if (group) {
        const childGroups = groups.filter(g => g.parent_id === group.id);
        childGroups.forEach(childGroup => {
            count += countProfilesRecursive(childGroup.path, profilesByGroupPath);
        });
    }

    return count;
}

// Recursively render a group node and its children
function renderGroupNode(group, profilesByGroupPath, depth, filter = '') {
    // Skip rendering if this group is filtered out
    if (isGroupOrAncestorFiltered(group.id)) {
        return ''; // Don't render this group or its children
    }

    const isCollapsed = collapsedGroups.has(group.id);
    // Add depth class for CSS-based indentation
    const depthClass = depth > 0 ? `depth-${depth}` : '';

    // Count profiles in this group (direct only, for rendering)
    const groupProfiles = profilesByGroupPath[group.path] || [];

    // Count total profiles including descendants (for badge display)
    const totalProfileCount = countProfilesRecursive(group.path, profilesByGroupPath);

    // Skip rendering "Ungrouped" group if it has no profiles
    // (This handles the case where migration created an empty "Ungrouped" group)
    if (group.name.toLowerCase() === 'ungrouped' && totalProfileCount === 0) {
        return '';
    }

    // Skip rendering groups with no matching profiles when search/filter is active
    if (filter.trim() && totalProfileCount === 0) {
        return '';
    }

    // Check if group is empty (no profiles AND no sub-groups)
    const childGroups = groups.filter(g => g.parent_id === group.id);
    const hasChildren = groupProfiles.length > 0 || childGroups.length > 0;
    const isEmpty = !hasChildren;

    // For empty groups, don't show chevron (or show disabled)
    const chevron = isEmpty ? '' : (isCollapsed ? '▶' : '▼');
    const emptyClass = isEmpty ? 'group-empty' : '';
    const hasSubgroupsClass = childGroups.length > 0 ? 'has-subgroups' : '';

    // Create settings icon for group menu button
    const settingsIcon = createIcon('settings', 22);

    let html = `
        <div class="profile-group ${hasSubgroupsClass}" data-group-id="${group.id}">
            <div class="profile-group-header ${depthClass} ${emptyClass}" data-group-id="${group.id}">
                <span class="group-chevron">${chevron}</span>
                <span class="group-name">${escapeHtml(group.name)}</span>
                <button class="btn btn-icon group-menu-btn" data-group-id="${group.id}" title="Show group actions">
                    ${settingsIcon.outerHTML}
                </button>
                <span class="badge group-count-badge">${totalProfileCount}</span>
            </div>
            <div class="profile-group-content ${isCollapsed || isEmpty ? 'collapsed' : ''}">
    `;

    // Render profiles in this group
    groupProfiles.forEach(profile => {
        html += renderProfileCard(profile, depth);
    });

    // Render child groups
    childGroups.sort((a, b) => a.name.localeCompare(b.name)).forEach(childGroup => {
        html += renderGroupNode(childGroup, profilesByGroupPath, depth + 1, filter);
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
            <div class="profile-group-header profile-group-header-ungrouped" data-group-id="ungrouped">
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

    // Get icon (use default if not set)
    const iconName = profile.icon || DEFAULT_PROFILE_ICON;
    const iconSvg = createIcon(iconName, 32, 'profile-card-icon');

    // Favorite star icon
    const starIconName = profile.is_favorite ? 'star' : 'star-off';
    const starClass = profile.is_favorite ? 'favorite-star-active' : 'favorite-star-inactive';
    const starTitle = profile.is_favorite ? 'Remove from Favourites' : 'Add to Favourites';
    const starSvg = createIcon(starIconName, 18, `favorite-star-toggle ${starClass}`);

    return `
        <div class="profile-card ${depthClass}" data-id="${profile.id}">
            <div class="profile-card-header">
                <span class="favorite-star-wrapper" data-profile-id="${profile.id}" title="${starTitle}">${starSvg.outerHTML}</span>
                <div class="profile-card-title" title="${escapeHtml(profile.name)}">${escapeHtml(profile.name)}</div>
            </div>
            <div class="profile-card-body">
                <div class="profile-card-icon-section">
                    ${iconSvg.outerHTML}
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
            </div>
            ${renderTagBadges(profile.tags)}
            <div class="profile-card-actions">
                <button class="btn btn-success btn-small connect-btn" data-id="${profile.id}" title="Connect to this SSH profile">Connect</button>
                <button class="btn btn-primary btn-small actions-btn" data-id="${profile.id}" title="Show profile actions">Actions</button>
            </div>
        </div>
    `;
}

// Toggle profile favorite status
async function toggleProfileFavorite(profileId, event) {
    if (event) {
        event.stopPropagation(); // Prevent card click events
    }

    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    const newState = !profile.is_favorite;

    try {
        await invoke('set_profile_favorite', { profileId, isFavorite: newState });

        // Update local state
        profile.is_favorite = newState;

        // Show toast notification
        showToast(
            newState ? 'Added to Favourites' : 'Removed from Favourites',
            TOAST_DURATION_SHORT
        );

        // Re-render profiles
        renderProfiles();
    } catch (err) {
        console.error('Failed to update favourite:', err);
        showToast(`Failed to update favourite: ${cleanErrorMessage(err)}`, TOAST_DURATION_LONG, 'error');
    }
}

// Navigate from Favourites view to profile's real location in group structure
function navigateToProfile(profileId) {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    // Collapse Favourites section
    if (!favouritesCollapsed) {
        favouritesCollapsed = true;
        saveFavouritesCollapsedState();
    }

    // Find and expand profile's real group (if it has one)
    if (profile.group_path) {
        // Find group by path
        const group = groups.find(g => g.path === profile.group_path);
        if (group && collapsedGroups.has(group.id)) {
            collapsedGroups.delete(group.id);
            saveCollapsedState();
        }
    }

    // Re-render to show changes
    renderProfiles(searchInput?.value || '');

    // Scroll to and focus profile card in its real location (not the Favourites copy)
    setTimeout(() => {
        // Find the card that's NOT in the favourites section
        const cards = document.querySelectorAll(`.profile-card[data-id="${profileId}"]`);
        const realCard = Array.from(cards).find(card => !card.classList.contains('favourite-card'));

        if (realCard) {
            realCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Select/focus the profile card for keyboard navigation
            selectedProfileId = profileId;
            realCard.classList.add('selected');
            realCard.focus();
        }
    }, 100);
}

// Attach event listeners after rendering
function attachProfileEventListeners() {
    // Group headers
    document.querySelectorAll('.profile-group-header').forEach(header => {
        // Toggle on click (but not on menu button)
        header.addEventListener('click', (e) => {
            if (e.target.classList.contains('group-menu-btn')) return; // Skip if clicking menu button

            // Skip if group is empty (no chevron to expand)
            if (header.classList.contains('group-empty')) return;

            const groupId = header.dataset.groupId;

            // Handle special Favourites group
            if (groupId === '__favourites__') {
                favouritesCollapsed = !favouritesCollapsed;
                saveFavouritesCollapsedState();
                renderProfiles(searchInput?.value || '');
            } else {
                toggleGroup(groupId);
            }
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

    // Favorite star toggles
    document.querySelectorAll('.favorite-star-wrapper').forEach(wrapper => {
        wrapper.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click events
            const profileId = wrapper.dataset.profileId;
            toggleProfileFavorite(profileId, e);
        });
    });

    // "Go to Profile" buttons (only in Favourites view)
    document.querySelectorAll('.goto-profile-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click events
            const profileId = btn.dataset.id;
            navigateToProfile(profileId);
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

// Get all descendant group IDs recursively
function getDescendantGroupIds(groupId) {
    const descendants = [];
    const childGroups = groups.filter(g => g.parent_id === groupId);

    childGroups.forEach(child => {
        descendants.push(child.id);
        // Recursively get descendants of this child
        descendants.push(...getDescendantGroupIds(child.id));
    });

    return descendants;
}

// Toggle group collapse state
function toggleGroup(groupId) {
    if (collapsedGroups.has(groupId)) {
        // Expanding group
        collapsedGroups.delete(groupId);
    } else {
        // Collapsing group - also collapse all descendant groups
        collapsedGroups.add(groupId);

        // Collapse all sub-groups when parent collapses
        const descendants = getDescendantGroupIds(groupId);
        descendants.forEach(descendantId => {
            collapsedGroups.add(descendantId);
        });
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

    // Close any existing menus and popups first
    closeAllGroupMenus();
    closeAllProfileActionMenus();
    closeFilterPopup();

    // Create a simple inline menu (temporary solution)
    const menu = document.createElement('div');
    menu.className = 'group-context-menu';
    menu.style.position = 'absolute';

    menu.innerHTML = `
        <button class="group-menu-item group-menu-edit" data-action="edit">Edit Group</button>
        <button class="group-menu-item" data-action="add-subgroup">Add Subgroup</button>
        <button class="group-menu-item" data-action="export">Export Group</button>
        <button class="group-menu-item group-menu-delete" data-action="delete">Delete Group</button>
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

    // Focus first menu item for keyboard navigation
    setTimeout(() => {
        const firstItem = menu.querySelector('.group-menu-item');
        if (firstItem) firstItem.focus();
    }, 0);

    // Handle menu item clicks
    menu.querySelectorAll('.group-menu-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            const action = item.dataset.action;
            document.body.removeChild(menu);

            if (action === 'edit') {
                await editGroup(groupId);
            } else if (action === 'add-subgroup') {
                openGroupModal(null, groupId); // Create new group with this as parent
            } else if (action === 'export') {
                await exportSingleGroup(groupId);
            } else if (action === 'delete') {
                await deleteGroup(groupId);
            }
        });
    });

    // Close menu when clicking outside or scrolling
    setTimeout(() => {
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                if (document.body.contains(menu)) {
                    document.body.removeChild(menu);
                }
                document.removeEventListener('click', closeMenu);
                document.removeEventListener('scroll', onScroll, true);
            }
        };

        const onScroll = () => {
            if (document.body.contains(menu)) {
                document.body.removeChild(menu);
            }
            document.removeEventListener('click', closeMenu);
            document.removeEventListener('scroll', onScroll, true);
        };

        document.addEventListener('click', closeMenu);
        document.addEventListener('scroll', onScroll, true); // Use capture phase to catch all scroll events
    }, 0);
}

// Helper function to close all group context menus
function closeAllGroupMenus() {
    const existingMenus = document.querySelectorAll('.group-context-menu');
    existingMenus.forEach(existingMenu => {
        if (document.body.contains(existingMenu)) {
            document.body.removeChild(existingMenu);
        }
    });
}

// Helper function to close all profile action menus
function closeAllProfileActionMenus() {
    const existingMenus = document.querySelectorAll('.profile-action-menu');
    existingMenus.forEach(existingMenu => {
        if (document.body.contains(existingMenu)) {
            document.body.removeChild(existingMenu);
        }
    });
}

// Helper function to close filter popup
function closeFilterPopup() {
    if (filterPopup && !filterPopup.classList.contains('hidden')) {
        filterPopup.classList.add('hidden');
    }
}

// Show profile action menu (positioned below button)
function showProfileActionMenu(profileId, buttonElement) {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    // Close any existing menus and popups first
    closeAllProfileActionMenus();
    closeAllGroupMenus();
    closeFilterPopup();

    // Create menu
    const menu = document.createElement('div');
    menu.className = 'profile-action-menu';
    menu.style.position = 'absolute';

    menu.innerHTML = `
        <button class="profile-menu-item profile-menu-edit" data-action="edit">Edit Profile</button>
        <button class="profile-menu-item" data-action="duplicate">Duplicate Profile</button>
        <button class="profile-menu-item" data-action="export">Export Profile</button>
        <button class="profile-menu-item profile-menu-delete" data-action="delete">Delete Profile</button>
    `;

    document.body.appendChild(menu);

    // Get button position
    const buttonRect = buttonElement.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const menuWidth = menuRect.width;
    const menuHeight = menuRect.height;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Position below button by default
    let left = buttonRect.left;
    let top = buttonRect.bottom + 4; // 4px gap below button

    // Check right edge
    if (left + menuWidth > windowWidth) {
        left = windowWidth - menuWidth - 10; // 10px margin from edge
    }

    // Check bottom edge - if menu goes off screen, position above button instead
    if (top + menuHeight > windowHeight) {
        top = buttonRect.top - menuHeight - 4; // 4px gap above button
    }

    // Ensure menu doesn't go off left edge
    if (left < 10) left = 10;

    // Ensure menu doesn't go off top edge
    if (top < 10) top = 10;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    // Focus first menu item for keyboard navigation
    setTimeout(() => {
        const firstItem = menu.querySelector('.profile-menu-item');
        if (firstItem) firstItem.focus();
    }, 0);

    // Handle menu item clicks
    menu.querySelectorAll('.profile-menu-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            const action = item.dataset.action;
            document.body.removeChild(menu);

            if (action === 'edit') {
                editProfile(profileId);
            } else if (action === 'duplicate') {
                duplicateProfile(profileId);
            } else if (action === 'export') {
                await exportSingleProfile(profileId);
            } else if (action === 'delete') {
                await confirmDeleteProfile(profileId);
            }
        });
    });

    // Close menu when clicking outside or scrolling
    setTimeout(() => {
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                if (document.body.contains(menu)) {
                    document.body.removeChild(menu);
                }
                document.removeEventListener('click', closeMenu);
                document.removeEventListener('scroll', onScroll, true);
            }
        };

        const onScroll = () => {
            if (document.body.contains(menu)) {
                document.body.removeChild(menu);
            }
            document.removeEventListener('click', closeMenu);
            document.removeEventListener('scroll', onScroll, true);
        };

        document.addEventListener('click', closeMenu);
        document.addEventListener('scroll', onScroll, true); // Use capture phase to catch all scroll events
    }, 0);
}

// Wrapper for deleteProfile with confirmation (called from action menu)
async function confirmDeleteProfile(profileId) {
    await deleteProfile(profileId);
}

// Edit a group
async function editGroup(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    openGroupModal(group);
}

// Delete a group
async function deleteGroup(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    // Count profiles and subgroups
    const profileCount = profiles.filter(p => isProfileInGroupOrDescendants(p, groupId)).length;
    const subgroupCount = groups.filter(g => g.parent_id === groupId).length;

    // If group is empty (no profiles or subgroups), just delete it
    if (profileCount === 0 && subgroupCount === 0) {
        const confirmMessage = buildConfirmMessage({
            lines: [
                {
                    segments: [
                        { text: 'Delete group ' },
                        { highlight: group.name }
                    ]
                }
            ],
            question: 'Are you sure you want to delete this group?'
        });

        const confirmed = await customConfirm(
            confirmMessage,
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
            showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
        }
        return;
    }

    // Group has content - offer two deletion modes
    const parentText = group.parent_id ? 'parent group' : 'top level';

    // Build content description with highlighting
    const profileText = profileCount === 1 ? 'profile' : 'profiles';
    const subgroupText = subgroupCount === 1 ? 'subgroup' : 'subgroups';

    const lines = [
        {
            segments: [
                { text: 'Delete group ' },
                { highlight: group.name }
            ]
        }
    ];

    // Add content description if there are profiles and/or subgroups
    if (profileCount > 0 && subgroupCount > 0) {
        lines.push({
            segments: [
                { text: 'This group contains ' },
                { highlight: `${profileCount} ${profileText}` },
                { text: ' and ' },
                { highlight: `${subgroupCount} ${subgroupText}` }
            ]
        });
    } else if (profileCount > 0) {
        lines.push({
            segments: [
                { text: 'This group contains ' },
                { highlight: `${profileCount} ${profileText}` }
            ]
        });
    } else if (subgroupCount > 0) {
        lines.push({
            segments: [
                { text: 'This group contains ' },
                { highlight: `${subgroupCount} ${subgroupText}` }
            ]
        });
    }

    const confirmMessage = buildConfirmMessage({
        lines,
        list: [
            `<span class="action-delete-all">Delete All:</span> Permanently deletes all profiles and subgroups`,
            `<span class="action-move-to-parent">Move All:</span> Moves profiles/subgroups to ${parentText}, then deletes group`
        ]
    });

    // Create a custom confirmation dialog with three buttons
    const result = await new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';

        modal.innerHTML = `
            <div class="modal-content delete-group-modal-content">
                <div class="modal-header">
                    <h2>Delete Group</h2>
                </div>
                <div class="confirm-body" id="delete-group-confirm-body"></div>
                <div class="form-actions">
                    <div class="form-actions-left">
                        <button id="cancel-delete-btn" class="btn btn-secondary">Cancel</button>
                    </div>
                    <div class="form-actions-right">
                        <button id="move-to-parent-btn" class="btn btn-primary">Move All</button>
                        <button id="delete-all-btn" class="btn btn-danger">Delete All</button>
                    </div>
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

        // ESC key handler - cancel deletion
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                document.removeEventListener('keydown', handleEscape);
                document.body.removeChild(modal);
                resolve('cancel');
            }
        };
        document.addEventListener('keydown', handleEscape);
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
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
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
    favouritesCollapsed = false; // Also expand Favourites
    saveCollapsedState();
    saveFavouritesCollapsedState();
    renderProfiles(searchInput.value);
}

// Collapse all groups
function collapseAllGroups() {
    const allGroups = getAllGroups();
    allGroups.forEach(group => collapsedGroups.add(group));
    favouritesCollapsed = true; // Also collapse Favourites
    saveCollapsedState();
    saveFavouritesCollapsedState();
    renderProfiles(searchInput.value);
}

// Toggle expand/collapse all groups
function toggleExpandCollapseAll() {
    const allGroups = getAllGroups();
    const anyCollapsed = allGroups.some(group => collapsedGroups.has(group)) || favouritesCollapsed;

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
        // Show/hide clear button based on input value
        if (e.target.value.trim()) {
            searchClearBtn.classList.remove('hidden');
        } else {
            searchClearBtn.classList.add('hidden');
        }
    });

    // ESC key to clear search
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchInput.value.trim()) {
            e.preventDefault();
            searchInput.value = '';
            searchClearBtn.classList.add('hidden');
            renderProfiles('');
            searchInput.blur(); // Remove focus from search input
        }
    });

    // Clear search button
    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchClearBtn.classList.add('hidden');
        renderProfiles('');
        searchInput.focus();
    });

    // Event delegation for profile card buttons (prevents memory leaks)
    profilesList.addEventListener('click', async (e) => {
        const target = e.target;

        if (target.classList.contains('connect-btn')) {
            e.stopPropagation();
            connectToProfile(target.dataset.id);
        } else if (target.classList.contains('actions-btn')) {
            e.stopPropagation();
            showProfileActionMenu(target.dataset.id, target);
        } else if (target.classList.contains('tag-badge')) {
            e.stopPropagation();
            addTagToSearch(target.dataset.tagName);
        }
    });

    newProfileBtn.addEventListener('click', () => {
        if (isModifierKeyHeld) {
            // Cmd/Ctrl held - trigger import
            debug.log('Import profile triggered via modifier key');
            importFileInput.click();
        } else {
            // Normal click - open new profile modal
            debug.log('New profile button clicked!');
            openModal();
        }
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

    // ============================================================================
    // FIX: Prevent horizontal modal shift during text selection drag
    // ============================================================================
    // When dragging to select text in input fields, the browser's native selection
    // mechanism can set scrollLeft values on modal containers, causing a visual shift.
    // CSS overflow/overscroll properties cannot prevent this - we must actively reset
    // scrollLeft to 0 on every animation frame to keep the modal stable.
    // See: Phase 5C progress tracking for full investigation history
    // ============================================================================
    function preventModalHorizontalScroll() {
        const modals = [profileModal, settingsModal, document.getElementById('group-modal')];

        modals.forEach(modal => {
            if (!modal) return;

            const modalContent = modal.querySelector('.modal-content');
            const forms = modal.querySelectorAll('form');

            // Reset scroll on these elements
            const elementsToReset = [modal, modalContent, ...forms];

            elementsToReset.forEach(element => {
                if (element && element.scrollLeft !== 0) {
                    element.scrollLeft = 0;
                }
            });
        });

        // Run check on animation frame for smooth operation
        requestAnimationFrame(preventModalHorizontalScroll);
    }

    // Start the prevention loop
    preventModalHorizontalScroll();

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

                // Auto-resize textarea as user types
                if (e.target.tagName === 'TEXTAREA') {
                    autoResizeTextarea(e.target);
                }
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
        'profile-group',
        'profile-favorite-checkbox'
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

        profileGroupInput.addEventListener('blur', () => {
            // Hide dropdown when tabbing away (with slight delay to allow click on dropdown items)
            setTimeout(() => {
                hideProfileGroupDropdown();
            }, 150);
        });

        profileGroupInput.addEventListener('keydown', handleProfileGroupKeydown);
    }

    // Profile icon searchable dropdown handlers
    const profileIconInput = document.getElementById('profile-icon');
    if (profileIconInput) {
        profileIconInput.addEventListener('input', (e) => {
            const inputValue = e.target.value.toLowerCase().trim();

            // Update icon display if the input matches an icon name exactly
            if (PROFILE_ICONS[inputValue]) {
                updateIconInputDisplay(inputValue);
                document.getElementById('profile-icon-value').value = inputValue;
            } else if (inputValue === '') {
                // Clear icon if input is empty
                updateIconInputDisplay('');
                document.getElementById('profile-icon-value').value = '';
            }

            showProfileIconDropdown(e.target.value);
            checkFormChanged(); // Track changes for new profiles
        });

        profileIconInput.addEventListener('focus', () => {
            showProfileIconDropdown(profileIconInput.value);
        });

        profileIconInput.addEventListener('blur', () => {
            // Hide dropdown when tabbing away (with slight delay to allow click on dropdown items)
            setTimeout(() => {
                hideProfileIconDropdown();
            }, 150);
        });

        profileIconInput.addEventListener('keydown', handleProfileIconKeydown);
    }

    // Profile tags searchable dropdown handlers
    const profileTagsInput = document.getElementById('profile-tags-input');
    const profileTagsWrapper = document.getElementById('profile-tags-wrapper');
    if (profileTagsInput) {
        profileTagsInput.addEventListener('input', (e) => {
            showProfileTagsDropdown(e.target.value);
        });

        profileTagsInput.addEventListener('focus', () => {
            showProfileTagsDropdown(profileTagsInput.value);
        });

        profileTagsInput.addEventListener('blur', () => {
            // Hide dropdown when tabbing away (with slight delay to allow click on dropdown items)
            setTimeout(() => {
                hideProfileTagsDropdown();
            }, 150);
        });

        profileTagsInput.addEventListener('keydown', handleProfileTagsKeydown);

        // Click on wrapper focuses the input
        if (profileTagsWrapper) {
            profileTagsWrapper.addEventListener('click', (e) => {
                // Don't focus if clicking on a remove button
                if (!e.target.closest('.remove-tag')) {
                    profileTagsInput.focus();
                }
            });
        }
    }

    // Add Tag button from profile modal (opens Tag Manager)
    const addTagFromProfileBtn = document.getElementById('add-tag-from-profile-btn');
    if (addTagFromProfileBtn) {
        addTagFromProfileBtn.addEventListener('click', async () => {
            // Hide tag dropdown if open
            hideProfileTagsDropdown();
            // Open Tag Manager modal
            await openTagManager();
        });
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

    // Parent Group searchable dropdown event listeners
    const parentGroupInput = document.getElementById('group-parent');
    if (parentGroupInput) {
        parentGroupInput.addEventListener('input', (e) => {
            showParentGroupDropdown(e.target.value);
        });

        parentGroupInput.addEventListener('focus', () => {
            showParentGroupDropdown(parentGroupInput.value);
        });

        parentGroupInput.addEventListener('keydown', handleParentGroupKeydown);

        parentGroupInput.addEventListener('blur', () => {
            // Hide dropdown when tabbing away (with slight delay to allow click on dropdown items)
            setTimeout(() => {
                hideParentGroupDropdown();
            }, 150);
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        // Close profile group dropdown — check the .form-group container so that clicks on
        // the label or the "+ Group" button (both inside the same form-group) don't close it
        const profileGroupDropdown = document.getElementById('profile-group-dropdown');
        const profileGroupInput = document.getElementById('profile-group');

        if (profileGroupDropdown && !profileGroupDropdown.classList.contains('hidden')) {
            const profileGroupContainer = profileGroupInput?.closest('.form-group');
            if (!profileGroupContainer?.contains(e.target)) {
                hideProfileGroupDropdown();
            }
        }

        // Close parent group dropdown — check the .form-group container so that clicks on
        // the label (outside the wrapper but inside the form-group) don't close it
        const parentGroupDropdown = document.getElementById('group-parent-dropdown');
        const parentGroupInputElem = document.getElementById('group-parent');

        if (parentGroupDropdown && !parentGroupDropdown.classList.contains('hidden')) {
            const parentGroupContainer = parentGroupInputElem?.closest('.form-group');
            if (!parentGroupContainer?.contains(e.target)) {
                hideParentGroupDropdown();
            }
        }

        // Close profile icon dropdown
        const profileIconDropdown = document.getElementById('profile-icon-dropdown');
        const profileIconInput = document.getElementById('profile-icon');

        if (profileIconDropdown && !profileIconDropdown.classList.contains('hidden')) {
            if (!profileIconInput.contains(e.target) &&
                !profileIconDropdown.contains(e.target)) {
                hideProfileIconDropdown();
            }
        }

        // Close profile tags dropdown
        const profileTagsDropdown = document.getElementById('profile-tags-dropdown');
        const profileTagsWrapper = document.getElementById('profile-tags-wrapper');
        const addTagBtn = document.getElementById('add-tag-from-profile-btn');

        if (profileTagsDropdown && !profileTagsDropdown.classList.contains('hidden')) {
            if (!profileTagsWrapper.contains(e.target) &&
                !profileTagsDropdown.contains(e.target) &&
                !addTagBtn.contains(e.target)) {
                hideProfileTagsDropdown();
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
        popModal('confirm');
        // Clear keyboard selections to prevent accidental actions after modal closes
        clearAllSelections();
    });

    confirmCancelBtn.addEventListener('click', () => {
        if (confirmResolver) {
            confirmResolver(false);
            confirmResolver = null;
        }
        confirmModal.classList.add('hidden');
        popModal('confirm');
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
            popModal('confirm');
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

    // Version Splash Screen Modal
    versionSplashCloseBtn.addEventListener('click', () => {
        closeVersionSplashScreen();
    });

    // Removed: backdrop click to close (users should use close button)
    // versionSplashModal.addEventListener('click', (e) => {
    //     if (e.target === versionSplashModal) {
    //         closeVersionSplashScreen();
    //     }
    // });

    // Version link in About section - open splash screen instead of GitHub
    if (versionLink) {
        versionLink.addEventListener('click', (e) => {
            e.preventDefault();
            showVersionSplashScreen(CURRENT_APP_VERSION);
        });
    }

    // Main screen version link - open splash screen
    if (mainVersionLink) {
        mainVersionLink.addEventListener('click', (e) => {
            e.preventDefault();
            showVersionSplashScreen(CURRENT_APP_VERSION);
        });
    }

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

    // Tag Manager
    openTagManagerBtn.addEventListener('click', () => {
        openTagManager();
    });

    tagManagerCloseBtn.addEventListener('click', () => {
        closeTagManager();
    });

    createTagBtn.addEventListener('click', () => {
        createTag();
    });

    // Allow Enter key to create tag
    newTagNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            createTag();
        }
    });

    // Update character counter on input
    newTagNameInput.addEventListener('input', () => {
        updateTagNameCounter();
    });

    // Bulk tag actions
    const selectAllTagsBtn = document.getElementById('select-all-tags-btn');
    const deleteSelectedTagsBtn = document.getElementById('delete-selected-tags-btn');

    if (selectAllTagsBtn) {
        selectAllTagsBtn.addEventListener('click', () => {
            toggleSelectAllTags();
        });
    }

    if (deleteSelectedTagsBtn) {
        deleteSelectedTagsBtn.addEventListener('click', () => {
            deleteSelectedTags();
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

    // Encryption Password Modal listeners
    encryptionPasswordInput.addEventListener('input', () => {
        const val = encryptionPasswordInput.value;
        updatePasswordStrengthMeter(val);
        encryptionPasswordCounter.textContent = `${val.length} / 128`;
        encryptionPasswordCounter.classList.toggle('over-limit', val.length > 128);
        encryptionPasswordError.classList.add('hidden');

        // Live red border: show while the field has text but is too short
        if (val.length > 0 && val.length < 12) {
            encryptionPasswordInput.classList.add('input-error');
        } else {
            encryptionPasswordInput.classList.remove('input-error');
        }

        // Re-validate confirm whenever the main password changes
        validateEncryptionConfirm();
        validateEncryptionPasswordModal();
    });

    encryptionPasswordConfirm.addEventListener('input', () => {
        const val = encryptionPasswordConfirm.value;
        encryptionPasswordConfirmCounter.textContent = `${val.length} / 128`;
        encryptionPasswordConfirmCounter.classList.toggle('over-limit', val.length > 128);
        encryptionPasswordError.classList.add('hidden');
        validateEncryptionConfirm();
        validateEncryptionPasswordModal();
    });

    encryptionPasswordCancel.addEventListener('click', () => {
        closeEncryptionPasswordModal(undefined); // undefined = user cancelled
    });

    encryptionPasswordSubmit.addEventListener('click', () => {
        submitEncryptionPassword();
    });

    encryptionPasswordConfirm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitEncryptionPassword();
        }
    });

    // Encryption checkbox listener - enable/disable password fields
    encryptExportCheck.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        // Enable/disable password fields
        encryptionPasswordInput.disabled = !isChecked;
        encryptionPasswordConfirm.disabled = !isChecked;
        // Clear fields when unchecked
        if (!isChecked) {
            encryptionPasswordInput.value = '';
            encryptionPasswordConfirm.value = '';
            updatePasswordStrengthMeter('');
            encryptionPasswordCounter.textContent = '0 / 128';
            encryptionPasswordConfirmCounter.textContent = '0 / 128';
        }
        // Re-validate
        validateEncryptionPasswordModal();
    });

    // Decryption Password Modal listeners
    decryptionPasswordInput.addEventListener('input', () => {
        decryptionPasswordError.classList.add('hidden');
        decryptionPasswordInput.classList.remove('input-error');
        validateDecryptionPasswordModal();
    });

    decryptionPasswordCancel.addEventListener('click', () => {
        closeDecryptionPasswordModal(null);
    });

    decryptionPasswordSubmit.addEventListener('click', () => {
        submitDecryptionPassword();
    });

    decryptionPasswordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitDecryptionPassword();
        }
    });

    deleteAllProfilesBtn.addEventListener('click', async () => {
        await deleteAllProfiles();
    });

    const deleteAllTagsBtn = document.getElementById('delete-all-tags-btn');
    deleteAllTagsBtn.addEventListener('click', async () => {
        await deleteAllTags();
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

    // GitHub buttons
    const githubStarBtn = document.getElementById('github-star-btn');
    if (githubStarBtn) {
        githubStarBtn.addEventListener('click', () => {
            window.open('https://github.com/tomsinclair94/ssh-profile-manager', '_blank');
        });
    }

    const githubBugBtn = document.getElementById('github-bug-btn');
    if (githubBugBtn) {
        githubBugBtn.addEventListener('click', () => {
            window.open('https://github.com/tomsinclair94/ssh-profile-manager/issues/new?template=bug_report.md', '_blank');
        });
    }

    const githubFeatureBtn = document.getElementById('github-feature-btn');
    if (githubFeatureBtn) {
        githubFeatureBtn.addEventListener('click', () => {
            window.open('https://github.com/tomsinclair94/ssh-profile-manager/issues/new?template=feature_request.md', '_blank');
        });
    }

    includeProfilesCheck.addEventListener('change', () => {
        debouncedCheckSettingsChanged();
    });

    includePasswordsCheck.addEventListener('change', () => {
        debouncedCheckSettingsChanged();
    });

    requireEncryptionCheck.addEventListener('change', () => {
        debouncedCheckSettingsChanged();
    });

    // Use tabs in terminal checkbox
    const useTabsInTerminalCheck = document.getElementById('use-tabs-in-terminal-check');
    if (useTabsInTerminalCheck) {
        useTabsInTerminalCheck.addEventListener('change', () => {
            debouncedCheckSettingsChanged();
        });
    }

    // Minimize on launch checkbox
    const minimizeOnLaunchCheck = document.getElementById('minimize-on-launch-check');
    if (minimizeOnLaunchCheck) {
        minimizeOnLaunchCheck.addEventListener('change', () => {
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
        if (isModifierKeyHeld) {
            // Cmd/Ctrl held - trigger import
            debug.log('Import group triggered via modifier key');
            importFileInput.click();
        } else {
            // Normal click - open new group modal
            openGroupModal();
        }
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
                showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
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

    // Setup dropdown auto-scroll
    setupDropdownAutoScroll();
}

// Setup tooltip hide/show behavior when typing
function setupTooltipPositioning() {
    // Find all inputs and selects that have tooltips (including search input)
    const inputsWithTooltips = document.querySelectorAll('.form-group input, .form-group select, #search-input');

    inputsWithTooltips.forEach(input => {
        const tooltip = input.nextElementSibling;
        if (!tooltip || !tooltip.classList.contains('input-tooltip')) return;

        // Hide tooltip when user starts typing
        input.addEventListener('input', () => {
            tooltip.classList.add('tooltip-hidden-typing');
        });

        // Show tooltip again when hovering (after typing)
        input.addEventListener('mouseenter', () => {
            tooltip.classList.remove('tooltip-hidden-typing');
        });

        // Remove hiding class when field loses focus
        input.addEventListener('blur', () => {
            tooltip.classList.remove('tooltip-hidden-typing');
        });
    });
}

// Setup auto-scroll for dropdowns in modals
function setupDropdownAutoScroll() {
    // Find all select elements in modals
    const selectElements = document.querySelectorAll('.modal-content select');

    selectElements.forEach(select => {
        // Listen for both click and focus events
        const handleDropdown = () => {
            // Small delay to ensure dropdown is rendered
            setTimeout(() => {
                // Find the modal container
                const modal = select.closest('.modal-content');
                if (!modal) return;

                // Get positions
                const selectRect = select.getBoundingClientRect();
                const modalRect = modal.getBoundingClientRect();

                // Estimate dropdown height based on number of options
                // Each option is approximately 32px tall, show max 10 options visible
                const optionCount = Math.min(select.options.length, 10);
                const dropdownHeight = optionCount * 32;

                // Calculate space available below the select within the modal
                const spaceBelow = modalRect.bottom - selectRect.bottom;

                // If dropdown would extend beyond modal, scroll to show it
                if (spaceBelow < dropdownHeight) {
                    // Calculate how much to scroll
                    const scrollNeeded = dropdownHeight - spaceBelow + 20; // 20px padding

                    // Smooth scroll the modal
                    modal.scrollBy({
                        top: scrollNeeded,
                        behavior: 'smooth'
                    });
                }
            }, 10);
        };

        select.addEventListener('click', handleDropdown);
        select.addEventListener('focus', handleDropdown);
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
        pushModal('confirm');
        confirmResolver = resolve;

        // Focus cancel button by default (safer option)
        setTimeout(() => confirmCancelBtn.focus(), 100);
    });
}

// Custom confirm with custom buttons
function customConfirmWithButtons(message, options = {}) {
    return new Promise((resolve) => {
        const title = options.title || 'Confirm';
        const buttons = options.buttons || [];

        confirmTitle.textContent = title;

        // Clear previous content
        confirmMessage.innerHTML = '';

        // Support both DOM elements and strings
        if (message instanceof Node) {
            confirmMessage.appendChild(message);
        } else if (typeof message === 'string') {
            const textNode = document.createTextNode(message);
            confirmMessage.appendChild(textNode);
        }

        // Hide default buttons
        confirmOkBtn.classList.add('hidden');
        confirmCancelBtn.classList.add('hidden');

        // Get the footer element
        const footerRight = confirmModal.querySelector('.form-actions-right');

        // Create custom button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'conflict-buttons-horizontal';

        let defaultButton = null;

        // Create custom buttons
        buttons.forEach(buttonConfig => {
            const button = document.createElement('button');
            button.className = `btn ${buttonConfig.class || 'btn-secondary'}`;
            button.textContent = buttonConfig.text;
            button.addEventListener('click', () => {
                // Clean up
                buttonContainer.remove();
                confirmOkBtn.classList.remove('hidden');
                confirmCancelBtn.classList.remove('hidden');
                confirmModal.classList.add('hidden');
                popModal('confirm');
                resolve(buttonConfig.value);
            });

            if (buttonConfig.default) {
                defaultButton = button;
            }

            buttonContainer.appendChild(button);
        });

        // Append button container to footer instead of message area
        footerRight.appendChild(buttonContainer);

        confirmModal.classList.remove('hidden');
        pushModal('confirm');

        // Focus default button
        setTimeout(() => {
            if (defaultButton) {
                defaultButton.focus();
            } else {
                buttonContainer.firstElementChild?.focus();
            }
        }, 100);

        // Store resolver for keyboard navigation
        confirmResolver = (value) => {
            // Clean up
            buttonContainer.remove();
            confirmOkBtn.classList.remove('hidden');
            confirmCancelBtn.classList.remove('hidden');
            resolve(value);
        };
    });
}

// Show profile conflict dialog
async function showProfileConflictDialog(profileName, groupName) {
    // Create message with HTML formatting
    const messageDiv = document.createElement('div');

    const firstLine = document.createElement('p');
    firstLine.className = 'conflict-message-first-line';
    // M-1: Escape HTML to prevent XSS from crafted import files
    firstLine.innerHTML = `A profile named <span class="profile-name">${escapeHtml(profileName)}</span> already exists in group <span class="profile-name">${escapeHtml(groupName || 'Top Level')}</span>.`;
    messageDiv.appendChild(firstLine);

    const question = document.createElement('p');
    question.className = 'conflict-question';
    question.textContent = 'How would you like to proceed?';
    messageDiv.appendChild(question);

    const list = document.createElement('ul');
    list.className = 'conflict-list';

    const option1 = document.createElement('li');
    option1.className = 'conflict-list-item';
    option1.innerHTML = '<span class="conflict-text-skip">Skip</span> - Cancel the import (no changes made)';
    list.appendChild(option1);

    const option2 = document.createElement('li');
    option2.className = 'conflict-list-item';
    option2.innerHTML = '<span class="conflict-text-primary">Keep Both</span> - Import with renamed profile';
    list.appendChild(option2);

    const option3 = document.createElement('li');
    option3.className = 'conflict-list-item';
    option3.innerHTML = '<span class="conflict-text-danger">Overwrite</span> - Replace the existing profile';
    list.appendChild(option3);

    messageDiv.appendChild(list);

    const result = await customConfirmWithButtons(messageDiv, {
        title: 'Duplicate Profile Found',
        buttons: [
            { text: 'Skip', value: null, class: 'btn-secondary', default: true },
            { text: 'Keep Both', value: 'rename', class: 'btn-primary' },
            { text: 'Overwrite', value: 'overwrite', class: 'btn-danger' }
        ]
    });

    return result; // 'rename', 'overwrite', or null
}

// Show group conflict dialog
async function showGroupConflictDialog(groupName, parentName) {
    // Create message with HTML formatting
    const messageDiv = document.createElement('div');

    const firstLine = document.createElement('p');
    firstLine.className = 'conflict-message-first-line';
    // M-1: Escape HTML to prevent XSS from crafted import files
    firstLine.innerHTML = `A group named <span class="profile-name">${escapeHtml(groupName)}</span> already exists under group <span class="profile-name">${escapeHtml(parentName || 'Top Level')}</span>.`;
    messageDiv.appendChild(firstLine);

    const question = document.createElement('p');
    question.className = 'conflict-question';
    question.textContent = 'How would you like to proceed?';
    messageDiv.appendChild(question);

    const list = document.createElement('ul');
    list.className = 'conflict-list';

    const option1 = document.createElement('li');
    option1.className = 'conflict-list-item';
    option1.innerHTML = '<span class="conflict-text-skip">Skip</span> - Cancel the import (no changes made)';
    list.appendChild(option1);

    const option2 = document.createElement('li');
    option2.className = 'conflict-list-item';
    option2.innerHTML = '<span class="conflict-text-primary">Keep Both</span> - Import with renamed group';
    list.appendChild(option2);

    const option3 = document.createElement('li');
    option3.className = 'conflict-list-item';
    option3.innerHTML = '<span class="conflict-text-warning">Merge</span> - Combine profiles and subgroups';
    list.appendChild(option3);

    messageDiv.appendChild(list);

    const result = await customConfirmWithButtons(messageDiv, {
        title: 'Duplicate Group Found',
        buttons: [
            { text: 'Skip', value: null, class: 'btn-secondary', default: true },
            { text: 'Keep Both', value: 'rename', class: 'btn-primary' },
            { text: 'Merge', value: 'merge', class: 'btn-warning' }
        ]
    });

    return result; // 'rename', 'merge', or null
}

// Toast notification
function showToast(message, duration = TOAST_DURATION_SHORT, type = 'success') {
    // Cancel any pending auto-hide from the previous toast
    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
        toastTimeoutId = null;
    }

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

    toastElement.classList.remove('hidden', 'toast-error', 'toast-success', 'toast-loading');

    // Add appropriate class based on type
    if (type === 'error') {
        toastElement.classList.add('toast-error');
    } else if (type === 'loading') {
        toastElement.classList.add('toast-loading');
    } else {
        toastElement.classList.add('toast-success');
    }

    // Loading toasts persist until the next showToast call replaces them —
    // no auto-hide.  All other types auto-hide after their duration.
    if (type !== 'loading') {
        toastTimeoutId = setTimeout(() => {
            toastElement.classList.add('hidden');
            toastTimeoutId = null;
        }, duration);
    }
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
    const minimizeOnLaunchCheck = document.getElementById('minimize-on-launch-check');
    return {
        theme: themeSelect.value,
        autoUpdateCheck: autoUpdateCheck.checked,
        terminalPreference: terminalSelect.value,
        customTerminalPath: customTerminalPath.value,
        includeProfiles: includeProfilesCheck.checked,
        includePasswords: includePasswordsCheck.checked,
        requireEncryption: requireEncryptionCheck.checked,
        recentConnectionsLimit: recentConnectionsLimitInput ? recentConnectionsLimitInput.value : '5',
        keyboardShortcutsEnabled: keyboardShortcutsCheck ? keyboardShortcutsCheck.checked : true,
        useTabsInTerminal: useTabsInTerminalCheck ? useTabsInTerminalCheck.checked : true,
        minimizeOnLaunch: minimizeOnLaunchCheck ? minimizeOnLaunchCheck.checked : true
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
    // Close any open menus and popups
    closeAllProfileActionMenus();
    closeAllGroupMenus();
    closeFilterPopup();

    settingsModal.classList.remove('hidden');
    pushModal('settings');

    // Reset scroll position (both vertical and horizontal)
    const modalContent = settingsModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.scrollTop = 0;
        modalContent.scrollLeft = 0;
    }

    // Load current settings values into form
    loadRecentConnectionsLimit();
    loadKeyboardShortcutsCheckbox();
    loadIncludePasswordsPreference();
    loadRequireEncryptionPreference();
    loadUseTabsInTerminalPreference();
    loadMinimizeOnLaunchPreference();

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
    popModal('settings');
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

    // Save require encryption preference
    saveRequireEncryptionPreference();

    // Save use tabs in terminal preference
    saveUseTabsInTerminalPreference();

    // Save minimize on launch preference
    saveMinimizeOnLaunchPreference();

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

function loadRequireEncryptionPreference() {
    const requireEncryption = localStorage.getItem('requireEncryption');
    // Default to false (unchecked) if not set
    if (requireEncryption === null) {
        requireEncryptionCheck.checked = false;
        saveRequireEncryptionPreference();
    } else {
        requireEncryptionCheck.checked = requireEncryption === 'true';
    }
}

function saveRequireEncryptionPreference() {
    localStorage.setItem('requireEncryption', requireEncryptionCheck.checked);
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

function loadMinimizeOnLaunchPreference() {
    const minimizeOnLaunchCheck = document.getElementById('minimize-on-launch-check');
    if (minimizeOnLaunchCheck) {
        const minimizeOnLaunch = localStorage.getItem('minimizeOnLaunch');
        // Default to true (checked) if not set
        if (minimizeOnLaunch === null) {
            minimizeOnLaunchCheck.checked = true;
            saveMinimizeOnLaunchPreference();
        } else {
            minimizeOnLaunchCheck.checked = minimizeOnLaunch === 'true';
        }
    }
}

function saveMinimizeOnLaunchPreference() {
    const minimizeOnLaunchCheck = document.getElementById('minimize-on-launch-check');
    if (minimizeOnLaunchCheck) {
        localStorage.setItem('minimizeOnLaunch', minimizeOnLaunchCheck.checked);
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
            showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
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

            // Clear corrupted data and reset silently
            // This is expected during version migrations when group ID format changes
            // No need to alarm users with an error toast for non-critical UI state
            localStorage.removeItem('collapsedGroups');
        }
    }
}

function saveCollapsedState() {
    const collapsedArray = Array.from(collapsedGroups);
    localStorage.setItem('collapsedGroups', JSON.stringify(collapsedArray));
}

function loadFavouritesCollapsedState() {
    const savedState = localStorage.getItem('favouritesCollapsed');
    favouritesCollapsed = savedState === 'true';
}

function saveFavouritesCollapsedState() {
    localStorage.setItem('favouritesCollapsed', favouritesCollapsed ? 'true' : 'false');
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
    const hasUngroupedProfiles = profiles.some(profile => !profile.group_path);
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

    // Add ungrouped if there are ungrouped profiles AND no "Ungrouped" group already exists
    const hasUngrouped = profiles.some(p => !p.group_path);
    const hasUngroupedGroup = groups.some(g => !g.parent_id && g.name.toLowerCase() === 'ungrouped');
    if (hasUngrouped && !hasUngroupedGroup) {
        topLevelGroupIds.push('ungrouped');
    }

    return topLevelGroupIds;
}

// Check if a profile belongs to a group or any of its descendants
function isProfileInGroupOrDescendants(profile, groupId) {
    if (!profile.group_path) return false;

    // Find the profile's group by path
    const profileGroup = groups.find(g => g.path === profile.group_path);
    if (!profileGroup) return false;

    // Check if profile's group matches
    if (profileGroup.id === groupId) return true;

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

    // Add ungrouped if there are ungrouped profiles AND no "Ungrouped" group already exists
    const hasUngrouped = profiles.some(p => !p.group_path);
    const hasUngroupedGroup = topLevelGroups.some(g => g.name.toLowerCase() === 'ungrouped');
    if (hasUngrouped && !hasUngroupedGroup) {
        topLevelGroups.push({ id: 'ungrouped', name: 'Ungrouped', path: 'Ungrouped' });
    }

    if (topLevelGroups.length === 0) {
        filterGroupsList.innerHTML = '<div class="filter-empty-state">No groups available</div>';
        return;
    }

    // Sort by name with "Ungrouped" always at the bottom
    topLevelGroups.sort((a, b) => {
        const aIsUngrouped = (a.name || '').toLowerCase() === 'ungrouped';
        const bIsUngrouped = (b.name || '').toLowerCase() === 'ungrouped';
        if (aIsUngrouped) return 1;  // a goes to bottom
        if (bIsUngrouped) return -1; // b goes to bottom
        return (a.name || '').localeCompare(b.name || '');
    });

    let html = '';
    topLevelGroups.forEach(group => {
        const isChecked = !filteredGroups.has(group.id);

        // Count profiles in this group AND all its descendants
        const groupProfiles = profiles.filter(p => {
            if (group.id === 'ungrouped' || (group.name && group.name.toLowerCase() === 'ungrouped')) {
                return !p.group_path;
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
    // Close any open menus
    closeAllProfileActionMenus();
    closeAllGroupMenus();

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
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
    }
}

// Export profiles to JSON
// Sanitize filename for export
function sanitizeFilename(name) {
    if (!name || typeof name !== 'string') return 'unnamed';

    // Remove special chars that are invalid in filenames
    let sanitized = name.replace(/[/\\?%*:|"<>.]/g, '');

    // Remove spaces (concatenate words)
    sanitized = sanitized.replace(/\s+/g, '');

    // Limit to 50 chars
    sanitized = sanitized.substring(0, 50);

    // Return 'unnamed' if empty after sanitization
    return sanitized || 'unnamed';
}

// ─── Encryption UI Helpers ──────────────────────────────────────────────────

// Check whether a profile list contains any password-authenticated profiles
function exportNeedsEncryption(profileList) {
    return profileList.some(p => p.auth_method === 'password');
}

// Get profiles that would be included in a given export scope
function getProfilesForExportScope(type, id) {
    if (type === 'single') {
        const profile = profiles.find(p => p.id === id);
        return profile ? [profile] : [];
    }
    if (type === 'group') {
        const group = groups.find(g => g.id === id);
        if (!group) return [];
        return profiles.filter(p =>
            p.group_path === group.path ||
            (p.group_path && p.group_path.startsWith(group.path + '/'))
        );
    }
    // 'all'
    return profiles;
}

// Calculate password strength: score 0-4 based on length and character variety
function calculatePasswordStrength(password) {
    let score = 0;

    // Length (0-2 points)
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character variety (0-2 points)
    const hasLower   = /[a-z]/.test(password);
    const hasUpper   = /[A-Z]/.test(password);
    const hasNumber  = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const variety = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    if (variety >= 3) score += 1;
    if (variety === 4) score += 1;

    const labels     = ['Weak', 'Fair', 'Good', 'Strong', 'Stronger'];
    const classNames = ['strength-weak', 'strength-fair', 'strength-good', 'strength-strong', 'strength-stronger'];

    return { score, label: labels[score], className: classNames[score] };
}

// Update the strength meter bar and label (CSS classes only, no inline styles)
function updatePasswordStrengthMeter(password) {
    encryptionStrengthBar.className = 'password-strength-bar';
    encryptionStrengthLabel.className = 'password-strength-label';

    if (password.length === 0) {
        encryptionStrengthBar.classList.add('strength-empty');
        encryptionStrengthLabel.textContent = '';
        return;
    }

    const strength = calculatePasswordStrength(password);
    const widthSteps = [20, 40, 60, 80, 100];

    encryptionStrengthBar.classList.add(strength.className);
    encryptionStrengthBar.classList.add(`strength-width-${widthSteps[strength.score]}`);
    encryptionStrengthLabel.classList.add(strength.className);
    encryptionStrengthLabel.textContent = strength.label;
}

// Determine if encryption is mandatory or optional for a given set of profiles
// Returns: { isMandatory: boolean, reason: string }
function determineEncryptionState(profilesInExport) {
    const requireEncryption = localStorage.getItem('requireEncryption') === 'true';
    const includePasswords = localStorage.getItem('includePasswords') !== 'false';
    const hasPasswordAuth = profilesInExport.some(p => p.auth_method === 'password');

    // Mandatory if: global setting OR exporting password-auth profiles
    const isMandatory = requireEncryption || (includePasswords && hasPasswordAuth);

    let reason = '';
    if (requireEncryption) {
        reason = 'Encryption is required by the global "Require Encryption for All Exports" setting.';
    } else if (includePasswords && hasPasswordAuth) {
        reason = 'Encryption is mandatory when exporting password-authenticated profiles.';
    } else {
        reason = 'Optionally encrypt this export for additional security.';
    }

    return { isMandatory, reason };
}

// Open the encryption password modal. Resolves with password string or null (cancelled).
// Parameters: { isMandatory: boolean, reason: string } or undefined (defaults to mandatory)
function openEncryptionPasswordModal(encryptionState = { isMandatory: true, reason: 'Encryption is required' }) {
    return new Promise((resolve) => {
        encryptionPasswordInput.value = '';
        encryptionPasswordConfirm.value = '';
        encryptionPasswordInput.classList.remove('input-error');
        encryptionPasswordConfirm.classList.remove('input-error');
        encryptionPasswordError.textContent = '';
        encryptionPasswordError.classList.add('hidden');
        updatePasswordStrengthMeter('');
        encryptionPasswordCounter.textContent = '0 / 128';
        encryptionPasswordCounter.classList.remove('over-limit');
        encryptionPasswordConfirmCounter.textContent = '0 / 128';
        encryptionPasswordConfirmCounter.classList.remove('over-limit');
        encryptionPasswordSubmit.disabled = true;  // Start disabled until validation passes

        // Configure encryption checkbox based on whether encryption is mandatory
        if (encryptionState.isMandatory) {
            encryptExportCheck.checked = true;
            encryptExportCheck.disabled = true;
            encryptionPasswordInput.disabled = false;
            encryptionPasswordConfirm.disabled = false;
        } else {
            encryptExportCheck.checked = false;
            encryptExportCheck.disabled = false;
            encryptionPasswordInput.disabled = true;
            encryptionPasswordConfirm.disabled = true;
        }

        // Update intro text and help text
        // Combine both text strings into ONE paragraph with <br> (like bottom help text)
        encryptExportHelp.textContent = ''; // Clear - content moved to intro paragraph
        encryptionPasswordIntro.innerHTML = ''; // Clear existing content

        if (encryptionState.isMandatory) {
            // Red bold text for mandatory message (using deeper red #dc2626 instead of pink-ish #ef4444)
            const redSpan = document.createElement('span');
            redSpan.style.color = '#dc2626';
            redSpan.style.fontWeight = 'bold';
            redSpan.textContent = 'Encryption is required and cannot be disabled.';
            encryptionPasswordIntro.appendChild(redSpan);
            encryptionPasswordIntro.appendChild(document.createElement('br'));
            encryptionPasswordIntro.appendChild(document.createTextNode(encryptionState.reason));
        } else {
            // Gray text for optional message
            encryptionPasswordIntro.appendChild(document.createTextNode('Check the box above to encrypt this export.'));
            encryptionPasswordIntro.appendChild(document.createElement('br'));
            encryptionPasswordIntro.appendChild(document.createTextNode(encryptionState.reason));
        }

        encryptionPasswordModal.classList.remove('hidden');
        pushModal('encryptionPassword');
        encryptionModalResolver = resolve;

        // Focus checkbox if optional, password input if mandatory
        setTimeout(() => {
            if (encryptionState.isMandatory) {
                encryptionPasswordInput.focus();
            } else {
                encryptExportCheck.focus();
            }
        }, 100);

        // Fix Issue 1: Set initial Export button state based on checkbox
        // Without this, button stays disabled even when encryption is optional and checkbox is unchecked
        validateEncryptionPasswordModal();
    });
}

// Close encryption modal and resolve with:
// - undefined: user cancelled (clicked Cancel or ESC)
// - null: user chose not to encrypt (checkbox unchecked, clicked Export)
// - string: password for encryption (checkbox checked, valid password entered)
function closeEncryptionPasswordModal(password) {
    encryptionPasswordModal.classList.add('hidden');
    popModal('encryptionPassword');
    if (encryptionModalResolver) {
        encryptionModalResolver(password);
        encryptionModalResolver = null;
    }
}

// Live red border on the confirm field: shown only when the field has a value
// that doesn't match the main password.  Re-run whenever either field changes.
function validateEncryptionConfirm() {
    const confirm = encryptionPasswordConfirm.value;
    if (confirm.length > 0 && confirm !== encryptionPasswordInput.value) {
        encryptionPasswordConfirm.classList.add('input-error');
    } else {
        encryptionPasswordConfirm.classList.remove('input-error');
    }
}

// Enable/disable the Export button based on checkbox state and password validation:
// - If checkbox unchecked: button is enabled (export without encryption)
// - If checkbox checked: password must be 12+ characters and match confirmation
function validateEncryptionPasswordModal() {
    if (!encryptExportCheck.checked) {
        // Checkbox unchecked - allow export without encryption
        encryptionPasswordSubmit.disabled = false;
    } else {
        // Checkbox checked - require valid password
        const password = encryptionPasswordInput.value;
        const confirm = encryptionPasswordConfirm.value;
        const isValid = password.length >= 12 && password === confirm;
        encryptionPasswordSubmit.disabled = !isValid;
    }
}

// Enable/disable the Import button based on whether a password has been entered
function validateDecryptionPasswordModal() {
    const password = decryptionPasswordInput.value;
    decryptionPasswordSubmit.disabled = password.length === 0;
}

function submitEncryptionPassword() {
    // If checkbox is unchecked, user chose not to encrypt - return null
    if (!encryptExportCheck.checked) {
        closeEncryptionPasswordModal(null);
        return;
    }

    // Checkbox is checked - validate password
    const password = encryptionPasswordInput.value;
    const confirm  = encryptionPasswordConfirm.value;

    // Clear previous error states
    encryptionPasswordInput.classList.remove('input-error');
    encryptionPasswordConfirm.classList.remove('input-error');

    if (password.length < 12) {
        encryptionPasswordError.textContent = 'Password must be at least 12 characters.';
        encryptionPasswordError.classList.remove('hidden');
        encryptionPasswordInput.classList.add('input-error');
        encryptionPasswordInput.focus();
        return;
    }

    if (password.length > 128) {
        encryptionPasswordError.textContent = 'Password must not exceed 128 characters.';
        encryptionPasswordError.classList.remove('hidden');
        encryptionPasswordInput.classList.add('input-error');
        encryptionPasswordInput.focus();
        return;
    }

    if (password !== confirm) {
        encryptionPasswordError.textContent = 'Passwords do not match. Please re-enter.';
        encryptionPasswordError.classList.remove('hidden');
        encryptionPasswordConfirm.classList.add('input-error');
        encryptionPasswordConfirm.focus();
        return;
    }

    closeEncryptionPasswordModal(password);
}

// Open the decryption password modal.
// tryDecrypt: async (password) => errorString | null
//   — called when the user submits; return null on success, an error string to
//     show inline and keep the modal open for another attempt.
// Resolves with the password that succeeded, or null if the user cancelled.
function openDecryptionPasswordModal(tryDecrypt) {
    return new Promise((resolve) => {
        decryptionPasswordInput.value = '';
        decryptionPasswordInput.disabled = false;
        decryptionPasswordInput.classList.remove('input-error');
        decryptionPasswordError.textContent = '';
        decryptionPasswordError.classList.add('hidden');
        decryptionPasswordSubmit.disabled = true;  // Start disabled until a password is entered
        decryptionPasswordCancel.disabled = false;

        decryptionPasswordModal.classList.remove('hidden');
        pushModal('decryptionPassword');
        decryptionModalResolver = resolve;
        decryptionModalTryDecrypt = tryDecrypt;

        setTimeout(() => decryptionPasswordInput.focus(), 100);
    });
}

function closeDecryptionPasswordModal(password) {
    setDecryptionLoading(false);
    decryptionPasswordModal.classList.add('hidden');
    popModal('decryptionPassword');
    if (decryptionModalResolver) {
        decryptionModalResolver(password);
        decryptionModalResolver = null;
    }
    decryptionModalTryDecrypt = null;
}

function setDecryptionLoading(isLoading) {
    decryptionPasswordInput.disabled = isLoading;
    decryptionPasswordSubmit.disabled = isLoading;
    // Don't show button spinner - the toast already shows "Decrypting import..."
    // decryptionPasswordSubmit.classList.toggle('btn-loading', isLoading);
    decryptionPasswordCancel.disabled = isLoading;
}

async function submitDecryptionPassword() {
    const password = decryptionPasswordInput.value;

    if (password.length === 0) {
        decryptionPasswordError.textContent = 'Please enter the decryption password.';
        decryptionPasswordError.classList.remove('hidden');
        decryptionPasswordInput.classList.add('input-error');
        decryptionPasswordInput.focus();
        return;
    }

    setDecryptionLoading(true);

    try {
        const error = await decryptionModalTryDecrypt(password);

        // Modal may have been closed via Escape while the operation was in
        // flight — if so, just drop the result silently.
        if (decryptionPasswordModal.classList.contains('hidden')) return;

        if (!error) {
            closeDecryptionPasswordModal(password);
        } else {
            setDecryptionLoading(false);
            decryptionPasswordError.textContent = error;
            decryptionPasswordError.classList.remove('hidden');
            decryptionPasswordInput.classList.add('input-error');
            decryptionPasswordInput.value = '';
            decryptionPasswordInput.focus();
        }
    } catch (e) {
        // Non-crypto error (e.g. backend crash) — surface as toast and abort
        setDecryptionLoading(false);
        if (!decryptionPasswordModal.classList.contains('hidden')) {
            closeDecryptionPasswordModal(null);
        }
        showToast(cleanErrorMessage(e), TOAST_DURATION_LONG, 'error');
    }
}

// Returns true if the error is a crypto/decryption error (vs a parse/structure error)
function isCryptoError(e) {
    const s = String(e);
    return s.includes('Incorrect password') ||
           s.includes('corrupted or has been tampered') ||
           s.includes('corrupted or invalid') ||
           s.includes('is encrypted');
}

// ─── Export / Import ─────────────────────────────────────────────────────────

// Export single profile
async function exportSingleProfile(profileId) {
    try {
        const profile = profiles.find(p => p.id === profileId);
        if (!profile) {
            showToast('Profile not found', TOAST_DURATION_LONG, 'error');
            return;
        }

        const includePasswords = localStorage.getItem('includePasswords') !== 'false';

        // Determine encryption state and show encryption modal
        const encryptionState = determineEncryptionState([profile]);
        const encryptionPassword = await openEncryptionPasswordModal(encryptionState);

        // Handle modal return: undefined = cancelled, null = no encryption, string = password
        if (encryptionPassword === undefined) return; // User cancelled

        showToast('Exporting profile...', TOAST_DURATION_LOADING, encryptionPassword ? 'loading' : 'success');
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        const data = await invoke('export_profile', {
            profileId: profileId,
            includePassword: includePasswords,
            encryptionPassword: encryptionPassword
        });

        const sanitizedName = sanitizeFilename(profile.name);
        const defaultFilename = `sshpm-profile-${sanitizedName}-${new Date().toISOString().split('T')[0]}.json`;

        const success = await invoke('save_profiles_to_file', {
            data: data,
            defaultFilename: defaultFilename
        });

        if (success) {
            showToast('Profile exported successfully!');
            debug.log('Profile exported successfully');
        } else {
            toastElement.classList.add('hidden');
            debug.log('User cancelled save dialog');
        }
    } catch (error) {
        console.error('Failed to export profile:', error);
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
    }
}

// Export single group
async function exportSingleGroup(groupId) {
    try {
        const group = groups.find(g => g.id === groupId);
        if (!group) {
            showToast('Group not found', TOAST_DURATION_LONG, 'error');
            return;
        }

        const includePasswords = localStorage.getItem('includePasswords') !== 'false';

        // Determine encryption state based on all profiles in group (including subgroups)
        const groupProfiles = getProfilesForExportScope('group', groupId);
        const encryptionState = determineEncryptionState(groupProfiles);
        const encryptionPassword = await openEncryptionPasswordModal(encryptionState);

        // Handle modal return: undefined = cancelled, null = no encryption, string = password
        if (encryptionPassword === undefined) return; // User cancelled

        showToast('Exporting group...', TOAST_DURATION_LOADING, encryptionPassword ? 'loading' : 'success');
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        const data = await invoke('export_group', {
            groupId: groupId,
            includePasswords: includePasswords,
            encryptionPassword: encryptionPassword
        });

        const sanitizedGroupName = sanitizeFilename(group.name);
        const defaultFilename = `sshpm-group-${sanitizedGroupName}-${new Date().toISOString().split('T')[0]}.json`;

        const success = await invoke('save_profiles_to_file', {
            data: data,
            defaultFilename: defaultFilename
        });

        if (success) {
            showToast('Group exported successfully!');
            debug.log('Group exported successfully');
        } else {
            toastElement.classList.add('hidden');
            debug.log('User cancelled save dialog');
        }
    } catch (error) {
        console.error('Failed to export group:', error);
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
    }
}

// Export all profiles
async function exportProfiles() {
    try {
        const includePasswords = localStorage.getItem('includePasswords') !== 'false';

        // Determine encryption state based on all profiles
        const encryptionState = determineEncryptionState(profiles);
        const encryptionPassword = await openEncryptionPasswordModal(encryptionState);

        // Handle modal return: undefined = cancelled, null = no encryption, string = password
        if (encryptionPassword === undefined) return; // User cancelled

        showToast('Exporting profiles...', TOAST_DURATION_LOADING, encryptionPassword ? 'loading' : 'success');
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        const data = await invoke('export_profiles', {
            includePasswords: includePasswords,
            encryptionPassword: encryptionPassword
        });

        const defaultFilename = `sshpm-profile-all-${new Date().toISOString().split('T')[0]}.json`;

        const success = await invoke('save_profiles_to_file', {
            data: data,
            defaultFilename: defaultFilename
        });

        if (success) {
            showToast('Profiles exported successfully!');
            debug.log('Profiles exported successfully');
        } else {
            toastElement.classList.add('hidden');
            debug.log('User cancelled save dialog');
        }
    } catch (error) {
        console.error('Failed to export profiles:', error);
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
    }
}

// Check export format compatibility for imports
// Returns: { compatible: boolean, requiresMigration: boolean, message: string }
function checkExportCompatibility(data) {
    // Default to format 1.0 if not specified (backward compatibility with v0.6.x)
    const exportFormatVersion = data.export_format_version || data.exportFormatVersion || '1.0';

    // Parse version numbers
    const [exportMajor, exportMinor] = exportFormatVersion.split('.').map(Number);
    const [currentMajor, currentMinor] = CURRENT_EXPORT_FORMAT.split('.').map(Number);

    // Check for invalid version format
    if (isNaN(exportMajor) || isNaN(exportMinor)) {
        return {
            compatible: false,
            requiresMigration: false,
            message: `Invalid export format version: "${exportFormatVersion}"`
        };
    }

    // Incompatible major version
    if (exportMajor !== currentMajor) {
        if (exportMajor < currentMajor) {
            // Older major version - can migrate
            const formatInfo = EXPORT_FORMAT_INFO[exportFormatVersion] || EXPORT_FORMAT_INFO['1.0'];
            return {
                compatible: true,
                requiresMigration: true,
                message: `This export was created with an older version (format ${exportFormatVersion}: ${formatInfo.description}). It will be automatically migrated to the current format.`
            };
        } else {
            // Newer major version - incompatible
            const formatInfo = EXPORT_FORMAT_INFO[exportFormatVersion];
            const minVersion = formatInfo?.minAppVersion || 'a newer version';
            return {
                compatible: false,
                requiresMigration: false,
                message: `This export was created with a newer version (format ${exportFormatVersion}).\n\nPlease upgrade to SSH Profile Manager v${minVersion} or later to import this file.\n\nDownload: https://github.com/tomsinclair94/ssh-profile-manager/releases`
            };
        }
    }

    // Same major version, check minor
    if (exportMinor > currentMinor) {
        // Newer minor version - compatible but warn
        return {
            compatible: true,
            requiresMigration: false,
            message: `This export contains newer features (format ${exportFormatVersion}). Some features may not be imported.`
        };
    }

    // Same version or older minor version - fully compatible
    return {
        compatible: true,
        requiresMigration: false,
        message: null
    };
}

// Migrate export data from format 1.0 to 2.0
// Format 1.0: flat groups (group_name), no metadata, no tags
// Format 2.0: hierarchical groups (group_id), metadata, tags
function migrateExportFormat_1_0_to_2_0(data) {
    debug.log('Migrating export from format 1.0 to 2.0');

    // Migrate each profile
    const migratedProfiles = data.profiles.map(profile => {
        const migrated = {
            ...profile,
            // Add v0.7.0 fields with defaults
            metadata: null,
            tags: []
        };

        // Rename 'group' field to 'group_path' (v1.0 → v2.0)
        // In v1.0, profiles had a 'group' field with just the group name (flat groups)
        // In v2.0, profiles have a 'group_path' field with hierarchical path
        // Since v1.0 groups were flat, the group name IS the path
        if (profile.group) {
            migrated.group_path = profile.group;
            delete migrated.group; // Remove old field name
        }

        return migrated;
    });

    // Return migrated data with updated format version
    return {
        ...data,
        export_format_version: '2.0',
        profiles: migratedProfiles
    };
}

// Detect import type from JSON data
// Returns: 'all', 'profile', 'group', or null for invalid
function detectImportType(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }

    // Check if it's a single profile export (v0.7.0+)
    if (data.profile && typeof data.profile === 'object') {
        return 'profile';
    }

    // Check if it's a single group export (v0.7.0+)
    if (data.group && typeof data.group === 'object') {
        return 'group';
    }

    // Check if it's a full export (has profiles array)
    if (data.profiles && Array.isArray(data.profiles)) {
        return 'all';
    }

    return null;
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
// Import router - auto-detects and routes to appropriate import handler
async function importProfiles(file) {
    try {
        // Show loading feedback
        showToast('Reading import file...', TOAST_DURATION_LOADING);

        // Read and parse file
        const text = await file.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            showToast('Invalid JSON file: File is not valid JSON format', TOAST_DURATION_LONG, 'error');
            return;
        }

        // Encrypted import: modal stays open until password is correct or user cancels
        if (data.encrypted === true) {
            toastElement.classList.add('hidden');
            const password = await openDecryptionPasswordModal(async (pw) => {
                return await routeEncryptedImport(text, pw);
            });
            if (password === null) {
                // User cancelled - ensure toast is hidden
                toastElement.classList.add('hidden');
                return;
            }
            // Success path already handled inside routeEncryptedImport
            return;
        }

        // Plain import: detect type and route as before
        const importType = detectImportType(data);

        if (importType === 'profile') {
            await importSingleProfile(data);
        } else if (importType === 'group') {
            await importSingleGroup(data);
        } else if (importType === 'all') {
            await importAllProfiles(data);
        } else {
            showToast('Unknown import file format', TOAST_DURATION_LONG, 'error');
        }
    } catch (error) {
        console.error('Failed to import:', error);
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
    }
}

// Route an encrypted import by probing each backend command in order of specificity.
// Each command decrypts server-side then parses: parse failures fall through to the next type,
// crypto errors (wrong password / HMAC) are surfaced immediately.
// Returns null on success, or the crypto error string for the caller to retry.
async function routeEncryptedImport(rawText, encryptionPassword) {
    showToast('Decrypting import...', TOAST_DURATION_LOADING, 'loading');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // --- Probe: single profile (non-destructive: only imports if no conflict) ---
    try {
        const result = await invoke('import_profile', {
            data: rawText,
            targetGroupPath: null,
            duplicateAction: 'skip',
            encryptionPassword: encryptionPassword
        });
        // Matched single-profile format. Handle conflict resolution if needed.
        await handleEncryptedSingleProfileImport(rawText, encryptionPassword, result);
        return null;
    } catch (e) {
        if (isCryptoError(e)) {
            // Hide decryption toast before returning error
            toastElement.classList.add('hidden');
            return cleanErrorMessage(e);
        }
        // Parse error — try next type
    }

    // --- Probe: single group (non-destructive: only imports if no conflict) ---
    try {
        const result = await invoke('import_group', {
            data: rawText,
            parentGroupPath: null,
            duplicateAction: 'skip',
            encryptionPassword: encryptionPassword
        });
        await handleEncryptedSingleGroupImport(rawText, encryptionPassword, result);
        return null;
    } catch (e) {
        if (isCryptoError(e)) {
            // Hide decryption toast before returning error
            toastElement.classList.add('hidden');
            return cleanErrorMessage(e);
        }
    }

    // --- Must be "all profiles" format — show confirmation then import ---
    return await importAllProfilesEncrypted(rawText, encryptionPassword);
}

// Handle conflict resolution for an encrypted single-profile import.
// initialResult is either the new profile ID (already imported) or 'skipped' (conflict).
async function handleEncryptedSingleProfileImport(rawText, encryptionPassword, initialResult) {
    try {
        if (initialResult === 'skipped') {
            toastElement.classList.add('hidden');

            const action = await showProfileConflictDialog('the imported profile', 'its original group');
            if (!action) {
                debug.log('User chose to skip duplicate profile');
                return;
            }

            showToast('Importing profile...', TOAST_DURATION_LOADING);
            await invoke('import_profile', {
                data: rawText,
                targetGroupPath: null,
                duplicateAction: action,
                encryptionPassword: encryptionPassword
            });
        }
        // If not skipped, the profile was already imported by the probe call

        await loadTags();
        await loadProfiles();
        await loadGroups();
        showToast('Profile imported successfully!');
        debug.log('Encrypted profile imported successfully');
    } catch (error) {
        console.error('Failed to import encrypted profile:', error);
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
    }
}

// Handle conflict resolution for an encrypted single-group import.
async function handleEncryptedSingleGroupImport(rawText, encryptionPassword, initialResult) {
    try {
        if (initialResult === 'skipped') {
            toastElement.classList.add('hidden');

            const action = await showGroupConflictDialog('the imported group', 'its original location');
            if (!action) {
                debug.log('User chose to skip duplicate group');
                return;
            }

            showToast('Importing group...', TOAST_DURATION_LOADING);
            await invoke('import_group', {
                data: rawText,
                parentGroupPath: null,
                duplicateAction: action,
                encryptionPassword: encryptionPassword
            });
        }

        await loadTags();
        await loadProfiles();
        await loadGroups();
        showToast('Group imported successfully!');
        debug.log('Encrypted group imported successfully');
    } catch (error) {
        console.error('Failed to import encrypted group:', error);
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
    }
}

// Import all profiles from an encrypted export — shows the existing confirmation dialog first.
async function importAllProfilesEncrypted(rawText, encryptionPassword) {
    try {
        closeSettings();

        if (profiles.length > 0) {
            toastElement.classList.add('hidden');

            const existingCount = profiles.length;
            const profileText = existingCount === 1 ? 'profile' : 'profiles';
            const groupCount = groups.length;
            const groupText = groupCount === 1 ? 'group' : 'groups';

            const segments = groupCount > 0
                ? [
                    { text: 'You currently have ' },
                    { highlight: `${existingCount} ${profileText}` },
                    { text: ' and ' },
                    { highlight: `${groupCount} ${groupText}` },
                    { text: '.' }
                  ]
                : [
                    { text: 'You currently have ' },
                    { highlight: `${existingCount} ${profileText}` },
                    { text: '.' }
                  ];

            const confirmMessage = buildConfirmMessage({
                lines: [{ segments }],
                warnings: [
                    'Importing will override all existing profiles and groups.'
                ],
                question: 'Are you sure you want to import?'
            });

            const confirmImport = await customConfirm(confirmMessage, {
                title: 'Confirm Import',
                okText: 'Import',
                cancelText: 'Cancel',
                okClass: 'btn-danger'
            });

            if (!confirmImport) {
                debug.log('User cancelled encrypted import');
                return;
            }
        }

        showToast('Importing profiles...', TOAST_DURATION_LOADING, 'loading');
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        await invoke('import_profiles', {
            data: rawText,
            encryptionPassword: encryptionPassword
        });

        await loadTags();
        await loadProfiles();
        await loadGroups();
        showToast('Profiles imported successfully!');
        debug.log('Encrypted profiles imported successfully');
        return null;
    } catch (error) {
        if (isCryptoError(error)) {
            // Hide decryption toast before returning error
            toastElement.classList.add('hidden');
            return cleanErrorMessage(error);
        }
        console.error('Failed to import encrypted profiles:', error);
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
        return null;
    }
}

// Import all profiles (full replacement)
async function importAllProfiles(data) {
    try {
        // Check export format compatibility
        const compatibility = checkExportCompatibility(data);
        if (!compatibility.compatible) {
            showToast(`Incompatible export format:\n\n${compatibility.message}`, TOAST_DURATION_LONG, 'error');
            return;
        }

        // Perform migration if needed
        if (compatibility.requiresMigration) {
            const exportFormatVersion = data.export_format_version || data.exportFormatVersion || '1.0';

            // Show migration info toast
            if (compatibility.message) {
                showToast(compatibility.message, TOAST_DURATION_LONG);
                // Wait a moment for user to see the message
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Migrate based on source format
            if (exportFormatVersion === '1.0') {
                data = migrateExportFormat_1_0_to_2_0(data);
                showToast('Migration complete. Proceeding with import...', TOAST_DURATION_SHORT);
            }
        } else if (compatibility.message) {
            // Show info for newer minor versions (compatible but may have unknown features)
            showToast(compatibility.message, TOAST_DURATION_LONG);
            await new Promise(resolve => setTimeout(resolve, 1500));
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
            const profileText = existingCount === 1 ? 'profile' : 'profiles';

            const groupCount = groups.length;
            const groupText = groupCount === 1 ? 'group' : 'groups';

            // Build message with both profile and group counts highlighted
            const segments = groupCount > 0
                ? [
                    { text: 'You currently have ' },
                    { highlight: `${existingCount} ${profileText}` },
                    { text: ' and ' },
                    { highlight: `${groupCount} ${groupText}` },
                    { text: '.' }
                  ]
                : [
                    { text: 'You currently have ' },
                    { highlight: `${existingCount} ${profileText}` },
                    { text: '.' }
                  ];

            const confirmMessage = buildConfirmMessage({
                lines: [{ segments }],
                warnings: [
                    'Importing will override all existing profiles and groups.'
                ],
                question: 'Are you sure you want to import?'
            });

            const confirmImport = await customConfirm(confirmMessage, {
                title: 'Confirm Import',
                okText: 'Import',
                cancelText: 'Cancel',
                okClass: 'btn-danger' // Red button for destructive action
            });

            if (!confirmImport) {
                debug.log('User cancelled import');
                return;
            }
        }

        // Show importing feedback
        showToast('Importing profiles...', TOAST_DURATION_LOADING);

        // Import profiles via backend (fixed bug: use JSON.stringify on data, not text)
        await invoke('import_profiles', { data: JSON.stringify(data) });

        // Reload profiles, groups, and tags
        await loadTags(); // Load tags first so colors are available
        await loadProfiles();
        await loadGroups();

        const count = data.profiles?.length || 0;
        const message = count === 1
            ? 'Successfully imported 1 profile!'
            : `Successfully imported ${count} profiles!`;
        showToast(message);
        debug.log('Profiles imported successfully');
    } catch (error) {
        console.error('Failed to import profiles:', error);
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
    }
}

// Import single profile with conflict resolution
async function importSingleProfile(data) {
    try {
        // Check compatibility and migrate if needed
        const compatibility = checkExportCompatibility(data);
        if (!compatibility.compatible) {
            showToast(`Incompatible export format:\n\n${compatibility.message}`, TOAST_DURATION_LONG, 'error');
            return;
        }

        // Perform migration if needed
        if (compatibility.requiresMigration) {
            const exportFormatVersion = data.export_format_version || data.exportFormatVersion || '1.0';
            if (compatibility.message) {
                showToast(compatibility.message, TOAST_DURATION_LONG);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            if (exportFormatVersion === '1.0') {
                data = migrateExportFormat_1_0_to_2_0(data);
                showToast('Migration complete. Proceeding with import...', TOAST_DURATION_SHORT);
            }
        }

        // Validate structure
        if (!data.profile || typeof data.profile !== 'object') {
            showToast('Invalid profile file: Missing profile data', TOAST_DURATION_LONG, 'error');
            return;
        }

        // Close settings modal
        closeSettings();

        // Use group_path from export data (preserve original location)
        const targetGroupPath = data.profile.group_path || null;

        // Try import with "skip" to detect conflicts
        showToast('Checking for conflicts...', TOAST_DURATION_LOADING);

        let result = await invoke('import_profile', {
            data: JSON.stringify(data),
            targetGroupPath: targetGroupPath,
            duplicateAction: 'skip'
        });

        // Handle conflict
        if (result === 'skipped') {
            toastElement.classList.add('hidden');

            const profileName = data.profile.name;
            const groupName = targetGroupPath || 'Top Level';

            const action = await showProfileConflictDialog(profileName, groupName);

            if (!action) {
                debug.log('User chose to skip duplicate profile');
                return;
            }

            // Retry with chosen action
            showToast('Importing profile...', TOAST_DURATION_LOADING);
            result = await invoke('import_profile', {
                data: JSON.stringify(data),
                targetGroupPath: targetGroupPath,
                duplicateAction: action
            });
        }

        // Reload profiles, groups, and tags
        await loadTags(); // Load tags first so colors are available
        await loadProfiles();
        await loadGroups();

        showToast('Profile imported successfully!');
        debug.log('Profile imported successfully');
    } catch (error) {
        console.error('Failed to import profile:', error);
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
    }
}

// Import single group with conflict resolution
async function importSingleGroup(data) {
    try {
        // Check compatibility and migrate if needed
        const compatibility = checkExportCompatibility(data);
        if (!compatibility.compatible) {
            showToast(`Incompatible export format:\n\n${compatibility.message}`, TOAST_DURATION_LONG, 'error');
            return;
        }

        // Perform migration if needed
        if (compatibility.requiresMigration) {
            const exportFormatVersion = data.export_format_version || data.exportFormatVersion || '1.0';
            if (compatibility.message) {
                showToast(compatibility.message, TOAST_DURATION_LONG);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            if (exportFormatVersion === '1.0') {
                data = migrateExportFormat_1_0_to_2_0(data);
                showToast('Migration complete. Proceeding with import...', TOAST_DURATION_SHORT);
            }
        }

        // Validate structure
        if (!data.group || typeof data.group !== 'object') {
            showToast('Invalid group file: Missing group data', TOAST_DURATION_LONG, 'error');
            return;
        }

        // Close settings modal
        closeSettings();

        // Use parent_path from export data (preserve original structure)
        const parentGroupPath = data.group.parent_path || null;

        // Try import with "skip" to detect conflicts
        showToast('Checking for conflicts...', TOAST_DURATION_LOADING);

        let result = await invoke('import_group', {
            data: JSON.stringify(data),
            parentGroupPath: parentGroupPath,
            duplicateAction: 'skip'
        });

        // Handle conflict
        if (result === 'skipped') {
            toastElement.classList.add('hidden');

            const groupName = data.group.name;
            const parentName = parentGroupPath || 'Top Level';

            const action = await showGroupConflictDialog(groupName, parentName);

            if (!action) {
                debug.log('User chose to skip duplicate group');
                return;
            }

            // Retry with chosen action
            showToast('Importing group...', TOAST_DURATION_LOADING);
            result = await invoke('import_group', {
                data: JSON.stringify(data),
                parentGroupPath: parentGroupPath,
                duplicateAction: action
            });
        }

        // Reload profiles, groups, and tags
        await loadTags(); // Load tags first so colors are available
        await loadProfiles();
        await loadGroups();

        showToast('Group imported successfully!');
        debug.log('Group imported successfully');
    } catch (error) {
        console.error('Failed to import group:', error);
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
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

    const groupCount = groups.length;
    const groupText = groupCount === 1 ? 'group' : 'groups';

    // Build message with both profile and group counts highlighted
    const segments = groupCount > 0
        ? [
            { text: 'You currently have ' },
            { highlight: `${count} ${profileText}` },
            { text: ' and ' },
            { highlight: `${groupCount} ${groupText}` },
            { text: '.' }
          ]
        : [
            { text: 'You currently have ' },
            { highlight: `${count} ${profileText}` },
            { text: '.' }
          ];

    const confirmMessage = buildConfirmMessage({
        lines: [{ segments }],
        warnings: [
            'This will permanently delete all profiles, groups, and stored passwords.'
        ],
        question: 'Are you sure you want to delete everything?'
    });

    const confirmed = await customConfirm(confirmMessage, {
        title: 'Delete All Profiles & Groups',
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
        showToast('Deleting...', TOAST_DURATION_LOADING);

        // Delete all profiles first
        for (const profile of profiles) {
            await invoke('delete_profile', { id: profile.id });
        }

        // Delete only top-level groups (CASCADE will handle children)
        const topLevelGroups = groups.filter(g => !g.parent_id);

        for (const group of topLevelGroups) {
            await invoke('delete_group', {
                input: {
                    id: group.id,
                    delete_profiles: false // Profiles already deleted above
                }
            });
        }

        await loadProfiles();
        await loadGroups();
        showToast('All profiles and groups deleted successfully!');
        debug.log('All profiles and groups deleted');
    } catch (error) {
        console.error('Failed to delete all profiles and groups:', error);
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
    }
}

// Delete all tags
async function deleteAllTags() {
    if (allTags.length === 0) {
        showToast('No tags to delete!', TOAST_DURATION_SHORT, 'error');
        return;
    }

    const count = allTags.length;
    const tagText = count === 1 ? 'tag' : 'tags';

    // Count profiles affected by tags
    let affectedProfiles = new Set();
    for (const profile of profiles) {
        if (profile.tags && profile.tags.length > 0) {
            affectedProfiles.add(profile.id);
        }
    }
    const profileCount = affectedProfiles.size;

    // Build message
    const segments = profileCount > 0
        ? [
            { text: 'You currently have ' },
            { highlight: `${count} ${tagText}` },
            { text: ' assigned to ' },
            { highlight: `${profileCount} ${profileCount === 1 ? 'profile' : 'profiles'}` },
            { text: '.' }
          ]
        : [
            { text: 'You currently have ' },
            { highlight: `${count} ${tagText}` },
            { text: '.' }
          ];

    const confirmMessage = buildConfirmMessage({
        lines: [{ segments }],
        warnings: [
            'This will permanently delete all tags and remove them from all profiles.'
        ],
        question: 'Are you sure you want to delete all tags?'
    });

    const confirmed = await customConfirm(confirmMessage, {
        title: 'Delete All Tags',
        okText: 'Delete All',
        cancelText: 'Cancel',
        okClass: 'btn-danger'
    });

    if (!confirmed) {
        debug.log('User cancelled delete all tags');
        return;
    }

    // Close settings modal after confirmation
    closeSettings();

    try {
        showToast('Deleting tags...', TOAST_DURATION_LOADING);

        // Delete all tags (CASCADE will handle profile_tags)
        for (const tag of allTags) {
            await invoke('delete_tag', { tagId: tag.id });
        }

        await loadTags();
        await loadProfiles();
        showToast('All tags deleted successfully!');
        debug.log('All tags deleted');
    } catch (error) {
        console.error('Failed to delete all tags:', error);
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
    }
}

// Backup settings to JSON file
async function backupSettings() {
    try {
        const theme = localStorage.getItem('theme') || 'system';
        const autoUpdateCheck = localStorage.getItem('autoUpdateCheck') === 'true';
        const includeProfiles = includeProfilesCheck.checked;
        const windowWidth = parseInt(localStorage.getItem('windowWidth') || '800');
        const windowHeight = parseInt(localStorage.getItem('windowHeight') || '600');
        const recentConnectionsLimit = getRecentConnectionsLimit();

        // Always include terminal preference (OS-specific setting, will be tagged with OS)
        const terminalPreference = localStorage.getItem('terminalPreference') || 'default';
        const useTabsInTerminal = localStorage.getItem('useTabsInTerminal') !== 'false'; // Default to true
        const minimizeOnLaunch = localStorage.getItem('minimizeOnLaunch') !== 'false'; // Default to true

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

        // Get Profile Management settings for encryption
        const includePasswordsInExports = localStorage.getItem('includePasswords') !== 'false';
        const requireEncryptionForAllExports = localStorage.getItem('requireEncryption') === 'true';

        // Determine encryption state if backup includes profiles
        let encryptionPassword = null;
        if (includeProfiles) {
            const encryptionState = determineEncryptionState(profiles);
            encryptionPassword = await openEncryptionPasswordModal(encryptionState);

            // Handle modal return: undefined = cancelled, null = no encryption, string = password
            if (encryptionPassword === undefined) return; // User cancelled
        }

        showToast('Backing up settings...', TOAST_DURATION_LOADING, encryptionPassword ? 'loading' : 'success');
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        const data = await invoke('export_settings', {
            theme,
            autoUpdateCheck,
            recentConnectionsLimit,
            filteredGroups,
            collapsedGroups,
            includePasswordsInExports,
            requireEncryptionForAllExports,
            terminalPreference: terminalPreference,
            useTabsInTerminal: useTabsInTerminal,
            minimizeOnLaunch: minimizeOnLaunch,
            includeProfiles,
            includePasswords,
            encryptionPassword: encryptionPassword,
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
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
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

        // Route encrypted and plain restores separately
        let result;
        if (data.encrypted === true) {
            toastElement.classList.add('hidden');
            const password = await openDecryptionPasswordModal(async (pw) => {
                try {
                    result = await invoke('import_settings', { data: text, encryptionPassword: pw });
                    return null; // Success
                } catch (error) {
                    if (isCryptoError(error)) return cleanErrorMessage(error);
                    throw error; // Non-crypto error — bubbles to modal's catch
                }
            });
            if (password === null) {
                // User cancelled - ensure toast is hidden
                toastElement.classList.add('hidden');
                return;
            }
            closeSettings();
        } else {
            // Validate the JSON structure (only for non-encrypted data)
            const validation = validateSettingsRestoreData(data);
            if (!validation.valid) {
                showToast(`Invalid settings file: ${validation.error}`, TOAST_DURATION_LONG, 'error');
                return;
            }

            closeSettings();

            showToast('Restoring settings...', TOAST_DURATION_LOADING);
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

            result = await invoke('import_settings', { data: text, encryptionPassword: null });
        }
        const includesProfiles = result.profiles && result.profiles.length > 0;

        // Check if backup OS matches current OS (encrypted backups can't be inspected client-side)
        const backupOS = data.encrypted ? getOS() : (data.os || 'unknown');
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
                const importProfileCount = result.profiles.length;
                const profileText = importProfileCount === 1 ? 'profile' : 'profiles';

                // Count groups in the backup
                const importGroupCount = result.groups ? result.groups.length : 0;
                const groupText = importGroupCount === 1 ? 'group' : 'groups';

                // Build message with both profile and group counts highlighted
                const segments = importGroupCount > 0
                    ? [
                        { text: 'This backup contains ' },
                        { highlight: `${importProfileCount} ${profileText}` },
                        { text: ' and ' },
                        { highlight: `${importGroupCount} ${groupText}` },
                        { text: '.' }
                      ]
                    : [
                        { text: 'This backup contains ' },
                        { highlight: `${importProfileCount} ${profileText}` },
                        { text: '.' }
                      ];

                lines.push({ segments });
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
                okClass: 'btn-danger' // Red button for destructive action
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

            // Restore minimize_on_launch if present (default to true if not specified)
            const minimizeOnLaunch = result.settings_os_specific.minimize_on_launch !== false;
            localStorage.setItem('minimizeOnLaunch', minimizeOnLaunch.toString());
        } else {
            // No OS-specific settings in backup (different OS or old format) - use defaults
            localStorage.setItem('terminalPreference', 'default');
            localStorage.setItem('useTabsInTerminal', 'true');
            localStorage.setItem('minimizeOnLaunch', 'true');
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
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
    }
}

// Reset all settings to defaults
async function resetSettings() {
    try {
        const confirmMessage = buildConfirmMessage({
            warnings: ['This will reset all settings to their default values.'],
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
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
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
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
    }
}

// Open modal for new or edit profile
async function openModal(profile = null) {
    debug.log('openModal called with profile:', profile);
    editingProfileId = profile ? profile.id : null;

    // Close any open menus and popups
    closeAllProfileActionMenus();
    closeAllGroupMenus();
    closeFilterPopup();

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

        // Set group display and path fields
        if (profile.group_path) {
            const group = groups.find(g => g.path === profile.group_path);
            if (group) {
                document.getElementById('profile-group').value = formatGroupPathDisplay(group.path);
                document.getElementById('profile-group-id').value = group.id;
            } else {
                document.getElementById('profile-group').value = '';
                document.getElementById('profile-group-id').value = '';
            }
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

        // Set icon for editing
        const profileIcon = profile.icon || '';
        document.getElementById('profile-icon').value = profileIcon;
        document.getElementById('profile-icon-value').value = profileIcon;
        updateIconInputDisplay(profileIcon);

        // Set favorite checkbox
        document.getElementById('profile-favorite-checkbox').checked = profile.is_favorite || false;

        // Load profile tags
        await loadProfileTags(profile.id);

        deleteProfileBtn.classList.remove('hidden');
    } else {
        modalTitle.textContent = 'New Profile';
        profileForm.reset();
        document.getElementById('profile-port').value = 22;
        document.getElementById('profile-auth-method').value = 'none';
        // Set default group to Ungrouped (empty values)
        document.getElementById('profile-group').value = '';
        document.getElementById('profile-group-id').value = '';
        // Reset icon to empty for new profile
        document.getElementById('profile-icon').value = '';
        document.getElementById('profile-icon-value').value = '';
        updateIconInputDisplay('');
        // Reset favorite checkbox for new profile
        document.getElementById('profile-favorite-checkbox').checked = false;
        // Reset tags for new profile
        selectedProfileTags = new Set();
        renderSelectedTags();
        deleteProfileBtn.classList.add('hidden');
    }

    updateAuthMethodVisibility();
    profileModal.classList.remove('hidden');
    pushModal('profile');

    // Reset scroll position (both vertical and horizontal)
    const modalContent = profileModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.scrollTop = 0;
        modalContent.scrollLeft = 0;
    }

    // Initialize character counters based on current field values
    initializeCharCounters();

    // Auto-resize description textarea if it has content
    const descriptionTextarea = document.getElementById('profile-description');
    if (descriptionTextarea) {
        autoResizeTextarea(descriptionTextarea);
    }

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
        group: document.getElementById('profile-group-id').value, // Use hidden field for group ID
        icon: document.getElementById('profile-icon-value').value, // Icon selection
        favorite: document.getElementById('profile-favorite-checkbox').checked, // Favorite status
        tags: Array.from(selectedProfileTags).sort().join(',') // Convert Set to sorted string for comparison
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

    // Check if any field has a validation error
    const fieldsToValidate = [
        'profile-name', 'profile-description', 'profile-host',
        'profile-port', 'profile-username'
    ];

    const hasValidationError = fieldsToValidate.some(fieldId => {
        const field = document.getElementById(fieldId);
        return field && field.classList.contains('validation-error');
    });

    // If creating a new profile, enable Save only when required fields are populated AND valid
    if (!editingProfileId) {
        profileSaveBtn.disabled = !requiredFieldsPopulated || hasValidationError;
        return;
    }

    // For editing: check both required fields AND changes
    // Compare current values with original values
    const currentValues = getCurrentFormValues();

    // Check if any field has changed
    const hasChanged = Object.keys(originalFormValues).some(key =>
        currentValues[key] !== originalFormValues[key]
    );

    // Enable Save only if required fields are populated AND something changed AND no validation errors
    profileSaveBtn.disabled = !requiredFieldsPopulated || !hasChanged || hasValidationError;
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
    const parentId = document.getElementById('group-parent-id').value || null;

    // Group name is required
    if (!groupName) {
        groupSaveBtn.disabled = true;
        return;
    }

    // Check if field has validation error (red border)
    const hasValidationError = groupNameInput.classList.contains('validation-error');
    if (hasValidationError) {
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
    popModal('profile');
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

// ============================================================================
// ICON DROPDOWN FUNCTIONS
// ============================================================================

// Icon dropdown state
let profileIconDropdownVisible = false;
let focusedIconDropdownIndex = -1;
let filteredIconOptions = [];

// Show icon dropdown with filtering
function showProfileIconDropdown(filterText = '') {
    const profileIconInput = document.getElementById('profile-icon');
    const profileIconDropdown = document.getElementById('profile-icon-dropdown');
    if (!profileIconInput || !profileIconDropdown) return;

    // Get all icon names, filter by visibility, and sort alphabetically
    const iconNames = Object.keys(PROFILE_ICONS)
        .filter(iconName => PROFILE_ICON_VISIBILITY[iconName] !== false)
        .sort();

    // Filter icons based on input
    const normalizedFilter = filterText.toLowerCase().trim();
    filteredIconOptions = iconNames.filter(iconName =>
        iconName.toLowerCase().includes(normalizedFilter)
    );

    // Build dropdown HTML
    let html = '';
    if (filteredIconOptions.length === 0) {
        html = '<div class="searchable-dropdown-empty">No icons found</div>';
    } else {
        const currentIconValue = document.getElementById('profile-icon-value').value;
        filteredIconOptions.forEach((iconName, index) => {
            const isSelected = iconName === currentIconValue;
            const iconSvg = createIcon(iconName, 18, 'dropdown-icon-preview');
            html += `
                <div class="searchable-dropdown-item icon-dropdown-item ${isSelected ? 'selected' : ''}"
                     data-icon-name="${iconName}"
                     data-index="${index}">
                    <span class="dropdown-icon-wrapper">${iconSvg.outerHTML}</span>
                    <span class="dropdown-icon-label">${escapeHtml(iconName)}</span>
                </div>
            `;
        });
    }

    profileIconDropdown.innerHTML = html;
    profileIconDropdown.classList.remove('hidden');
    profileIconDropdownVisible = true;
    focusedIconDropdownIndex = -1;

    // Attach click handlers
    profileIconDropdown.querySelectorAll('.icon-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const iconName = e.currentTarget.dataset.iconName;
            selectProfileIcon(iconName);
        });
    });
}

// Hide icon dropdown
function hideProfileIconDropdown() {
    const profileIconDropdown = document.getElementById('profile-icon-dropdown');
    if (profileIconDropdown) {
        profileIconDropdown.classList.add('hidden');
        profileIconDropdownVisible = false;
        focusedIconDropdownIndex = -1;
    }
}

// Update the icon display in the input field
function updateIconInputDisplay(iconName) {
    const iconDisplay = document.getElementById('profile-icon-display');
    const iconWrapper = document.querySelector('.icon-input-wrapper');

    if (!iconDisplay || !iconWrapper) return;

    // Clear previous icon
    iconDisplay.innerHTML = '';

    if (iconName) {
        // Show selected icon
        const iconSvg = createIcon(iconName, 18, 'selected-icon');
        iconDisplay.appendChild(iconSvg);
        iconWrapper.classList.add('has-icon');
    } else {
        // No icon selected
        iconWrapper.classList.remove('has-icon');
    }
}

// Select icon from dropdown
async function selectProfileIcon(iconName) {
    const profileIconInput = document.getElementById('profile-icon');
    const profileIconValueInput = document.getElementById('profile-icon-value');

    // Update UI
    profileIconInput.value = iconName;
    profileIconValueInput.value = iconName;

    // Update icon display
    updateIconInputDisplay(iconName);

    hideProfileIconDropdown();

    // If editing an existing profile, save to backend immediately
    if (editingProfileId) {
        try {
            await invoke('update_profile_icon', {
                profileId: editingProfileId,
                icon: iconName
            });

            // Update local profiles array
            const profile = profiles.find(p => p.id === editingProfileId);
            if (profile) {
                profile.icon = iconName;
            }

            // Reload profiles to show updated icon
            await loadProfiles();
        } catch (err) {
            showToast(`Failed to update icon: ${err}`, TOAST_DURATION_LONG, 'error');
        }
    }

    checkFormChanged();
}

// Handle keyboard navigation in icon dropdown
function handleProfileIconKeydown(e) {
    if (!profileIconDropdownVisible) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            const profileIconInput = document.getElementById('profile-icon');
            showProfileIconDropdown(profileIconInput.value);
        }
        return;
    }

    const items = document.querySelectorAll('#profile-icon-dropdown .icon-dropdown-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusedIconDropdownIndex = Math.min(focusedIconDropdownIndex + 1, items.length - 1);
        updateFocusedIconDropdownItem(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusedIconDropdownIndex = Math.max(focusedIconDropdownIndex - 1, -1);
        if (focusedIconDropdownIndex === -1) {
            // Back to input
            const profileIconInput = document.getElementById('profile-icon');
            profileIconInput.focus();
            items.forEach(item => item.classList.remove('focused'));
        } else {
            updateFocusedIconDropdownItem(items);
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedIconDropdownIndex >= 0 && focusedIconDropdownIndex < items.length) {
            const iconName = items[focusedIconDropdownIndex].dataset.iconName;
            selectProfileIcon(iconName);
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        hideProfileIconDropdown();
        const profileIconInput = document.getElementById('profile-icon');
        profileIconInput.focus();
    }
}

// Update visual focus indicator for icon dropdown
function updateFocusedIconDropdownItem(items) {
    items.forEach((item, index) => {
        if (index === focusedIconDropdownIndex) {
            item.classList.add('focused');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('focused');
        }
    });
}

// ============================================================================
// END ICON DROPDOWN FUNCTIONS
// ============================================================================

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

    // Get actual group path from group ID (not the formatted display value)
    // This is used for both duplicate checking and saving
    const selectedGroupId = document.getElementById('profile-group-id').value;
    let selectedGroupPath = null;
    if (selectedGroupId) {
        const selectedGroup = groups.find(g => g.id === selectedGroupId);
        selectedGroupPath = selectedGroup ? selectedGroup.path : null;
    }

    // Check for duplicate names within the same group (case-insensitive)
    // Profile names must be unique within their group (allows same name in different groups)
    const duplicateProfile = profiles.find(p =>
        p.name.toLowerCase() === profileName.toLowerCase() &&
        p.group_path === selectedGroupPath &&
        p.id !== editingProfileId
    );

    if (duplicateProfile) {
        const groupContext = selectedGroupPath
            ? `in this group`
            : `at the root level`;
        showToast(`A profile named "${profileName}" already exists ${groupContext}. Please choose a different name.`, TOAST_DURATION_LONG, 'error');
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
        group_path: selectedGroupPath // Use actual path from group object, not formatted display
    };

    try {
        // Capture whether we're editing or creating before closeModal resets editingProfileId
        const isEditing = !!editingProfileId;
        const isFavorite = document.getElementById('profile-favorite-checkbox').checked;

        let savedProfileId;
        if (editingProfileId) {
            debug.log('Updating profile:', profileData);
            await invoke('update_profile', { profile: profileData });
            savedProfileId = editingProfileId;
        } else {
            debug.log('Creating profile:', profileData);
            savedProfileId = await invoke('create_profile', { profile: profileData });
        }

        // Set favorite status
        await invoke('set_profile_favorite', { profileId: savedProfileId, isFavorite });

        // Save tags
        await invoke('set_profile_tags', {
            profileId: savedProfileId,
            tagIds: Array.from(selectedProfileTags)
        });

        await loadProfiles();
        forceCloseModal(); // Force close without confirmation after successful save
        showToast(isEditing ? 'Profile updated successfully!' : 'Profile created successfully!');
    } catch (error) {
        console.error('Failed to save profile:', error);
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
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

    // Set group (both visible select and hidden ID field)
    const groupPath = duplicatedProfile.group_path || '';
    document.getElementById('profile-group').value = groupPath;
    // Find group ID from path and set hidden field
    if (groupPath) {
        const group = groups.find(g => g.path === groupPath);
        if (group) {
            document.getElementById('profile-group-id').value = group.id;
        } else {
            document.getElementById('profile-group-id').value = '';
        }
    } else {
        document.getElementById('profile-group-id').value = '';
    }

    // Set icon for duplicated profile
    const profileIcon = duplicatedProfile.icon || '';
    document.getElementById('profile-icon').value = profileIcon;
    document.getElementById('profile-icon-value').value = profileIcon;
    updateIconInputDisplay(profileIcon);

    // Set favorite checkbox
    document.getElementById('profile-favorite-checkbox').checked = duplicatedProfile.is_favorite || false;

    // C-3 FIX: Copy tags from the original profile (convert tag names to tag IDs)
    // duplicatedProfile.tags contains tag names, but selectedProfileTags needs tag IDs
    const tagNames = duplicatedProfile.tags || [];
    const tagIds = tagNames.map(tagName => {
        const tag = allTags.find(t => t.name === tagName);
        return tag ? tag.id : null;
    }).filter(id => id !== null); // Remove any null values if tag not found
    selectedProfileTags = new Set(tagIds);
    renderSelectedTags();

    updateAuthMethodVisibility();

    // Initialize character counters
    initializeCharCounters();

    // Capture form values as baseline so no changes are detected yet
    captureFormValues();

    // Disable save button until user makes a change
    profileSaveBtn.disabled = true;

    profileModal.classList.remove('hidden');
    pushModal('profile');

    // Reset scroll position (both vertical and horizontal)
    const modalContent = profileModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.scrollTop = 0;
        modalContent.scrollLeft = 0;
    }
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
            {
                segments: [
                    { text: 'Delete profile ' },
                    { highlight: profile.name }
                ]
            }
        ],
        question: 'Are you sure you want to delete this profile?'
    });

    const confirmDelete = await customConfirm(confirmMessage, {
        title: 'Delete Profile',
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
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
        return false;
    }
}

// ========== Group Management Functions ==========

// Open group modal for creating or editing a group
async function openGroupModal(group = null, preselectedParentId = null) {
    debug.log('openGroupModal called with group:', group, 'preselectedParentId:', preselectedParentId);
    editingGroupId = group ? group.id : null;
    currentExcludeGroupId = editingGroupId; // Store for parent group dropdown filtering

    // Close any open menus and popups
    closeAllProfileActionMenus();
    closeAllGroupMenus();
    closeFilterPopup();

    // Populate parent group dropdown FIRST
    populateParentGroupSelect(editingGroupId);

    const parentGroupInput = document.getElementById('group-parent');
    const parentGroupIdInput = document.getElementById('group-parent-id');

    if (group) {
        groupModalTitle.textContent = 'Edit Group';
        groupNameInput.value = group.name;

        // Set parent group value
        const parentId = group.parent_id || '';
        parentGroupIdInput.value = parentId;
        if (parentId) {
            const parentGroup = groups.find(g => g.id === parentId);
            parentGroupInput.value = parentGroup ? formatGroupPathDisplay(parentGroup.path) : '';
        } else {
            parentGroupInput.value = '';
        }
    } else {
        groupModalTitle.textContent = preselectedParentId ? 'New Subgroup' : 'New Group';
        groupForm.reset();

        // Set parent group value
        parentGroupIdInput.value = preselectedParentId || '';
        if (preselectedParentId) {
            const parentGroup = groups.find(g => g.id === preselectedParentId);
            parentGroupInput.value = parentGroup ? formatGroupPathDisplay(parentGroup.path) : '';
        } else {
            parentGroupInput.value = '';
        }
    }

    groupModal.classList.remove('hidden');
    pushModal('group');

    // Safety net: clear any padding left over from a previous dropdown auto-scroll
    // (normally cleaned up by hideParentGroupDropdown, but guards against edge cases)
    const groupFormEl = groupModal.querySelector('form');
    if (groupFormEl) {
        groupFormEl.style.paddingBottom = '';
        delete groupFormEl.dataset.originalPaddingBottom;
    }

    // Reset scroll position (both vertical and horizontal)
    const modalContent = groupModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.scrollTop = 0;
        modalContent.scrollLeft = 0;
    }

    // Clear any previous validation errors
    groupNameInput.classList.remove('validation-error');

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

// Format group path for display with spaces around separators
// Example: "Group/SubGroup1/SubGroup2" → "Group / SubGroup1 / SubGroup2"
// Note: This is purely visual - underlying path structure remains unchanged
function formatGroupPathDisplay(path) {
    if (!path) return path;
    return path.replace(/\//g, ' / ');
}

// Show parent group searchable dropdown
// excludeGroupId: Exclude this group from the list (used when editing to prevent circular reference)
function showParentGroupDropdown(filterText = '', excludeGroupId = null) {
    const parentGroupInput = document.getElementById('group-parent');
    const parentGroupDropdown = document.getElementById('group-parent-dropdown');
    if (!parentGroupInput || !parentGroupDropdown) return;

    // Use provided excludeGroupId or fall back to currentExcludeGroupId
    const excludeId = excludeGroupId !== null ? excludeGroupId : currentExcludeGroupId;

    // Sort groups by path (hierarchical)
    const sortedGroups = [...groups].sort((a, b) => a.path.localeCompare(b.path));

    // Normalize filter text by removing spaces around slashes for comparison
    // This allows users to type either "Group/Sub" or "Group / Sub" and find matches
    const normalizedFilter = filterText.replace(/\s*\/\s*/g, '/').toLowerCase();

    // Filter groups based on input and exclude specified group (to prevent circular reference)
    filteredParentGroupOptions = sortedGroups.filter(g => {
        if (g.id === excludeId) return false; // Exclude current group when editing
        return g.path.toLowerCase().includes(normalizedFilter);
    });

    // Add "Top Level" option at the beginning
    filteredParentGroupOptions.unshift({ id: '', name: 'Top Level', path: '-- Top Level --' });

    // Build dropdown HTML
    let html = '';
    if (filteredParentGroupOptions.length === 1) { // Only "Top Level" option
        html = '<div class="searchable-dropdown-empty">No groups found</div>';
    } else {
        const currentParentId = document.getElementById('group-parent-id').value;
        filteredParentGroupOptions.forEach((group, index) => {
            const isSelected = group.id === currentParentId;
            const displayText = group.id === '' ? group.path : formatGroupPathDisplay(group.path);
            html += `
                <div class="searchable-dropdown-item ${isSelected ? 'selected' : ''}"
                     data-group-id="${group.id}"
                     data-index="${index}">
                    ${escapeHtml(displayText)}
                </div>
            `;
        });
    }

    parentGroupDropdown.innerHTML = html;
    parentGroupDropdown.classList.remove('hidden');
    parentGroupDropdownVisible = true;
    focusedParentDropdownIndex = -1;

    // Attach click handlers
    parentGroupDropdown.querySelectorAll('.searchable-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const groupId = e.currentTarget.dataset.groupId;
            const group = filteredParentGroupOptions.find(g => g.id === groupId);
            selectParentGroup(group);
        });
    });

    // Auto-scroll modal to show dropdown — guarded with a stored handle so that
    // hideParentGroupDropdown() can cancel it before it fires (prevents phantom padding)
    if (parentGroupScrollTimeout !== null) {
        clearTimeout(parentGroupScrollTimeout);
    }
    parentGroupScrollTimeout = setTimeout(() => {
        parentGroupScrollTimeout = null;
        // Guard: if the dropdown was hidden before the timeout fired, do nothing
        if (parentGroupDropdown.classList.contains('hidden')) return;

        // Find the scrollable container (form element for profile/group modals)
        const scrollContainer = parentGroupDropdown.closest('form') || parentGroupDropdown.closest('.modal-content');
        if (!scrollContainer) return;

        const dropdownRect = parentGroupDropdown.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const desiredPadding = 20;
        const dropdownOverflow = dropdownRect.bottom - containerRect.bottom;

        if (dropdownOverflow > -desiredPadding) {
            // Calculate the current padding-bottom (might be from CSS)
            const computedStyle = window.getComputedStyle(scrollContainer);
            const currentPadding = parseInt(computedStyle.paddingBottom) || 0;

            // Add temporary padding to container so there's room to scroll
            const paddingNeeded = currentPadding + Math.abs(dropdownOverflow) + desiredPadding;
            const originalPaddingBottom = scrollContainer.style.paddingBottom;
            scrollContainer.style.paddingBottom = `${paddingNeeded}px`;
            scrollContainer.dataset.originalPaddingBottom = originalPaddingBottom;

            setTimeout(() => {
                const scrollNeeded = Math.abs(dropdownOverflow) + desiredPadding;
                scrollContainer.scrollBy({
                    top: scrollNeeded,
                    behavior: 'smooth'
                });
            }, 10);
        }
    }, 50);
}

function hideParentGroupDropdown() {
    // Cancel any pending auto-scroll timeout so it can't add phantom padding after hide
    if (parentGroupScrollTimeout !== null) {
        clearTimeout(parentGroupScrollTimeout);
        parentGroupScrollTimeout = null;
    }

    const parentGroupDropdown = document.getElementById('group-parent-dropdown');
    if (parentGroupDropdown) {
        parentGroupDropdown.classList.add('hidden');
        parentGroupDropdownVisible = false;
        focusedParentDropdownIndex = -1;

        // Restore original container padding if we modified it
        const scrollContainer = parentGroupDropdown.closest('form') || parentGroupDropdown.closest('.modal-content');
        if (scrollContainer && scrollContainer.dataset.originalPaddingBottom !== undefined) {
            scrollContainer.style.paddingBottom = scrollContainer.dataset.originalPaddingBottom || '';
            delete scrollContainer.dataset.originalPaddingBottom;
        }
    }
}

function selectParentGroup(group) {
    const parentGroupInput = document.getElementById('group-parent');
    const parentGroupIdInput = document.getElementById('group-parent-id');

    if (group && group.id !== '') {
        parentGroupInput.value = formatGroupPathDisplay(group.path);
        parentGroupIdInput.value = group.id;
    } else {
        // Top Level
        parentGroupInput.value = '';
        parentGroupIdInput.value = '';
    }

    hideParentGroupDropdown();
    checkGroupFormChanged();
}

function handleParentGroupKeydown(e) {
    if (!parentGroupDropdownVisible) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            const parentGroupInput = document.getElementById('group-parent');
            showParentGroupDropdown(parentGroupInput.value);
        }
        return;
    }

    const items = document.querySelectorAll('#group-parent-dropdown .searchable-dropdown-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusedParentDropdownIndex = Math.min(focusedParentDropdownIndex + 1, items.length - 1);
        updateFocusedParentDropdownItem(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusedParentDropdownIndex = Math.max(focusedParentDropdownIndex - 1, -1);
        updateFocusedParentDropdownItem(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedParentDropdownIndex >= 0 && focusedParentDropdownIndex < filteredParentGroupOptions.length) {
            selectParentGroup(filteredParentGroupOptions[focusedParentDropdownIndex]);
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        hideParentGroupDropdown();
    }
}

function updateFocusedParentDropdownItem(items) {
    items.forEach((item, index) => {
        if (index === focusedParentDropdownIndex) {
            item.classList.add('focused');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('focused');
        }
    });
}

// Legacy function kept for backward compatibility
function populateParentGroupSelect(excludeGroupId = null) {
    // This function is now a no-op as the dropdown is populated dynamically
    // The excludeGroupId is passed to showParentGroupDropdown when needed
}

// Populate profile group searchable dropdown
let profileGroupDropdownVisible = false;
let focusedDropdownIndex = -1;
let filteredGroupOptions = [];
let profileGroupScrollTimeout = null; // Handle for pending auto-scroll timeout

// Parent group searchable dropdown state
let parentGroupDropdownVisible = false;
let focusedParentDropdownIndex = -1;
let filteredParentGroupOptions = [];
let currentExcludeGroupId = null; // For preventing circular references when editing groups
let parentGroupScrollTimeout = null; // Handle for pending auto-scroll timeout

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

    // Normalize filter text by removing spaces around slashes for comparison
    // This allows users to type either "Group/Sub" or "Group / Sub" and find matches
    const normalizedFilter = filterText.replace(/\s*\/\s*/g, '/').toLowerCase();

    // Filter groups based on input
    filteredGroupOptions = sortedGroups.filter(g =>
        g.path.toLowerCase().includes(normalizedFilter)
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
                    ${escapeHtml(formatGroupPathDisplay(group.path))}
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

    // Auto-scroll modal to show dropdown — guarded with a stored handle so that
    // hideProfileGroupDropdown() can cancel it before it fires (prevents phantom padding)
    if (profileGroupScrollTimeout !== null) {
        clearTimeout(profileGroupScrollTimeout);
    }
    profileGroupScrollTimeout = setTimeout(() => {
        profileGroupScrollTimeout = null;
        // Guard: if the dropdown was hidden before the timeout fired, do nothing
        if (profileGroupDropdown.classList.contains('hidden')) return;

        // Find the scrollable container (form element for profile/group modals)
        const scrollContainer = profileGroupDropdown.closest('form') || profileGroupDropdown.closest('.modal-content');
        if (!scrollContainer) return;

        const dropdownRect = profileGroupDropdown.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const desiredPadding = 20;
        const dropdownOverflow = dropdownRect.bottom - containerRect.bottom;

        if (dropdownOverflow > -desiredPadding) {
            // Calculate the current padding-bottom (might be from CSS)
            const computedStyle = window.getComputedStyle(scrollContainer);
            const currentPadding = parseInt(computedStyle.paddingBottom) || 0;

            // Add temporary padding to container so there's room to scroll
            const paddingNeeded = currentPadding + Math.abs(dropdownOverflow) + desiredPadding;
            const originalPaddingBottom = scrollContainer.style.paddingBottom;
            scrollContainer.style.paddingBottom = `${paddingNeeded}px`;
            scrollContainer.dataset.originalPaddingBottom = originalPaddingBottom;

            setTimeout(() => {
                const scrollNeeded = Math.abs(dropdownOverflow) + desiredPadding;
                scrollContainer.scrollBy({
                    top: scrollNeeded,
                    behavior: 'smooth'
                });
            }, 10);
        }
    }, 50);
}

function hideProfileGroupDropdown() {
    // Cancel any pending auto-scroll timeout so it can't add phantom padding after hide
    if (profileGroupScrollTimeout !== null) {
        clearTimeout(profileGroupScrollTimeout);
        profileGroupScrollTimeout = null;
    }

    const profileGroupDropdown = document.getElementById('profile-group-dropdown');
    if (profileGroupDropdown) {
        profileGroupDropdown.classList.add('hidden');
        profileGroupDropdownVisible = false;
        focusedDropdownIndex = -1;

        // Restore original container padding if we modified it
        const scrollContainer = profileGroupDropdown.closest('form') || profileGroupDropdown.closest('.modal-content');
        if (scrollContainer && scrollContainer.dataset.originalPaddingBottom !== undefined) {
            scrollContainer.style.paddingBottom = scrollContainer.dataset.originalPaddingBottom || '';
            delete scrollContainer.dataset.originalPaddingBottom;
        }
    }
}

function selectProfileGroup(group) {
    const profileGroupInput = document.getElementById('profile-group');
    const profileGroupIdInput = document.getElementById('profile-group-id');

    if (group && group.id !== '') {
        profileGroupInput.value = formatGroupPathDisplay(group.path);
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
    hideParentGroupDropdown(); // Hide dropdown and restore modal padding if needed
    groupModal.classList.add('hidden');
    popModal('group');
    editingGroupId = null;
    groupForm.reset();
}

// Save group (create or update)
async function saveGroup() {
    const groupName = groupNameInput.value.trim();

    // Validate group name using validateGroupName (64 char limit, no slashes)
    const validationResult = validateGroupName(groupName);
    if (!validationResult.valid) {
        showToast(validationResult.error, TOAST_DURATION_LONG, 'error');
        return;
    }

    const parentId = document.getElementById('group-parent-id').value || null;

    isSubmitting = true;
    groupSaveBtn.disabled = true;

    try {
        if (editingGroupId) {
            // Update existing group
            // C-2 FIX: Pass parent_id to allow moving groups via Edit Group
            await invoke('update_group', {
                input: {
                    id: editingGroupId,
                    name: groupName,
                    icon: null, // Icons will be added in Phase 4
                    parent_id: parentId
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
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
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
        const minimizeOnLaunch = localStorage.getItem('minimizeOnLaunch') !== 'false'; // Default to true

        // Route to embedded terminal or external terminal
        if (terminalPreference === 'embedded') {
            await openEmbeddedTerminal(id);
        } else {
            await invoke('connect_ssh', {
                profileId: id,
                terminalPreference: terminalPreference,
                customTerminalPath: customTerminalPath,
                useTabsInTerminal: useTabsInTerminal,
                minimizeOnLaunch: minimizeOnLaunch
            });
        }

        // Reload recent connections after successful connection
        await loadRecentConnections();
    } catch (error) {
        console.error('Failed to connect:', error);
        showToast(cleanErrorMessage(error), TOAST_DURATION_LONG, 'error');
    }
}

// Utility: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Utility: Clean up error messages to be more user-friendly
function cleanErrorMessage(error) {
    let errorStr = String(error);

    // Handle UNIQUE constraint errors with user-friendly messages
    if (errorStr.includes('UNIQUE constraint failed: index \'idx_groups_unique_name_parent\'') ||
        errorStr.includes('UNIQUE constraint') && errorStr.includes('groups')) {
        return 'A group with this name already exists at this level';
    }

    if (errorStr.includes('UNIQUE constraint failed: profiles.name') ||
        (errorStr.includes('UNIQUE constraint') && errorStr.includes('profiles'))) {
        return 'A profile with this name already exists';
    }

    // Extract the innermost meaningful error message by removing "Failed to..." prefixes
    // Example: "Failed to save group: Failed to update group: Maximum depth reached"
    // becomes "Maximum depth reached"
    const failedToPattern = /^(Failed to [^:]+:\s*)+(.+)$/;
    const match = errorStr.match(failedToPattern);
    if (match && match[2]) {
        errorStr = match[2].trim();
    }

    // If the cleaned error still contains technical jargon, try to simplify
    if (errorStr.includes('UNIQUE constraint')) {
        return 'An item with this name already exists';
    }

    return errorStr;
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
            } else if (typeof line === 'object' && line !== null) {
                // Support segments array for multiple highlights in one line
                if (line.segments && Array.isArray(line.segments)) {
                    line.segments.forEach(segment => {
                        if (typeof segment === 'string') {
                            div.appendChild(document.createTextNode(segment));
                        } else if (segment.highlight) {
                            const span = createSpan(segment.highlight, segment.highlightClass || 'profile-name');
                            div.appendChild(span);
                        } else if (segment.text) {
                            div.appendChild(document.createTextNode(segment.text));
                        }
                    });
                } else {
                    // Original single-highlight format (backward compatible)
                    if (line.prefix) div.appendChild(document.createTextNode(line.prefix));
                    if (line.highlight) {
                        const span = createSpan(line.highlight, line.highlightClass || 'profile-name');
                        div.appendChild(span);
                    }
                    if (line.suffix) div.appendChild(document.createTextNode(line.suffix));
                    if (line.text && !line.prefix && !line.highlight && !line.suffix) {
                        div.textContent = line.text;
                    }
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
            // Support both plain text and HTML content for styled list items
            if (typeof item === 'string') {
                li.innerHTML = item; // Use innerHTML to support styled content
            } else {
                li.textContent = item;
            }
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
// Tag Manager Functions
// ===========================

// Open Tag Manager modal
async function openTagManager() {
    try {
        // Load tags and usage counts
        await loadTags();
        const usageCounts = await invoke('get_tag_usage_counts');

        // Render tag list
        renderTagList(usageCounts);

        // Show modal
        const tagManagerModal = document.getElementById('tag-manager-modal');
        tagManagerModal.classList.remove('hidden');
        pushModal('tag-manager');

        // Focus on tag name input and reset counter
        const tagNameInput = document.getElementById('new-tag-name-input');
        updateTagNameCounter(); // This will also call validateTagNameInput()
        setTimeout(() => tagNameInput.focus(), 100);
    } catch (error) {
        console.error('Failed to open tag manager:', error);
        showToast('Failed to load tags', TOAST_DURATION_SHORT, 'error');
    }
}

// Update tag name character counter
function updateTagNameCounter() {
    const input = document.getElementById('new-tag-name-input');
    const counter = document.getElementById('tag-name-counter');
    const currentLength = input.value.length;
    const maxLength = 32;

    counter.textContent = `${currentLength} / ${maxLength}`;

    // Add over-limit class if at max (even though input prevents going over)
    if (currentLength >= maxLength) {
        counter.classList.add('over-limit');
    } else {
        counter.classList.remove('over-limit');
    }

    // Validate characters (no spaces allowed)
    const validPattern = /^[a-zA-Z0-9\-_]*$/;
    if (input.value && !validPattern.test(input.value)) {
        input.classList.add('validation-error');
    } else {
        input.classList.remove('validation-error');
    }

    // Update Create Tag button state
    validateTagNameInput();
}

// Validate tag name input and enable/disable Create Tag button
function validateTagNameInput() {
    const nameInput = document.getElementById('new-tag-name-input');
    const createBtn = document.getElementById('create-tag-btn');

    if (!nameInput || !createBtn) return;

    const name = nameInput.value.trim();

    // Validate: must not be empty and must match allowed characters
    // Tag names: alphanumeric + hyphens/underscores only (NO spaces)
    const isValid = name.length > 0 && /^[a-zA-Z0-9\-_]+$/.test(name);

    // Enable/disable button based on validation
    createBtn.disabled = !isValid;
}

// Close Tag Manager modal
function closeTagManager() {
    const tagManagerModal = document.getElementById('tag-manager-modal');
    tagManagerModal.classList.add('hidden');
    popModal('tag-manager');

    // Clear inputs and validation states
    const nameInput = document.getElementById('new-tag-name-input');
    const colorInput = document.getElementById('new-tag-color-input');
    const counter = document.getElementById('tag-name-counter');

    nameInput.value = '';
    nameInput.classList.remove('validation-error');
    colorInput.value = '#3b82f6';
    counter.textContent = '0 / 32';
    counter.classList.remove('over-limit');

    // Disable Create Tag button (empty input = invalid)
    validateTagNameInput();

    // Clear any selected checkboxes
    document.querySelectorAll('.tag-checkbox:checked').forEach(checkbox => {
        checkbox.checked = false;
    });
}

// Render tag list with usage counts
function renderTagList(usageCounts) {
    const container = document.getElementById('tag-list-container');
    const bulkActions = document.getElementById('tag-bulk-actions');

    if (!usageCounts || usageCounts.length === 0) {
        container.innerHTML = '<div class="tag-list-empty">No tags created yet.</div>';
        bulkActions.classList.add('hidden');
        return;
    }

    // Debug: log the first tag to check structure
    if (usageCounts.length > 0) {
        debug.log('First tag data:', usageCounts[0]);
        debug.log('Tag color:', usageCounts[0][0].color);
    }

    const html = usageCounts.map(([tag, count]) => `
        <div class="tag-list-item">
            <input type="checkbox" class="tag-checkbox" data-tag-id="${escapeHtml(tag.id)}" data-tag-name="${escapeHtml(tag.name)}" data-tag-count="${count}">
            <div class="tag-color-swatch" data-color="${escapeHtml(tag.color)}"></div>
            <span class="tag-name">${escapeHtml(tag.name)}</span>
            <span class="tag-usage">(${count} profile${count !== 1 ? 's' : ''})</span>
            <button class="btn btn-danger btn-sm tag-delete-btn"
                    data-tag-id="${escapeHtml(tag.id)}"
                    data-tag-name="${escapeHtml(tag.name)}"
                    data-tag-count="${count}">
                Delete
            </button>
        </div>
    `).join('');

    container.innerHTML = html;

    // Apply colors to swatches (CSP-compliant way)
    container.querySelectorAll('.tag-color-swatch').forEach(swatch => {
        const color = swatch.dataset.color;
        if (color) {
            swatch.style.backgroundColor = color;
        }
    });

    // Show bulk actions
    bulkActions.classList.remove('hidden');

    // Add event delegation for delete buttons
    container.querySelectorAll('.tag-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tagId = btn.dataset.tagId;
            const tagName = btn.dataset.tagName;
            const usageCount = parseInt(btn.dataset.tagCount);
            deleteTag(tagId, tagName, usageCount);
        });
    });

    // Add event delegation for checkboxes (update select all button text and delete button state)
    container.querySelectorAll('.tag-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', updateSelectAllButtonText);
    });

    // Reset select all button text and delete button state (initially disable delete button)
    updateSelectAllButtonText();
}

// Create new tag
async function createTag() {
    const nameInput = document.getElementById('new-tag-name-input');
    const colorInput = document.getElementById('new-tag-color-input');

    const name = nameInput.value.trim();
    const color = colorInput.value;

    // Validate name
    if (!name) {
        showToast('Tag name is required', TOAST_DURATION_SHORT, 'error');
        nameInput.focus();
        return;
    }

    // Validate name format (alphanumeric, hyphens, underscores - NO spaces)
    if (!/^[a-zA-Z0-9\-_]+$/.test(name)) {
        showToast('Tag name can only contain letters, numbers, hyphens, and underscores (no spaces)', TOAST_DURATION_LONG, 'error');
        nameInput.focus();
        return;
    }

    try {
        await invoke('create_tag', { input: { name, color } });
        showToast('Tag created successfully', TOAST_DURATION_SHORT, 'success');

        // Clear inputs and validation states
        nameInput.value = '';
        nameInput.classList.remove('validation-error');
        colorInput.value = '#3b82f6';

        // Reset counter and button state
        updateTagNameCounter(); // This will also disable the button via validateTagNameInput()

        // Refresh tag list
        await loadTags();
        const usageCounts = await invoke('get_tag_usage_counts');
        renderTagList(usageCounts);

        // Focus back on name input
        nameInput.focus();
    } catch (error) {
        console.error('Failed to create tag:', error);
        showToast(`Failed to create tag: ${error}`, TOAST_DURATION_LONG, 'error');
    }
}

// Delete tag
async function deleteTag(tagId, tagName, usageCount) {
    const lines = [
        {
            segments: [
                { text: 'Delete tag ' },
                { highlight: tagName }
            ]
        }
    ];

    let warningText = null;
    if (usageCount > 0) {
        warningText = `This tag is used by ${usageCount} profile${usageCount !== 1 ? 's' : ''}. It will be removed from all profiles.`;
    }

    const confirmMessage = buildConfirmMessage({
        lines: lines,
        warnings: warningText ? [warningText] : [],
        question: 'Are you sure you want to delete this tag?'
    });

    const confirmed = await customConfirm(confirmMessage, {
        title: 'Delete Tag',
        okText: 'Delete',
        cancelText: 'Cancel',
        okClass: 'btn-danger'
    });

    if (!confirmed) return;

    try {
        await invoke('delete_tag', { tagId });
        showToast('Tag deleted successfully', TOAST_DURATION_SHORT, 'success');

        // Refresh tag list
        await loadTags();
        const usageCounts = await invoke('get_tag_usage_counts');
        renderTagList(usageCounts);

        // Reload profiles to update UI
        await loadProfiles();
    } catch (error) {
        console.error('Failed to delete tag:', error);
        showToast(`Failed to delete tag: ${error}`, TOAST_DURATION_LONG, 'error');
    }
}

// Update select all button text and delete button state based on checkbox states
function updateSelectAllButtonText() {
    const selectAllBtn = document.getElementById('select-all-tags-btn');
    const deleteSelectedBtn = document.getElementById('delete-selected-tags-btn');
    if (!selectAllBtn) return;

    const checkboxes = document.querySelectorAll('.tag-checkbox');
    const checkedCount = document.querySelectorAll('.tag-checkbox:checked').length;

    // Update select all button text
    if (checkedCount === checkboxes.length && checkboxes.length > 0) {
        selectAllBtn.textContent = 'Unselect All';
    } else {
        selectAllBtn.textContent = 'Select All';
    }

    // Enable/disable delete selected button and update text
    if (deleteSelectedBtn) {
        deleteSelectedBtn.disabled = checkedCount === 0;

        if (checkedCount === 0) {
            deleteSelectedBtn.textContent = 'Delete Selected';
        } else if (checkedCount === 1) {
            deleteSelectedBtn.textContent = 'Delete 1 Tag';
        } else {
            deleteSelectedBtn.textContent = `Delete ${checkedCount} Tags`;
        }
    }
}

// Toggle select/unselect all tags
function toggleSelectAllTags() {
    const selectAllBtn = document.getElementById('select-all-tags-btn');
    const checkboxes = document.querySelectorAll('.tag-checkbox');
    const checkedCount = document.querySelectorAll('.tag-checkbox:checked').length;

    // If all are selected, unselect all. Otherwise, select all.
    const shouldSelect = checkedCount !== checkboxes.length;

    checkboxes.forEach(checkbox => {
        checkbox.checked = shouldSelect;
    });

    updateSelectAllButtonText();
}

// Delete selected tags
async function deleteSelectedTags() {
    const checkboxes = document.querySelectorAll('.tag-checkbox:checked');

    if (checkboxes.length === 0) {
        showToast('No tags selected', TOAST_DURATION_SHORT, 'error');
        return;
    }

    // Collect tag data
    const tagsToDelete = Array.from(checkboxes).map(checkbox => ({
        id: checkbox.dataset.tagId,
        name: checkbox.dataset.tagName,
        count: parseInt(checkbox.dataset.tagCount)
    }));

    const totalCount = tagsToDelete.length;
    const totalProfiles = tagsToDelete.reduce((sum, tag) => sum + tag.count, 0);

    // Build confirmation message
    const lines = [
        {
            segments: [
                { text: 'Delete ' },
                { highlight: `${totalCount} tag${totalCount !== 1 ? 's' : ''}` }
            ]
        }
    ];

    const warnings = [];
    if (totalProfiles > 0) {
        warnings.push(`These tags are used by ${totalProfiles} profile${totalProfiles !== 1 ? 's' : ''} in total. They will be removed from all profiles.`);
    }

    const confirmMessage = buildConfirmMessage({
        lines: lines,
        warnings: warnings,
        question: 'Are you sure you want to delete the selected tags?'
    });

    const confirmed = await customConfirm(confirmMessage, {
        title: 'Delete Selected Tags',
        okText: 'Delete',
        cancelText: 'Cancel',
        okClass: 'btn-danger'
    });

    if (!confirmed) return;

    try {
        // Delete all selected tags
        for (const tag of tagsToDelete) {
            await invoke('delete_tag', { tagId: tag.id });
        }

        showToast(`${totalCount} tag${totalCount !== 1 ? 's' : ''} deleted successfully`, TOAST_DURATION_SHORT, 'success');

        // Refresh tag list
        await loadTags();
        const usageCounts = await invoke('get_tag_usage_counts');
        renderTagList(usageCounts);

        // Reload profiles to update UI
        await loadProfiles();
    } catch (error) {
        console.error('Failed to delete tags:', error);
        showToast(`Failed to delete tags: ${error}`, TOAST_DURATION_LONG, 'error');
    }
}

// ===========================
// Tag Selector Functions (Profile Editor) - Searchable Dropdown
// ===========================

/**
 * Show the tag dropdown with filtered results and detect new tag creation opportunity
 * @param {string} searchQuery - The search text to filter tags
 */
function showProfileTagsDropdown(searchQuery = '') {
    const dropdown = document.getElementById('profile-tags-dropdown');
    const hint = document.getElementById('tag-create-hint');
    if (!dropdown) return;

    const query = searchQuery.toLowerCase().trim();
    const exactMatch = allTags.find(tag => tag.name.toLowerCase() === query);

    // Show hint if user typed a non-existent tag name
    if (query.length > 0 && !exactMatch && /^[a-zA-Z0-9_-]+$/.test(query)) {
        hint.textContent = `Press Enter to create "${searchQuery}" tag`;
        hint.classList.remove('hidden');
    } else {
        hint.classList.add('hidden');
    }

    // Filter tags that match the search
    const availableTags = allTags.filter(tag => {
        const matchesSearch = tag.name.toLowerCase().includes(query);
        return matchesSearch;
    });

    if (availableTags.length === 0) {
        if (allTags.length === 0) {
            dropdown.innerHTML = '<div class="tag-dropdown-empty">No tags available. Click + Tag to create one.</div>';
        } else if (query.length > 0) {
            dropdown.innerHTML = '<div class="tag-dropdown-empty">No tags match your search. Press Enter to create a new tag.</div>';
        } else {
            dropdown.innerHTML = '<div class="tag-dropdown-empty">No tags match your search.</div>';
        }
    } else {
        const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

        dropdown.innerHTML = availableTags.map(tag => {
            const isSelected = selectedProfileTags.has(tag.id);
            return `
                <div class="tag-dropdown-item ${isSelected ? 'selected' : ''}" data-tag-id="${escapeHtml(tag.id)}">
                    <div class="tag-dropdown-color-swatch" data-tag-color="${escapeHtml(tag.color)}"></div>
                    <span class="tag-dropdown-item-name">${escapeHtml(tag.name)}</span>
                    ${isSelected ? checkIcon : ''}
                </div>
            `;
        }).join('');

        // Apply colors to swatches (CSP-compliant)
        dropdown.querySelectorAll('.tag-dropdown-color-swatch').forEach(swatch => {
            const color = swatch.dataset.tagColor;
            if (color) {
                swatch.style.backgroundColor = color;
            }
        });

        // Add click handlers
        dropdown.querySelectorAll('.tag-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const tagId = item.dataset.tagId;
                toggleProfileTag(tagId);
            });
        });
    }

    dropdown.classList.remove('hidden');

    // Auto-scroll modal to show dropdown
    setTimeout(() => {
        // Find the scrollable container (form element for profile modal)
        const scrollContainer = dropdown.closest('form') || dropdown.closest('.modal-content');
        if (!scrollContainer) return;

        // Get positions after dropdown is fully rendered
        const dropdownRect = dropdown.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();

        // We want 20px of breathing room below the dropdown
        const desiredPadding = 20;

        // Calculate how much the dropdown extends beyond the container
        const dropdownOverflow = dropdownRect.bottom - containerRect.bottom;

        if (dropdownOverflow > -desiredPadding) {
            // Calculate the current padding-bottom (might be from CSS)
            const computedStyle = window.getComputedStyle(scrollContainer);
            const currentPadding = parseInt(computedStyle.paddingBottom) || 0;

            // Add temporary padding to container so there's room to scroll
            const paddingNeeded = currentPadding + Math.abs(dropdownOverflow) + desiredPadding;
            const originalPaddingBottom = scrollContainer.style.paddingBottom;
            scrollContainer.style.paddingBottom = `${paddingNeeded}px`;
            scrollContainer.dataset.originalPaddingBottomTags = originalPaddingBottom;

            // Now scroll to show the dropdown with proper spacing
            setTimeout(() => {
                const scrollNeeded = Math.abs(dropdownOverflow) + desiredPadding;

                scrollContainer.scrollBy({
                    top: scrollNeeded,
                    behavior: 'smooth'
                });
            }, 10);
        }
    }, 50); // Delay to ensure dropdown is fully rendered
}

/**
 * Hide the tag dropdown and hint
 */
function hideProfileTagsDropdown() {
    const dropdown = document.getElementById('profile-tags-dropdown');
    const hint = document.getElementById('tag-create-hint');
    if (dropdown) {
        dropdown.classList.add('hidden');

        // Restore original container padding if we modified it
        const scrollContainer = dropdown.closest('form') || dropdown.closest('.modal-content');
        if (scrollContainer) {
            if (scrollContainer.dataset.originalPaddingBottomTags !== undefined) {
                scrollContainer.style.paddingBottom = scrollContainer.dataset.originalPaddingBottomTags || '';
                delete scrollContainer.dataset.originalPaddingBottomTags;
            }
            // Force cleanup: if padding was added, ensure it's removed
            // Check if padding is unusually large (> 50px indicates temporary padding)
            const currentPadding = parseInt(window.getComputedStyle(scrollContainer).paddingBottom) || 0;
            if (currentPadding > 50) {
                scrollContainer.style.paddingBottom = '12px'; // Reset to default modal padding
            }
        }
    }
    if (hint) {
        hint.classList.add('hidden');
    }
}

/**
 * Add a tag to the selection
 * @param {string} tagId - The tag ID to add
 */
function addProfileTag(tagId) {
    selectedProfileTags.add(tagId);
    renderSelectedTags();
    checkFormChanged();
}

/**
 * Remove a tag from the selection
 * @param {string} tagId - The tag ID to remove
 */
function removeProfileTag(tagId) {
    selectedProfileTags.delete(tagId);
    renderSelectedTags();
    checkFormChanged();
}

/**
 * Toggle a tag selection
 * @param {string} tagId - The tag ID to toggle
 */
function toggleProfileTag(tagId) {
    if (selectedProfileTags.has(tagId)) {
        removeProfileTag(tagId);
    } else {
        addProfileTag(tagId);
    }

    // Clear search, close dropdown, and unfocus
    const input = document.getElementById('profile-tags-input');
    if (input) {
        input.value = '';
        hideProfileTagsDropdown();
        input.blur();
    }
}

/**
 * Calculate relative luminance of a color to determine if text should be black or white
 * @param {string} hexColor - Hex color string (e.g., "#FF5733")
 * @returns {string} - "black" or "white" depending on the background luminance
 */
function getContrastTextColor(hexColor) {
    // Remove # if present
    const hex = hexColor.replace('#', '');

    // Convert hex to RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    // Calculate relative luminance using sRGB formula
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // Use white text for dark backgrounds, black text for light backgrounds
    // Threshold of 0.5 provides good contrast
    return luminance > 0.5 ? 'black' : 'white';
}

/**
 * Render the selected tags as pills inside the input wrapper
 */
function renderSelectedTags() {
    const wrapper = document.getElementById('profile-tags-wrapper');
    const input = document.getElementById('profile-tags-input');
    if (!wrapper || !input) return;

    // Get all selected tags
    const selectedTagsArray = Array.from(selectedProfileTags)
        .map(tagId => allTags.find(t => t.id === tagId))
        .filter(tag => tag); // Filter out any undefined tags

    // Remove existing pills (but keep the input)
    const existingPills = wrapper.querySelectorAll('.tokenized-tag-pill');
    existingPills.forEach(pill => pill.remove());

    // Create pill elements for each selected tag
    const removeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    selectedTagsArray.forEach(tag => {
        const pill = document.createElement('div');
        pill.className = 'tokenized-tag-pill';
        pill.style.backgroundColor = tag.color;
        pill.style.color = getContrastTextColor(tag.color);
        pill.innerHTML = `
            <span>${escapeHtml(tag.name)}</span>
            <span class="remove-tag" data-tag-id="${escapeHtml(tag.id)}" title="Remove tag">
                ${removeIcon}
            </span>
        `;

        // Add click handler for remove button
        const removeBtn = pill.querySelector('.remove-tag');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeProfileTag(tag.id);
            input.blur();
        });

        // Insert pill before the input
        wrapper.insertBefore(pill, input);
    });

    // Update placeholder
    if (selectedTagsArray.length > 0) {
        input.placeholder = '';
    } else {
        input.placeholder = 'Search or create tags...';
    }
}

/**
 * Load tags for a specific profile when editing
 * @param {string} profileId - The profile ID to load tags for
 */
async function loadProfileTags(profileId) {
    try {
        const tags = await invoke('get_profile_tags', { profileId });
        selectedProfileTags = new Set(tags.map(t => t.id));
        renderSelectedTags();
    } catch (error) {
        console.error('Failed to load profile tags:', error);
        selectedProfileTags = new Set();
        renderSelectedTags();
    }
}

/**
 * Handle keyboard navigation and actions in tag input
 */
async function handleProfileTagsKeydown(e) {
    const input = document.getElementById('profile-tags-input');
    const dropdown = document.getElementById('profile-tags-dropdown');
    const query = input.value.trim();

    // Handle Backspace to remove last tag when input is empty
    if (e.key === 'Backspace' && input.value === '' && selectedProfileTags.size > 0) {
        e.preventDefault();
        const tagsArray = Array.from(selectedProfileTags);
        const lastTagId = tagsArray[tagsArray.length - 1];
        removeProfileTag(lastTagId);
        return;
    }

    // Handle Enter key
    if (e.key === 'Enter') {
        e.preventDefault();

        // Check if there's a matching tag in the dropdown with keyboard focus
        const dropdown = document.getElementById('profile-tags-dropdown');
        if (!dropdown.classList.contains('hidden')) {
            const items = Array.from(dropdown.querySelectorAll('.tag-dropdown-item'));
            const focusedItem = items.find(item => item.classList.contains('keyboard-focus'));

            if (focusedItem) {
                // Select the focused tag
                focusedItem.click();
                return;
            }

            // If no focus but items exist, select first item
            if (items.length > 0) {
                items[0].click();
                return;
            }
        }

        // Create new tag if query is valid and doesn't exist
        if (query.length > 0) {
            const exactMatch = allTags.find(tag => tag.name.toLowerCase() === query.toLowerCase());
            if (!exactMatch && /^[a-zA-Z0-9_-]+$/.test(query)) {
                await createTagQuick(query);
            }
        }
        return;
    }

    // Handle dropdown navigation
    if (!dropdown || dropdown.classList.contains('hidden')) return;

    const items = Array.from(dropdown.querySelectorAll('.tag-dropdown-item'));
    if (items.length === 0) return;

    const currentIndex = items.findIndex(item => item.classList.contains('keyboard-focus'));

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items.forEach((item, i) => item.classList.toggle('keyboard-focus', i === nextIndex));
        items[nextIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items.forEach((item, i) => item.classList.toggle('keyboard-focus', i === prevIndex));
        items[prevIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Escape') {
        e.preventDefault();
        hideProfileTagsDropdown();
        input.blur();
    }
}

/**
 * Quick tag creation from input field (with default color)
 * @param {string} tagName - The name of the tag to create
 */
async function createTagQuick(tagName) {
    const input = document.getElementById('profile-tags-input');
    const defaultColor = '#3b82f6'; // Blue color to match theme

    try {
        const tagId = await invoke('create_tag', {
            input: {
                name: tagName,
                color: defaultColor
            }
        });

        // Reload tags to get the new tag
        await loadTags();

        // Add the newly created tag to selection
        addProfileTag(tagId);

        // Clear input and hide dropdown
        input.value = '';
        hideProfileTagsDropdown();

        showToast(`Tag "${tagName}" created and added`, TOAST_DURATION_SHORT, 'success');
    } catch (error) {
        console.error('Failed to create tag:', error);
        showToast(`Failed to create tag: ${cleanErrorMessage(error)}`, TOAST_DURATION_LONG, 'error');
    }
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
        pushModal('terminal');

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
        showToast(cleanErrorMessage(error), 'error');
        closeEmbeddedTerminal();
    }
}

async function closeEmbeddedTerminal() {
    if (!activeTerminalSession) {
        // Just hide modal if no active session
        const terminalModal = document.getElementById('terminal-modal');
        terminalModal.classList.add('hidden');
        popModal('terminal');
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
        popModal('terminal');
        terminalContainer.innerHTML = '<!-- xterm.js terminal will be mounted here -->';
    }
}

function clearTerminal() {
    if (activeTerminalSession && activeTerminalSession.term) {
        activeTerminalSession.term.clear();
    }
}
