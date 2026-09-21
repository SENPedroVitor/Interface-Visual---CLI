from __future__ import annotations

import asyncio
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Optional

from waddle.core.event_bus import Event, EventBus
from waddle.runtime.agent_runtime import AgentRuntime
from waddle.tools.registry import ToolRegistry

EventCallback = Callable[[dict[str, Any]], None]


def _display_time(timestamp: str | None = None) -> str:
    if not timestamp:
        return datetime.now().strftime("%H:%M")
    try:
        return datetime.fromisoformat(timestamp.replace("Z", "+00:00")).astimezone().strftime("%H:%M")
    except ValueError:
        return timestamp[:5]


class DesktopRunHandle:
    """Runs one AgentRuntime objective on a private asyncio loop/thread."""

    def __init__(
        self,
        service: "DesktopRuntimeService",
        objective: str,
        agent_name: str,
        parameters: Optional[dict[str, Any]] = None,
    ) -> None:
        self.service = service
        self.objective = objective
        self.agent_name = agent_name
        self.parameters = parameters or {}
        self.result: Optional[dict[str, Any]] = None
        self.error: Optional[BaseException] = None
        self.cancelled = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._task: Optional[asyncio.Task[dict[str, Any]]] = None
        self._started = threading.Event()
        self._finished = threading.Event()
        self._thread = threading.Thread(target=self._run, name="waddle-desktop-runtime", daemon=True)

    @property
    def is_alive(self) -> bool:
        return self._thread.is_alive()

    def start(self) -> None:
        self._thread.start()

    def wait_started(self, timeout: float = 2.0) -> bool:
        return self._started.wait(timeout)

    def wait(self, timeout: Optional[float] = None) -> Optional[dict[str, Any]]:
        self._finished.wait(timeout)
        return self.result

    def cancel(self) -> None:
        self.cancelled = True
        loop = self._loop
        task = self._task
        if loop and task and not task.done():
            loop.call_soon_threadsafe(task.cancel)

    def _run(self) -> None:
        loop = asyncio.new_event_loop()
        self._loop = loop
        asyncio.set_event_loop(loop)
        try:
            self._task = loop.create_task(
                self.service.runtime.run_objective(
                    self.objective,
                    self.parameters,
                    self.agent_name,
                )
            )
            self._started.set()
            self.result = loop.run_until_complete(self._task)
        except asyncio.CancelledError as exc:
            self.cancelled = True
            self.error = exc
        except BaseException as exc:  # propagated to the controller as status/error
            self.error = exc
        finally:
            try:
                loop.run_until_complete(loop.shutdown_asyncgens())
            finally:
                loop.close()
                self._finished.set()
                self.service._finish_run(self)


