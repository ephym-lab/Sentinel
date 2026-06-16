from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_session
from app.schemas.user import UserCreate, UserRead
from app.services import user_service

router = APIRouter()


@router.get("/", response_model=list[UserRead])
def list_users(db: Session = Depends(get_session)):
    return user_service.list_users(db)


@router.post("/", response_model=UserRead, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_session)):
    return user_service.create_user(db, data)
