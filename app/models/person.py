import uuid
from sqlalchemy import Column, String, DateTime, func, UUID
from pgvector.sqlalchemy import Vector
from app.db.base import TenantBase


class Person(TenantBase):
    __tablename__ = "persons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String, nullable=False)
    person_type = Column(String, nullable=False)  # student, staff, guardian, known_offender, vip_customer
    identifier = Column(String, unique=True, index=True, nullable=False)
    class_grade = Column(String, nullable=True)  # school mode only
    dormitory = Column(String, nullable=True)    # school mode only
    
    # 512-dim ArcFace embedding
    face_embedding = Column(Vector(512), nullable=True)
    photo_path = Column(String, nullable=True)
    status = Column(String, nullable=False, default="active")  # active, evacuated, missing, suspended, blacklisted, inactive
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
