import os
import asyncio
import logging
import base64
import cv2
import httpx
from ml.config import settings

logger = logging.getLogger("sentinel.ml.worker_pool")


async def camera_worker(camera_id: str, tenant_id: str, file_path: str, mode: str):
    """Worker task that reads from a local video file using OpenCV and posts frames to the backend."""
    abs_path = os.path.join(settings.UPLOADS_DIR, file_path)
    if not os.path.exists(abs_path):
        logger.error(f"Feed file not found: {abs_path}")
        return

    cap = cv2.VideoCapture(abs_path)
    if not cap.isOpened():
        logger.error(f"Failed to open video file: {abs_path}")
        return

    # Process at 3 fps (throttled rate between 2-5 fps)
    fps = 3.0
    delay = 1.0 / fps

    logger.info(f"Started camera worker for camera={camera_id} tenant={tenant_id} feed={file_path}")

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            try:
                ret, frame = cap.read()
                if not ret:
                    # Loop on end-of-file
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue

                # Encode the frame to JPEG format
                success, encoded_img = cv2.imencode(".jpg", frame)
                if not success:
                    await asyncio.sleep(delay)
                    continue

                img_b64 = base64.b64encode(encoded_img).decode("utf-8")

                headers = {"X-Tenant-ID": tenant_id}
                payload = {
                    "camera_id": camera_id,
                    "image_b64": img_b64,
                    "audio_b64": None
                }

                # Post the frame to the backend's frame ingestion endpoint
                response = await client.post(
                    f"{settings.BACKEND_URL}/api/v1/surveillance/process-frame",
                    json=payload,
                    headers=headers
                )
                if response.status_code != 200:
                    logger.warning(
                        f"Backend returned status {response.status_code} for camera {camera_id}: {response.text}"
                    )

            except asyncio.CancelledError:
                logger.info(f"Camera worker for camera={camera_id} has been cancelled.")
                break
            except Exception as e:
                logger.error(f"Error in camera worker for camera={camera_id}: {e}")

            await asyncio.sleep(delay)

    cap.release()


class CameraWorkerPool:
    """Manages the lifecycle of background camera workers based on active feeds."""

    def __init__(self):
        self.workers = {}  # camera_id -> (asyncio.Task, feed_path)
        self.polling_task = None
        self.running = False

    async def start_polling_loop(self):
        """Starts the background loop that polls the backend and reconciles workers."""
        self.running = True
        logger.info("Camera worker pool polling loop started.")
        while self.running:
            try:
                await self.reconcile()
            except Exception as e:
                logger.error(f"Error during worker pool reconciliation: {e}")
            
            # Poll every 20 seconds (as requested, between 15-30 seconds)
            await asyncio.sleep(20)

    async def stop_all(self):
        """Cancels all active worker tasks."""
        self.running = False
        camera_ids = list(self.workers.keys())
        for camera_id in camera_ids:
            await self.stop_worker(camera_id)
        logger.info("All camera workers stopped.")

    async def stop_worker(self, camera_id: str):
        """Cancels a specific camera worker task."""
        if camera_id in self.workers:
            task, feed_path = self.workers[camera_id]
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            del self.workers[camera_id]
            logger.info(f"Stopped worker for camera {camera_id}")

    async def reconcile(self):
        """Reconciles the in-memory running workers with active cameras listed on the backend."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(f"{settings.BACKEND_URL}/api/v1/tenants/")
                if resp.status_code != 200:
                    logger.warning(f"Failed to fetch tenants from backend: {resp.status_code}")
                    return
                tenants = resp.json()
            except Exception as e:
                logger.warning(f"Backend not reachable for tenant polling: {e}")
                return

            active_feeds = {}  # camera_id -> (tenant_id, file_path, mode)

            # Fetch active cameras for all registered tenants
            for tenant in tenants:
                tenant_id = tenant["id"]
                mode = tenant["mode"]
                try:
                    resp_cams = await client.get(
                        f"{settings.BACKEND_URL}/api/v1/cameras/",
                        headers={"X-Tenant-ID": tenant_id}
                    )
                    if resp_cams.status_code == 200:
                        cameras = resp_cams.json()
                        for camera in cameras:
                            if camera.get("is_active") and camera.get("active_feed"):
                                feed = camera["active_feed"]
                                if feed.get("is_active") and feed.get("file_path"):
                                    active_feeds[camera["id"]] = (
                                        tenant_id,
                                        feed["file_path"],
                                        mode
                                    )
                except Exception as e:
                    logger.warning(f"Failed to fetch cameras for tenant {tenant_id}: {e}")

            # Stop workers that are no longer active, or whose feed path has changed
            current_camera_ids = list(self.workers.keys())
            for camera_id in current_camera_ids:
                if camera_id not in active_feeds:
                    await self.stop_worker(camera_id)
                else:
                    tenant_id, new_feed_path, mode = active_feeds[camera_id]
                    _, current_feed_path = self.workers[camera_id]
                    if new_feed_path != current_feed_path:
                        logger.info(f"Feed path changed for camera {camera_id}. Restarting worker...")
                        await self.stop_worker(camera_id)

            # Start workers for newly active camera feeds
            for camera_id, (tenant_id, feed_path, mode) in active_feeds.items():
                if camera_id not in self.workers:
                    task = asyncio.create_task(
                        camera_worker(camera_id, tenant_id, feed_path, mode)
                    )
                    self.workers[camera_id] = (task, feed_path)
