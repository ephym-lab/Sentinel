from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories import user_repository
from app.schemas.user import UserCreate
from app.models.user import User


async def list_users(db: AsyncSession) -> list[User]:
    """List all users asynchronously."""
    return await user_repository.get_all(db)


async def create_user(db: AsyncSession, data: UserCreate) -> User:
    """Create a user asynchronously."""
    return await user_repository.create(db, data)
