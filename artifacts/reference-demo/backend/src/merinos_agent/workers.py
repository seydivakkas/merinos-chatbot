"""Isolated specialist Worker subgraphs backed by typed demo repositories."""
from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any
from .graph_compat import END, START, StateGraph
from .demo_repository import get_order, mask_cargo, match_faq, search_dealers, search_products
from .state import WorkerResult, WorkerState

WorkerNode = Callable[[WorkerState], Awaitable[dict[str, Any]]]

def _trace(state: WorkerState, node_name: str) -> list[str]:
    return [*state.get("trace", []), node_name]

def _compile_worker(*, prepare_name: str, prepare: WorkerNode, execute_name: str, execute: WorkerNode):
    builder = StateGraph(WorkerState)
    builder.add_node(prepare_name, prepare); builder.add_node(execute_name, execute)
    builder.add_edge(START, prepare_name); builder.add_edge(prepare_name, execute_name); builder.add_edge(execute_name, END)
    return builder.compile()

def _product_worker():
    async def prepare_filters(state: WorkerState) -> dict[str, Any]:
        slots = state.get("relevant_slots", {})
        return {"prepared": {"query": state.get("user_message", ""), "categories": [slots["category"]] if slots.get("category") else [], "colors": [slots["color"]] if slots.get("color") else [], "sizes": [slots["size"]] if slots.get("size") else [], "collections": [slots["collection"]] if slots.get("collection") else []}, "trace": _trace(state, "product_worker.prepare_filters")}
    async def search_catalog(state: WorkerState) -> dict[str, Any]:
        prepared = state.get("prepared", {})
        result_data = search_products(query=prepared.get("query", ""), categories=prepared.get("categories"), colors=prepared.get("colors"), sizes=prepared.get("sizes"), collections=prepared.get("collections"), limit=4)
        if result_data["items"]:
            result = WorkerResult(worker="product_worker", status="ok", message=f"{result_data['total']} eşleşme bulundu. En uygun demo ürünleri gösteriyorum.", data={"kind": "product", **result_data})
        else:
            result = WorkerResult(worker="product_worker", status="not_found", message="Bu ölçütlerle eşleşen demo ürün bulunamadı.", data={"kind": "product", **result_data})
        return {"result": result.model_dump(mode="json"), "trace": _trace(state, "product_worker.search_catalog")}
    return _compile_worker(prepare_name="prepare_filters", prepare=prepare_filters, execute_name="search_catalog", execute=search_catalog)

def _order_worker(demo_mode: bool):
    async def validate_reference(state: WorkerState) -> dict[str, Any]:
        order_id = state.get("relevant_slots", {}).get("order_id")
        return {"prepared": {"order_id": order_id}, "trace": _trace(state, "order_worker.validate_reference")}
    async def query_order(state: WorkerState) -> dict[str, Any]:
        order_id = state.get("prepared", {}).get("order_id")
        if not order_id:
            result = WorkerResult(worker="order_worker", status="needs_input", message="Sipariş numarasını MRN-YYYY-NNNN biçiminde yazın.", data={"kind": "order", "actions": [{"label": "MRN-2026-1042", "value": "MRN-2026-1042"}, {"label": "MRN-2026-2048", "value": "MRN-2026-2048"}]})
        elif not demo_mode:
            result = WorkerResult(worker="order_worker", status="requires_verification", message="Gerçek sipariş sorgusu için kimlik ve sipariş sahipliği doğrulaması gerekir.", data={"kind": "order"})
        else:
            order = get_order(order_id)
            if not order:
                result = WorkerResult(worker="order_worker", status="not_found", message="Bu numarayla eşleşen demo sipariş bulunamadı.", data={"kind": "order"})
            else:
                safe_order = dict(order)
                if safe_order.get("cargoCode"): safe_order["cargoCode"] = mask_cargo(safe_order["cargoCode"])
                result = WorkerResult(worker="order_worker", status="ok", message="Demo sipariş kaydı bulundu. Tahmini tarihler garanti değildir.", data={"kind": "order", "order": safe_order})
        return {"result": result.model_dump(mode="json"), "trace": _trace(state, "order_worker.query_order")}
    return _compile_worker(prepare_name="validate_reference", prepare=validate_reference, execute_name="query_order", execute=query_order)

def _dealer_worker():
    async def resolve_location(state: WorkerState) -> dict[str, Any]:
        slots = state.get("relevant_slots", {})
        return {"prepared": {"city": slots.get("city"), "district": slots.get("district")}, "trace": _trace(state, "dealer_worker.resolve_location")}
    async def find_dealers(state: WorkerState) -> dict[str, Any]:
        prepared = state.get("prepared", {})
        if not prepared.get("city") and not prepared.get("district"):
            result = WorkerResult(worker="dealer_worker", status="needs_input", message="Satış noktası bulmak için şehir veya ilçe yazın.", data={"kind": "dealer", "actions": [{"label": city, "value": f"{city} bayilerini göster"} for city in ("Gaziantep", "İstanbul", "Ankara", "Bursa")]})
        else:
            items = search_dealers(city=prepared.get("city"), district=prepared.get("district"), limit=6)
            result = WorkerResult(worker="dealer_worker", status="ok" if items else "not_found", message=f"{len(items)} temsili satış noktası bulundu." if items else "Bu bölgede demo satış noktası bulunamadı.", data={"kind": "dealer", "dealers": items})
        return {"result": result.model_dump(mode="json"), "trace": _trace(state, "dealer_worker.search_dealers")}
    return _compile_worker(prepare_name="resolve_location", prepare=resolve_location, execute_name="search_dealers", execute=find_dealers)

def _faq_worker():
    async def select_topic(state: WorkerState) -> dict[str, Any]:
        return {"prepared": {"query": state.get("user_message", "")}, "trace": _trace(state, "faq_worker.select_topic")}
    async def retrieve_answer(state: WorkerState) -> dict[str, Any]:
        match = match_faq(state.get("prepared", {}).get("query", ""))
        if match["match"]:
            faq = match["match"]
            result = WorkerResult(worker="faq_worker", status="ok", message=faq["answer"], data={"kind": "faq", "faq": faq})
        else:
            suggestions = match["suggestions"]
            result = WorkerResult(worker="faq_worker", status="needs_input", message="Soruyu güvenli biçimde eşleştiremedim. Onaylı konulardan birini seçin.", data={"kind": "faq", "actions": [{"label": faq["question"], "value": faq["question"]} for faq in suggestions]})
        return {"result": result.model_dump(mode="json"), "trace": _trace(state, "faq_worker.retrieve_answer")}
    return _compile_worker(prepare_name="select_topic", prepare=select_topic, execute_name="retrieve_answer", execute=retrieve_answer)

def build_worker_graphs(*, demo_mode: bool = True) -> dict[str, Any]:
    return {"product_worker": _product_worker(), "order_worker": _order_worker(demo_mode), "dealer_worker": _dealer_worker(), "faq_worker": _faq_worker()}
