"""Public API contracts. JSON uses camelCase, Python uses snake_case."""
from __future__ import annotations

from typing import Any, Generic, Literal, TypeVar
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")

def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)

class ContractModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

class ResponseMeta(ContractModel):
    request_id: str
    demo: bool = True
    generated_at: str | None = None

class SuccessEnvelope(ContractModel, Generic[T]):
    data: T
    meta: ResponseMeta

class ErrorBody(ContractModel):
    code: str
    message: str
    retryable: bool = False
    fields: dict[str, str] | None = None

class ErrorEnvelope(ContractModel):
    error: ErrorBody
    meta: ResponseMeta

class ProductDto(ContractModel):
    id: int
    code: str
    name: str
    collection: str
    category: str
    color: str
    size: str
    price: int
    stock: str
    pattern: str

class MessageActionDto(ContractModel):
    label: str
    value: str

class ProductSearchDto(ContractModel):
    items: list[ProductDto]
    total: int
    criteria: dict[str, Any]
    suggestions: list[MessageActionDto] = Field(default_factory=list)

class OrderStepDto(ContractModel):
    label: str
    detail: str
    state: Literal["done", "current", "next"]

class OrderDto(ContractModel):
    number: str
    status: str
    summary: str
    estimated_date: str
    cargo_code: str | None = None
    steps: list[OrderStepDto]

class DealerDto(ContractModel):
    id: str
    name: str
    city: str
    district: str
    address: str
    phone: str
    distance: str
    hours: str
    map_x: float
    map_y: float
    latitude: float
    longitude: float
    approximate_distance_km: float | None = None

class FaqDto(ContractModel):
    id: str
    topic: str
    question: str
    answer: str
    keywords: list[str]
    aliases: list[str]
    status: str
    source: str
    content_version: str
    reviewed_at: str

class KnowledgeSearchRequest(ContractModel):
    query: str = Field(min_length=1, max_length=1000)
    limit: int = Field(default=3, ge=1, le=10)

class KnowledgeSearchDto(ContractModel):
    match: FaqDto | None
    suggestions: list[FaqDto]
    confidence: str

class ChatRequest(ContractModel):
    session_id: str | None = Field(default=None, min_length=12, max_length=128)
    client_message_id: str = Field(min_length=8, max_length=128)
    message: str = Field(min_length=1, max_length=1000)
    locale: Literal["tr-TR"] = "tr-TR"

class ChatReplyDto(ContractModel):
    text: str
    intent: Literal["product", "order", "dealer", "faq"] | None = None
    products: list[ProductDto] | None = None
    order: OrderDto | None = None
    dealers: list[DealerDto] | None = None
    faq: FaqDto | None = None
    actions: list[MessageActionDto] | None = None

class ChatResponseDto(ContractModel):
    session_id: str
    reply: ChatReplyDto

class LoginRequest(ContractModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=256)

class TokenDto(ContractModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    role: str

class AdminSummaryDto(ContractModel):
    users: int
    orders: int
    conversations: int
    knowledge_documents: int
    chatbot_enabled: bool
    environment: str
