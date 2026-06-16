from sqlalchemy.orm import Session
from app.repositories import user_repository
from app.schemas.user import UserCreate, UserRead


def list_users(db: Session) -> list[UserRead]:
    return user_repository.get_all(db)


def create_user(db: Session, data: UserCreate) -> UserRead:
    return user_repository.create(db, data)
