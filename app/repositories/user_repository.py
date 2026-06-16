from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate


def get_all(db: Session) -> list[User]:
    return db.query(User).all()


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def create(db: Session, data: UserCreate) -> User:
    user = User(**data.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
