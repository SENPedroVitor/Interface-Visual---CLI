"""SQLite persistence storage for Waddle Agent OS."""
from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
from typing import Any, Optional
from ..core.os_layer import get_waddle_data_dir


class Database:
    def __init__(self, db_path: Optional[Path | str] = None) -> None:
        if db_path:
            self.path = Path(db_path)
        else:
            self.path = get_waddle_data_dir() / "state.db"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        conn = self._get_connection()
        try:
            with conn:
                conn.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS runs (
                        id TEXT PRIMARY KEY,
                        objective TEXT NOT NULL,
                        status TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        completed_at TEXT
                    );

                    CREATE TABLE IF NOT EXISTS agent_profiles (
                        name TEXT PRIMARY KEY COLLATE NOCASE,
                        role TEXT NOT NULL,
                        description TEXT NOT NULL,
                        provider_id TEXT NOT NULL DEFAULT 'ollama'
                    );

                    CREATE TABLE IF NOT EXISTS tasks (
                        id TEXT PRIMARY KEY,
                        run_id TEXT,
                        title TEXT NOT NULL,
                        description TEXT,
                        assigned_agent TEXT,
                        status TEXT NOT NULL,
                        priority TEXT NOT NULL,
                        dependencies_json TEXT,
                        input_json TEXT,
                        output_json TEXT,
                        error TEXT,
                        created_at TEXT NOT NULL,
                        started_at TEXT,
                        completed_at TEXT
                    );

                    CREATE TABLE IF NOT EXISTS events (
                        id TEXT PRIMARY KEY,
                        event_type TEXT NOT NULL,
                        source TEXT NOT NULL,
                        data_json TEXT NOT NULL,
                        timestamp TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS messages (
                        id TEXT PRIMARY KEY,
                        from_agent TEXT NOT NULL,
                        to_agent TEXT NOT NULL,
                        msg_type TEXT NOT NULL,
                        content TEXT NOT NULL,
                        task_id TEXT,
                        data_json TEXT,
                        timestamp TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS routines (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        agent_name TEXT NOT NULL,
                        prompt TEXT NOT NULL,
                        schedule TEXT NOT NULL,
                        status TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS groups (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT,
                        members_json TEXT NOT NULL,
                        avatar_icon TEXT DEFAULT 'users',
                        created_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS tool_calls (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        tool_name TEXT NOT NULL,
                        agent_id TEXT NOT NULL,
                        task_id TEXT,
                        params_json TEXT,
                        result_json TEXT,
                        success INTEGER NOT NULL,
                        error TEXT,
                        duration_ms REAL,
                        timestamp TEXT NOT NULL
                    );
                    """
                )
                columns = {row["name"] for row in conn.execute("PRAGMA table_info(agent_profiles)")}
                if "provider_id" not in columns:
                    conn.execute("ALTER TABLE agent_profiles ADD COLUMN provider_id TEXT NOT NULL DEFAULT 'ollama'")
                if "soul" not in columns:
                    conn.execute("ALTER TABLE agent_profiles ADD COLUMN soul TEXT NOT NULL DEFAULT ''")
                if "skills_json" not in columns:
                    conn.execute("ALTER TABLE agent_profiles ADD COLUMN skills_json TEXT NOT NULL DEFAULT '[]'")
                if "memory_json" not in columns:
                    conn.execute("ALTER TABLE agent_profiles ADD COLUMN memory_json TEXT NOT NULL DEFAULT '[]'")
                if "avatar_config_json" not in columns:
                    conn.execute("ALTER TABLE agent_profiles ADD COLUMN avatar_config_json TEXT NOT NULL DEFAULT '{}'")
                if "model_config_json" not in columns:
                    conn.execute("ALTER TABLE agent_profiles ADD COLUMN model_config_json TEXT NOT NULL DEFAULT '{}'")
        finally:
            conn.close()

    def save_agent(self, name: str, role: str, description: str, provider_id: str = "ollama") -> None:
        conn = self._get_connection()
        try:
            with conn:
                conn.execute(
                    'INSERT INTO agent_profiles (name, role, description, provider_id) VALUES (?, ?, ?, ?)',
                    (name, role, description, provider_id),
                )
        finally:
            conn.close()

    def update_agent(self, name: str, role: str, description: str, provider_id: str = "ollama") -> None:
        conn = self._get_connection()
        try:
            with conn:
                conn.execute(
                    'UPDATE agent_profiles SET role = ?, description = ?, provider_id = ? WHERE name = ? COLLATE NOCASE',
                    (role, description, provider_id, name),
                )
        finally:
            conn.close()

    def _row_to_agent_profile(self, row: Any) -> dict[str, Any]:
        d = dict(row)
        try:
            d["skills"] = json.loads(d.get("skills_json") or "[]")
        except Exception:
            d["skills"] = []
        try:
            d["memory"] = json.loads(d.get("memory_json") or "[]")
        except Exception:
            d["memory"] = []
        try:
            d["avatar_config"] = json.loads(d.get("avatar_config_json") or "{}")
        except Exception:
            d["avatar_config"] = {}
        try:
            d["model_config"] = json.loads(d.get("model_config_json") or "{}")
        except Exception:
            d["model_config"] = {}
        return d

    def get_agent_profile(self, name: str) -> Optional[dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute('SELECT * FROM agent_profiles WHERE name = ? COLLATE NOCASE', (name,))
            row = cursor.fetchone()
            return self._row_to_agent_profile(row) if row else None
        finally:
            conn.close()

    def update_agent_full(self, name: str, data: dict[str, Any]) -> dict[str, Any]:
        conn = self._get_connection()
        try:
            existing = self.get_agent_profile(name)
            if not existing:
                # Insert
                role = data.get("role", "Developer")
                desc = data.get("description", "")
                provider = data.get("provider_id", "ollama")
                soul = data.get("soul", "")
                skills = json.dumps(data.get("skills", []))
                memory = json.dumps(data.get("memory", []))
                avatar = json.dumps(data.get("avatar_config", {}))
                model = json.dumps(data.get("model_config", {}))
                with conn:
                    conn.execute(
                        """
                        INSERT INTO agent_profiles (name, role, description, provider_id, soul, skills_json, memory_json, avatar_config_json, model_config_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (name, role, desc, provider, soul, skills, memory, avatar, model),
                    )
            else:
                role = data.get("role", existing.get("role", "Developer"))
                desc = data.get("description", existing.get("description", ""))
                provider = data.get("provider_id", existing.get("provider_id", "ollama"))
                soul = data.get("soul", existing.get("soul", ""))
                skills = json.dumps(data.get("skills", existing.get("skills", [])))
                memory = json.dumps(data.get("memory", existing.get("memory", [])))
                avatar = json.dumps(data.get("avatar_config", existing.get("avatar_config", {})))
                model = json.dumps(data.get("model_config", existing.get("model_config", {})))
                with conn:
                    conn.execute(
                        """
                        UPDATE agent_profiles
                        SET role = ?, description = ?, provider_id = ?, soul = ?, skills_json = ?, memory_json = ?, avatar_config_json = ?, model_config_json = ?
                        WHERE name = ? COLLATE NOCASE
                        """,
                        (role, desc, provider, soul, skills, memory, avatar, model, name),
                    )
            return self.get_agent_profile(name) or {}
        finally:
            conn.close()

    def list_agent_profiles(self) -> list[dict[str, Any]]:
        conn = self._get_connection()
        try:
            return [self._row_to_agent_profile(row) for row in conn.execute('SELECT * FROM agent_profiles ORDER BY rowid')]
        finally:
            conn.close()

    # ---------------- Group CRUD ----------------
    def save_group(self, group_id: str, name: str, description: str = "", members: Optional[list[str]] = None, avatar_icon: str = "users") -> dict[str, Any]:
        conn = self._get_connection()
        now = datetime.now(timezone.utc).isoformat()
        members_list = members or []
        try:
            with conn:
                conn.execute(
                    """
                    INSERT INTO groups (id, name, description, members_json, avatar_icon, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (group_id, name, description, json.dumps(members_list), avatar_icon, now),
                )
            return {
                "id": group_id,
                "name": name,
                "description": description,
                "members": members_list,
                "avatar_icon": avatar_icon,
                "created_at": now,
            }
        finally:
            conn.close()

    def get_group(self, group_id: str) -> Optional[dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,))
            row = cursor.fetchone()
            if not row:
                return None
            d = dict(row)
            d["members"] = json.loads(d.get("members_json") or "[]")
            return d
        finally:
            conn.close()

    def update_group(
        self,
        group_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        members: Optional[list[str]] = None,
        avatar_icon: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        conn = self._get_connection()
        try:
            existing = self.get_group(group_id)
            if not existing:
                return None
            new_name = name if name is not None else existing["name"]
            new_desc = description if description is not None else existing["description"]
            new_members = json.dumps(members if members is not None else existing["members"])
            new_icon = avatar_icon if avatar_icon is not None else existing.get("avatar_icon", "users")
            with conn:
                conn.execute(
                    "UPDATE groups SET name = ?, description = ?, members_json = ?, avatar_icon = ? WHERE id = ?",
                    (new_name, new_desc, new_members, new_icon, group_id),
                )
            return self.get_group(group_id)
        finally:
            conn.close()

    def delete_group(self, group_id: str) -> bool:
        conn = self._get_connection()
        try:
            with conn:
                cursor = conn.execute("DELETE FROM groups WHERE id = ?", (group_id,))
                return cursor.rowcount > 0
        finally:
            conn.close()

    def list_groups(self) -> list[dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM groups ORDER BY created_at ASC")
            groups = []
            for row in cursor.fetchall():
                d = dict(row)
                d["members"] = json.loads(d.get("members_json") or "[]")
                groups.append(d)
            return groups
        finally:
            conn.close()

    # ---------------- Backup & Export / Import ----------------
    def export_backup(self) -> dict[str, Any]:
        return {
            "version": "1.0",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "agents": self.list_agent_profiles(),
            "groups": self.list_groups(),
            "routines": self.list_routines(),
            "messages": self.list_messages(limit=500),
        }

    def import_backup(self, backup_data: dict[str, Any]) -> dict[str, int]:
        counts = {"agents": 0, "groups": 0, "routines": 0}
        for agent in backup_data.get("agents", []):
            if agent.get("name"):
                self.update_agent_full(agent["name"], agent)
                counts["agents"] += 1
        for grp in backup_data.get("groups", []):
            if grp.get("id") and grp.get("name"):
                existing = self.get_group(grp["id"])
                if existing:
                    self.update_group(grp["id"], grp.get("name"), grp.get("description"), grp.get("members"), grp.get("avatar_icon"))
                else:
                    self.save_group(grp["id"], grp["name"], grp.get("description", ""), grp.get("members", []), grp.get("avatar_icon", "users"))
                counts["groups"] += 1
        for r in backup_data.get("routines", []):
            try:
                self.save_routine(r)
                counts["routines"] += 1
            except Exception:
                pass
        return counts

    def agent_activity(self) -> dict[str, str]:
        conn = self._get_connection()
        try:
            return {row['source']: row['latest'] for row in conn.execute(
                "SELECT source, MAX(timestamp) AS latest FROM events WHERE event_type LIKE 'agent.%' GROUP BY source"
            )}
        finally:
            conn.close()

    def list_messages(self, agent_name: Optional[str] = None, limit: int = 100) -> list[dict[str, Any]]:
        conn = self._get_connection()
        try:
            if agent_name:
                cursor = conn.execute(
                    """
                    SELECT * FROM messages
                    WHERE from_agent = ? COLLATE NOCASE OR to_agent = ? COLLATE NOCASE
                    ORDER BY timestamp DESC LIMIT ?
                    """,
                    (agent_name, agent_name, limit),
                )
            else:
                cursor = conn.execute("SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?", (limit,))
            return [
                {
                    "id": row["id"],
                    "from": row["from_agent"],
                    "to": row["to_agent"],
                    "type": row["msg_type"],
                    "content": row["content"],
                    "task_id": row["task_id"],
                    "data": json.loads(row["data_json"] or "{}"),
                    "timestamp": row["timestamp"],
                }
                for row in cursor.fetchall()
            ]
        finally:
            conn.close()

    def list_artifacts(self, limit: int = 50) -> list[dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                """
                SELECT id, title, assigned_agent, input_json, output_json, completed_at
                FROM tasks
                WHERE status = 'completed' AND output_json IS NOT NULL
                ORDER BY completed_at DESC LIMIT ?
                """,
                (limit,),
            )
            artifacts: list[dict[str, Any]] = []
            for row in cursor.fetchall():
                output = json.loads(row["output_json"] or "{}")
                input_data = json.loads(row["input_json"] or "{}")
                for result in output.get("results", []):
                    if result.get("tool_name") != "write_file" or not result.get("success"):
                        continue
                    path = result.get("result", {}).get("path") or input_data.get("path")
                    if not path:
                        continue
                    artifacts.append({
                        "id": f"artifact-{row['id']}",
                        "task_id": row["id"],
                        "title": row["title"],
                        "agent_name": row["assigned_agent"],
                        "path": path,
                        "filename": Path(path).name,
                        "bytes": result.get("result", {}).get("bytes_written"),
                        "created_at": row["completed_at"],
                    })
            return artifacts
        finally:
            conn.close()

    def save_routine(self, routine: dict[str, Any]) -> None:
        conn = self._get_connection()
        try:
            with conn:
                conn.execute(
                    """
                    INSERT INTO routines (id, name, agent_name, prompt, schedule, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        routine["id"],
                        routine["name"],
                        routine["agent_name"],
                        routine["prompt"],
                        routine["schedule"],
                        routine["status"],
                        routine["created_at"],
                    ),
                )
        finally:
            conn.close()

    def list_routines(self, agent_name: Optional[str] = None, limit: int = 50) -> list[dict[str, Any]]:
        conn = self._get_connection()
        try:
            if agent_name:
                cursor = conn.execute(
                    """
                    SELECT * FROM routines
                    WHERE agent_name = ? COLLATE NOCASE
                    ORDER BY created_at DESC LIMIT ?
                    """,
                    (agent_name, limit),
                )
            else:
                cursor = conn.execute("SELECT * FROM routines ORDER BY created_at DESC LIMIT ?", (limit,))
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def save_run(self, run_id: str, objective: str, status: str, created_at: str, completed_at: Optional[str] = None) -> None:
        conn = self._get_connection()
        try:
            with conn:
                conn.execute(
                    """
                    INSERT INTO runs (id, objective, status, created_at, completed_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET status=excluded.status, completed_at=excluded.completed_at
                    """,
                    (run_id, objective, status, created_at, completed_at),
                )
        finally:
            conn.close()

    def save_task(self, task_dict: dict[str, Any], run_id: Optional[str] = None) -> None:
        conn = self._get_connection()
        try:
            with conn:
                conn.execute(
                    """
                    INSERT INTO tasks (
                        id, run_id, title, description, assigned_agent, status, priority,
                        dependencies_json, input_json, output_json, error, created_at, started_at, completed_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        status=excluded.status,
                        output_json=excluded.output_json,
                        error=excluded.error,
                        started_at=excluded.started_at,
                        completed_at=excluded.completed_at
                    """,
                    (
                        task_dict["id"],
                        run_id,
                        task_dict["title"],
                        task_dict.get("description", ""),
                        task_dict.get("assigned_agent"),
                        task_dict["status"],
                        task_dict["priority"],
                        json.dumps(task_dict.get("dependencies", [])),
                        json.dumps(task_dict.get("input_data", {})),
                        json.dumps(task_dict.get("output_data")) if task_dict.get("output_data") is not None else None,
                        task_dict.get("error"),
                        task_dict["created_at"],
                        task_dict.get("started_at"),
                        task_dict.get("completed_at"),
                    ),
                )
        finally:
            conn.close()

    def save_event(self, event_id: str, event_type: str, source: str, data: dict[str, Any], timestamp: str) -> None:
        conn = self._get_connection()
        try:
            with conn:
                conn.execute(
                    "INSERT OR IGNORE INTO events (id, event_type, source, data_json, timestamp) VALUES (?, ?, ?, ?, ?)",
                    (event_id, event_type, source, json.dumps(data), timestamp),
                )
        finally:
            conn.close()

    def save_message(self, msg_dict: dict[str, Any]) -> None:
        conn = self._get_connection()
        try:
            with conn:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO messages (id, from_agent, to_agent, msg_type, content, task_id, data_json, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        msg_dict["id"],
                        msg_dict["from"],
                        msg_dict["to"],
                        msg_dict["type"],
                        msg_dict["content"],
                        msg_dict.get("task_id"),
                        json.dumps(msg_dict.get("data", {})),
                        msg_dict["timestamp"],
                    ),
                )
        finally:
            conn.close()

    def list_recent_events(self, limit: int = 100) -> list[dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM events ORDER BY timestamp DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            return [
                {
                    "id": row["id"],
                    "event_type": row["event_type"],
                    "source": row["source"],
                    "data": json.loads(row["data_json"]),
                    "timestamp": row["timestamp"],
                }
                for row in rows
            ]
        finally:
            conn.close()

    def list_runs(self, limit: int = 50) -> list[dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM runs ORDER BY created_at DESC LIMIT ?", (limit,))
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()
