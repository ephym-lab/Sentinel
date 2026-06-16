"""
Request schemas for ML service endpoints.

All inputs use base64-encoded images/audio to avoid multipart complexity
in service-to-service communication.
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DeploymentMode(str, Enum):
    SCHOOL = "school"
    MALL = "mall"
    SUPERMARKET = "supermarket"


class FrameInput(BaseModel):
    """Input for the main /process-frame pipeline endpoint."""

    image_b64: str = Field(..., description="Base64-encoded camera frame (JPEG or PNG)")
    camera_id: str = Field(..., description="Camera identifier for location tracking")
    mode: DeploymentMode = Field(..., description="Deployment mode determines which detections run")
    tenant_id: str = Field(..., description="Tenant identifier for multi-tenancy DB lookups")
    timestamp: Optional[str] = Field(None, description="ISO 8601 timestamp of frame capture")
    include_audio: bool = Field(False, description="Whether audio data is included for fusion")


class FaceDetectRequest(BaseModel):
    """Input for /detect-faces — just face detection, no recognition."""

    image_b64: str = Field(..., description="Base64-encoded image")
    max_faces: int = Field(50, ge=1, le=200, description="Maximum faces to detect")


class FaceRecognizeRequest(BaseModel):
    """Input for /recognize — extract embedding from a face crop."""

    face_b64: str = Field(..., description="Base64-encoded face crop (aligned 112x112 preferred)")


class FaceEnrollRequest(BaseModel):
    """Input for /enroll-embedding — generate embedding for DB storage."""

    image_b64: str = Field(..., description="Base64-encoded photo containing exactly one face")
    person_id: str = Field(..., description="Person UUID for linking the embedding")


class AudioClassifyRequest(BaseModel):
    """Input for /classify-audio — classify an audio chunk."""

    audio_b64: str = Field(..., description="Base64-encoded audio (WAV, 16kHz mono)")
    camera_id: Optional[str] = Field(None, description="Associated camera/microphone ID")
    duration_ms: int = Field(1000, description="Duration of the audio chunk in milliseconds")


class POIMatchRequest(BaseModel):
    """Input for /match-poi — match a face or body against active POIs."""

    face_embedding: Optional[list[float]] = Field(None, description="512-dim ArcFace embedding")
    reid_embedding: Optional[list[float]] = Field(None, description="2048-dim OSNet Re-ID embedding")
    tenant_id: str = Field(..., description="Tenant identifier")


class ReIDExtractRequest(BaseModel):
    """Input for /extract-reid — extract body appearance embedding."""

    person_crop_b64: str = Field(..., description="Base64-encoded person crop from detector")
