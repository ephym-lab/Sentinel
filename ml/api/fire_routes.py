"""
Fire and smoke detection API routes.

Endpoints:
- POST /detect-fire  — detect fire/smoke regions in a camera frame
"""

import logging
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ml.dependencies import get_fire_detector
from ml.schemas.responses import FireDetection
from ml.utils.file_utils import save_snapshot
from ml.utils.image_utils import decode_base64_image

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Fire & Safety"])


class FireDetectRequest(BaseModel):
    image_b64: str = Field(..., description="Base64-encoded camera frame")
    camera_id: str = Field(..., description="Camera identifier for alert context")
    tenant_id: str = Field(..., description="Tenant UUID for scoped file storage")
    save_snapshot: bool = Field(
        True, description="Save a snapshot to uploads/tenants/{tenant_id}/incidents/ if fire is detected"
    )


class FireDetectResult(BaseModel):
    detections: list[FireDetection]
    is_emergency: bool = Field(..., description="True if fire (not just smoke) detected")
    camera_id: str
    snapshot_path: str | None = None
    inference_time_ms: float


@router.post("/detect-fire", response_model=FireDetectResult)
async def detect_fire(
    request: FireDetectRequest,
    fire_detector=Depends(get_fire_detector),
) -> FireDetectResult:
    """Detect fire and smoke regions in a frame.

    Returns bounding boxes with labels ('fire' or 'smoke') and confidence.
    Sets is_emergency=True when a 'fire' region is detected — triggering
    the backend to dispatch immediate evacuation alerts.
    """
    start = time.perf_counter()

    try:
        frame = decode_base64_image(request.image_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    raw_detections = fire_detector.detect(frame)
    is_emergency = fire_detector.is_fire_emergency(raw_detections)

    detections = [
        FireDetection(
            x1=d["bbox"][0],
            y1=d["bbox"][1],
            x2=d["bbox"][2],
            y2=d["bbox"][3],
            label=d["label"],
            confidence=d["confidence"],
        )
        for d in raw_detections
    ]

    # Save snapshot when fire/smoke is detected for evidence
    snapshot_path = None
    if request.save_snapshot and raw_detections:
        snapshot_path = save_snapshot(
            frame,
            category="incidents",
            prefix=request.camera_id,
            tenant_id=request.tenant_id,
        )

    elapsed_ms = (time.perf_counter() - start) * 1000

    return FireDetectResult(
        detections=detections,
        is_emergency=is_emergency,
        camera_id=request.camera_id,
        snapshot_path=snapshot_path,
        inference_time_ms=round(elapsed_ms, 2),
    )
