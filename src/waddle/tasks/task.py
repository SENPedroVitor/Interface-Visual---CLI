"""Task model for Waddle Agent OS."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
import uuid


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TaskStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    BLOCKED = "blocked"
    WAITING_REVIEW = "waiting_review"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class Task:
    title: str
    description: str = ""
    assigned_agent: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.PENDING
    dependencies: list[str] = field(default_factory=list)
    input_data: dict[str, Any] = field(default_factory=dict)
    output_data: Optional[Any] = None
    error: Optional[str] = None
    id: str = field(default_factory=lambda: f"task-{uuid.uuid4().hex[:8]}")
    created_at: str = field(default_factory=_utc_iso)
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

    def mark_running(self) -> None:
        self.status = TaskStatus.RUNNING
        self.started_at = _utc_iso()

    def mark_completed(self, output: Any = None) -> None:
        self.status = TaskStatus.COMPLETED
        self.output_data = output
        self.completed_at = _utc_iso()

    def mark_failed(self, error: str) -> None:
        self.status = TaskStatus.FAILED
        self.error = error
        self.completed_at = _utc_iso()

    def mark_cancelled(self, reason: str = "Execution cancelled") -> None:
        self.status = TaskStatus.CANCELLED
        self.error = reason
        self.completed_at = _utc_iso()

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "assigned_agent": self.assigned_agent,
            "priority": self.priority.value if isinstance(self.priority, TaskPriority) else self.priority,
            "status": self.status.value if isinstance(self.status, TaskStatus) else self.status,
            "dependencies": self.dependencies,
            "input_data": self.input_data,
            "output_data": self.output_data,
            "error": self.error,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
        }
