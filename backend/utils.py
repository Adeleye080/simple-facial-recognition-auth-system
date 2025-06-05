"""Utility Functions Module"""

import base64
from fastapi import HTTPException, status
from settings import settings


def decode_base64_image(base64_string: str) -> bytes:
    """Decode base64 image string to bytes."""
    try:
        # Remove data URL prefix if present
        if base64_string.startswith("data:image"):
            base64_string = base64_string.split(",")[1]

        return base64.b64decode(base64_string)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid base64 image data: {str(e)}",
        )


def validate_image_size(image_data: bytes) -> bool:
    """Validate image size."""
    return len(image_data) <= settings.MAX_FILE_SIZE
