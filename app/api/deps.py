from typing import AsyncGenerator, Optional
import uuid
from fastapi import Header, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import AsyncSessionLocal
from app.models.tenant import Tenant
from app.models.user import User
from app.core.config import settings
from app.core.security import decode_access_token
from app.repositories import user_repository

reusable_oauth2 = HTTPBearer(auto_error=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Get async database session targeting the shared/public schema."""
    async with AsyncSessionLocal() as db:
        if not settings.DATABASE_URL.startswith("sqlite"):
            await db.execute(text("SET search_path TO sentinel_public;"))
        try:
            yield db
        finally:
            await db.close()


async def get_current_user(
    token: Optional[HTTPAuthorizationCredentials] = Depends(reusable_oauth2),
    db: AsyncSession = Depends(get_session)
) -> User:
    """Get the current authenticated user from JWT token."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
        )
    payload = decode_access_token(token.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims",
        )
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format",
        )
    
    user = await user_repository.get_by_id(db, user_uuid)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


async def get_super_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Gatekeeper for platform super admins."""
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform super admins can perform this action",
        )
    return current_user


async def get_tenant_db(
    x_tenant_id: uuid.UUID = Header(..., alias="X-Tenant-ID"),
    token: Optional[HTTPAuthorizationCredentials] = Depends(reusable_oauth2),
) -> AsyncGenerator[AsyncSession, None]:
    """Dependency that returns an async database session routed to a specific tenant's schema.
    If a token is provided, it validates that tenant-scoped users can only access their own tenant,
    while allowing super_admins to access any tenant's schema.
    """
    if token:
        payload = decode_access_token(token.credentials)
        if payload:
            role = payload.get("role")
            is_super = payload.get("is_super_admin", False) or (role == "super_admin")
            token_tenant_id = payload.get("tenant_id")
            
            # Non-super admins must match the X-Tenant-ID header with their token tenant scope
            if not is_super:
                if not token_tenant_id or str(token_tenant_id) != str(x_tenant_id):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied to this tenant's resources.",
                    )

    async with AsyncSessionLocal() as db:
        try:
            # 1. Target sentinel_public schema to find the Tenant info
            if not settings.DATABASE_URL.startswith("sqlite"):
                await db.execute(text("SET search_path TO sentinel_public;"))
            
            stmt = select(Tenant).where(Tenant.id == x_tenant_id)
            result = await db.execute(stmt)
            tenant = result.scalar_one_or_none()
            
            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Tenant '{x_tenant_id}' does not exist."
                )
            
            # 2. Switch search path to tenant-specific schema and public fallback
            if not settings.DATABASE_URL.startswith("sqlite"):
                schema_name = tenant.schema_name
                await db.execute(text(f"SET search_path TO {schema_name}, sentinel_public;"))
                
            yield db
        finally:
            await db.close()


