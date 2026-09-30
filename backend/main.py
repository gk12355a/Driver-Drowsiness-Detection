import base64
import json
import os
import time
from datetime import datetime
from typing import List, Optional

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import asyncio
from contextlib import asynccontextmanager

from detector import BiometricsDetector
from guardrails import TemporalGuardrails
from database import init_db, insert_incident, get_recent_incidents
from cleaner import cleanup_snapshots, get_dir_size_bytes, SNAPSHOT_DIR, MAX_SNAPSHOT_DIR_MB

# Background task to clean up snapshots every 15 minutes
async def periodic_snapshot_cleanup():
    while True:
        try:
            cleanup_snapshots()
        except Exception as e:
            print(f"[Periodic Cleanup Error] {e}")
        await asyncio.sleep(900)  # 15 minutes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Run initial cleanup and launch background task
    init_db()
    cleanup_snapshots()
    cleanup_task = asyncio.create_task(periodic_snapshot_cleanup())
    yield
    cleanup_task.cancel()

app = FastAPI(title="Driver Drowsiness Detection API", version="1.0.0", lifespan=lifespan)

# Enable CORS for React Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global biometrics engine and guardrails
detector = BiometricsDetector()
guardrails = TemporalGuardrails(fps=25, window_sec=30)

SNAPSHOT_DIR = os.path.join(os.path.dirname(__file__), "snapshots")
os.makedirs(SNAPSHOT_DIR, exist_ok=True)

class IncidentEvent(BaseModel):
    id: str
    timestamp: str
    level: str
    score: float
    perclos: float
    ear: float
    mar: float
    closed_duration: float
    reason: str
    snapshot_base64: Optional[str] = None
    lat: float = 10.762622
    lng: float = 106.660172
    speed_kmh: float = 65.5

class CalibrationRequest(BaseModel):
    action: str # "start" or "reset"

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Driver Drowsiness Detection Backend",
        "epic": "Drowsiness Detection",
        "version": "1.0.0"
    }

@app.get("/api/incidents")
def get_incidents():
    """Returns SOS / Danger incident logs from SQLite database (US-DD-14, US-DD-15)."""
    return {"incidents": get_recent_incidents(limit=50)}

@app.post("/api/incidents")
def create_incident(event: IncidentEvent):
    insert_incident(event.dict())
    return {"status": "success", "event_id": event.id}

@app.post("/api/calibration")
def manage_calibration(req: CalibrationRequest):
    """Calibrate baseline EAR, MAR for driver (US-DD-03)."""
    if req.action == "start":
        guardrails.start_calibration()
        return {"status": "started", "message": "Calibration started. Please look straight at camera for 3 seconds."}
    elif req.action == "reset":
        guardrails.baseline_ear_mean = 0.28
        guardrails.baseline_ear_std = 0.03
        guardrails.baseline_mar_mean = 0.15
        guardrails.ear_threshold = 0.20
        guardrails.mar_threshold = 0.55
        return {"status": "reset", "message": "Calibration reset to defaults."}
    raise HTTPException(status_code=400, detail="Invalid action")

@app.get("/api/status")
def get_status():
    dir_size_bytes = get_dir_size_bytes(SNAPSHOT_DIR)
    dir_size_mb = round(dir_size_bytes / (1024 * 1024), 2)
    return {
        "baseline_ear_mean": guardrails.baseline_ear_mean,
        "ear_threshold": guardrails.ear_threshold,
        "mar_threshold": guardrails.mar_threshold,
        "cooldown_sec": guardrails.cooldown_sec,
        "calibration_active": guardrails.calibration_active,
        "calibration_progress": len(guardrails.calibration_frames) if guardrails.calibration_active else 75,
        "storage": {
            "snapshot_size_mb": dir_size_mb,
            "max_size_mb": MAX_SNAPSHOT_DIR_MB
        }
    }

