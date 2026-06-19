"""
ML service configuration.

Handles environment-based settings, model variant selection (dev vs prod),
confidence thresholds, and file path configuration.

YOLO26 Architecture Notes:
- YOLO26 is a unified model family from Ultralytics (Jan 2026)
- NMS-free by default (one-to-one head) — no post-processing needed
- Supports: detection, segmentation, pose estimation, classification, OBB
- 5 scales: n (nano), s (small), m (medium), l (large), x (extra-large)
- Face detection and fire detection use the same YOLO26 base, fine-tuned
  on custom datasets (WIDER FACE for faces, custom fire/smoke dataset)
- All variants use the same `from ultralytics import YOLO` API
"""

from enum import Enum
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

from ml.utils.device import get_device_string


class Environment(str, Enum):
    DEVELOPMENT = "development"
    PRODUCTION = "production"


class DeploymentMode(str, Enum):
    SCHOOL = "school"
    MALL = "mall"
    SUPERMARKET = "supermarket"


class MLSettings(BaseSettings):
    """ML service configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file="ml/.env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Environment ---
    ENV: Environment = Environment.DEVELOPMENT
    BACKEND_URL: str = "http://localhost:8000"
    ML_HOST: str = "0.0.0.0"
    ML_PORT: int = 8001

    # --- Device (auto-detected, not from env) ---
    @property
    def DEVICE(self) -> str:
        return get_device_string()

    @property
    def is_production(self) -> bool:
        return self.ENV == Environment.PRODUCTION

    # --- File storage ---
    @property
    def UPLOADS_DIR(self) -> str:
        """Centralized uploads directory at project root."""
        root = Path(__file__).resolve().parent.parent
        folder = root / "uploads"
        folder.mkdir(parents=True, exist_ok=True)
        return str(folder)

    @property
    def MODELS_DIR(self) -> Path:
        """Centralized models directory at project root to hold all model weights."""
        root = Path(__file__).resolve().parent.parent
        folder = root / "models"
        folder.mkdir(parents=True, exist_ok=True)
        return folder

    def tenant_dir(self, tenant_id: str, sub: str) -> Path:
        """Return and auto-create uploads/tenants/tenant_{tenant_id}/{sub}/"""
        folder_name = f"tenant_{tenant_id}"
        path = Path(self.UPLOADS_DIR) / "tenants" / folder_name / sub
        path.mkdir(parents=True, exist_ok=True)
        return path

    # --- YOLO26 model variants ---
    # Standard pretrained models from Ultralytics (auto-downloaded)
    # Dev uses nano (n) for CPU speed, prod uses large (l) for accuracy

    @property
    def YOLO_DETECT_MODEL(self) -> str:
        """General object/person detection (COCO pretrained)."""
        name = "yolo26l.pt" if self.is_production else "yolo26n.pt"
        return str(self.MODELS_DIR / name)

    @property
    def YOLO_POSE_MODEL(self) -> str:
        """Pose estimation — 17 skeletal keypoints (COCO-pose pretrained)."""
        name = "yolo26l-pose.pt" if self.is_production else "yolo26n-pose.pt"
        return str(self.MODELS_DIR / name)

    # Custom fine-tuned YOLO26 models (trained on task-specific datasets)

    @property
    def YOLO_FACE_MODEL(self) -> str:
        """Face detection — fine-tuned on WIDER FACE dataset.
        Falls back to general detection if custom weights not available."""
        name = "yolo26l-face.pt" if self.is_production else "yolo26n-face.pt"
        return str(self.MODELS_DIR / name)

    @property
    def YOLO_FIRE_MODEL(self) -> str:
        """Fire/smoke detection — fine-tuned on custom fire dataset.
        Falls back to general detection if custom weights not available."""
        name = "yolo26l-fire.pt" if self.is_production else "yolo26n-fire.pt"
        return str(self.MODELS_DIR / name)

    # --- Non-YOLO models ---

    @property
    def ARCFACE_MODEL(self) -> str:
        """ArcFace face recognition — 512-dim embeddings."""
        return "buffalo_l" if self.is_production else "buffalo_sc"

    @property
    def OSNET_MODEL(self) -> str:
        """OSNet person Re-ID — 2048-dim embeddings."""
        return "osnet_x1_0" if self.is_production else "osnet_x0_25"

    @property
    def FER_MODEL(self) -> str:
        """FER+ emotion classification via ONNX."""
        name = "fer_plus_full.onnx" if self.is_production else "fer_plus_mobile.onnx"
        return str(self.MODELS_DIR / name)

    # --- Confidence thresholds ---
    FACE_DETECTION_CONFIDENCE: float = 0.5
    FACE_RECOGNITION_THRESHOLD: float = 0.75
    PERSON_DETECTION_CONFIDENCE: float = 0.5
    FIRE_DETECTION_CONFIDENCE: float = 0.5
    BEHAVIOR_CONFIDENCE: float = 0.3
    EMOTION_CONFIDENCE: float = 0.5
    SHOPLIFTING_CONFIDENCE: float = 0.7
    AUDIO_CONFIDENCE: float = 0.3
    IOU_THRESHOLD: float = 0.45  # NMS IoU threshold (used even in NMS-free for bbox overlap)

    # --- Shorthand aliases used by model wrappers ---
    @property
    def PERSON_CONF_THRESHOLD(self) -> float:
        return self.PERSON_DETECTION_CONFIDENCE

    @property
    def FACE_CONF_THRESHOLD(self) -> float:
        return self.FACE_DETECTION_CONFIDENCE

    # --- Threat fusion weights ---
    VISUAL_WEIGHT: float = 0.5
    AUDIO_WEIGHT: float = 0.3
    EMOTION_WEIGHT: float = 0.2
    THREAT_THRESHOLD: float = 0.70
    THREAT_THRESHOLD_NO_AUDIO: float = 0.80
    VISUAL_WEIGHT_NO_AUDIO: float = 0.75
    EMOTION_WEIGHT_NO_AUDIO: float = 0.25

    # --- Processing ---
    MAX_FRAME_WIDTH: int = 1280
    MAX_FACES_PER_FRAME: int = 50
    FACE_CROP_SIZE: int = 112

    # --- YOLO26-specific ---
    YOLO_END2END: bool = True  # True = NMS-free one-to-one head (faster, default)
    YOLO_MAX_DETECTIONS: int = 300  # Max detections per frame (one-to-one head limit)
    YOLO_IMGSZ: int = 640  # Input image size for YOLO inference


settings = MLSettings()
