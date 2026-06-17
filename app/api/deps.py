from typing import AsyncGenerator
from fastapi import Header, HTTPException, status
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import AsyncSessionLocal
from app.models.tenant import Tenant
from app.core.config import settings


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Get async database session targeting the shared/public schema."""
    async with AsyncSessionLocal() as db:
        if not settings.DATABASE_URL.startswith("sqlite"):
            await db.execute(text("SET search_path TO sentinel_public;"))
        try:
            yield db
        finally:
            await db.close()


async def get_tenant_db(x_tenant_id: str = Header(..., alias="X-Tenant-ID")) -> AsyncGenerator[AsyncSession, None]:
    """Dependency that returns an async database session routed to a specific tenant's schema."""
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
                schema_name = f"sentinel_{x_tenant_id}"
                await db.execute(text(f"SET search_path TO {schema_name}, sentinel_public;"))
                
            yield db
        finally:
            await db.close()
