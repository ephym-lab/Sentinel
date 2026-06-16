from fastapi import FastAPI
from app.core.config import settings
from app.api.router import api_router

app = FastAPI(title=settings.PROJECT_NAME, version="0.1.0")

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "project": settings.PROJECT_NAME}
