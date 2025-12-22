# Contributing

This extension is a fork of [scite-extension](https://github.com/scitedotai/scite-extension).

## Upstream Sync

1. Fetch and merge upstream:
   ```bash
   git fetch upstream
   git checkout -b sync/upstream-YYYY-MM main
   git merge upstream/master
   ```

2. Resolve conflicts - keep ours for Asta-specific files (`src/asta/*`, `src/background.js`, `manifest.json`, etc.)

3. Create PR using **merge commit** (not squash) to preserve git history for future syncs
