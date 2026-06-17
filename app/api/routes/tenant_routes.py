from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_session
from app.schemas.tenant import TenantCreate, TenantRead
from app.services import tenant_service

router = APIRouter()


@router.post("/", response_model=TenantRead, status_code=status.HTTP_201_CREATED)
async def create_tenant(data: TenantCreate, db: AsyncSession = Depends(get_session)):
    """Create a new tenant and dynamically provision their schema and database tables asynchronously."""
    existing = await tenant_service.get_tenant_by_id(db, data.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tenant ID '{data.id}' is already registered."
        )
    try:
        return await tenant_service.create_tenant(db, data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to provision tenant: {str(e)}"
        )


@router.get("/", response_model=list[TenantRead])
async def list_tenants(db: AsyncSession = Depends(get_session)):
    """Retrieve all tenants in the system."""
    return await tenant_service.list_tenants(db)
