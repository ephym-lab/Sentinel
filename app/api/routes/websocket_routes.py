import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.event_bus import event_bus

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/stream/events")
async def websocket_events(websocket: WebSocket, tenant_id: str = Query(...)):
    """Live stream for all dashboard notifications and events (incidents, POIs, n.k.)"""
    await websocket.accept()
    channel = f"sentinel:{tenant_id}:events"
    logger.info(f"WebSocket client connected to {channel}")
    
    try:
        async for envelope in event_bus.subscribe(channel):
            await websocket.send_json(envelope)
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected from {channel}")
    except Exception as e:
        logger.error(f"WebSocket error on {channel}: {e}")
        await websocket.close()


@router.websocket("/stream/roll-call/{incident_id}")
async def websocket_roll_call(websocket: WebSocket, incident_id: str, tenant_id: str = Query(...)):
    """Live stream for roll call updates during an active incident."""
    await websocket.accept()
    channel = f"sentinel:{tenant_id}:roll-call:{incident_id}"
    logger.info(f"WebSocket client connected to roll-call {channel}")
    
    try:
        async for envelope in event_bus.subscribe(channel):
            await websocket.send_json(envelope)
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected from roll-call {channel}")
    except Exception as e:
        logger.error(f"WebSocket error on roll-call {channel}: {e}")
        await websocket.close()


@router.websocket("/stream/poi/{poi_id}")
async def websocket_poi_sighting(websocket: WebSocket, poi_id: str, tenant_id: str = Query(...)):
    """Live stream for a specific Person of Interest tracking sightings."""
    await websocket.accept()
    channel = f"sentinel:{tenant_id}:poi:{poi_id}"
    logger.info(f"WebSocket client connected to POI tracking {channel}")
    
    try:
        async for envelope in event_bus.subscribe(channel):
            await websocket.send_json(envelope)
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected from POI tracking {channel}")
    except Exception as e:
        logger.error(f"WebSocket error on POI tracking {channel}: {e}")
        await websocket.close()


@router.websocket("/stream/recovery/{recovery_id}")
async def websocket_recovery(websocket: WebSocket, recovery_id: str, tenant_id: str = Query(...)):
    """Live stream for lost child recovery searches."""
    await websocket.accept()
    channel = f"sentinel:{tenant_id}:recovery:{recovery_id}"
    logger.info(f"WebSocket client connected to child recovery {channel}")
    
    try:
        async for envelope in event_bus.subscribe(channel):
            await websocket.send_json(envelope)
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected from child recovery {channel}")
    except Exception as e:
        logger.error(f"WebSocket error on child recovery {channel}: {e}")
        await websocket.close()
