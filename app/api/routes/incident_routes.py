import datetime
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_tenant_db
from app.schemas.incident import IncidentRead, IncidentResolve
from app.models.incident import Incident

router = APIRouter()


@router.get("/", response_model=list[IncidentRead])
async def list_incidents(
    is_resolved: Optional[bool] = None,
    db: AsyncSession = Depends(get_tenant_db)
):
    """Retrieve all incidents for this tenant, filtering by resolution status asynchronously."""
    stmt = select(Incident)
    if is_resolved is not None:
        if is_resolved:
            stmt = stmt.where(Incident.status == "resolved")
        else:
            stmt = stmt.where(Incident.status != "resolved")
            
    stmt = stmt.order_by(Incident.triggered_at.desc())
    
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{incident_id}", response_model=IncidentRead)
async def get_incident(incident_id: str, db: AsyncSession = Depends(get_tenant_db)):
    """Retrieve details for a specific incident asynchronously."""
    try:
        incident_uuid = uuid.UUID(incident_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incident ID '{incident_id}' is not a valid UUID."
        )

    stmt = select(Incident).where(Incident.id == incident_uuid)
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found."
        )
    return incident


@router.put("/{incident_id}/resolve", response_model=IncidentRead)
async def resolve_incident(
    incident_id: str,
    data: IncidentResolve,
    db: AsyncSession = Depends(get_tenant_db)
):
    """Mark an active incident as resolved and record notes asynchronously."""
    try:
        incident_uuid = uuid.UUID(incident_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incident ID '{incident_id}' is not a valid UUID."
        )

    stmt = select(Incident).where(Incident.id == incident_uuid)
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found."
        )
    
    if incident.status == "resolved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incident is already resolved."
        )
        
    incident.status = "resolved"
    incident.resolved_at = datetime.datetime.now(datetime.timezone.utc)
    
    if data.resolution_notes:
        note_str = f" [Resolved: {data.resolution_notes}]"
        # Since Incident might not have a description column in the database,
        # wait! Does Incident have description or title?
        # Let's check Incident model in app/models/incident.py: it has "title" but not "description".
        # So we can append it to the title, or not touch title.
        # Let's just update the status and resolved_at, or store notes in a separate field if available,
        # but since we don't have description, appending to title is fine, or we can just ignore note_str.
        # Let's just update title with the resolution status note if desired, or skip it.
        # Actually, let's keep it simple: update title or just status.
        incident.title = f"{incident.title} (Resolved: {data.resolution_notes})"

    await db.commit()
    await db.refresh(incident)
    return incident
