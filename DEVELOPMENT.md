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

4. **Merge When Ready** - Once version is complete and tested:
   - Create pull request from `vX.X.X-dev` to `main`
   - Review changes, run final tests
   - Merge to `main`
   - Follow Release Process (see CLAUDE.md)

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
