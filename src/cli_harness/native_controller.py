from __future__ import annotations

import html
import os
import pty
import re
import shlex
import shutil
import subprocess
import termios
from datetime import datetime
from typing import Any
from pathlib import Path

from PySide6.QtCore import (
    QAbstractListModel,
    QModelIndex,
    QObject,
    Property,
    QSocketNotifier,
    Qt,
    QTimer,
    Signal,
    Slot,
)


from .backend_commands import resolve_backend_command
from .config import ENV_PATH, get_env_value, get_obsidian_vault_path, set_env_value
from .history import HistoryStore
from dotenv import load_dotenv

# Load project .env explicitly so launcher/cwd do not affect command resolution.
load_dotenv(dotenv_path=ENV_PATH)


def markdown_to_html(text: str) -> str:
    """
    Convert basic Markdown to HTML for QML TextEdit rich text rendering.
    Handles code blocks, inline code, bold, italic, and lists.
    """
    if not text:
        return text

    html_text = text
    code_blocks: list[tuple[str, str]] = []

    # Replace fenced code blocks with placeholders first, then process remaining text.
    def stash_code_block(match: re.Match[str]) -> str:
        lang = html.escape(match.group(1) or "")
        code = html.escape(match.group(2))
        lang_label = (
            "<div style='background:#2d1f4e;color:#c4b5fd;padding:4px 8px;font-size:11px;"
            "font-weight:bold;border:1px solid #6d28d9;border-bottom:none;display:flex;"
            "justify-content:space-between;align-items:center;'><span>"
            f"{lang}</span></div>"
            if lang
            else ""
        )
        block_html = (
            "<div style='background:#1e1b3a;border:1px solid #4c1d95;border-radius:0;"
            "margin:8px 0;overflow:hidden;'><pre style='margin:0;padding:8px;"
            "background:#0f172a;color:#e2e8f0;font-family:\"JetBrains Mono\",\"Consolas\","
            "\"Monospace\";font-size:13px;white-space:pre-wrap;word-wrap:break-word;'>"
            f"<code>{code}</code></pre>{lang_label}</div>"
        )
        token = f"@@CODEBLOCK_{len(code_blocks)}@@"
        code_blocks.append((token, block_html))
        return token

    html_text = re.sub(r"```(\w*)\n(.*?)```", stash_code_block, html_text, flags=re.DOTALL)
    html_text = html.escape(html_text)

    # Inline code (`code`)
    def replace_inline_code(match: re.Match[str]) -> str:
        code = html.escape(match.group(1))
        return (
            '<span style="background:#2d1f4e;color:#e2e8f0;padding:2px 6px;border-radius:0;'
            'font-family:&quot;JetBrains Mono&quot;,&quot;Monospace&quot;;font-size:12px;">'
            f"{code}</span>"
        )

    html_text = re.sub(r"`([^`]+)`", replace_inline_code, html_text)

    # Bold (**text** or __text__)
    html_text = re.sub(r"\*\*([^*]+)\*\*", r'<span style="font-weight:bold;">\1</span>', html_text)
    html_text = re.sub(r"__([^_]+)__", r'<span style="font-weight:bold;">\1</span>', html_text)

    # Italic (*text* or _text_)
    html_text = re.sub(r"\*([^*]+)\*", r'<span style="font-style:italic;">\1</span>', html_text)
    html_text = re.sub(r"_([^_]+)_", r'<span style="font-style:italic;">\1</span>', html_text)

    # Headers
    html_text = re.sub(
        r"^### (.+)$",
        r'<span style="font-size:16px;font-weight:bold;color:#f8fbff;">\1</span>',
        html_text,
        flags=re.MULTILINE,
    )
    html_text = re.sub(
        r"^## (.+)$",
        r'<span style="font-size:18px;font-weight:bold;color:#f8fbff;">\1</span>',
        html_text,
        flags=re.MULTILINE,
    )
    html_text = re.sub(
        r"^# (.+)$",
        r'<span style="font-size:20px;font-weight:bold;color:#f8fbff;">\1</span>',
        html_text,
        flags=re.MULTILINE,
    )

    # Line breaks (preserve paragraphs)
    lines = html_text.split("\n")
    processed_lines = []
    in_list = False

    for i, line in enumerate(lines):
        stripped = line.strip()

        # Unordered lists (- item, * item, • item)
        list_match = re.match(r'^[-*•]\s+(.+)$', stripped)
        if list_match:
            if not in_list:
                processed_lines.append('<div style="margin:8px 0;">')
                in_list = True
            item_content = list_match.group(1)
            processed_lines.append(f'<div style="padding-left:16px;">• {item_content}</div>')
        else:
            if in_list:
                processed_lines.append('</div>')
                in_list = False

            # Empty lines become paragraph breaks
            if not stripped:
                processed_lines.append('<br/>')
            else:
                processed_lines.append(line)

    if in_list:
        processed_lines.append('</div>')

    html_text = "\n".join(processed_lines)

    # Convert newlines to <br/> for non-block content
    html_text = html_text.replace("\n", "<br/>")

    # Clean up multiple <br/>
    html_text = re.sub(r"(<br/>){3,}", "<br/><br/>", html_text)

    for token, block in code_blocks:
        html_text = html_text.replace(token, block)

    return html_text


def split_command_parts(command: str) -> list[str] | None:
    stripped = command.strip()
    if not stripped:
        return None
    try:
        parts = shlex.split(stripped)
    except ValueError:
        return None
    return parts or None


DEFAULT_RESPONSE_TIMEOUT_SECONDS = 20
MIN_RESPONSE_TIMEOUT_SECONDS = 5
MAX_RESPONSE_TIMEOUT_SECONDS = 180
DEFAULT_CONNECT_RETRY_ATTEMPTS = 2

