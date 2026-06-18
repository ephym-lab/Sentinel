import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.schemas.user import UserCreate


async def get_all(db: AsyncSession) -> list[User]:
    """Retrieve all users in the system asynchronously."""
    stmt = select(User)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    """Retrieve a single user by their UUID asynchronously."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    """Retrieve a user by email asynchronously."""
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create(db: AsyncSession, data: UserCreate) -> User:
    """Create a new user asynchronously. Hashes the password using pwd_context."""
    from app.core.security import hash_password
    password_hash = hash_password(data.password) if data.password else None
    
    user = User(
        name=data.name,
        email=data.email,
        password_hash=password_hash,
        role=data.role,
        tenant_id=data.tenant_id
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update(db: AsyncSession, user: User, data: "UserUpdate") -> User:
    """Update a user's profile asynchronously."""
    if data.name is not None:
        user.name = data.name
    if data.email is not None:
        user.email = data.email
    if data.password is not None:
        from app.core.security import hash_password
        user.password_hash = hash_password(data.password)

    await db.commit()
    await db.refresh(user)
    return user

