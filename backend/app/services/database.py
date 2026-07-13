import json
import sqlite3
import time
from contextlib import contextmanager
from app.core.config import DATABASE_PATH


@contextmanager
def connect():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def initialise() -> None:
    with connect() as db:
        db.execute(
            '''
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at INTEGER NOT NULL,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                status TEXT NOT NULL,
                details TEXT NOT NULL
            )
            '''
        )


def add_event(category: str, title: str, status: str, details: dict | None = None) -> None:
    with connect() as db:
        db.execute(
            "INSERT INTO events(created_at, category, title, status, details) VALUES (?, ?, ?, ?, ?)",
            (int(time.time()), category, title, status, json.dumps(details or {})),
        )


def recent_events(limit: int = 50) -> list[dict]:
    with connect() as db:
        rows = db.execute(
            "SELECT * FROM events ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "created_at": row["created_at"],
            "category": row["category"],
            "title": row["title"],
            "status": row["status"],
            "details": json.loads(row["details"]),
        }
        for row in rows
    ]
