# CLI AI Harness

Python core for AI CLI orchestration, now with a native desktop shell built in `PySide6 + QML`.

Quick start

Install deps:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Run the native desktop app (from project root):

```bash
PYTHONPATH=src python -m cli_harness.native_app
```

Or, if installed as a package:

```bash
cli-ai-native
```

Install the app in your Linux session with a launcher and desktop shortcut:

```bash
./scripts/install_native_app.sh
```

Remove the launcher and desktop shortcut:

```bash
./scripts/uninstall_native_app.sh
```

Run the terminal CLI (from project root):

```bash
PYTHONPATH=src python -m cli_harness.cli --help
```

Example:

```bash
PYTHONPATH=src python -m cli_harness.cli chat --backend dummy --message "Hello"
```

Interactive REPL backends (Codex / Qwen) in terminal mode:

```bash
PYTHONPATH=src python -m cli_harness.cli chat --backend codex
PYTHONPATH=src python -m cli_harness.cli chat --backend qwen
```

Override the command (optional):

```bash
CODEX_CMD="codex --model gpt-5.3-codex" PYTHONPATH=src python -m cli_harness.cli chat --backend codex
QWEN_CMD="qwen --model coder-model" PYTHONPATH=src python -m cli_harness.cli chat --backend qwen
```

Files created:

- src/cli_harness: core package
- src/cli_harness/backends: backend adapters (dummy example)
- src/cli_harness/qml: native desktop UI
- .env.example: env template
