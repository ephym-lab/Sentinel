import uuid
import datetime
import math
import random
from typing import Optional
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
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
    
    # Save image file to local storage
    # Directory structure: uploads/tenants/tenant_<tenant_id>/images/
    # For now we'll put it in shared_enrollments/images or if tenant_id was available it would be there.
    # But since there is no x_tenant_id passed, we'll keep shared_enrollments but change folder to images.
    rel_path = file_manager.save_file(
        tenant_id="shared_enrollments",
        camera_id="enrollment_station",
        incident_type="images",
        file_bytes=image_bytes,
        extension=file.filename.split(".")[-1] if "." in file.filename else "jpg",
        prefix=f"person_{person_id}"
    )
    
    # Generate dummy L2-normalized 512-dim embedding for MVP fallback
    raw_emb = [random.uniform(-1.0, 1.0) for _ in range(512)]
    norm = math.sqrt(sum(x*x for x in raw_emb))
    embedding = [x / norm for x in raw_emb]
    
    # Update person
    person.photo_path = rel_path
    person.face_embedding = embedding
    await db.commit()
    await db.refresh(person)
    
    return PersonRead.model_validate(person)


@router.post("/identify", response_model=dict)
async def identify_person_from_face(request: IdentifyRequest, db: AsyncSession = Depends(get_tenant_db)):
    """Identify a person from a face crop embedding comparison."""
    # Decode image crop and generate dummy embedding for identification fallback
    raw_emb = [random.uniform(-1.0, 1.0) for _ in range(512)]
    norm = math.sqrt(sum(x*x for x in raw_emb))
    query_embedding = [x / norm for x in raw_emb]
    
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
