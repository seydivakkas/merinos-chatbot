"""Typed LangGraph Supervisor–Worker orchestration for four MVP domains."""
from __future__ import annotations

import re
import unicodedata
from typing import Any
from .graph_compat import END, START, StateGraph
from .context_manager import compress_context
from .session_store import SessionStore
from .state import ChatMessage, GraphState, Intent, SessionState, StructuredMemory, SummaryArtifact, TokenBudget, WorkerName, WorkerResult
from .workers import build_worker_graphs

ORDER_PATTERN = re.compile(r"\bMRN[-\s_–—]?(20\d{2})[-\s_–—]?(\d{4})\b", re.IGNORECASE)
SIZE_PATTERN = re.compile(r"\b(\d{2,3})\s*[x×]\s*(\d{2,3})\b")
COLORS = ("krem", "mavi", "gri", "bej", "antrasit", "yesil", "kirmizi", "siyah")
CATEGORIES = {"salon": "Salon Halısı", "oturma": "Oturma Odası", "yatak": "Yatak Odası", "koridor": "Koridor", "yolluk": "Koridor"}
CITIES = {"istanbul": "İstanbul", "ankara": "Ankara", "bursa": "Bursa", "gaziantep": "Gaziantep"}
WORKER_TO_INTENT: dict[WorkerName, Intent] = {"product_worker": "product_search", "order_worker": "order_status", "dealer_worker": "dealer_search", "faq_worker": "faq"}
WORKER_SLOT_ALLOWLIST: dict[WorkerName, tuple[str, ...]] = {"product_worker": ("category", "color", "size", "collection"), "order_worker": ("order_id",), "dealer_worker": ("city", "district"), "faq_worker": ("faq_topic",)}
MAX_PLAN_STEPS = 4

def _plain(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.casefold())
    return "".join(char for char in normalized if not unicodedata.combining(char))

def _next_trace(state: GraphState, node_name: str) -> list[str]: return [*state.get("transition_trace", []), node_name]

def _extract_slots(message: str, existing: dict[str, str]) -> dict[str, str]:
    slots = dict(existing); plain = _plain(message)
    for color in COLORS:
        if color in plain: slots["color"] = color.capitalize() if color != "antrasit" else "Antrasit"; break
    for keyword, category in CATEGORIES.items():
        if keyword in plain: slots["category"] = category; break
    size = SIZE_PATTERN.search(plain)
    if size: slots["size"] = f"{int(size.group(1))}x{int(size.group(2))}"
    order = ORDER_PATTERN.search(message)
    if order: slots["order_id"] = f"MRN-{order.group(1)}-{order.group(2)}"
    for city, display in CITIES.items():
        if city in plain: slots["city"] = display; break
    faq_topics = {"iade": "return", "degisim": "return", "temiz": "cleaning", "bakim": "cleaning", "teslimat": "delivery", "stok": "stock", "olcu": "measure"}
    for keyword, topic in faq_topics.items():
        if keyword in plain: slots["faq_topic"] = topic; break
    return slots

def _first_position(text: str, candidates: tuple[str, ...]) -> int | None:
    found = [text.find(candidate) for candidate in candidates if text.find(candidate) >= 0]
    return min(found) if found else None

def _plan_workers(message: str) -> list[WorkerName]:
    plain = _plain(message); candidates: list[tuple[int, WorkerName]] = []
    order_pos = _first_position(plain, ("siparis", "kargo", "teslimat")); order_match = ORDER_PATTERN.search(message)
    if order_match: order_pos = min(order_pos if order_pos is not None else order_match.start(), order_match.start())
    if order_pos is not None: candidates.append((order_pos, "order_worker"))
    dealer_pos = _first_position(plain, ("bayi", "magaza", "satis noktasi", "en yakin"))
    if dealer_pos is not None or any(city in plain for city in CITIES): candidates.append((dealer_pos if dealer_pos is not None else len(plain), "dealer_worker"))
    product_pos = _first_position(plain, (*COLORS, *CATEGORIES.keys(), "urun", "hali", "koleksiyon", "model")); size = SIZE_PATTERN.search(plain)
    if size: product_pos = min(product_pos if product_pos is not None else size.start(), size.start())
    if product_pos is not None: candidates.append((product_pos, "product_worker"))
    faq_pos = _first_position(plain, ("iade", "degisim", "temiz", "bakim", "garanti", "sss", "sik sorulan"))
    if faq_pos is not None: candidates.append((faq_pos, "faq_worker"))
    if not candidates: return ["faq_worker"]
    ordered: list[WorkerName] = []
    for _, worker in sorted(candidates, key=lambda item: item[0]):
        if worker not in ordered: ordered.append(worker)
    return ordered[:MAX_PLAN_STEPS]

