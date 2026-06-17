from typing import Optional
from pydantic import BaseModel, Field


class DetectionIngestRequest(BaseModel):
    camera_id: Optional[str] = Field(None, description="Camera UUID sending the event")
    microphone_id: Optional[str] = Field(None, description="Microphone UUID sending the event")
    event_type: str = Field(..., description="Type of event (e.g. fighting, smoke_visual, scream_audio)")
    confidence_score: float = Field(..., description="Inference confidence score (0.0 to 1.0)")
    clip_path: Optional[str] = Field(None, description="Relative path of saved clip, e.g. uploads/videos/...")
    metadata: dict = Field(default_factory=dict, description="Custom metadata details")
