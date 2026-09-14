from __future__ import annotations

import asyncio
import unittest

from fastapi import HTTPException

import waddle.api.server as server


class _GroupDatabase:
    def __init__(self, group):
        self.group = group

    def get_group(self, group_id):
        return self.group if self.group and self.group["id"] == group_id else None


class _GroupRuntime:
    def __init__(self, group):
        self.database = _GroupDatabase(group)
        self.captured = None
        self.finished = asyncio.Event()
        self.raise_error = False

    def get_agent(self, name):
        return object() if name.casefold() in {"quinta", "atlas", "nero"} else None

    async def run_objective(self, objective, parameters=None, agent_name=None):
        self.captured = (objective, parameters, agent_name)
        self.finished.set()
        if self.raise_error:
            raise RuntimeError("falha de objetivo")
        return {"status": "completed"}


class TestGroupObjectiveEndpoint(unittest.TestCase):
    def test_group_submission_routes_once_through_quinta_with_members(self):
        async def scenario():
            original_runtime = server.runtime
            fake = _GroupRuntime({
                "id": "group-build",
                "name": "Build",
                "members": ["Atlas", "Nero"],
            })
            server.runtime = fake
            try:
                response = await server.submit_objective(server.ObjectiveRequest(
                    objective="Revisar o projeto",
                    group_id="group-build",
                ))
                self.assertEqual(response["group_id"], "group-build")
                await asyncio.wait_for(fake.finished.wait(), timeout=1)
                self.assertEqual(fake.captured[2], "Quinta")
                self.assertEqual(fake.captured[1]["_group_members"], ["Atlas", "Nero"])
                self.assertEqual(fake.captured[1]["_group_id"], "group-build")
            finally:
                for task in tuple(server.objective_tasks):
                    task.cancel()
                if server.objective_tasks:
                    await asyncio.gather(*server.objective_tasks, return_exceptions=True)
                server.objective_tasks.clear()
                server.runtime = original_runtime

        asyncio.run(scenario())

    def test_group_submission_rejects_unknown_group(self):
        async def scenario():
            original_runtime = server.runtime
            server.runtime = _GroupRuntime(None)
            try:
                with self.assertRaises(HTTPException) as raised:
                    await server.submit_objective(server.ObjectiveRequest(
                        objective="Pesquisar",
                        group_id="missing",
                    ))
                self.assertEqual(raised.exception.status_code, 404)
            finally:
                server.runtime = original_runtime

        asyncio.run(scenario())

    def test_group_submission_rejects_missing_member(self):
        async def scenario():
            original_runtime = server.runtime
            server.runtime = _GroupRuntime({
                "id": "group-invalid",
                "name": "Invalid",
                "members": ["Atlas", "Ghost"],
            })
            try:
                with self.assertRaises(HTTPException) as raised:
                    await server.submit_objective(server.ObjectiveRequest(
                        objective="Pesquisar",
                        group_id="group-invalid",
                    ))
                self.assertEqual(raised.exception.status_code, 422)
                self.assertIn("Ghost", str(raised.exception.detail))
            finally:
                server.runtime = original_runtime

        asyncio.run(scenario())

    def test_background_objective_failure_is_logged(self):
        async def scenario():
            original_runtime = server.runtime
            fake = _GroupRuntime(None)
            fake.raise_error = True
            server.runtime = fake
            try:
                with self.assertLogs("waddle.api.server", level="ERROR") as logs:
                    await server.submit_objective(server.ObjectiveRequest(objective="falhar"))
                    await asyncio.wait_for(fake.finished.wait(), timeout=1)
                    await asyncio.sleep(0.05)
                self.assertTrue(any("Background objective failed" in line for line in logs.output))
            finally:
                for task in tuple(server.objective_tasks):
                    task.cancel()
                if server.objective_tasks:
                    await asyncio.gather(*server.objective_tasks, return_exceptions=True)
                server.objective_tasks.clear()
                server.runtime = original_runtime

        asyncio.run(scenario())


if __name__ == "__main__":
    unittest.main()
