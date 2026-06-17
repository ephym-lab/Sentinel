import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class PlatformTenantCreate(BaseModel):
    id: uuid.UUID = Field(..., description="Unique UUID identifying the tenant")
    name: str = Field(..., description="Human-readable name of the tenant")
    environment_type: str = Field(..., description="school, mall, or supermarket")
    config: Optional[Dict[str, Any]] = Field(None, description="Initial custom config overrides")


class PlatformTenantUpdate(BaseModel):
    name: Optional[str] = None
    config: Dict[str, Any] = Field(..., description="Complete new tenant config object")


class PlatformTenantRead(BaseModel):
    id: uuid.UUID
    name: str
    schema_name: str
    environment_type: str
    status: str
    config: Dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class PlatformAuditLogRead(BaseModel):
    id: uuid.UUID
    super_admin_id: uuid.UUID
    action: str
    tenant_id: Optional[uuid.UUID] = None
    details: Optional[Dict[str, Any]] = None
    performed_at: datetime

    model_config = {"from_attributes": True}


class SupportTicketCreate(BaseModel):
    tenant_id: Optional[uuid.UUID] = None
    subject: str
    description: Optional[str] = None


class SupportTicketRead(BaseModel):
    id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    subject: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


