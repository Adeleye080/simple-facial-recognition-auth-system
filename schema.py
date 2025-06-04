"""Pydantic Models"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from fastapi import UploadFile, File


class FaceEnrollmentResponse(BaseModel):
    success: bool
    message: str
    user_id: str
    timestamp: datetime


class FaceVerificationRequest(BaseModel):
    event: str = Field(..., description="Event type requiring authentication")
    token: str = Field(..., description="JWT token from the requesting service")
    facial_data: str = Field(..., description="Base64 encoded facial image data")


class FaceVerificationResponse(BaseModel):
    success: bool
    message: str
    user_id: Optional[str] = None
    event: str
    confidence: Optional[float] = None
    timestamp: datetime


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    enrolled_users: int


class ErrorResponse(BaseModel):
    error: str
    message: str
    timestamp: datetime
