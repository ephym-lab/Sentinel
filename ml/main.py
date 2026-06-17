"""
Sentinel ML Service — FastAPI application.

Entry point for the ML inference service. Uses lifespan events to
load all ML models at startup and release them at shutdown.
The model registry is stored on app.state for access via dependency injection.

YOLO26 Architecture:
- All YOLO models use `from ultralytics import YOLO`
- NMS-free by default (one-to-one head) — predictions without post-processing
- Pretrained models (detect, pose) auto-download from Ultralytics hub
- Custom models (face, fire) must be fine-tuned and placed in ml/weights/
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

    # --- YOLO26 detection (COCO pretrained, auto-downloads) ---
    model_name = "person_detector"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": settings.YOLO_DETECT_MODEL,
    }
    try:
        start = time.perf_counter()
        from ml.models.person_detector import PersonDetector
        model = PersonDetector()
        elapsed = (time.perf_counter() - start) * 1000
        registry[model_name].update(model=model, loaded=True, load_time_ms=elapsed)
        logger.info(f"Loaded {model_name} ({settings.YOLO_DETECT_MODEL}) on {device} in {elapsed:.0f}ms")
    except Exception as e:
        logger.warning(f"Failed to load {model_name}: {e}")

    # --- YOLO26 pose estimation (COCO-pose pretrained, auto-downloads) ---
    model_name = "pose_estimator"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": settings.YOLO_POSE_MODEL,
    }
    try:
        start = time.perf_counter()
        from ml.models.pose_estimator import PoseEstimator
        model = PoseEstimator()
        elapsed = (time.perf_counter() - start) * 1000
        registry[model_name].update(model=model, loaded=True, load_time_ms=elapsed)
        logger.info(f"Loaded {model_name} ({settings.YOLO_POSE_MODEL}) on {device} in {elapsed:.0f}ms")
    except Exception as e:
        logger.warning(f"Failed to load {model_name}: {e}")

    # --- YOLO26 face detection (custom fine-tuned or fallback to COCO) ---
    model_name = "face_detector"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": settings.YOLO_FACE_MODEL,
    }
    try:
        start = time.perf_counter()
        from ml.models.face_detector import FaceDetector
        model = FaceDetector()
        elapsed = (time.perf_counter() - start) * 1000
        registry[model_name].update(model=model, loaded=True, load_time_ms=elapsed)
        logger.info(f"Loaded {model_name} in {elapsed:.0f}ms")
    except Exception as e:
        logger.warning(f"Failed to load {model_name}: {e}")

    # --- ArcFace face recognition (InsightFace) ---
    model_name = "face_recognizer"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": settings.ARCFACE_MODEL,
    }
    try:
        start = time.perf_counter()
        from ml.models.face_recognizer import FaceRecognizer
        model = FaceRecognizer()
        elapsed = (time.perf_counter() - start) * 1000
        registry[model_name].update(model=model, loaded=True, load_time_ms=elapsed)
        logger.info(f"Loaded {model_name} ({settings.ARCFACE_MODEL}) in {elapsed:.0f}ms")
    except Exception as e:
        logger.warning(f"Failed to load {model_name}: {e}")

    # --- FER+ emotion classifier (ONNX) ---
    model_name = "emotion_classifier"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": settings.FER_MODEL,
    }
    try:
        start = time.perf_counter()
        from ml.models.emotion_classifier import EmotionClassifier
        model = EmotionClassifier()
        elapsed = (time.perf_counter() - start) * 1000
        registry[model_name].update(model=model, loaded=True, load_time_ms=elapsed)
        logger.info(f"Loaded {model_name} ({settings.FER_MODEL}) in {elapsed:.0f}ms")
    except Exception as e:
        logger.warning(f"Failed to load {model_name}: {e}")

    # --- Behavior classifier (rule-based on pose keypoints) ---
    model_name = "behavior_classifier"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": "rule_based_v1",
    }
    try:
        start = time.perf_counter()
        from ml.models.behavior_classifier import BehaviorClassifier
        model = BehaviorClassifier()
        elapsed = (time.perf_counter() - start) * 1000
        registry[model_name].update(model=model, loaded=True, load_time_ms=elapsed)
        logger.info(f"Loaded {model_name} (rule_based_v1) in {elapsed:.0f}ms")
    except Exception as e:
        logger.warning(f"Failed to load {model_name}: {e}")

    # --- YOLO26 fire/smoke detection (custom fine-tuned, requires ml/weights/) ---
    model_name = "fire_detector"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": settings.YOLO_FIRE_MODEL,
    }
    try:
        start = time.perf_counter()
        from ml.models.fire_detector import FireDetector
        model = FireDetector()
        elapsed = (time.perf_counter() - start) * 1000
        registry[model_name].update(model=model, loaded=True, load_time_ms=elapsed)
        logger.info(f"Loaded {model_name} ({settings.YOLO_FIRE_MODEL}) in {elapsed:.0f}ms")
    except FileNotFoundError as e:
        logger.warning(f"Skipping {model_name}: {e}")
    except Exception as e:
        logger.warning(f"Failed to load {model_name}: {e}")

    # --- OSNet Re-ID (torchreid) ---
    model_name = "reid_extractor"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": settings.OSNET_MODEL,
    }
    try:
        start = time.perf_counter()
        from ml.models.reid_extractor import ReIDExtractor
        model = ReIDExtractor()
        elapsed = (time.perf_counter() - start) * 1000
        registry[model_name].update(model=model, loaded=True, load_time_ms=elapsed)
        logger.info(f"Loaded {model_name} ({settings.OSNET_MODEL}) in {elapsed:.0f}ms")
    except Exception as e:
        logger.warning(f"Failed to load {model_name}: {e}")

    # --- YAMNet audio classifier (TensorFlow Hub) ---
    model_name = "audio_classifier"
    registry[model_name] = {
        "model": None,
        "loaded": False,
        "device": device,
        "variant": "yamnet_v1",
    }
    try:
        start = time.perf_counter()
        from ml.models.audio_classifier import AudioClassifier
        model = AudioClassifier()
        elapsed = (time.perf_counter() - start) * 1000
        registry[model_name].update(model=model, loaded=True, load_time_ms=elapsed)
        logger.info(f"Loaded {model_name} (yamnet_v1) in {elapsed:.0f}ms")
    except Exception as e:
        logger.warning(f"Failed to load {model_name}: {e}")

    return registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — load models on startup, cleanup on shutdown."""
    logger.info("=" * 60)
    logger.info("Sentinel ML Service starting...")
    logger.info(f"Environment: {settings.ENV.value}")
    logger.info(f"Device: {settings.DEVICE}")
    logger.info(f"Uploads dir: {settings.UPLOADS_DIR}")
    logger.info(f"YOLO26 end-to-end (NMS-free): {settings.YOLO_END2END}")
    logger.info("=" * 60)

    # Ensure upload directories exist
    settings.images_dir.mkdir(parents=True, exist_ok=True)
    settings.videos_dir.mkdir(parents=True, exist_ok=True)

    # Ensure custom weights directory exists
    Path("ml/weights").mkdir(parents=True, exist_ok=True)

    # Load models
    start = time.perf_counter()
    app.state.model_registry = _load_models()
    total_ms = (time.perf_counter() - start) * 1000

    loaded_count = sum(1 for m in app.state.model_registry.values() if m["loaded"])
    total_count = len(app.state.model_registry)
    logger.info(f"Models loaded: {loaded_count}/{total_count} in {total_ms:.0f}ms")
    
    # Start camera worker pool
    import asyncio
    from ml.pipeline.worker_pool import CameraWorkerPool
    worker_pool = CameraWorkerPool()
    app.state.worker_pool = worker_pool
    polling_task = asyncio.create_task(worker_pool.start_polling_loop())
    
    logger.info("ML Service ready — accepting requests and running workers")

    yield

    # Shutdown
    logger.info("Sentinel ML Service shutting down — releasing models & stopping workers...")
    polling_task.cancel()
    try:
        await polling_task
    except asyncio.CancelledError:
        pass
    
    try:
        await worker_pool.stop_all()
    except Exception as e:
        logger.error(f"Error stopping worker pool: {e}")
        
    app.state.model_registry.clear()
    logger.info("Shutdown complete")




# --- Create app ---

app = FastAPI(
    title="Sentinel ML Service",
    description="AI inference service for safety and surveillance — powered by YOLO26",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(api_router)
