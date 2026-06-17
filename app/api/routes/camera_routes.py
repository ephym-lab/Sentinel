import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_tenant_db
from app.schemas.camera import CameraCreate, CameraRead
from app.models.camera import Camera

router = APIRouter()


@router.post("/", response_model=CameraRead, status_code=status.HTTP_201_CREATED)
async def register_camera(data: CameraCreate, db: AsyncSession = Depends(get_tenant_db)):
    """Register a new camera within the tenant's schema space asynchronously."""
    camera_uuid = data.id

    stmt = select(Camera).where(Camera.id == camera_uuid)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Camera ID '{data.id}' is already registered for this tenant."
        )
    
    camera = Camera(
        id=camera_uuid,
        name=data.name,
        location=data.location,
        is_active=data.is_active
    )
    db.add(camera)
    await db.commit()
    await db.refresh(camera)
    return camera


@router.get("/", response_model=list[CameraRead])
async def list_cameras(db: AsyncSession = Depends(get_tenant_db)):
    """List all registered cameras for the tenant."""
    stmt = select(Camera)
    result = await db.execute(stmt)
    return list(result.scalars().all())
