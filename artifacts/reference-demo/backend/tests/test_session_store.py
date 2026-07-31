from __future__ import annotations

import asyncio
import pytest
from merinos_agent.session_store import InMemorySessionStore, SessionConflictError
from merinos_agent.state import SessionState


@pytest.mark.asyncio
async def test_in_memory_cas_and_deep_copy() -> None:
    store = InMemorySessionStore()
    saved = await store.save(SessionState(session_id="session-123456"), expected_version=0)
    assert saved.version == 1
    loaded = await store.get("session-123456")
    assert loaded is not None and loaded.version == 1
    with pytest.raises(SessionConflictError):
        await store.save(SessionState(session_id="session-123456", version=0), expected_version=0)


@pytest.mark.asyncio
async def test_idempotency_claim_complete_and_conflict() -> None:
    store = InMemorySessionStore()
    assert await store.idempotency_claim("session-123456", "message-0001", "hash-a") is True
    assert await store.idempotency_claim("session-123456", "message-0001", "hash-a") is False
    await store.idempotency_complete("session-123456", "message-0001", "hash-a", {"reply": "ok"})
    value = await store.idempotency_get("session-123456", "message-0001")
    assert value == {"status": "completed", "payloadHash": "hash-a", "response": {"reply": "ok"}}


@pytest.mark.asyncio
async def test_mutation_lock_serializes_updates() -> None:
    store = InMemorySessionStore()
    order: list[int] = []
    async def worker(index: int) -> None:
        async with store.mutation_lock("session-123456"):
            order.append(index)
            await asyncio.sleep(0.01)
            order.append(index)
    await asyncio.gather(worker(1), worker(2))
    assert order in ([1, 1, 2, 2], [2, 2, 1, 1])
