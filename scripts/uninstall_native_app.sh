#!/usr/bin/env bash
set -euo pipefail

APP_ID="osaurus-native"
LAUNCHER_PATH="$HOME/.local/bin/$APP_ID"
DESKTOP_PATH="$HOME/.local/share/applications/$APP_ID.desktop"
ICON_PATH="$HOME/.local/share/icons/hicolor/scalable/apps/$APP_ID.svg"

rm -f "$LAUNCHER_PATH" "$DESKTOP_PATH" "$ICON_PATH"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
fi

echo "Removed $APP_ID launcher and desktop entry"
