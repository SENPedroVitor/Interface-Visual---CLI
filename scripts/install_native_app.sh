#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ID="osaurus-native"
APP_NAME="Osaurus Native"
VENV_DIR="$ROOT_DIR/.venv"
PYTHON_BIN="$VENV_DIR/bin/python"
LAUNCHER_DIR="$HOME/.local/bin"
APPLICATIONS_DIR="$HOME/.local/share/applications"
ICONS_DIR="$HOME/.local/share/icons/hicolor/scalable/apps"
LAUNCHER_PATH="$LAUNCHER_DIR/$APP_ID"
DESKTOP_PATH="$APPLICATIONS_DIR/$APP_ID.desktop"
ICON_SOURCE="$ROOT_DIR/assets/osaurus-native.svg"
ICON_PATH="$ICONS_DIR/$APP_ID.svg"

mkdir -p "$LAUNCHER_DIR" "$APPLICATIONS_DIR" "$ICONS_DIR"

if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi

"$PYTHON_BIN" -m ensurepip --upgrade >/dev/null 2>&1 || true
"$PYTHON_BIN" -m pip install --upgrade pip
"$PYTHON_BIN" -m pip install -r "$ROOT_DIR/requirements.txt"

cat >"$LAUNCHER_PATH" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$ROOT_DIR"
export PYTHONPATH="$ROOT_DIR/src\${PYTHONPATH:+:\$PYTHONPATH}"
exec "$PYTHON_BIN" -m cli_harness.native_app "\$@"
EOF

chmod +x "$LAUNCHER_PATH"
cp "$ICON_SOURCE" "$ICON_PATH"

cat >"$DESKTOP_PATH" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=$APP_NAME
Comment=Native shell for Codex and Qwen CLI agents
Exec=$LAUNCHER_PATH
Icon=$ICON_PATH
Terminal=false
Categories=Development;Utility;
Keywords=AI;CLI;Codex;Qwen;Agent;
StartupNotify=true
EOF

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPLICATIONS_DIR" >/dev/null 2>&1 || true
fi

echo "Installed $APP_NAME"
echo "Launcher: $LAUNCHER_PATH"
echo "Desktop entry: $DESKTOP_PATH"
