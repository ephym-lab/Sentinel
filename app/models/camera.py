import uuid
from sqlalchemy import Column, String, Boolean, DateTime, func, UUID
from sqlalchemy.orm import relationship
from app.db.base import TenantBase


class Camera(TenantBase):
    __tablename__ = "cameras"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    feeds = relationship("CameraFeed", back_populates="camera", cascade="all, delete-orphan")
    rules = relationship("CameraRule", back_populates="camera", cascade="all, delete-orphan")

    @property
    def active_feed(self) -> object | None:
        for feed in self.feeds:
            if feed.is_active:
                return feed
        return None