SESSION_STATE_TRANSITIONS: dict[str, set[str]] = {
    "idle": {"starting"},
    "starting": {"idle", "ready", "error"},
    "ready": {"idle", "error", "streaming"},
    "streaming": {"idle", "error", "ready"},
    "error": {"idle", "starting"},
}


def parse_response_timeout_seconds(
    value: str | None,
    *,
    default_seconds: int = DEFAULT_RESPONSE_TIMEOUT_SECONDS,
) -> int:
    raw = (value or "").strip()
    if not raw:
        return default_seconds
    try:
        parsed = int(float(raw))
    except ValueError:
        return default_seconds
    return max(MIN_RESPONSE_TIMEOUT_SECONDS, min(MAX_RESPONSE_TIMEOUT_SECONDS, parsed))


def resolve_session_state(bridge_status: str, awaiting_response: bool) -> str:
    if bridge_status == "starting":
        return "starting"
    if bridge_status == "error":
        return "error"
    if bridge_status == "ready" and awaiting_response:
        return "streaming"
    if bridge_status == "ready":
        return "ready"
    return "idle"


ANSI_ESCAPE_RE = re.compile(
    r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\].*?(?:\x07|\x1B\\))"
)
DRAWING_LINE_RE = re.compile(r"^[\s\-\u2500-\u257f\u2580-\u259f]+$")
PROMPT_MARKER_RE = re.compile(r"^[>\u203a]\s*")
BULLET_MARKER_RE = re.compile(r"^[\u2022\u2726]\s+")
WHITESPACE_RE = re.compile(r"\s+")

UI_NOISE_PREFIXES = (
    "Tip:",
    "Tips:",
    "OpenAI Codex",
    "Qwen Code",
    "Qwen OAuth",
    "model:",
    "directory:",
    "You are running Qwen Code",
    "It is recommended to run",
    "Tip: New",
    "/model to change",
    # Qwen-specific noise
    "Press Escape",
    "Shift+Tab",
    "ctrl+",
    "Ctrl+",
    "Auto-update",
    "Checking for",
    "npm warn",
    "npm notice",
)

QWEN_TUI_NOISE_RE = re.compile(
    r"""
    (?:
        \x1B\[[\d;]*[A-Za-z]   # CSI sequences (cursor, erase, etc.)
      | \x1B\][^\x07]*\x07      # OSC sequences
      | \x1B[@-_][0-9;]*[A-Za-z]
      | [\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]  # other control chars
    )
    """,
    re.VERBOSE,
)

# Lines that look like Qwen's TUI chrome (borders, key hints, status bars)
QWEN_CHROME_RE = re.compile(
    r"^[\s│┃╔╗╚╝═╠╣╦╩╬─┼╭╮╰╯·•◆◇▶▸]+$"
)
BRAILLE_SPINNER_RE = re.compile(r"^[\u2800-\u28ff\s]+$")

INTERNAL_TRACE_PREFIXES = (
    "Explored",
    "Read ",
    "Searching",
    "Opening",
    "I will ",
    "The user ",
    "I should ",
)

GREETING_VARIANTS: dict[str, list[tuple[str, str]]] = {
    "morning": [
        ("Good morning, {name}", "Let's start the day with something useful."),
        ("Good morning, {name}", "If something is stuck, let's unblock it early."),
        ("Start of day, {name}", "A good time to organize priorities."),
        ("Morning mode, {name}", "We can get a lot done right now."),
        ("Good morning, {name}", "If you want, we can start with the hardest part."),
        ("Focus mode, {name}", "Let's use the morning while it has momentum."),
        ("Good morning, {name}", "Time to put ideas in order."),
        ("Let's solve it, {name}", "Morning is usually the best window."),
        ("Good morning, {name}", "If it's messy, we'll structure it."),
        ("First round of the day, {name}", "Let's move this forward."),
    ],
    "afternoon": [
        ("Good afternoon, {name}", "If there's a pending item, now is a good time to unblock it."),
        ("Good afternoon, {name}", "Let's close what was left open."),
        ("Afternoon shift, {name}", "There's still time to produce a lot."),
        ("Good afternoon, {name}", "If you want, we can resume from the most important point."),
        ("Time to adjust course, {name}", "Let's make the rest of the day lighter."),
        ("Good afternoon, {name}", "We can turn this pile into clear next steps."),
        ("Let's keep going, {name}", "The afternoon can still save a lot."),
        ("Good afternoon, {name}", "Let's go straight to what matters most."),
        ("Work block, {name}", "If there is noise, I'll help organize it."),
        ("Good afternoon, {name}", "Let's make progress without overcomplicating."),
    ],
    "coffee": [
        ("Coffee break, {name}", "A good round now saves the rest of the afternoon."),
        ("Strategic pause, {name}", "Coffee and organization usually pair well."),
        ("Afternoon coffee, {name}", "Let's solve this before it gets cold."),
        ("Coffee time, {name}", "A good window to clear short pending tasks."),
        ("Coffee pace, {name}", "If you want, we can wrap this up quickly."),
        ("Coffee on the desk, {name}", "Let's turn this into something objective."),
        ("Good focus window, {name}", "One right step now saves many later."),
        ("Coffee and clarity, {name}", "Let's simplify whatever is tangled."),
        ("Back on track, {name}", "A good time for a clean answer."),
        ("Coffee time, {name}", "We can leave this in a good state now."),
    ],
    "evening": [
        ("Good evening, {name}", "We can close this calmly and clearly."),
        ("Good evening, {name}", "If you want, we can solve this without rushing."),
        ("Productive evening, {name}", "Let's tighten this up before we finish."),
        ("Good evening, {name}", "A good time to refine what's still pending."),
        ("Evening run, {name}", "If there is noise, I can help simplify."),
        ("Good evening, {name}", "Let's organize the last round of the day."),
        ("Wrap-up mode, {name}", "We can leave this better than we found it."),
        ("Good evening, {name}", "If you want, let's go straight to the point."),
        ("Focus night, {name}", "Let's solve this without distraction."),
        ("Good evening, {name}", "There's still time to produce quality output."),
    ],
    "late_night": [
        ("Late night, {name}", "If you're still here, let's solve this cleanly."),
        ("Night shift, {name}", "Let's keep this simple and objective."),
        ("Still awake, {name}", "Let's close this properly."),
        ("Quiet hours, {name}", "Good time to think with less noise."),
        ("Deep night, {name}", "If we do it, let's do it cleanly."),
        ("Final round, {name}", "Let's leave this in a good state."),
        ("Concentration mode, {name}", "If you want, I'll go straight to essentials."),
        ("Still at the keyboard, {name}", "Let's unblock this calmly."),
        ("No detours, {name}", "Time to solve and wrap up."),
        ("Late night, {name}", "I'll hold the context, you set the pace."),
    ],
}


