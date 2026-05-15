from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440
    ANTHROPIC_API_KEY: str
    SUPERUSER_EMAIL: str = "admin@finbridge.com"
    SUPERUSER_PASSWORD: str = "Admin@123"
    UPLOAD_DIR: str = "uploads"
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
