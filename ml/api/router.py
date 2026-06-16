"""
API router aggregation.

Collects all route modules into a single router for mounting on the app.
New route modules are added here as they are built.
"""

from fastapi import APIRouter

from ml.api.health_routes import router as health_router

api_router = APIRouter()

# Phase 1 — Health
api_router.include_router(health_router)

# Phase 2 — Face detection/recognition (uncomment when built)
# from ml.api.face_routes import router as face_router
# api_router.include_router(face_router, prefix="/face", tags=["Face"])

# Phase 5 — Audio classification (uncomment when built)
# from ml.api.audio_routes import router as audio_router
# api_router.include_router(audio_router, prefix="/audio", tags=["Audio"])

# Phase 5 — POI matching (uncomment when built)
# from ml.api.poi_routes import router as poi_router
# api_router.include_router(poi_router, prefix="/poi", tags=["POI"])

# Phase 6 — Frame processing pipeline (uncomment when built)
# from ml.api.frame_routes import router as frame_router
# api_router.include_router(frame_router, prefix="/pipeline", tags=["Pipeline"])
