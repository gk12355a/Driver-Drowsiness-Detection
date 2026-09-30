import os
import time
import glob
import sqlite3
from database import DB_PATH

SNAPSHOT_DIR = os.path.join(os.path.dirname(__file__), "snapshots")

# Default configurations:
# - MAX_SNAPSHOT_DIR_MB: Maximum total size of snapshots directory in Megabytes (e.g. 100 MB)
# - MAX_SNAPSHOT_FILES: Maximum number of snapshot files kept (e.g. 200 files)
# - MAX_SNAPSHOT_AGE_DAYS: Time-To-Live in days (e.g. 7 days)
MAX_SNAPSHOT_DIR_MB = 100
MAX_SNAPSHOT_FILES = 200
MAX_SNAPSHOT_AGE_DAYS = 7

def get_dir_size_bytes(directory: str) -> int:
    """Calculates total size of all snapshot files in bytes."""
    total = 0
    if not os.path.exists(directory):
        return 0
    for root, _, files in os.walk(directory):
        for f in files:
            if f.endswith((".jpg", ".jpeg", ".png")):
                fp = os.path.join(root, f)
                try:
                    total += os.path.getsize(fp)
                except OSError:
                    pass
    return total

def delete_snapshot_file(file_path: str):
    """Deletes the image file from disk and clears snapshot_path in SQLite."""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            
        # Also clean up reference in database if exists
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("UPDATE incidents SET snapshot_path = '' WHERE snapshot_path = ?", (file_path,))
            conn.commit()
            conn.close()
        except Exception:
            pass
    except Exception as e:
        print(f"[Cleanup] Error deleting {file_path}: {e}")

def cleanup_snapshots(
    max_mb: float = MAX_SNAPSHOT_DIR_MB,
    max_files: int = MAX_SNAPSHOT_FILES,
    max_days: float = MAX_SNAPSHOT_AGE_DAYS
):
    """
    Auto cleans up snapshots:
    1. Time-To-Live (TTL): Deletes files older than max_days.
    2. File Count Quota: Keeps only newest `max_files` images.
    3. Storage Quota (LRU): If total directory size > max_mb, deletes oldest files first until below threshold.
    """
    if not os.path.exists(SNAPSHOT_DIR):
        return {"deleted_count": 0, "current_size_mb": 0.0}

    now = time.time()
    ttl_seconds = max_days * 86400
    max_bytes = max_mb * 1024 * 1024

    # Get all snapshot image files with their mtime and size
    pattern = os.path.join(SNAPSHOT_DIR, "*.jpg")
    file_list = []
    for fp in glob.glob(pattern):
        try:
            stat = os.stat(fp)
            file_list.append({
                "path": fp,
                "mtime": stat.st_mtime,
                "size": stat.st_size
            })
        except OSError:
            continue

    # Sort oldest first (FIFO / LRU)
    file_list.sort(key=lambda x: x["mtime"])
    deleted_count = 0

    # 1. TTL Cleanup: Delete files older than max_days
    remaining_files = []
    for item in file_list:
        if now - item["mtime"] > ttl_seconds:
            delete_snapshot_file(item["path"])
            deleted_count += 1
        else:
            remaining_files.append(item)

    # 2. File Count Quota: Keep only newest `max_files`
    while len(remaining_files) > max_files:
        oldest = remaining_files.pop(0)
        delete_snapshot_file(oldest["path"])
        deleted_count += 1

    # 3. Storage Size Quota: If total size > max_bytes, delete oldest until under 80% quota
    current_size = sum(item["size"] for item in remaining_files)
    target_size = max_bytes * 0.8  # Leave 20% headroom

    while current_size > target_size and remaining_files:
        oldest = remaining_files.pop(0)
        delete_snapshot_file(oldest["path"])
        current_size -= oldest["size"]
        deleted_count += 1

    current_size_mb = round(current_size / (1024 * 1024), 2)
    if deleted_count > 0:
        print(f"[Auto-Cleanup] Removed {deleted_count} old snapshots. Current folder size: {current_size_mb} MB")

    return {
        "deleted_count": deleted_count,
        "remaining_count": len(remaining_files),
        "current_size_mb": current_size_mb
    }

def clear_all_snapshots(clear_db: bool = True):
    """Deletes all snapshot images on disk and optionally wipes database records."""
    from database import clear_all_incidents
    count = 0
    pattern = os.path.join(SNAPSHOT_DIR, "*.jpg")
    for fp in glob.glob(pattern):
        try:
            os.remove(fp)
            count += 1
        except Exception as e:
            print(f"[Cleanup] Error deleting {fp}: {e}")
            
    if clear_db:
        clear_all_incidents()
        
    return {"deleted_count": count, "remaining_count": 0, "current_size_mb": 0.0}
