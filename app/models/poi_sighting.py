import uuid
from sqlalchemy import Column, String, Float, Integer, ForeignKey, DateTime, func, UUID, Text
from app.db.base import TenantBase


class POISighting(TenantBase):
    __tablename__ = "poi_sightings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    poi_id = Column(UUID(as_uuid=True), ForeignKey("persons_of_interest.id", ondelete="CASCADE"), nullable=False)
    camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True)
    match_type = Column(String, nullable=False)  # face_recognition, reid, both
    match_score = Column(Float, nullable=False)
    emotion = Column(String, nullable=True)
    behavior = Column(String, nullable=True)
    clothing_description = Column(Text, nullable=True)
    nearby_persons = Column(Integer, default=0, nullable=False)
    clip_path = Column(String, nullable=True)     # uploads/videos/poi/...
    snapshot_path = Column(String, nullable=True) # uploads/images/poi/...
    spotted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
