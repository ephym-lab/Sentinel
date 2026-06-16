"""
Image processing utilities.

Face alignment, cropping, resizing, and base64 encoding/decoding
used across all ML model wrappers.
"""

import base64
import io
import logging
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def decode_base64_image(b64_string: str) -> np.ndarray:
    """Decode a base64-encoded image string to a numpy array (BGR).

    Handles both raw base64 and data URI format (data:image/...;base64,...).
    """
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]

    image_bytes = base64.b64decode(b64_string)
    np_array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(np_array, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Failed to decode base64 image — invalid image data")

    return image


def encode_image_to_base64(image: np.ndarray, format: str = ".jpg") -> str:
    """Encode a BGR numpy image to a base64 string."""
    success, buffer = cv2.imencode(format, image)
    if not success:
        raise ValueError(f"Failed to encode image to {format}")
    return base64.b64encode(buffer).decode("utf-8")


def resize_frame(frame: np.ndarray, max_width: int = 1280) -> np.ndarray:
    """Resize a frame to fit within max_width while preserving aspect ratio.

    Returns the original frame if it's already within the limit.
    """
    h, w = frame.shape[:2]
    if w <= max_width:
        return frame

    scale = max_width / w
    new_w = max_width
    new_h = int(h * scale)
    return cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LINEAR)


def align_and_crop_face(
    frame: np.ndarray,
    bbox: tuple[int, int, int, int],
    landmarks: Optional[np.ndarray] = None,
    target_size: int = 112,
) -> np.ndarray:
    """Crop and align a face from a frame using bounding box and optional landmarks.

    Args:
        frame: Full BGR image.
        bbox: (x1, y1, x2, y2) face bounding box coordinates.
        landmarks: Optional 5-point facial landmarks for alignment.
                   Shape: (5, 2) — left_eye, right_eye, nose, left_mouth, right_mouth.
        target_size: Output face size (square).

    Returns:
        Aligned, cropped face resized to (target_size, target_size).
    """
    x1, y1, x2, y2 = bbox

    if landmarks is not None and len(landmarks) >= 2:
        # Align using eye centers
        left_eye = landmarks[0]
        right_eye = landmarks[1]

        # Calculate angle between eyes
        dy = right_eye[1] - left_eye[1]
        dx = right_eye[0] - left_eye[0]
        angle = np.degrees(np.arctan2(dy, dx))

        # Get rotation center (midpoint of eyes)
        eye_center = (
            (left_eye[0] + right_eye[0]) / 2,
            (left_eye[1] + right_eye[1]) / 2,
        )

        # Rotate the full image
        rotation_matrix = cv2.getRotationMatrix2D(eye_center, angle, scale=1.0)
        h, w = frame.shape[:2]
        rotated = cv2.warpAffine(frame, rotation_matrix, (w, h), flags=cv2.INTER_LINEAR)

        # Crop from rotated image
        face_crop = rotated[max(0, y1):y2, max(0, x1):x2]
    else:
        # Simple crop without alignment
        face_crop = frame[max(0, y1):y2, max(0, x1):x2]

    if face_crop.size == 0:
        raise ValueError("Empty face crop — bounding box may be out of frame bounds")

    return cv2.resize(face_crop, (target_size, target_size), interpolation=cv2.INTER_LINEAR)


def expand_bbox(
    bbox: tuple[int, int, int, int],
    frame_shape: tuple[int, int],
    margin: float = 0.2,
) -> tuple[int, int, int, int]:
    """Expand a bounding box by a margin percentage, clamped to frame bounds.

    Useful for getting a slightly larger crop around a face or person.
    """
    x1, y1, x2, y2 = bbox
    h, w = frame_shape[:2]

    bw = x2 - x1
    bh = y2 - y1

    x1 = max(0, int(x1 - bw * margin))
    y1 = max(0, int(y1 - bh * margin))
    x2 = min(w, int(x2 + bw * margin))
    y2 = min(h, int(y2 + bh * margin))

    return x1, y1, x2, y2
