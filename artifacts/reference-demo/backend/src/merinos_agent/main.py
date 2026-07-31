"""Redis destekli örnek Merinos chatbot CLI uygulaması."""

from __future__ import annotations

import argparse
import asyncio
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator
from uuid import uuid4

from redis.exceptions import RedisError

from .checkpointing import open_redis_checkpointer
from .config import Settings
from .graph import build_graph
from .session_store import RedisSessionStore
from .state import TokenBudget


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Merinos LangGraph + Redis chatbot şablonu",
    )
    parser.add_argument(
        "--session-id",
        default=f"demo-{uuid4()}",
        help="Aynı değer kullanıldığında Redis oturumu devam eder.",
    )
    parser.add_argument(
        "--with-checkpoints",
        action="store_true",
        help="LangGraph-native Redis checkpoint katmanını da etkinleştirir.",
    )
    return parser.parse_args()


@asynccontextmanager
async def _optional_checkpointer(
    enabled: bool,
    redis_url: str,
) -> AsyncIterator[Any | None]:
    if not enabled:
        yield None
        return
    async with open_redis_checkpointer(redis_url) as checkpointer:
        yield checkpointer


async def _chat(args: argparse.Namespace) -> None:
    settings = Settings.from_env()
    store = RedisSessionStore.from_url(
        settings.redis_url,
        ttl_seconds=settings.session_ttl_seconds,
    )
    budget = TokenBudget(
        context_window_tokens=settings.context_window_tokens,
        max_output_tokens=settings.max_output_tokens,
        safety_margin_tokens=settings.safety_margin_tokens,
        compression_trigger_ratio=settings.compression_trigger_ratio,
        recent_messages_to_keep=settings.recent_messages_to_keep,
    )

    try:
        await store.client.ping()
        async with _optional_checkpointer(
            args.with_checkpoints,
            settings.redis_url,
        ) as checkpointer:
            graph = build_graph(store, checkpointer=checkpointer)
            graph_config = {
                "configurable": {
                    "thread_id": args.session_id,
                }
            }

            print(f"Oturum: {args.session_id}")
            print("Çıkış için 'çıkış' yazın.\n")

            while True:
                text = (
                    await asyncio.to_thread(input, "Siz: ")
                ).strip()
                if text.casefold() in {"çıkış", "cikis", "exit", "quit"}:
                    break
                if not text:
                    continue

                result = await graph.ainvoke(
                    {
                        "session_id": args.session_id,
                        "user_message": text,
                        "token_budget": budget.model_dump(mode="json"),
                    },
                    config=graph_config,
                )
                print(f"Asistan: {result['response']}")
                print(
                    "Akış: "
                    + " -> ".join(result["transition_trace"])
                )
                print(
                    "Token: "
                    f"{result['token_usage']['before']} -> "
                    f"{result['token_usage']['after']} | "
                    f"session v{result['session_version']}\n"
                )
    finally:
        await store.close()


def run() -> None:
    args = _arguments()
    try:
        asyncio.run(_chat(args))
    except RedisError as error:
        raise SystemExit(
            "Redis bağlantısı kurulamadı. Önce "
            "`docker compose up -d redis` komutunu çalıştırın. "
            f"Ayrıntı: {error}"
        ) from error


if __name__ == "__main__":
    run()

