import time
from pathlib import Path

import pytest

from waddle_desktop.service import DesktopRuntimeService


def test_desktop_service_routes_prompt_to_selected_agent_and_persists_history(tmp_path, monkeypatch):
    monkeypatch.setenv("WADDLE_DATA_DIR", str(tmp_path / "data"))
    db_path = tmp_path / "state.db"
    events = []
    statuses = []
    service = DesktopRuntimeService(
        db_path=db_path,
        on_event=events.append,
        on_status=statuses.append,
    )
    manager = service.runtime.get_agent("Quinta")
    manager.llm_generate = lambda agent, prompt: f"{agent.name} respondeu: {prompt}"

    handle = service.submit_prompt("ola", agent_name="Atlas")
    result = handle.wait(timeout=5)

    assert result is not None
    assert result["status"] == "completed"
    history = service.list_history("Atlas")
    assert any(item["sender_name"] == "Atlas" and "Atlas respondeu: ola" in item["content"] for item in history)
    assert any(status["status"] == "completed" for status in statuses)
    assert any(event["type"] == "agent.message" for event in events)

    service.shutdown()

    restored = DesktopRuntimeService(db_path=db_path)
    restored_history = restored.list_history("Atlas")
    assert any(item["sender_name"] == "Atlas" and "Atlas respondeu: ola" in item["content"] for item in restored_history)
    restored.shutdown()


def test_desktop_service_cancels_active_runtime_task(tmp_path, monkeypatch):
    monkeypatch.setenv("WADDLE_DATA_DIR", str(tmp_path / "data"))
    service = DesktopRuntimeService(db_path=tmp_path / "state.db")
    manager = service.runtime.get_agent("Quinta")

    async def slow_plan(*args, **kwargs):
        await __import__("asyncio").sleep(30)
        return []

    manager.plan_objective = slow_plan
    handle = service.submit_prompt("aguarde", agent_name="Quinta")
    assert handle.wait_started(timeout=2)

    assert service.cancel_active() is True
    deadline = time.time() + 5
    while handle.is_alive and time.time() < deadline:
        time.sleep(0.05)

    assert not handle.is_alive
    assert handle.cancelled
    assert not service.is_running
    runs = service.runtime.database.list_runs(limit=5)
    assert runs[0]["status"] == "cancelled"
    service.shutdown()


def test_desktop_service_rejects_unknown_agent(tmp_path, monkeypatch):
    monkeypatch.setenv("WADDLE_DATA_DIR", str(tmp_path / "data"))
    service = DesktopRuntimeService(db_path=tmp_path / "state.db")
    with pytest.raises(ValueError):
        service.select_agent("NaoExiste")
    with pytest.raises(ValueError):
        service.submit_prompt("ola", agent_name="NaoExiste")
    service.shutdown()
