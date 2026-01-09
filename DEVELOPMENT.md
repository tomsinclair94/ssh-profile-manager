# Development Guide

## Development Workflow

**Branch-based development for new versions:**

1. **Create Version Branch** - Start development on `vX.X.X-dev` branch
   ```bash
   git checkout -b v0.6.0-dev
   # Update version in all 7 locations (see Version Management in CLAUDE.md)
   git add -A && git commit -m "Bump version to X.X.X for development"
   git push -u origin vX.X.X-dev
   ```

2. **Multi-Phase Development** - For complex features with multiple phases:
   - After completing each phase, commit and push with detailed commentary
   - Include what's working, what's next, and any known limitations
   - Creates regular checkpoints for backup and rollback
   - Example commit message format:
     ```
     Complete Phase N: [Feature Name]

     [What was implemented]
     [What's working]
     [Known limitations]

     Progress: N/X phases complete
     Next: Phase N+1 description
     ```

3. **Regular Pushes** - Push to remote after each significant checkpoint:
   ```bash
   git add -A && git commit -m "Descriptive message"
   git push  # Branch tracking already set up
   ```

4. **Prepare for Release** - Before creating PR, ensure:
   - ✅ Code review completed (use code-reviewer agent)
   - ✅ Security review completed (use security-engineer agent)
   - ✅ All CRITICAL/HIGH/MEDIUM issues fixed
   - ✅ Version updated in ALL 7 locations:
     1. `src-tauri/tauri.conf.json` (line 4)
     2. `src-tauri/Cargo.toml` (line 3)
     3. `package.json` (line 3)
     4. `dist/index.html` (line 17)
     5. `dist/index.html` (line ~336)
     6. `README.md` (line 14)
     7. `README.md` (line 16)
   - ✅ CHANGELOG.md updated with new version entry
   - ✅ README.md updated (features, screenshots if needed)
   - ✅ Manual testing completed
   - ✅ All changes committed and pushed to `vX.X.X-dev`

5. **Create Release PR** - Trigger automated checks and release:
   - Create pull request from `vX.X.X-dev` to `main`
   - **Important:** PR title MUST start with: `Release vX.X.X - Brief Description`
   - Add comprehensive PR description with summary of changes
   - Review all file changes one final time
   - **Automated PR checks will run** (if code changes detected):
     * **Security Audit** (`security-audit.yml`):
       - Runs `cargo audit` (Rust dependency vulnerabilities)
       - Runs `bun audit` (JavaScript dependency vulnerabilities)
       - Checks for outdated dependencies
     * **Build Checks** (`pr-checks.yml`):
       - Runs `cargo check` on macOS and Windows
       - Runs `cargo test` on both platforms
       - Verifies production build succeeds
   - **Path filtering** - If PR only contains documentation changes:
     * Security audit and build checks are automatically skipped
     * PR can be merged immediately without waiting for checks
   - **All checks must pass** before PR can be merged (for code changes)

6. **Merge & Automated Release** - Squash merge triggers automation:
   - Click "Squash and merge" on GitHub
   - Confirm merge commit message starts with `Release vX.X.X`
   - **Auto-tag workflow** (`auto-tag.yml`) detects release commit:
     * Extracts version from commit message
     * Reads CHANGELOG entry for that version
     * Creates annotated git tag with CHANGELOG content
     * Pushes tag to GitHub using PAT_TOKEN
   - **Release workflow** (`release.yml`) triggered by new tag:
     * Builds macOS (aarch64) binary
     * Builds Windows (x86_64) binary
     * Creates GitHub release with binaries
     * Uses CHANGELOG content as release notes
     * Creates installer bundle ZIP with all platform binaries
   - ✅ **Done!** Release is live automatically

**Important:** The commit message format `Release vX.X.X` is critical - it triggers the auto-tagging workflow.

**Benefits:**
- Regular backups prevent data loss
- Clear progression visible in git history
- Easy rollback to specific phases if needed
- Branch keeps experimental work isolated from stable `main`

## GitHub Repository Secrets

The automated release workflow requires the following repository secret:

