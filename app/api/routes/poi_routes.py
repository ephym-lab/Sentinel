import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_tenant_db
from app.schemas.poi import POICreate, POIRead, POISightingRead
from app.models.poi import POI
from app.models.poi_sighting import POISighting
from app.models.camera import Camera

router = APIRouter()


@router.post("/", response_model=POIRead, status_code=status.HTTP_201_CREATED)
async def create_poi(data: POICreate, db: AsyncSession = Depends(get_tenant_db)):
    """Register a new Person of Interest with face or Re-ID vector embeddings asynchronously."""
    poi_uuid = data.id

    stmt = select(POI).where(POI.id == poi_uuid)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"POI ID '{data.id}' is already registered."
        )
    
    poi = POI(
        id=poi_uuid,
        label=data.name,
        reason=data.notes,
        face_embedding=data.face_embedding,
        reid_embedding=data.reid_embedding,
        target_cameras=data.target_cameras,
        photo_path=data.photo_path
    )
    db.add(poi)
    await db.commit()
    await db.refresh(poi)
    return POIRead.model_validate(poi)


@router.get("/", response_model=list[POIRead])
async def list_pois(db: AsyncSession = Depends(get_tenant_db)):
    """List all registered Persons of Interest for the tenant."""
    stmt = select(POI)
    result = await db.execute(stmt)
    pois = result.scalars().all()
    return [POIRead.model_validate(p) for p in pois]


@router.get("/{poi_id}/sightings", response_model=list[POISightingRead])
async def get_poi_sightings(poi_id: uuid.UUID, db: AsyncSession = Depends(get_tenant_db)):
    """Fetch sighting history for a specific POI."""
    stmt = (
        select(POISighting, Camera.name.label("camera_name"))
        .outerjoin(Camera, POISighting.camera_id == Camera.id)
        .where(POISighting.poi_id == poi_id)
        .order_by(POISighting.spotted_at.desc())
        .limit(50)
    )
    result = await db.execute(stmt)
    rows = result.all()
    
    sightings = []
    for sighting, camera_name in rows:
        data = sighting.__dict__.copy()
        data["camera_name"] = camera_name or "Unknown Camera"
        sightings.append(POISightingRead.model_validate(data))
        
    return sightings
