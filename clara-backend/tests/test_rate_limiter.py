import redis

from app.services.rate_limiter import InMemoryRateLimiter, RedisRateLimiter


class FakePipeline:
    def __init__(self, store: dict[str, int]) -> None:
        self._store = store
        self._ops: list[str] = []

    def incr(self, key: str) -> None:
        self._ops.append(key)

    def expire(self, key: str, seconds: int) -> None:
        self.expire_seconds = seconds

    def execute(self) -> list[int]:
        key = self._ops[0]
        self._store[key] = self._store.get(key, 0) + 1
        return [self._store[key], True]


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, int] = {}

    def pipeline(self, transaction: bool = True) -> FakePipeline:
        return FakePipeline(self.store)


class DownRedis:
    def pipeline(self, transaction: bool = True):
        raise redis.ConnectionError("redis down")


def test_in_memory_limiter_blocks_after_limit() -> None:
    limiter = InMemoryRateLimiter()

    results = [limiter.is_allowed("k", limit=2, window_seconds=60) for _ in range(3)]

    assert results == [True, True, False]


def test_redis_limiter_blocks_after_limit_and_isolates_keys() -> None:
    fake = FakeRedis()
    limiter = RedisRateLimiter("test", client_factory=lambda: fake)

    results = [limiter.is_allowed("user-a", limit=2, window_seconds=60) for _ in range(3)]

    assert results == [True, True, False]
    assert limiter.is_allowed("user-b", limit=2, window_seconds=60) is True


def test_redis_limiter_does_not_store_raw_key() -> None:
    fake = FakeRedis()
    limiter = RedisRateLimiter("login", client_factory=lambda: fake)

    limiter.is_allowed("login:1.2.3.4:person@example.com", limit=5, window_seconds=60)

    assert fake.store
    assert all("person@example.com" not in key for key in fake.store)
    assert all(key.startswith("clara:rl:login:") for key in fake.store)


def test_redis_limiter_falls_back_to_memory_when_redis_is_down() -> None:
    limiter = RedisRateLimiter("test", client_factory=lambda: DownRedis())

    results = [limiter.is_allowed("k", limit=2, window_seconds=60) for _ in range(3)]

    assert results == [True, True, False]
