import base64
import datetime
import logging
import uuid
from typing import Optional
import numpy as np
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.camera import Camera
from app.models.poi import POI
from app.models.poi_sighting import POISighting
from app.models.detection_event import DetectionEvent
from app.models.incident import Incident
from app.models.person import Person
from app.models.camera_rule import CameraRule
from app.models.guardian import Guardian
from app.models.journey_event import JourneyEvent
from app.services.ml_client import ml_client
from app.utils.file_manager import file_manager
from app.services.notification_service import send_sms
from app.core.config import settings

logger = logging.getLogger(__name__)


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    """Compute cosine similarity of two L2 normalized vectors (simple dot product)."""
    return float(np.dot(v1, v2))


def pad_reid_embedding(emb: list[float]) -> list[float]:
    """Pad a 512-dim Re-ID embedding to 2048-dim using zeros to match PostgreSQL schema."""
    if len(emb) >= 2048:
        return emb[:2048]
    return emb + [0.0] * (2048 - len(emb))


async def find_poi_match(
    db: AsyncSession,
    embedding: list[float],
    field: str,  # "face_embedding" or "reid_embedding"
    camera_id: str,
    threshold: float = 0.70
) -> tuple[Optional[POI], float]:
    """Find the best matching Person of Interest for an embedding using async SQLAlchemy 2.0."""
    query_emb = embedding
    if field == "reid_embedding":
        query_emb = pad_reid_embedding(embedding)

    if settings.DATABASE_URL.startswith("sqlite"):
        stmt = select(POI)
        result = await db.execute(stmt)
        all_pois = result.scalars().all()
        best_poi = None
        best_score = -1.0
        
        for poi in all_pois:
            poi_emb = getattr(poi, field)
            if poi_emb is not None:
                # Check target_cameras restriction
                if poi.target_cameras and camera_id not in poi.target_cameras:
                    continue
                    
                sim = cosine_similarity(query_emb, list(poi_emb))
                if sim > best_score:
                    best_score = sim
                    best_poi = poi
                    
        if best_score >= threshold:
            return best_poi, best_score
        return None, 0.0
        poi_column = getattr(POI, field)
        stmt = (
            select(POI, poi_column.cosine_distance(query_emb).label("distance"))
            .where(poi_column.is_not(None))
        )
        result = await db.execute(stmt)
        rows = result.all()
        
        best_poi = None
        best_distance = 2.0
        
        for p, dist in rows:
            if p.target_cameras and camera_id not in p.target_cameras:
                continue
            if dist < best_distance:
                best_distance = dist
                best_poi = p
        
        if best_poi:
            similarity = 1.0 - best_distance
            if similarity >= threshold:
                return best_poi, similarity
                
        return None, 0.0


async def find_person_match(
    db: AsyncSession,
    embedding: list[float],
    threshold: float = 0.75
) -> tuple[Optional[Person], float]:
    """Find the best matching enrolled Person (e.g. Student) for a face embedding."""
    if settings.DATABASE_URL.startswith("sqlite"):
        stmt = select(Person)
        result = await db.execute(stmt)
        all_persons = result.scalars().all()
        best_person = None
        best_score = -1.0
        
        for p in all_persons:
            if p.face_embedding is not None:
                sim = cosine_similarity(embedding, list(p.face_embedding))
                if sim > best_score:
                    best_score = sim
                    best_person = p
                    
        if best_score >= threshold:
            return best_person, best_score
        return None, 0.0
    else:
        face_col = Person.face_embedding
        stmt = (
            select(Person, face_col.cosine_distance(embedding).label("distance"))
            .where(face_col.is_not(None))
            .order_by(text("distance ASC"))
            .limit(1)
        )
        result = await db.execute(stmt)
        row = result.first()
        
        if row:
            person, distance = row
            similarity = 1.0 - distance
            if similarity >= threshold:
                return person, similarity
                
        return None, 0.0


