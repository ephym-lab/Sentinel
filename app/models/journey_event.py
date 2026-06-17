import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, func, UUID
from app.db.base import TenantBase


class JourneyEvent(TenantBase):
    __tablename__ = "journey_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("persons.id", ondelete="CASCADE"), nullable=False)
    camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String, nullable=False)  # gate_entry, gate_exit
    notification_sent = Column(Boolean, default=False, nullable=False)
    notification_sid = Column(String, nullable=True)  # Africa's Talking message ID
    detected_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
