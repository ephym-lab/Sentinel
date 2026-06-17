import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, func, JSON, UUID
from app.db.base import TenantBase


class Incident(TenantBase):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    incident_type = Column(String, nullable=False)  # fire, fight, panic, intrusion, lost_child, poi_alert, medical, shoplifting, crowd_crush
    severity = Column(String, nullable=False)       # low, medium, high, critical
    status = Column(String, nullable=False, default="active")  # active, acknowledged, resolved
    
    # Store array of detection_event IDs
    trigger_events = Column(JSON, default=list, nullable=False)
    
    # Can be resolved by a user in the public schema
    resolved_by = Column(UUID(as_uuid=True), nullable=True)
    
    triggered_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    # For file reference
    snapshot_path = Column(String, nullable=True)
    video_path = Column(String, nullable=True)
