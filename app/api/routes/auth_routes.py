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


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    tenant_name: str
    environment_type: str  # e.g., 'mall', 'school', 'supermarket'


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


@router.post("/register", response_model=TokenResponse)
async def register_tenant(data: RegisterRequest, db: AsyncSession = Depends(get_session)):
    """Register a new tenant organization and the initial admin user."""
    # Check if email is taken
    existing_user = await user_repository.get_by_email(db, data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    from app.models.tenant import Tenant
    from app.schemas.user import UserCreate

    # 1. Create Tenant
    # Generate a simple schema name based on tenant name
    schema_name = f"tenant_{uuid.uuid4().hex[:8]}"
    new_tenant = Tenant(
        name=data.tenant_name,
        schema_name=schema_name,
        environment_type=data.environment_type,
        status="active"
    )
    db.add(new_tenant)
    await db.flush() # flush to get the new_tenant.id

    # 2. Create Admin User for this tenant
    user_create = UserCreate(
        name=data.name,
        email=data.email,
        password=data.password,
        role="admin",
        tenant_id=new_tenant.id
    )
    new_user = await user_repository.create(db, user_create)

    # Note: In a real production PostgreSQL setup, we would also execute:
    # await db.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name};"))
    # and run alembic migrations against that schema. Since we are focusing on
    # local SQLite for now, SQLite creates tables in the main schema, which is fine for UI testing.

    # 3. Log them in automatically
    token_data = {
        "sub": str(new_user.id),
        "email": new_user.email,
        "role": new_user.role,
        "is_super_admin": False,
        "tenant_id": str(new_tenant.id)
    }
    token = create_access_token(token_data)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": new_user.role,
        "tenant_id": new_tenant.id,
        "is_super_admin": False
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