async def process_camera_frame(
    db: AsyncSession,
    tenant_id: str,
    camera_id: str,
    image_b64: str,
    audio_b64: Optional[str] = None,
    analysis_mode: str = "full",
) -> dict:
    """Full async frame processing pipeline orchestration."""
    try:
        camera_uuid = uuid.UUID(camera_id)
    except ValueError:
        raise ValueError(f"Invalid camera UUID format: '{camera_id}'")

    # 1. Verify camera exists and is active
    stmt = select(Camera).where(Camera.id == camera_uuid, Camera.is_active == True)
    result = await db.execute(stmt)
    camera = result.scalar_one_or_none()
    if not camera:
        raise ValueError(f"Active camera '{camera_id}' not found.")

    stmt = select(Tenant).where(Tenant.id == tenant_id)
    result = await db.execute(stmt)
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise ValueError(f"Tenant '{tenant_id}' not found.")

    # 1.5 Evaluate dynamic rules for this camera
    stmt_all = select(CameraRule).where(CameraRule.camera_id == camera_uuid)
    all_rules = (await db.execute(stmt_all)).scalars().all()
    
    # If the user has created at least one rule (active or inactive), we enforce strict rule-engine logic.
    # Otherwise, fallback to the legacy environment mode.
    if len(all_rules) > 0:
        now = datetime.datetime.now().time()
        active_behaviors = set()
        
        for rule in all_rules:
            if not rule.is_active:
                continue
                
            # Time bounds check
            if rule.start_time and rule.end_time:
                if rule.start_time <= rule.end_time:
                    if not (rule.start_time <= now <= rule.end_time):
                        continue
                else: # Overnight rule (e.g. 22:00 to 06:00)
                    if not (now >= rule.start_time or now <= rule.end_time):
                        continue
                        
            if rule.behavior:
                for b in rule.behavior.split(","):
                    active_behaviors.add(b.strip())
                    
        # Convert to list for the JSON payload
        computed_mode = list(active_behaviors) if active_behaviors else ["none"]
    else:
        computed_mode = [tenant.mode]

    # 2. Call ML Service
    ml_result = await ml_client.process_frame(
        image_b64=image_b64,
        camera_id=camera_id,
        mode=computed_mode,
        tenant_id=tenant_id,
        audio_b64=audio_b64,
        analysis_mode=analysis_mode,
    )
    
    if not ml_result:
        raise RuntimeError("ML service failed to process frame.")

    # 3. Match enrolled persons (e.g. Students/VIPs) & process gate arrival notifications
    for face_emb in ml_result.get("face_embeddings", []):
        embedding = face_emb["embedding"]
        person, score = await find_person_match(db, embedding, threshold=0.75)
        if person:
            # If camera is located at a gate, record school mode journey alerts
            camera_name_lower = camera.name.lower()
            camera_loc_lower = (camera.location or "").lower()
            is_gate = "gate" in camera_name_lower or "gate" in camera_loc_lower
            
            if is_gate:
                event_type = "gate_entry"
                if "exit" in camera_name_lower or "exit" in camera_loc_lower:
                    event_type = "gate_exit"
                
                # Check for recent identical event (within last 2 minutes) to prevent duplicates
                two_mins_ago = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=2)
                dup_stmt = select(JourneyEvent).where(
                    JourneyEvent.student_id == person.id,
                    JourneyEvent.event_type == event_type,
                    JourneyEvent.detected_at >= two_mins_ago
                )
                dup_res = await db.execute(dup_stmt)
                
                if not dup_res.scalars().first():
                    # Save Journey Event
                    journey_event = JourneyEvent(
                        id=uuid.uuid4(),
                        student_id=person.id,
                        camera_id=camera.id,
                        event_type=event_type,
                        notification_sent=False
                    )
                    db.add(journey_event)
                    await db.commit()
                    
                    # Fetch student's active guardians
                    guard_stmt = select(Guardian).where(
                        Guardian.student_id == person.id,
                        Guardian.is_active == True
                    )
                    guard_res = await db.execute(guard_stmt)
                    guardians = guard_res.scalars().all()
                    
                    # Notify guardians
                    sms_sent = False
                    last_sid = None
                    for guardian in guardians:
                        # Check preferences
                        if (event_type == "gate_entry" and guardian.notify_on_arrival) or \
                           (event_type == "gate_exit" and guardian.notify_on_departure):
                            status_verb = "arrived at" if event_type == "gate_entry" else "left"
                            msg = f"Sentinel: Dear {guardian.full_name}, your child {person.full_name} has safely {status_verb} school at {datetime.datetime.now().strftime('%I:%M %p')}."
                            last_sid = await send_sms(guardian.phone, msg)
                            sms_sent = True
                            
                    if sms_sent:
                        journey_event.notification_sent = True
                        journey_event.notification_sid = last_sid
                        await db.commit()

    # 4. Match POIs (Face and Re-ID)
    poi_matches = []
    for face_emb in ml_result.get("face_embeddings", []):
        embedding = face_emb["embedding"]
        poi, score = await find_poi_match(db, embedding, "face_embedding", camera_id, threshold=0.75)
        if poi:
            poi_matches.append({
                "poi_id": poi.id,
                "poi_name": poi.label,
                "match_type": "face_recognition",
                "confidence": round(score, 4),
                "bbox": face_emb["bbox"]
            })

    for reid_emb in ml_result.get("reid_embeddings", []):
        embedding = reid_emb["embedding"]
        poi, score = await find_poi_match(db, embedding, "reid_embedding", camera_id, threshold=0.65)
        if poi:
            poi_matches.append({
                "poi_id": poi.id,
                "poi_name": poi.label,
                "match_type": "reid",
                "confidence": round(score, 4),
                "track_id": reid_emb["track_id"]
            })

    # 5. Save evidence snapshots if needed
    threat_info = ml_result.get("threat", {"is_threat": False, "fused_score": 0.0})
    is_fire = len(ml_result.get("fire_detections", [])) > 0
    has_poi = len(poi_matches) > 0
    
    should_raise_incident = threat_info["is_threat"] or is_fire or has_poi
    snapshot_path = None

    if should_raise_incident:
        try:
            image_data = base64.b64decode(image_b64)
            snapshot_path = file_manager.save_file(
                tenant_id=tenant_id,
                camera_id=camera_id,
                incident_type="incidents",
                file_bytes=image_data,
                extension="jpg",
                prefix="incident"
            )
        except Exception as e:
            logger.error(f"Failed to save snapshot: {e}")

    # 6. Insert DetectionEvents
    detection_event_ids = []
    trigger = "suspicious"
    threat_level = "low"
    description_parts = []

    if is_fire:
        trigger = "fire"
        threat_level = "critical"
        description_parts.append("Fire or smoke detected.")
        event_record = DetectionEvent(
            id=uuid.uuid4(),
            camera_id=camera_uuid,
            event_type="smoke_visual",
            confidence_score=1.0,
            clip_path=None,
            metadata_log={"detail": "Smoke visual detection"}
        )
        db.add(event_record)
        detection_event_ids.append(str(event_record.id))

    behaviors = ml_result.get("behaviors", [])
    for b in behaviors:
        trigger = b["behavior"]
        threat_level = b["severity"]
        description_parts.append(f"Behavior: {trigger} ({threat_level}).")
        event_record = DetectionEvent(
            id=uuid.uuid4(),
            camera_id=camera_uuid,
            event_type=trigger,
            confidence_score=b.get("confidence", 1.0),
            metadata_log=b
        )
        db.add(event_record)
        detection_event_ids.append(str(event_record.id))

    audio_events = ml_result.get("audio_events", [])
    for a in audio_events:
        trigger = "scream_audio"
        threat_level = "high"
        description_parts.append(f"Audio event: {a['event']}.")
        event_record = DetectionEvent(
            id=uuid.uuid4(),
            camera_id=None,
            event_type=a["event"],
            confidence_score=a.get("confidence", 1.0),
            metadata_log=a
        )
        db.add(event_record)
        detection_event_ids.append(str(event_record.id))

    for m in poi_matches:
        description_parts.append(f"POI Detected: {m['poi_name']}.")
        if threat_level in ("low", "medium"):
            threat_level = "high"
        
        sighting_record = POISighting(
            id=uuid.uuid4(),
            poi_id=m["poi_id"],
            camera_id=camera_uuid,
            match_type=m["match_type"],
            match_score=m["confidence"],
            emotion=ml_result.get("emotion"),
            behavior=trigger if behaviors else None,
            snapshot_path=snapshot_path
        )
        db.add(sighting_record)
        
        event_record = DetectionEvent(
            id=uuid.uuid4(),
            camera_id=camera_uuid,
            event_type="poi_alert" if m["match_type"] == "face_recognition" else "reid_alert",
            confidence_score=m["confidence"],
            metadata_log={"poi_id": str(m["poi_id"]), "poi_name": m["poi_name"]}
        )
        db.add(event_record)
        detection_event_ids.append(str(event_record.id))

    incident_record = None
    if should_raise_incident:
        await db.commit()

        incident_id = uuid.uuid4()
        description = " ".join(description_parts)
        incident_record = Incident(
            id=incident_id,
            title=f"New {trigger.replace('_', ' ').title()} Alert",
            incident_type=trigger if trigger in ("fire", "fight", "panic", "intrusion", "lost_child", "poi_alert", "medical", "shoplifting", "crowd_crush") else "poi_alert" if has_poi else "panic",
            severity=threat_level,
            status="active",
            trigger_events=detection_event_ids,
            snapshot_path=snapshot_path
        )
        db.add(incident_record)
        await db.commit()
        await db.refresh(incident_record)

    return {
        "camera_id": camera_id,
        "threat_score": threat_info["fused_score"],
        "is_threat": threat_info["is_threat"],
        "poi_detected": has_poi,
        "poi_matches": poi_matches,
        "incident_created": incident_record is not None,
        "incident": {
            "id": str(incident_record.id),
            "title": incident_record.title,
            "severity": incident_record.severity,
            "incident_type": incident_record.incident_type,
            "trigger_events": incident_record.trigger_events,
            "snapshot_path": incident_record.snapshot_path,
            "triggered_at": incident_record.triggered_at.isoformat()
        } if incident_record else None,
        "ml_raw_metrics": {
            "faces_count": len(ml_result.get("faces", [])),
            "faces": ml_result.get("faces", []),
            "persons_count": len(ml_result.get("tracked_persons", [])),
            "tracked_persons": ml_result.get("tracked_persons", []),
            "fire_detections": ml_result.get("fire_detections", []),
            "behaviors": ml_result.get("behaviors", []),
            "fire_detected": is_fire,
            "audio_events": ml_result.get("audio_events", []),
            "objects": ml_result.get("objects", []),
            "object_count": ml_result.get("object_count", len(ml_result.get("objects", []))),
            "analysis_mode": ml_result.get("analysis_mode", analysis_mode),
        }
    }
