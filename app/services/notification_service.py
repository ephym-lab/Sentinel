import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
import africastalking
from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize Africa's Talking SDK
try:
    if settings.AT_API_KEY != "changeme" and settings.AT_USERNAME != "sentinel":
        africastalking.initialize(username=settings.AT_USERNAME, api_key=settings.AT_API_KEY)
        sms_client = africastalking.SMS
        voice_client = africastalking.Voice
        logger.info("Africa's Talking SDK initialized successfully.")
    else:
        sms_client = None
        voice_client = None
        logger.info("Africa's Talking SDK in DRY-RUN mode.")
except Exception as e:
    logger.error(f"Failed to initialize Africa's Talking SDK: {e}")
    sms_client = None
    voice_client = None


async def send_sms(phone: str, message: str) -> str:
    """Send SMS to a phone number. If SDK is not initialized, log in dry-run mode."""
    if sms_client is None:
        logger.info(f"[SMS DRY-RUN] To: {phone} | Message: {message}")
        return "dry_run_sms_sid"
    
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor() as pool:
        try:
            # SDK syntax: sms_client.send(message, [phone])
            # This returns a dictionary with the transmission report
            response = await loop.run_in_executor(
                pool,
                lambda: sms_client.send(message, [phone])
            )
            recipients = response.get("SMSMessageData", {}).get("Recipients", [])
            if recipients:
                status = recipients[0].get("status")
                message_id = recipients[0].get("messageId")
                logger.info(f"SMS sent to {phone} with status {status}. ID: {message_id}")
                return message_id
            return "no_recipients_sid"
        except Exception as e:
            logger.error(f"Error sending SMS to {phone} via Africa's Talking: {e}")
            return "failed_sms_sid"


async def initiate_voice_call(phone: str, message: str) -> str:
    """Initiate a voice alert to a phone number (e.g. for critical alarms)."""
    if voice_client is None:
        logger.info(f"[VOICE DRY-RUN] To: {phone} | Speech: {message}")
        return "dry_run_voice_sid"

    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor() as pool:
        try:
            # SDK voice syntax: voice_client.call(from_, to_)
            # In Kenya, Africa's Talking virtual phone numbers are used.
            # We assume from_ number is configured or we use default voice caller.
            response = await loop.run_in_executor(
                pool,
                lambda: voice_client.call(phone)
            )
            logger.info(f"Voice call initiated to {phone}: {response}")
            return response.get("entries", [{}])[0].get("sessionId", "voice_sid")
        except Exception as e:
            logger.error(f"Error initiating voice call to {phone} via Africa's Talking: {e}")
            return "failed_voice_sid"
