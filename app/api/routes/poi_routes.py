import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_tenant_db
from app.schemas.poi import POICreate, POIRead
from app.models.poi import POI

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
        reid_embedding=data.reid_embedding
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
