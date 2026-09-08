import asyncio
import unittest

from waddle.tasks.manager import TaskManager
from waddle.tasks.task import TaskStatus


class TestTaskManager(unittest.TestCase):
    def setUp(self):
        self.tm = TaskManager()

    def test_create_and_unblock_tasks(self):
        async def run_flow():
            task1 = await self.tm.create_task("Primeira tarefa")
            task2 = await self.tm.create_task("Segunda tarefa", dependencies=[task1.id])

            self.assertEqual(task1.status, TaskStatus.PENDING)
            self.assertEqual(task2.status, TaskStatus.BLOCKED)

            # Mark task1 completed
            await self.tm.update_status(task1.id, TaskStatus.COMPLETED)

            # Task2 should automatically transition to PENDING
            t2 = self.tm.get_task(task2.id)
            self.assertEqual(t2.status, TaskStatus.PENDING)

        asyncio.run(run_flow())

    def test_cancel_all(self):
        async def run_cancel():
            t1 = await self.tm.create_task("T1")
            t2 = await self.tm.create_task("T2")

            cancelled = await self.tm.cancel_all(reason="Test Stop All")
            self.assertEqual(len(cancelled), 2)
            self.assertEqual(self.tm.get_task(t1.id).status, TaskStatus.CANCELLED)

        asyncio.run(run_cancel())


if __name__ == "__main__":
    unittest.main()
