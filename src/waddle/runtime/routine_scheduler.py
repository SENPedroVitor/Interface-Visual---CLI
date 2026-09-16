"""Small, persistence-backed scheduler for active Waddle routines."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import re
import uuid
from typing import Any, Optional


_DAILY_RE = re.compile(r"todo\s+dia\s+(?:[àa]s?\s*)?(\d{1,2})\s*[:h]\s*(\d{2})", re.I)
_INTERVAL_RE = re.compile(r"a\s+cada\s+(\d+)\s*(minuto|minutos|hora|horas|dia|dias)", re.I)


def _as_datetime(value: datetime | str) -> datetime:
    if isinstance(value, datetime):
        result = value
    else:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        result = result.replace(tzinfo=timezone.utc)
    return result


def _schedule_interval(schedule: str) -> Optional[timedelta]:
    match = _INTERVAL_RE.search(schedule.strip())
    if not match:
        return None
    amount = int(match.group(1))
    if amount <= 0:
        return None
    unit = match.group(2).lower()
    factor = {"minuto": 1, "minutos": 1, "hora": 60, "horas": 60, "dia": 1440, "dias": 1440}[unit]
    return timedelta(minutes=amount * factor)


def next_run_for(schedule: str, now: datetime) -> Optional[datetime]:
    """Return the next occurrence at or after *now* for supported schedules."""
    current = _as_datetime(now)
    daily = _DAILY_RE.search(schedule.strip())
    if daily:
        hour, minute = int(daily.group(1)), int(daily.group(2))
        if hour > 23 or minute > 59:
            return None
        candidate = current.replace(hour=hour, minute=minute, second=0, microsecond=0)
        return candidate if candidate >= current else candidate + timedelta(days=1)
    # An interval needs a reference timestamp; from an arbitrary current time,
    # the useful answer is its next interval boundary.
    interval = _schedule_interval(schedule)
    return current + interval if interval else None


def is_schedule_due(schedule: str, now: datetime, last_triggered: Optional[datetime | str]) -> bool:
    current = _as_datetime(now)
    interval = _schedule_interval(schedule)
    if interval:
        if last_triggered is None:
            return True
        return current >= _as_datetime(last_triggered) + interval
    daily = _DAILY_RE.search(schedule.strip())
    if daily:
        hour, minute = int(daily.group(1)), int(daily.group(2))
        if hour > 23 or minute > 59:
            return False
        last = _as_datetime(last_triggered).astimezone(current.tzinfo) if last_triggered else None
        if last is None:
            # next_run_for rolls to tomorrow after the time; compare today's slot.
            candidate = current.replace(hour=hour, minute=minute, second=0, microsecond=0)
            return current >= candidate
        candidate = last.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if last >= candidate:
            candidate += timedelta(days=1)
        return current >= candidate
    return False


class RoutineScheduler:
    def __init__(self, runtime: Any, poll_interval_seconds: float = 30.0) -> None:
        self.runtime = runtime
        self.poll_interval_seconds = max(0.1, float(poll_interval_seconds))
        self._task: Optional[asyncio.Task[None]] = None
        self._stopped = asyncio.Event()
        self._running: set[str] = set()
        self._paused = False

    async def run_once(self, now: Optional[datetime] = None) -> None:
        if self._paused:
            return
        # Schedules are entered in the user's local time (for example,
        # "todo dia às 09:00"). Keep the polling clock local while persisted
        # timestamps remain timezone-aware.
        current = _as_datetime(now or datetime.now().astimezone())
        database = self.runtime.database
        list_active = getattr(database, "list_active_routines", None)
        routines = list_active() if callable(list_active) else database.list_routines(limit=100)
        for routine in routines:
            if self._paused:
                return
            if routine.get("status") != "active" or routine.get("id") in self._running:
                continue
            runs = database.list_routine_runs(routine["id"], limit=20)
            # A process stop/restart can leave the last persisted execution in
            # "running". Close it before using the timestamp for due checks.
            active_probe = getattr(self.runtime, "is_routine_run_active", None)
            persisted_run_active = (
                callable(active_probe)
                and bool(active_probe(runs[0]["id"]))
                if runs and runs[0].get("status") == "running"
                else False
            )
            if runs and runs[0].get("status") == "running" and not persisted_run_active:
                database.update_routine_run(runs[0]["id"], "cancelled")
            if persisted_run_active:
                # A manual API run shares the persisted row with the scheduler;
                # do not dispatch a duplicate while that supervised task lives.
                continue
            last = runs[0].get("triggered_at") if runs else None
            if not is_schedule_due(routine.get("schedule", ""), current, last):
                continue
            run_id = f"routine-run-{uuid.uuid4().hex[:10]}"
            # Persist a single sortable timezone (UTC); use local time only
            # for evaluating human-readable daily schedules above.
            triggered_at = current.astimezone(timezone.utc).isoformat()
            self._running.add(routine["id"])
            database.save_routine_run(run_id, routine["id"], "running", triggered_at)
            mark_active = getattr(self.runtime, "mark_routine_run_active", None)
            mark_finished = getattr(self.runtime, "mark_routine_run_finished", None)
            if callable(mark_active):
                mark_active(run_id)
            event_bus = getattr(self.runtime, "event_bus", None)
            if event_bus:
                await event_bus.emit("routine.run_started", {"routine": routine, "run_id": run_id}, source=routine["agent_name"])
            try:
                result = await self.runtime.run_objective(
                    routine["prompt"],
                    {"_source": "routine", "_routine_id": routine.get("id")},
                    routine["agent_name"],
                )
                result_status = result.get("status") if isinstance(result, dict) else None
                if result_status in {"failed", "cancelled"}:
                    database.update_routine_run(run_id, result_status)
                    if event_bus:
                        event_type = "routine.run_cancelled" if result_status == "cancelled" else "routine.run_failed"
                        await event_bus.emit(
                            event_type,
                            {"routine": routine, "run_id": run_id, "status": result_status},
                            source=routine["agent_name"],
                        )
                    continue
            except asyncio.CancelledError:
                database.update_routine_run(run_id, "cancelled")
                if event_bus:
                    await event_bus.emit("routine.run_cancelled", {"routine": routine, "run_id": run_id}, source=routine["agent_name"])
                raise
            except Exception:
                database.update_routine_run(run_id, "failed")
                if event_bus:
                    await event_bus.emit("routine.run_failed", {"routine": routine, "run_id": run_id}, source=routine["agent_name"])
            else:
                database.update_routine_run(run_id, "completed")
                if event_bus:
                    await event_bus.emit("routine.run_completed", {"routine": routine, "run_id": run_id}, source=routine["agent_name"])
            finally:
                if callable(mark_finished):
                    mark_finished(run_id)
                self._running.discard(routine["id"])

    def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stopped.clear()
        self._task = asyncio.create_task(self._run_loop(), name="waddle-routine-scheduler")

    def pause(self) -> None:
        """Prevent new routine dispatches until an explicit resume."""
        self._paused = True

    def resume(self) -> None:
        self._paused = False

    async def _run_loop(self) -> None:
        while not self._stopped.is_set():
            try:
                await self.run_once()
            except Exception as exc:
                print(f"[RoutineScheduler] {exc}")
            try:
                await asyncio.wait_for(self._stopped.wait(), timeout=self.poll_interval_seconds)
            except asyncio.TimeoutError:
                pass

    async def stop(self) -> None:
        self._stopped.set()
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
