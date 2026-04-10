#!/bin/bash
# Auto-push script for Taylor's Bakery Orders
# Commits any pending changes and pushes to GitHub

cd "$(dirname "$0")/.." || exit 1

# Clean up any stale lock files
rm -f .git/index.lock .git/HEAD.lock

# Check if there are any changes
if git diff --quiet && git diff --cached --quiet; then
  echo "No changes to push."
  exit 0
fi

# Stage, commit, and push
git add -A
git commit -m "Auto-push: $(date '+%Y-%m-%d %H:%M')"
git push origin main

echo "Push complete."
