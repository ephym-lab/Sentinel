"""
Sentinel ML Service — FastAPI application.

Entry point for the ML inference service. Uses lifespan events to
load all ML models at startup and release them at shutdown.
The model registry is stored on app.state for access via dependency injection.
"""

import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from ml.api.router import api_router
from ml.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("sentinel.ml")


def _load_models() -> dict:
    """Load all ML models and return a registry dict.

    Each entry: { "model_name": { "model": <instance>, "loaded": bool,
                                    "device": str, "variant": str, "load_time_ms": float } }

    Models are loaded progressively — if one fails, the service still starts
    with that model marked as loaded=False. This allows partial functionality
    during development when not all model weights are available.
    """
    registry = {}
    device = settings.DEVICE

    # --- Phase 2: Face detector (YOLOv8-face) ---
    model_name = "face_detector"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": settings.YOLO_FACE_MODEL,
    }
    # Actual loading will be added in Phase 2:
    # try:
    #     start = time.perf_counter()
    #     from ml.models.face_detector import FaceDetector
    #     model = FaceDetector()
    #     elapsed = (time.perf_counter() - start) * 1000
    #     registry[model_name].update(model=model, loaded=True, load_time_ms=elapsed)
    #     logger.info(f"Loaded {model_name} ({settings.YOLO_FACE_MODEL}) on {device} in {elapsed:.0f}ms")
    # except Exception as e:
    #     logger.warning(f"Failed to load {model_name}: {e}")

    # --- Phase 2: Face recognizer (ArcFace) ---
    model_name = "face_recognizer"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": settings.ARCFACE_MODEL,
    }

    # --- Phase 3: Person detector (YOLOv8) ---
    model_name = "person_detector"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": settings.YOLO_PERSON_MODEL,
    }

    # --- Phase 3: Pose estimator (YOLOv8-pose) ---
    model_name = "pose_estimator"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": settings.YOLO_POSE_MODEL,
    }

    # --- Phase 4: Emotion classifier (FER+) ---
    model_name = "emotion_classifier"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": settings.FER_MODEL,
    }

    # --- Phase 4: Behavior classifier ---
    model_name = "behavior_classifier"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": "rule_based_v1",
    }

    # --- Phase 5: Fire detector (YOLOv8-fire) ---
    model_name = "fire_detector"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": settings.YOLO_FIRE_MODEL,
    }

    # --- Phase 5: Re-ID extractor (OSNet) ---
    model_name = "reid_extractor"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": settings.OSNET_MODEL,
    }

    # --- Phase 5: Audio classifier (YAMNet) ---
    model_name = "audio_classifier"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": "yamnet_v1",
    }

    return registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — load models on startup, cleanup on shutdown."""
    logger.info("=" * 60)
    logger.info("Sentinel ML Service starting...")
    logger.info(f"Environment: {settings.ENV.value}")
    logger.info(f"Device: {settings.DEVICE}")
    logger.info(f"Uploads dir: {settings.UPLOADS_DIR}")
    logger.info("=" * 60)

    # Ensure upload directories exist
    settings.images_dir.mkdir(parents=True, exist_ok=True)
    settings.videos_dir.mkdir(parents=True, exist_ok=True)

    # Load models
    start = time.perf_counter()
    app.state.model_registry = _load_models()
    total_ms = (time.perf_counter() - start) * 1000

    loaded_count = sum(1 for m in app.state.model_registry.values() if m["loaded"])
    total_count = len(app.state.model_registry)
    logger.info(f"Models loaded: {loaded_count}/{total_count} in {total_ms:.0f}ms")
    logger.info("ML Service ready — accepting requests")

    yield

    # Shutdown
    logger.info("Sentinel ML Service shutting down — releasing models...")
    app.state.model_registry.clear()
    logger.info("Shutdown complete")


# --- Create app ---

app = FastAPI(
    title="Sentinel ML Service",
    description="AI inference service for safety and surveillance",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(api_router)
