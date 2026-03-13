from __future__ import annotations

import os
import pty
import re
import shlex
import signal
import subprocess
import termios
from datetime import datetime
from typing import Any

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
from .history import HistoryStore


ANSI_ESCAPE_RE = re.compile(
    r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\].*?(?:\x07|\x1B\\))"
)


def sanitize_terminal_text(text: str) -> str:
    cleaned = ANSI_ESCAPE_RE.sub("", text)
    cleaned = cleaned.replace("\r", "")
    cleaned = cleaned.replace("\x00", "")
    return cleaned


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
        self.beginInsertRows(QModelIndex(), len(self._items), len(self._items))
        self._items.append({"role": role, "content": content, "meta": meta})
        self.endInsertRows()

    def append_to_last_ai(self, content: str) -> None:
        if not self._items or self._items[-1]["role"] != "ai":
            self.add_message("ai", content, "")
            return

        last_index = len(self._items) - 1
        self._items[last_index]["content"] += content
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
    greetingChanged = Signal()
    currentBackendLabelChanged = Signal()
    composerPlaceholderChanged = Signal()
    canSendChanged = Signal()
    messagesModelChanged = Signal()

    def __init__(self) -> None:
        super().__init__()
        self._selected_backend = "codex"
        self._bridge_status = "idle"
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
        self.selectedBackendChanged.emit()
        self.currentBackendLabelChanged.emit()
        self.composerPlaceholderChanged.emit()

    @Property(str, notify=currentBackendLabelChanged)
    def currentBackendLabel(self) -> str:
        return self._selected_backend.capitalize()

    @Property(str, notify=bridgeStatusChanged)
    def bridgeStatus(self) -> str:
        return self._bridge_status

    @Property(bool, notify=canSendChanged)
    def canSend(self) -> bool:
        return self._bridge_status != "starting"

    @Property(str, notify=greetingChanged)
    def greeting(self) -> str:
        current_hour = datetime.now().hour
        if current_hour < 12:
            return "Bom dia"
        if current_hour < 18:
            return "Boa tarde"
        return "Boa noite"

    @Property(str, notify=composerPlaceholderChanged)
    def composerPlaceholder(self) -> str:
        return f"Comece a conversa com {self.currentBackendLabel}..."

    @Property(str, notify=bridgeStatusChanged)
    def statusTitle(self) -> str:
        if self._bridge_status == "ready":
            return "Sessao ativa"
        if self._bridge_status == "starting":
            return "Conectando"
        if self._bridge_status == "error":
            return "Falha na conexao"
        return "Pronto para iniciar"

    @Property(str, notify=bridgeStatusChanged)
    def statusDescription(self) -> str:
        if self._bridge_status == "ready":
            return "O CLI selecionado esta conectado e pronto para responder."
        if self._bridge_status == "starting":
            return "Abrindo uma sessao persistente para o agente."
        if self._bridge_status == "error":
            return "Nao foi possivel iniciar ou manter a sessao do agente."
        return "Escolha um CLI e comece a conversa pelo campo de prompt."

    @Slot()
    def connectBackend(self) -> None:
        if self._proc and self._proc.poll() is None:
            self._set_bridge_status("ready")
            return

        self._set_bridge_status("starting")

        command = resolve_backend_command(self._selected_backend)
        self._command_label = command
        master_fd = None
        slave_fd = None

        try:
            master_fd, slave_fd = pty.openpty()
            attrs = termios.tcgetattr(slave_fd)
            attrs[3] &= ~termios.ECHO
            termios.tcsetattr(slave_fd, termios.TCSANOW, attrs)

            self._proc = subprocess.Popen(
                shlex.split(command),
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                cwd=os.getcwd(),
                close_fds=True,
            )
            os.close(slave_fd)
            self._master_fd = master_fd
            self._bind_notifier()
            self._poll_timer.start()

            if self._history:
                self._session_id = self._history.start_session(
                    self._selected_backend, command
                )

            self._set_bridge_status("ready")
            self._messages_model.add_message(
                "system",
                f"Conectado a {self.currentBackendLabel}. Envie seu primeiro prompt.",
                "Sistema",
            )
        except Exception as exc:
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
            self._set_bridge_status("error")
            self._messages_model.add_message(
                "system",
                f"Nao foi possivel iniciar {self.currentBackendLabel}: {exc}",
                "Sistema",
            )
            self._teardown_process()

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

        self._messages_model.add_message("user", prompt, "Voce")
        if self._history and self._session_id is not None:
            self._history.log_event(self._session_id, "in", prompt + "\n")

        try:
            os.write(self._master_fd, (prompt + "\n").encode("utf-8"))
        except OSError as exc:
            self._set_bridge_status("error")
            self._messages_model.add_message(
                "system",
                f"Falha ao enviar mensagem para {self.currentBackendLabel}: {exc}",
                "Sistema",
            )

    @Slot(str)
    def sendQuickCommand(self, command: str) -> None:
        if not command.strip():
            return
        self.sendPrompt(command)

    @Slot()
    def stopSession(self) -> None:
        self.stop_session()

    def stop_session(self) -> None:
        if self._proc and self._proc.poll() is None:
            try:
                self._proc.send_signal(signal.SIGTERM)
            except Exception:
                pass

        self._finalize_history()
        self._teardown_process()
        self._set_bridge_status("idle")

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

        if self._history and self._session_id is not None:
            self._history.log_event(self._session_id, "out", text)

        self._messages_model.append_to_last_ai(text)
        self._messages_model.set_last_ai_meta(self.currentBackendLabel)

    def _check_process_state(self) -> None:
        if not self._proc:
            return

        if self._proc.poll() is not None:
            self._handle_backend_exit()

    def _handle_backend_exit(self) -> None:
        if not self._proc:
            return

        return_code = self._proc.poll()
        self._finalize_history()
        self._teardown_process()

        if return_code in (0, None):
            self._set_bridge_status("idle")
            return

        self._set_bridge_status("error")
        self._messages_model.add_message(
            "system",
            f"{self.currentBackendLabel} encerrou a sessao com codigo {return_code}.",
            "Sistema",
        )

    def _finalize_history(self) -> None:
        if self._history and self._session_id is not None:
            self._history.end_session(self._session_id)
        self._session_id = None

    def _teardown_process(self) -> None:
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

    def _set_bridge_status(self, value: str) -> None:
        if value == self._bridge_status:
            return
        self._bridge_status = value
        self.bridgeStatusChanged.emit()
        self.canSendChanged.emit()
