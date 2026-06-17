from contextlib import asynccontextmanager
from fastapi import FastAPI
from sqlalchemy import text

from app.core.config import settings
from app.api.router import api_router
from app.db.base import engine, SharedBase


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
            
            # Create all tables registered in SharedBase (public schema)
            await conn.run_sync(SharedBase.metadata.create_all)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Lifespan database initialization failed: {e}")

    # Start notification escalation background scheduler
    try:
        from app.core.scheduler import start_scheduler
        start_scheduler()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to start scheduler: {e}")
        
    yield

    # Shutdown background scheduler
    try:
        from app.core.scheduler import shutdown_scheduler
        shutdown_scheduler()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to stop scheduler: {e}")


from fastapi.staticfiles import StaticFiles
from app.api.routes import websocket_routes

app = FastAPI(title=settings.PROJECT_NAME, version="0.1.0", lifespan=lifespan)

app.include_router(api_router, prefix="/api/v1")
app.include_router(websocket_routes.router, prefix="/ws")

# Mount static files for local-first storage
import os
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=settings.UPLOAD_DIR), name="static")


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "project": settings.PROJECT_NAME}

