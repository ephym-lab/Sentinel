from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_session, reusable_oauth2
from app.schemas.user import UserCreate, UserRead
from app.services import user_service
from app.core.security import decode_access_token

router = APIRouter()


@router.get("/", response_model=list[UserRead])
async def list_users(db: AsyncSession = Depends(get_session)):
    """Retrieve all users asynchronously."""
    return await user_service.list_users(db)


@router.post("/", response_model=UserRead, status_code=201)
async def create_user(
    data: UserCreate, 
    db: AsyncSession = Depends(get_session),
    token: Optional[HTTPAuthorizationCredentials] = Depends(reusable_oauth2)
):
    """Create a new user asynchronously."""
    if data.role == "super_admin":
        users = await user_service.list_users(db)
        if len(users) > 0:
            if not token:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot create a super_admin without existing super_admin privileges."
                )
            payload = decode_access_token(token.credentials)
            if not payload or payload.get("role") != "super_admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot create a super_admin without existing super_admin privileges."
                )
    return await user_service.create_user(db, data)

