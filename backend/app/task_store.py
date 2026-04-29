from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TaskStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self._lock = threading.Lock()

    def init(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS image_tasks (
                  id TEXT PRIMARY KEY,
                  kind TEXT NOT NULL,
                  status TEXT NOT NULL,
                  progress INTEGER NOT NULL DEFAULT 0,
                  message TEXT NOT NULL,
                  error TEXT,
                  request_json TEXT NOT NULL,
                  result_json TEXT,
                  image_path TEXT,
                  created_at TEXT NOT NULL,
                  started_at TEXT,
                  completed_at TEXT
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS backend_logs (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  created_at TEXT NOT NULL,
                  level TEXT NOT NULL,
                  source TEXT NOT NULL,
                  message TEXT NOT NULL,
                  detail TEXT
                )
                """
            )
            conn.commit()

    def create(self, task_id: str, kind: str, request: dict[str, Any]) -> dict[str, Any]:
        created_at = utc_now()
        record = {
            "id": task_id,
            "kind": kind,
            "status": "pending",
            "progress": 0,
            "message": "任务已创建，等待后台执行",
            "error": None,
            "request_json": json.dumps(request, ensure_ascii=False),
            "result_json": None,
            "image_path": None,
            "created_at": created_at,
            "started_at": None,
            "completed_at": None,
        }
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO image_tasks (
                  id, kind, status, progress, message, error, request_json,
                  result_json, image_path, created_at, started_at, completed_at
                ) VALUES (
                  :id, :kind, :status, :progress, :message, :error, :request_json,
                  :result_json, :image_path, :created_at, :started_at, :completed_at
                )
                """,
                record,
            )
            conn.commit()
        return self.get(task_id)

    def get(self, task_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM image_tasks WHERE id = ?", (task_id,)).fetchone()
        if row is None:
            return None
        record = dict(row)
        record["request"] = json.loads(record.pop("request_json"))
        result_json = record.pop("result_json")
        record["result"] = json.loads(result_json) if result_json else None
        return record

    def update(self, task_id: str, **patch: Any) -> dict[str, Any]:
        if not patch:
            current = self.get(task_id)
            if current is None:
                raise KeyError(task_id)
            return current

        allowed = {
            "status",
            "progress",
            "message",
            "error",
            "result_json",
            "image_path",
            "started_at",
            "completed_at",
        }
        fields = {key: value for key, value in patch.items() if key in allowed}
        if not fields:
            current = self.get(task_id)
            if current is None:
                raise KeyError(task_id)
            return current

        assignments = ", ".join(f"{key} = :{key}" for key in fields)
        fields["id"] = task_id
        with self._lock, self._connect() as conn:
            conn.execute(f"UPDATE image_tasks SET {assignments} WHERE id = :id", fields)
            conn.commit()

        current = self.get(task_id)
        if current is None:
            raise KeyError(task_id)
        return current

    def append_backend_log(self, level: str, source: str, message: str, detail: Any = None) -> dict[str, Any]:
        record = {
            "created_at": utc_now(),
            "level": level,
            "source": source,
            "message": message,
            "detail": self._format_detail(detail),
        }
        with self._lock, self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO backend_logs (created_at, level, source, message, detail)
                VALUES (:created_at, :level, :source, :message, :detail)
                """,
                record,
            )
            conn.commit()
            log_id = cursor.lastrowid
        return self.get_backend_log(int(log_id))

    def list_backend_logs(self, after_id: int = 0, limit: int = 200) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM backend_logs
                WHERE id > ?
                ORDER BY id ASC
                LIMIT ?
                """,
                (after_id, max(1, min(limit, 500))),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_backend_log(self, log_id: int) -> dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM backend_logs WHERE id = ?", (log_id,)).fetchone()
        if row is None:
            raise KeyError(log_id)
        return dict(row)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _format_detail(self, detail: Any) -> str | None:
        if detail is None or detail == "":
            return None
        if isinstance(detail, str):
            return detail
        return json.dumps(detail, ensure_ascii=False, indent=2)
