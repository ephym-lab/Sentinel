import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from ml.pipeline.worker_pool import CameraWorkerPool


@pytest.mark.asyncio
async def test_reconciliation_lifecycle():
    pool = CameraWorkerPool()
    
    # 1. Define initial tenant and camera config
    tenants_mock = [{"id": "tenant-uuid-1", "mode": "school"}]
    cameras_mock = [
        {
            "id": "camera-uuid-1",
            "is_active": True,
            "active_feed": {
                "is_active": True,
                "file_path": "videos/sentinel_tenant/video1.mp4"
            }
        }
    ]
    
    def get_side_effect(url, headers=None, **kwargs):
        mock_response = MagicMock()
        mock_response.status_code = 200
        if "tenants" in url:
            mock_response.json = lambda: tenants_mock
        elif "cameras" in url:
            assert headers is not None
            assert headers["X-Tenant-ID"] == "tenant-uuid-1"
            mock_response.json = lambda: cameras_mock
        return mock_response

    async def dummy_worker(*args, **kwargs):
        try:
            await asyncio.sleep(3600)
        except asyncio.CancelledError:
            pass

    # We patch the camera_worker function to prevent OpenCV file reading and backend HTTP calls during testing
    with patch("ml.pipeline.worker_pool.camera_worker", side_effect=dummy_worker) as mock_worker, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
         
        mock_get.side_effect = get_side_effect
         
        # Run reconciliation for the first time
        await pool.reconcile()
        
        # Verify worker is started
        assert "camera-uuid-1" in pool.workers
        task, feed_path = pool.workers["camera-uuid-1"]
        assert feed_path == "videos/sentinel_tenant/video1.mp4"
        mock_worker.assert_called_once_with(
            "camera-uuid-1", "tenant-uuid-1", "videos/sentinel_tenant/video1.mp4", "school"
        )
        
        # Run reconciliation again with no changes: task should remain unchanged
        mock_worker.reset_mock()
        await pool.reconcile()
        assert "camera-uuid-1" in pool.workers
        assert pool.workers["camera-uuid-1"][0] == task  # Same task instance
        mock_worker.assert_not_called()
        
        # Run reconciliation with a new video feed path: task should be recreated
        cameras_mock[0]["active_feed"]["file_path"] = "videos/sentinel_tenant/video2.mp4"
        await pool.reconcile()
        assert "camera-uuid-1" in pool.workers
        assert pool.workers["camera-uuid-1"][0] != task  # Recreated task
        assert pool.workers["camera-uuid-1"][1] == "videos/sentinel_tenant/video2.mp4"
        mock_worker.assert_called_once()
        
        # Run reconciliation with camera deactivated: task should be stopped
        cameras_mock[0]["is_active"] = False
        await pool.reconcile()
        assert "camera-uuid-1" not in pool.workers
        
        # Clean up pool
        await pool.stop_all()
