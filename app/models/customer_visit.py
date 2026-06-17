import uuid
from sqlalchemy import Column, Boolean, ForeignKey, DateTime, func, JSON, UUID
from app.db.base import TenantBase


class CustomerVisit(TenantBase):
    __tablename__ = "customer_visits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id", ondelete="SET NULL"), nullable=True)
    entry_camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True)
    entry_time = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    exit_time = Column(DateTime(timezone=True), nullable=True)
    is_known = Column(Boolean, default=False, nullable=False)
    is_blacklisted = Column(Boolean, default=False, nullable=False)
    
    # Store dynamic logs as lists of dicts:
    # emotion_log: [{time, emotion, camera_id}, ...]
    # zone_dwell: [{zone, seconds}, ...]
    emotion_log = Column(JSON, default=list, nullable=False)
    zone_dwell = Column(JSON, default=list, nullable=False)
    
    flagged = Column(Boolean, default=False, nullable=False, index=True)
