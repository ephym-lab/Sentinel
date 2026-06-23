"""
Rule-based behavior classifier using COCO pose keypoints.

Analyzes 17-keypoint body poses to detect security-relevant behaviors.
Pure Python — no ML model needed, works on CPU in microseconds per frame
(the fighting detector additionally keeps a small rolling history per
track to add a temporal/kinematic signal — this is what separates real
fighting from close-but-static proximity like hugs, queues, or helping
someone up).

Detected behaviors per deployment mode:
  School:     fighting, crowd_panic, person_down, loitering, perimeter_climbing, night_gathering
  Mall:       crowd_panic, person_down, loitering, suspicious_proximity, crowd_crush
  Supermarket: concealment_gesture, item_to_bag, repeated_aisle_passes, high_value_dwell,
               self_checkout_anomaly, fighting, person_down
"""

import logging
import math
import time
from collections import deque
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

# --- Fighting-specific tunables -------------------------------------------
# These live here (rather than buried in the function) since they're the
# knobs you'll want to adjust per deployment/camera angle.
FIGHT_MIN_WRIST_VELOCITY = 250.0   # px/sec — below this, treat as static (hug/queue/wave)
FIGHT_DIRECTION_COS_THRESHOLD = 0.5  # how "aimed at the other person" an arm must be
FIGHT_PERSISTENCE_FRAMES = 5        # consecutive qualifying frames required before alerting
FIGHT_HISTORY_WINDOW_SEC = 1.5      # how long to keep wrist history per track
FIGHT_CANDIDATE_TIMEOUT_SEC = 0.6   # drop a pair's streak if no qualifying frame for this long


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


