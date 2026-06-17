from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = Field("security_guard", description="Role of the user (guard, teacher, admin, principal, store_manager, etc.)")


class UserCreate(UserBase):
    password: Optional[str] = Field(None, description="Raw password, hashed on creation")


class UserRead(UserBase):
    id: str

    model_config = {"from_attributes": True}
