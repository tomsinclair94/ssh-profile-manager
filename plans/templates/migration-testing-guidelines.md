# Migration Testing Guidelines

**Purpose:** Standard checklist and procedures for testing version upgrades in SSH Profile Manager.
**Scope:** Database schema migrations, data integrity validation, and feature compatibility.
**Usage:** Copy relevant sections to version-specific migration test plans (e.g., `plans/vX.X.X-migration-testing.md`).

---

## Overview

Migration testing validates that users can safely upgrade from one version to another without data loss or corruption. Each version with database/frontend migrations requires a custom test plan based on these guidelines.

**Key Principles:**
- **Zero Data Loss:** 100% data integrity requirement (not a single profile lost)
- **Fast Migration:** Complete in <30 seconds even with reasonable datasets
- **No Errors:** Migration completes without console errors or warnings

**Important Notes:**
- **No Backward Compatibility:** Users cannot downgrade to previous versions with a migrated database
- **Backup via Export:** Users should use the built-in "Export All Profiles" (JSON) before upgrading, NOT database file backups
- **Minimal Test Data:** Use minimal realistic data to cover all migration paths, not extreme datasets

---

## Standard Test Workflow

### 1. Pre-Migration Setup

**Objective:** Create a minimal realistic test database from the previous version.

#### Install Previous Version
- [ ] Download v[PREVIOUS] release from GitHub
- [ ] Install on test machine
- [ ] Verify version in UI (Settings → About)

#### Create Minimal Test Data

Create minimal test data that covers all migration paths:

**Profiles (Minimal Coverage):**
- [ ] At least 1 SSH key authentication profile
- [ ] At least 1 password authentication profile
- [ ] At least 1 profile with description
- [ ] At least 1 profile with empty description
- [ ] At least 1 ungrouped profile (if applicable to version)

**Groups (if applicable):**
- [ ] At least 1 top-level group
- [ ] At least 1 nested group structure (test maximum depth if relevant)

**Settings:**
- [ ] Change at least 1 setting from default (e.g., terminal preference)

**Connections:**
- [ ] Connect to at least 1 profile (populate recent connections)

**Version-Specific Data:**
- [ ] [Add version-specific minimal test data here based on migration scope]

#### Backup via Export (Recommended for Users)
- [ ] Open Settings → Backup & Restore
- [ ] Click "Export All Profiles"
- [ ] Save backup JSON file to safe location
- [ ] Verify JSON file saved successfully
- [ ] **Note:** This is the recommended user backup method (not database file backup)

#### Document Pre-Migration State
- [ ] Total profiles: `[count]`
- [ ] Profiles by auth method: SSH Key `[count]`, Password `[count]`
- [ ] Total groups: `[count]` (if applicable)
- [ ] Recent connections: `[count]`
- [ ] Custom settings: `[list]`
- [ ] **Version-specific counts:** `[add relevant counts for new features]`

---

### 2. Migration Execution

**Objective:** Run the migration and verify it completes without errors.

#### Pre-Migration Checks
- [ ] Close previous version completely
- [ ] Verify no background processes running

#### Install and Launch
- [ ] Build/install v[NEW] application
- [ ] Launch application
- [ ] **Monitor console for errors:**
  - macOS: Console.app, filter "ssh-profile-manager"
  - Windows: Application logs
  - Look for: SQL errors, migration failures, data corruption warnings

#### Migration Success Indicators
- [ ] App launches successfully (no crash)
- [ ] UI displays without errors
- [ ] Profile list populates (not empty)
- [ ] No error modals or alerts
- [ ] Console shows no ERROR/WARN messages
- [ ] Version splash screen appears (if applicable)

#### Measure Performance
- [ ] Migration completion time: `[seconds]`
- [ ] Expected: <30 seconds for typical datasets
- [ ] Status: ✅ <30s / ⚠️ 30-60s / ❌ >60s

---

### 3. Data Integrity Validation

**Objective:** Verify all data migrated correctly with zero loss.

#### Core Data Validation
- [ ] **Total profiles preserved:**
  - Expected: `[count from pre-migration]`
  - Actual: `[count in UI]`
  - Status: ✅ Match / ❌ Mismatch

- [ ] **Profile data intact:** Check each test profile:
  - [ ] Names correct
  - [ ] Hosts correct
  - [ ] Ports correct (default: 22)
  - [ ] Usernames correct
  - [ ] Auth methods correct (key vs password)
  - [ ] SSH key paths preserved (key auth profiles)
  - [ ] Descriptions preserved (including empty descriptions)

#### User Settings
- [ ] Terminal application preference preserved
- [ ] Default SSH key path preserved (if set)
- [ ] Custom settings preserved

#### Recent Connections
- [ ] **Total recent connections:**
  - Expected: `[count]`
  - Actual: `[count]`
  - Status: ✅ Match / ❌ Mismatch
- [ ] Recent connections show correct profile names
- [ ] Timestamps preserved

