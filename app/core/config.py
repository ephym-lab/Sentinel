from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "sentinel"
    DATABASE_URL: str = "sqlite+aiosqlite:///./sentinel.db"
    ML_SERVICE_URL: str = "http://localhost:8001"
    UPLOAD_DIR: str = "uploads"
    SECRET_KEY: str = "changeme-in-production"

    REDIS_URL: str = "redis://localhost:6379"
    AT_USERNAME: str = "sentinel"
    AT_API_KEY: str = "changeme"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
