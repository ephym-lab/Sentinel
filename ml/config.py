"""
ML service configuration.

Handles environment-based settings, model variant selection (dev vs prod),
confidence thresholds, and file path configuration.
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
    UPLOADS_DIR: str = "uploads"

    @property
    def images_dir(self) -> Path:
        return Path(self.UPLOADS_DIR) / "images"

    @property
    def videos_dir(self) -> Path:
        return Path(self.UPLOADS_DIR) / "videos"

    # --- Model variants (dev = lightweight, prod = full) ---
    @property
    def YOLO_FACE_MODEL(self) -> str:
        return "yolov8l-face.pt" if self.is_production else "yolov8n-face.pt"

    @property
    def YOLO_PERSON_MODEL(self) -> str:
        return "yolov8l.pt" if self.is_production else "yolov8n.pt"

    @property
    def YOLO_POSE_MODEL(self) -> str:
        return "yolov8l-pose.pt" if self.is_production else "yolov8n-pose.pt"

    @property
    def YOLO_FIRE_MODEL(self) -> str:
        return "yolov8l-fire.pt" if self.is_production else "yolov8n-fire.pt"

    @property
    def ARCFACE_MODEL(self) -> str:
        return "buffalo_l" if self.is_production else "buffalo_sc"

    @property
    def OSNET_MODEL(self) -> str:
        return "osnet_x1_0" if self.is_production else "osnet_x0_25"

    @property
    def FER_MODEL(self) -> str:
        return "fer_plus_full.onnx" if self.is_production else "fer_plus_mobile.onnx"

    # --- Confidence thresholds ---
    FACE_DETECTION_CONFIDENCE: float = 0.5
    FACE_RECOGNITION_THRESHOLD: float = 0.75
    PERSON_DETECTION_CONFIDENCE: float = 0.5
    FIRE_DETECTION_CONFIDENCE: float = 0.6
    BEHAVIOR_CONFIDENCE: float = 0.65
    EMOTION_CONFIDENCE: float = 0.5
    SHOPLIFTING_CONFIDENCE: float = 0.7
    AUDIO_CONFIDENCE: float = 0.6

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


settings = MLSettings()
