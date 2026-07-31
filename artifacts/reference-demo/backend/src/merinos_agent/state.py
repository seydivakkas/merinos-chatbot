"""LangGraph runtime, persisted session and context models."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal, TypedDict
from pydantic import BaseModel, Field

Intent = Literal["product_search", "order_status", "dealer_search", "faq", "unknown"]
WorkerName = Literal["product_worker", "order_worker", "dealer_worker", "faq_worker"]
WorkerStatus = Literal["ok", "needs_input", "not_found", "requires_verification", "partial", "error"]
Role = Literal["user", "assistant"]

def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()

class ChatMessage(BaseModel):
    role: Role
    content: str = Field(min_length=1, max_length=8000)
    created_at: str = Field(default_factory=utc_now_iso)

class TokenBudget(BaseModel):
    context_window_tokens: int = Field(default=8192, gt=0)
    max_output_tokens: int = Field(default=800, gt=0)
    safety_margin_tokens: int = Field(default=512, ge=0)
    compression_trigger_ratio: float = Field(default=0.75, gt=0, le=1)
    recent_messages_to_keep: int = Field(default=8, gt=0)
    @property
    def input_limit(self) -> int:
        return max(1, self.context_window_tokens - self.max_output_tokens - self.safety_margin_tokens)
    @property
    def compression_trigger_tokens(self) -> int:
        return max(1, int(self.input_limit * self.compression_trigger_ratio))

class TokenBreakdown(BaseModel):
    history: int = 0
    summary: int = 0
    current_user: int = 0
    structured_memory: int = 0
    total: int = 0

class TokenUsage(BaseModel):
    before: int
    after: int
    input_limit: int
    compression_trigger: int
    compressed: bool
    breakdown: TokenBreakdown = Field(default_factory=TokenBreakdown)

class SummaryArtifact(BaseModel):
    schema_version: str = "1.0"
    text: str = ""
    source_revision: int = 0
    token_count: int = 0
    redacted: bool = True
    created_at: str = Field(default_factory=utc_now_iso)

class StructuredMemory(BaseModel):
    product_category: str | None = None
    product_color: str | None = None
    product_size: str | None = None
    dealer_city: str | None = None
    faq_topic: str | None = None

class WorkerResult(BaseModel):
    worker: WorkerName
    status: WorkerStatus
    message: str
    data: dict[str, Any] = Field(default_factory=dict)
    retryable: bool = False

class SessionState(BaseModel):
    schema_version: str = "1.0"
    session_id: str = Field(min_length=1, max_length=128)
    current_intent: Intent = "unknown"
    structured_memory: StructuredMemory = Field(default_factory=StructuredMemory)
    chat_history: list[ChatMessage] = Field(default_factory=list)
    summary: SummaryArtifact = Field(default_factory=SummaryArtifact)
    token_budget: TokenBudget = Field(default_factory=TokenBudget)
    last_worker_plan: list[WorkerName] = Field(default_factory=list)
    last_supervisor_decision: str = ""
    last_transition_trace: list[str] = Field(default_factory=list)
    version: int = Field(default=0, ge=0)
    created_at: str = Field(default_factory=utc_now_iso)
    updated_at: str = Field(default_factory=utc_now_iso)
    absolute_expires_at: str | None = None

class GraphState(TypedDict, total=False):
    session_id: str
    user_message: str
    current_intent: Intent
    route: Intent
    slots: dict[str, str]
    structured_memory: dict[str, Any]
    chat_history: list[dict[str, Any]]
    summary: dict[str, Any]
    token_budget: dict[str, Any]
    token_usage: dict[str, Any]
    worker_plan: list[WorkerName]
    worker_cursor: int
    next_worker: str
    worker_results: list[dict[str, Any]]
    supervisor_decision: str
    response: str
    reply: dict[str, Any]
    transition_trace: list[str]
    session_version: int
    session_created_at: str
    session_updated_at: str

class WorkerState(TypedDict, total=False):
    worker: WorkerName
    user_message: str
    relevant_slots: dict[str, str]
    context_summary: str
    prepared: dict[str, Any]
    result: dict[str, Any]
    trace: list[str]
