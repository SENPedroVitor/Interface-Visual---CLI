# Waddle

Native desktop shell for AI CLI agents (Codex, Qwen). Built with PySide6 + QML.

![Waddle](assets/waddle.svg)

## Quick Start

### Install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Run the desktop app

From project root:

```bash
PYTHONPATH=src python -m cli_harness.native_app
```

### Install as a native Linux app

Install with launcher, desktop entry, and icons:

```bash
./scripts/install_native_app.sh
```

After installation, launch with:

```bash
waddle
```

Or find it in your application menu.

### Uninstall

```bash
./scripts/uninstall_native_app.sh
```

## Terminal CLI

Run the terminal CLI:

```bash
PYTHONPATH=src python -m cli_harness.cli --help
```

Example:

```bash
PYTHONPATH=src python -m cli_harness.cli chat --backend dummy --message "Hello"
```

Interactive REPL backends (Codex / Qwen):

```bash
PYTHONPATH=src python -m cli_harness.cli chat --backend codex
PYTHONPATH=src python -m cli_harness.cli chat --backend qwen
```

Override the command (optional):

```bash
CODEX_CMD="codex --model gpt-5.3-codex" PYTHONPATH=src python -m cli_harness.cli chat --backend codex
QWEN_CMD="qwen --model coder-model" PYTHONPATH=src python -m cli_harness.cli chat --backend qwen
```

## Project Structure

- `src/cli_harness/` - Core package
- `src/cli_harness/backends/` - Backend adapters (dummy, codex, qwen)
- `src/cli_harness/qml/` - Native desktop UI
- `assets/waddle.svg` - App icon
- `scripts/` - Install/uninstall scripts

## Requirements

- Python 3.9+
- PySide6 >= 6.7
- Linux desktop environment (GNOME, KDE, XFCE, etc.)
- `codex` or `qwen` CLI installed (optional, for AI features)
