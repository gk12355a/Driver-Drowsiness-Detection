import sqlite3
from pydantic import BaseModel
from typing import Optional, List
import os

DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "drowsiness.db"))

def init_db():
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            level TEXT NOT NULL,
            score REAL NOT NULL,
            perclos REAL NOT NULL,
            ear REAL NOT NULL,
            mar REAL NOT NULL,
            closed_duration REAL NOT NULL,
            reason TEXT NOT NULL,
            snapshot_path TEXT,
            snapshot_base64 TEXT,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            speed_kmh REAL NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def insert_incident(incident: dict):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO incidents (
            id, timestamp, level, score, perclos, ear, mar, closed_duration,
            reason, snapshot_path, snapshot_base64, lat, lng, speed_kmh
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        incident.get("id"),
        incident.get("timestamp"),
        incident.get("level"),
        incident.get("score"),
        incident.get("perclos"),
        incident.get("ear"),
        incident.get("mar"),
        incident.get("closed_duration"),
        incident.get("reason"),
        incident.get("snapshot_path", ""),
        incident.get("snapshot_base64", ""),
        incident.get("lat", 10.762622),
        incident.get("lng", 106.660172),
        incident.get("speed_kmh", 65.5)
    ))
    conn.commit()
    conn.close()

def get_recent_incidents(limit: int = 50):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents ORDER BY rowid DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        result.append(dict(r))
    return list(reversed(result))

def clear_all_incidents():
    """Clears all records in incidents table."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM incidents")
    conn.commit()
    conn.close()
