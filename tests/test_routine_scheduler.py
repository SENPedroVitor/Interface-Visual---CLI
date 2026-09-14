from __future__ import annotations

import asyncio
import unittest
from datetime import datetime, timedelta, timezone

from waddle.runtime.routine_scheduler import RoutineScheduler, is_schedule_due, next_run_for


UTC = timezone.utc


class _FakeDatabase:
    def __init__(self, routines: list[dict], runs: dict[str, list[dict]] | None = None) -> None:
        self.routines = routines
        self.runs = runs or {}
        self.saved_runs: list[dict] = []
        self.updated_runs: list[tuple[str, str]] = []

    def list_routines(self, agent_name=None, limit=50):
        return self.routines[:limit]

    def list_active_routines(self):
        return [r for r in self.routines if r.get("status") == "active"]

    def list_routine_runs(self, routine_id, limit=20):
        return self.runs.get(routine_id, [])[:limit]

    def save_routine_run(self, run_id, routine_id, status, triggered_at):
        row = {"id": run_id, "routine_id": routine_id, "status": status, "triggered_at": triggered_at}
        self.saved_runs.append(row)
        self.runs.setdefault(routine_id, []).insert(0, row)
        return row

    def update_routine_run(self, run_id, status):
        self.updated_runs.append((run_id, status))
        for rows in self.runs.values():
            for row in rows:
                if row["id"] == run_id:
                    row["status"] = status
                    return row
        return None


class _FakeRuntime:
    def __init__(self, database):
        self.database = database
        self.objectives: list[tuple[str, str]] = []
        self.result_status = "completed"
        self.cancel = False

    async def run_objective(self, prompt, parameters=None, agent_name=None):
        self.objectives.append((prompt, agent_name))
        if self.cancel:
            raise asyncio.CancelledError()
        return {"status": self.result_status}


class _ActiveRunRuntime(_FakeRuntime):
    def __init__(self, database):
        super().__init__(database)
        self.active_ids = {"run-manual"}

    def is_routine_run_active(self, run_id):
        return run_id in self.active_ids

    def mark_routine_run_active(self, run_id):
        self.active_ids.add(run_id)

    def mark_routine_run_finished(self, run_id):
        self.active_ids.discard(run_id)


