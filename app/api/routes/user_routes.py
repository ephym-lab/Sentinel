from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_session
from app.schemas.user import UserCreate, UserRead
from app.services import user_service

router = APIRouter()


@router.get("/", response_model=list[UserRead])
async def list_users(db: AsyncSession = Depends(get_session)):
    """Retrieve all users asynchronously."""
    return await user_service.list_users(db)


@router.post("/", response_model=UserRead, status_code=201)
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_session)):
    """Create a new user asynchronously."""
    return await user_service.create_user(db, data)
