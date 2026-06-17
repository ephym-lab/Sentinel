import uuid
from sqlalchemy import Column, String, UUID
from app.db.base import SharedBase


class User(SharedBase):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)  # Store encrypted passwords
    role = Column(String, nullable=False, default="security_guard")  # guard, teacher, admin, principal, store_manager, etc.
    tenant_id = Column(UUID(as_uuid=True), nullable=True)  # Scoped tenant ID (null for super_admin)


