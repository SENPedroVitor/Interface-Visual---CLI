from __future__ import annotations

from cli_harness import history


def test_log_events_batch_persists_all_rows(tmp_path, monkeypatch) -> None:
    db_path = tmp_path / "history.db"
    monkeypatch.setattr(history, "get_history_db_path", lambda: db_path)

    store = history.HistoryStore.open()
    assert store is not None

    session_id = store.start_session("codex", "codex")
    store.log_events_batch(
        session_id,
        [
            ("in", "hello"),
            ("out", "world"),
            ("out", " again"),
        ],
    )
    events = store.list_events(session_id)
    assert len(events) == 3
    assert events[0]["direction"] == "in"
    assert events[0]["content"] == "hello"
    assert events[1]["direction"] == "out"
