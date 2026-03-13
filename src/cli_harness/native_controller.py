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
)

INTERNAL_TRACE_PREFIXES = (
    "Explored",
    "Read ",
    "Searching",
    "Opening",
    "Vou ",
    "The user ",
    "I should ",
)

GREETING_VARIANTS: dict[str, list[tuple[str, str]]] = {
    "morning": [
        ("Bom dia, {name}", "Vamos abrir o dia com alguma coisa util."),
        ("Bom dia, {name}", "Se tiver algo travado, vamos destravar cedo."),
        ("Comeco de dia, {name}", "Boa hora para organizar as prioridades."),
        ("Manha boa, {name}", "Dá para sair com bastante coisa resolvida."),
        ("Bom dia, {name}", "Se quiser, a gente começa pelo mais dificil."),
        ("Modo foco, {name}", "Vamos aproveitar a manha enquanto ela rende."),
        ("Bom dia, {name}", "Hora de colocar as ideias em ordem."),
        ("Partiu resolver, {name}", "A manha costuma ser a melhor janela."),
        ("Bom dia, {name}", "Se tiver bagunçado, a gente estrutura."),
        ("Primeira rodada do dia, {name}", "Vamos fazer isso andar."),
    ],
    "afternoon": [
        ("Boa tarde, {name}", "Se tiver pendencia, agora e uma boa hora para destravar."),
        ("Boa tarde, {name}", "Vamos pegar o que ficou aberto e fechar direito."),
        ("Turno da tarde, {name}", "Ainda dá para render bastante."),
        ("Boa tarde, {name}", "Se quiser, a gente retoma do ponto mais importante."),
        ("Hora de ajustar a rota, {name}", "Vamos deixar o resto do dia mais leve."),
        ("Boa tarde, {name}", "Dá para transformar essa pilha em proximos passos."),
        ("Seguimos, {name}", "A tarde ainda salva bastante coisa."),
        ("Boa tarde, {name}", "Vamos direto no que mais importa."),
        ("Tarde de trabalho, {name}", "Se tiver ruido, eu organizo contigo."),
        ("Boa tarde, {name}", "Vamos fazer progresso sem complicar."),
    ],
    "coffee": [
        ("Hora do cafe, {name}", "Uma rodada boa agora ja salva o resto da tarde."),
        ("Pausa estrategica, {name}", "Café e organizacao costumam combinar bem."),
        ("Cafe da tarde, {name}", "Vamos resolver isso antes de esfriar."),
        ("Hora do cafe, {name}", "Boa janela para limpar pendencias curtas."),
        ("Ritmo de cafe, {name}", "Se quiser, a gente fecha isso rapidinho."),
        ("Café na mesa, {name}", "Bora transformar isso em algo objetivo."),
        ("Hora boa para focar, {name}", "Um passo certo agora vale por varios depois."),
        ("Cafe e clareza, {name}", "Vamos simplificar o que estiver embolado."),
        ("Voltando pro eixo, {name}", "Hora boa para uma resposta limpa."),
        ("Hora do cafe, {name}", "Dá para sair daqui com isso encaminhado."),
    ],
    "evening": [
        ("Boa noite, {name}", "Dá para fechar isso com calma e clareza."),
        ("Boa noite, {name}", "Se quiser, a gente resolve sem pressa."),
        ("Noite produtiva, {name}", "Vamos deixar isso redondo antes de encerrar."),
        ("Boa noite, {name}", "Hora boa para lapidar o que ficou pendente."),
        ("Seguimos a noite, {name}", "Se tiver ruido, eu ajudo a simplificar."),
        ("Boa noite, {name}", "Vamos organizar a ultima rodada do dia."),
        ("Clima de fechamento, {name}", "Dá para sair com isso melhor do que entrou."),
        ("Boa noite, {name}", "Se quiser, vamos direto ao ponto."),
        ("Noite de foco, {name}", "Vamos resolver isso sem dispersao."),
        ("Boa noite, {name}", "Ainda dá para produzir algo bem feito."),
    ],
    "late_night": [
        ("Noite longa, {name}", "Se ainda estiver por aqui, vamos resolver sem complicar."),
        ("Virando a noite, {name}", "Vamos manter isso simples e objetivo."),
        ("Ainda acordado, {name}", "Então bora fechar isso direito."),
        ("Hora silenciosa, {name}", "Boa para pensar com menos ruido."),
        ("Noite funda, {name}", "Se for para fazer, vamos fazer limpo."),
        ("Ultima rodada, {name}", "Vamos deixar isso em um estado bom."),
        ("Noite de concentracao, {name}", "Se quiser, eu vou direto no essencial."),
        ("Ainda no teclado, {name}", "Vamos destravar isso com calma."),
        ("Sem enrolacao, {name}", "Hora de resolver e encerrar."),
        ("Noite longa, {name}", "Eu seguro o contexto, voce decide o ritmo."),
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
    canStopChanged = Signal()
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
        self._pending_output = ""
        self._last_prompt = ""
        self._display_name = resolve_display_name()

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

    @Property(bool, notify=canStopChanged)
    def canStop(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

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
            self._messages_model.add_message(
                "system",
                f"Reiniciando a sessao de {self.currentBackendLabel}.",
                "Sistema",
            )
            self.stop_session(announce=False)

        self._set_bridge_status("starting")
        self._pending_output = ""
        self._last_prompt = ""

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
        self._last_prompt = prompt
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

    def stop_session(self, announce: bool = True) -> None:
        if self._proc and self._proc.poll() is None:
            try:
                self._proc.send_signal(signal.SIGTERM)
            except Exception:
                pass

        if announce and (self._proc is not None or self._bridge_status == "ready"):
            self._messages_model.add_message(
                "system",
                f"Sessao de {self.currentBackendLabel} encerrada.",
                "Sistema",
            )

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
        self._pending_output = ""
        self.canStopChanged.emit()

    def _set_bridge_status(self, value: str) -> None:
        if value == self._bridge_status:
            return
        self._bridge_status = value
        self.bridgeStatusChanged.emit()
        self.canSendChanged.emit()
        self.canStopChanged.emit()

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
            return

        # Flush long partial fragments to keep visible streaming alive.
        if len(self._pending_output.strip()) > 160:
            partial = self._clean_backend_line(self._pending_output)
            self._pending_output = ""
            if partial:
                self._messages_model.append_to_last_ai(partial)
                self._messages_model.set_last_ai_meta(self.currentBackendLabel)

    def _flush_pending_output(self) -> None:
        if not self._pending_output.strip():
            self._pending_output = ""
            return

        cleaned = self._clean_backend_line(self._pending_output)
        self._pending_output = ""
        if cleaned:
            self._messages_model.append_to_last_ai(cleaned)
            self._messages_model.set_last_ai_meta(self.currentBackendLabel)

    def _clean_backend_line(self, line: str) -> str | None:
        stripped = line.strip()
        if not stripped:
            return ""

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

    def _looks_like_prompt_echo(self, text: str) -> bool:
        if not self._last_prompt:
            return False

        normalized_line = normalize_prompt_text(text)
        normalized_prompt = normalize_prompt_text(self._last_prompt)
        if not normalized_line:
            return False

        return normalized_line == normalized_prompt