class TestRoutineScheduler(unittest.TestCase):
    def test_next_run_for_daily_schedule(self):
        before = datetime(2026, 9, 13, 8, 59, tzinfo=UTC)
        after = datetime(2026, 9, 13, 9, 1, tzinfo=UTC)

        self.assertEqual(next_run_for("todo dia às 09:00", before), datetime(2026, 9, 13, 9, 0, tzinfo=UTC))
        self.assertEqual(next_run_for("todo dia às 09:00", after), datetime(2026, 9, 14, 9, 0, tzinfo=UTC))

    def test_interval_schedule_is_due_only_after_interval(self):
        last = datetime(2026, 9, 13, 9, 0, tzinfo=UTC)
        self.assertFalse(is_schedule_due("a cada 5 minutos", last + timedelta(minutes=4, seconds=59), last))
        self.assertTrue(is_schedule_due("a cada 5 minutos", last + timedelta(minutes=5), last))

    def test_malformed_daily_schedule_is_never_due(self):
        now = datetime(2026, 9, 13, 9, 0, tzinfo=UTC)
        self.assertFalse(is_schedule_due("todo dia às 25:00", now, None))
        self.assertIsNone(next_run_for("todo dia às 09:75", now))
        self.assertFalse(is_schedule_due("a cada 0 minutos", now, None))

    def test_manual_schedule_never_runs_automatically(self):
        now = datetime(2026, 9, 13, 9, 0, tzinfo=UTC)
        self.assertIsNone(next_run_for("manual", now))
        self.assertFalse(is_schedule_due("manual", now, None))

    def test_run_once_executes_active_routine_and_records_completion(self):
        db = _FakeDatabase([
            {"id": "routine-1", "agent_name": "Atlas", "prompt": "Verifique as fontes", "schedule": "a cada 5 minutos", "status": "active"}
        ])
        runtime = _FakeRuntime(db)
        scheduler = RoutineScheduler(runtime, poll_interval_seconds=60)
        now = datetime(2026, 9, 13, 9, 5, tzinfo=UTC)

        asyncio.run(scheduler.run_once(now=now))

        self.assertEqual(runtime.objectives, [("Verifique as fontes", "Atlas")])
        self.assertEqual(len(db.saved_runs), 1)
        self.assertEqual(db.updated_runs, [(db.saved_runs[0]["id"], "completed")])

    def test_run_once_does_not_duplicate_same_interval(self):
        now = datetime(2026, 9, 13, 9, 5, tzinfo=UTC)
        previous = (now - timedelta(minutes=5)).isoformat()
        db = _FakeDatabase(
            [{"id": "routine-1", "agent_name": "Atlas", "prompt": "Verifique as fontes", "schedule": "a cada 5 minutos", "status": "active"}],
            {"routine-1": [{"id": "run-old", "routine_id": "routine-1", "status": "completed", "triggered_at": previous}]},
        )
        runtime = _FakeRuntime(db)
        scheduler = RoutineScheduler(runtime, poll_interval_seconds=60)

        asyncio.run(scheduler.run_once(now=now))
        asyncio.run(scheduler.run_once(now=now))

        self.assertEqual(len(runtime.objectives), 1)

    def test_failed_result_is_persisted_as_failed(self):
        db = _FakeDatabase([
            {"id": "routine-1", "agent_name": "Atlas", "prompt": "falhar", "schedule": "a cada 5 minutos", "status": "active"}
        ])
        runtime = _FakeRuntime(db)
        runtime.result_status = "failed"
        asyncio.run(RoutineScheduler(runtime).run_once(now=datetime(2026, 9, 13, 9, 5, tzinfo=UTC)))
        self.assertEqual(db.updated_runs[-1][1], "failed")

    def test_pause_blocks_dispatch_and_cancelled_run_is_recorded(self):
        db = _FakeDatabase([
            {"id": "routine-1", "agent_name": "Atlas", "prompt": "cancelar", "schedule": "a cada 5 minutos", "status": "active"}
        ])
        runtime = _FakeRuntime(db)
        scheduler = RoutineScheduler(runtime)
        scheduler.pause()
        asyncio.run(scheduler.run_once(now=datetime(2026, 9, 13, 9, 5, tzinfo=UTC)))
        self.assertEqual(runtime.objectives, [])

        scheduler.resume()
        runtime.cancel = True
        with self.assertRaises(asyncio.CancelledError):
            asyncio.run(scheduler.run_once(now=datetime(2026, 9, 13, 9, 5, tzinfo=UTC)))
        self.assertEqual(db.updated_runs[-1][1], "cancelled")

    def test_stale_running_run_is_closed_before_due_check(self):
        now = datetime(2026, 9, 13, 9, 5, tzinfo=UTC)
        db = _FakeDatabase(
            [{"id": "routine-1", "agent_name": "Atlas", "prompt": "retomar", "schedule": "a cada 5 minutos", "status": "active"}],
            {"routine-1": [{"id": "run-stale", "routine_id": "routine-1", "status": "running", "triggered_at": (now - timedelta(minutes=20)).isoformat()}]},
        )
        runtime = _FakeRuntime(db)
        asyncio.run(RoutineScheduler(runtime).run_once(now=now))
        self.assertIn(("run-stale", "cancelled"), db.updated_runs)

    def test_active_manual_run_is_not_cancelled_by_scheduler_poll(self):
        now = datetime(2026, 9, 13, 9, 5, tzinfo=UTC)
        db = _FakeDatabase(
            [{"id": "routine-1", "agent_name": "Atlas", "prompt": "manual", "schedule": "a cada 5 minutos", "status": "active"}],
            {"routine-1": [{"id": "run-manual", "routine_id": "routine-1", "status": "running", "triggered_at": (now - timedelta(minutes=20)).isoformat()}]},
        )
        runtime = _ActiveRunRuntime(db)
        asyncio.run(RoutineScheduler(runtime).run_once(now=now))
        self.assertNotIn(("run-manual", "cancelled"), db.updated_runs)

    def test_scheduler_considers_active_routines_beyond_ui_page_limit(self):
        now = datetime(2026, 9, 13, 9, 5, tzinfo=UTC)
        routines = [
            {"id": f"draft-{index}", "agent_name": "Atlas", "prompt": "não executar", "schedule": "manual", "status": "draft"}
            for index in range(100)
        ]
        routines.append({"id": "old-active", "agent_name": "Atlas", "prompt": "executar antiga", "schedule": "a cada 5 minutos", "status": "active"})
        db = _FakeDatabase(routines)
        runtime = _FakeRuntime(db)
        asyncio.run(RoutineScheduler(runtime).run_once(now=now))
        self.assertEqual(runtime.objectives, [("executar antiga", "Atlas")])


if __name__ == "__main__":
    unittest.main()
