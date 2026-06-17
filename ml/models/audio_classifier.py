"""
Audio event classifier using YAMNet (TensorFlow Hub).

Classifies 1-second audio chunks into security-relevant events:
  scream, glass_break, alarm, gunshot, explosion, normal

YAMNet is a pretrained audio classifier trained on AudioSet (521 classes).
We map its output to Sentinel's 6 security-relevant audio event labels.

Input:  WAV audio, 16kHz mono, 1-second chunks (16000 samples)
Output: Sentinel audio event label + confidence

YAMNet AudioSet class mappings used:
  scream:      "Screaming" (80), "Crying" (24), "Shout" (79)
  glass_break: "Glass" (462), "Breaking" (135)
  alarm:       "Alarm" (396), "Siren" (397), "Smoke detector" (400)
  gunshot:     "Gunshot, gunfire" (427)
  explosion:   "Explosion" (430), "Boom" (434)
"""

import logging
import time
from typing import Optional

import numpy as np

from ml.config import settings

logger = logging.getLogger(__name__)

# YAMNet AudioSet class indices → Sentinel event labels
# These are stable class indices from the AudioSet ontology
YAMNET_CLASS_MAP = {
    # Screams / cries
    80:  "scream",   # Screaming
    79:  "scream",   # Shouting
    24:  "scream",   # Crying, sobbing
    # Glass
    462: "glass_break",  # Glass
    135: "glass_break",  # Breaking
    # Alarms
    396: "alarm",    # Alarm
    397: "alarm",    # Siren
    400: "alarm",    # Smoke detector, smoke alarm
    398: "alarm",    # Civil defense siren
    # Gunshots
    427: "gunshot",  # Gunshot, gunfire
    428: "gunshot",  # Machine gun
    429: "gunshot",  # Fusillade
    # Explosions
    430: "explosion",  # Explosion
    434: "explosion",  # Boom
    431: "explosion",  # Blasting
}

# Threat level per audio event
AUDIO_THREAT = {
    "scream":      True,
    "glass_break": True,
    "alarm":       True,
    "gunshot":     True,
    "explosion":   True,
    "normal":      False,
}


class AudioClassifier:
    """YAMNet-based audio event classifier via TensorFlow Hub.

    Classifies 16kHz mono audio into security-relevant events.
    Model auto-downloads from TF Hub on first use (~15MB).
    """

    def __init__(self):
        import tensorflow as tf
        import tensorflow_hub as hub

        self.conf_threshold = settings.AUDIO_CONFIDENCE

        logger.info("Loading YAMNet from TensorFlow Hub...")
        self.model = hub.load("https://tfhub.dev/google/yamnet/1")
        logger.info("YAMNet loaded successfully")

        # Load class names from the model's assets
        class_map_path = self.model.class_map_path().numpy()
        import csv
        self.class_names = []
        with open(class_map_path) as f:
            reader = csv.DictReader(f)
            for row in reader:
                self.class_names.append(row["display_name"])

        logger.info(f"YAMNet: {len(self.class_names)} AudioSet classes loaded")

    def _preprocess(self, audio_data: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
        """Ensure audio is 16kHz mono float32 in [-1, 1] range."""
        # Resample if needed (basic linear resampling for non-16kHz)
        if sample_rate != 16000 and len(audio_data) > 0:
            target_len = int(len(audio_data) * 16000 / sample_rate)
            audio_data = np.interp(
                np.linspace(0, len(audio_data), target_len),
                np.arange(len(audio_data)),
                audio_data,
            )

        # Normalize to [-1, 1]
        if audio_data.dtype != np.float32:
            audio_data = audio_data.astype(np.float32)
        max_val = np.max(np.abs(audio_data))
        if max_val > 0:
            audio_data = audio_data / max_val

        return audio_data

    def classify(
        self,
        audio_data: np.ndarray,
        sample_rate: int = 16000,
    ) -> list[dict]:
        """Classify audio into security events.

        Args:
            audio_data:  1D numpy array of audio samples.
            sample_rate: Sample rate of audio_data (will resample to 16kHz).

        Returns:
            List of detected events sorted by confidence:
            [
                {
                    "event": str,       # Sentinel event label
                    "confidence": float,
                    "is_threat": bool,
                    "yamnet_class": str # Raw AudioSet class name
                }
            ]
            Empty list if no events exceed the confidence threshold.
        """
        import tensorflow as tf

        start = time.perf_counter()

        audio = self._preprocess(audio_data, sample_rate)

        # YAMNet expects a 1D float32 waveform
        scores, embeddings, spectrogram = self.model(audio)
        # scores: (num_frames, 521) — average across frames
        mean_scores = np.mean(scores.numpy(), axis=0)  # (521,)

        # Map top AudioSet classes to Sentinel events
        event_scores: dict[str, float] = {}
        for class_idx, sentinel_label in YAMNET_CLASS_MAP.items():
            if class_idx < len(mean_scores):
                score = float(mean_scores[class_idx])
                if score > event_scores.get(sentinel_label, 0):
                    event_scores[sentinel_label] = score

        # Build results, filter by threshold
        results = []
        for event_label, score in sorted(event_scores.items(), key=lambda x: -x[1]):
            if score >= self.conf_threshold:
                results.append({
                    "event": event_label,
                    "confidence": round(score, 4),
                    "is_threat": AUDIO_THREAT.get(event_label, False),
                    "yamnet_class": self.class_names[
                        max(YAMNET_CLASS_MAP, key=lambda k: mean_scores[k]
                            if YAMNET_CLASS_MAP.get(k) == event_label else -1)
                    ] if self.class_names else event_label,
                })

        if not results:
            results.append({
                "event": "normal",
                "confidence": 1.0 - max(event_scores.values(), default=0.0),
                "is_threat": False,
                "yamnet_class": "Background",
            })

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.debug(
            f"Audio classify: top={results[0]['event']} "
            f"({results[0]['confidence']:.2f}) in {elapsed_ms:.1f}ms"
        )

        return results

    def classify_from_wav_bytes(self, wav_bytes: bytes) -> list[dict]:
        """Classify from raw WAV bytes (decoded from base64 in API layer)."""
        import io
        import wave

        with wave.open(io.BytesIO(wav_bytes)) as wf:
            sample_rate = wf.getframerate()
            n_frames = wf.getnframes()
            n_channels = wf.getnchannels()
            raw = wf.readframes(n_frames)

        # Convert to float32 numpy array
        dtype = np.int16 if wf.getsampwidth() == 2 else np.int32
        audio = np.frombuffer(raw, dtype=dtype).astype(np.float32)

        # Mix to mono if stereo
        if n_channels == 2:
            audio = audio.reshape(-1, 2).mean(axis=1)

        return self.classify(audio, sample_rate=sample_rate)
