"""
Frame processing pipeline — the core Sentinel inference engine.

Processes a single camera frame through all active ML models in
parallel tracks, then fuses the results into a threat assessment.

Pipeline architecture (4 tracks):

  Track 1 — Identity:
    YOLO26-face → face crops → ArcFace embeddings → DB match

  Track 2 — Body:
    YOLO26-pose + ByteTrack → keypoints → BehaviorClassifier
    (+ OSNet Re-ID for cross-camera tracking)

  Track 3 — Environment:
    YOLO26-fire → fire/smoke detection
    (+ YAMNet audio if microphone data provided)

  Track 4 — General Objects:
    YOLO26 all-class → 80 COCO classes (throttled every 3rd frame)

  Fusion:
    ThreatFusion(visual, audio, emotion) → ThreatAssessment

analysis_mode controls which tracks run:
  full    → all 4 tracks
  face    → Track 1 only
  person  → Track 2 only (tracking)
  pose    → Track 2 (with pose+behavior)
  fire    → Track 3 (fire/smoke)
  objects → Track 4 (general objects)
  audio   → Track 3 (audio only)
"""

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

import numpy as np

from ml.config import settings
from ml.pipeline.threat_fusion import (
    compute_audio_score,
    compute_emotion_amplifier,
    compute_visual_score,
    fuse_threat,
)
from ml.utils.file_utils import save_snapshot
from ml.utils.image_utils import resize_if_needed
from ml.utils.serialization import numpy_to_python

logger = logging.getLogger(__name__)

# Thread pool for CPU-bound model inference (keeps FastAPI event loop free)
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="sentinel-ml")


