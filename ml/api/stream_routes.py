import os
import cv2
import asyncio
import time
import logging
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from ml.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

async def video_stream_generator(request: Request, camera_id: str, file_path: str, mode: str, tenant_id: str, analysis_mode: str = "full"):
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
        cached_result = {}

        while cap.isOpened():
            if getattr(request.app.state, "is_shutting_down", False):
                break
            
            if await request.is_disconnected():
                logger.info(f"Client disconnected from stream for camera: {camera_id}")
                break

            start_t = time.perf_counter()
            ret, frame = cap.read()
            
            if not ret:
                # Loop the video continuously to simulate 24/7 camera
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
                
            frame_count += 1
            
            try:
                if frame_count % process_every_n_frames == 1 or not cached_result:
                    # NOTICE: Removed run_in_executor call here because your pipeline.process 
                    # method internalizes its own concurrent thread pool now!
                    cached_result = await pipeline.process(
                        frame=frame.copy(),  # Copy preserves contiguous memory layout
                        camera_id=camera_id,
                        mode=mode,
                        tenant_id=tenant_id,
                        audio_data=None,
                        analysis_mode=analysis_mode,
                        frame_count=frame_count
                    )
                
                result = cached_result
                
                # Draw Face boxes (Cyan)
                for face in result.get("faces", []):
                    x1, y1, x2, y2 = map(int, face["bbox"])
                    conf = int(face.get("confidence", 0) * 100)
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 255, 0), 2)
                    cv2.putText(frame, f"Face {conf}%", (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 2)
                    
                # Draw Person boxes (Green)
                for person in result.get("tracked_persons", []):
                    x1, y1, x2, y2 = map(int, person["bbox"])
                    conf = int(person.get("confidence", 0) * 100)
                    track_id = person.get("track_id", "?")
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(frame, f"Person #{track_id} {conf}%", (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                    
                # Draw General Objects (Purple)
                for obj in result.get("objects", []):
                    x1, y1, x2, y2 = map(int, obj["bbox"])
                    conf = int(obj.get("confidence", 0) * 100)
                    label = obj.get("label", "obj")
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 255), 2)
                    cv2.putText(frame, f"{label} {conf}%", (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 255), 2)
                    
                # Draw Fire (Red)
                if result.get("fire_detections"):
                    for fire in result.get("fire_detections", []):
                        x1, y1, x2, y2 = map(int, fire["bbox"])
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 3)
                        cv2.putText(frame, "FIRE", (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                        
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
async def stream_video(request: Request, camera_id: str, file_path: str, mode: str, tenant_id: str, analysis_mode: str = "full"):
    """
    MJPEG stream endpoint that feeds processed frames from ML to frontend.
    """
    return StreamingResponse(
        video_stream_generator(request, camera_id, file_path, mode, tenant_id, analysis_mode),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )