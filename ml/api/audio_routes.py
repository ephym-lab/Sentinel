"""
Audio classification API routes.

Endpoints:
- POST /classify-audio   — classify a WAV audio chunk into a security event
- POST /audio-status     — check if audio classifier is available
"""

import base64
import logging
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ml.dependencies import get_audio_classifier
from ml.schemas.responses import AudioClassification, AudioClassifyResult, AudioEventLabel

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Audio"])


class AudioClassifyRequest(BaseModel):
    audio_b64: str = Field(..., description="Base64-encoded WAV audio (16kHz mono preferred)")
    camera_id: str | None = Field(None, description="Associated camera/microphone ID")
    duration_ms: int = Field(1000, ge=100, le=10000, description="Audio chunk duration in ms")


@router.post("/classify-audio", response_model=AudioClassifyResult)
async def classify_audio(
    request: AudioClassifyRequest,
    audio_classifier=Depends(get_audio_classifier),
) -> AudioClassifyResult:
    """Classify a WAV audio chunk into security-relevant events.

    Audio should be 16kHz mono WAV. Longer clips are processed as
    overlapping frames internally by YAMNet (0.96s windows).

    Returns events sorted by confidence. A 'normal' event is returned
    if no security-relevant sounds exceed the confidence threshold.
    """
    start = time.perf_counter()

    try:
        wav_bytes = base64.b64decode(request.audio_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio data")

    try:
        raw_events = audio_classifier.classify_from_wav_bytes(wav_bytes)
    except Exception as e:
        logger.error(f"Audio classification failed: {e}")
        raise HTTPException(status_code=422, detail=f"Audio processing failed: {e}")

    events = [
        AudioClassification(
            event=AudioEventLabel(evt["event"]),
            confidence=evt["confidence"],
            is_threat=evt["is_threat"],
        )
        for evt in raw_events
    ]

    elapsed_ms = (time.perf_counter() - start) * 1000

    return AudioClassifyResult(
        events=events,
        inference_time_ms=round(elapsed_ms, 2),
    )
