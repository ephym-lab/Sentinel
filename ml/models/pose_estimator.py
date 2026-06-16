"""
Pose estimator using YOLO26-pose.

Uses the COCO-pose pretrained YOLO26 model (auto-downloads from Ultralytics hub)
to extract 17 body keypoints per person. Keypoints feed the behavior classifier
in Phase 4.

COCO Keypoint Map (17 points):
    0:  nose
    1:  left_eye,   2: right_eye
    3:  left_ear,   4: right_ear
    5:  left_shoulder, 6: right_shoulder
    7:  left_elbow, 8: right_elbow
    9:  left_wrist, 10: right_wrist
    11: left_hip,   12: right_hip
    13: left_knee,  14: right_knee
    15: left_ankle, 16: right_ankle
"""

import logging
import time
from typing import Optional

import numpy as np

from ml.config import settings

logger = logging.getLogger(__name__)

# COCO keypoint labels for reference
KEYPOINT_NAMES = [
    "nose",
    "left_eye", "right_eye",
    "left_ear", "right_ear",
    "left_shoulder", "right_shoulder",
    "left_elbow", "right_elbow",
    "left_wrist", "right_wrist",
    "left_hip", "right_hip",
    "left_knee", "right_knee",
    "left_ankle", "right_ankle",
]


class PoseEstimator:
    """YOLO26-pose: 17-keypoint body pose estimation.

    Returns keypoints per detected person. Keypoints are used by the
    behavior classifier to detect:
    - Fighting (raised fists, close proximity)
    - Falling (sudden change in vertical position)
    - Panic/running (gait analysis)
    - Crowd distress
    """

    def __init__(self):
        from ultralytics import YOLO

        self.device = settings.DEVICE
        self.model_variant = settings.YOLO_POSE_MODEL
        self.conf_threshold = settings.PERSON_CONF_THRESHOLD

        self.model = YOLO(self.model_variant)
        self.model.to(self.device)

        logger.info(
            f"Loaded PoseEstimator: {self.model_variant} on {self.device}"
        )

    def estimate(self, frame: np.ndarray) -> list[dict]:
        """Estimate pose for all persons in a frame.

        Args:
            frame: BGR image as numpy array.

        Returns:
            List of dicts per detected person:
            {
                "bbox": (x1, y1, x2, y2),
                "confidence": float,
                "keypoints": [
                    {"name": str, "x": float, "y": float, "confidence": float},
                    ...  # 17 keypoints
                ],
                "keypoints_xy": np.ndarray (17, 2),   # raw (x, y) coords
                "keypoints_conf": np.ndarray (17,),    # per-keypoint confidence
            }
        """
        start = time.perf_counter()

        results = self.model.predict(
            frame,
            conf=self.conf_threshold,
            device=self.device,
            verbose=False,
        )

        persons = []
        for result in results:
            if result.keypoints is None or result.boxes is None:
                continue

            kps_xy = result.keypoints.xy.cpu().numpy()       # (N, 17, 2)
            kps_conf = result.keypoints.conf.cpu().numpy()    # (N, 17)
            boxes = result.boxes

            for i, box in enumerate(boxes):
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                conf = float(box.conf[0].cpu())

                xy = kps_xy[i]       # (17, 2)
                kconf = kps_conf[i]  # (17,)

                keypoints = [
                    {
                        "name": KEYPOINT_NAMES[k],
                        "x": float(xy[k][0]),
                        "y": float(xy[k][1]),
                        "confidence": float(kconf[k]),
                    }
                    for k in range(17)
                ]

                persons.append({
                    "bbox": (x1, y1, x2, y2),
                    "confidence": conf,
                    "keypoints": keypoints,
                    "keypoints_xy": xy,
                    "keypoints_conf": kconf,
                })

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.debug(f"Pose estimate: {len(persons)} persons in {elapsed_ms:.1f}ms")

        return persons

    def estimate_tracked(
        self,
        frame: np.ndarray,
        tracker: str = "bytetrack.yaml",
        persist: bool = True,
    ) -> list[dict]:
        """Estimate pose + track persons across frames simultaneously.

        Combines detection, pose estimation, and tracking in a single
        model.track() call — more efficient than running them separately.

        Args:
            frame:   BGR image as numpy array.
            tracker: Tracker config — "bytetrack.yaml" or "botsort.yaml".
            persist: Keep track history between frames.

        Returns:
            Same as estimate() but each dict also has:
            {
                "track_id": int,   # Persistent ByteTrack ID
                ...
            }
        """
        start = time.perf_counter()

        results = self.model.track(
            frame,
            conf=self.conf_threshold,
            tracker=tracker,
            persist=persist,
            device=self.device,
            verbose=False,
        )

        persons = []
        for result in results:
            if result.keypoints is None or result.boxes is None:
                continue

            kps_xy = result.keypoints.xy.cpu().numpy()
            kps_conf = result.keypoints.conf.cpu().numpy()
            boxes = result.boxes

            for i, box in enumerate(boxes):
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                conf = float(box.conf[0].cpu())
                track_id = int(boxes.id[i].cpu()) if boxes.id is not None else -1

                xy = kps_xy[i]
                kconf = kps_conf[i]

                keypoints = [
                    {
                        "name": KEYPOINT_NAMES[k],
                        "x": float(xy[k][0]),
                        "y": float(xy[k][1]),
                        "confidence": float(kconf[k]),
                    }
                    for k in range(17)
                ]

                persons.append({
                    "track_id": track_id,
                    "bbox": (x1, y1, x2, y2),
                    "confidence": conf,
                    "keypoints": keypoints,
                    "keypoints_xy": xy,
                    "keypoints_conf": kconf,
                })

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.debug(f"Pose+track: {len(persons)} persons in {elapsed_ms:.1f}ms")

        return persons

    def reset_tracker(self):
        """Reset ByteTrack state for new camera stream."""
        from ultralytics import YOLO
        self.model = YOLO(self.model_variant)
        self.model.to(self.device)
        logger.info("PoseEstimator tracker state reset")
