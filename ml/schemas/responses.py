"""
Response schemas for ML service endpoints.

Structured outputs returned by each ML endpoint, designed to be consumed
by the backend service for incident creation, POI tracking, and notifications.
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# --- Enums ---

class EmotionLabel(str, Enum):
    FEAR = "fear"
    ANGER = "anger"
    DISTRESS = "distress"
    NERVOUSNESS = "nervousness"
    SURPRISE = "surprise"
    NEUTRAL = "neutral"
    HAPPY = "happy"


class BehaviorLabel(str, Enum):
    FIGHTING = "fighting"
    CROWD_PANIC = "crowd_panic"
    PERSON_DOWN = "person_down"
    LOITERING = "loitering"
    SUSPICIOUS_PROXIMITY = "suspicious_proximity"
    PERIMETER_CLIMBING = "perimeter_climbing"
    NIGHT_GATHERING = "night_gathering"
    CONCEALMENT_GESTURE = "concealment_gesture"
    ITEM_TO_BAG = "item_to_bag"
    REPEATED_AISLE_PASSES = "repeated_aisle_passes"
    HIGH_VALUE_DWELL = "high_value_dwell"
    SELF_CHECKOUT_ANOMALY = "self_checkout_anomaly"
    CROWD_CRUSH = "crowd_crush"
    NORMAL = "normal"


class AudioEventLabel(str, Enum):
    SCREAM = "scream"
    GLASS_BREAK = "glass_break"
    ALARM = "alarm"
    GUNSHOT = "gunshot"
    EXPLOSION = "explosion"
    NORMAL = "normal"


class MatchType(str, Enum):
    FACE_RECOGNITION = "face_recognition"
    REID = "reid"
    BOTH = "both"


# --- Face detection/recognition ---

class FaceBBox(BaseModel):
    """Single detected face with bounding box and optional landmarks."""

    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float = Field(..., ge=0.0, le=1.0)
    landmarks: Optional[list[list[float]]] = Field(
        None, description="5-point landmarks: [[x,y], ...] — eyes, nose, mouth corners"
    )


class FaceDetectionResult(BaseModel):
    """Response from /detect-faces."""

    faces: list[FaceBBox]
    frame_width: int
    frame_height: int
    inference_time_ms: float


class FaceEmbeddingResult(BaseModel):
    """Response from /recognize or /enroll-embedding."""

    embedding: list[float] = Field(..., description="512-dim ArcFace embedding")
    face_bbox: Optional[FaceBBox] = None
    snapshot_path: Optional[str] = Field(None, description="Saved face crop path")


class FaceMatchResult(BaseModel):
    """A single face match against known persons."""

    person_id: Optional[str] = None
    full_name: Optional[str] = None
    person_type: Optional[str] = None
    similarity_score: float = Field(..., ge=0.0, le=1.0)
    is_match: bool
    is_blacklisted: bool = False


# --- Person detection/tracking ---

class TrackedPerson(BaseModel):
    """A detected and tracked person with persistent ID."""

    track_id: int = Field(..., description="ByteTrack persistent ID")
    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float


class PoseKeypoints(BaseModel):
    """17 skeletal keypoints for a tracked person."""

    track_id: int
    keypoints: list[list[float]] = Field(
        ..., description="17 keypoints, each [x, y, confidence]"
    )


class PersonTrack(BaseModel):
    """Single detected/tracked person from /detect-persons or /track-persons."""

    track_id: Optional[int] = Field(None, description="ByteTrack ID (None for detect-only)")
    bbox: list[int] = Field(..., description="[x1, y1, x2, y2]")
    confidence: float = Field(..., ge=0.0, le=1.0)


class PersonDetectionResult(BaseModel):
    """Response from /detect-persons."""

    persons: list[PersonTrack]
    frame_width: int
    frame_height: int
    inference_time_ms: float


class PersonTrackResult(BaseModel):
    """Response from /track-persons."""

    tracks: list[PersonTrack]
    frame_width: int
    frame_height: int
    inference_time_ms: float


class PoseKeypoint(BaseModel):
    """Single COCO keypoint with name and confidence."""

    name: str
    x: float
    y: float
    confidence: float = Field(..., ge=0.0, le=1.0)


class PosePerson(BaseModel):
    """Single person with full 17-keypoint pose."""

    track_id: Optional[int] = Field(None, description="ByteTrack ID if tracking was used")
    bbox: list[int] = Field(..., description="[x1, y1, x2, y2]")
    confidence: float = Field(..., ge=0.0, le=1.0)
    keypoints: list[PoseKeypoint] = Field(..., description="17 COCO keypoints")


class PoseEstimationResult(BaseModel):
    """Response from /estimate-pose or /track-pose."""

    persons: list[PosePerson]
    frame_width: int
    frame_height: int
    inference_time_ms: float


# --- Behavior/emotion ---

class BehaviorDetection(BaseModel):
    """Detected behavior for a tracked person."""

    track_id: int
    behavior: BehaviorLabel
    confidence: float = Field(..., ge=0.0, le=1.0)
    severity: str = Field(..., description="low, medium, high, or critical")


class EmotionDetection(BaseModel):
    """Detected emotion for a face."""

    face_index: int = Field(..., description="Index into FaceDetectionResult.faces")
    emotion: EmotionLabel
    confidence: float = Field(..., ge=0.0, le=1.0)
    amplifier: float = Field(
        ..., description="Threat amplifier value (0.0–1.0) — fear/distress are high"
    )


# --- Fire/audio ---

class FireDetection(BaseModel):
    """Detected fire or smoke region."""

    x1: int
    y1: int
    x2: int
    y2: int
    label: str = Field(..., description="'fire' or 'smoke'")
    confidence: float = Field(..., ge=0.0, le=1.0)


class AudioClassification(BaseModel):
    """Audio event classification result."""

    event: AudioEventLabel
    confidence: float = Field(..., ge=0.0, le=1.0)
    is_threat: bool


class AudioClassifyResult(BaseModel):
    """Response from /classify-audio."""

    events: list[AudioClassification]
    inference_time_ms: float


# --- POI matching ---

class POIMatch(BaseModel):
    """Match result against a Person of Interest."""

    poi_id: str
    match_type: MatchType
    face_score: Optional[float] = None
    reid_score: Optional[float] = None
    combined_score: float


class POIMatchResult(BaseModel):
    """Response from /match-poi."""

    matches: list[POIMatch]
    has_match: bool


class ReIDResult(BaseModel):
    """Response from /extract-reid."""

    embedding: list[float] = Field(..., description="2048-dim OSNet Re-ID embedding")
    snapshot_path: Optional[str] = None


# --- Full pipeline output ---

class ThreatAssessment(BaseModel):
    """Fused threat score from visual, audio, and emotion signals."""

    visual_score: float
    audio_score: Optional[float] = None
    emotion_amplifier: float
    fused_score: float
    is_threat: bool
    threshold_used: float


class FrameProcessingResult(BaseModel):
    """Complete response from /process-frame — the main pipeline output."""

    camera_id: str
    timestamp: str
    mode: str
    inference_time_ms: float

    # Track 1 — Faces
    faces: list[FaceBBox] = []
    face_matches: list[FaceMatchResult] = []
    face_embeddings: list[FaceEmbeddingResult] = []

    # Track 2 — Persons + behavior
    tracked_persons: list[TrackedPerson] = []
    poses: list[PoseKeypoints] = []
    behaviors: list[BehaviorDetection] = []

    # Track 3 — Emotions
    emotions: list[EmotionDetection] = []

    # Fire/smoke
    fire_detections: list[FireDetection] = []

    # POI matches
    poi_matches: list[POIMatch] = []

    # Threat assessment
    threat: Optional[ThreatAssessment] = None

    # Saved evidence
    snapshot_paths: list[str] = []
    clip_paths: list[str] = []


# --- Health ---

class ModelStatus(BaseModel):
    """Status of a single loaded model."""

    name: str
    loaded: bool
    device: str
    variant: str
    load_time_ms: Optional[float] = None


class HealthResponse(BaseModel):
    """Response from /health."""

    status: str = "ok"
    device: str
    environment: str
    models: list[ModelStatus] = []
