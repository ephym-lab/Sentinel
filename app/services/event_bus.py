import json
import logging
from typing import AsyncGenerator
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)


class EventBus:
    """Asynchronous Redis Pub/Sub Event Bus for real-time notification/dashboard streaming."""

    def __init__(self, redis_url: str = settings.REDIS_URL):
        self.redis_url = redis_url
        self._redis = None

    async def get_redis(self) -> aioredis.Redis:
        """Lazily initialize and return Redis connection."""
        if self._redis is None:
            self._redis = aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
        return self._redis

    async def publish(self, channel: str, event_type: str, payload: dict):
        """Publish an event envelope to a Redis channel."""
        try:
            r = await self.get_redis()
            envelope = {
                "type": event_type,
                "payload": payload
            }
            await r.publish(channel, json.dumps(envelope))
            logger.info(f"Published '{event_type}' to channel '{channel}'")
        except Exception as e:
            logger.error(f"Failed to publish event to Redis: {e}")

    async def subscribe(self, channel: str) -> AsyncGenerator[dict, None]:
        """Subscribe to a Redis channel and yield message envelopes."""
        r = await self.get_redis()
        pubsub = r.pubsub()
        await pubsub.subscribe(channel)
        logger.info(f"Subscribed to Redis channel '{channel}'")
        
        try:
            async for message in pubsub.listen():
                if message and message["type"] == "message":
                    try:
                        envelope = json.loads(message["data"])
                        yield envelope
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON data received: {message['data']}")
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()


# Global Event Bus instance
event_bus = EventBus()
