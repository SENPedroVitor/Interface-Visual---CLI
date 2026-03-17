#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ID="waddle"
APP_NAME="Waddle"
VENV_DIR="$ROOT_DIR/.venv"
PYTHON_BIN="$VENV_DIR/bin/python"
LAUNCHER_DIR="$HOME/.local/bin"
APPLICATIONS_DIR="$HOME/.local/share/applications"
ICONS_DIR="$HOME/.local/share/icons/hicolor"
LAUNCHER_PATH="$LAUNCHER_DIR/$APP_ID"
DESKTOP_PATH="$APPLICATIONS_DIR/$APP_ID.desktop"
ICON_SOURCE="$ROOT_DIR/assets/waddle.svg"

mkdir -p "$LAUNCHER_DIR" "$APPLICATIONS_DIR"
mkdir -p "$ICONS_DIR/scalable/apps"
mkdir -p "$ICONS_DIR/256x256/apps"
mkdir -p "$ICONS_DIR/128x128/apps"
mkdir -p "$ICONS_DIR/64x64/apps"
mkdir -p "$ICONS_DIR/48x48/apps"
mkdir -p "$ICONS_DIR/32x32/apps"
mkdir -p "$ICONS_DIR/16x16/apps"

if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi

"$PYTHON_BIN" -m ensurepip --upgrade >/dev/null 2>&1 || true
"$PYTHON_BIN" -m pip install --upgrade pip
"$PYTHON_BIN" -m pip install -r "$ROOT_DIR/requirements.txt"

cat >"$LAUNCHER_PATH" <<EOF
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$ROOT_DIR"
cd "\$ROOT_DIR"
export PYTHONPATH="\$ROOT_DIR/src\${PYTHONPATH:+:\$PYTHONPATH}"
export QML_DISABLE_DISK_CACHE=1

choose_python() {
  local candidate=""
  for candidate in "\$ROOT_DIR/.venv/bin/python" "\$(command -v python3)"; do
    if [ -z "\$candidate" ] || [ ! -x "\$candidate" ]; then
      continue
    fi
    if "\$candidate" -c "import cli_harness.native_app" >/dev/null 2>&1; then
      echo "\$candidate"
      return 0
    fi
  done
  return 1
}

PYTHON_BIN="\$(choose_python || true)"
if [ -z "\$PYTHON_BIN" ]; then
  echo "waddle launcher: could not find a Python runtime with project dependencies." >&2
  echo "Run: $ROOT_DIR/scripts/install_native_app.sh" >&2
  exit 1
fi

exec "\$PYTHON_BIN" -m cli_harness.native_app "\$@"
EOF

chmod +x "$LAUNCHER_PATH"

cp "$ICON_SOURCE" "$ICONS_DIR/scalable/apps/$APP_ID.svg"

if command -v rsvg-convert >/dev/null 2>&1; then
  for size in 16 32 48 64 128 256; do
    rsvg-convert -w "$size" -h "$size" "$ICON_SOURCE" > "$ICONS_DIR/${size}x${size}/apps/$APP_ID.png"
  done
  echo "Generated PNG icons from SVG"
else
  echo "Note: rsvg-convert not found. SVG icon installed. Install librsvg for PNG icons."
  cp "$ICON_SOURCE" "$ICONS_DIR/256x256/apps/$APP_ID.svg"
fi

cat >"$DESKTOP_PATH" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=$APP_NAME
Comment=Native desktop shell for AI CLI agents (Codex, Qwen)
Exec=$LAUNCHER_PATH
Icon=$APP_ID
Terminal=false
Categories=Development;Utility;
Keywords=AI;CLI;Codex;Qwen;Agent;Chat;
StartupNotify=true
StartupWMClass=waddle
EOF

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPLICATIONS_DIR" >/dev/null 2>&1 || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f "$ICONS_DIR/hicolor" >/dev/null 2>&1 || true
fi

echo "✓ Installed $APP_NAME"
echo "  Launcher: $LAUNCHER_PATH"
echo "  Desktop entry: $DESKTOP_PATH"
echo "  Icons: $ICONS_DIR"
echo ""
echo "Launch with: $APP_ID"
