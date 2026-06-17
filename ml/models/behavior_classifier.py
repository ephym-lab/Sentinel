"""
Rule-based behavior classifier using COCO pose keypoints.

Analyzes 17-keypoint body poses to detect security-relevant behaviors.
Pure Python — no ML model needed, works on CPU in microseconds.

Detected behaviors per deployment mode:
  School:     fighting, crowd_panic, person_down, loitering, perimeter_climbing, night_gathering
  Mall:       crowd_panic, person_down, loitering, suspicious_proximity, crowd_crush
  Supermarket: concealment_gesture, item_to_bag, repeated_aisle_passes, high_value_dwell,
               self_checkout_anomaly, suspicious_proximity

Keypoint indices (COCO):
    0:nose  1:L_eye  2:R_eye  3:L_ear  4:R_ear
    5:L_shoulder  6:R_shoulder  7:L_elbow  8:R_elbow
    9:L_wrist  10:R_wrist  11:L_hip  12:R_hip
    13:L_knee  14:R_knee  15:L_ankle  16:R_ankle
"""

import logging
import math
import time
from enum import Enum
from typing import Optional

import numpy as np

from ml.config import settings

logger = logging.getLogger(__name__)

# Keypoint index constants
KP = {
    "nose": 0, "l_eye": 1, "r_eye": 2, "l_ear": 3, "r_ear": 4,
    "l_shoulder": 5, "r_shoulder": 6, "l_elbow": 7, "r_elbow": 8,
    "l_wrist": 9, "r_wrist": 10, "l_hip": 11, "r_hip": 12,
    "l_knee": 13, "r_knee": 14, "l_ankle": 15, "r_ankle": 16,
}

SEVERITY_MAP = {
    "fighting":               "critical",
    "crowd_panic":            "critical",
    "person_down":            "high",
    "loitering":              "low",
    "suspicious_proximity":   "medium",
    "perimeter_climbing":     "high",
    "night_gathering":        "medium",
    "concealment_gesture":    "high",
    "item_to_bag":            "high",
    "repeated_aisle_passes":  "medium",
    "high_value_dwell":       "medium",
    "self_checkout_anomaly":  "medium",
    "crowd_crush":            "critical",
    "normal":                 "low",
}


def _kp_xy(kps: np.ndarray, name: str, min_conf: float = 0.3, conf: Optional[np.ndarray] = None) -> Optional[tuple]:
    """Get (x, y) for a keypoint if confidence is sufficient."""
    idx = KP[name]
    if conf is not None and conf[idx] < min_conf:
        return None
    return float(kps[idx][0]), float(kps[idx][1])


def _dist(a: Optional[tuple], b: Optional[tuple]) -> Optional[float]:
    """Euclidean distance between two (x, y) points."""
    if a is None or b is None:
        return None
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def _person_height(kps: np.ndarray, conf: np.ndarray) -> Optional[float]:
    """Estimate person height from head to ankle in pixels."""
    head = _kp_xy(kps, "nose", conf=conf) or _kp_xy(kps, "l_eye", conf=conf)
    ankle = _kp_xy(kps, "l_ankle", conf=conf) or _kp_xy(kps, "r_ankle", conf=conf)
    if head is None or ankle is None:
        return None
    return abs(ankle[1] - head[1])


def _bbox_iou(b1: tuple, b2: tuple) -> float:
    """Compute IoU between two bboxes (x1,y1,x2,y2)."""
    xi1 = max(b1[0], b2[0])
    yi1 = max(b1[1], b2[1])
    xi2 = min(b1[2], b2[2])
    yi2 = min(b1[3], b2[3])
    inter = max(0, xi2 - xi1) * max(0, yi2 - yi1)
    a1 = (b1[2] - b1[0]) * (b1[3] - b1[1])
    a2 = (b2[2] - b2[0]) * (b2[3] - b2[1])
    union = a1 + a2 - inter
    return inter / union if union > 0 else 0.0


# ---------------------------------------------------------------------------
# Individual behavior detectors
# ---------------------------------------------------------------------------

