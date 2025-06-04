""" """

from fastapi import HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import face_recognition
import numpy as np
import logging
import jwt
from typing import Dict, List, Any
import os
from settings import settings
import aiofiles
import pickle
import cv2

logger = logging.getLogger(__name__)


# Face Recognition Service
class FaceRecognitionService:
    def __init__(self):
        self.face_encodings: Dict[str, List[np.ndarray]] = {}
        self.load_encodings()

    def load_encodings(self):
        """Load face encodings from disk."""
        try:
            if os.path.exists(settings.FACE_ENCODINGS_FILE):

                async def _load():
                    async with aiofiles.open(settings.FACE_ENCODINGS_FILE, "rb") as f:
                        data = await f.read()
                        return pickle.loads(data)

                # For initialization, use sync approach
                if os.path.exists(settings.FACE_ENCODINGS_FILE):
                    with open(settings.FACE_ENCODINGS_FILE, "rb") as f:
                        self.face_encodings = pickle.load(f)
                    logger.info(
                        f"Loaded encodings for {len(self.face_encodings)} users"
                    )
        except Exception as e:
            logger.error(f"Error loading face encodings: {e}")
            self.face_encodings = {}

    async def save_encodings(self):
        """Save face encodings to disk."""
        try:
            async with aiofiles.open(settings.FACE_ENCODINGS_FILE, "wb") as f:
                data = pickle.dumps(self.face_encodings)
                await f.write(data)
            logger.info("Face encodings saved successfully")
        except Exception as e:
            logger.error(f"Error saving face encodings: {e}")

    async def add_face_encoding(self, user_id: str, image_data: bytes) -> bool:
        """Add face encoding for a user."""
        try:
            # Convert bytes to numpy array
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                logger.error("Failed to decode image")
                return False

            # Convert BGR to RGB
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # Find face encodings
            face_encodings = face_recognition.face_encodings(rgb_image)

            if not face_encodings:
                logger.warning(f"No faces found in image for user {user_id}")
                return False

            if len(face_encodings) > 1:
                logger.warning(
                    f"Multiple faces found for user {user_id}, using the first one"
                )

            # Store encoding
            if user_id not in self.face_encodings:
                self.face_encodings[user_id] = []

            self.face_encodings[user_id].append(face_encodings[0])

            # Keep only the latest 3 encodings per user for better accuracy
            if len(self.face_encodings[user_id]) > 3:
                self.face_encodings[user_id] = self.face_encodings[user_id][-3:]

            await self.save_encodings()
            logger.info(f"Added face encoding for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error adding face encoding for user {user_id}: {e}")
            return False

    async def verify_face(self, user_id: str, image_data: bytes) -> tuple[bool, float]:
        """Verify a face against stored encodings."""
        try:
            if user_id not in self.face_encodings:
                logger.warning(f"No face encodings found for user {user_id}")
                return False, 0.0

            # Convert bytes to numpy array
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                logger.error("Failed to decode verification image")
                return False, 0.0

            # Convert BGR to RGB
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # Find face encodings in the verification image
            face_encodings = face_recognition.face_encodings(rgb_image)

            if not face_encodings:
                logger.warning("No faces found in verification image")
                return False, 0.0

            # Use the first face found
            verification_encoding = face_encodings[0]

            # Compare with stored encodings
            stored_encodings = self.face_encodings[user_id]

            # Calculate distances to all stored encodings
            distances = face_recognition.face_distance(
                stored_encodings, verification_encoding
            )

            # Get the best match
            min_distance = np.min(distances)
            confidence = 1 - min_distance

            # Check if the match is within tolerance
            is_match = (
                min_distance <= settings.FACE_TOLERANCE
                and confidence >= settings.MIN_CONFIDENCE
            )

            logger.info(
                f"Face verification for user {user_id}: match={is_match}, confidence={confidence:.3f}"
            )
            return is_match, confidence

        except Exception as e:
            logger.error(f"Error verifying face for user {user_id}: {e}")
            return False, 0.0

    def get_enrolled_users_count(self) -> int:
        """Get the number of enrolled users."""
        return len(self.face_encodings)


# JWT Service
class JWTService:
    @staticmethod
    def decode_token(token: str) -> Dict[str, Any]:
        """Decode and validate JWT token."""
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired"
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
            )


# Initialize services
face_service = FaceRecognitionService()
jwt_service = JWTService()
security = HTTPBearer()
