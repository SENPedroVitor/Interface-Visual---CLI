"""Event Bus for Waddle Agent OS.

Enables decoupled, real-time reactive communication between Agents, Tasks, Tools,
Runtime, Database, and Web UI.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
import inspect
from typing import Any, Callable, Coroutine, Optional
import uuid


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Event:
    type: str
    data: dict[str, Any] = field(default_factory=dict)
    source: str = "system"
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=_utc_iso)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "data": self.data,
            "source": self.source,
            "timestamp": self.timestamp,
        }


ListenerType = Callable[[Event], Coroutine[Any, Any, None] | None]


class EventBus:
    def __init__(self, max_history: int = 500) -> None:
        self._listeners: dict[str, list[ListenerType]] = {}
        self._history: list[Event] = []
        self._max_history = max_history
        self._lock = asyncio.Lock()

    def subscribe(self, event_type: str, listener: ListenerType) -> None:
        """Subscribe a callback to a specific event_type (or '*' for all events)."""
        if event_type not in self._listeners:
            self._listeners[event_type] = []
        if listener not in self._listeners[event_type]:
            self._listeners[event_type].append(listener)

    def unsubscribe(self, event_type: str, listener: ListenerType) -> None:
        if event_type in self._listeners and listener in self._listeners[event_type]:
            self._listeners[event_type].remove(listener)

    async def emit(self, event_type: str, data: dict[str, Any], source: str = "system") -> Event:
        """Emit an event to all matched subscribers and save to in-memory buffer."""
        event = Event(type=event_type, data=data, source=source)

        async with self._lock:
            self._history.append(event)
            if len(self._history) > self._max_history:
                self._history.pop(0)

        targets = list(self._listeners.get(event_type, [])) + list(self._listeners.get("*", []))
        for listener in targets:
            try:
                if inspect.iscoroutinefunction(listener):
                    await listener(event)
                else:
                    res = listener(event)
                    if inspect.iscoroutine(res):
                        await res
            except Exception as e:
                # Listener failures should never crash the event bus
                print(f"[EventBus] Error in listener for '{event_type}': {e}")

        return event

    def get_history(self, limit: int = 50, event_type: Optional[str] = None) -> list[dict[str, Any]]:
        """Return the latest emitted events."""
        events = self._history
        if event_type:
            events = [e for e in events if e.type == event_type or event_type == "*"]
        return [e.to_dict() for e in events[-limit:]]

    def clear(self) -> None:
        self._history.clear()
        self._listeners.clear()


# Default singleton instance
global_event_bus = EventBus()
