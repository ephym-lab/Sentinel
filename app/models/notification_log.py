import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, func, UUID
from app.db.base import TenantBase


class NotificationLog(TenantBase):
    __tablename__ = "notification_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("notification_recipients.id", ondelete="CASCADE"), nullable=False)
    channel = Column(String, nullable=False)  # sms, call, email
    status = Column(String, nullable=False, default="sent")  # sent, delivered, acknowledged, failed
    provider_sid = Column(String, nullable=True)  # Africa's Talking session/message SID
    sent_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
