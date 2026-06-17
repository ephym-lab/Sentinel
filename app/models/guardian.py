import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, UUID
from app.db.base import TenantBase


class Guardian(TenantBase):
    __tablename__ = "guardians"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("persons.id", ondelete="CASCADE"), nullable=False)
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=False)  # E.164 format
    relationship = Column(String, nullable=False)
    notify_on_arrival = Column(Boolean, default=True, nullable=False)
    notify_on_departure = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
