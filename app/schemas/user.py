import uuid
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = Field("security_guard", description="Role of the user (guard, teacher, admin, principal, store_manager, etc.)")
    tenant_id: Optional[uuid.UUID] = Field(None, description="Optional tenant scoping ID")


class UserCreate(UserBase):
    password: Optional[str] = Field(None, description="Raw password, hashed on creation")


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None



class UserRead(UserBase):
    id: uuid.UUID

    model_config = {"from_attributes": True}


