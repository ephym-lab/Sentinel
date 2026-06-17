import logging
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import engine, TenantBase
from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate
from app.core.config import settings

logger = logging.getLogger(__name__)


async def create_tenant_schema_tables(tenant_id: str):
    """Create a new PostgreSQL schema (sentinel_<tenant_id>) and generate tenant tables within it asynchronously."""
    schema_name = f"sentinel_{tenant_id}"
    
    async with engine.begin() as conn:
        if not settings.DATABASE_URL.startswith("sqlite"):
            # 1. Create the schema
            await conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name};"))
            # 2. Set search path to the new schema for table creation
            await conn.execute(text(f"SET search_path TO {schema_name};"))
            logger.info(f"Created schema '{schema_name}' for tenant '{tenant_id}'")
        
        # 3. Create all tables registered with TenantBase using run_sync
        await conn.run_sync(TenantBase.metadata.create_all)
        logger.info(f"Initialized all tenant-specific tables in schema '{schema_name}'")


async def create_tenant(db: AsyncSession, data: TenantCreate) -> Tenant:
    """Create a tenant record in the shared schema and initialize its schema and tables."""
    # 1. Create tenant record in database
    tenant = Tenant(
        id=data.id,
        name=data.name,
        mode=data.mode,
    )
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)
    
    # 2. Spin up schema and tables
    await create_tenant_schema_tables(tenant.id)
    
    return tenant


async def list_tenants(db: AsyncSession) -> list[Tenant]:
    """Retrieve all tenants from the public schema."""
    stmt = select(Tenant)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_tenant_by_id(db: AsyncSession, tenant_id: str) -> Tenant | None:
    """Get a tenant by its ID/slug."""
    stmt = select(Tenant).where(Tenant.id == tenant_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
