from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

# If sqlite is in use (for local/testing), let's ensure it runs async.
db_url = settings.DATABASE_URL
if db_url.startswith("sqlite"):
    if not db_url.startswith("sqlite+aiosqlite"):
        db_url = db_url.replace("sqlite://", "sqlite+aiosqlite://")
    engine = create_async_engine(db_url, connect_args={"check_same_thread": False})
else:
    engine = create_async_engine(db_url)


class SharedBase(DeclarativeBase):
    """Base for shared tables stored in the public schema."""
    pass


class TenantBase(DeclarativeBase):
    """Base for tenant-specific tables stored in per-tenant schemas."""
    pass