def _token_budget(state: GraphState) -> TokenBudget: return TokenBudget.model_validate(state.get("token_budget", {}))

def _safe_memory(slots: dict[str, str]) -> StructuredMemory:
    return StructuredMemory(product_category=slots.get("category"), product_color=slots.get("color"), product_size=slots.get("size"), dealer_city=slots.get("city"), faq_topic=slots.get("faq_topic"))

def _reply_from_results(results: list[WorkerResult], response: str) -> dict[str, Any]:
    reply: dict[str, Any] = {"text": response, "intent": None}
    if len(results) == 1:
        result = results[0]; reply["intent"] = {"product_worker": "product", "order_worker": "order", "dealer_worker": "dealer", "faq_worker": "faq"}[result.worker]
        data = result.data
        if data.get("kind") == "product": reply["products"] = data.get("items"); reply["actions"] = data.get("suggestions") or data.get("actions")
        elif data.get("kind") == "order": reply["order"] = data.get("order"); reply["actions"] = data.get("actions")
        elif data.get("kind") == "dealer": reply["dealers"] = data.get("dealers"); reply["actions"] = data.get("actions")
        elif data.get("kind") == "faq": reply["faq"] = data.get("faq"); reply["actions"] = data.get("actions")
    return {key: value for key, value in reply.items() if value is not None}