class FramePipeline:
    """Orchestrates all ML models for a single frame.

    Initialized once at service startup with model references from app.state.
    Stateless per call — safe to call concurrently for different cameras.
    """

    def __init__(self, model_registry: dict):
        self.registry = model_registry
        # Cache last object detection result so skipped frames return stale-but-valid data
        self._last_objects: list[dict] = []

    def _get_model(self, name: str):
        """Get a loaded model or return None (never raises)."""
        entry = self.registry.get(name)
        if entry and entry.get("loaded"):
            return entry["model"]
        return None

    # -----------------------------------------------------------------------
    # Track 1: Face identity
    # -----------------------------------------------------------------------

    def _run_track1(
        self,
        frame: np.ndarray,
        mode: str,
    ) -> dict:
        """Face detection + recognition + embedding extraction."""
        result = {"faces": [], "face_embeddings": [], "emotions": []}

        face_detector = self._get_model("face_detector")
        face_recognizer = self._get_model("face_recognizer")
        emotion_clf = self._get_model("emotion_classifier")

        if face_detector is None:
            return result

        # Detect faces
        raw_faces = face_detector.detect(frame)
        result["faces"] = raw_faces

        if not raw_faces:
            return result

        # For each face: extract embedding + optionally classify emotion
        for i, face in enumerate(raw_faces):
            x1, y1, x2, y2 = face["bbox"]
            face_crop = frame[max(0, y1):y2, max(0, x1):x2]

            if face_crop.size == 0:
                continue

            # ArcFace embedding
            if face_recognizer:
                embedding = face_recognizer.get_embedding(face_crop)
                if embedding is not None:
                    result["face_embeddings"].append({
                        "face_index": i,
                        "bbox": face["bbox"],
                        "embedding": embedding,
                    })

            # Emotion (supermarket + school modes)
            if emotion_clf and mode in ("supermarket", "school"):
                emotion = emotion_clf.classify(face_crop)
                if emotion:
                    result["emotions"].append({
                        "face_index": i,
                        **emotion,
                    })

        return result

    # -----------------------------------------------------------------------
    # Track 2: Body detection, tracking & behavior
    # -----------------------------------------------------------------------

    def _run_track2(
        self,
        frame: np.ndarray,
        mode: str,
    ) -> dict:
        """Person tracking + pose + behavior analysis."""
        result = {"tracked_persons": [], "poses": [], "behaviors": [], "reid_embeddings": []}

        pose_estimator = self._get_model("pose_estimator")
        behavior_clf = self._get_model("behavior_classifier")
        reid_extractor = self._get_model("reid_extractor")
        person_detector = self._get_model("person_detector")

        raw_persons = []

        # Use combined pose+track if available (most efficient)
        if pose_estimator:
            raw_persons = pose_estimator.estimate_tracked(frame)
            result["poses"] = raw_persons
            result["tracked_persons"] = [
                {"track_id": p["track_id"], "bbox": p["bbox"], "confidence": p["confidence"]}
                for p in raw_persons
            ]
        elif person_detector:
            tracks = person_detector.track(frame)
            result["tracked_persons"] = tracks
            raw_persons = tracks
        else:
            return result

        # Behavior analysis
        if behavior_clf and raw_persons and mode in ("school", "mall", "supermarket"):
            h, w = frame.shape[:2]
            behaviors = behavior_clf.analyze(
                raw_persons,
                frame_shape=(h, w, 3),
                mode=mode,
            )
            result["behaviors"] = behaviors

        # Re-ID extraction (mall + supermarket for cross-camera tracking)
        if reid_extractor and result["tracked_persons"] and mode in ("mall", "supermarket"):
            crops = []
            for person in result["tracked_persons"]:
                x1, y1, x2, y2 = person["bbox"]
                crop = frame[max(0, y1):y2, max(0, x1):x2]
                crops.append(crop)
            embeddings = reid_extractor.extract_batch(crops)
            result["reid_embeddings"] = [
                {"track_id": result["tracked_persons"][i]["track_id"], "embedding": emb}
                for i, emb in enumerate(embeddings)
                if emb is not None
            ]

        return result

    # -----------------------------------------------------------------------
    # Track 3: Environmental detection (fire + audio)
    # -----------------------------------------------------------------------

    def _run_track3(
        self,
        frame: np.ndarray,
        audio_data: Optional[bytes],
        mode: str,
    ) -> dict:
        """Fire/smoke detection + audio event classification."""
        result = {"fire_detections": [], "audio_events": [], "is_fire": False}

        fire_detector = self._get_model("fire_detector")
        audio_clf = self._get_model("audio_classifier")

        # Fire detection (school + mall modes)
        if fire_detector and mode in ("school", "mall"):
            raw_fire = fire_detector.detect(frame)
            result["fire_detections"] = raw_fire
            result["is_fire"] = fire_detector.is_fire_emergency(raw_fire)

        # Audio classification (school mode with mic input)
        if audio_clf and audio_data and mode == "school":
            try:
                audio_events = audio_clf.classify_from_wav_bytes(audio_data)
                result["audio_events"] = audio_events
            except Exception as e:
                logger.warning(f"Audio classification failed: {e}")

        return result

    # -----------------------------------------------------------------------
    # Track 4: General object detection — all 80 COCO classes
    # -----------------------------------------------------------------------

    def _run_track4(
        self,
        frame: np.ndarray,
    ) -> dict:
        """Detect all objects in the frame using full COCO class set.

        Runs YOLO on all 80 COCO classes (vehicles, animals, weapons,
        everyday objects, etc.). Persons (class 0) are excluded here
        since they are already returned by Track 2 as tracked_persons.
        """
        result = {"objects": []}

        object_detector = self._get_model("object_detector")
        if object_detector is None:
            return result

        # Exclude class 0 (person) — already covered by Track 2
        detections = object_detector.detect(frame, exclude_classes=[0])
        result["objects"] = detections
        return result

    # -----------------------------------------------------------------------
    # Main pipeline entry point
    # -----------------------------------------------------------------------

    def process(
        self,
        frame: np.ndarray,
        camera_id: str,
        mode: str,
        tenant_id: str,
        audio_data: Optional[bytes] = None,
        timestamp: Optional[str] = None,
        analysis_mode: str = "full",
        frame_count: int = 0,
    ) -> dict:
        """Process a frame through selected pipeline tracks.

        Args:
            frame:         BGR numpy image array.
            camera_id:     Camera identifier.
            mode:          Deployment mode (school/mall/supermarket).
            tenant_id:     Tenant ID for multi-tenancy.
            audio_data:    Optional WAV bytes from microphone.
            timestamp:     Optional ISO 8601 timestamp string.
            analysis_mode: Which tracks to run:
                             'full'    → all 4 tracks (default)
                             'face'    → Track 1 only
                             'person'  → Track 2 only (tracking)
                             'pose'    → Track 2 (pose + behavior)
                             'fire'    → Track 3 (fire/smoke)
                             'objects' → Track 4 (all COCO objects)
                             'audio'   → Track 3 (audio only)
            frame_count:   Persistent counter from app.state per-camera;
                           used to throttle Track 4 in 'full' mode.

        Returns:
            Complete FrameProcessingResult-compatible dict.
        """
        import datetime

        total_start = time.perf_counter()
        if timestamp is None:
            timestamp = datetime.datetime.utcnow().isoformat() + "Z"

        frame = resize_if_needed(frame, max_width=settings.MAX_FRAME_WIDTH)

        # ── Focused / single-track modes ─────────────────────────────────
        _empty_t1 = {"faces": [], "face_embeddings": [], "emotions": []}
        _empty_t2 = {"tracked_persons": [], "poses": [], "behaviors": [], "reid_embeddings": []}
        _empty_t3 = {"fire_detections": [], "audio_events": [], "is_fire": False}
        _empty_t4 = {"objects": []}

        if analysis_mode == "face":
            t1 = self._run_track1(frame, mode)
            t2, t3, t4 = _empty_t2, _empty_t3, _empty_t4

        elif analysis_mode in ("person", "pose"):
            t1 = _empty_t1
            t2 = self._run_track2(frame, mode)
            t3, t4 = _empty_t3, _empty_t4

        elif analysis_mode == "fire":
            t1, t2 = _empty_t1, _empty_t2
            t3 = self._run_track3(frame, audio_data, mode)
            t4 = _empty_t4

        elif analysis_mode == "objects":
            t1, t2, t3 = _empty_t1, _empty_t2, _empty_t3
            t4 = self._run_track4(frame)

        elif analysis_mode == "audio":
            t1, t2 = _empty_t1, _empty_t2
            t3 = self._run_track3(frame, audio_data, mode)
            t3["fire_detections"] = []  # suppress fire output for audio-only mode
            t4 = _empty_t4

        else:
            # "full" — all 4 tracks; Track 4 throttled every 3rd frame
            t1 = self._run_track1(frame, mode)
            t2 = self._run_track2(frame, mode)
            t3 = self._run_track3(frame, audio_data, mode)
            if frame_count % 3 == 0:
                t4 = self._run_track4(frame)
                self._last_objects = t4["objects"]
            else:
                t4 = {"objects": self._last_objects}

        # ── Threat fusion (always runs on available signals) ──────────────
        visual_score = compute_visual_score(
            behaviors=t2["behaviors"],
            fire_detections=t3["fire_detections"],
            poi_matches=[],
            face_count=len(t1["faces"]),
        )
        audio_score = compute_audio_score(t3["audio_events"])
        emotion_amplifier = compute_emotion_amplifier(t1["emotions"])
        threat = fuse_threat(visual_score, audio_score, emotion_amplifier)

        # ── Save evidence if threat detected ─────────────────────────────
        snapshot_paths = []
        if threat["is_threat"] or t3.get("is_fire", False):
            snapshot_path = save_snapshot(
                frame,
                category="incidents",
                prefix=f"{camera_id}_{mode}",
            )
            if snapshot_path:
                snapshot_paths.append(snapshot_path)

        total_ms = (time.perf_counter() - total_start) * 1000

        logger.info(
            f"Frame processed | camera={camera_id} mode={mode} analysis={analysis_mode} "
            f"faces={len(t1['faces'])} persons={len(t2['tracked_persons'])} "
            f"objects={len(t4['objects'])} behaviors={len(t2['behaviors'])} "
            f"fire={t3.get('is_fire', False)} "
            f"threat={threat['fused_score']:.2f} ({'' if threat['is_threat'] else 'no '}alert) "
            f"in {total_ms:.0f}ms"
        )

        return numpy_to_python({
            "camera_id": camera_id,
            "timestamp": timestamp,
            "mode": mode,
            "analysis_mode": analysis_mode,
            "inference_time_ms": round(total_ms, 2),
            # Track 1 — face bboxes forwarded for frontend canvas overlay
            "faces": [
                {"bbox": list(f["bbox"]), "confidence": f["confidence"]}
                for f in t1["faces"]
            ],
            "face_embeddings": [
                {"face_index": e["face_index"], "embedding": e["embedding"].tolist()}
                for e in t1["face_embeddings"]
            ],
            "emotions": t1["emotions"],
            # Track 2 — strip internal numpy arrays before serialization
            "tracked_persons": [
                {
                    "track_id": p["track_id"],
                    "bbox": list(p["bbox"]),
                    "confidence": p["confidence"],
                }
                for p in t2["tracked_persons"]
            ],
            "behaviors": t2["behaviors"],
            "reid_embeddings": [
                {"track_id": r["track_id"], "embedding": r["embedding"].tolist()}
                for r in t2["reid_embeddings"]
            ],
            # Track 3
            "fire_detections": t3["fire_detections"],
            "audio_events": t3["audio_events"],
            # Track 4
            "objects": t4["objects"],
            # Threat
            "threat": threat,
            # Evidence
            "snapshot_paths": snapshot_paths,
        })
