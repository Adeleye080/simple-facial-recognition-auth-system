"""Configuration Module."""

from os import getenv
from pydantic_settings import BaseSettings
from decouple import config


class Settings(BaseSettings):
    SECRET_KEY: str = config(
        "JWT_SECRET_KEY", default="your-secret-key-change-this", cast=str
    )
    ALGORITHM: str = config("ALGORITHM", default="HS256", cast=str)
    FACE_ENCODINGS_FILE: str = "face_encodings.pkl"
    FACE_TOLERANCE: float = config("FACE_TOLERANCE", default="0.6", cast=float)
    MIN_CONFIDENCE: float = config("MIN_CONFIDENCE", default="0.4", cast=float)
    MAX_FILE_SIZE: int = config("MAX_FILE_SIZE", default="5242880", cast=int)  # 5MB
    ALLOWED_EVENTS: set = config(
        "ALLOWED_EVENTS",
        cast=set,
        default={
            "login-event",
            "transaction-event",
            "payment-event",
            "admin-event",
            "sensitive-operation",
        },
    )


settings = Settings()
