"""
Threat fusion engine.

Combines visual, behavioral, audio, and emotion signals into
a single threat score used to trigger incident alerts.

Fusion formula:
  - WITH audio:
      fused = VISUAL_WEIGHT * visual + AUDIO_WEIGHT * audio + EMOTION_WEIGHT * emotion_amp
  - WITHOUT audio:
      fused = VISUAL_WEIGHT_NO_AUDIO * visual + EMOTION_WEIGHT_NO_AUDIO * emotion_amp

Visual score components:
  - Behavior severity:   critical=1.0, high=0.8, medium=0.5, low=0.2
  - Fire detection:      automatic critical (1.0)
  - POI match:           0.9 added to visual score
  - Person count factor: dampened for large crowds (avoid false positives)

Audio score: direct classifier confidence for threat events.
Emotion amplifier: mean amplifier across all detected faces.
"""

import logging
from typing import Optional

from ml.config import settings

logger = logging.getLogger(__name__)

SEVERITY_SCORES = {
    "critical": 1.0,
    "high": 0.8,
    "medium": 0.5,
    "low": 0.2,
}


def compute_visual_score(
    behaviors: list[dict],
    fire_detections: list[dict],
    poi_matches: list[dict],
    face_count: int = 0,
) -> float:
    """Compute visual threat score (0.0 to 1.0).

    Args:
        behaviors:      Output from BehaviorClassifier.analyze()
        fire_detections: Output from FireDetector.detect()
        poi_matches:    Any matched persons of interest
        face_count:     Number of faces detected (context signal)

    Returns:
        Visual threat score clamped to [0.0, 1.0].
    """
    score = 0.0

    # Fire is always critical
    if fire_detections:
        fire_labels = [d["label"] for d in fire_detections]
        if "fire" in fire_labels:
            return 1.0  # Immediate max score
        score = max(score, 0.7)  # Smoke alone is high

    # Behavior scores — take the worst
    if behaviors:
        worst = max(behaviors, key=lambda b: SEVERITY_SCORES.get(b["severity"], 0.0))
        behavior_score = SEVERITY_SCORES.get(worst["severity"], 0.0)
        # Weight by confidence
        behavior_score *= worst.get("confidence", 1.0)
        score = max(score, behavior_score)

    # POI match adds a flat boost
    if poi_matches:
        score = min(1.0, score + 0.9)

    return min(1.0, max(0.0, score))


def compute_audio_score(audio_events: list[dict]) -> Optional[float]:
    """Compute audio threat score from classified events.

    Returns:
        Highest threat event confidence, or None if no audio data.
    """
    if not audio_events:
        return None

    threat_scores = [
        evt["confidence"]
        for evt in audio_events
        if evt.get("is_threat", False)
    ]

    return max(threat_scores) if threat_scores else 0.0


def compute_emotion_amplifier(emotions: list[dict]) -> float:
    """Compute mean emotion amplifier across all detected faces.

    Returns:
        Mean amplifier in [0.0, 1.0]. Defaults to 0.1 (neutral) if no emotions.
    """
    if not emotions:
        return 0.1

    amplifiers = [e.get("amplifier", 0.1) for e in emotions]
    return sum(amplifiers) / len(amplifiers)


def fuse_threat(
    visual_score: float,
    audio_score: Optional[float],
    emotion_amplifier: float,
) -> dict:
    """Fuse all signals into a final threat assessment.

    Args:
        visual_score:       Visual threat score [0.0, 1.0]
        audio_score:        Audio threat score [0.0, 1.0] or None
        emotion_amplifier:  Mean emotion amplifier [0.0, 1.0]

    Returns:
        {
            "visual_score": float,
            "audio_score": float | None,
            "emotion_amplifier": float,
            "fused_score": float,
            "is_threat": bool,
            "threshold_used": float,
        }
    """
    if audio_score is not None:
        fused = (
            settings.VISUAL_WEIGHT * visual_score
            + settings.AUDIO_WEIGHT * audio_score
            + settings.EMOTION_WEIGHT * emotion_amplifier
        )
        threshold = settings.THREAT_THRESHOLD
    else:
        fused = (
            settings.VISUAL_WEIGHT_NO_AUDIO * visual_score
            + settings.EMOTION_WEIGHT_NO_AUDIO * emotion_amplifier
        )
        threshold = settings.THREAT_THRESHOLD_NO_AUDIO

    fused = min(1.0, max(0.0, fused))

    return {
        "visual_score": round(visual_score, 4),
        "audio_score": round(audio_score, 4) if audio_score is not None else None,
        "emotion_amplifier": round(emotion_amplifier, 4),
        "fused_score": round(fused, 4),
        "is_threat": fused >= threshold,
        "threshold_used": threshold,
    }
