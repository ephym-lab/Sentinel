"""
Frame processing pipeline API route.

Endpoint:
- POST /pipeline/process-frame — process a full camera frame through selected ML models

This is the primary endpoint called by the backend for every camera frame.
Supports analysis_mode to run only specific detector tracks for lower latency.
"""

import base64
import logging
import time
import uuid
from collections import defaultdict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

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
    analysis_mode: str = "full"
    inference_time_ms: float

    # Detected faces with bboxes (for canvas overlay)
    face_count: int = 0
    faces: list[dict] = []
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

    # General object detections (all 80 COCO classes, persons excluded)
    object_count: int = 0
    objects: list[dict] = []

    # Threat assessment
    threat: dict = {}

    # Evidence
    snapshot_paths: list[str] = []


@router.post("/process-frame", response_model=PipelineResult)
async def process_frame(
    request: FrameInput,
    fastapi_request: Request,
) -> PipelineResult:
    """Process a camera frame through selected Sentinel ML models.

    Returns a complete analysis based on analysis_mode:
      full    → faces, persons, fire, objects, behaviors, threat
      face    → face bboxes + ArcFace embeddings only
      person  → person tracking only
      pose    → person tracking + pose keypoints + behaviors
      fire    → fire/smoke detection only
      objects → all-class COCO object detection only
      audio   → audio event classification only
    """
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

    # Get or create a persistent FramePipeline (stored once per app lifetime)
    registry = fastapi_request.app.state.model_registry
    if not hasattr(fastapi_request.app.state, "pipeline"):
        fastapi_request.app.state.pipeline = FramePipeline(registry)
        fastapi_request.app.state.camera_frame_counts = defaultdict(int)

    pipeline = fastapi_request.app.state.pipeline
    camera_key = str(request.camera_id)
    fastapi_request.app.state.camera_frame_counts[camera_key] += 1
    frame_count = fastapi_request.app.state.camera_frame_counts[camera_key]

    # Run pipeline
    try:
        result = await pipeline.process(
            frame=frame,
            camera_id=str(request.camera_id),
            mode=request.mode.value,
            tenant_id=str(request.tenant_id),
            audio_data=audio_data,
            timestamp=request.timestamp,
            analysis_mode=request.analysis_mode.value,
            frame_count=frame_count,
        )
    except Exception as e:
        logger.error(f"Pipeline failed for camera {request.camera_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Pipeline processing failed: {e}")

    return PipelineResult(
        camera_id=result["camera_id"],
        timestamp=result["timestamp"],
        mode=result["mode"],
        analysis_mode=result.get("analysis_mode", "full"),
        inference_time_ms=result["inference_time_ms"],
        face_count=len(result["faces"]),
        faces=result["faces"],
        face_embeddings=result["face_embeddings"],
        person_count=len(result["tracked_persons"]),
        tracked_persons=result["tracked_persons"],
        behaviors=result["behaviors"],
        emotions=result["emotions"],
        fire_detected=any(d["label"] == "fire" for d in result["fire_detections"]),
        fire_detections=result["fire_detections"],
        audio_events=result["audio_events"],
        reid_embeddings=result["reid_embeddings"],
        object_count=len(result.get("objects", [])),
        objects=result.get("objects", []),
        threat=result["threat"],
        snapshot_paths=result["snapshot_paths"],
    )