#### Keychain Data (Password-Auth Profiles)
- [ ] Open Keychain Access (macOS) / Credential Manager (Windows)
- [ ] Search for "ssh-profile-manager"
- [ ] **Keychain entries:**
  - Expected: `[count password-auth profiles]`
  - Actual: `[count entries]`
  - Status: ✅ Match / ❌ Mismatch

#### Version-Specific Data Validation
- [ ] [Add validation steps specific to new features/schema changes]
- [ ] [Example: Verify groups extracted from group_name field]
- [ ] [Example: Verify metadata backfilled with defaults]

---

### 4. Feature Validation

**Objective:** Verify new features work correctly with migrated data.

#### Test New Features with Migrated Data

For each major new feature introduced in this version:

- [ ] **Feature 1:** [Name]
  - [ ] Works with migrated profiles
  - [ ] Works with migrated settings
  - [ ] No console errors

- [ ] **Feature 2:** [Name]
  - [ ] [Add specific test cases]

#### Group Cascade Operations (if version includes hierarchical groups)

This is a high-risk area — group rename/move must update all descendant group paths and profile paths correctly. A common bug is prefix-matching too broadly (e.g., renaming "Dev" incorrectly affecting "DevOps").

- [ ] Create two groups with a shared name prefix (e.g., "Dev" and "DevOps") each containing profiles
- [ ] Rename "Dev" → "Development"
- [ ] Verify "DevOps" path is **not** affected
- [ ] Verify all profiles in "Dev" (now "Development") have updated `group_path`
- [ ] Move a group to a new parent → verify all child group paths updated
- [ ] Verify all profile paths updated correctly after move

#### Export/Import with Migrated Data
- [ ] Export single migrated profile (no encryption)
- [ ] Verify export contains v[NEW] format
- [ ] Import exported profile (test duplicate detection)
- [ ] Export all profiles
- [ ] Verify export includes all migrated data

---

## Test Results Template

Use this template to document migration test results:

### Summary
- **Migration Status:** ✅ Success / ⚠️ Partial Success / ❌ Failed
- **Migration:** v[PREVIOUS] → v[NEW]
- **Schema Change:** v[PREV_SCHEMA] → v[NEW_SCHEMA]
- **Date Tested:** [date]
- **Platform:** macOS [version] / Windows [version]

### Data Integrity
| Category | Expected | Actual | Status |
|----------|----------|--------|--------|
| Profiles | [count] | [count] | ✅ / ❌ |
| Groups | [count] | [count] | ✅ / ❌ |
| Recent Connections | [count] | [count] | ✅ / ❌ |
| User Settings | [count] | [count] | ✅ / ❌ |
| Keychain Entries | [count] | [count] | ✅ / ❌ |
| [Version-Specific] | [count] | [count] | ✅ / ❌ |

**Data Loss:** ✅ None / ⚠️ Minor / ❌ Significant

### Performance
- **Migration Time:** `[seconds]` (Target: <30s)
- **App Launch Time:** `[seconds]` (Post-migration)
- **UI Responsiveness:** ✅ Excellent / ⚠️ Acceptable / ❌ Poor

### Issues Found
- [ ] Issue 1: [Description]
- [ ] Issue 2: [Description]

### Migration Notes for Release
[Document important findings for the release notes:]
- "Users should export profiles (JSON) before upgrading as a precaution"
- "Migration may take up to X seconds"
- [Any known issues or workarounds]

---

## Checklist

Before marking migration testing complete:

- [ ] Migration executes without errors
- [ ] 100% data integrity (zero profiles lost)
- [ ] All user settings preserved
- [ ] Keychain entries intact (password-auth profiles)
- [ ] New features work with migrated data
- [ ] Performance acceptable (<30s migration time)
- [ ] No console errors or warnings
- [ ] Test results documented

---

## Notes for Test Plan Authors

When creating a version-specific migration test plan:

1. **Copy relevant sections** from these guidelines

2. **Replace placeholders:**
   - `[PREVIOUS]` → actual previous version (e.g., "0.6.5")
   - `[NEW]` → actual new version (e.g., "0.7.0")
   - `[PREV_SCHEMA]` → schema version (e.g., "3")
   - `[NEW_SCHEMA]` → schema version (e.g., "4")

3. **Add version-specific sections:**
   - Specific schema changes being tested
   - Specific data transformations to validate
   - Specific new features to test
   - Minimal test data requirements

4. **Remove irrelevant sections:**
   - If no frontend migrations, remove localStorage testing
   - If no new features, skip feature validation

5. **Store plan in:** `plans/vX.X.X-migration-testing.md`

6. **Link from phase plan:** Reference in Phase 8E section of version plan

7. **Preserve test data:** Export profiles from the previous version before migrating and store the file in `plans/test-data/vX.X.X-test-profiles.json` for future reference

---

**Last Updated:** 2026-02-19