### PAT_TOKEN (Required)

**Purpose:** Personal Access Token (PAT) used by the auto-tag workflow to trigger the release workflow.

**Why needed:** GitHub's default `GITHUB_TOKEN` doesn't trigger other workflows (security feature to prevent recursive workflow loops). Using a PAT allows the auto-tag workflow to create tags that trigger the release workflow.

**Setup:**
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Token name: `SSH Profile Manager Auto-Tag`
4. Expiration: Choose appropriate duration (recommend 1 year)
5. Scopes: Check `repo` (Full control of private repositories)
6. Click "Generate token" and copy the token
7. Go to repository Settings → Secrets and variables → Actions
8. Click "New repository secret"
9. Name: `PAT_TOKEN`
10. Value: Paste the token
11. Click "Add secret"

**Permissions:** `repo` scope (allows creating tags and triggering workflows)

**Used by:** `.github/workflows/auto-tag.yml`

## GitHub Workflows

The repository uses four automated workflows for quality assurance and releases:

### 1. PR Checks (`pr-checks.yml`)
**Triggers:** Pull requests to `main` branch
**Purpose:** Validates code quality and cross-platform compatibility
**Jobs:**
- Cargo check (Rust compilation check)
- Cargo test (Unit tests)
- Build verification (Production build)
- Runs on both macOS (aarch64) and Windows (x86_64)

**Path Filtering:** Automatically skips if PR only contains:
- Documentation files (`*.md`)
- Non-code configuration files

### 2. Security Audit (`security-audit.yml`)
**Triggers:**
- Pull requests to `main` branch
- Weekly schedule (Monday 9:00 AM UTC)
- Manual dispatch

**Purpose:** Scans dependencies for security vulnerabilities
**Jobs:**
- `cargo audit` - Rust dependency vulnerabilities
- `bun audit` - JavaScript dependency vulnerabilities
- `cargo outdated` + `bun outdated` - Outdated dependency checks

**Path Filtering:** On PRs, automatically skips if no code changes in:
- `src-tauri/**` (Rust code)
- `dist/**` (Frontend code)
- `package.json` / `bun.lock` (JS dependencies)
- `.github/workflows/security-audit.yml` (Workflow changes)

**Note:** Weekly runs and manual dispatches always execute (no path filtering).

### 3. Auto-Tag (`auto-tag.yml`)
**Triggers:** Push to `main` branch
**Purpose:** Automatically creates release tags from release merges
**Process:**
1. Checks if commit message starts with `Release vX.X.X`
2. Extracts version number from commit message
3. Extracts CHANGELOG section for that version
4. Creates annotated git tag with CHANGELOG as message
5. Pushes tag using PAT_TOKEN (triggers release workflow)

**Requirements:**
- Commit message MUST start with `Release vX.X.X`
- CHANGELOG.md MUST contain section for version `[X.X.X]`
- PAT_TOKEN secret configured

### 4. Release (`release.yml`)
**Triggers:**
- Push of version tags (`v*`)
- Manual dispatch (with tag input)

**Purpose:** Builds and publishes release binaries
**Process:**
1. Checks out code at the tagged version
2. Builds for macOS (aarch64-apple-darwin)
3. Builds for Windows (x86_64-pc-windows-msvc)
4. Creates GitHub release with:
   - Tag annotation as release notes
   - macOS DMG installer
   - Windows MSI installer
   - Combined ZIP bundle with all installers

**Permissions:** Requires `contents: write` to create releases

---

**Workflow Efficiency:**
- Code PRs: Both security audit and build checks run (required)
- Doc-only PRs: All checks skipped (can merge immediately)
- Regular pushes: No workflows triggered (saves CI minutes)
- Release merges: Auto-tag → Release workflow chain

## Quick Start

```bash
bun run dev      # Development with hot reload
bun run build    # Production build
```

## Project Structure

```
dist/           # Frontend (index.html, styles.css, main.js)
src-tauri/      # Rust backend (lib.rs, Cargo.toml, tauri.conf.json)
```

See CLAUDE.md for detailed development notes (local file, not in repo).
