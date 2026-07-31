"""Redis and in-memory session stores with HMAC keys, CAS, locks and idempotency."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import time
from datetime import UTC, datetime, timedelta
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Protocol
from uuid import uuid4
try:
    from redis.asyncio import Redis
except ImportError:  # restricted test environments
    Redis = Any  # type: ignore[misc,assignment]
from .state import SessionState, utc_now_iso

class SessionConflictError(RuntimeError): pass
class SessionLockTimeoutError(RuntimeError): pass
class IdempotencyConflictError(RuntimeError): pass

class SessionStore(Protocol):
    async def get(self, session_id: str) -> SessionState | None: ...
    async def save(self, session: SessionState, *, expected_version: int | None = None) -> SessionState: ...
    async def delete(self, session_id: str) -> None: ...
    async def close(self) -> None: ...
    async def health(self) -> bool: ...
    @asynccontextmanager
    async def mutation_lock(self, session_id: str) -> AsyncIterator[None]: ...
    async def idempotency_get(self, session_id: str, client_message_id: str) -> dict[str, Any] | None: ...
    async def idempotency_claim(self, session_id: str, client_message_id: str, payload_hash: str) -> bool: ...
    async def idempotency_complete(self, session_id: str, client_message_id: str, payload_hash: str, response: dict[str, Any]) -> None: ...
    async def idempotency_release(self, session_id: str, client_message_id: str, payload_hash: str) -> None: ...

class RedisSessionStore:
    def __init__(self, client: Redis, *, ttl_seconds: int = 1800, absolute_ttl_seconds: int = 86400, key_prefix: str = "merinos:local:session:v1", hmac_secret: str = "local-demo-redis-key-change-me", lock_ttl_ms: int = 15000, lock_wait_ms: int = 2000, idempotency_ttl_seconds: int = 3600, max_session_bytes: int = 65536) -> None:
        self.client, self.ttl_seconds, self.absolute_ttl_seconds = client, ttl_seconds, absolute_ttl_seconds
        self.key_prefix, self.hmac_secret = key_prefix.rstrip(":"), hmac_secret.encode()
        self.lock_ttl_ms, self.lock_wait_ms, self.idempotency_ttl_seconds, self.max_session_bytes = lock_ttl_ms, lock_wait_ms, idempotency_ttl_seconds, max_session_bytes

    @classmethod
    def from_url(cls, redis_url: str, **kwargs: Any) -> "RedisSessionStore":
        if not hasattr(Redis, "from_url"):
            raise RuntimeError("Redis backend için redis paketi kurulmalıdır.")
        return cls(Redis.from_url(redis_url, decode_responses=True), **kwargs)

    def _digest(self, value: str) -> str:
        return hmac.new(self.hmac_secret, value.encode(), hashlib.sha256).hexdigest()
    def _state_key(self, session_id: str) -> str: return f"{self.key_prefix}:{{{self._digest(session_id)}}}:state"
    def _lock_key(self, session_id: str) -> str: return f"{self.key_prefix}:{{{self._digest(session_id)}}}:lock"
    def _idem_key(self, session_id: str, message_id: str) -> str: return f"{self.key_prefix}:{{{self._digest(session_id)}}}:idem:{self._digest(message_id)}"

    async def get(self, session_id: str) -> SessionState | None:
        raw = await self.client.get(self._state_key(session_id))
        if not raw:
            return None
        session = SessionState.model_validate_json(raw)
        if session.absolute_expires_at and datetime.fromisoformat(session.absolute_expires_at) <= datetime.now(UTC):
            await self.delete(session_id)
            return None
        return session

    async def save(self, session: SessionState, *, expected_version: int | None = None) -> SessionState:
        expected = session.version if expected_version is None else expected_version
        now = datetime.now(UTC)
        absolute_expires_at = session.absolute_expires_at or (now + timedelta(seconds=self.absolute_ttl_seconds)).isoformat()
        absolute_dt = datetime.fromisoformat(absolute_expires_at)
        remaining = int((absolute_dt - now).total_seconds())
        if remaining <= 0:
            await self.delete(session.session_id)
            raise SessionConflictError("Oturum mutlak yaşam süresini doldurdu.")
        effective_ttl = max(1, min(self.ttl_seconds, remaining))
        persisted = session.model_copy(update={"version": expected + 1, "updated_at": utc_now_iso(), "absolute_expires_at": absolute_expires_at}, deep=True)
        payload = persisted.model_dump_json()
        if len(payload.encode()) > self.max_session_bytes: raise ValueError("Session payload sınırı aşıldı.")
        script = """
        local current = redis.call('GET', KEYS[1])
        if current then
          local decoded = cjson.decode(current)
          if tonumber(decoded.version) ~= tonumber(ARGV[1]) then return -1 end
        elseif tonumber(ARGV[1]) ~= 0 then return -1 end
        redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
        return tonumber(ARGV[1]) + 1
        """
        result = await self.client.eval(script, 1, self._state_key(session.session_id), expected, payload, effective_ttl)
        if int(result) == -1: raise SessionConflictError("Session revision çakışması.")
        return persisted

    async def delete(self, session_id: str) -> None:
        await self.client.delete(self._state_key(session_id))
    async def health(self) -> bool:
        return bool(await self.client.ping())
    async def close(self) -> None:
        await self.client.aclose()

    @asynccontextmanager
    async def mutation_lock(self, session_id: str) -> AsyncIterator[None]:
        key, owner = self._lock_key(session_id), uuid4().hex
        deadline = time.monotonic() + self.lock_wait_ms / 1000
        acquired = False
        while time.monotonic() < deadline:
            acquired = bool(await self.client.set(key, owner, nx=True, px=self.lock_ttl_ms))
            if acquired: break
            await asyncio.sleep(0.04)
        if not acquired: raise SessionLockTimeoutError("Oturum kilidi alınamadı.")
        try: yield
        finally:
            await self.client.eval("if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end", 1, key, owner)

    async def idempotency_get(self, session_id: str, client_message_id: str) -> dict[str, Any] | None:
        raw = await self.client.get(self._idem_key(session_id, client_message_id))
        return json.loads(raw) if raw else None
    async def idempotency_claim(self, session_id: str, client_message_id: str, payload_hash: str) -> bool:
        value = json.dumps({"status": "processing", "payloadHash": payload_hash}, separators=(",", ":"))
        return bool(await self.client.set(self._idem_key(session_id, client_message_id), value, nx=True, ex=self.idempotency_ttl_seconds))
    async def idempotency_complete(self, session_id: str, client_message_id: str, payload_hash: str, response: dict[str, Any]) -> None:
        current = await self.idempotency_get(session_id, client_message_id)
        if current and current.get("payloadHash") != payload_hash: raise IdempotencyConflictError("Aynı mesaj kimliği farklı payload ile kullanıldı.")
        value = json.dumps({"status": "completed", "payloadHash": payload_hash, "response": response}, ensure_ascii=False, separators=(",", ":"))
        await self.client.set(self._idem_key(session_id, client_message_id), value, ex=self.idempotency_ttl_seconds)
    async def idempotency_release(self, session_id: str, client_message_id: str, payload_hash: str) -> None:
        key = self._idem_key(session_id, client_message_id)
        await self.client.eval("local v=redis.call('GET',KEYS[1]); if not v then return 0 end; local d=cjson.decode(v); if d.payloadHash==ARGV[1] and d.status=='processing' then return redis.call('DEL',KEYS[1]) end; return 0", 1, key, payload_hash)

class InMemorySessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._idem: dict[tuple[str, str], dict[str, Any]] = {}
    async def get(self, session_id: str) -> SessionState | None:
        session = self._sessions.get(session_id)
        return session.model_copy(deep=True) if session else None
    async def save(self, session: SessionState, *, expected_version: int | None = None) -> SessionState:
        expected = session.version if expected_version is None else expected_version
        current = self._sessions.get(session.session_id)
        current_version = current.version if current else 0
        if current_version != expected: raise SessionConflictError("Session revision çakışması.")
        absolute_expires_at = session.absolute_expires_at or (datetime.now(UTC) + timedelta(seconds=86400)).isoformat()
        if datetime.fromisoformat(absolute_expires_at) <= datetime.now(UTC):
            await self.delete(session.session_id)
            raise SessionConflictError("Oturum mutlak yaşam süresini doldurdu.")
        persisted = session.model_copy(update={"version": expected + 1, "updated_at": utc_now_iso(), "absolute_expires_at": absolute_expires_at}, deep=True)
        self._sessions[session.session_id] = persisted
        return persisted.model_copy(deep=True)
    async def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
        for key in [key for key in self._idem if key[0] == session_id]: self._idem.pop(key, None)
    async def close(self) -> None: return None
    async def health(self) -> bool: return True
    @asynccontextmanager
    async def mutation_lock(self, session_id: str) -> AsyncIterator[None]:
        lock = self._locks.setdefault(session_id, asyncio.Lock())
        async with lock: yield
    async def idempotency_get(self, session_id: str, client_message_id: str) -> dict[str, Any] | None:
        value = self._idem.get((session_id, client_message_id))
        return json.loads(json.dumps(value)) if value else None
    async def idempotency_claim(self, session_id: str, client_message_id: str, payload_hash: str) -> bool:
        key = (session_id, client_message_id)
        if key in self._idem: return False
        self._idem[key] = {"status": "processing", "payloadHash": payload_hash}
        return True
    async def idempotency_complete(self, session_id: str, client_message_id: str, payload_hash: str, response: dict[str, Any]) -> None:
        key = (session_id, client_message_id)
        current = self._idem.get(key)
        if current and current.get("payloadHash") != payload_hash: raise IdempotencyConflictError("Aynı mesaj kimliği farklı payload ile kullanıldı.")
        self._idem[key] = {"status": "completed", "payloadHash": payload_hash, "response": json.loads(json.dumps(response))}
    async def idempotency_release(self, session_id: str, client_message_id: str, payload_hash: str) -> None:
        key = (session_id, client_message_id)
        current = self._idem.get(key)
        if current and current.get("payloadHash") == payload_hash and current.get("status") == "processing":
            self._idem.pop(key, None)
