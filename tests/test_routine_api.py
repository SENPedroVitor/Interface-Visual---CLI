from __future__ import annotations

import asyncio
import unittest

import waddle.api.server as server


class _RoutineDatabase:
    def __init__(self) -> None:
        self.rows: list[dict] = []

    def save_routine_run(self, run_id, routine_id, status, triggered_at):
        row = {
            "id": run_id,
            "routine_id": routine_id,
            "status": status,
            "triggered_at": triggered_at,
        }
        self.rows.append(row)
        return row

    def update_routine_run(self, run_id, status):
        for row in self.rows:
            if row["id"] == run_id:
                row["status"] = status
                return row
        return None


class _RoutineRuntime:
    def __init__(self) -> None:
        self.database = _RoutineDatabase()
        self.finished = asyncio.Event()
        self.result_status = "completed"
        self.raise_error = False

    def get_routine(self, routine_id):
        return {
            "id": routine_id,
            "agent_name": "Atlas",
            "prompt": "Executar rotina",
            "status": "active",
        }

    async def run_objective(self, prompt, parameters=None, agent_name=None):
        self.finished.set()
        if self.raise_error:
            raise RuntimeError("falha de teste")
        return {"status": self.result_status}


class TestRoutineRunEndpoint(unittest.TestCase):
    def test_manual_run_transitions_from_triggered_to_completed(self):
        async def scenario() -> None:
            original_runtime = server.runtime
            fake_runtime = _RoutineRuntime()
            server.runtime = fake_runtime
            try:
                response = await server.run_routine_now("routine-1")
                self.assertEqual(response["status"], "triggered")
                await asyncio.wait_for(fake_runtime.finished.wait(), timeout=1)
                await asyncio.sleep(0)
                self.assertEqual(fake_runtime.database.rows[0]["status"], "completed")
            finally:
                server.runtime = original_runtime

        asyncio.run(scenario())

    def test_manual_run_persists_failed_result_and_exception(self):
        async def scenario() -> None:
            original_runtime = server.runtime
            fake_runtime = _RoutineRuntime()
            server.runtime = fake_runtime
            try:
                fake_runtime.result_status = "failed"
                run = await server.run_routine_now("routine-failed")
                await asyncio.wait_for(fake_runtime.finished.wait(), timeout=1)
                await asyncio.sleep(0)
                self.assertEqual(fake_runtime.database.rows[0]["status"], "failed")

                fake_runtime.finished = asyncio.Event()
                fake_runtime.result_status = "completed"
                fake_runtime.raise_error = True
                await server.run_routine_now("routine-error")
                await asyncio.wait_for(fake_runtime.finished.wait(), timeout=1)
                await asyncio.sleep(0)
                self.assertEqual(fake_runtime.database.rows[1]["status"], "failed")
            finally:
                server.runtime = original_runtime

        asyncio.run(scenario())

    def test_manual_run_cancellation_persists_cancelled(self):
        async def scenario() -> None:
            original_runtime = server.runtime
            fake_runtime = _RoutineRuntime()
            fake_runtime.run_objective = self._blocking_objective
            server.runtime = fake_runtime
            try:
                run = fake_runtime.database.save_routine_run(
                    "run-cancel", "routine-cancel", "triggered", "now"
                )
                task = asyncio.create_task(server._execute_manual_routine_run(fake_runtime.get_routine("routine-cancel"), run))
                await asyncio.sleep(0)
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
                self.assertEqual(fake_runtime.database.rows[0]["status"], "cancelled")
            finally:
                server.runtime = original_runtime

        asyncio.run(scenario())

    async def _blocking_objective(self, prompt, parameters=None, agent_name=None):
        await asyncio.Event().wait()


if __name__ == "__main__":
    unittest.main()
