from datetime import datetime
from pydantic import BaseModel, Field


class TenantBase(BaseModel):
    id: str = Field(..., description="Unique URL slug or UUID identifying the tenant", pattern="^[a-zA-Z0-9_-]+$")
    name: str = Field(..., description="Human-readable name of the school, mall, or supermarket")
    mode: str = Field(..., description="Deployment mode (school, mall, or supermarket)")


class TenantCreate(TenantBase):
    pass


class TenantRead(TenantBase):
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
