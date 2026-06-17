from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CameraFeedRead(BaseModel):
    id: UUID
    camera_id: UUID
    source_type: str
    file_path: Optional[str] = None
    original_filename: Optional[str] = None
    stream_url: Optional[str] = None
    is_active: bool
    uploaded_by: Optional[UUID] = None
    uploaded_at: datetime
    preview_url: Optional[str] = None

    model_config = {"from_attributes": True}


class CameraBase(BaseModel):
    name: str = Field(..., description="Human-readable name of the camera, e.g. Front Gate")
    location: Optional[str] = Field(None, description="Location detail, e.g. Block A Floor 1")
    is_active: bool = Field(True, description="Whether the camera stream is currently active")


class CameraCreate(BaseModel):
    id: Optional[UUID] = None
    name: str = Field(..., description="Human-readable name of the camera, e.g. Front Gate")
    location: Optional[str] = Field(None, description="Location detail, e.g. Block A Floor 1")
    zone: Optional[str] = Field(None, description="Zone alias for location")
    camera_type: Optional[str] = Field(None, description="Type of camera (face, thermal, wide-angle, general)")
    is_active: bool = Field(True, description="Whether the camera is active")


class CameraRead(BaseModel):
    id: UUID
    name: str
    location: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    active_feed: Optional[CameraFeedRead] = None
    feeds: Optional[list[CameraFeedRead]] = None

    model_config = {"from_attributes": True}
