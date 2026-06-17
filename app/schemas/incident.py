from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class IncidentRead(BaseModel):
    id: UUID
    title: str
    incident_type: str
    severity: str
    status: str
    trigger_events: List[str]
    resolved_by: Optional[UUID] = None
    triggered_at: datetime
    resolved_at: Optional[datetime] = None
    snapshot_path: Optional[str] = None
    video_path: Optional[str] = None

    model_config = {"from_attributes": True}


class IncidentResolve(BaseModel):
    resolution_notes: Optional[str] = None
