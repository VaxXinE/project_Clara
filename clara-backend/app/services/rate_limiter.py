import hashlib
import logging
import time
from collections import defaultdict, deque
from collections.abc import Callable

import redis

from app.core.config import settings

logger = logging.getLogger("clara.rate_limiter")


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._requests: dict[str, deque[float]] = defaultdict(deque)

    def is_allowed(self, key: str, limit: int, window_seconds: int) -> bool:
        now = time.time()
        request_times = self._requests[key]

        while request_times and now - request_times[0] > window_seconds:
            request_times.popleft()

        if len(request_times) >= limit:
            return False

        request_times.append(now)
        return True


class RedisRateLimiter:
    """Fixed-window counter di Redis, dibagi antar worker dan tahan restart.

    Kalau Redis tidak terjangkau, jatuh ke limiter in-memory supaya API tetap hidup.
    """

    def __init__(
        self,
        namespace: str,
        client_factory: Callable[[], redis.Redis] | None = None,
    ) -> None:
        self._namespace = namespace
        self._client_factory = client_factory or _default_client
        self._fallback = InMemoryRateLimiter()

    def is_allowed(self, key: str, limit: int, window_seconds: int) -> bool:
        window = int(time.time() // window_seconds)
        # Key di-hash agar email/IP tidak tersimpan polos di Redis.
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        redis_key = f"clara:rl:{self._namespace}:{digest}:{window}"

        try:
            pipeline = self._client_factory().pipeline(transaction=True)
            pipeline.incr(redis_key)
            pipeline.expire(redis_key, window_seconds * 2)
            count, _ = pipeline.execute()
        except (redis.RedisError, OSError):
            logger.warning(
                "rate_limiter_redis_unavailable",
                extra={"namespace": self._namespace},
            )
            return self._fallback.is_allowed(key, limit, window_seconds)

        return int(count) <= limit


_redis_client: redis.Redis | None = None


def _default_client() -> redis.Redis:
    global _redis_client

    if _redis_client is None:
        _redis_client = redis.Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=0.25,
            socket_timeout=0.25,
        )

    return _redis_client


def build_rate_limiter(namespace: str) -> InMemoryRateLimiter | RedisRateLimiter:
    if settings.rate_limit_backend == "redis":
        return RedisRateLimiter(namespace)

    return InMemoryRateLimiter()


login_rate_limiter = build_rate_limiter("login")
sgcc_integration_rate_limiter = build_rate_limiter("sgcc")
live_chat_webhook_rate_limiter = build_rate_limiter("live_chat")
sso_rate_limiter = build_rate_limiter("sso")
extension_rate_limiter = build_rate_limiter("extension")
