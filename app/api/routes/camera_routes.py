import os
import re
import uuid
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, Header
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_tenant_db
from app.schemas.camera import CameraCreate, CameraRead
from app.models.camera import Camera
from app.models.camera_feed import CameraFeed
from app.models.tenant import Tenant
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


def sanitize_filename(filename: str) -> str:
    """Sanitize the original filename to avoid path traversal and invalid characters."""
    name, ext = os.path.splitext(filename)
    # Strip any characters that aren't letters, numbers, hyphens, underscores, or spaces
    name = re.sub(r'[^a-zA-Z0-9_\- ]', '', name)
    # Replace spaces with underscores
    name = name.replace(' ', '_')
    # Limit name length to avoid filesystem issues
    name = name[:50]
    return f"{name}{ext.lower()}"


def validate_video_content(file_head: bytes) -> bool:
    """Validate video content using file signature bytes (magic bytes)."""
    # Check AVI: RIFF at start and AVI in bytes 8-12
    if len(file_head) >= 12 and file_head[0:4] == b"RIFF" and file_head[8:12] == b"AVI ":
        return True
    # Check MP4 / MOV: look for 'ftyp' or 'moov' in first 32 bytes
    if b"ftyp" in file_head[0:32] or b"moov" in file_head[0:32]:
        return True
    return False


@router.post("/", response_model=CameraRead, status_code=status.HTTP_201_CREATED)
async def register_camera(data: CameraCreate, db: AsyncSession = Depends(get_tenant_db)):
    """Register a new camera within the tenant's schema space asynchronously."""
    camera_uuid = data.id or uuid.uuid4()

    stmt = select(Camera).where(Camera.id == camera_uuid)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Camera ID '{camera_uuid}' is already registered for this tenant."
        )
    
    # Support 'zone' parameter mapping to 'location' if provided
    location_val = data.location or data.zone
    
    camera = Camera(
        id=camera_uuid,
        name=data.name,
        location=location_val,
        is_active=data.is_active
    )
    db.add(camera)
    await db.commit()
    
    # Reload with feeds loaded to avoid async relationship loading issues
    stmt = select(Camera).options(selectinload(Camera.feeds)).where(Camera.id == camera_uuid)
    res = await db.execute(stmt)
    camera = res.scalar_one()
    return camera


