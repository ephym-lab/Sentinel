"""
Person Re-Identification using OSNet (torchreid).

Extracts 256/512-dim body appearance embeddings from person crops.
Used for tracking the same person across multiple cameras and matching
against POI (Persons of Interest) body signatures.

OSNet (Omni-Scale Network) is a compact, efficient Re-ID model:
  - osnet_x0_25: lightest, CPU-optimized (dev)
  - osnet_x1_0:  full accuracy (prod)

Unlike face recognition (ArcFace), Re-ID works even when the face
is not visible — identifies by clothing, body shape, and gait.
"""

import logging
import time
from pathlib import Path
from typing import Optional

import numpy as np

from ml.config import settings

logger = logging.getLogger(__name__)


class ReIDExtractor:
    """OSNet body Re-Identification embedding extractor via torchreid.

    Returns 512-dim normalized embeddings per person crop.
    Embeddings can be stored in pgvector for fast cosine similarity search.
    """

    def __init__(self):
        import torchreid

        self.device = settings.DEVICE
        self.model_name = settings.OSNET_MODEL

        # Build model from torchreid model zoo (auto-downloads weights)
        self.model = torchreid.models.build_model(
            name=self.model_name,
            num_classes=1000,  # ImageNet pretraining
            pretrained=True,
        )
        self.model.eval()

        if self.device == "cuda":
            import torch
            self.model = self.model.cuda()

        logger.info(f"Loaded ReIDExtractor: {self.model_name} on {self.device}")

    def _preprocess(self, person_crop: np.ndarray) -> "torch.Tensor":
        """Resize and normalize person crop to OSNet input format."""
        import cv2
        import torch

        # OSNet expects (256, 128) RGB image normalized to ImageNet stats
        resized = cv2.resize(person_crop, (128, 256))
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)

        # Normalize: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        img = rgb.astype(np.float32) / 255.0
        img = (img - mean) / std

        # (H, W, C) → (1, C, H, W)
        tensor = torch.from_numpy(img.transpose(2, 0, 1)).unsqueeze(0)

        if self.device == "cuda":
            tensor = tensor.cuda()

        return tensor

    def extract(self, person_crop: np.ndarray) -> Optional[np.ndarray]:
        """Extract Re-ID embedding from a person crop.

        Args:
            person_crop: BGR image of a single person (any size, will be resized).

        Returns:
            512-dim L2-normalized embedding, or None if crop is too small.
        """
        import torch

        if person_crop is None or person_crop.size == 0:
            return None

        h, w = person_crop.shape[:2]
        if h < 32 or w < 16:
            logger.debug(f"Person crop too small ({w}x{h}) for Re-ID")
            return None

        start = time.perf_counter()

        tensor = self._preprocess(person_crop)

        with torch.no_grad():
            features = self.model(tensor)  # (1, embed_dim)

        # L2 normalize
        features = features.squeeze(0)
        norm = torch.norm(features, p=2)
        embedding = (features / (norm + 1e-12)).cpu().numpy()

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.debug(f"ReID embed: {embedding.shape[0]}-dim in {elapsed_ms:.1f}ms")

        return embedding

    def extract_batch(self, crops: list[np.ndarray]) -> list[Optional[np.ndarray]]:
        """Extract Re-ID embeddings for multiple person crops in one batch.

        More efficient than calling extract() in a loop for large crowds.

        Args:
            crops: List of BGR person crop arrays.

        Returns:
            List of embeddings (or None for invalid/tiny crops).
        """
        import torch

        valid_indices = []
        tensors = []

        for i, crop in enumerate(crops):
            if crop is not None and crop.size > 0:
                h, w = crop.shape[:2]
                if h >= 32 and w >= 16:
                    tensors.append(self._preprocess(crop))
                    valid_indices.append(i)

        results: list[Optional[np.ndarray]] = [None] * len(crops)

        if not tensors:
            return results

        start = time.perf_counter()

        batch = torch.cat(tensors, dim=0)  # (N, C, H, W)
        with torch.no_grad():
            features = self.model(batch)  # (N, embed_dim)

        # L2 normalize each row
        norms = torch.norm(features, p=2, dim=1, keepdim=True)
        embeddings = (features / (norms + 1e-12)).cpu().numpy()

        for local_idx, global_idx in enumerate(valid_indices):
            results[global_idx] = embeddings[local_idx]

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.debug(f"ReID batch: {len(tensors)} crops in {elapsed_ms:.1f}ms")

        return results

    def compute_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Cosine similarity between two Re-ID embeddings (both L2-normalized)."""
        return float(np.dot(emb1, emb2))
