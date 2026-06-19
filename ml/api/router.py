"""
API router aggregation.

Collects all route modules into a single router for mounting on the app.
New route modules are added here as they are built.
"""

from fastapi import APIRouter

from ml.api.health_routes import router as health_router
from ml.api.face_routes import router as face_router
from ml.api.person_routes import router as person_router
from ml.api.behavior_routes import router as behavior_router
from ml.api.fire_routes import router as fire_router
from ml.api.audio_routes import router as audio_router
from ml.api.reid_routes import router as reid_router

api_router = APIRouter()

# Phase 1 — Health
api_router.include_router(health_router)

# Phase 2 — Face detection/recognition
api_router.include_router(face_router, prefix="/face", tags=["Face"])

# Phase 3 — Person detection, tracking & pose
api_router.include_router(person_router, prefix="/person", tags=["Person & Pose"])

# Phase 4 — Behavior & emotion
api_router.include_router(behavior_router, prefix="/behavior", tags=["Behavior & Emotion"])

# Phase 5 — Fire & safety
api_router.include_router(fire_router, prefix="/fire", tags=["Fire & Safety"])

# Phase 5 — Audio classification
api_router.include_router(audio_router, prefix="/audio", tags=["Audio"])

# Phase 5 — Re-ID
api_router.include_router(reid_router, prefix="/reid", tags=["Re-ID"])

# Phase 6 — Frame processing pipeline
from ml.api.frame_routes import router as frame_router
api_router.include_router(frame_router, prefix="/pipeline", tags=["Pipeline"])

# Phase 7 — MJPEG Streaming
from ml.api.stream_routes import router as stream_router
api_router.include_router(stream_router, prefix="/stream", tags=["Stream"])

