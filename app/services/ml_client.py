import logging
import httpx
from typing import Optional, Any
from app.core.config import settings

logger = logging.getLogger(__name__)


class MLServiceClient:
    """Async client for interacting with the Sentinel ML service."""

    def __init__(self, base_url: str = settings.ML_SERVICE_URL):
        self.base_url = base_url.rstrip("/")

    async def check_health(self) -> dict:
        """Call the ML service health endpoint."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{self.base_url}/health", timeout=5.0)
                if response.status_code == 200:
                    return response.json()
                return {"status": "unhealthy", "code": response.status_code}
            except Exception as e:
                logger.error(f"Failed to connect to ML Service at {self.base_url}: {e}")
                return {"status": "offline", "error": str(e)}

    async def process_frame(
        self,
        image_b64: str,
        camera_id: str,
        mode: str,
        tenant_id: str,
        audio_b64: Optional[str] = None,
        timestamp: Optional[str] = None
    ) -> Optional[dict]:
        """Post a camera frame and optional audio to the ML pipeline.

        Args:
            image_b64: Base64-encoded image frame.
            camera_id: ID of the originating camera.
            mode: Tenant's operational mode (school, mall, supermarket).
            tenant_id: ID of the tenant.
            audio_b64: Optional base64-encoded WAV audio data.
            timestamp: Optional ISO 8601 timestamp.

        Returns:
            The complete processing results dict, or None if the request failed.
        """
        payload = {
            "image_b64": image_b64,
            "camera_id": camera_id,
            "mode": mode,
            "tenant_id": tenant_id,
        }
        if audio_b64:
            payload["audio_b64"] = audio_b64
        if timestamp:
            payload["timestamp"] = timestamp

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/pipeline/process-frame",
                    json=payload,
                    timeout=30.0  # Allow time for neural network inference on CPU
                )
                if response.status_code == 200:
                    return response.json()
                
                logger.error(f"ML Service returned status {response.status_code}: {response.text}")
                return None
            except Exception as e:
                logger.error(f"Error communicating with ML Service: {e}")
                return None


# Global ML client instance
ml_client = MLServiceClient()
