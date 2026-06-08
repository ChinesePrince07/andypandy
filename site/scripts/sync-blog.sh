#!/bin/bash
# sync-blog.sh — Syncs markdown posts from Obsidian (iCloud) to the git repo and pushes.
# Triggered by launchd whenever the Obsidian vault changes.

set -euo pipefail

OBSIDIAN_DIR="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/blog"
REPO_DIR="$HOME/Desktop/GitHub/personal-site"
BLOG_DIR="$REPO_DIR/content/blog"
LOG="$HOME/Library/Logs/blog-sync.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"
}

# Ensure the source vault exists
if [ ! -d "$OBSIDIAN_DIR" ]; then
  log "ERROR: Obsidian vault not found at $OBSIDIAN_DIR"
  exit 1
fi

mkdir -p "$BLOG_DIR"

# Sync only .md files, delete posts removed from Obsidian
rsync -av --delete \
  --include="*.md" \
  --exclude="*" \
  "$OBSIDIAN_DIR/" "$BLOG_DIR/" >> "$LOG" 2>&1

cd "$REPO_DIR"

# Check if there are any changes in the blog directory
if [ -z "$(git status --porcelain content/blog/)" ]; then
  log "No changes detected, skipping."
  exit 0
fi

# Commit and push
git add content/blog/
CHANGED_FILES=$(git diff --cached --name-only | sed 's|content/blog/||;s|\.md$||' | tr '\n' ', ' | sed 's/,$//')
git commit -m "blog: sync from Obsidian ($CHANGED_FILES)"
git push >> "$LOG" 2>&1

log "Pushed changes: $CHANGED_FILES"
