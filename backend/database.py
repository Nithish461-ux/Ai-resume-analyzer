import json
import os
import sqlite3
from datetime import datetime

# Vercel only allows writing to /tmp
DB_PATH = "/tmp/analyses.db" if os.getenv("VERCEL") else "analyses.db"

def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _connect() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT,
                match_score INTEGER,
                result TEXT,
                created_at TEXT
            )"""
        )
        try:
            conn.execute("ALTER TABLE analyses ADD COLUMN input_hash TEXT")
        except sqlite3.OperationalError:
            pass  # column already exists


def save_analysis(filename: str, result: dict, input_hash: str = None) -> int:
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO analyses (filename, match_score, result, created_at, input_hash) VALUES (?, ?, ?, ?, ?)",
            (filename, result.get("match_score"), json.dumps(result), datetime.utcnow().isoformat(), input_hash),
        )
        return cur.lastrowid


def list_analyses() -> list:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, filename, match_score, created_at FROM analyses ORDER BY id DESC LIMIT 50"
        ).fetchall()
    return [dict(r) for r in rows]


def get_analysis(analysis_id: int):
    with _connect() as conn:
        row = conn.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,)).fetchone()
    if row is None:
        return None
    data = dict(row)
    data["result"] = json.loads(data["result"])
    return data


def find_cached(input_hash: str):
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, result FROM analyses WHERE input_hash = ? ORDER BY id DESC LIMIT 1",
            (input_hash,),
        ).fetchone()
    if row is None:
        return None
    return {"id": row["id"], "result": json.loads(row["result"])}