def _bbox_center(bbox: tuple) -> tuple:
    return ((bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0)


def _arm_aimed_at(
    kps: np.ndarray,
    conf: np.ndarray,
    shoulder_name: str,
    wrist_name: str,
    target_point: Optional[tuple],
) -> bool:
    """
    True if the shoulder->wrist vector points roughly toward target_point,
    rather than just being "raised" in the y-axis. This is what separates
    a punch/shove/grab (aimed at the other person) from a wave, a stretch,
    or an arm thrown up in a hug (not aimed at the other person's torso).
    """
    shoulder = _kp_xy(kps, shoulder_name, conf=conf)
    wrist = _kp_xy(kps, wrist_name, conf=conf)
    if not (shoulder and wrist and target_point):
        return False

    arm_vec = (wrist[0] - shoulder[0], wrist[1] - shoulder[1])
    to_target = (target_point[0] - shoulder[0], target_point[1] - shoulder[1])

    mag_arm = math.hypot(*arm_vec)
    mag_target = math.hypot(*to_target)
    if mag_arm < 1e-3 or mag_target < 1e-3:
        return False

    cos_sim = (arm_vec[0] * to_target[0] + arm_vec[1] * to_target[1]) / (mag_arm * mag_target)
    return cos_sim > FIGHT_DIRECTION_COS_THRESHOLD


# ---------------------------------------------------------------------------
# Individual behavior detectors
# ---------------------------------------------------------------------------

def _detect_fighting_static(person: dict, other: dict) -> Optional[float]:
    """
    Single-frame fighting *candidate* check between a specific pair.
    Returns a confidence-ish score (0-1) if this frame looks like a fighting
    pose, or None if it doesn't even pass the static gate. This does NOT by
    itself confirm fighting — see BehaviorClassifier._detect_fighting_pair,
    which adds the temporal/kinematic gate before raising an alert.

    Static gate, all required:
      - bboxes overlap (people are actually touching/close, not just near)
      - at least one of this person's arms is raised AND aimed at the other
        person's bbox center (not just "wrist above shoulder")
      - the other person also has a raised+aimed arm (mutual engagement,
        not one person reaching past/around a bystander)
    """
    kps = person["keypoints_xy"]
    conf = person["keypoints_conf"]
    bbox = person["bbox"]
    other_bbox = other["bbox"]

    overlap = _bbox_iou(bbox, other_bbox)
    if overlap <= 0.10:
        return None

    other_center = _bbox_center(other_bbox)
    self_center = _bbox_center(bbox)

    l_aimed = _arm_aimed_at(kps, conf, "l_shoulder", "l_wrist", other_center)
    r_aimed = _arm_aimed_at(kps, conf, "r_shoulder", "r_wrist", other_center)
    if not (l_aimed or r_aimed):
        return None

    other_kps = other["keypoints_xy"]
    other_conf = other["keypoints_conf"]
    o_l_aimed = _arm_aimed_at(other_kps, other_conf, "l_shoulder", "l_wrist", self_center)
    o_r_aimed = _arm_aimed_at(other_kps, other_conf, "r_shoulder", "r_wrist", self_center)
    if not (o_l_aimed or o_r_aimed):
        return None

    # Base confidence scales gently with overlap — more overlap = more
    # plausibly in physical contact, but this is just the static component.
    return min(0.6 + overlap * 0.3, 0.9)


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

    # If the bounding box width significantly exceeds height, the person is laying down
    bbox = person.get("bbox")
    if bbox:
        bbox_w = bbox[2] - bbox[0]
        bbox_h = bbox[3] - bbox[1]
        if bbox_w > bbox_h * 1.5:
            return {"behavior": "person_down", "confidence": 0.85}

    # Alternatively, fallback to normalized keypoint aspect ratio check
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

        # Enforce true space isolation: must not overlap at all to count as proximity loitering
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
    """Rule-based behavior classifier using COCO pose keypoints."""

    def __init__(self):
        self.confidence_threshold = settings.BEHAVIOR_CONFIDENCE

        # --- Temporal state for fighting detection -------------------------
        # Per-track wrist position history, used to compute wrist velocity.
        # Keyed by track_id -> deque[(timestamp, l_wrist_xy, r_wrist_xy)]
        self._wrist_history: dict[int, deque] = {}

        # Per-pair consecutive-qualifying-frame streaks, used for the
        # persistence gate. Keyed by frozenset({track_id_a, track_id_b}).
        self._fight_streaks: dict[frozenset, dict] = {}
        # each value: {"count": int, "last_seen": float}

        logger.info(
            "BehaviorClassifier initialized (rule-based, prioritized execution "
            "hierarchy, temporal fighting detection enabled)"
        )

    # -- temporal helpers ----------------------------------------------------

    def _update_wrist_history(self, person: dict, now: float) -> None:
        track_id = person.get("track_id", -1)
        kps = person["keypoints_xy"]
        conf = person["keypoints_conf"]
        l_wrist = _kp_xy(kps, "l_wrist", conf=conf)
        r_wrist = _kp_xy(kps, "r_wrist", conf=conf)

        history = self._wrist_history.setdefault(track_id, deque())
        history.append((now, l_wrist, r_wrist))

        # Trim anything older than the window
        while history and (now - history[0][0]) > FIGHT_HISTORY_WINDOW_SEC:
            history.popleft()

    def _wrist_velocity(self, track_id: int) -> float:
        """Max of left/right wrist speed (px/sec) over the most recent step."""
        history = self._wrist_history.get(track_id)
        if not history or len(history) < 2:
            return 0.0

        t1, lw1, rw1 = history[-1]
        t0, lw0, rw0 = history[-2]
        dt = max(t1 - t0, 1e-3)

        v = 0.0
        d_l = _dist(lw0, lw1)
        d_r = _dist(rw0, rw1)
        if d_l is not None:
            v = max(v, d_l / dt)
        if d_r is not None:
            v = max(v, d_r / dt)
        return v

    def _prune_stale_streaks(self, now: float) -> None:
        stale = [
            pair for pair, info in self._fight_streaks.items()
            if (now - info["last_seen"]) > FIGHT_CANDIDATE_TIMEOUT_SEC
        ]
        for pair in stale:
            del self._fight_streaks[pair]

    def _prune_stale_tracks(self, seen_track_ids: set, now: float) -> None:
        """Drop wrist history for tracks no longer present (avoids unbounded growth)."""
        for track_id in list(self._wrist_history.keys()):
            if track_id not in seen_track_ids:
                del self._wrist_history[track_id]

    def _detect_fighting_pair(self, person: dict, other: dict, now: float) -> Optional[dict]:
        """
        Confirm fighting for a specific pair by combining:
          1. The static pose gate (_detect_fighting_static) — overlapping
             bboxes + mutually-aimed raised arms, not just "near each other".
          2. A kinematic gate — at least one of the pair must have wrist
             velocity above FIGHT_MIN_WRIST_VELOCITY. This is what filters
             out a static hug or two people standing close in a queue: real
             fighting involves fast, repeated limb motion, not held poses.
          3. A persistence gate — the pair must satisfy both of the above
             for FIGHT_PERSISTENCE_FRAMES consecutive frames before we
             actually raise an alert, to absorb motion blur / single bad
             frames / a single quick gesture.
        """
        static_conf = _detect_fighting_static(person, other)

        track_a = person.get("track_id", -1)
        track_b = other.get("track_id", -1)
        pair_key = frozenset({track_a, track_b})

        if static_conf is None:
            # The static pose gate failed this frame (e.g. a momentary gap
            # opened up between two people mid-fight, or one arm dropped
            # for a frame). Real fighting isn't a perfectly continuous
            # overlap+aim signal frame-to-frame — people step back and
            # lunge again. So we don't reset the streak immediately; we
            # let it survive until FIGHT_CANDIDATE_TIMEOUT_SEC of *real*
            # gap time has passed (handled by _prune_stale_streaks), and
            # simply don't advance it on this frame.
            existing = self._fight_streaks.get(pair_key)
            if existing and existing["count"] >= FIGHT_PERSISTENCE_FRAMES:
                # Already confirmed fighting recently and still within the
                # grace window — keep reporting it rather than flickering
                # back to "no detection" / proximity for one gap frame.
                return {"behavior": "fighting", "confidence": existing.get("last_confidence", 0.75)}
            return None

        v_a = self._wrist_velocity(track_a)
        v_b = self._wrist_velocity(track_b)
        if max(v_a, v_b) < FIGHT_MIN_WRIST_VELOCITY:
            # Pose looks right but nobody's actually moving fast — likely a
            # hug, a held grab, someone helping another person up, etc.
            # Don't build the streak on a static frame. Same grace-window
            # carry-forward as above applies if already confirmed.
            existing = self._fight_streaks.get(pair_key)
            if existing and existing["count"] >= FIGHT_PERSISTENCE_FRAMES:
                return {"behavior": "fighting", "confidence": existing.get("last_confidence", 0.75)}
            return None

        # Both gates passed this frame — advance (or start) the streak.
        streak = self._fight_streaks.get(pair_key, {"count": 0, "last_seen": now})
        streak["count"] += 1
        streak["last_seen"] = now

        if streak["count"] < FIGHT_PERSISTENCE_FRAMES:
            self._fight_streaks[pair_key] = streak
            return None

        # Confidence blends the static pose confidence with how fast the
        # motion is (capped), so a clear sustained brawl scores higher than
        # one that just barely cleared the velocity threshold.
        velocity_factor = min(max(v_a, v_b) / (FIGHT_MIN_WRIST_VELOCITY * 3), 1.0)
        confidence = min(static_conf + velocity_factor * 0.1, 0.97)
        streak["last_confidence"] = confidence
        self._fight_streaks[pair_key] = streak

        return {"behavior": "fighting", "confidence": confidence}

    # -- main entry point ------------------------------------------------

    def analyze(
        self,
        persons: list[dict],
        active_behaviors: list[str],
        frame_shape: tuple = (480, 640, 3),
        timestamp: Optional[float] = None,
    ) -> list[dict]:
        """
        Analyze behaviors for all persons in a frame based on active user-configurable rules.

        `timestamp` should be the capture time of this frame in seconds
        (e.g. time.monotonic() or the frame's PTS converted to seconds).
        If omitted, wall-clock time.perf_counter() is used, which is fine
        for live streams but will misbehave if you're processing frames
        out of real-time order (e.g. fast-forwarding through a VOD) —
        pass explicit timestamps in that case so velocity/persistence
        calculations stay correct.
        """
        start = time.perf_counter()
        now = timestamp if timestamp is not None else time.perf_counter()
        results = []

        seen_track_ids = {p.get("track_id", -1) for p in persons}

        # Update temporal state for every person first, so velocity lookups
        # during this frame's detection pass see fresh data for everyone.
        for person in persons:
            self._update_wrist_history(person, now)

        self._prune_stale_streaks(now)
        self._prune_stale_tracks(seen_track_ids, now)

        # Each unordered pair must be evaluated (and therefore have its
        # streak counter advanced) AT MOST ONCE per frame. Without this,
        # the nested person/other loop below visits (A,B) and (B,A)
        # separately and would double-increment the same streak per frame.
        evaluated_pairs_this_frame: set = set()
        fight_result_by_pair: dict = {}

        if "fighting" in active_behaviors:
            for person in persons:
                track_id = person.get("track_id", -1)
                for other in persons:
                    if other is person:
                        continue
                    pair_key = frozenset({track_id, other.get("track_id", -1)})
                    if pair_key in evaluated_pairs_this_frame:
                        continue
                    evaluated_pairs_this_frame.add(pair_key)
                    fight = self._detect_fighting_pair(person, other, now)
                    if fight is not None:
                        fight_result_by_pair[pair_key] = fight

        # --- Per-person detections ---
        for person in persons:
            track_id = person.get("track_id", -1)
            detected = None

            # Priority 1: Fighting (CRITICAL threat)
            if "fighting" in active_behaviors:
                for other in persons:
                    if other is person:
                        continue
                    pair_key = frozenset({track_id, other.get("track_id", -1)})
                    fight = fight_result_by_pair.get(pair_key)
                    if fight is not None:
                        detected = fight
                        break

            # Priority 2: Medical emergency (HIGH priority)
            if detected is None and "person_down" in active_behaviors:
                detected = _detect_person_down(person)

            # Priority 3: Retail Loss Prevention Gestures
            if detected is None and "concealment_gesture" in active_behaviors:
                detected = _detect_concealment_gesture(person)

            # Priority 4: Suspicious Proximity
            if detected is None and "suspicious_proximity" in active_behaviors:
                detected = _detect_suspicious_proximity(person, persons)

            if detected and detected["confidence"] >= self.confidence_threshold:
                results.append({
                    "track_id": track_id,
                    "behavior": detected["behavior"],
                    "confidence": detected["confidence"],
                    "severity": SEVERITY_MAP.get(detected["behavior"], "low"),
                })

        # --- Frame-level detections (multi-person) ---
        if "crowd_panic" in active_behaviors:
            crowd = _detect_crowd_panic(persons, frame_shape)
            if crowd and crowd["confidence"] >= self.confidence_threshold:
                results.append({
                    "track_id": -1,
                    "behavior": crowd["behavior"],
                    "confidence": crowd["confidence"],
                    "severity": SEVERITY_MAP.get(crowd["behavior"], "low"),
                })

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.debug(
            f"Behavior analysis: {len(results)} events from {len(persons)} "
            f"persons in {elapsed_ms:.2f}ms (active_behaviors={len(active_behaviors)})"
        )

        return results