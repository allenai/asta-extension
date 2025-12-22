# Contributing

## Upstream Sync

1. Fetch and merge upstream:
   ```bash
   git fetch upstream
   git checkout -b sync/upstream-YYYY-MM main
   git merge upstream/master
   ```

2. Resolve conflicts:
   - Keep ours: `manifest.json`, `src/index.js`, `src/badges.js`, `src/background.js`, `src/components/HideableTally.js`

3. Create PR using **merge commit** (not squash) to preserve git history for future syncs
