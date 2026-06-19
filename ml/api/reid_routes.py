"""
Person Re-Identification (Re-ID) API routes.

Endpoints:
- POST /extract-reid        — extract body appearance embedding from a person crop
- POST /extract-reid-batch  — batch extraction for multiple persons per frame
- POST /match-reid          — compare two embeddings for similarity
"""

import logging
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ml.dependencies import get_reid_extractor
from ml.schemas.responses import ReIDResult
from ml.utils.file_utils import save_snapshot
from ml.utils.image_utils import decode_base64_image

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Re-ID"])


class ReIDExtractRequest(BaseModel):
    person_crop_b64: str = Field(..., description="Base64-encoded person crop (BGR, full body)")
    track_id: int | None = Field(None, description="ByteTrack ID for logging")
    tenant_id: str | None = Field(None, description="Tenant UUID for scoped file storage")
    save_snapshot: bool = Field(False, description="Save crop to uploads/tenants/{tenant_id}/images/")


class ReIDBatchRequest(BaseModel):
    crops_b64: list[str] = Field(..., description="List of base64-encoded person crops")
    track_ids: list[int] | None = Field(None, description="Corresponding track IDs (optional)")


class ReIDMatchRequest(BaseModel):
    embedding1: list[float] = Field(..., description="First embedding vector")
    embedding2: list[float] = Field(..., description="Second embedding vector")


class ReIDBatchResult(BaseModel):
    results: list[ReIDResult]
    inference_time_ms: float


class ReIDMatchResult(BaseModel):
    similarity: float = Field(..., ge=0.0, le=1.0)
    is_match: bool
    threshold_used: float


@router.post("/extract-reid", response_model=ReIDResult)
async def extract_reid(
    request: ReIDExtractRequest,
    reid_extractor=Depends(get_reid_extractor),
) -> ReIDResult:
    """Extract a body appearance embedding from a person crop.

    Returns a 512-dim normalized embedding for storage in pgvector.
    Use for POI matching and cross-camera person tracking.
    """
    try:
        crop = decode_base64_image(request.person_crop_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    embedding = reid_extractor.extract(crop)

    if embedding is None:
        raise HTTPException(
            status_code=422,
            detail="Could not extract Re-ID embedding — crop too small or invalid.",
        )

    snapshot_path = None
    if request.save_snapshot and request.tenant_id:
        prefix = f"track_{request.track_id}" if request.track_id is not None else "unknown"
        snapshot_path = save_snapshot(
            crop,
            category="images",
            prefix=prefix,
            tenant_id=request.tenant_id,
        )

    return ReIDResult(
        embedding=embedding.tolist(),
        snapshot_path=snapshot_path,
    )


@router.post("/extract-reid-batch", response_model=ReIDBatchResult)
async def extract_reid_batch(
    request: ReIDBatchRequest,
    reid_extractor=Depends(get_reid_extractor),
) -> ReIDBatchResult:
    """Batch Re-ID embedding extraction for multiple persons per frame.

    Processes all crops in a single model forward pass — significantly
    more efficient than calling /extract-reid N times for a crowded scene.
    """
    start = time.perf_counter()

    crops = []
    for b64 in request.crops_b64:
        try:
            crops.append(decode_base64_image(b64))
        except ValueError:
            crops.append(None)

    embeddings = reid_extractor.extract_batch(crops)

    results = []
    for i, emb in enumerate(embeddings):
        results.append(ReIDResult(
            embedding=emb.tolist() if emb is not None else [],
            snapshot_path=None,
        ))

    elapsed_ms = (time.perf_counter() - start) * 1000

    return ReIDBatchResult(
        results=results,
        inference_time_ms=round(elapsed_ms, 2),
    )


@router.post("/match-reid", response_model=ReIDMatchResult)
async def match_reid(
    request: ReIDMatchRequest,
    reid_extractor=Depends(get_reid_extractor),
) -> ReIDMatchResult:
    """Compute cosine similarity between two Re-ID embeddings.

    Use to check if two person crops (possibly from different cameras)
    represent the same individual. Threshold is 0.7 for osnet_x1_0.
    """
    import numpy as np

    emb1 = np.array(request.embedding1, dtype=np.float32)
    emb2 = np.array(request.embedding2, dtype=np.float32)

    if emb1.shape != emb2.shape:
        raise HTTPException(
            status_code=422,
            detail=f"Embedding dimension mismatch: {emb1.shape} vs {emb2.shape}",
        )

    similarity = reid_extractor.compute_similarity(emb1, emb2)
    threshold = 0.6 if "x0_25" in reid_extractor.model_name else 0.7

    return ReIDMatchResult(
        similarity=round(float(similarity), 4),
        is_match=similarity >= threshold,
        threshold_used=threshold,
    )