def sanitize_terminal_text(text: str) -> str:
    cleaned = ANSI_ESCAPE_RE.sub("", text)
    cleaned = cleaned.replace("\r", "")
    cleaned = cleaned.replace("\x00", "")
    return cleaned


def normalize_prompt_text(text: str) -> str:
    normalized = PROMPT_MARKER_RE.sub("", text.strip())
    normalized = normalized.strip("\"'` ")
    normalized = WHITESPACE_RE.sub(" ", normalized)
    return normalized.lower()


def is_ui_noise_line(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False

    if DRAWING_LINE_RE.match(stripped):
        return True

    if any(char in stripped for char in "╭╮╰╯│┌┐└┘"):
        return True

    return stripped.startswith(UI_NOISE_PREFIXES)


def is_backend_chrome_line(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False

    lower = stripped.lower()
    if BRAILLE_SPINNER_RE.match(stripped):
        return True
    if stripped in {"10;?", "2;"}:
        return True
    if stripped.startswith("Reconnecting..."):
        return True
    if stripped.startswith("Initializing..."):
        return True
    if stripped.startswith("Connecting to MCP servers"):
        return True
    if re.match(r"^\d+;qwen\b", lower):
        return True
    if re.match(r"^\d+;[a-z0-9._-]+$", lower):
        return True
    if "type your message or @path/to/file" in lower:
        return True
    if stripped.startswith("? for shortcuts"):
        return True
    if re.match(r"^\d+;.*for shortcuts", lower):
        return True
    if re.match(r"^\d+;[^\s]{0,16}$", stripped):
        return True

    return False


def resolve_display_name() -> str:
    preferred = (os.getenv("OSAURUS_NAME") or "").strip()
    if preferred:
        return preferred.split()[0]

    system_name = (os.getenv("USER") or os.getenv("USERNAME") or "").strip()
    if not system_name:
        return ""

    cleaned = re.sub(r"[^A-Za-zÀ-ÿ0-9_-]", "", system_name)
    if not cleaned:
        return ""
    return cleaned[:1].upper() + cleaned[1:]


def get_greeting_period(current_hour: int) -> str:
    if current_hour < 12:
        return "morning"
    if current_hour < 15:
        return "afternoon"
    if current_hour < 18:
        return "coffee"
    if current_hour < 22:
        return "evening"
    return "late_night"


class MessageListModel(QAbstractListModel):
    RoleRole = Qt.ItemDataRole.UserRole + 1
    ContentRole = Qt.ItemDataRole.UserRole + 2
    MetaRole = Qt.ItemDataRole.UserRole + 3

    def __init__(self) -> None:
        super().__init__()
        self._items: list[dict[str, str]] = []

    def rowCount(self, parent: QModelIndex = QModelIndex()) -> int:
        if parent.isValid():
            return 0
        return len(self._items)

    def data(self, index: QModelIndex, role: int = Qt.ItemDataRole.DisplayRole) -> Any:
        if not index.isValid():
            return None

        item = self._items[index.row()]
        if role == self.RoleRole:
            return item["role"]
        if role == self.ContentRole:
            return item["content"]
        if role == self.MetaRole:
            return item["meta"]
        return None

    def roleNames(self) -> dict[int, bytes]:
        return {
            self.RoleRole: b"role",
            self.ContentRole: b"content",
            self.MetaRole: b"meta",
        }

    def clear(self) -> None:
        self.beginResetModel()
        self._items.clear()
        self.endResetModel()

    def add_message(self, role: str, content: str, meta: str) -> None:
        if not content:
            return
        # Convert markdown to HTML for AI messages
        if role == "ai":
            content = markdown_to_html(content)
        self.beginInsertRows(QModelIndex(), len(self._items), len(self._items))
        self._items.append({"role": role, "content": content, "meta": meta})
        self.endInsertRows()

    def append_to_last_ai(self, content: str) -> None:
        if not self._items or self._items[-1]["role"] != "ai":
            self.add_message("ai", content, "")
            return

        last_index = len(self._items) - 1
        # Convert markdown to HTML for AI messages
        html_content = markdown_to_html(content)
        self._items[last_index]["content"] += html_content
        model_index = self.index(last_index, 0)
        self.dataChanged.emit(model_index, model_index, [self.ContentRole])

    def set_last_ai_meta(self, meta: str) -> None:
        if not self._items or self._items[-1]["role"] != "ai":
            return
        last_index = len(self._items) - 1
        self._items[last_index]["meta"] = meta
        model_index = self.index(last_index, 0)
        self.dataChanged.emit(model_index, model_index, [self.MetaRole])


class NativeChatController(QObject):
    selectedBackendChanged = Signal()
    bridgeStatusChanged = Signal()
    sessionStateChanged = Signal()
    greetingChanged = Signal()
    currentBackendLabelChanged = Signal()
    composerPlaceholderChanged = Signal()
    canSendChanged = Signal()
    canStopChanged = Signal()
    awaitingResponseChanged = Signal()
    needsReconnectChanged = Signal()
    settingsChanged = Signal()
    missingCliNameChanged = Signal()
    messagesModelChanged = Signal()
    mascotUrlChanged = Signal()
    mascotStateChanged = Signal()
    walkAnimationTriggered = Signal()  # Trigger walk animation (out then in)

    def __init__(self) -> None:
        super().__init__()
        self._selected_backend = self._load_last_backend()
        self._bridge_status = "idle"
        self._session_state = "idle"
        self._needs_reconnect = False
        self._messages_model = MessageListModel()
        self._proc: subprocess.Popen | None = None
        self._master_fd: int | None = None
        self._notifier: QSocketNotifier | None = None
        self._poll_timer = QTimer(self)
        self._poll_timer.setInterval(300)
        self._poll_timer.timeout.connect(self._check_process_state)
        self._history = HistoryStore.open()
        self._session_id: int | None = None
        self._command_label: str | None = None
        self._pending_output = ""
        self._last_prompt = ""
        self._awaiting_response = False
        self._display_name = resolve_display_name()
        self._missing_cli_name = ""
        # History event buffer for debounced SQLite writes
        self._history_buffer: list[tuple[str, str]] = []  # (direction, content)
        self._history_flush_timer = QTimer(self)
        self._history_flush_timer.setInterval(2500)  # flush every 2.5s
        self._history_flush_timer.setSingleShot(False)
        self._history_flush_timer.timeout.connect(self._flush_history_buffer)
        self._history_flush_timer.start()
        # Mascot variant tracking
        self._mascot_index = 0
        self._mascot_url = ""
        # Mascot emotional state tracking
        self._mascot_state = "idle"  # idle, thinking, typing, error, success, streaming
        self._mascot_state_timer = QTimer(self)
        self._mascot_state_timer.setInterval(300)
        self._mascot_state_timer.timeout.connect(self._update_mascot_state)
        self._mascot_state_timer.start()
        # Response streaming tracking
        self._last_message_count = 0
        self._streaming_since = 0
        # Detect silent sessions where CLI never returns any assistant output.
        self._response_timeout_timer = QTimer(self)
        self._response_timeout_seconds = self._load_response_timeout_seconds()
        self._connect_retry_attempts = DEFAULT_CONNECT_RETRY_ATTEMPTS
        self._response_timeout_timer.setInterval(self._response_timeout_seconds * 1000)
        self._response_timeout_timer.setSingleShot(True)
        self._response_timeout_timer.timeout.connect(self._handle_response_timeout)

    @Property(QObject, notify=messagesModelChanged)
    def messagesModel(self) -> MessageListModel:
        return self._messages_model

    @Property(str, notify=selectedBackendChanged)
    def selectedBackend(self) -> str:
        return self._selected_backend

    @selectedBackend.setter
    def selectedBackend(self, value: str) -> None:
        if value == self._selected_backend:
            return

        self.stop_session()
        self._messages_model.clear()
        self._selected_backend = value
        self._set_bridge_status("idle")
        self._set_needs_reconnect(False)
        self._save_last_backend(value)
        self.selectedBackendChanged.emit()
        self.currentBackendLabelChanged.emit()
        self.composerPlaceholderChanged.emit()

    @Property(str, notify=currentBackendLabelChanged)
    def currentBackendLabel(self) -> str:
        return self._selected_backend.capitalize()

    @Property(str, notify=bridgeStatusChanged)
    def bridgeStatus(self) -> str:
        return self._bridge_status

    @Property(str, notify=sessionStateChanged)
    def sessionState(self) -> str:
        return self._session_state

    @Property(bool, notify=canSendChanged)
    def canSend(self) -> bool:
        return self._session_state in ("ready", "idle")

    @Property(bool, notify=needsReconnectChanged)
    def needsReconnect(self) -> bool:
        return self._needs_reconnect

    @Property(bool, notify=canStopChanged)
    def canStop(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    @Property(bool, notify=awaitingResponseChanged)
    def awaitingResponse(self) -> bool:
        return self._awaiting_response

    @Property(str, notify=greetingChanged)
    def greeting(self) -> str:
        title, _subtitle = self._current_greeting_pair()
        return title

    @Property(str, notify=greetingChanged)
    def greetingSubtitle(self) -> str:
        _title, subtitle = self._current_greeting_pair()
        return subtitle

    @Property(str, notify=composerPlaceholderChanged)
    def composerPlaceholder(self) -> str:
        return f"Start the conversation with {self.currentBackendLabel}..."

    @Property(str, notify=settingsChanged)
    def obsidianVaultPath(self) -> str:
        return str(get_obsidian_vault_path())

    @Property(str, notify=settingsChanged)
    def codexCommand(self) -> str:
        return get_env_value("CODEX_CMD", "codex") or "codex"

    @Property(str, notify=settingsChanged)
    def qwenCommand(self) -> str:
        return get_env_value("QWEN_CMD", "qwen") or "qwen"

    @Property(str, notify=settingsChanged)
    def displayName(self) -> str:
        return get_env_value("OSAURUS_NAME", "") or ""

    @Property(int, notify=settingsChanged)
    def responseTimeoutSeconds(self) -> int:
        return self._response_timeout_seconds

    @Property(str, notify=missingCliNameChanged)
    def missingCliName(self) -> str:
        return self._missing_cli_name

    @Property(str, notify=sessionStateChanged)
    def statusTitle(self) -> str:
        if self._session_state == "streaming":
            return "Receiving response"
        if self._bridge_status == "ready":
            return "Session active"
        if self._bridge_status == "starting":
            return "Connecting"
        if self._bridge_status == "error":
            return "Connection failed"
        return "Ready to start"

    @Property(str, notify=sessionStateChanged)
    def statusDescription(self) -> str:
        if self._session_state == "streaming":
            return "The backend is processing your last prompt."
        if self._bridge_status == "ready":
            return "The selected CLI is connected and ready to respond."
        if self._bridge_status == "starting":
            return "Opening a persistent session for the agent."
        if self._bridge_status == "error":
            return "Could not start or keep the agent session running."
        return "Choose a CLI and start from the prompt box."

    @Property(str, notify=mascotUrlChanged)
    def mascotUrl(self) -> str:
        return self._mascot_url

    @mascotUrl.setter
    def mascotUrl(self, value: str) -> None:
        if value == self._mascot_url:
            return
        self._mascot_url = value
        self.mascotUrlChanged.emit()

    @Property(str, notify=mascotStateChanged)
    def mascotState(self) -> str:
        return self._mascot_state

    @mascotState.setter
    def mascotState(self, value: str) -> None:
        if value == self._mascot_state:
            return
        self._mascot_state = value
        self.mascotStateChanged.emit()

    @Slot()
    def connectBackend(self) -> None:
        if self._proc and self._proc.poll() is None:
            self._messages_model.add_message(
                "system",
                f"Restarting the {self.currentBackendLabel} session.",
                "System",
            )
            self.stop_session(announce=False)

        self._set_bridge_status("starting")
        self._set_needs_reconnect(False)
        self._pending_output = ""
        self._last_prompt = ""
        self._set_awaiting_response(False)
        self._response_timeout_timer.stop()

        command = resolve_backend_command(self._selected_backend)
        self._command_label = command

        # Get full PATH from user's shell environment
        try:
            shell_path = subprocess.check_output(
                ["bash", "-ic", "echo $PATH"],
                stderr=subprocess.DEVNULL,
                timeout=5,
                text=True,
            ).strip()
        except Exception:
            shell_path = ""

        # Build clean PATH (avoid codex arg0 leftovers).
        # Paths are constructed dynamically so the app works on any machine.
        home = Path.home()
        base_paths = [
            str(home / ".npm-global" / "bin"),
            str(home / ".local" / "bin"),
            "/usr/local/sbin",
            "/usr/local/bin",
            "/usr/sbin",
            "/usr/bin",
            "/sbin",
            "/bin",
        ]
        # Also probe common NVM layout without hardcoding a node version
        nvm_bin = home / ".nvm" / "versions" / "node"
        if nvm_bin.is_dir():
            # Pick the most recent node version available
            node_versions = sorted(nvm_bin.iterdir(), reverse=True)
            if node_versions:
                base_paths.insert(0, str(node_versions[0] / "bin"))

        env = os.environ.copy()
        extra_paths = [shell_path] + base_paths
        env["PATH"] = ":".join(p for p in extra_paths if p and ".codex/tmp/arg0" not in p)
        env.setdefault("TERM", "xterm-256color")
        env.setdefault("COLORTERM", "truecolor")
        arg0_tmpdir = Path.home() / ".cache" / "codex-arg0"
        arg0_tmpdir.mkdir(parents=True, exist_ok=True)
        env["ARG0_TMPDIR"] = str(arg0_tmpdir)

        workspace_path = get_obsidian_vault_path()
        if not workspace_path.is_dir():
            self._set_bridge_status("error")
            self._messages_model.add_message(
                "system",
                (
                    f"Vault/workspace directory not found: {workspace_path}\n\n"
                    "Open Preferences, set a valid path, then use Reconnect."
                ),
                "System",
            )
            return
        env["OBSIDIAN_VAULT_PATH"] = str(workspace_path)

        command_parts = split_command_parts(command)
        if not command_parts:
            self._set_missing_cli_name("")
            self._set_bridge_status("error")
            self._messages_model.add_message(
                "system",
                (
                    f"Invalid command configured for {self.currentBackendLabel}: {command!r}\n\n"
                    "Set a valid command in Preferences. Example: codex --version"
                ),
                "System",
            )
            return

        # Check if command exists
        cmd_name = command_parts[0]
        cmd_path = shutil.which(cmd_name, path=env["PATH"])
        if not cmd_path:
            self._set_missing_cli_name(cmd_name)
            self._set_bridge_status("error")
            self._messages_model.add_message(
                "system",
                (
                    f"Command '{cmd_name}' not found in PATH.\n\n"
                    "Install the CLI or set a full command path in Preferences, then use Reconnect."
                ),
                "System",
            )
            return
        self._set_missing_cli_name("")
        startup_error: Exception | None = None
        attempts = max(1, self._connect_retry_attempts)
        for attempt in range(1, attempts + 1):
            try:
                self._start_backend_process(command_parts, workspace_path, env)
                if self._history:
                    self._session_id = self._history.start_session(
                        self._selected_backend, command
                    )
                self._save_last_backend(self._selected_backend)
                self._set_missing_cli_name("")
                self._set_bridge_status("ready")
                self._messages_model.add_message(
                    "system",
                    f"Connected to {self.currentBackendLabel} in vault {workspace_path}. Send your first prompt.",
                    "System",
                )
                if attempt > 1:
                    self._messages_model.add_message(
                        "system",
                        f"Recovered after retry ({attempt}/{attempts}).",
                        "System",
                    )
                return
            except Exception as exc:
                startup_error = exc
                self._teardown_process()
                if attempt < attempts:
                    self._messages_model.add_message(
                        "system",
                        (
                            f"Connection attempt {attempt}/{attempts} failed ({exc}). "
                            "Retrying automatically..."
                        ),
                        "System",
                    )

        self._set_bridge_status("error")
        self._messages_model.add_message(
            "system",
            (
                f"Could not start {self.currentBackendLabel} after {attempts} attempt(s): "
                f"{startup_error or 'unknown startup error'}\n\n"
                "Verify login/network, confirm command in Preferences, then use Reconnect."
            ),
            "System",
        )

    def _start_backend_process(
        self, command_parts: list[str], workspace_path: Path, env: dict[str, str]
    ) -> None:
        master_fd = None
        slave_fd = None
        try:
            master_fd, slave_fd = pty.openpty()
            attrs = termios.tcgetattr(slave_fd)
            attrs[3] &= ~termios.ECHO
            termios.tcsetattr(slave_fd, termios.TCSANOW, attrs)
            self._proc = subprocess.Popen(
                command_parts,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                cwd=str(workspace_path),
                close_fds=True,
                env=env,
            )
            os.close(slave_fd)
            self._master_fd = master_fd
            self._bind_notifier()
            self._poll_timer.start()
        except Exception:
            if slave_fd is not None:
                try:
                    os.close(slave_fd)
                except OSError:
                    pass
            if master_fd is not None:
                try:
                    os.close(master_fd)
                except OSError:
                    pass
            raise

    @Slot(str)
    def sendPrompt(self, text: str) -> None:
        prompt = text.strip()
        if not prompt:
            return

        if not self._proc or self._proc.poll() is not None:
            self.connectBackend()

        if not self._proc or self._master_fd is None:
            self._set_bridge_status("error")
            return

        self._messages_model.add_message("user", prompt, "You")
        self._last_prompt = prompt
        if self._history and self._session_id is not None:
            # User prompts go directly — we want them committed before the response
            self._history.log_event(self._session_id, "in", prompt + "\n")
            self._flush_history_buffer()

        try:
            os.write(self._master_fd, (prompt + "\n").encode("utf-8"))
            self._set_awaiting_response(True)
            self._response_timeout_timer.start()
        except OSError as exc:
            self._set_bridge_status("error")
            self._messages_model.add_message(
                "system",
                (
                    f"Failed to send message to {self.currentBackendLabel}: {exc}\n\n"
                    "Use Reconnect and try again."
                ),
                "System",
            )

    @Slot(str)
    def sendQuickCommand(self, command: str) -> None:
        if not command.strip():
            return
        self.sendPrompt(command)

    @Slot()
    def stopSession(self) -> None:
        self.stop_session()

    @Slot()
    def cycleMascot(self) -> None:
        """Cycle through available mascot variants for the current time period."""
        from .native_app import get_mascot_variants, get_time_period, get_asset_path
        from datetime import datetime

        hour = datetime.now().hour
        period = get_time_period(hour)
        variants = get_mascot_variants().get(period, [])

        if not variants:
            return

        # Move to next variant
        self._mascot_index = (self._mascot_index + 1) % len(variants)
        mascot_file = variants[self._mascot_index]

        mascot_path = get_asset_path(mascot_file)
        if mascot_path.exists():
            self.mascotUrl = mascot_path.as_uri()

    def _update_mascot_state(self) -> None:
        """
        Update mascot emotional state based on app state and activity.
        
        State mapping:
        - idle: App is idle, waiting for user input
        - thinking: User just sent a prompt, waiting for CLI to respond
        - streaming: Receiving response from CLI
        - typing: User is actively typing (detected via text changes)
        - error: Backend connection failed
        - success: Just completed a successful response
        """
        current_msg_count = self._messages_model.rowCount()
        
        # Error state takes priority
        if self._bridge_status == "error":
            if self._mascot_state != "error":
                self.mascotState = "error"
            return
        
        # Starting/connecting state
        if self._bridge_status == "starting":
            if self._mascot_state != "thinking":
                self.mascotState = "thinking"
            return
        
        # Check if we're actively streaming a response
        if self._awaiting_response and current_msg_count > self._last_message_count:
            # New message arrived while awaiting response = streaming
            self._last_message_count = current_msg_count
            self._streaming_since = 0
            if self._mascot_state != "streaming":
                self.mascotState = "streaming"
            return
        
        # Check if streaming has been ongoing (response still coming)
        if self._awaiting_response:
            # Still waiting for response, stay in streaming or thinking
            if self._mascot_state not in ("streaming", "thinking"):
                self.mascotState = "thinking"
            return
        
        # Response just completed (transition from streaming to success briefly)
        if self._mascot_state == "streaming" and not self._awaiting_response:
            # Just finished streaming - show success briefly
            if self._streaming_since == 0:
                self._streaming_since = 1  # Mark that we've noted completion
            if self._mascot_state != "success":
                self.mascotState = "success"
            return
        
        # Success state should timeout back to idle after a short delay
        if self._mascot_state == "success":
            # Success is shown briefly, then back to idle
            # This is handled by the timer - after a few cycles, go to idle
            if self._streaming_since > 3:  # ~1 second
                self._streaming_since = 0
                if self._mascot_state != "idle":
                    self.mascotState = "idle"
            else:
                self._streaming_since += 1
            return
        
        # Default: idle state
        if self._mascot_state != "idle":
            self.mascotState = "idle"
        
        # Update message count for next comparison
        self._last_message_count = current_msg_count

    def _terminate_process(self, timeout: float = 1.5) -> None:
        if self._proc and self._proc.poll() is None:
            try:
                self._proc.terminate()
            except Exception:
                return
            try:
                self._proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                try:
                    self._proc.kill()
                    self._proc.wait(timeout=1.0)
                except Exception:
                    pass

    def stop_session(self, announce: bool = True) -> None:
        self._terminate_process()

        if announce and (self._proc is not None or self._bridge_status == "ready"):
            self._messages_model.add_message(
                "system",
                f"{self.currentBackendLabel} session closed.",
                "System",
            )

        self._finalize_history()
        self._teardown_process()
        self._set_bridge_status("idle")
        
        # Trigger walk animation when session ends
        self.walkAnimationTriggered.emit()

    def _bind_notifier(self) -> None:
        if self._master_fd is None:
            return

        if self._notifier is not None:
            self._notifier.setEnabled(False)
            self._notifier.deleteLater()

        self._notifier = QSocketNotifier(
            self._master_fd, QSocketNotifier.Type.Read, self
        )
        self._notifier.activated.connect(self._read_from_backend)

    def _read_from_backend(self, *_args: object) -> None:
        if self._master_fd is None:
            return

        try:
            chunk = os.read(self._master_fd, 4096)
        except OSError:
            chunk = b""

        if not chunk:
            self._handle_backend_exit()
            return

        text = sanitize_terminal_text(chunk.decode("utf-8", errors="replace"))
        if not text.strip():
            return

        # Buffer history writes instead of committing on every chunk
        if self._history and self._session_id is not None:
            self._history_buffer.append(("out", text))

        self._append_backend_output(text)

    def _check_process_state(self) -> None:
        if not self._proc:
            return

        if self._proc.poll() is not None:
            self._handle_backend_exit()

    def _handle_backend_exit(self) -> None:
        if not self._proc:
            return

        return_code = self._proc.poll()
        self._flush_pending_output()
        self._set_awaiting_response(False)
        self._response_timeout_timer.stop()
        self._finalize_history()
        self._teardown_process()

        if return_code in (0, None):
            self._set_bridge_status("idle")
            return

        self._set_bridge_status("error")
        self._messages_model.add_message(
            "system",
            (
                f"{self.currentBackendLabel} exited the session with code {return_code}.\n\n"
                "Check backend login/network and command settings, then use Reconnect."
            ),
            "System",
        )

    def _finalize_history(self) -> None:
        self._flush_history_buffer()
        if self._history and self._session_id is not None:
            self._history.end_session(self._session_id)
        self._session_id = None

    def _flush_history_buffer(self) -> None:
        if not self._history_buffer or not self._history or self._session_id is None:
            self._history_buffer.clear()
            return
        for direction, content in self._history_buffer:
            self._history.log_event(self._session_id, direction, content)
        self._history_buffer.clear()

    def _teardown_process(self) -> None:
        self._terminate_process(timeout=0.5)

        if self._notifier is not None:
            self._notifier.setEnabled(False)
            self._notifier.deleteLater()
            self._notifier = None

        self._poll_timer.stop()

        if self._master_fd is not None:
            try:
                os.close(self._master_fd)
            except OSError:
                pass
            self._master_fd = None

        self._proc = None
        self._pending_output = ""
        self._set_awaiting_response(False)
        self._response_timeout_timer.stop()
        self.canStopChanged.emit()

    def _set_bridge_status(self, value: str) -> None:
        if value == self._bridge_status:
            self._sync_session_state()
            return
        self._bridge_status = value
        self._sync_session_state()
        self.bridgeStatusChanged.emit()
        self.canSendChanged.emit()
        self.canStopChanged.emit()
        if value == "error":
            self._set_needs_reconnect(True)
            self.mascotState = "error"
        elif value in ("starting",):
            self._set_needs_reconnect(False)
            self.mascotState = "thinking"
        elif value == "idle":
            self._set_needs_reconnect(False)
            self.mascotState = "idle"
        elif value == "ready":
            self._set_needs_reconnect(False)

    def _set_needs_reconnect(self, value: bool) -> None:
        if value == self._needs_reconnect:
            return
        self._needs_reconnect = value
        self.needsReconnectChanged.emit()

    def _set_awaiting_response(self, value: bool) -> None:
        if value == self._awaiting_response:
            return
        self._awaiting_response = value
        self._sync_session_state()
        self.awaitingResponseChanged.emit()

    def _set_missing_cli_name(self, value: str) -> None:
        if value == self._missing_cli_name:
            return
        self._missing_cli_name = value
        self.missingCliNameChanged.emit()

    def _sync_session_state(self) -> None:
        self._set_session_state(resolve_session_state(self._bridge_status, self._awaiting_response))

    def _set_session_state(self, value: str) -> None:
        if value == self._session_state:
            return
        allowed = SESSION_STATE_TRANSITIONS.get(self._session_state, set())
        if value != "idle" and value not in allowed:
            return
        self._session_state = value
        self.sessionStateChanged.emit()
        self.canSendChanged.emit()

    @staticmethod
    def _load_response_timeout_seconds() -> int:
        seconds_raw = get_env_value("WADDLE_RESPONSE_TIMEOUT_SECONDS", "")
        if (seconds_raw or "").strip():
            return parse_response_timeout_seconds(seconds_raw)

        legacy_ms = (get_env_value("WADDLE_RESPONSE_TIMEOUT_MS", "") or "").strip()
        if legacy_ms:
            try:
                ms = int(float(legacy_ms))
                return parse_response_timeout_seconds(str(round(ms / 1000)))
            except ValueError:
                return DEFAULT_RESPONSE_TIMEOUT_SECONDS
        return DEFAULT_RESPONSE_TIMEOUT_SECONDS

    @Slot(str, str, str, str, str)
    def saveSettings(
        self,
        obsidian_vault_path: str,
        codex_command: str,
        qwen_command: str,
        display_name: str,
        response_timeout_seconds: str,
    ) -> None:
        vault_value = obsidian_vault_path.strip()
        codex_value = codex_command.strip() or "codex"
        qwen_value = qwen_command.strip() or "qwen"
        display_value = display_name.strip()
        timeout_value = parse_response_timeout_seconds(response_timeout_seconds)

        set_env_value("OBSIDIAN_VAULT_PATH", vault_value)
        set_env_value("CODEX_CMD", codex_value)
        set_env_value("QWEN_CMD", qwen_value)
        set_env_value("OSAURUS_NAME", display_value)
        set_env_value("WADDLE_RESPONSE_TIMEOUT_SECONDS", str(timeout_value))

        self._response_timeout_seconds = timeout_value
        self._response_timeout_timer.setInterval(timeout_value * 1000)

        self._display_name = resolve_display_name()
        self.settingsChanged.emit()
        self.greetingChanged.emit()
        self.composerPlaceholderChanged.emit()

        self._messages_model.add_message(
            "system",
            (
                "Preferences updated. New sessions will use this configuration. "
                f"Response timeout: {self._response_timeout_seconds}s."
            ),
            "System",
        )

    @staticmethod
    def _load_last_backend() -> str:
        value = (get_env_value("WADDLE_LAST_BACKEND") or "").strip()
        return value if value in ("codex", "qwen") else "codex"

    @staticmethod
    def _save_last_backend(backend: str) -> None:
        try:
            set_env_value("WADDLE_LAST_BACKEND", backend)
        except Exception:
            pass

    def _current_greeting_pair(self) -> tuple[str, str]:
        now = datetime.now()
        period = get_greeting_period(now.hour)
        variants = GREETING_VARIANTS[period]
        index = (now.timetuple().tm_yday + now.hour) % len(variants)
        title, subtitle = variants[index]
        name = self._display_name or "Faux"
        return title.format(name=name), subtitle

    def _append_backend_output(self, text: str) -> None:
        self._pending_output += text
        lines = self._pending_output.split("\n")
        self._pending_output = lines.pop()

        fragments: list[str] = []
        for raw_line in lines:
            cleaned = self._clean_backend_line(raw_line)
            if cleaned is None:
                continue
            if cleaned == "":
                if fragments and fragments[-1] != "\n":
                    fragments.append("\n")
                continue
            fragments.append(cleaned + "\n")

        if fragments:
            payload = "".join(fragments).rstrip() + "\n"
            self._messages_model.append_to_last_ai(payload)
            self._messages_model.set_last_ai_meta(self.currentBackendLabel)
            self._set_awaiting_response(False)
            self._response_timeout_timer.stop()
            return

        # Flush long partial fragments to keep visible streaming alive.
        if len(self._pending_output.strip()) > 160:
            partial = self._clean_backend_line(self._pending_output)
            self._pending_output = ""
            if partial:
                self._messages_model.append_to_last_ai(partial)
                self._messages_model.set_last_ai_meta(self.currentBackendLabel)
                self._set_awaiting_response(False)
                self._response_timeout_timer.stop()

    def _flush_pending_output(self) -> None:
        if not self._pending_output.strip():
            self._pending_output = ""
            return

        cleaned = self._clean_backend_line(self._pending_output)
        self._pending_output = ""
        if cleaned:
            self._messages_model.append_to_last_ai(cleaned)
            self._messages_model.set_last_ai_meta(self.currentBackendLabel)
            self._set_awaiting_response(False)
            self._response_timeout_timer.stop()

    def _handle_response_timeout(self) -> None:
        if not self._awaiting_response or self._bridge_status != "ready":
            return
        self._set_awaiting_response(False)
        self._messages_model.add_message(
            "system",
            (
                f"No CLI response after {self._response_timeout_seconds}s.\n\n"
                "Check backend login/network and command settings in Preferences, "
                "then use Reconnect."
            ),
            "System",
        )

    def _clean_backend_line(self, line: str) -> str | None:
        if self._selected_backend == "qwen":
            return self._clean_qwen_line(line)

        stripped = line.strip()
        if not stripped:
            return ""

        if is_backend_chrome_line(stripped):
            return None

        if is_ui_noise_line(stripped):
            return None

        if self._looks_like_prompt_echo(stripped):
            return None

        bulletless = BULLET_MARKER_RE.sub("", stripped)
        if bulletless.startswith(INTERNAL_TRACE_PREFIXES):
            return None
        if bulletless in {"~", ">_", ">", "›"}:
            return None

        if "recommended to run in a project-specific directory" in bulletless:
            return None
        if "rate limits" in bulletless.lower():
            return None
        if "approval mode" in bulletless.lower():
            return None

        return bulletless

    def _clean_qwen_line(self, line: str) -> str | None:
        """Filter Qwen TUI chrome while preserving actual agent responses."""
        # Remove any residual terminal sequences beyond basic ANSI
        cleaned = QWEN_TUI_NOISE_RE.sub("", line)
        stripped = cleaned.strip()

        if not stripped:
            return ""

        if is_backend_chrome_line(stripped):
            return None

        # Pure TUI chrome (borders, separators, key-hint bars)
        if QWEN_CHROME_RE.match(stripped):
            return None

        if is_ui_noise_line(stripped):
            return None

        if self._looks_like_prompt_echo(stripped):
            return None

        bulletless = BULLET_MARKER_RE.sub("", stripped)
        if bulletless.startswith(INTERNAL_TRACE_PREFIXES):
            return None
        if bulletless in {"~", ">_", ">", "›", "%", "$"}:
            return None

        return stripped

    def _looks_like_prompt_echo(self, text: str) -> bool:
        if not self._last_prompt:
            return False

        normalized_line = normalize_prompt_text(text)
        normalized_prompt = normalize_prompt_text(self._last_prompt)
        if not normalized_line:
            return False

        return normalized_line == normalized_prompt
