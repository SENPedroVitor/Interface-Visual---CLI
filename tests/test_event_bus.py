import asyncio
import unittest

from waddle.core.event_bus import EventBus, Event


class TestEventBus(unittest.TestCase):
    def test_emit_and_subscribe(self):
        bus = EventBus()
        received = []

        async def handler(event: Event):
            received.append(event)

        bus.subscribe("task.created", handler)
        asyncio.run(bus.emit("task.created", {"task_id": "123"}, source="test"))

        self.assertEqual(len(received), 1)
        self.assertEqual(received[0].type, "task.created")
        self.assertEqual(received[0].data["task_id"], "123")
        self.assertEqual(received[0].source, "test")

    def test_wildcard_listener(self):
        bus = EventBus()
        received = []

        def any_handler(event: Event):
            received.append(event.type)

        bus.subscribe("*", any_handler)
        asyncio.run(bus.emit("alpha", {}))
        asyncio.run(bus.emit("beta", {}))

        self.assertEqual(received, ["alpha", "beta"])

    def test_history(self):
        bus = EventBus()
        asyncio.run(bus.emit("msg1", {"text": "hello"}))
        asyncio.run(bus.emit("msg2", {"text": "world"}))

        history = bus.get_history()
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]["type"], "msg1")
        self.assertEqual(history[1]["type"], "msg2")


if __name__ == "__main__":
    unittest.main()
