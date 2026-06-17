from typing import Optional
from pydantic import BaseModel, Field


class FrameUploadRequest(BaseModel):
    camera_id: str = Field(..., description="ID of the camera sending the frame")
    image_b64: str = Field(..., description="Base64-encoded JPEG/PNG frame image data")
    audio_b64: Optional[str] = Field(None, description="Optional base64-encoded WAV audio data (from camera mic)")
