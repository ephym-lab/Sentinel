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
) -> str:
    """Save an image snapshot to uploads/images/{category}/.

    Args:
        image: BGR numpy array to save.
        category: Subdirectory under images/ (e.g. 'faces', 'events', 'poi', 'shoplifting').
        prefix: Optional filename prefix for readability.
        format: Image format extension.

    Returns:
        Relative path string (e.g. 'uploads/images/faces/face_2026-06-16_abc123.jpg').
    """
    save_dir = settings.images_dir / category
    _ensure_dir(save_dir)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    filename = f"{prefix}_{timestamp}_{unique_id}{format}" if prefix else f"{timestamp}_{unique_id}{format}"

    filepath = save_dir / filename
    success = cv2.imwrite(str(filepath), image)

    if not success:
        raise IOError(f"Failed to save snapshot to {filepath}")

    relative_path = str(filepath)
    logger.debug(f"Saved snapshot: {relative_path}")
    return relative_path


def save_video_clip(
    frames: list[np.ndarray],
    category: str,
    fps: float = 15.0,
    prefix: str = "",
) -> str:
    """Save a list of frames as an MP4 video clip to uploads/videos/{category}/.

    Args:
        frames: List of BGR numpy arrays (all same shape).
        category: Subdirectory under videos/ (e.g. 'events', 'poi', 'shoplifting').
        fps: Frames per second for the output clip.
        prefix: Optional filename prefix.

    Returns:
        Relative path string (e.g. 'uploads/videos/events/fight_2026-06-16_abc123.mp4').
    """
    if not frames:
        raise ValueError("Cannot save empty frame list as video clip")

    save_dir = settings.videos_dir / category
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

    relative_path = str(filepath)
    logger.debug(f"Saved video clip ({len(frames)} frames): {relative_path}")
    return relative_path
