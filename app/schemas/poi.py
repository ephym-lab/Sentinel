from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, AliasChoices


class POIBase(BaseModel):
    id: UUID = Field(..., description="Unique UUID for the Person of Interest")
    name: str = Field(..., description="Name of the person", validation_alias=AliasChoices("label", "name"))
    notes: Optional[str] = Field(None, description="Additional context or notes")


class POICreate(POIBase):
    face_embedding: Optional[List[float]] = Field(None, description="512-dim face recognizer embedding")
    reid_embedding: Optional[List[float]] = Field(None, description="512-dim Re-ID embedding")


class POIRead(POIBase):
    created_at: datetime
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
