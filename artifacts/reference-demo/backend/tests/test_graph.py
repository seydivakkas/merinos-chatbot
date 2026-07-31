from __future__ import annotations

import pytest
from merinos_agent.graph import build_graph
from merinos_agent.graph_compat import USING_REAL_LANGGRAPH
from merinos_agent.session_store import InMemorySessionStore


@pytest.fixture
async def graph_fixture():
    store = InMemorySessionStore()
    return store, build_graph(store, demo_mode=True)


@pytest.mark.asyncio
async def test_product_worker_returns_structured_products(graph_fixture) -> None:
    store, graph = graph_fixture
    result = await graph.ainvoke({"session_id": "test-session-001", "user_message": "Krem 160x230 salon halısı arıyorum"})
    assert result["route"] == "product_search"
    assert result["worker_plan"] == ["product_worker"]
    assert result["reply"]["intent"] == "product"
    assert result["reply"]["products"][0]["color"] == "Krem"
    assert result["session_version"] == 1
    stored = await store.get("test-session-001")
    assert stored is not None
    assert stored.structured_memory.product_size == "160x230"
    assert "order_id" not in stored.structured_memory.model_dump()


@pytest.mark.asyncio
async def test_multiple_workers_run_in_message_order(graph_fixture) -> None:
    _, graph = graph_fixture
    result = await graph.ainvoke({"session_id": "test-session-002", "user_message": "Krem 160x230 halı ara ve İstanbul bayilerini göster"})
    assert result["worker_plan"] == ["product_worker", "dealer_worker"]
    assert [item["worker"] for item in result["worker_results"]] == ["product_worker", "dealer_worker"]
    assert "- Ürün:" in result["response"]
    assert "- Bayi:" in result["response"]


@pytest.mark.asyncio
async def test_demo_order_returns_masked_order_without_persisting_reference(graph_fixture) -> None:
    store, graph = graph_fixture
    result = await graph.ainvoke({"session_id": "test-session-003", "user_message": "MRN-2026-1042 siparişim nerede?"})
    assert result["reply"]["intent"] == "order"
    assert result["reply"]["order"]["cargoCode"].endswith("***")
    stored = await store.get("test-session-003")
    assert stored is not None
    assert "MRN-2026-1042" not in stored.summary.text
    assert "order_id" not in stored.structured_memory.model_dump()


@pytest.mark.asyncio
async def test_unknown_message_falls_back_to_safe_faq_choices(graph_fixture) -> None:
    _, graph = graph_fixture
    result = await graph.ainvoke({"session_id": "test-session-004", "user_message": "Merhaba"})
    assert result["current_intent"] == "unknown"
    assert result["worker_plan"] == ["faq_worker"]
    assert result["reply"]["actions"]
