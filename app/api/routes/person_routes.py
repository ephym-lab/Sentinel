import uuid
import datetime
import math
import random
from typing import Optional
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from app.core.config import settings
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_tenant_db
from app.schemas.person import PersonCreate, PersonRead, IdentifyRequest
from app.models.person import Person
from app.models.journey_event import JourneyEvent
from app.models.poi_sighting import POISighting
from app.utils.file_manager import file_manager
from app.services.surveillance_service import find_poi_match

router = APIRouter()


@router.get("/", response_model=list[PersonRead])
async def list_persons(
    person_type: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_tenant_db)
):
    """List all registered persons with optional type and status filters."""
    stmt = select(Person)
    if person_type:
        stmt = stmt.where(Person.person_type == person_type)
    if status:
        stmt = stmt.where(Person.status == status)
        
    result = await db.execute(stmt)
    persons = result.scalars().all()
    
    # Calculate last seen timestamp for each person
    response_list = []
    for p in persons:
        # Check journey events
        journey_stmt = (
            select(JourneyEvent.detected_at)
            .where(JourneyEvent.student_id == p.id)
            .order_by(desc(JourneyEvent.detected_at))
            .limit(1)
        )
        j_res = await db.execute(journey_stmt)
        last_seen = j_res.scalar_one_or_none()
        
        # Convert to schema
        p_read = PersonRead.model_validate(p)
        p_read.last_seen_at = last_seen
        response_list.append(p_read)
        
    return response_list




@router.get("/{person_id}", response_model=PersonRead)
async def get_person_profile(person_id: str, db: AsyncSession = Depends(get_tenant_db)):
    """Retrieve detailed person profile along with their last seen log timestamp."""
    try:
        person_uuid = uuid.UUID(person_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Person ID '{person_id}' is not a valid UUID."
        )
        
    stmt = select(Person).where(Person.id == person_uuid)
    result = await db.execute(stmt)
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Person '{person_id}' not found."
        )
        
    # Query last sighting
    journey_stmt = (
        select(JourneyEvent.detected_at)
        .where(JourneyEvent.student_id == person_uuid)
        .order_by(desc(JourneyEvent.detected_at))
        .limit(1)
    )
    j_res = await db.execute(journey_stmt)
    last_seen = j_res.scalar_one_or_none()
    
    p_read = PersonRead.model_validate(person)
    p_read.last_seen_at = last_seen
    return p_read


@router.post("/", response_model=PersonRead, status_code=status.HTTP_201_CREATED)
async def create_person(data: PersonCreate, db: AsyncSession = Depends(get_tenant_db)):
    """Create a new person record. Face enrollment must be completed next."""
    stmt = select(Person).where(Person.identifier == data.identifier)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Identifier '{data.identifier}' already registered."
        )
        
    person = Person(
        id=uuid.uuid4(),
        full_name=data.full_name,
        person_type=data.person_type,
        identifier=data.identifier,
        class_grade=data.class_grade,
        dormitory=data.dormitory,
        status=data.status
    )
    db.add(person)
    await db.commit()
    await db.refresh(person)
    return PersonRead.model_validate(person)


@router.post("/{person_id}/face", response_model=PersonRead)
async def upload_face_photo(
    person_id: str,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Upload enrollment photo, extract face embedding, and update profile."""
    try:
        person_uuid = uuid.UUID(person_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Person ID '{person_id}' is not a valid UUID."
        )
        
    stmt = select(Person).where(Person.id == person_uuid)
    result = await db.execute(stmt)
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(
            status_code=status.HTTP_444_NOT_FOUND if hasattr(status, "HTTP_444_NOT_FOUND") else 404,
            detail=f"Person '{person_id}' not found."
        )
        
    # Read image bytes
    image_bytes = await file.read()
    import base64
    import httpx
    image_b64 = base64.b64encode(image_bytes).decode('utf-8')
    
    # Hit ML service for face embedding and enrollment photo saving
    tenant_id_header = request.headers.get("x-tenant-id")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post("http://localhost:8001/face/enroll-embedding", json={
                "image_b64": image_b64,
                "person_id": str(person_uuid),
                "tenant_id": tenant_id_header
            }, timeout=30.0)
            resp.raise_for_status()
            ml_data = resp.json()
        except httpx.HTTPStatusError as e:
            detail = e.response.json().get("detail", str(e))
            raise HTTPException(status_code=400, detail=f"ML Service error: {detail}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to communicate with ML service: {str(e)}")
            
    embedding = ml_data["embedding"]
    snapshot_path = ml_data.get("snapshot_path")
    
    # Update person
    person.face_embedding = embedding
    if snapshot_path:
        person.photo_path = snapshot_path
        
    await db.commit()
    await db.refresh(person)
    
    return PersonRead.model_validate(person)


@router.post("/identify", response_model=dict)
async def identify_person_from_face(req: IdentifyRequest, request: Request, db: AsyncSession = Depends(get_tenant_db)):
    """Identify a person from a face crop embedding comparison."""
    import httpx
    tenant_id_header = request.headers.get("x-tenant-id")
    # Decode image crop and hit ML service to get actual embedding
    async with httpx.AsyncClient() as client:
        try:
            # We use /recognize if it's already a cropped face, 
            # or /enroll-embedding if it's a full photo. The UI uploads full photo, 
            # so we use /enroll-embedding with a dummy UUID to trigger face detection.
            resp = await client.post("http://localhost:8001/face/enroll-embedding", json={
                "image_b64": req.image_b64,
                "person_id": str(uuid.uuid4()),
                "tenant_id": tenant_id_header
            }, timeout=30.0)
            resp.raise_for_status()
            ml_data = resp.json()
        except httpx.HTTPStatusError as e:
            detail = e.response.json().get("detail", str(e))
            raise HTTPException(status_code=400, detail=f"ML Service error: {detail}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to communicate with ML service: {str(e)}")
            
    query_embedding = ml_data["embedding"]
    
    # Query database for a face match
    poi_column = Person.face_embedding
    if settings.DATABASE_URL.startswith("sqlite"):
        stmt = select(Person)
        res = await db.execute(stmt)
        all_persons = res.scalars().all()
        best_person = None
        best_score = -1.0
        for p in all_persons:
            if p.face_embedding is not None:
                sim = float(np.dot(query_embedding, list(p.face_embedding)))
                if sim > best_score:
                    best_score = sim
                    best_person = p
        match_person, similarity = (best_person, best_score) if best_score >= 0.75 else (None, 0.0)
    else:
        stmt = (
            select(Person, poi_column.cosine_distance(query_embedding).label("distance"))
            .where(poi_column.is_not(None))
            .order_by("distance")
            .limit(1)
        )
        res = await db.execute(stmt)
        row = res.first()
        if row:
            p, dist = row
            sim = 1.0 - dist
            match_person, similarity = (p, sim) if sim >= 0.75 else (None, 0.0)
        else:
            match_person, similarity = None, 0.0
            
    if match_person:
        return {
            "matched": True,
            "confidence": round(similarity, 4),
            "person": PersonRead.model_validate(match_person)
        }
        
    return {"matched": False, "confidence": 0.0, "person": None}
