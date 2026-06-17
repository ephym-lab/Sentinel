import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, func, UUID, Text
from pgvector.sqlalchemy import Vector
from app.db.base import TenantBase


class POI(TenantBase):
    __tablename__ = "persons_of_interest"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    label = Column(String, nullable=False)  # e.g., "Unknown Male — black hoodie"
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id", ondelete="SET NULL"), nullable=True)
    
    # Vector embeddings
    face_embedding = Column(Vector(512), nullable=True)
    reid_embedding = Column(Vector(2048), nullable=True)  # OSNet appearance padded to 2048 if needed
    
    photo_path = Column(String, nullable=True)  # uploads/images/poi/...
    reason = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="active")  # active, resolved, expired
    created_by = Column(UUID(as_uuid=True), nullable=True)  # link to user who flagged them
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
