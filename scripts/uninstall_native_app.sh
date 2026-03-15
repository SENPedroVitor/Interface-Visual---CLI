#!/usr/bin/env bash
set -euo pipefail

APP_ID="waddle"
ICONS_DIR="$HOME/.local/share/icons/hicolor"
LAUNCHER_PATH="$HOME/.local/bin/$APP_ID"
DESKTOP_PATH="$HOME/.local/share/applications/$APP_ID.desktop"

rm -f "$LAUNCHER_PATH" "$DESKTOP_PATH"
rm -f "$ICONS_DIR/scalable/apps/$APP_ID.svg"
rm -f "$ICONS_DIR/256x256/apps/$APP_ID.png"
rm -f "$ICONS_DIR/128x128/apps/$APP_ID.png"
rm -f "$ICONS_DIR/64x64/apps/$APP_ID.png"
rm -f "$ICONS_DIR/48x48/apps/$APP_ID.png"
rm -f "$ICONS_DIR/32x32/apps/$APP_ID.png"
rm -f "$ICONS_DIR/16x16/apps/$APP_ID.png"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f "$ICONS_DIR/hicolor" >/dev/null 2>&1 || true
fi

echo "✓ Removed $APP_ID launcher and desktop entry"
