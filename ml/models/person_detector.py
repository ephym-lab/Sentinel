"""
Person detector using YOLO26.

Uses the COCO-pretrained YOLO26 model (auto-downloads from Ultralytics hub)
filtered to class 0 (person). Includes built-in ByteTrack tracking for
persistent person IDs across frames.

YOLO26 Architecture notes:
- NMS-free by default (end-to-end head)
- Built-in multi-object tracking via model.track()
- COCO class 0 = person
- Supports all 5 task types in one unified API
"""

import logging
import time
from typing import Optional

import numpy as np

from ml.config import settings

logger = logging.getLogger(__name__)

PERSON_CLASS_ID = 0  # COCO class index for "person"


class PersonDetector:
    """YOLO26 person detector with built-in ByteTrack tracking.

    Detection:  model.predict() — single frame, returns raw detections
    Tracking:   model.track()  — stateful, assigns persistent track IDs across frames

    Filters COCO class 0 (person) from the general detection head.
    """

    def __init__(self):
        from ultralytics import YOLO

        self.device = settings.DEVICE
        self.model_variant = settings.YOLO_DETECT_MODEL
        self.conf_threshold = settings.PERSON_CONF_THRESHOLD
        self.iou_threshold = settings.IOU_THRESHOLD

        self.model = YOLO(self.model_variant)
        self.model.to(self.device)

        logger.info(
            f"Loaded PersonDetector: {self.model_variant} on {self.device} "
            f"(NMS-free={settings.YOLO_END2END})"
        )

    def detect(self, frame: np.ndarray) -> list[dict]:
        """Detect persons in a single frame (no tracking).

        Args:
            frame: BGR image as numpy array.

        Returns:
            List of dicts:
            {
                "bbox": (x1, y1, x2, y2),
                "confidence": float,
                "class_id": int,  # always 0 (person)
            }
        """
        start = time.perf_counter()

        results = self.model.predict(
            frame,
            classes=[PERSON_CLASS_ID],
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            device=self.device,
            verbose=False,
        )

        detections = []
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                conf = float(box.conf[0].cpu())
                cls = int(box.cls[0].cpu())
                if cls == PERSON_CLASS_ID:
                    detections.append({
                        "bbox": (x1, y1, x2, y2),
                        "confidence": conf,
                        "class_id": cls,
                    })

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.debug(f"Person detect: {len(detections)} persons in {elapsed_ms:.1f}ms")

        return detections

    def track(
        self,
        frame: np.ndarray,
        tracker: str = "bytetrack.yaml",
        persist: bool = True,
    ) -> list[dict]:
        """Detect and track persons across frames using ByteTrack.

        Maintains persistent track IDs across calls. Call with the same
        model instance across frames — do not create a new instance per frame.

        Args:
            frame:   BGR image as numpy array.
            tracker: Tracker config — "bytetrack.yaml" or "botsort.yaml".
            persist: Keep track history between frames (required for tracking).

        Returns:
            List of dicts:
            {
                "track_id": int,    # Persistent ID across frames
                "bbox": (x1, y1, x2, y2),
                "confidence": float,
                "class_id": int,
            }
        """
        start = time.perf_counter()

        results = self.model.track(
            frame,
            classes=[PERSON_CLASS_ID],
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            tracker=tracker,
            persist=persist,
            device=self.device,
            verbose=False,
        )

        tracks = []
        for result in results:
            boxes = result.boxes
            if boxes is None or boxes.id is None:
                continue
            for box, track_id in zip(boxes, boxes.id):
                cls = int(box.cls[0].cpu())
                if cls != PERSON_CLASS_ID:
                    continue
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                conf = float(box.conf[0].cpu())
                tracks.append({
                    "track_id": int(track_id.cpu()),
                    "bbox": (x1, y1, x2, y2),
                    "confidence": conf,
                    "class_id": cls,
                })

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.debug(f"Person track: {len(tracks)} tracks in {elapsed_ms:.1f}ms")

        return tracks

    def reset_tracker(self):
        """Reset ByteTrack state — call when switching to a new camera stream."""
        # Re-instantiate to clear internal tracking state
        from ultralytics import YOLO
        self.model = YOLO(self.model_variant)
        self.model.to(self.device)
        logger.info("PersonDetector tracker state reset")
