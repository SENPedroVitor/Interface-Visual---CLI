"""Task Manager for Waddle Agent OS."""
from __future__ import annotations

import asyncio
from typing import Optional
from .task import Task, TaskStatus
from ..core.event_bus import EventBus, global_event_bus


class TaskManager:
    def __init__(self, event_bus: Optional[EventBus] = None) -> None:
        self.event_bus = event_bus or global_event_bus
        self._tasks: dict[str, Task] = {}
        self._lock = asyncio.Lock()

    async def create_task(
        self,
        title: str,
        description: str = "",
        assigned_agent: Optional[str] = None,
        dependencies: Optional[list[str]] = None,
        input_data: Optional[dict] = None,
        priority: str = "medium",
    ) -> Task:
        deps = dependencies or []
        # Check if dependencies are already satisfied
        status = TaskStatus.PENDING
        if deps:
            for dep_id in deps:
                dep_task = self._tasks.get(dep_id)
                if not dep_task or dep_task.status != TaskStatus.COMPLETED:
                    status = TaskStatus.BLOCKED
                    break

        task = Task(
            title=title,
            description=description,
            assigned_agent=assigned_agent,
            dependencies=deps,
            input_data=input_data or {},
            status=status,
        )

        async with self._lock:
            self._tasks[task.id] = task

        await self.event_bus.emit(
            "task.created",
            {"task": task.to_dict()},
            source="task_manager",
        )
        return task

    def get_task(self, task_id: str) -> Optional[Task]:
        return self._tasks.get(task_id)

    def list_tasks(self, status: Optional[str] = None, agent: Optional[str] = None) -> list[dict]:
        tasks = list(self._tasks.values())
        if status:
            tasks = [t for t in tasks if t.status.value == status or t.status == status]
        if agent:
            tasks = [t for t in tasks if t.assigned_agent == agent]
        return [t.to_dict() for t in tasks]

    async def update_status(
        self,
        task_id: str,
        status: TaskStatus,
        output: Optional[dict | str] = None,
        error: Optional[str] = None,
    ) -> Optional[Task]:
        task = self._tasks.get(task_id)
        if not task:
            return None

        old_status = task.status
        if status == TaskStatus.RUNNING:
            task.mark_running()
        elif status == TaskStatus.COMPLETED:
            task.mark_completed(output)
        elif status == TaskStatus.FAILED:
            task.mark_failed(error or "Unknown error")
        elif status == TaskStatus.CANCELLED:
            task.mark_cancelled(error or "Task cancelled")
        else:
            task.status = status

        # Check if unblocking other tasks
        if status == TaskStatus.COMPLETED:
            await self._check_unblock_dependents(task_id)

        event_name = f"task.{status.value}"
        await self.event_bus.emit(
            event_name,
            {"task_id": task_id, "old_status": old_status.value, "new_status": task.status.value, "task": task.to_dict()},
            source="task_manager",
        )
        return task

    async def _check_unblock_dependents(self, completed_task_id: str) -> None:
        async with self._lock:
            for task in self._tasks.values():
                if task.status == TaskStatus.BLOCKED and completed_task_id in task.dependencies:
                    # Check all dependencies
                    all_met = all(
                        self._tasks.get(dep) and self._tasks[dep].status == TaskStatus.COMPLETED
                        for dep in task.dependencies
                    )
                    if all_met:
                        task.status = TaskStatus.PENDING
                        await self.event_bus.emit(
                            "task.unblocked",
                            {"task_id": task.id, "task": task.to_dict()},
                            source="task_manager",
                        )

    def get_next_runnable_task(self, agent_name: Optional[str] = None) -> Optional[Task]:
        for task in self._tasks.values():
            if task.status == TaskStatus.PENDING:
                if agent_name is None or task.assigned_agent == agent_name or task.assigned_agent is None:
                    return task
        return None

    async def cancel_all(self, reason: str = "Kill Switch activated") -> list[str]:
        cancelled_ids = []
        async with self._lock:
            for task in self._tasks.values():
                if task.status in (TaskStatus.PENDING, TaskStatus.QUEUED, TaskStatus.RUNNING, TaskStatus.BLOCKED):
                    task.mark_cancelled(reason)
                    cancelled_ids.append(task.id)

        await self.event_bus.emit(
            "system.kill_switch",
            {"cancelled_tasks": cancelled_ids, "reason": reason},
            source="task_manager",
        )
        return cancelled_ids