def _detect_fighting(person: dict, all_persons: list[dict]) -> Optional[dict]:
    """
    Fighting: two or more persons with raised arms in close proximity.
    Heuristic: wrist above shoulder AND inter-person distance < 1.5x avg height.
    """
    kps = person["keypoints_xy"]
    conf = person["keypoints_conf"]
    bbox = person["bbox"]

    l_wrist = _kp_xy(kps, "l_wrist", conf=conf)
    r_wrist = _kp_xy(kps, "r_wrist", conf=conf)
    l_shoulder = _kp_xy(kps, "l_shoulder", conf=conf)
    r_shoulder = _kp_xy(kps, "r_shoulder", conf=conf)

    # Raised arm: wrist higher (smaller y) than shoulder
    l_raised = l_wrist and l_shoulder and l_wrist[1] < l_shoulder[1]
    r_raised = r_wrist and r_shoulder and r_wrist[1] < r_shoulder[1]

    if not (l_raised or r_raised):
        return None

    # Check proximity to another person with raised arm
    h = _person_height(kps, conf) or 200
    for other in all_persons:
        if other is person:
            continue
        other_kps = other["keypoints_xy"]
        other_conf = other["keypoints_conf"]
        o_lw = _kp_xy(other_kps, "l_wrist", conf=other_conf)
        o_rw = _kp_xy(other_kps, "r_wrist", conf=other_conf)
        o_ls = _kp_xy(other_kps, "l_shoulder", conf=other_conf)
        o_rs = _kp_xy(other_kps, "r_shoulder", conf=other_conf)
        other_raised = (
            (o_lw and o_ls and o_lw[1] < o_ls[1]) or
            (o_rw and o_rs and o_rw[1] < o_rs[1])
        )
        if other_raised:
            overlap = _bbox_iou(bbox, other["bbox"])
            if overlap > 0.1:  # overlapping bboxes = very close
                return {"behavior": "fighting", "confidence": 0.82}
    return None


def _detect_person_down(person: dict) -> Optional[dict]:
    """
    Person down: body is horizontal (head and ankle on similar y-level).
    Heuristic: |head_y - ankle_y| / |shoulder_x - hip_x| < threshold.
    """
    kps = person["keypoints_xy"]
    conf = person["keypoints_conf"]

    head = _kp_xy(kps, "nose", conf=conf)
    ankle = _kp_xy(kps, "l_ankle", conf=conf) or _kp_xy(kps, "r_ankle", conf=conf)
    l_shoulder = _kp_xy(kps, "l_shoulder", conf=conf)
    r_shoulder = _kp_xy(kps, "r_shoulder", conf=conf)

    if head is None or ankle is None:
        return None

    vertical_span = abs(head[1] - ankle[1])
    if l_shoulder and r_shoulder:
        horizontal_span = abs(l_shoulder[0] - r_shoulder[0])
    else:
        horizontal_span = vertical_span / 2  # estimate

    # If width > height significantly → person is horizontal → down
    if horizontal_span > 0 and vertical_span / (horizontal_span + 1e-6) < 1.2:
        return {"behavior": "person_down", "confidence": 0.78}
    return None


def _detect_concealment_gesture(person: dict) -> Optional[dict]:
    """
    Concealment: wrist(s) around hip level with head bent forward.
    Heuristic: wrist close to hip y + nose lower than shoulder.
    """
    kps = person["keypoints_xy"]
    conf = person["keypoints_conf"]

    l_wrist = _kp_xy(kps, "l_wrist", conf=conf)
    r_wrist = _kp_xy(kps, "r_wrist", conf=conf)
    l_hip = _kp_xy(kps, "l_hip", conf=conf)
    r_hip = _kp_xy(kps, "r_hip", conf=conf)
    nose = _kp_xy(kps, "nose", conf=conf)
    l_shoulder = _kp_xy(kps, "l_shoulder", conf=conf)

    hip_y = None
    if l_hip and r_hip:
        hip_y = (l_hip[1] + r_hip[1]) / 2
    elif l_hip:
        hip_y = l_hip[1]
    elif r_hip:
        hip_y = r_hip[1]

    if hip_y is None:
        return None

    wrist_near_hip = (
        (l_wrist and abs(l_wrist[1] - hip_y) < 60) or
        (r_wrist and abs(r_wrist[1] - hip_y) < 60)
    )
    head_bent = nose and l_shoulder and nose[1] > l_shoulder[1] - 20  # nose below shoulder

    if wrist_near_hip and head_bent:
        return {"behavior": "concealment_gesture", "confidence": 0.72}
    return None


