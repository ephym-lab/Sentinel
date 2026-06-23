from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, AliasChoices


class POIBase(BaseModel):
    id: UUID = Field(..., description="Unique UUID for the Person of Interest")
    name: str = Field(..., description="Name of the person", validation_alias=AliasChoices("label", "name"))
    notes: Optional[str] = Field(None, description="Additional context or notes", validation_alias=AliasChoices("reason", "notes"))
    target_cameras: Optional[List[str]] = Field(default_factory=list, description="List of camera IDs to track. Empty means all cameras.")


class POICreate(POIBase):
    face_embedding: Optional[List[float]] = Field(None, description="512-dim face recognizer embedding")
    reid_embedding: Optional[List[float]] = Field(None, description="512-dim Re-ID embedding")
    photo_path: Optional[str] = Field(None, description="Path to the face snapshot")


class POIRead(POIBase):
    created_at: datetime
    photo_path: Optional[str] = None
    # We omit raw embeddings in default reads to keep payload small, but include flags
    has_face_embedding: bool = False
    has_reid_embedding: bool = False

    @classmethod
    def model_validate(cls, obj: any, **kwargs) -> "POIRead":
        if isinstance(obj, dict):
            has_face = obj.get("face_embedding") is not None
            has_reid = obj.get("reid_embedding") is not None
        else:
            has_face = getattr(obj, "face_embedding", None) is not None
            has_reid = getattr(obj, "reid_embedding", None) is not None
            
        read = super().model_validate(obj, **kwargs)
        read.has_face_embedding = has_face
        read.has_reid_embedding = has_reid
        return read

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class POISightingRead(BaseModel):
    id: UUID
    poi_id: UUID
    camera_id: Optional[UUID] = None
    camera_name: Optional[str] = None
    match_type: str
    match_score: float
    snapshot_path: Optional[str] = None
    spotted_at: datetime

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }
