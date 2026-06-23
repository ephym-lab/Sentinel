import os
import cv2
import asyncio
import time
import logging
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from ml.config import settings

logger = logging.getLogger(__name__)

import datetime
import httpx
from fastapi import APIRouter, Request, Query

router = APIRouter()

async def video_stream_generator(request: Request, camera_id: str, file_path: str, mode: list[str], tenant_id: str, analysis_mode: str = "full"):
    """
    Reads video frames from disk, runs ML inference asynchronously, 
    annotates bounding boxes, and yields JPEG bytes for an MJPEG stream.
    """
    abs_path = os.path.join(settings.UPLOADS_DIR, file_path)
    if not os.path.exists(abs_path):
        logger.error(f"Stream feed file not found: {abs_path}")
        yield b""
        return

    cap = cv2.VideoCapture(abs_path)
    if not cap.isOpened():
        logger.error(f"Failed to open stream feed: {abs_path}")
        yield b""
        return

    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        if not fps or fps <= 0:
            fps = 25.0
        frame_time = 1.0 / fps

        pipeline = None
        if hasattr(request.app.state, "pipeline"):
            pipeline = request.app.state.pipeline
        else:
            from ml.pipeline.frame_pipeline import FramePipeline
            pipeline = FramePipeline(request.app.state.model_registry)
            request.app.state.pipeline = pipeline

        frame_count = 0
        process_every_n_frames = 3  # Run inference every 3 frames to boost stream FPS
        current_mode = list(mode)
        cached_result = None

        async def poll_active_rules():
            nonlocal current_mode
            try:
                # Poll backend for camera rules
                backend_url = os.environ.get("BACKEND_URL", "http://localhost:8000")
                async with httpx.AsyncClient() as client:
                    res = await client.get(
                        f"{backend_url}/api/v1/cameras/{camera_id}/rules",
                        headers={"X-Tenant-ID": tenant_id},
                        timeout=2.0
                    )
                    if res.status_code == 200:
                        rules = res.json()
                        if len(rules) > 0:
                            now = datetime.datetime.now().time()
                            active_behaviors = set()
                            for r in rules:
                                if not r.get("is_active"): continue
                                
                                # Time bounds check
                                st_str = r.get("start_time")
                                et_str = r.get("end_time")
                                if st_str and et_str:
                                    st = datetime.datetime.strptime(st_str, "%H:%M:%S").time()
                                    et = datetime.datetime.strptime(et_str, "%H:%M:%S").time()
                                    if st <= et:
                                        if not (st <= now <= et): continue
                                    else:
                                        if not (now >= st or now <= et): continue
                                
                                beh = r.get("behavior")
                                if beh:
                                    if isinstance(beh, list):
                                        for b in beh:
                                            active_behaviors.add(str(b).strip())
                                    elif isinstance(beh, str):
                                        for b in beh.split(","):
                                            active_behaviors.add(b.strip())
                            
                            current_mode = list(active_behaviors) if active_behaviors else ["none"]
                        else:
                            current_mode = list(mode) # fallback
            except Exception as e:
                pass # fail silently to avoid crashing stream

        while cap.isOpened():
            if getattr(request.app.state, "is_shutting_down", False):
                break
            
            if await request.is_disconnected():
                logger.info(f"Client disconnected from stream for camera: {camera_id}")
                break

            # Poll rules every 5 seconds (roughly)
            if frame_count % (int(fps) * 5) == 0:
                asyncio.create_task(poll_active_rules())

            start_t = time.perf_counter()
            ret, frame = cap.read()
            
            if not ret:
                # Loop the video continuously to simulate 24/7 camera
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                await asyncio.sleep(0.1)
                continue
                
            frame_count += 1
            
            try:
                if frame_count % process_every_n_frames == 1 or not cached_result:
                    # NOTICE: Removed run_in_executor call here because your pipeline.process 
                    # method internalizes its own concurrent thread pool now!
                    cached_result = await pipeline.process(
                        frame=frame.copy(),
                        camera_id=camera_id,
                        mode=current_mode,
                        tenant_id=tenant_id,
                        audio_data=None,
                        analysis_mode=analysis_mode,
                        frame_count=frame_count
                    )
                
                result = cached_result
                
                from ml.utils.image_utils import annotate_frame
                frame = annotate_frame(frame, result)
                        
            except Exception as e:
                logger.error(f"Stream processing error: {e}", exc_info=True)
                
            # Encode annotated frame
            success, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if not success:
                continue
                
            frame_bytes = buffer.tobytes()
            
            # Yield multipart boundary frame
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                   
            # Control framerate to mimic real live playback
            elapsed = time.perf_counter() - start_t
            if elapsed < frame_time:
                await asyncio.sleep(frame_time - elapsed)
            else:
                # Yield control to event loop briefly even if running behind
                await asyncio.sleep(0)

    finally:
        # Guaranteed cleanup block prevents video file lock/leakage
        cap.release()
        logger.info(f"Video capture resources released for camera: {camera_id}")

@router.get("")
async def stream_video(request: Request, camera_id: str, file_path: str, tenant_id: str, mode: list[str] = Query(default=["none"]), analysis_mode: str = "full"):
    """
    MJPEG stream endpoint that feeds processed frames from ML to frontend.
    """
    return StreamingResponse(
        video_stream_generator(request, camera_id, file_path, mode, tenant_id, analysis_mode),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )