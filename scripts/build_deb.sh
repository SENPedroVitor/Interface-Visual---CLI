#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${WADDLE_DEB_OUTPUT_DIR:-$ROOT_DIR/dist/deb}"
PACKAGE_NAME="waddle"
ARCHITECTURE="all"
TEMPLATE_DIR="$ROOT_DIR/packaging/linux"

version="$(
  cd "$ROOT_DIR"
  python3 - <<'PY'
from pathlib import Path
import re

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover - build hosts on Python 3.9/3.10
    try:
        import tomli as tomllib  # type: ignore
    except ModuleNotFoundError:
        tomllib = None  # type: ignore

text = Path("pyproject.toml").read_text(encoding="utf-8")
if tomllib is not None:
    metadata = tomllib.loads(text)
    print(metadata["project"]["version"])
else:
    match = re.search(r'(?m)^version\s*=\s*"([^"]+)"', text)
    if not match:
        raise SystemExit("Could not read project.version from pyproject.toml")
    print(match.group(1))
PY
)"
DEB_VERSION="${WADDLE_DEB_VERSION:-$version}"

if [ -z "${SOURCE_DATE_EPOCH:-}" ]; then
  if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    SOURCE_DATE_EPOCH="$(git -C "$ROOT_DIR" log -1 --format=%ct)"
  else
    SOURCE_DATE_EPOCH=0
  fi
fi
export SOURCE_DATE_EPOCH

build_dir="$(mktemp -d "${TMPDIR:-/tmp}/waddle-deb.XXXXXX")"
stage="$build_dir/stage"
trap 'rm -rf "$build_dir"' EXIT

umask 022
mkdir -p \
  "$OUTPUT_DIR" \
  "$stage/DEBIAN" \
  "$stage/usr/bin" \
  "$stage/usr/lib/waddle/src" \
  "$stage/usr/lib/waddle/assets" \
  "$stage/usr/lib/waddle/skills" \
  "$stage/usr/share/applications" \
  "$stage/usr/share/icons/hicolor/scalable/apps" \
  "$stage/usr/share/doc/$PACKAGE_NAME"

install -m 0755 "$TEMPLATE_DIR/waddle-desktop.in" "$stage/usr/bin/waddle-desktop"
install -m 0644 "$TEMPLATE_DIR/waddle.desktop" "$stage/usr/share/applications/waddle.desktop"
install -m 0644 "$ROOT_DIR/assets/waddle.svg" "$stage/usr/share/icons/hicolor/scalable/apps/waddle.svg"
install -m 0644 "$ROOT_DIR/README.md" "$stage/usr/share/doc/$PACKAGE_NAME/README.md"

cp -a "$ROOT_DIR/src/waddle" "$stage/usr/lib/waddle/src/"
cp -a "$ROOT_DIR/src/waddle_desktop" "$stage/usr/lib/waddle/src/"
cp -a "$ROOT_DIR/src/cli_harness" "$stage/usr/lib/waddle/src/"
cp -a "$ROOT_DIR/skills/." "$stage/usr/lib/waddle/skills/"
cp -a "$ROOT_DIR/assets/." "$stage/usr/lib/waddle/assets/"

find "$stage" \
  \( -name '__pycache__' -o -name '*.pyc' -o -name '*.pyo' -o -name '.pytest_cache' \) \
  -prune -exec rm -rf {} +

find "$stage" -type d -exec chmod 0755 {} +
find "$stage" -type f -exec chmod 0644 {} +
chmod 0755 "$stage/usr/bin/waddle-desktop"

installed_size="$(
  du -sk "$stage/usr" | awk '{print $1}'
)"
sed \
  -e "s/@VERSION@/$DEB_VERSION/g" \
  -e "s/@INSTALLED_SIZE@/$installed_size/g" \
  "$TEMPLATE_DIR/control.in" > "$stage/DEBIAN/control"

(
  cd "$stage"
  find usr -type f -print0 | sort -z | xargs -0 md5sum > DEBIAN/md5sums
)

find "$stage" -exec touch -h -d "@$SOURCE_DATE_EPOCH" {} +

deb_path="$OUTPUT_DIR/${PACKAGE_NAME}_${DEB_VERSION}_${ARCHITECTURE}.deb"
rm -f "$deb_path"
dpkg-deb --root-owner-group -Zxz -z9 --build "$stage" "$deb_path" >/dev/null

printf '%s\n' "$deb_path"
