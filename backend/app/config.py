"""
FastAPI Backend Configuration
Loads variables from .env
"""
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    MYSQL_DATABASE_URL: str
    JWT_SECRET_KEY: str
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()  # type: ignore[call-arg]
