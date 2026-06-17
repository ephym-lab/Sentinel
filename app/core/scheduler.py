import datetime
import logging
from sqlalchemy import select, text
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.db.session import AsyncSessionLocal
from app.models.tenant import Tenant
from app.models.incident import Incident
from app.models.notification_recipient import NotificationRecipient
from app.models.notification_log import NotificationLog
from app.services.notification_service import send_sms, initiate_voice_call
from app.core.config import settings

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def run_escalation_for_tenant(tenant: Tenant):
    """Processes alert escalations for a single tenant schema space."""
    async with AsyncSessionLocal() as db:
        try:
            if not settings.DATABASE_URL.startswith("sqlite"):
                # Dynamically set search path to isolate queries to tenant's schema
                schema_name = f"sentinel_{tenant.id}"
                await db.execute(text(f"SET search_path TO {schema_name}, sentinel_public;"))

            # 1. Fetch active incidents (not resolved)
            stmt = select(Incident).where(Incident.status != "resolved")
            result = await db.execute(stmt)
            incidents = result.scalars().all()

            now = datetime.datetime.now(datetime.timezone.utc)

            for incident in incidents:
                # Calculate elapsed time in minutes
                triggered_at = incident.triggered_at.replace(tzinfo=datetime.timezone.utc)
                elapsed_minutes = (now - triggered_at).total_seconds() / 60.0

                # Determine correct escalation tier target:
                # - Tier 1: Immediate (0 to 5 mins)
                # - Tier 2: Escalated backup (5 to 10 mins)
                # - Tier 3: High-level management (> 10 mins)
                if elapsed_minutes >= 10.0:
                    target_tier = 3
                elif elapsed_minutes >= 5.0:
                    target_tier = 2
                else:
                    target_tier = 1

                # Check if this tier has already been notified
                check_stmt = select(NotificationLog).where(
                    NotificationLog.incident_id == incident.id,
                    NotificationLog.recipient_id.in_(
                        select(NotificationRecipient.id).where(
                            NotificationRecipient.escalation_tier == target_tier
                        )
                    )
                )
                check_res = await db.execute(check_stmt)
                logs = check_res.scalars().all()

                if logs:
                    # Target tier has already been notified for this incident
                    continue

                # 2. Fetch active recipients matching the target tier
                rec_stmt = select(NotificationRecipient).where(
                    NotificationRecipient.escalation_tier == target_tier,
                    NotificationRecipient.is_active == True
                )
                rec_res = await db.execute(rec_stmt)
                recipients = rec_res.scalars().all()

                for recipient in recipients:
                    message = f"ALERT: Active {incident.incident_type.upper()} at {tenant.name}. Severity: {incident.severity.upper()}. Please respond immediately."
                    
                    # Dispatch to configured channels (sms/call)
                    for channel in recipient.channels:
                        provider_sid = None
                        status_str = "sent"

                        try:
                            if channel == "sms":
                                provider_sid = await send_sms(recipient.phone, message)
                            elif channel == "call" and incident.severity in ("high", "critical"):
                                provider_sid = await initiate_voice_call(recipient.phone, message)
                                status_str = "called"
                        except Exception as e:
                            logger.error(f"Failed to dispatch alert to {recipient.name} ({channel}): {e}")
                            status_str = "failed"

                        # Log notification
                        log = NotificationLog(
                            incident_id=incident.id,
                            recipient_id=recipient.id,
                            channel=channel,
                            status=status_str,
                            provider_sid=provider_sid
                        )
                        db.add(log)

            await db.commit()
        except Exception as e:
            logger.error(f"Escalation job error for tenant '{tenant.id}': {e}")
            await db.rollback()


async def escalate_notifications_job():
    """Background task running periodically to evaluate escalation policies across all tenants."""
    logger.info("Starting notification escalation job...")
    async with AsyncSessionLocal() as db:
        if not settings.DATABASE_URL.startswith("sqlite"):
            await db.execute(text("SET search_path TO sentinel_public;"))
        stmt = select(Tenant)
        result = await db.execute(stmt)
        tenants = result.scalars().all()

    for tenant in tenants:
        await run_escalation_for_tenant(tenant)


def start_scheduler():
    """Start the APScheduler background worker."""
    if not scheduler.running:
        scheduler.add_job(
            escalate_notifications_job,
            "interval",
            minutes=1,
            id="escalation_job",
            replace_existing=True
        )
        scheduler.start()
        logger.info("APScheduler Escalation Service started successfully.")


def shutdown_scheduler():
    """Shutdown the APScheduler background worker."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("APScheduler Escalation Service stopped.")
