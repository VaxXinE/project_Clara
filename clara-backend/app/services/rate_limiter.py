import time
from collections import defaultdict, deque


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


login_rate_limiter = InMemoryRateLimiter()