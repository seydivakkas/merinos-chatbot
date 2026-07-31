"""İsteğe bağlı, LangGraph-native Redis checkpointer yaşam döngüsü."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator, Any


@asynccontextmanager
async def open_redis_checkpointer(
    redis_url: str,
) -> AsyncIterator[Any]:
    """Redis 8/Redis Stack üzerinde checkpoint şemasını hazırlar.

    Bu modül yalnızca ``checkpoint`` extra'sı kurulduğunda kullanılır:
    ``pip install -e '.[checkpoint]'``.
    """

    from langgraph.checkpoint.redis.aio import AsyncRedisSaver

    async with AsyncRedisSaver.from_conn_string(redis_url) as checkpointer:
        await checkpointer.asetup()
        yield checkpointer

