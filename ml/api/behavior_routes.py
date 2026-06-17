"""
Behavior analysis and emotion classification API routes.

Endpoints:
- POST /analyze-behavior  — classify behaviors from pose keypoints
- POST /classify-emotion  — classify emotion from a face crop
- POST /analyze-frame     — combined behavior + emotion from pose + face crops
"""

import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ml.dependencies import get_behavior_classifier, get_emotion_classifier
from ml.schemas.responses import BehaviorDetection, BehaviorLabel, EmotionDetection, EmotionLabel
from ml.utils.image_utils import decode_base64_image

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Behavior & Emotion"])


# --- Request schemas (local, specific to this route) ---

class KeypointItem(BaseModel):
    name: str
    x: float
    y: float
    confidence: float


class PersonPoseInput(BaseModel):
    track_id: int
    bbox: list[int] = Field(..., description="[x1, y1, x2, y2]")
    keypoints: list[KeypointItem]


class BehaviorAnalyzeRequest(BaseModel):
    """Input for /analyze-behavior."""
    persons: list[PersonPoseInput]
    frame_width: int = Field(640, ge=1)
    frame_height: int = Field(480, ge=1)
    mode: str = Field("school", description="'school', 'mall', or 'supermarket'")


class EmotionClassifyRequest(BaseModel):
    """Input for /classify-emotion — single face crop."""
    face_b64: str = Field(..., description="Base64-encoded face crop (BGR, any size)")
    face_index: int = Field(0, description="Index of this face in the detection list")


class EmotionBatchRequest(BaseModel):
    """Input for batch emotion classification — multiple face crops at once."""
    faces_b64: list[str] = Field(..., description="List of base64-encoded face crops")


# --- Response schemas (local) ---

class BehaviorAnalyzeResult(BaseModel):
    behaviors: list[BehaviorDetection]
    person_count: int
    inference_time_ms: float


class EmotionResult(BaseModel):
    face_index: int
    emotion: Optional[EmotionLabel] = None
    confidence: Optional[float] = None
    amplifier: Optional[float] = None
    detected: bool = False


class EmotionBatchResult(BaseModel):
    results: list[EmotionResult]
    inference_time_ms: float


# --- Routes ---

@router.post("/analyze-behavior", response_model=BehaviorAnalyzeResult)
async def analyze_behavior(
    request: BehaviorAnalyzeRequest,
    behavior_classifier=Depends(get_behavior_classifier),
) -> BehaviorAnalyzeResult:
    """Analyze behaviors from COCO pose keypoints.

    Accepts pose outputs from /person/track-pose and returns
    security-relevant behavioral events with severity levels.
    """
    import numpy as np

    start = time.perf_counter()

    # Convert request into format expected by BehaviorClassifier.analyze()
    persons_raw = []
    for p in request.persons:
        kps_xy = np.array([[kp.x, kp.y] for kp in p.keypoints], dtype=np.float32)
        kps_conf = np.array([kp.confidence for kp in p.keypoints], dtype=np.float32)
        persons_raw.append({
            "track_id": p.track_id,
            "bbox": tuple(p.bbox),
            "keypoints_xy": kps_xy,
            "keypoints_conf": kps_conf,
        })

    frame_shape = (request.frame_height, request.frame_width, 3)
    raw_behaviors = behavior_classifier.analyze(persons_raw, frame_shape=frame_shape, mode=request.mode)

    behaviors = [
        BehaviorDetection(
            track_id=b["track_id"],
            behavior=BehaviorLabel(b["behavior"]),
            confidence=b["confidence"],
            severity=b["severity"],
        )
        for b in raw_behaviors
    ]

    elapsed_ms = (time.perf_counter() - start) * 1000

    return BehaviorAnalyzeResult(
        behaviors=behaviors,
        person_count=len(request.persons),
        inference_time_ms=round(elapsed_ms, 2),
    )


@router.post("/classify-emotion", response_model=EmotionResult)
async def classify_emotion(
    request: EmotionClassifyRequest,
    emotion_classifier=Depends(get_emotion_classifier),
) -> EmotionResult:
    """Classify emotion from a single face crop.

    Returns the dominant emotion and its threat amplifier value.
    A high amplifier emotion (fear, distress) contributes more to
    the fused threat score in the pipeline.
    """
    try:
        face_crop = decode_base64_image(request.face_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = emotion_classifier.classify(face_crop)

    if result is None:
        return EmotionResult(face_index=request.face_index, detected=False)

    return EmotionResult(
        face_index=request.face_index,
        emotion=EmotionLabel(result["emotion"]),
        confidence=result["confidence"],
        amplifier=result["amplifier"],
        detected=True,
    )


@router.post("/classify-emotions-batch", response_model=EmotionBatchResult)
async def classify_emotions_batch(
    request: EmotionBatchRequest,
    emotion_classifier=Depends(get_emotion_classifier),
) -> EmotionBatchResult:
    """Classify emotions for multiple face crops in a single call.

    More efficient than calling /classify-emotion N times — useful
    when the pipeline extracts multiple faces per frame.
    """
    start = time.perf_counter()

    results = []
    for i, face_b64 in enumerate(request.faces_b64):
        try:
            face_crop = decode_base64_image(face_b64)
            raw = emotion_classifier.classify(face_crop)
        except (ValueError, Exception) as e:
            logger.warning(f"Face {i} emotion failed: {e}")
            raw = None

        if raw is None:
            results.append(EmotionResult(face_index=i, detected=False))
        else:
            results.append(EmotionResult(
                face_index=i,
                emotion=EmotionLabel(raw["emotion"]),
                confidence=raw["confidence"],
                amplifier=raw["amplifier"],
                detected=True,
            ))

    elapsed_ms = (time.perf_counter() - start) * 1000

    return EmotionBatchResult(
        results=results,
        inference_time_ms=round(elapsed_ms, 2),
    )
