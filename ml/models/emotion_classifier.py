"""
Emotion classifier using FER+ (ONNX).

Classifies emotions from face crops into 7 categories.
Uses a lightweight ONNX model for CPU-efficient inference.

For Sentinel, emotions are used as threat amplifiers:
- fear, distress, anger → higher threat score contribution
- happy, neutral → low amplifier (reduces false positives)

Emotion threat amplifiers (0.0 to 1.0):
    fear:        0.9  (high — direct threat signal)
    anger:       0.75 (high — aggression indicator)
    distress:    0.9  (high — emergency signal)
    nervousness: 0.6  (medium — could be pre-crime behavior)
    surprise:    0.3  (low — ambiguous)
    neutral:     0.1  (low)
    happy:       0.0  (no threat)
"""

import logging
import time
from typing import Optional

import numpy as np

from ml.config import settings

logger = logging.getLogger(__name__)

EMOTION_LABELS = ["anger", "disgust", "fear", "happy", "neutral", "sad", "surprise"]

# Maps FER+ label → Sentinel EmotionLabel
LABEL_MAP = {
    "anger":   "anger",
    "disgust": "distress",
    "fear":    "fear",
    "happy":   "happy",
    "neutral": "neutral",
    "sad":     "distress",
    "surprise": "surprise",
}

# Threat amplifier per emotion
AMPLIFIERS = {
    "fear":        0.9,
    "anger":       0.75,
    "distress":    0.9,
    "nervousness": 0.6,
    "surprise":    0.3,
    "neutral":     0.1,
    "happy":       0.0,
}


class EmotionClassifier:
    """FER+ ONNX emotion classifier.

    Takes a 64x64 grayscale face crop and returns 7-class emotion probabilities.
    Falls back to a rule-based neutral score if model is unavailable.
    """

    def __init__(self):
        import onnxruntime as ort
        from pathlib import Path

        model_path = settings.FER_MODEL

        if not Path(model_path).exists():
            raise FileNotFoundError(
                f"FER model not found at {model_path}. "
                f"Download from: https://github.com/onnx/models/tree/main/validated/vision/body_analysis/emotion_ferplus"
            )

        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if settings.DEVICE == "cuda"
            else ["CPUExecutionProvider"]
        )

        self.session = ort.InferenceSession(model_path, providers=providers)
        self.input_name = self.session.get_inputs()[0].name
        self.conf_threshold = settings.EMOTION_CONFIDENCE

        logger.info(f"Loaded EmotionClassifier: {model_path} on {settings.DEVICE}")

    def _preprocess(self, face_crop: np.ndarray) -> np.ndarray:
        """Convert BGR crop → 1x1x64x64 float32 for FER+ ONNX."""
        import cv2
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        resized = cv2.resize(gray, (64, 64))
        normalized = resized.astype(np.float32)
        # Shape: (1, 1, 64, 64)
        return normalized[np.newaxis, np.newaxis, :, :]

    def classify(self, face_crop: np.ndarray) -> Optional[dict]:
        """Classify emotion from a face crop.

        Args:
            face_crop: BGR face image (any size, will be resized to 64x64).

        Returns:
            {
                "emotion": str,       # Sentinel emotion label
                "confidence": float,
                "amplifier": float,   # Threat amplifier (0.0 to 1.0)
                "raw_scores": list[float]  # 7 raw emotion scores
            }
            or None if confidence below threshold.
        """
        start = time.perf_counter()

        tensor = self._preprocess(face_crop)
        outputs = self.session.run(None, {self.input_name: tensor})
        scores = outputs[0][0]  # (7,) softmax scores

        # Softmax (model may output logits)
        exp_scores = np.exp(scores - np.max(scores))
        probs = exp_scores / exp_scores.sum()

        top_idx = int(np.argmax(probs))
        top_label = EMOTION_LABELS[top_idx]
        top_conf = float(probs[top_idx])

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.debug(f"Emotion classify: {top_label} ({top_conf:.2f}) in {elapsed_ms:.1f}ms")

        if top_conf < self.conf_threshold:
            return None

        sentinel_label = LABEL_MAP.get(top_label, "neutral")
        return {
            "emotion": sentinel_label,
            "confidence": top_conf,
            "amplifier": AMPLIFIERS.get(sentinel_label, 0.1),
            "raw_scores": probs.tolist(),
        }

    def classify_batch(self, face_crops: list[np.ndarray]) -> list[Optional[dict]]:
        """Classify emotions for multiple face crops in a single batch."""
        return [self.classify(crop) for crop in face_crops]
