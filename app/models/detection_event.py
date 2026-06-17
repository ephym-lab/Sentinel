import uuid
from sqlalchemy import Column, String, Float, ForeignKey, DateTime, func, JSON, UUID
from app.db.base import TenantBase


class DetectionEvent(TenantBase):
    __tablename__ = "detection_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True)
    microphone_id = Column(UUID(as_uuid=True), nullable=True)  # can link to a mic registry if added later
    event_type = Column(String, nullable=False)  # scream_audio, fighting, fire, n.k.
    confidence_score = Column(Float, nullable=False)
    clip_path = Column(String, nullable=True)    # uploads/videos/events/...
    metadata_log = Column(JSON, default=dict, nullable=False) # stores other metadata
    detected_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