@router.post("/{id}/feed", response_model=CameraRead, status_code=status.HTTP_200_OK)
async def upload_camera_feed(
    id: uuid.UUID,
    file: UploadFile = File(...),
    uploaded_by: Optional[uuid.UUID] = Form(None),
    x_tenant_id: uuid.UUID = Header(..., alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Upload a video file to act as the feed source for a camera."""
    # 1. Verify camera exists
    stmt_cam = select(Camera).options(selectinload(Camera.feeds)).where(Camera.id == id)
    res_cam = await db.execute(stmt_cam)
    camera = res_cam.scalar_one_or_none()
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with ID '{id}' not found."
        )

    # 2. Get tenant schema name for namespacing
    tenant_stmt = select(Tenant).where(Tenant.id == x_tenant_id)
    tenant_result = await db.execute(tenant_stmt)
    tenant = tenant_result.scalar_one_or_none()
    tenant_schema = tenant.schema_name if tenant else f"sentinel_{str(x_tenant_id).lower().replace('-', '_')}"

    # 3. Validate file size (Max 200MB)
    max_size = 200 * 1024 * 1024
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)


    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File is too large. Maximum allowed size is 200MB."
        )

    # 4. Validate file extension & content type
    ext = os.path.splitext(file.filename.lower())[1]
    if ext not in [".mp4", ".mov", ".avi"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file extension. Only .mp4, .mov, and .avi are allowed."
        )

    # Read first 32 bytes for signature validation
    file_head = await file.read(32)
    await file.seek(0)
    if not validate_video_content(file_head):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file content. The file signature does not match any accepted video format."
        )

    # 5. Create namespaced directory under uploads/videos/
    video_dir = Path(settings.UPLOAD_DIR) / "videos" / tenant_schema
    video_dir.mkdir(parents=True, exist_ok=True)

    # 6. Save file to disk
    safe_name = f"{uuid.uuid4()}_{sanitize_filename(file.filename)}"
    dest_path = video_dir / safe_name
    
    with open(dest_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)

    # 7. Set all other feeds for this camera to inactive
    for feed in camera.feeds:
        if feed.is_active:
            feed.is_active = False

    # 8. Create new active feed record
    relative_path = f"videos/{tenant_schema}/{safe_name}"
    new_feed = CameraFeed(
        id=uuid.uuid4(),
        camera_id=id,
        source_type="uploaded_file",
        file_path=relative_path,
        original_filename=file.filename,
        is_active=True,
        uploaded_by=uploaded_by
    )
    camera.feeds.append(new_feed)
    await db.commit()

    # 9. Reload camera and return it
    stmt_cam_reload = select(Camera).options(selectinload(Camera.feeds)).where(Camera.id == id)
    res_cam_reload = await db.execute(stmt_cam_reload)
    camera_reloaded = res_cam_reload.scalar_one()
    await db.refresh(camera_reloaded)
    return camera_reloaded



@router.get("/", response_model=list[CameraRead])
async def list_cameras(db: AsyncSession = Depends(get_tenant_db)):
    """List all registered cameras for the tenant with active feed details."""
    stmt = select(Camera).options(selectinload(Camera.feeds))
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{id}", response_model=CameraRead)
async def get_camera(id: uuid.UUID, db: AsyncSession = Depends(get_tenant_db)):
    """Retrieve camera details and feed history."""
    stmt = select(Camera).options(selectinload(Camera.feeds)).where(Camera.id == id)
    result = await db.execute(stmt)
    camera = result.scalar_one_or_none()
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with ID '{id}' not found."
        )
    return camera


@router.patch("/{id}", response_model=CameraRead)
async def update_camera(
    id: uuid.UUID,
    data: CameraCreate,
    db: AsyncSession = Depends(get_tenant_db)
):
    """Update camera properties (name, zone, camera_type, location, is_active)."""
    stmt = select(Camera).where(Camera.id == id)
    result = await db.execute(stmt)
    camera = result.scalar_one_or_none()
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with ID '{id}' not found."
        )
    
    if data.name is not None:
        camera.name = data.name
    if data.zone is not None:
        camera.zone = data.zone
        camera.location = data.location or data.zone
    if data.camera_type is not None:
        camera.camera_type = data.camera_type
    if data.location is not None:
        camera.location = data.location
    if data.is_active is not None:
        camera.is_active = data.is_active

    await db.commit()
    
    # Reload camera
    stmt_reload = select(Camera).options(selectinload(Camera.feeds)).where(Camera.id == id)
    res_reload = await db.execute(stmt_reload)
    return res_reload.scalar_one()


@router.patch("/{id}/feed/{feed_id}/activate", response_model=CameraRead)
async def activate_camera_feed(
    id: uuid.UUID,
    feed_id: uuid.UUID,
    db: AsyncSession = Depends(get_tenant_db)
):
    """Activate a specific camera feed and deactivate all others."""
    stmt_cam = select(Camera).options(selectinload(Camera.feeds)).where(Camera.id == id)
    res_cam = await db.execute(stmt_cam)
    camera = res_cam.scalar_one_or_none()
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with ID '{id}' not found."
        )

    target_feed = None
    for feed in camera.feeds:
        if feed.id == feed_id:
            target_feed = feed
            feed.is_active = True
        else:
            feed.is_active = False

    if not target_feed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Feed '{feed_id}' not found for camera '{id}'."
        )

    await db.commit()
    return camera


@router.delete("/{id}/feed/{feed_id}", status_code=status.HTTP_200_OK)
async def delete_camera_feed(
    id: uuid.UUID,
    feed_id: uuid.UUID,
    db: AsyncSession = Depends(get_tenant_db)
):
    """Remove a camera feed (file deleted from disk and row removed)."""
    # 1. Fetch camera feed
    stmt = select(CameraFeed).where(CameraFeed.id == feed_id, CameraFeed.camera_id == id)
    result = await db.execute(stmt)
    feed = result.scalar_one_or_none()
    if not feed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Feed '{feed_id}' not found for camera '{id}'."
        )

    # 2. Delete file from disk
    if feed.file_path:
        full_path = Path(settings.UPLOAD_DIR) / feed.file_path
        if full_path.exists() and full_path.is_file():
            try:
                full_path.unlink()
            except Exception as e:
                logger.error(f"Failed to delete video file {full_path}: {e}")

    # 3. Delete database record
    await db.delete(feed)
    await db.commit()
    return {"status": "success", "detail": f"Feed '{feed_id}' has been removed."}


@router.delete("/{id}", status_code=status.HTTP_200_OK)
async def delete_camera(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_tenant_db)
):
    """Delete a camera, its feeds, and files on disk."""
    # 1. Fetch camera
    stmt = select(Camera).where(Camera.id == id)
    result = await db.execute(stmt)
    camera = result.scalar_one_or_none()
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with ID '{id}' not found."
        )

    # 2. Fetch all feeds for this camera to delete files
    stmt_feeds = select(CameraFeed).where(CameraFeed.camera_id == id)
    res_feeds = await db.execute(stmt_feeds)
    feeds = res_feeds.scalars().all()
    for feed in feeds:
        if feed.file_path:
            full_path = Path(settings.UPLOAD_DIR) / feed.file_path
            if full_path.exists() and full_path.is_file():
                try:
                    full_path.unlink()
                except Exception as e:
                    logger.error(f"Failed to delete video file {full_path}: {e}")
        await db.delete(feed)

    # 3. Delete camera record
    await db.delete(camera)
    await db.commit()
    return {"status": "success", "detail": f"Camera '{id}' and all associated feeds have been deleted."}

