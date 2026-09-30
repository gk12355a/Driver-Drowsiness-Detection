import time
from collections import deque
import numpy as np

class TemporalGuardrails:
    """
    US-DD-04, US-DD-06, US-DD-07, US-DD-08, US-DD-09, US-DD-10, US-DD-11
    - PERCLOS calculation over 30-second rolling window (US-DD-07).
    - Micro-sleep continuous eye closure detection >= 1.5s (US-DD-08).
    - Combined Yawn (MAR >= 0.6) + Head nod/tilt (Pitch/Yaw >= 25 deg) (US-DD-09).
    - EWMA smoothing and Trend Gain (US-DD-06).
    - Multi-level Drowsiness Risk Score (1-10) and Alert levels (US-DD-10).
    - Alert cooldown management (20-30s) (US-DD-11).
    """
    def __init__(self, fps=25, window_sec=30, ear_threshold=0.20, mar_threshold=0.55):
        self.fps = fps
        self.window_sec = window_sec
        self.window_size = fps * window_sec
        
        # Baselines
        self.ear_threshold = ear_threshold
        self.mar_threshold = mar_threshold
        
        # Rolling windows for metrics
        self.ear_history = deque(maxlen=self.window_size)
        self.mar_history = deque(maxlen=self.window_size)
        self.eye_closed_history = deque(maxlen=self.window_size) # 1 if closed, 0 if open
        self.pitch_history = deque(maxlen=self.window_size)
        
        # Micro-sleep tracking
        self.eye_closed_start_time = None
        self.current_closed_duration = 0.0
        
        # EWMA Score tracking
        self.ewma_score = 0.0
        self.score_history = deque(maxlen=10)
        self.drowsy_accumulator = 0.0
        
        # Cooldown tracking (in epoch seconds)
        self.last_alert_time = 0.0
        self.cooldown_sec = 20.0
        
        # Calibration baseline stats
        self.calibration_active = False
        self.calibration_frames = []
        self.baseline_ear_mean = 0.28
        self.baseline_ear_std = 0.03
        self.baseline_mar_mean = 0.15

    def start_calibration(self):
        self.calibration_active = True
        self.calibration_frames = []

    def add_calibration_frame(self, ear, mar, pitch, yaw):
        if not self.calibration_active:
            return False, 0
        self.calibration_frames.append((ear, mar, pitch, yaw))
        count = len(self.calibration_frames)
        if count >= 75:
            arr = np.array(self.calibration_frames)
            self.baseline_ear_mean = float(np.mean(arr[:, 0]))
            self.baseline_ear_std = float(np.std(arr[:, 0]))
            self.baseline_mar_mean = float(np.mean(arr[:, 1]))
            # Dynamic threshold adjustment: 75% of baseline EAR
            self.ear_threshold = max(0.15, self.baseline_ear_mean * 0.72)
            self.mar_threshold = max(0.45, self.baseline_mar_mean * 2.8)
            self.calibration_active = False
            return True, count
        return False, count

    def update(self, ear: float, mar: float, pitch: float, yaw: float, roll: float):
        current_time = time.time()
        
        # 1. Determine eye closure status
        is_closed = ear < self.ear_threshold
        self.ear_history.append(ear)
        self.mar_history.append(mar)
        self.eye_closed_history.append(1 if is_closed else 0)
        self.pitch_history.append(pitch)
        
        # 2. Continuous Micro-sleep tracking (US-DD-08)
        if is_closed:
            if self.eye_closed_start_time is None:
                self.eye_closed_start_time = current_time
            self.current_closed_duration = current_time - self.eye_closed_start_time
        else:
            self.eye_closed_start_time = None
            self.current_closed_duration = 0.0

        # 3. Calculate PERCLOS (% of frames eye closed over rolling 30s) (US-DD-07)
        if len(self.eye_closed_history) > 0:
            perclos = (sum(self.eye_closed_history) / len(self.eye_closed_history)) * 100.0
        else:
            perclos = 0.0

        # 4. Yawn and Head pose anomaly (US-DD-09)
        is_yawning = mar >= self.mar_threshold
        # Abnormal head tilt/nod: Pitch > 20 (nodding down) or Yaw > 25 (turned away)
        head_abnormal = abs(pitch) >= 20.0 or abs(yaw) >= 25.0
        combined_exhaustion = is_yawning and head_abnormal

        # 5. Raw Drowsiness Risk Calculation (0.0 to 10.0 scale)
        # Factor A: PERCLOS (0-100% maps to 0-4 points)
        perclos_pts = min(4.0, (perclos / 40.0) * 4.0)
        
        # Factor B: Instant Eye Closure (Micro-sleep duration)
        # 0s to 1.5s adds up to 4.5 points; >= 1.5s jumps immediately to max critical
        if self.current_closed_duration >= 1.5:
            closure_pts = 5.5
        elif self.current_closed_duration >= 0.5:
            closure_pts = min(4.0, (self.current_closed_duration / 1.5) * 4.0)
        else:
            closure_pts = 0.0
            
        # Factor C: Yawning & Head nodding
        yawn_pts = 1.5 if is_yawning else 0.0
        pose_pts = 1.0 if head_abnormal else 0.0
        combined_pts = 2.0 if combined_exhaustion else 0.0
        
        raw_score = min(10.0, perclos_pts + closure_pts + yawn_pts + pose_pts + combined_pts)

        # 6. EWMA Smoothing & Trend Gain (US-DD-06)
        # Alpha is 0.35 when increasing (rapid trigger), 0.20 when decreasing (conservative decay)
        alpha = 0.35 if raw_score > self.ewma_score else 0.20
        self.ewma_score = alpha * raw_score + (1.0 - alpha) * self.ewma_score
        
        # Trend Gain (slope of last 10 points)
        self.score_history.append(self.ewma_score)
        if len(self.score_history) >= 5:
            trend_gain = (self.score_history[-1] - self.score_history[0]) / len(self.score_history)
        else:
            trend_gain = 0.0
            
        final_score = round(float(np.clip(self.ewma_score + max(0.0, trend_gain * 2.0), 0.0, 10.0)), 1)
        
        # Accumulator tracking
        if final_score >= 3.5:
            self.drowsy_accumulator += 0.1
        else:
            self.drowsy_accumulator = max(0.0, self.drowsy_accumulator - 0.2)

        # 7. Multi-level Alert Grading (US-DD-10)
        # Level 1 (Score 1-3): Alert/Awake (Green)
        # Level 2 (Score 4-5): Notice/Warning (Yellow)
        # Level 3 (Score 6-7): Danger (Orange)
        # Level 4 (Score 8-10 or Micro-sleep >= 1.5s): Critical SOS (Red)
        if self.current_closed_duration >= 1.5 or final_score >= 8.0:
            level = "CRITICAL"
            level_num = 4
            color = "#EF4444" # red-500
            status_text = "BÁO ĐỘNG ĐỎ: NGUY CƠ NGỦ GẬT CỰC NGUY HIỂM!"
        elif final_score >= 6.0 or perclos >= 38.0 or combined_exhaustion:
            level = "DANGER"
            level_num = 3
            color = "#F97316" # orange-500
            status_text = "CẢNH BÁO: DẤU HIỆU BUỒN NGỦ NẶNG"
        elif final_score >= 4.0 or is_yawning or perclos >= 25.0:
            level = "WARNING"
            level_num = 2
            color = "#EAB308" # yellow-500
            status_text = "CHÚ Ý: BẮT ĐẦU CÓ DẤU HIỆU MỆT MỎI"
        else:
            level = "NORMAL"
            level_num = 1
            color = "#10B981" # emerald-500
            status_text = "TỈNH TÁO: TRẠNG THÁI AN TOÀN"

        # 8. Cooldown Trigger Evaluation (US-DD-11)
        can_trigger_sound = False
        is_cooldown_active = (current_time - self.last_alert_time) < self.cooldown_sec
        
        if level_num >= 2:
            if not is_cooldown_active or level_num == 4: # Level 4 ignores cooldown for safety
                can_trigger_sound = True
                self.last_alert_time = current_time

        return {
            "ear": round(float(ear), 3),
            "mar": round(float(mar), 3),
            "pitch": round(float(pitch), 1),
            "yaw": round(float(yaw), 1),
            "roll": round(float(roll), 1),
            "perclos": round(float(perclos), 1),
            "closed_duration": round(float(self.current_closed_duration), 2),
            "is_closed": bool(is_closed),
            "is_yawning": bool(is_yawning),
            "head_abnormal": bool(head_abnormal),
            "score": final_score,
            "level": level,
            "level_num": level_num,
            "color": color,
            "status_text": status_text,
            "can_trigger_sound": can_trigger_sound,
            "is_cooldown_active": is_cooldown_active,
            "cooldown_remaining": max(0, round(self.cooldown_sec - (current_time - self.last_alert_time), 1)) if is_cooldown_active else 0
        }
