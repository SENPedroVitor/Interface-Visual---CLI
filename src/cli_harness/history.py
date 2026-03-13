from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import os
from pathlib import Path
import sqlite3
from typing import Optional


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_history_db_path() -> Path:
    base = os.getenv("XDG_DATA_HOME", str(Path.home() / ".local" / "share"))
    return Path(base) / "cli_harness" / "history.db"


def _ensure_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY,
            backend TEXT NOT NULL,
            command TEXT NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY,
            session_id INTEGER NOT NULL,
            ts TEXT NOT NULL,
            direction TEXT NOT NULL,
            content TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES sessions(id)
        )
        """
    )
    conn.commit()


@dataclass
class HistoryStore:
    path: Path
    conn: sqlite3.Connection

    @classmethod
    def open(cls) -> Optional["HistoryStore"]:
        try:
            path = get_history_db_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            conn = sqlite3.connect(path)
            _ensure_db(conn)
            return cls(path=path, conn=conn)
        except Exception:
            return None

    def start_session(self, backend: str, command: str) -> int:
        cur = self.conn.execute(
            "INSERT INTO sessions (backend, command, started_at) VALUES (?, ?, ?)",
            (backend, command, _utc_now()),
        )
        self.conn.commit()
        return int(cur.lastrowid)

    def end_session(self, session_id: int) -> None:
        self.conn.execute(
            "UPDATE sessions SET ended_at = ? WHERE id = ?",
            (_utc_now(), session_id),
        )
        self.conn.commit()

    def log_event(self, session_id: int, direction: str, content: str) -> None:
        self.conn.execute(
            "INSERT INTO events (session_id, ts, direction, content) VALUES (?, ?, ?, ?)",
            (session_id, _utc_now(), direction, content),
        )
        self.conn.commit()

    def list_sessions(self) -> list[dict]:
        cur = self.conn.execute(
            "SELECT id, backend, command, started_at, ended_at FROM sessions ORDER BY id DESC"
        )
        return [
            {
                "id": row[0],
                "backend": row[1],
                "command": row[2],
                "started_at": row[3],
                "ended_at": row[4],
            }
            for row in cur.fetchall()
        ]

    def list_events(self, session_id: int) -> list[dict]:
        cur = self.conn.execute(
            "SELECT id, ts, direction, content FROM events WHERE session_id = ? ORDER BY id ASC",
            (session_id,),
        )
        return [
            {"id": row[0], "ts": row[1], "direction": row[2], "content": row[3]}
            for row in cur.fetchall()
        ]
