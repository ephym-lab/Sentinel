from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CameraBase(BaseModel):
    id: UUID = Field(..., description="Unique UUID identifier for the camera")
    name: str = Field(..., description="Human-readable name of the camera, e.g. Front Gate")
    location: Optional[str] = Field(None, description="Location detail, e.g. Block A Floor 1")
    is_active: bool = Field(True, description="Whether the camera stream is currently active")


class CameraCreate(CameraBase):
    pass


class CameraRead(CameraBase):
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
