from contextlib import asynccontextmanager
import datetime
import logging
from collections import deque
from fastapi import FastAPI
from sqlalchemy import text

# --- Setup In-Memory Log Capture Buffer ---
class InMemoryErrorLogHandler(logging.Handler):
    def __init__(self, capacity=50):
        super().__init__(level=logging.WARNING)
        self.buffer = deque(maxlen=capacity)

    def emit(self, record):
        log_entry = {
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "logger": record.name,
            "message": self.format(record),
            "level": record.levelname,
            "filename": record.filename,
            "lineno": record.lineno
        }
        self.buffer.append(log_entry)

error_log_handler = InMemoryErrorLogHandler()
error_log_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logging.getLogger().addHandler(error_log_handler)

from app.core.config import settings
from app.api.router import api_router
from app.db.base import engine, SharedBase

# Import new models to register them on SharedBase
from app.models.platform_audit_log import PlatformAuditLog
from app.models.support_ticket import SupportTicket
from app.models.user import User
from app.models.tenant import Tenant


async def upgrade_database_schema(conn):
    """Safely apply columns to the tenants table if they do not exist (SQLite or PostgreSQL)."""
    if settings.DATABASE_URL.startswith("sqlite"):
        cursor = await conn.execute(text("PRAGMA table_info(tenants);"))
        columns = [row[1] for row in cursor.fetchall()]
        if columns:
            if "schema_name" not in columns:
                await conn.execute(text("ALTER TABLE tenants ADD COLUMN schema_name VARCHAR;"))
            if "environment_type" not in columns:
                await conn.execute(text("ALTER TABLE tenants ADD COLUMN environment_type VARCHAR;"))
            if "status" not in columns:
                await conn.execute(text("ALTER TABLE tenants ADD COLUMN status VARCHAR DEFAULT 'pending';"))
            if "config" not in columns:
                await conn.execute(text("ALTER TABLE tenants ADD COLUMN config JSON;"))
            if "updated_at" not in columns:
                await conn.execute(text("ALTER TABLE tenants ADD COLUMN updated_at DATETIME;"))
    else:
        # PostgreSQL
        res = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'sentinel_public' AND table_name = 'tenants';
        """))
        columns = [row[0] for row in res.fetchall()]
        if columns:
            if "schema_name" not in columns:
                await conn.execute(text("ALTER TABLE sentinel_public.tenants ADD COLUMN schema_name VARCHAR;"))
            if "environment_type" not in columns:
                await conn.execute(text("ALTER TABLE sentinel_public.tenants ADD COLUMN environment_type VARCHAR;"))
            if "status" not in columns:
                await conn.execute(text("ALTER TABLE sentinel_public.tenants ADD COLUMN status VARCHAR DEFAULT 'pending';"))
            if "config" not in columns:
                await conn.execute(text("ALTER TABLE sentinel_public.tenants ADD COLUMN config JSONB DEFAULT '{}'::jsonb;"))
            if "updated_at" not in columns:
                await conn.execute(text("ALTER TABLE sentinel_public.tenants ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize public database schema
    try:
        async with engine.begin() as conn:
            if not settings.DATABASE_URL.startswith("sqlite"):
                # Enable pgvector extension for PostgreSQL
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                # Create shared schema
                await conn.execute(text("CREATE SCHEMA IF NOT EXISTS sentinel_public;"))
                # Set search path to sentinel_public for SharedBase tables
                await conn.execute(text("SET search_path TO sentinel_public;"))
            
            # Apply schema upgrades to tenants table
            await upgrade_database_schema(conn)
            
            # Create all tables registered in SharedBase (public schema)
            await conn.run_sync(SharedBase.metadata.create_all)
    except Exception as e:
        logging.getLogger(__name__).error(f"Lifespan database initialization failed: {e}")

    # 2. Seed default mock tenant for local development
    try:
        import uuid
        from app.db.session import AsyncSessionLocal
        from app.services.tenant_service import get_tenant_by_id, create_tenant
        from app.schemas.tenant import TenantCreate
        
        async with AsyncSessionLocal() as db:
            mock_tenant_id = uuid.UUID("d3b07384-d113-4ec6-a558-7ced2c45e54d")
            existing = await get_tenant_by_id(db, mock_tenant_id)
            if not existing:
                await create_tenant(
                    db,
                    TenantCreate(
                        id=mock_tenant_id,
                        name="Sentinel Academy",
                        mode="school"
                    )
                )
                logging.getLogger(__name__).info("Successfully seeded default mock tenant 'Sentinel Academy' into database.")
    except Exception as e:
        logging.getLogger(__name__).warning(f"Failed to seed default mock tenant: {e}")


    # Start notification escalation background scheduler
    try:
        from app.core.scheduler import start_scheduler
        start_scheduler()
    except Exception as e:
        logging.getLogger(__name__).error(f"Failed to start scheduler: {e}")
        
    yield

    # Shutdown background scheduler
    try:
        from app.core.scheduler import shutdown_scheduler
        shutdown_scheduler()
    except Exception as e:
        logging.getLogger(__name__).error(f"Failed to stop scheduler: {e}")


from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import websocket_routes

app = FastAPI(title=settings.PROJECT_NAME, version="0.1.0", lifespan=lifespan)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
app.include_router(websocket_routes.router, prefix="/ws")

# Mount static files for local-first storage
import os
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
# The database stores paths starting with 'uploads/'.
# The frontend requests '/static/uploads/...'.
# By mounting at '/static', Starlette looks for 'uploads/uploads/...'.
# By mounting at '/', it would look for 'uploads/...', but we want a prefix.
# We mount at '/static' but we can use directory="." so it finds 'uploads/...'
# Or mount at '/static/uploads' with directory=settings.UPLOAD_DIR.
app.mount("/static/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="static_uploads")


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "project": settings.PROJECT_NAME}