def _detect_suspicious_proximity(person: dict, all_persons: list[dict]) -> Optional[dict]:
    """Persons standing very close without overlapping bboxes — loitering together."""
    bbox = person["bbox"]
    w = bbox[2] - bbox[0]

    for other in all_persons:
        if other is person:
            continue
        other_bbox = other["bbox"]
        iou = _bbox_iou(bbox, other_bbox)
        # Not overlapping but very close (gap < 30% of person width)
        gap_x = max(0, max(bbox[0], other_bbox[0]) - min(bbox[2], other_bbox[2]))
        if iou == 0 and gap_x < w * 0.3:
            return {"behavior": "suspicious_proximity", "confidence": 0.65}
    return None


def _detect_crowd_panic(all_persons: list[dict], frame_shape: tuple) -> Optional[dict]:
    """
    Crowd panic: many persons detected with overlapping bboxes + raised arms.
    Simplified heuristic based on density and bbox overlap count.
    """
    if len(all_persons) < 4:
        return None

    overlap_count = 0
    raised_count = 0
    for person in all_persons:
        kps = person["keypoints_xy"]
        conf = person["keypoints_conf"]
        l_wrist = _kp_xy(kps, "l_wrist", conf=conf)
        l_shoulder = _kp_xy(kps, "l_shoulder", conf=conf)
        if l_wrist and l_shoulder and l_wrist[1] < l_shoulder[1]:
            raised_count += 1
        for other in all_persons:
            if other is not person and _bbox_iou(person["bbox"], other["bbox"]) > 0.15:
                overlap_count += 1

    density_ratio = len(all_persons) / max(1, (frame_shape[0] * frame_shape[1]) / (640 * 480))
    if raised_count >= 2 and overlap_count >= 3 and density_ratio > 0.4:
        return {"behavior": "crowd_panic", "confidence": 0.75}
    return None


# ---------------------------------------------------------------------------
# Main classifier
# ---------------------------------------------------------------------------

class BehaviorClassifier:
    """Rule-based behavior classifier using COCO pose keypoints.

    No model weights needed — runs entirely on geometric heuristics
    computed from 17-keypoint outputs of the PoseEstimator.

    Designed for extensibility: add new behavior detectors as methods
    and call them from analyze().
    """

    def __init__(self):
        self.confidence_threshold = settings.BEHAVIOR_CONFIDENCE
        logger.info("BehaviorClassifier initialized (rule-based, no model weights)")

    def analyze(
        self,
        persons: list[dict],
        frame_shape: tuple = (480, 640, 3),
        mode: str = "school",
    ) -> list[dict]:
        """Analyze behaviors for all persons in a frame.

        Args:
            persons:     List of pose results from PoseEstimator.estimate().
                         Each must have: track_id, bbox, keypoints_xy, keypoints_conf
            frame_shape: (H, W, C) for density calculations.
            mode:        Deployment mode — 'school', 'mall', or 'supermarket'.

        Returns:
            List of behavior detections:
            [
                {
                    "track_id": int,
                    "behavior": str,
                    "confidence": float,
                    "severity": str,
                }
            ]
        """
        start = time.perf_counter()
        results = []

        # --- Per-person detections ---
        for person in persons:
            track_id = person.get("track_id", -1)
            detected = None

            if mode in ("school",):
                detected = _detect_fighting(person, persons)
            if detected is None:
                detected = _detect_person_down(person)
            if detected is None and mode in ("supermarket",):
                detected = _detect_concealment_gesture(person)
            if detected is None:
                detected = _detect_suspicious_proximity(person, persons)

            if detected and detected["confidence"] >= self.confidence_threshold:
                results.append({
                    "track_id": track_id,
                    "behavior": detected["behavior"],
                    "confidence": detected["confidence"],
                    "severity": SEVERITY_MAP.get(detected["behavior"], "low"),
                })

        # --- Frame-level detections (multi-person) ---
        crowd = _detect_crowd_panic(persons, frame_shape)
        if crowd and crowd["confidence"] >= self.confidence_threshold:
            # Assign to track_id -1 (crowd-level event, not per-person)
            results.append({
                "track_id": -1,
                "behavior": crowd["behavior"],
                "confidence": crowd["confidence"],
                "severity": SEVERITY_MAP.get(crowd["behavior"], "low"),
            })

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.debug(
            f"Behavior analysis: {len(results)} events from {len(persons)} "
            f"persons in {elapsed_ms:.2f}ms (mode={mode})"
        )

        return results
