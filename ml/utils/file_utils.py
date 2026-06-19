"""
File storage utilities.

Handles saving snapshots and video clips to the local uploads/ directory.
All paths stored in the database are relative (e.g. 'uploads/images/...').
"""

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from ml.config import settings

logger = logging.getLogger(__name__)


def _ensure_dir(path: Path) -> None:
    """Create directory and parents if they don't exist."""
    path.mkdir(parents=True, exist_ok=True)


def save_snapshot(
    image: np.ndarray,
    category: str,
    prefix: str = "",
    format: str = ".jpg",
    tenant_id: str = None,
) -> str:
    """Save an image snapshot to uploads/tenants/{tenant_id}/{category}/.

    Args:
        image: BGR numpy array to save.
        category: Subdirectory (e.g. 'incidents', 'images', 'enrollments').
        prefix: Optional filename prefix.
        format: Image format extension.
        tenant_id: Required tenant UUID string.

    Returns:
        Absolute path string of the saved file.
    """
    if not tenant_id:
        raise ValueError("tenant_id is required for save_snapshot")
    
    save_dir = settings.tenant_dir(tenant_id, category)
    _ensure_dir(save_dir)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    filename = f"{prefix}_{timestamp}_{unique_id}{format}" if prefix else f"{timestamp}_{unique_id}{format}"

    filepath = save_dir / filename
    success = cv2.imwrite(str(filepath), image)

    if not success:
        raise IOError(f"Failed to save snapshot to {filepath}")

    logger.debug(f"Saved snapshot: {filepath}")
    return str(filepath)


def save_video_clip(
    frames: list[np.ndarray],
    category: str,
    fps: float = 15.0,
    prefix: str = "",
    tenant_id: str = None,
) -> str:
    """Save a list of frames as an MP4 to uploads/tenants/{tenant_id}/{category}/.

    Args:
        frames: List of BGR numpy arrays (all same shape).
        category: Subdirectory (e.g. 'videos').
        fps: Frames per second.
        prefix: Optional filename prefix.
        tenant_id: Required tenant UUID string.

    Returns:
        Absolute path string of the saved file.
    """
    if not frames:
        raise ValueError("Cannot save empty frame list as video clip")
    if not tenant_id:
        raise ValueError("tenant_id is required for save_video_clip")

    save_dir = settings.tenant_dir(tenant_id, category)
    _ensure_dir(save_dir)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    filename = f"{prefix}_{timestamp}_{unique_id}.mp4" if prefix else f"{timestamp}_{unique_id}.mp4"

    filepath = save_dir / filename
    h, w = frames[0].shape[:2]
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(filepath), fourcc, fps, (w, h))

    try:
        for frame in frames:
            writer.write(frame)
    finally:
        writer.release()

    logger.debug(f"Saved video clip ({len(frames)} frames): {filepath}")
    return str(filepath)
