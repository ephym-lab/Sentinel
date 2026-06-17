import uuid
from sqlalchemy import Column, String, Integer, Boolean, JSON, UUID
from app.db.base import TenantBase


class NotificationRecipient(TenantBase):
    __tablename__ = "notification_recipients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # teacher_on_duty, deputy_principal, principal, security_guard, etc.
    phone = Column(String, nullable=False)  # E.164 format
    email = Column(String, nullable=False)
    channels = Column(JSON, default=list, nullable=False)  # ["sms", "call"]
    escalation_tier = Column(Integer, default=1, nullable=False)  # 1 = first notified, 2 = backup, etc.
    is_active = Column(Boolean, default=True, nullable=False)
