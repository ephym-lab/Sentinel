"""
Frame processing pipeline API route.

Endpoint:
- POST /pipeline/process-frame — process a full camera frame through all ML models

This is the primary endpoint called by the backend for every camera frame.
It runs all 3 pipeline tracks and returns a complete FrameProcessingResult.
"""

import base64
import logging
import time

import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ml.pipeline.frame_pipeline import FramePipeline
from ml.schemas.requests import FrameInput
from ml.utils.image_utils import decode_base64_image

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Pipeline"])


class PipelineResult(BaseModel):
    """Simplified pipeline response sent to backend."""

    camera_id: uuid.UUID

    timestamp: str
    mode: str
    inference_time_ms: float

    # Detected faces with embeddings
    face_count: int = 0
    face_embeddings: list[dict] = []

    # Tracked persons
    person_count: int = 0
    tracked_persons: list[dict] = []

    # Behavioral events
    behaviors: list[dict] = []

    # Emotions
    emotions: list[dict] = []

    # Fire/smoke
    fire_detected: bool = False
    fire_detections: list[dict] = []

    # Audio
    audio_events: list[dict] = []

    # Re-ID embeddings (for cross-camera matching)
    reid_embeddings: list[dict] = []

    # Threat assessment
    threat: dict = {}

    # Evidence
    snapshot_paths: list[str] = []


@router.post("/process-frame", response_model=PipelineResult)
async def process_frame(
    request: FrameInput,
    fastapi_request: Request,
) -> PipelineResult:
    """Process a camera frame through all active Sentinel ML models.

    This is the core endpoint called by the backend service for every
    camera frame. Returns a complete analysis including:
    - Detected faces and their embeddings (for DB matching)
    - Tracked persons with persistent IDs (for incident tracking)
    - Behavioral events with severity levels
    - Fire/smoke detections (triggers evacuation alerts)
    - Threat assessment (fused score + is_threat flag)

    The backend uses is_threat=True to:
    - Create incident records in PostgreSQL
    - Dispatch WebSocket alerts to staff dashboards
    - Send push notifications to parents (school mode)
    - Trigger re-ID cross-camera search (mall mode)
    """
    start = time.perf_counter()

    # Decode image
    try:
        frame = decode_base64_image(request.image_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    # Decode optional audio
    audio_data = None
    if request.include_audio and request.audio_b64:
        try:
            audio_data = base64.b64decode(request.audio_b64)
        except Exception:
            logger.warning("Failed to decode audio data — processing frame without audio")

    # Get model registry from app.state
    registry = fastapi_request.app.state.model_registry
    pipeline = FramePipeline(registry)

    # Run pipeline (CPU-bound — runs synchronously in this thread)
    # For GPU deployments, wrap in asyncio.get_event_loop().run_in_executor()
    try:
        result = pipeline.process(
            frame=frame,
            camera_id=request.camera_id,
            mode=request.mode.value,
            tenant_id=request.tenant_id,
            audio_data=audio_data,
            timestamp=request.timestamp,
        )
    except Exception as e:
        logger.error(f"Pipeline failed for camera {request.camera_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Pipeline processing failed: {e}")

    return PipelineResult(
        camera_id=result["camera_id"],
        timestamp=result["timestamp"],
        mode=result["mode"],
        inference_time_ms=result["inference_time_ms"],
        face_count=len(result["faces"]),
        face_embeddings=result["face_embeddings"],
        person_count=len(result["tracked_persons"]),
        tracked_persons=result["tracked_persons"],
        behaviors=result["behaviors"],
        emotions=result["emotions"],
        fire_detected=any(d["label"] == "fire" for d in result["fire_detections"]),
        fire_detections=result["fire_detections"],
        audio_events=result["audio_events"],
        reid_embeddings=result["reid_embeddings"],
        threat=result["threat"],
        snapshot_paths=result["snapshot_paths"],
    )
