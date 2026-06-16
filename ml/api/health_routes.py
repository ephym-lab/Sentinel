"""
Health and model status endpoints.

Provides service health check and per-model loading status
for monitoring and debugging.
"""

from fastapi import APIRouter, Request

from ml.config import settings
from ml.schemas.responses import HealthResponse, ModelStatus

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request) -> HealthResponse:
    """Service health check with loaded model inventory."""
    model_registry = request.app.state.model_registry

    models = []
    for name, info in model_registry.items():
        models.append(
            ModelStatus(
                name=name,
                loaded=info.get("loaded", False),
                device=info.get("device", settings.DEVICE),
                variant=info.get("variant", "unknown"),
                load_time_ms=info.get("load_time_ms"),
            )
        )

    return HealthResponse(
        status="ok",
        device=settings.DEVICE,
        environment=settings.ENV.value,
        models=models,
    )


@router.get("/models/status", response_model=list[ModelStatus])
async def model_status(request: Request) -> list[ModelStatus]:
    """Detailed per-model status — loading state, device, variant, load time."""
    model_registry = request.app.state.model_registry

    return [
        ModelStatus(
            name=name,
            loaded=info.get("loaded", False),
            device=info.get("device", settings.DEVICE),
            variant=info.get("variant", "unknown"),
            load_time_ms=info.get("load_time_ms"),
        )
        for name, info in model_registry.items()
    ]
