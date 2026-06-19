"""
Face detection and recognition API routes.

Endpoints:
- POST /detect-faces — detect faces in an image
- POST /recognize — extract embedding from a face crop
- POST /enroll-embedding — detect face in photo and return embedding for DB storage
"""

import logging
import time

from fastapi import APIRouter, Depends, HTTPException

from ml.dependencies import get_face_detector, get_face_recognizer
from ml.schemas.requests import FaceDetectRequest, FaceEnrollRequest, FaceRecognizeRequest
from ml.schemas.responses import (
    FaceBBox,
    FaceDetectionResult,
    FaceEmbeddingResult,
)
from ml.utils.file_utils import save_snapshot
from ml.utils.image_utils import decode_base64_image

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Face"])


@router.post("/detect-faces", response_model=FaceDetectionResult)
async def detect_faces(
    request: FaceDetectRequest,
    face_detector=Depends(get_face_detector),
) -> FaceDetectionResult:
    """Detect faces in an image.

    Returns bounding boxes with confidence scores.
    Uses YOLO26 fine-tuned on WIDER FACE (NMS-free by default).
    """
    start = time.perf_counter()

    try:
        frame = decode_base64_image(request.image_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    h, w = frame.shape[:2]
    detections = face_detector.detect(frame, max_faces=request.max_faces)

    faces = [
        FaceBBox(
            x1=det["bbox"][0],
            y1=det["bbox"][1],
            x2=det["bbox"][2],
            y2=det["bbox"][3],
            confidence=det["confidence"],
            landmarks=det.get("landmarks"),
        )
        for det in detections
    ]

    elapsed_ms = (time.perf_counter() - start) * 1000

    return FaceDetectionResult(
        faces=faces,
        frame_width=w,
        frame_height=h,
        inference_time_ms=round(elapsed_ms, 2),
    )


@router.post("/recognize", response_model=FaceEmbeddingResult)
async def recognize_face(
    request: FaceRecognizeRequest,
    face_recognizer=Depends(get_face_recognizer),
) -> FaceEmbeddingResult:
    """Extract a 512-dim ArcFace embedding from a face crop.

    Input should be a pre-cropped, aligned face image (112x112 preferred).
    Returns the embedding vector for DB storage or similarity search.
    """
    try:
        face_crop = decode_base64_image(request.face_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    embedding = face_recognizer.get_embedding(face_crop)

    if embedding is None:
        raise HTTPException(
            status_code=422,
            detail="No face detected in the provided crop. "
            "Ensure the image contains a clearly visible face.",
        )

    return FaceEmbeddingResult(
        embedding=embedding.tolist(),
        face_bbox=None,
        snapshot_path=None,
    )


@router.post("/enroll-embedding", response_model=FaceEmbeddingResult)
async def enroll_face(
    request: FaceEnrollRequest,
    face_recognizer=Depends(get_face_recognizer),
) -> FaceEmbeddingResult:
    """Generate a face embedding from a photo for person enrollment.

    Takes a full photo (not a crop), detects the face, extracts the embedding,
    and saves a face snapshot. Expects exactly one face in the photo.

    Used by the backend when enrolling students, staff, or known customers.
    """
    try:
        frame = decode_base64_image(request.image_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    results = face_recognizer.get_embedding_from_frame(frame)

    if not results:
        raise HTTPException(
            status_code=422,
            detail="No face detected in the provided photo. "
            "Ensure the image contains a clearly visible face.",
        )

    if len(results) > 1:
        logger.warning(
            f"Enrollment photo for person {request.person_id} contains "
            f"{len(results)} faces — using the largest one."
        )

    # Use the largest face (most likely the subject)
    best = max(results, key=lambda r: (r["bbox"][2] - r["bbox"][0]) * (r["bbox"][3] - r["bbox"][1]))

    # Save face snapshot for records (under the tenant's images/ directory)
    x1, y1, x2, y2 = best["bbox"]
    face_crop = frame[max(0, y1):y2, max(0, x1):x2]
    snapshot_path = save_snapshot(
        face_crop,
        category="images",
        prefix=request.person_id,
        tenant_id=getattr(request, "tenant_id", None),
    )

    bbox = FaceBBox(
        x1=x1, y1=y1, x2=x2, y2=y2,
        confidence=best["det_score"],
        landmarks=best["kps"].tolist() if best.get("kps") is not None else None,
    )

    return FaceEmbeddingResult(
        embedding=best["embedding"].tolist(),
        face_bbox=bbox,
        snapshot_path=snapshot_path,
    )
