from sqlalchemy import Column, String, DateTime, func
from app.db.base import SharedBase


class Tenant(SharedBase):
    __tablename__ = "tenants"

    id = Column(String, primary_key=True, index=True)  # unique tenant slug or uuid
    name = Column(String, nullable=False)
    mode = Column(String, nullable=False)  # school, mall, supermarket
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