def build_graph(session_store: SessionStore, *, checkpointer: Any | None = None, demo_mode: bool = True):
    worker_graphs = build_worker_graphs(demo_mode=demo_mode)
    async def load_session(state: GraphState) -> dict[str, Any]:
        session = await session_store.get(state["session_id"])
        if session is None: session = SessionState(session_id=state["session_id"], token_budget=_token_budget(state))
        budget = TokenBudget.model_validate(state.get("token_budget")) if state.get("token_budget") else session.token_budget
        message = ChatMessage(role="user", content=state["user_message"].strip())
        history = [item.model_dump(mode="json") for item in session.chat_history] + [message.model_dump(mode="json")]
        memory = session.structured_memory.model_dump(exclude_none=True)
        slots = {"category": memory.get("product_category"), "color": memory.get("product_color"), "size": memory.get("product_size"), "city": memory.get("dealer_city"), "faq_topic": memory.get("faq_topic")}
        return {"current_intent": session.current_intent, "slots": {k:v for k,v in slots.items() if v}, "structured_memory": memory, "chat_history": history, "summary": session.summary.model_dump(mode="json"), "token_budget": budget.model_dump(mode="json"), "worker_plan": [], "worker_results": [], "supervisor_decision": "", "transition_trace": ["load_session"], "session_version": session.version, "session_created_at": session.created_at, "session_updated_at": session.updated_at}
    async def supervisor_plan(state: GraphState) -> dict[str, Any]:
        plan = _plan_workers(state["user_message"]); first = plan[0]; slots = _extract_slots(state["user_message"], state.get("slots", {})); intent = WORKER_TO_INTENT[first]
        return {"current_intent": "unknown" if plan == ["faq_worker"] and "faq_topic" not in slots else intent, "route": intent, "slots": slots, "structured_memory": _safe_memory(slots).model_dump(exclude_none=True), "worker_plan": plan, "worker_cursor": 0, "next_worker": first, "worker_results": [], "supervisor_decision": f"dispatch:{first}", "transition_trace": _next_trace(state, "supervisor_plan")}
    def make_worker_node(worker: WorkerName):
        async def run_worker(state: GraphState) -> dict[str, Any]:
            slots = state.get("slots", {}); relevant = {key: slots[key] for key in WORKER_SLOT_ALLOWLIST[worker] if key in slots}
            summary = SummaryArtifact.model_validate(state.get("summary", {}))
            output = await worker_graphs[worker].ainvoke({"worker": worker, "user_message": state["user_message"], "relevant_slots": relevant, "context_summary": summary.text, "trace": []})
            result = WorkerResult.model_validate(output["result"])
            return {"worker_results": [*state.get("worker_results", []), result.model_dump(mode="json")], "transition_trace": [*state.get("transition_trace", []), *output.get("trace", [])]}
        return run_worker
    async def supervisor_review(state: GraphState) -> dict[str, Any]:
        cursor = state.get("worker_cursor", 0) + 1; plan = state.get("worker_plan", [])
        next_worker = plan[cursor] if cursor < len(plan) else "finish"
        return {"worker_cursor": cursor, "next_worker": next_worker, "supervisor_decision": f"dispatch:{next_worker}" if next_worker != "finish" else "synthesize", "transition_trace": _next_trace(state, "supervisor_review")}
    async def supervisor_synthesize(state: GraphState) -> dict[str, Any]:
        results = [WorkerResult.model_validate(raw) for raw in state.get("worker_results", [])]
        if not results: response = "İşlem güvenli biçimde tamamlanamadı."
        elif len(results) == 1: response = results[0].message
        else:
            labels = {"product_worker":"Ürün", "order_worker":"Sipariş", "dealer_worker":"Bayi", "faq_worker":"SSS"}
            response = "\n".join(f"- {labels[item.worker]}: {item.message}" for item in results)
        history = [*state.get("chat_history", []), ChatMessage(role="assistant", content=response).model_dump(mode="json")]
        return {"response": response, "reply": _reply_from_results(results, response), "chat_history": history, "transition_trace": _next_trace(state, "supervisor_synthesize")}
    async def compress_history(state: GraphState) -> dict[str, Any]:
        history, summary, usage = compress_context(state.get("chat_history", []), SummaryArtifact.model_validate(state.get("summary", {})), _token_budget(state), source_revision=state.get("session_version", 0))
        return {"chat_history": history, "summary": summary.model_dump(mode="json"), "token_usage": usage.model_dump(mode="json"), "transition_trace": _next_trace(state, "compress_context")}
    async def persist_session(state: GraphState) -> dict[str, Any]:
        trace = _next_trace(state, "persist_session")
        session = SessionState(session_id=state["session_id"], current_intent=state.get("current_intent", "unknown"), structured_memory=StructuredMemory.model_validate(state.get("structured_memory", {})), chat_history=[ChatMessage.model_validate(item) for item in state.get("chat_history", [])], summary=SummaryArtifact.model_validate(state.get("summary", {})), token_budget=_token_budget(state), last_worker_plan=state.get("worker_plan", []), last_supervisor_decision=state.get("supervisor_decision", ""), last_transition_trace=trace, version=state.get("session_version", 0), created_at=state["session_created_at"], updated_at=state["session_updated_at"])
        persisted = await session_store.save(session, expected_version=state.get("session_version", 0))
        return {"session_version": persisted.version, "session_updated_at": persisted.updated_at, "transition_trace": trace}
    def dispatch(state: GraphState) -> str: return state.get("next_worker", "finish")
    builder = StateGraph(GraphState)
    for name, node in (("load_session", load_session), ("supervisor_plan", supervisor_plan), ("product_worker", make_worker_node("product_worker")), ("order_worker", make_worker_node("order_worker")), ("dealer_worker", make_worker_node("dealer_worker")), ("faq_worker", make_worker_node("faq_worker")), ("supervisor_review", supervisor_review), ("supervisor_synthesize", supervisor_synthesize), ("compress_context", compress_history), ("persist_session", persist_session)): builder.add_node(name, node)
    builder.add_edge(START, "load_session"); builder.add_edge("load_session", "supervisor_plan")
    mapping = {"product_worker":"product_worker", "order_worker":"order_worker", "dealer_worker":"dealer_worker", "faq_worker":"faq_worker", "finish":"supervisor_synthesize"}
    builder.add_conditional_edges("supervisor_plan", dispatch, mapping)
    for worker in ("product_worker", "order_worker", "dealer_worker", "faq_worker"): builder.add_edge(worker, "supervisor_review")
    builder.add_conditional_edges("supervisor_review", dispatch, mapping)
    builder.add_edge("supervisor_synthesize", "compress_context"); builder.add_edge("compress_context", "persist_session"); builder.add_edge("persist_session", END)
    return builder.compile(checkpointer=checkpointer)
