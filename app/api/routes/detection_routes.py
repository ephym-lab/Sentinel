import uuid
import logging
from fastapi import APIRouter, Depends, Header, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_tenant_db
from app.schemas.detection import DetectionIngestRequest
from app.models.detection_event import DetectionEvent
from app.services.event_bus import event_bus

logger = logging.getLogger(__name__)

router = APIRouter()


async def save_detection_to_db(db: AsyncSession, request: DetectionIngestRequest):
    """Helper background task to write detection logs to database without blocking request cycle."""
    try:
        camera_uuid = uuid.UUID(request.camera_id) if request.camera_id else None
        
        event = DetectionEvent(
            id=uuid.uuid4(),
            camera_id=camera_uuid,
            microphone_id=uuid.UUID(request.microphone_id) if request.microphone_id else None,
            event_type=request.event_type,
            confidence_score=request.confidence_score,
            clip_path=request.clip_path,
            metadata_log=request.metadata
        )
        db.add(event)
        await db.commit()
        logger.info(f"Persisted detection event '{request.event_type}' asynchronously.")
    except Exception as e:
        logger.error(f"Failed to persist detection event in background task: {e}")


@router.post("/", status_code=status.HTTP_202_ACCEPTED)
async def ingest_detection(
    request: DetectionIngestRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_tenant_db),
    tenant_id: str = Header(..., alias="X-Tenant-ID")
):
    """Ingest raw edge detection event. Dispatches to Redis and returns 202 immediately (< 50ms)."""
    # 1. Publish to Redis Pub/Sub immediately for real-time WebSocket dashboard streaming
    payload = request.model_dump()
    payload["tenant_id"] = tenant_id
    
    await event_bus.publish(
        channel=f"sentinel:{tenant_id}:events",
        event_type="detection",
        payload=payload
    )
    
    # 2. Defer database write
    background_tasks.add_task(save_detection_to_db, db, request)
    
    return {"status": "accepted"}
