import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_tenant_db
from app.schemas.surveillance import FrameUploadRequest
from app.services import surveillance_service


router = APIRouter()


@router.post("/process-frame", status_code=status.HTTP_200_OK)
async def process_frame(
    request: FrameUploadRequest,
    db: AsyncSession = Depends(get_tenant_db),
    tenant_id: uuid.UUID = Header(..., alias="X-Tenant-ID")
):

    """Process a single frame from a camera:
    
    1. Sends the image (and optional audio) to the ML service.
    2. Performs face and Re-ID vector matching against tenant POIs.
    3. Triggers/creates incidents in the tenant's schema if threats or POIs are found.
    """
    try:
        result = await surveillance_service.process_camera_frame(
            db=db,
            tenant_id=tenant_id,
            camera_id=request.camera_id,
            image_b64=request.image_b64,
            audio_b64=request.audio_b64,
            analysis_mode=request.analysis_mode,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Surveillance pipeline error: {str(e)}"
        )