class DesktopRuntimeService:
    """Reusable desktop bridge to AgentRuntime; no localhost HTTP involved."""

    def __init__(
        self,
        *,
        db_path: Optional[str | Path] = None,
        skills_dir: Optional[str | Path] = None,
        on_event: Optional[EventCallback] = None,
        on_status: Optional[EventCallback] = None,
    ) -> None:
        self.event_bus = EventBus()
        self.tool_registry = ToolRegistry(event_bus=self.event_bus)
        self.runtime = AgentRuntime(
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            db_path=str(db_path) if db_path else None,
            skills_dir=skills_dir,
        )
        self.on_event = on_event
        self.on_status = on_status
        self._active_handle: Optional[DesktopRunHandle] = None
        self._lock = threading.RLock()
        self._selected_agent_name = "Quinta"
        self.event_bus.subscribe("*", self._forward_event)

    @property
    def selected_agent_name(self) -> str:
        return self._selected_agent_name

    @property
    def is_running(self) -> bool:
        handle = self._active_handle
        return bool(handle and handle.is_alive)

    def select_agent(self, name: str) -> dict[str, Any]:
        if not self.runtime.get_agent(name):
            raise ValueError("Agente nao encontrado.")
        self._selected_agent_name = name
        return self.get_agent(name)

    def get_agent(self, name: str) -> dict[str, Any]:
        for agent in self.list_agents():
            if agent["name"] == name:
                return agent
        raise ValueError("Agente nao encontrado.")

    def list_agents(self) -> list[dict[str, Any]]:
        agents = self.runtime.list_agents()
        ordered: list[dict[str, Any]] = []
        seen: set[str] = set()
        for agent in agents:
            name = agent.get("name", "")
            if not name or name in seen or name in {"Manager", "Worker"}:
                continue
            seen.add(name)
            ordered.append(
                {
                    **agent,
                    "accent": self._accent_for_agent(name, agent.get("role", "")),
                    "preview": agent.get("description") or agent.get("role") or "",
                }
            )
        return ordered

    def list_history(self, agent_name: Optional[str] = None, limit: int = 80) -> list[dict[str, Any]]:
        rows = self.runtime.database.list_messages(agent_name=agent_name, limit=limit)
        return [self._message_from_db(row) for row in reversed(rows)]

    def submit_prompt(
        self,
        text: str,
        agent_name: Optional[str] = None,
        parameters: Optional[dict[str, Any]] = None,
    ) -> DesktopRunHandle:
        prompt = text.strip()
        if not prompt:
            raise ValueError("Digite uma mensagem.")
        target = agent_name or self._selected_agent_name or "Quinta"
        if not self.runtime.get_agent(target):
            raise ValueError("Agente nao encontrado.")
        params = {"_source": "user_message", "_conversation_agent": target.lower()}
        if parameters:
            params.update(parameters)
        with self._lock:
            if self._active_handle and self._active_handle.is_alive:
                raise RuntimeError("Ja existe uma mensagem em processamento.")
            handle = DesktopRunHandle(self, prompt, target, params)
            self._active_handle = handle
            self._emit_status("running", f"{target} esta respondendo...", agent_name=target)
            handle.start()
            return handle

    def cancel_active(self) -> bool:
        with self._lock:
            handle = self._active_handle
            if not handle or not handle.is_alive:
                return False
            self._emit_status("cancelling", "Cancelando execucao...", agent_name=handle.agent_name)
            handle.cancel()
            return True

    def shutdown(self, timeout: float = 3.0) -> None:
        handle = self._active_handle
        if handle and handle.is_alive:
            handle.cancel()
            handle.wait(timeout)
        self.event_bus.unsubscribe("*", self._forward_event)

    def _finish_run(self, handle: DesktopRunHandle) -> None:
        with self._lock:
            if self._active_handle is handle:
                self._active_handle = None
        if handle.cancelled:
            self._emit_status("cancelled", "Execucao cancelada.", agent_name=handle.agent_name)
        elif handle.error:
            self._emit_status("failed", str(handle.error), agent_name=handle.agent_name)
        else:
            status = str((handle.result or {}).get("status") or "completed")
            self._emit_status(status, "Resposta concluida.", agent_name=handle.agent_name)

    def _emit_status(self, status: str, message: str, *, agent_name: str | None = None) -> None:
        if self.on_status:
            self.on_status(
                {
                    "kind": "status",
                    "status": status,
                    "message": message,
                    "agent_name": agent_name or self._selected_agent_name,
                    "timestamp": datetime.now().isoformat(),
                }
            )

    def _forward_event(self, event: Event) -> None:
        if not self.on_event:
            return
        payload = event.to_dict()
        if event.type == "agent.message":
            payload["desktop_message"] = self._message_from_event(event)
        self.on_event(payload)

    @staticmethod
    def _message_from_event(event: Event) -> dict[str, Any]:
        msg = event.data.get("message", {})
        timestamp = msg.get("timestamp") or event.timestamp
        sender = str(msg.get("from") or event.source or "Sistema")
        data = msg.get("data") or {}
        return {
            "id": str(msg.get("id") or event.id),
            "sender": sender.lower(),
            "sender_name": sender,
            "agent_key": str(data.get("conversation_agent") or sender).lower(),
            "kind": str(msg.get("type") or "message"),
            "content": str(msg.get("content") or ""),
            "timestamp": _display_time(timestamp),
            "raw_timestamp": timestamp,
            "is_user": False,
        }

    @staticmethod
    def _message_from_db(row: dict[str, Any]) -> dict[str, Any]:
        sender = str(row.get("from") or "Sistema")
        data = row.get("data") or {}
        timestamp = row.get("timestamp")
        return {
            "id": str(row.get("id") or ""),
            "sender": sender.lower(),
            "sender_name": sender,
            "agent_key": str(data.get("conversation_agent") or sender).lower(),
            "kind": str(row.get("type") or "message"),
            "content": str(row.get("content") or ""),
            "timestamp": _display_time(timestamp),
            "raw_timestamp": timestamp,
            "is_user": False,
        }

    @staticmethod
    def _accent_for_agent(name: str, role: str = "") -> str:
        colors = {
            "quinta": "#22c55e",
            "atlas": "#a855f7",
            "nero": "#3b82f6",
            "iris": "#f97316",
            "ma": "#1f6aa5",
            "livro": "#14b8a6",
            "mosbey": "#b8d9ff",
            "pixel": "#ff7262",
            "motion": "#a259ff",
            "data": "#14b8a6",
            "ops": "#64748b",
        }
        return colors.get(name.lower(), "#a1a1a1")
