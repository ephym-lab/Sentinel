import uuid
from sqlalchemy import Column, String, DateTime, func, JSON, UUID
from app.db.base import SharedBase


class Tenant(SharedBase):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    schema_name = Column(String, unique=True, nullable=False)
    environment_type = Column(String, nullable=False)  # school, mall, supermarket
    status = Column(String, default="pending", nullable=False)  # active, suspended, pending
    config = Column(JSON, default=dict, nullable=False)  # tenant-level config
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


    @property
    def mode(self) -> str:
        return self.environment_type

    @mode.setter
    def mode(self, value: str):
        self.environment_type = value

