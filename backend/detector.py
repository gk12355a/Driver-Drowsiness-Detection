import cv2
import numpy as np
from biometrics import (
    LEFT_EYE, RIGHT_EYE, MOUTH_LIPS, MOUTH_CORNERS, POSE_LANDMARK_IDS, MODEL_POINTS_3D,
    calculate_ear, calculate_mar
)

class BiometricsDetector:
    def __init__(self):
        # We try importing mediapipe solutions
        try:
            import mediapipe as mp
            self.mp_face_mesh = mp.solutions.face_mesh
            self.face_mesh = self.mp_face_mesh.FaceMesh(
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            self.has_mediapipe = True
        except Exception as e:
            print(f"[BiometricsDetector] MediaPipe FaceMesh init error: {e}")
            self.has_mediapipe = False

    def process_frame(self, frame_bgr):
        h, w = frame_bgr.shape[:2]
        
        # Default results if no face detected
        result = {
            "face_detected": False,
            "ear": 0.30,
            "mar": 0.15,
            "pitch": 0.0,
            "yaw": 0.0,
            "roll": 0.0,
            "landmarks_points": []
        }

        if not self.has_mediapipe:
            return result

        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(frame_rgb)

        if not results.multi_face_landmarks:
            return result

        landmarks = results.multi_face_landmarks[0].landmark
        result["face_detected"] = True

        # Extract 2D coordinates (scaled to pixel coordinates)
        coords_2d = np.array([(lm.x * w, lm.y * h) for lm in landmarks], dtype=np.float32)

        # 1. EAR Calculation
        left_eye_pts = coords_2d[LEFT_EYE]
        right_eye_pts = coords_2d[RIGHT_EYE]
        left_ear = calculate_ear(left_eye_pts)
        right_ear = calculate_ear(right_eye_pts)
        result["ear"] = (left_ear + right_ear) / 2.0

        # 2. MAR Calculation
        mouth_dict = {
            'corners': (coords_2d[MOUTH_CORNERS[0]], coords_2d[MOUTH_CORNERS[1]]),
            'pairs': [(coords_2d[pair[0]], coords_2d[pair[1]]) for pair in MOUTH_LIPS]
        }
        result["mar"] = calculate_mar(mouth_dict)

        # 3. Head Pose Estimation (PnP)
        image_points = coords_2d[POSE_LANDMARK_IDS]
        focal_length = w
        center = (w / 2, h / 2)
        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype=np.float64)
        dist_coeffs = np.zeros((4, 1), dtype=np.float64)

        success, rotation_vector, translation_vector = cv2.solvePnP(
            MODEL_POINTS_3D, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
        )

        if success:
            rmat, _ = cv2.Rodrigues(rotation_vector)
            # Decompose rotation matrix into Euler angles
            # Pitch, Yaw, Roll
            sy = np.sqrt(rmat[0, 0] * rmat[0, 0] + rmat[1, 0] * rmat[1, 0])
            singular = sy < 1e-6
            if not singular:
                x = np.arctan2(rmat[2, 1], rmat[2, 2])
                y = np.arctan2(-rmat[2, 0], sy)
                z = np.arctan2(rmat[1, 0], rmat[0, 0])
            else:
                x = np.arctan2(-rmat[1, 2], rmat[1, 1])
                y = np.arctan2(-rmat[2, 0], sy)
                z = 0

            # Convert radians to degrees
            result["pitch"] = float(np.degrees(x))
            result["yaw"] = float(np.degrees(y))
            result["roll"] = float(np.degrees(z))

        # Sample essential landmarks to send back to frontend for overlay
        key_landmarks = [1, 33, 263, 61, 291, 199, 13, 14, 159, 145, 386, 374]
        result["landmarks_points"] = [
            {"x": float(landmarks[i].x), "y": float(landmarks[i].y), "id": i}
            for i in key_landmarks
        ]

        return result
