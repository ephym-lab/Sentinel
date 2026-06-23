from uuid import UUID
from datetime import datetime, time
from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator


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


class CameraRuleBase(BaseModel):
    name: Optional[str] = Field(None, description="Rule name")
    behavior: list[str] = Field(..., description="List of behaviors")
    action: Optional[str] = Field(None, description="Trigger action")
    start_time: Optional[time] = Field(None, description="Active start time (HH:MM:SS)")
    end_time: Optional[time] = Field(None, description="Active end time (HH:MM:SS)")
    is_active: bool = Field(True, description="Is this rule currently active")


class CameraRuleCreate(CameraRuleBase):
    id: Optional[UUID] = None


class CameraRuleUpdate(BaseModel):
    name: Optional[str] = None
    behavior: Optional[list[str]] = None
    action: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_active: Optional[bool] = None


class CameraRuleRead(CameraRuleBase):
    id: UUID
    camera_id: UUID
    created_at: datetime
    updated_at: datetime
    
    @field_validator('behavior', mode='before')
    @classmethod
    def split_behavior(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            return [b.strip() for b in v.split(",") if b.strip() and b.strip() != "none"]
        if isinstance(v, list):
            return [b for b in v if b != "none"]
        return []
    
    model_config = {"from_attributes": True}


class CameraRead(BaseModel):
    id: UUID
    name: str
    location: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    active_feed: Optional[CameraFeedRead] = None
    feeds: Optional[list[CameraFeedRead]] = None
    rules: Optional[list[CameraRuleRead]] = None

    model_config = {"from_attributes": True}
