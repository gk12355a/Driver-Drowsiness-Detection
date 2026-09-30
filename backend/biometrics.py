import numpy as np

# MediaPipe Face Mesh landmark indices
# Left Eye indices (6 points standard for Soukupova & Cech EAR)
LEFT_EYE = [362, 385, 387, 263, 373, 380]
# Right Eye indices (6 points standard)
RIGHT_EYE = [33, 160, 158, 133, 153, 144]

# Mouth indices: outer & inner lips for MAR calculation
# Top-bottom pairs: (13, 14), (81, 178), (311, 402), corners: (78, 308)
MOUTH_OUTER = [61, 291, 0, 17, 267, 314, 37, 84]
MOUTH_CORNERS = (78, 308)
MOUTH_LIPS = [(13, 14), (82, 87), (312, 317)]

# 3D Model landmarks for Head Pose estimation (Pitch, Yaw, Roll)
# Nose tip: 1, Chin: 199, Left eye corner: 33, Right eye corner: 263, Left mouth: 61, Right mouth: 291
POSE_LANDMARK_IDS = [1, 199, 33, 263, 61, 291]
MODEL_POINTS_3D = np.array([
    (0.0, 0.0, 0.0),          # Nose tip
    (0.0, -330.0, -65.0),     # Chin
    (-225.0, 170.0, -135.0),  # Left eye corner
    (225.0, 170.0, -135.0),   # Right eye corner
    (-150.0, -150.0, -125.0), # Left mouth corner
    (150.0, -150.0, -125.0)   # Right mouth corner
], dtype=np.float64)

def euclidean_dist(p1, p2):
    """Calculates Euclidean distance between two 2D/3D points."""
    return np.linalg.norm(np.array(p1) - np.array(p2))

def calculate_ear(landmarks_subset):
    """
    Computes Eye Aspect Ratio (EAR) using Soukupova & Cech formula:
    EAR = (|p2 - p6| + |p3 - p5|) / (2 * |p1 - p4|)
    """
    p1, p2, p3, p4, p5, p6 = landmarks_subset
    vert1 = euclidean_dist(p2, p6)
    vert2 = euclidean_dist(p3, p5)
    horiz = euclidean_dist(p1, p4)
    if horiz == 0:
        return 0.0
    return float((vert1 + vert2) / (2.0 * horiz))

def calculate_mar(mouth_landmarks):
    """
    Computes Mouth Aspect Ratio (MAR):
    MAR = sum(|top_i - bot_i|) / (2 * |left_corner - right_corner|)
    """
    corner_left, corner_right = mouth_landmarks['corners']
    horiz = euclidean_dist(corner_left, corner_right)
    if horiz == 0:
        return 0.0
    
    verticals = [euclidean_dist(pair[0], pair[1]) for pair in mouth_landmarks['pairs']]
    return float(np.sum(verticals) / (len(verticals) * horiz))
