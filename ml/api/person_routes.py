"""
Person detection, tracking, and pose estimation API routes.

Endpoints:
- POST /detect-persons   — detect persons in a single frame (no tracking)
- POST /track-persons    — detect + assign ByteTrack IDs across frames
- POST /estimate-pose    — 17-keypoint body pose estimation per person
- POST /track-pose       — track + pose in a single combined call (most efficient)
"""

import logging
import time

from fastapi import APIRouter, Depends, HTTPException

from ml.dependencies import get_person_detector, get_pose_estimator
from ml.schemas.requests import PersonDetectRequest, PersonTrackRequest, PoseEstimateRequest
from ml.schemas.responses import (
    PersonDetectionResult,
    PersonTrack,
    PersonTrackResult,
    PoseEstimationResult,
    PosePerson,
    PoseKeypoint,
)
from ml.utils.image_utils import decode_base64_image

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Person & Pose"])


@router.post("/detect-persons", response_model=PersonDetectionResult)
async def detect_persons(
    request: PersonDetectRequest,
    person_detector=Depends(get_person_detector),
) -> PersonDetectionResult:
    """Detect persons in a single frame without tracking.

    Returns bounding boxes and confidence scores.
    No track IDs — use /track-persons for persistent IDs across frames.
    """
    start = time.perf_counter()

    try:
        frame = decode_base64_image(request.image_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    h, w = frame.shape[:2]
    detections = person_detector.detect(frame)

    persons = [
        PersonTrack(
            track_id=None,
            bbox=list(det["bbox"]),
            confidence=det["confidence"],
        )
        for det in detections
    ]

    elapsed_ms = (time.perf_counter() - start) * 1000

    return PersonDetectionResult(
        persons=persons,
        frame_width=w,
        frame_height=h,
        inference_time_ms=round(elapsed_ms, 2),
    )


@router.post("/track-persons", response_model=PersonTrackResult)
async def track_persons(
    request: PersonTrackRequest,
    person_detector=Depends(get_person_detector),
) -> PersonTrackResult:
    """Detect and track persons across frames using ByteTrack.

    Assigns persistent track_ids that remain stable across sequential frames.
    The model maintains internal tracking state — send frames in order.

    Use /detect-persons if you only need single-frame detections.
    """
    start = time.perf_counter()

    try:
        frame = decode_base64_image(request.image_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    h, w = frame.shape[:2]
    raw_tracks = person_detector.track(frame, tracker=request.tracker)

    tracks = [
        PersonTrack(
            track_id=t["track_id"],
            bbox=list(t["bbox"]),
            confidence=t["confidence"],
        )
        for t in raw_tracks
    ]

    elapsed_ms = (time.perf_counter() - start) * 1000

    return PersonTrackResult(
        tracks=tracks,
        frame_width=w,
        frame_height=h,
        inference_time_ms=round(elapsed_ms, 2),
    )


@router.post("/estimate-pose", response_model=PoseEstimationResult)
async def estimate_pose(
    request: PoseEstimateRequest,
    pose_estimator=Depends(get_pose_estimator),
) -> PoseEstimationResult:
    """Estimate 17-keypoint body pose for all persons in a frame.

    Returns COCO-format keypoints (nose, eyes, ears, shoulders, elbows,
    wrists, hips, knees, ankles) with per-keypoint confidence scores.
    """
    start = time.perf_counter()

    try:
        frame = decode_base64_image(request.image_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    h, w = frame.shape[:2]
    raw_persons = pose_estimator.estimate(frame)

    persons = [
        PosePerson(
            track_id=None,
            bbox=list(p["bbox"]),
            confidence=p["confidence"],
            keypoints=[
                PoseKeypoint(
                    name=kp["name"],
                    x=kp["x"],
                    y=kp["y"],
                    confidence=kp["confidence"],
                )
                for kp in p["keypoints"]
            ],
        )
        for p in raw_persons
    ]

    elapsed_ms = (time.perf_counter() - start) * 1000

    return PoseEstimationResult(
        persons=persons,
        frame_width=w,
        frame_height=h,
        inference_time_ms=round(elapsed_ms, 2),
    )


@router.post("/track-pose", response_model=PoseEstimationResult)
async def track_pose(
    request: PersonTrackRequest,
    pose_estimator=Depends(get_pose_estimator),
) -> PoseEstimationResult:
    """Track persons AND estimate pose in a single combined call.

    Most efficient for real-time pipelines — runs one model pass instead
    of two separate calls. Returns persistent track_ids alongside keypoints.
    """
    start = time.perf_counter()

    try:
        frame = decode_base64_image(request.image_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    h, w = frame.shape[:2]
    raw_persons = pose_estimator.estimate_tracked(frame, tracker=request.tracker)

    persons = [
        PosePerson(
            track_id=p["track_id"],
            bbox=list(p["bbox"]),
            confidence=p["confidence"],
            keypoints=[
                PoseKeypoint(
                    name=kp["name"],
                    x=kp["x"],
                    y=kp["y"],
                    confidence=kp["confidence"],
                )
                for kp in p["keypoints"]
            ],
        )
        for p in raw_persons
    ]

    elapsed_ms = (time.perf_counter() - start) * 1000

    return PoseEstimationResult(
        persons=persons,
        frame_width=w,
        frame_height=h,
        inference_time_ms=round(elapsed_ms, 2),
    )
