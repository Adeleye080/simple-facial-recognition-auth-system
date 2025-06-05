"""
FastAPI Facial Recognition Authentication Service
A microservice for face-based authentication and authorization.
"""

from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import logging
from datetime import datetime, timezone, timedelta
import uvicorn
from contextlib import asynccontextmanager
import time
from log_config import setup_logging
from settings import settings
from utils import decode_base64_image, validate_image_size
from schema import (
    FaceEnrollmentResponse,
    FaceVerificationRequest,
    FaceVerificationResponse,
    HealthResponse,
    ErrorResponse,
)
from services import security, face_service, jwt_service


# configure logger
setup_logging()

logger = logging.getLogger(__name__)


# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Facial Recognition Authentication Service")
    yield
    # Shutdown
    logger.info("Shutting down Facial Recognition Authentication Service")


app = FastAPI(
    title="Facial Recognition Authentication Service",
    description="Microservice for face-based authentication and authorization",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(tz=timezone.utc),
        enrolled_users=face_service.get_enrolled_users_count(),
    )


@app.post("/api/enroll", response_model=FaceEnrollmentResponse)
async def enroll_face(
    user_id: str,
    file: UploadFile = File(..., description="Face image file"),
):
    """Enroll a face for a user."""
    try:
        # Validate file type
        if not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an image"
            )

        # Read file data
        image_data = await file.read()

        # Validate file size
        if not validate_image_size(image_data):
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Image size must be less than {settings.MAX_FILE_SIZE} bytes",
            )

        # Add face encoding
        success = await face_service.add_face_encoding(user_id, image_data)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to process face image. Ensure image contains exactly one clear face.",
            )

        return FaceEnrollmentResponse(
            success=True,
            message="Face enrolled successfully",
            user_id=user_id,
            timestamp=datetime.now(tz=timezone.utc),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in face enrollment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during face enrollment",
        )


@app.post("/api/verify", response_model=FaceVerificationResponse)
async def verify_face(request: FaceVerificationRequest):
    """Verify face for authentication."""
    start_time = time.time()
    try:
        # Validate event type
        if request.event not in settings.ALLOWED_EVENTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid event type. Allowed events: {list(settings.ALLOWED_EVENTS)}",
            )

        # Decode and validate JWT token
        try:
            token_payload = jwt_service.decode_token(request.token)
            user_id = token_payload.get("user_id") or token_payload.get("sub")

            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Token must contain user_id or sub field",
                )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format"
            )

        # Decode facial data
        try:
            image_data = decode_base64_image(request.facial_data)
        except HTTPException:
            raise

        # Validate image size
        if not validate_image_size(image_data):
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Image size must be less than {settings.MAX_FILE_SIZE} bytes",
            )

        # Verify face
        is_match, confidence = await face_service.verify_face(user_id, image_data)

        if is_match:
            logger.info(
                f"Face verification successful for user {user_id} on event {request.event}"
            )

            stop_time = time.time()
            time_taken = f"{stop_time - start_time:.2f}"
            (
                print(
                    "\033[91m"
                    + f"FaceAuth: Time taken to verify face: {time_taken}"
                    + "\033[0m",
                    flush=True,
                )
                if float(time_taken) > 1
                else print(
                    "\033[92m"
                    + f"FaceAuth: Time taken to verify face: {time_taken}"
                    + "\033[0m",
                    flush=True,
                )
            )

            return FaceVerificationResponse(
                success=True,
                message="Face verification successful",
                user_id=user_id,
                event=request.event,
                confidence=confidence,
                timestamp=datetime.now(tz=timezone.utc),
            )
        else:
            logger.warning(
                f"Face verification failed for user {user_id} on event {request.event}"
            )
            return FaceVerificationResponse(
                success=False,
                message="Face verification failed",
                user_id=user_id,
                event=request.event,
                confidence=confidence,
                timestamp=datetime.now(tz=timezone.utc),
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in face verification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during face verification",
        )


@app.delete("/api/enroll/{user_id}")
async def delete_user_face(user_id: str):
    """Delete face encodings for a user."""
    try:
        if user_id in face_service.face_encodings:
            del face_service.face_encodings[user_id]
            await face_service.save_encodings()
            logger.info(f"Deleted face encodings for user {user_id}")
            return {"message": f"Face encodings deleted for user {user_id}"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No face encodings found for user {user_id}",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting face encodings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during deletion",
        )


@app.get("/api/users")
async def list_enrolled_users():
    """List all enrolled users."""
    try:
        users = list(face_service.face_encodings.keys())
        return {
            "enrolled_users": users,
            "count": len(users),
            "timestamp": datetime.now(tz=timezone.utc),
        }
    except Exception as e:
        logger.error(f"Error listing users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return ErrorResponse(
        error="internal_server_error",
        message="An unexpected error occurred",
        timestamp=datetime.now(tz=timezone.utc),
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