@app.post("/api/snapshots/cleanup")
def trigger_cleanup(
    max_mb: Optional[float] = None,
    max_files: Optional[int] = None,
    max_days: Optional[float] = None,
    clear_all: bool = False
):
    """Triggers snapshot cleanup. If clear_all=True, deletes ALL snapshots and clears DB incidents."""
    from cleaner import clear_all_snapshots
    if clear_all:
        result = clear_all_snapshots(clear_db=True)
    else:
        kwargs = {}
        if max_mb is not None: kwargs["max_mb"] = max_mb
        if max_files is not None: kwargs["max_files"] = max_files
        if max_days is not None: kwargs["max_days"] = max_days
        result = cleanup_snapshots(**kwargs)
    return {"status": "success", "result": result}

@app.websocket("/ws/detect")
async def websocket_detect(websocket: WebSocket):
    """
    WebSocket endpoint for real-time video frame biometrics analysis (25-30 FPS).
    Receives base64 JPEG from frontend, runs FaceMesh, EAR, MAR, Head Pose,
    evaluates Guardrails (PERCLOS, Micro-sleep, Trend EWMA) and returns real-time risk telemetry.
    """
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            frame_base64 = payload.get("image")
            if not frame_base64:
                continue

            # Strip base64 metadata prefix if present
            if "," in frame_base64:
                frame_base64 = frame_base64.split(",")[1]
            
            img_bytes = base64.b64decode(frame_base64)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                await websocket.send_json({"error": "Failed to decode frame"})
                continue

            # 1. Computer Vision biometrics extraction
            bio_res = detector.process_frame(frame)
            
            calib_done = False
            calib_count = 0
            if guardrails.calibration_active and bio_res["face_detected"]:
                calib_done, calib_count = guardrails.add_calibration_frame(
                    bio_res["ear"], bio_res["mar"], bio_res["pitch"], bio_res["yaw"]
                )

            # 2. Temporal guardrails & risk evaluation
            if bio_res["face_detected"]:
                guard_res = guardrails.update(
                    bio_res["ear"],
                    bio_res["mar"],
                    bio_res["pitch"],
                    bio_res["yaw"],
                    bio_res["roll"]
                )
            else:
                guard_res = {
                    "ear": 0.0,
                    "mar": 0.0,
                    "pitch": 0.0,
                    "yaw": 0.0,
                    "roll": 0.0,
                    "perclos": 0.0,
                    "closed_duration": 0.0,
                    "is_closed": False,
                    "is_yawning": False,
                    "head_abnormal": False,
                    "score": 0.0,
                    "level": "NO_FACE",
                    "level_num": 0,
                    "color": "#94A3B8",
                    "status_text": "KHÔNG TÌM THẤY KHUÔN MẶT",
                    "can_trigger_sound": False,
                    "is_cooldown_active": False,
                    "cooldown_remaining": 0
                }

            # 3. Check for automatic SOS event generation if CRITICAL
            event_triggered = False
            if guard_res["level"] == "CRITICAL" and guard_res.get("can_trigger_sound"):
                # Save snapshot & register incident
                event_id = f"SOS-{int(time.time())}"
                snapshot_name = f"{event_id}.jpg"
                snapshot_path = os.path.join(SNAPSHOT_DIR, snapshot_name)
                cv2.imwrite(snapshot_path, frame)
                
                new_incident = {
                    "id": event_id,
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "level": "CRITICAL",
                    "score": guard_res["score"],
                    "perclos": guard_res["perclos"],
                    "ear": guard_res["ear"],
                    "mar": guard_res["mar"],
                    "closed_duration": guard_res["closed_duration"],
                    "reason": "Micro-sleep kéo dài >= 1.5s hoặc điểm buồn ngủ >= 8.0",
                    "snapshot_path": snapshot_path,
                    "snapshot_base64": f"data:image/jpeg;base64,{frame_base64}",
                    "lat": 10.762622,
                    "lng": 106.660172,
                    "speed_kmh": 68.2
                }
                insert_incident(new_incident)
                event_triggered = True

            # Send full response back to React UI
            response_payload = {
                "face_detected": bio_res["face_detected"],
                "telemetry": guard_res,
                "landmarks": bio_res.get("landmarks_points", []),
                "calibration": {
                    "active": guardrails.calibration_active,
                    "count": calib_count,
                    "done": calib_done,
                    "baseline_ear": guardrails.baseline_ear_mean
                },
                "event_triggered": event_triggered
            }
            await websocket.send_json(response_payload)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WebSocket Error] {e}")
