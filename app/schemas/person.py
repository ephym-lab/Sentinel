from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PersonBase(BaseModel):
    full_name: str = Field(..., description="Full name of the person")
    person_type: str = Field(..., description="student, staff, guardian, known_offender, vip_customer")
    identifier: str = Field(..., description="Unique alphanumeric identifier (e.g. Student ID)")
    class_grade: Optional[str] = Field(None, description="School grade class (school mode only)")
    dormitory: Optional[str] = Field(None, description="School dormitory name (school mode only)")
    status: str = Field("active", description="active, evacuated, missing, suspended, blacklisted, inactive")


class PersonCreate(PersonBase):
    pass


class PersonRead(PersonBase):
    id: UUID
    photo_path: Optional[str] = None
    enrolled_at: datetime
    last_seen_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class IdentifyRequest(BaseModel):
    image_b64: str = Field(..., description="Base64-encoded image frame of the crop to identify")
