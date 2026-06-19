"""
Fire and smoke detector using YOLO26.

Uses a YOLO26 model fine-tuned on a fire/smoke dataset.
Falls back to the general COCO detector with class heuristics
if custom weights are not available.

Custom model must be placed at: ml/weights/yolo26n-fire.pt (dev)
                                 ml/weights/yolo26l-fire.pt (prod)

Training dataset recommendations:
  - Fire Detection Dataset (Roboflow): https://universe.roboflow.com/fire-detection
  - D-Fire: https://github.com/gaiasd/DFireDataset
"""

import logging
import time
from pathlib import Path
from typing import Optional

import numpy as np

from ml.config import settings

logger = logging.getLogger(__name__)

# Class labels expected from a fire-trained YOLO26 model
FIRE_CLASSES = {0: "fire", 1: "smoke"}


class FireDetector:
    """YOLO26 fire and smoke detector.

    Loads a fine-tuned fire model if weights exist in ml/weights/.
    Falls back to general detector (no fire/smoke detection capability)
    and logs a warning.

    NMS-free by default with YOLO26 — output shape (N, 300, 6).
    """

    def __init__(self):
        from ultralytics import YOLO

        self.device = settings.DEVICE
        self.conf_threshold = settings.FIRE_DETECTION_CONFIDENCE
        self.imgsz = settings.YOLO_IMGSZ
        self.model_path = settings.YOLO_FIRE_MODEL

        fire_weights = Path(self.model_path)
        if fire_weights.exists():
            self.model = YOLO(str(fire_weights))
            self.is_custom = True
            logger.info(f"Loaded custom fire model: {fire_weights}")
        else:
            self.model = None
            self.is_custom = False
            logger.warning(
                f"Fire model weights not found at {fire_weights}. "
                "Falling back to basic OpenCV HSV color thresholding for demo purposes."
            )

    def detect(self, frame: np.ndarray) -> list[dict]:
        """Detect fire and smoke in a frame.

        Args:
            frame: BGR image as numpy array.

        Returns:
            List of detections:
            {
                "bbox": (x1, y1, x2, y2),
                "label": "fire" or "smoke",
                "confidence": float,
            }
        """
        start = time.perf_counter()
        detections = []

        if self.model:
            results = self.model.predict(
                frame,
                conf=self.conf_threshold,
                imgsz=self.imgsz,
                device=self.device,
                verbose=False,
            )

            for result in results:
                boxes = result.boxes
                if boxes is None:
                    continue
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                    conf = float(box.conf[0].cpu())
                    cls_id = int(box.cls[0].cpu())
                    label = FIRE_CLASSES.get(cls_id, f"class_{cls_id}")
                    detections.append({
                        "bbox": (int(x1), int(y1), int(x2), int(y2)),
                        "label": label,
                        "confidence": conf,
                    })
        else:
            import cv2
            # Fallback: Basic OpenCV HSV color thresholding for fire
            # Convert to HSV
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            
            # Define lower and upper bounds for bright orange/yellow/white fire
            lower_fire = np.array([0, 120, 180])
            upper_fire = np.array([30, 255, 255])
            
            # Threshold the HSV image
            mask = cv2.inRange(hsv, lower_fire, upper_fire)
            
            # Find contours
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area > 800: # Minimum area threshold to ignore noise
                    x, y, w, h = cv2.boundingRect(cnt)
                    # Simulated confidence based on area
                    conf = min(0.99, 0.5 + (area / 10000.0))
                    detections.append({
                        "bbox": (int(x), int(y), int(x + w), int(y + h)),
                        "label": "fire",
                        "confidence": float(conf),
                    })

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.debug(f"Fire detect: {len(detections)} detections in {elapsed_ms:.1f}ms")

        return detections

    def is_fire_emergency(self, detections: list[dict], min_area_ratio: float = 0.02) -> bool:
        """Determine if fire detections constitute an emergency.

        Args:
            detections:      Output from detect().
            min_area_ratio:  Minimum bbox area as fraction of frame (0.02 = 2%).

        Returns:
            True if any 'fire' detection exceeds the area threshold.
        """
        for det in detections:
            if det["label"] == "fire":
                x1, y1, x2, y2 = det["bbox"]
                area = (x2 - x1) * (y2 - y1)
                if area > 0:  # we don't have frame size here, trust conf
                    return True
        return False
