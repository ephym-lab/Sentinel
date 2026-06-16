"""
FastAPI dependency injection for ML models.

Provides typed access to individual models from the app-level model registry.
Each dependency checks that the model is loaded and raises a clear 503 if not.
"""

from fastapi import HTTPException, Request


def _get_model(request: Request, model_name: str):
    """Retrieve a loaded model from the registry or raise 503."""
    registry = request.app.state.model_registry
    entry = registry.get(model_name)

    if entry is None or not entry.get("loaded"):
        raise HTTPException(
            status_code=503,
            detail=f"Model '{model_name}' is not loaded. "
            f"Check /models/status for details.",
        )

    return entry["model"]


def get_face_detector(request: Request):
    """Dependency: YOLOv8-face detector."""
    return _get_model(request, "face_detector")


def get_face_recognizer(request: Request):
    """Dependency: ArcFace recognizer."""
    return _get_model(request, "face_recognizer")


def get_person_detector(request: Request):
    """Dependency: YOLOv8 person detector + ByteTrack tracker."""
    return _get_model(request, "person_detector")


def get_pose_estimator(request: Request):
    """Dependency: YOLOv8-pose estimator."""
    return _get_model(request, "pose_estimator")


def get_emotion_classifier(request: Request):
    """Dependency: FER+ emotion classifier."""
    return _get_model(request, "emotion_classifier")


def get_behavior_classifier(request: Request):
    """Dependency: Behavior classifier."""
    return _get_model(request, "behavior_classifier")


def get_fire_detector(request: Request):
    """Dependency: YOLOv8-fire detector."""
    return _get_model(request, "fire_detector")


def get_reid_extractor(request: Request):
    """Dependency: OSNet Re-ID extractor."""
    return _get_model(request, "reid_extractor")


def get_audio_classifier(request: Request):
    """Dependency: YAMNet audio classifier."""
    return _get_model(request, "audio_classifier")
