"""
Face recognizer using ArcFace via InsightFace.

Generates 512-dimensional face embeddings for identity matching.
Used for:
- Person identification (matching against enrolled persons in DB)
- POI matching (matching against persons of interest)
- Blacklist checking (supermarket mode)
- Lost child recovery (mall mode)
"""

import logging
import time
from typing import Optional

import numpy as np

from ml.config import settings

logger = logging.getLogger(__name__)


class FaceRecognizer:
    """ArcFace-based face recognizer via InsightFace library.

    Generates 512-dim embeddings from aligned face crops.
    Supports both buffalo_sc (lightweight, CPU) and buffalo_l (full, GPU).
    """

    def __init__(self):
        import insightface
        from insightface.app import FaceAnalysis

        self.device = settings.DEVICE
        self.model_name = settings.ARCFACE_MODEL
        self.threshold = settings.FACE_RECOGNITION_THRESHOLD

        # InsightFace FaceAnalysis bundles detection + recognition + landmarks
        # We primarily use it for embedding extraction from pre-cropped faces,
        # but it can also detect + align faces from full frames
        providers = ["CUDAExecutionProvider"] if self.device == "cuda" else ["CPUExecutionProvider"]

        self.app = FaceAnalysis(
            name=self.model_name,
            providers=providers,
        )
        self.app.prepare(ctx_id=0 if self.device == "cuda" else -1, det_size=(640, 640))

        logger.info(f"Loaded ArcFace recognizer: {self.model_name} on {self.device}")

    def get_embedding(self, face_crop: np.ndarray) -> Optional[np.ndarray]:
        """Extract 512-dim embedding from a face crop.

        Args:
            face_crop: BGR face image (ideally 112x112 aligned).

        Returns:
            512-dim normalized embedding as numpy array, or None if no face found.
        """
        start = time.perf_counter()

        # InsightFace expects a full image and detects faces within it
        # For a pre-cropped face, it should find exactly one
        faces = self.app.get(face_crop)

        if not faces:
            logger.debug("No face found in crop for embedding extraction")
            return None

        # Take the largest / highest confidence face
        face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        embedding = face.normed_embedding  # 512-dim, L2 normalized

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.debug(f"Embedding extracted in {elapsed_ms:.1f}ms")

        return embedding

    def get_embedding_from_frame(self, frame: np.ndarray) -> list[dict]:
        """Detect all faces in a full frame and extract embeddings.

        Useful for enrollment — takes a photo and returns all face embeddings.

        Args:
            frame: Full BGR image.

        Returns:
            List of dicts with:
            {
                "embedding": np.ndarray (512,),
                "bbox": (x1, y1, x2, y2),
                "landmarks": np.ndarray (5, 2) or None,
                "det_score": float
            }
        """
        start = time.perf_counter()

        faces = self.app.get(frame)
        results = []

        for face in faces:
            results.append({
                "embedding": face.normed_embedding,
                "bbox": tuple(face.bbox.astype(int)),
                "landmarks": face.landmark_2d_106 if hasattr(face, "landmark_2d_106") else None,
                "kps": face.kps if hasattr(face, "kps") else None,  # 5-point landmarks
                "det_score": float(face.det_score),
            })

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.debug(f"Frame embedding extraction: {len(results)} faces in {elapsed_ms:.1f}ms")

        return results

    def compute_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Compute cosine similarity between two face embeddings.

        Args:
            embedding1: 512-dim normalized embedding.
            embedding2: 512-dim normalized embedding.

        Returns:
            Cosine similarity score (0.0 to 1.0).
        """
        # Both embeddings are L2-normalized, so dot product = cosine similarity
        similarity = float(np.dot(embedding1, embedding2))
        return max(0.0, min(1.0, similarity))

    def is_match(self, embedding1: np.ndarray, embedding2: np.ndarray) -> tuple[bool, float]:
        """Check if two embeddings represent the same person.

        Returns:
            Tuple of (is_match: bool, similarity_score: float).
        """
        score = self.compute_similarity(embedding1, embedding2)
        return score >= self.threshold, score
