"""
Face detector using YOLO26.

Uses a YOLO26 model fine-tuned on WIDER FACE dataset for face detection.
Falls back to the general YOLO26 COCO detector (class 0 = person) with
face-region heuristics if custom face weights are not available.

YOLO26 is NMS-free by default — no post-processing needed.
"""

import logging
import time
from pathlib import Path
from typing import Optional

import numpy as np

from ml.config import settings

logger = logging.getLogger(__name__)


class FaceDetector:
    """YOLO26-based face detector.

    Loads a fine-tuned face model if available, otherwise falls back
    to the general COCO detector with person-class filtering.
    """

    def __init__(self):
        from ultralytics import YOLO

        self.device = settings.DEVICE
        self.conf_threshold = settings.FACE_DETECTION_CONFIDENCE
        self.imgsz = settings.YOLO_IMGSZ
        self.max_faces = settings.MAX_FACES_PER_FRAME

        # Try custom face model first, fall back to general detection
        face_weights = Path(settings.YOLO_FACE_MODEL)
        if face_weights.exists():
            self.model = YOLO(str(face_weights))
            self.is_custom_face_model = True
            logger.info(f"Loaded custom face model: {face_weights}")
        else:
            self.model = YOLO(settings.YOLO_DETECT_MODEL)
            self.is_custom_face_model = False
            logger.warning(
                f"Custom face weights not found at {face_weights}. "
                f"Using general detector ({settings.YOLO_DETECT_MODEL}) — "
                f"face detection accuracy will be reduced."
            )

    def detect(
        self,
        frame: np.ndarray,
        conf: Optional[float] = None,
        max_faces: Optional[int] = None,
    ) -> list[dict]:
        """Detect faces in a frame.

        Args:
            frame: BGR numpy array (H, W, 3).
            conf: Confidence threshold override.
            max_faces: Maximum number of faces to return.

        Returns:
            List of face detections, each containing:
            {
                "bbox": (x1, y1, x2, y2),
                "confidence": float,
                "landmarks": [[x, y], ...] or None  # 5-point if available
            }
        """
        conf = conf or self.conf_threshold
        max_faces = max_faces or self.max_faces
        start = time.perf_counter()

        if self.is_custom_face_model:
            # Custom face model — all detections are faces
            results = self.model.predict(
                source=frame,
                conf=conf,
                imgsz=self.imgsz,
                device=self.device,
                verbose=False,
                max_det=max_faces,
            )
        else:
            # General COCO detector — filter to person class (0) only
            results = self.model.predict(
                source=frame,
                conf=conf,
                imgsz=self.imgsz,
                device=self.device,
                verbose=False,
                classes=[0],  # person class
                max_det=max_faces,
            )

        elapsed_ms = (time.perf_counter() - start) * 1000

        faces = []
        if results and len(results) > 0:
            boxes = results[0].boxes
            if boxes is not None and len(boxes) > 0:
                for i in range(len(boxes)):
                    x1, y1, x2, y2 = boxes.xyxy[i].cpu().numpy().astype(int)
                    confidence = float(boxes.conf[i].cpu().numpy())

                    if not self.is_custom_face_model:
                        # Heuristic: Estimate face region from person bounding box
                        w = x2 - x1
                        h = y2 - y1
                        face_w = int(w * 0.4)
                        face_h = face_w  # Approximate face as a square
                        
                        x1 = x1 + int((w - face_w) / 2)
                        x2 = x1 + face_w
                        y1 = y1 + int(h * 0.05)  # Start slightly below the very top
                        y2 = y1 + face_h

                    face = {
                        "bbox": (int(x1), int(y1), int(x2), int(y2)),
                        "confidence": confidence,
                        "landmarks": None,  # YOLO26 detection doesn't output landmarks
                    }
                    faces.append(face)

        logger.debug(
            f"Face detection: {len(faces)} faces in {elapsed_ms:.1f}ms "
            f"(custom_model={self.is_custom_face_model})"
        )
        return faces

    def detect_and_crop(
        self,
        frame: np.ndarray,
        crop_size: int = 112,
        margin: float = 0.2,
    ) -> list[dict]:
        """Detect faces and return aligned crops ready for embedding extraction.

        Args:
            frame: BGR numpy array.
            crop_size: Output crop size (square).
            margin: Bounding box expansion margin.

        Returns:
            List of detections, each with an additional "crop" key containing
            the aligned face crop as a numpy array.
        """
        from ml.utils.image_utils import align_and_crop_face, expand_bbox

        detections = self.detect(frame)

        for det in detections:
            bbox = det["bbox"]
            expanded = expand_bbox(bbox, frame.shape, margin=margin)
            crop = align_and_crop_face(
                frame,
                expanded,
                landmarks=None,  # landmarks from separate model if available
                target_size=crop_size,
            )
            det["crop"] = crop

        return detections
