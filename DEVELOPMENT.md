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

5. **Create Release PR** - Trigger automated release:
   - Create pull request from `vX.X.X-dev` to `main`
   - **Important:** PR title MUST start with: `Release vX.X.X - Brief Description`
   - Add comprehensive PR description with summary of changes
   - Review all file changes one final time

6. **Merge & Automated Release** - Squash merge triggers automation:
   - Click "Squash and merge" on GitHub
   - Confirm merge commit message starts with `Release vX.X.X`
   - **Auto-tag workflow** (`auto-tag.yml`) detects release commit:
     * Extracts version from commit message
     * Reads CHANGELOG entry for that version
     * Creates annotated git tag with CHANGELOG content
     * Pushes tag to GitHub
   - **Release workflow** (`release.yml`) triggered by new tag:
     * Builds macOS (aarch64) binary
     * Builds Windows (x86_64) binary
     * Creates GitHub release with binaries
     * Uses CHANGELOG as release notes
   - ✅ **Done!** Release is live automatically

**Important:** The commit message format `Release vX.X.X` is critical - it triggers the auto-tagging workflow.

**Benefits:**
- Regular backups prevent data loss
- Clear progression visible in git history
- Easy rollback to specific phases if needed
- Branch keeps experimental work isolated from stable `main`

## Quick Start

```bash
npm run dev      # Development with hot reload
npm run build    # Production build
```

## Project Structure

```
dist/           # Frontend (index.html, styles.css, main.js)
src-tauri/      # Rust backend (lib.rs, Cargo.toml, tauri.conf.json)
```

See CLAUDE.md for detailed development notes (local file, not in repo).
