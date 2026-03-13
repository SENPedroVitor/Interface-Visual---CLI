#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_NAME="${1:-github}"
REMOTE_URL="$(git -C "$ROOT_DIR" remote get-url "$REMOTE_NAME" 2>/dev/null || true)"

if [ -z "$REMOTE_URL" ]; then
  echo "Remote '$REMOTE_NAME' not found."
  echo "Available remotes:"
  git -C "$ROOT_DIR" remote -v || true
  exit 1
fi

TMP_DIR="$(mktemp -d /tmp/interface-visual-cli-publish-XXXXXX)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Cloning $REMOTE_NAME into temporary workspace..."
git clone "$REMOTE_URL" "$TMP_DIR/repo" >/dev/null

echo "Syncing project files..."
find "$TMP_DIR/repo" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
rsync -a \
  --exclude ".git" \
  --exclude ".venv" \
  --exclude "__pycache__" \
  --exclude "00-contexto-do-projeto.md" \
  --exclude "desktop/tsconfig.node.tsbuildinfo" \
  --exclude "desktop/node_modules" \
  --exclude "desktop/dist" \
  --exclude "desktop/electron-dist" \
  --exclude ".env" \
  "$ROOT_DIR/" "$TMP_DIR/repo/"

cd "$TMP_DIR/repo"

if [ -z "$(git status --porcelain)" ]; then
  echo "No changes to publish."
  exit 0
fi

git add .
git commit -m "Publish snapshot from local workspace"
git push origin main

echo "Published snapshot to $REMOTE_NAME"
