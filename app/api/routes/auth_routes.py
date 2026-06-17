import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from app.api.deps import get_session
from app.core.security import verify_password, create_access_token
from app.repositories import user_repository

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    tenant_id: uuid.UUID | None = None
    is_super_admin: bool = False


@router.post("/login", response_model=TokenResponse)
async def login_json(data: LoginRequest, db: AsyncSession = Depends(get_session)):
    """JSON login endpoint for client applications."""
    user = await user_repository.get_by_email(db, data.email)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    is_super = user.role == "super_admin"
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "is_super_admin": is_super,
        "tenant_id": None if is_super else (str(user.tenant_id) if user.tenant_id else None)
    }
    
    token = create_access_token(token_data)
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "tenant_id": user.tenant_id,
        "is_super_admin": is_super
    }


@router.post("/token", response_model=TokenResponse)
async def login_oauth2(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_session)):
    """OAuth2 password flow login endpoint for interactive API docs."""
    user = await user_repository.get_by_email(db, form_data.username)
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    is_super = user.role == "super_admin"
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "is_super_admin": is_super,
        "tenant_id": None if is_super else (str(user.tenant_id) if user.tenant_id else None)
    }
    
    token = create_access_token(token_data)
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "tenant_id": user.tenant_id,
        "is_super_admin": is_super
    }

