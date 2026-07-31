"""FastAPI application factory for Merinos chatbot and admin APIs."""
from __future__ import annotations

import hashlib
import json
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select

from .auth import create_access_token, require_roles, verify_password
from .config import Settings, get_settings
from .contracts import (
    AdminSummaryDto, ChatRequest, ChatResponseDto, ContractModel, DealerDto,
    ErrorBody, ErrorEnvelope, FaqDto, KnowledgeSearchDto, KnowledgeSearchRequest,
    LoginRequest, OrderDto, ProductDto, ProductSearchDto, ResponseMeta,
    SuccessEnvelope, TokenDto,
)
from .database import ChatbotConfig, Conversation, Database, KnowledgeDocument, OrderRecord, User
from .demo_repository import facets, get_order, mask_cargo, match_faq, published_faqs, search_dealers, search_products
from .graph import build_graph
from .graph_compat import USING_REAL_LANGGRAPH
from .security import request_id as normalize_request_id, stable_hash
from .session_store import (
    IdempotencyConflictError, InMemorySessionStore, RedisSessionStore,
    SessionConflictError, SessionLockTimeoutError, SessionStore,
)
from .state import TokenBudget, utc_now_iso


def split_csv(value: str | None) -> list[str]:
    return [item.strip() for item in (value or "").split(",") if item.strip()]

def model_json(model: ContractModel, status_code: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=model.model_dump(mode="json", by_alias=True, exclude_none=True))

def success(data: Any, request: Request, *, status_code: int = 200) -> JSONResponse:
    payload = SuccessEnvelope[Any](data=data, meta=ResponseMeta(request_id=request.state.request_id, demo=request.app.state.settings.demo_mode, generated_at=utc_now_iso()))
    return model_json(payload, status_code)

def failure(request: Request, *, code: str, message: str, status_code: int, retryable: bool = False, fields: dict[str, str] | None = None) -> JSONResponse:
    payload = ErrorEnvelope(error=ErrorBody(code=code, message=message, retryable=retryable, fields=fields), meta=ResponseMeta(request_id=request.state.request_id, demo=request.app.state.settings.demo_mode))
    return model_json(payload, status_code)

class RateLimiter:
    def __init__(self, limit: int) -> None:
        self.limit = limit
        self.events: dict[str, deque[float]] = defaultdict(deque)
    def allow(self, key: str) -> bool:
        now = time.monotonic(); queue = self.events[key]
        while queue and queue[0] < now - 60: queue.popleft()
        if len(queue) >= self.limit: return False
        queue.append(now); return True


def create_store(settings: Settings) -> SessionStore:
    if settings.session_backend == "redis":
        return RedisSessionStore.from_url(
            settings.redis_url,
            ttl_seconds=settings.session_ttl_seconds,
            absolute_ttl_seconds=settings.session_absolute_ttl_seconds,
            key_prefix=f"merinos:{settings.environment}:session:v1",
            hmac_secret=settings.redis_key_secret,
            lock_ttl_ms=settings.session_lock_ttl_ms,
            lock_wait_ms=settings.session_lock_wait_ms,
            idempotency_ttl_seconds=settings.idempotency_ttl_seconds,
            max_session_bytes=settings.max_session_bytes,
        )
    return InMemorySessionStore()


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or get_settings()
    resolved.validate_runtime()
    if resolved.environment == "production" and not USING_REAL_LANGGRAPH:
        raise RuntimeError("Production ortamında gerçek LangGraph paketi zorunludur.")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        database = Database(resolved.database_url); database.init(); database.seed(resolved)
        store = create_store(resolved)
        if resolved.session_backend == "redis" and not await store.health():
            raise RuntimeError("Redis readiness başarısız.")
        app.state.settings = resolved; app.state.database = database; app.state.session_store = store
        app.state.graph = build_graph(store, demo_mode=resolved.demo_mode)
        app.state.rate_limiter = RateLimiter(resolved.chat_rate_limit_per_minute)
        yield
        await store.close()

    app = FastAPI(title="Merinos Chatbot API", version="1.0.0", lifespan=lifespan, docs_url="/docs" if resolved.environment != "production" else None, redoc_url=None)
    app.add_middleware(CORSMiddleware, allow_origins=resolved.origins, allow_credentials=False, allow_methods=["GET", "POST", "PATCH", "OPTIONS"], allow_headers=["Content-Type", "Authorization", "X-Request-ID"])

    @app.middleware("http")
    async def security_middleware(request: Request, call_next):
        request.state.request_id = normalize_request_id(request.headers.get("x-request-id"))
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                body_size = int(content_length)
            except ValueError:
                return failure(request, code="VALIDATION_ERROR", message="Content-Length başlığı geçersiz.", status_code=400)
            if body_size < 0:
                return failure(request, code="VALIDATION_ERROR", message="Content-Length başlığı geçersiz.", status_code=400)
            if body_size > resolved.max_request_bytes:
                return failure(request, code="PAYLOAD_TOO_LARGE", message="İstek gövdesi izin verilen boyutu aşıyor.", status_code=413)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "geolocation=(self)"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        fields = {".".join(str(part) for part in item["loc"] if part != "body"): item["msg"] for item in exc.errors()}
        return failure(request, code="VALIDATION_ERROR", message="İstek alanları doğrulanamadı.", status_code=422, fields=fields)

    @app.exception_handler(HTTPException)
    async def http_handler(request: Request, exc: HTTPException):
        code = {401:"UNAUTHORIZED", 403:"FORBIDDEN", 404:"NOT_FOUND", 409:"CONFLICT", 429:"RATE_LIMITED", 503:"UNAVAILABLE"}.get(exc.status_code, "HTTP_ERROR")
        return failure(request, code=code, message=str(exc.detail), status_code=exc.status_code, retryable=exc.status_code in {429, 503})

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        return failure(request, code="INTERNAL_ERROR", message="İşlem güvenli biçimde tamamlanamadı.", status_code=500, retryable=False)

    @app.get("/health/live")
    async def live(request: Request): return success({"status":"live", "version":"1.0.0"}, request)

    @app.get("/health/ready")
    async def ready(request: Request):
        store: SessionStore = request.app.state.session_store
        try: healthy = await store.health()
        except Exception: healthy = False
        if not healthy: return failure(request, code="UNAVAILABLE", message="Session altyapısı hazır değil.", status_code=503, retryable=True)
        return success({"status":"ready", "sessionBackend": resolved.session_backend, "database":"ready"}, request)

    @app.get("/api/v1/products/facets")
    async def product_facets(request: Request): return success(facets(), request)

    @app.get("/api/v1/products")
    async def products_endpoint(request: Request, q: str = Query(default="", max_length=500), category: str | None = None, color: str | None = None, size: str | None = None, collection: str | None = None, limit: int = Query(default=24, ge=1, le=50)):
        result = search_products(query=q, categories=split_csv(category), colors=split_csv(color), sizes=split_csv(size), collections=split_csv(collection), limit=limit)
        dto = ProductSearchDto(items=[ProductDto.model_validate(item) for item in result["items"]], total=result["total"], criteria=result["criteria"], suggestions=result["suggestions"])
        return success(dto, request)

    @app.get("/api/v1/orders/{order_number}/status")
    async def order_status(request: Request, order_number: str):
        if not resolved.demo_mode:
            return failure(request, code="FORBIDDEN", message="Canlı sipariş sorgusu kimlik ve sipariş sahipliği doğrulaması olmadan kullanılamaz.", status_code=403)
        normalized = order_number.upper()
        if not __import__("re").fullmatch(r"MRN-20\d{2}-\d{4}", normalized): return failure(request, code="VALIDATION_ERROR", message="Sipariş numarası MRN-YYYY-NNNN biçiminde olmalıdır.", status_code=422)
        order = get_order(normalized)
        if not order: return failure(request, code="NOT_FOUND", message="Bu numarayla eşleşen demo sipariş bulunamadı.", status_code=404)
        safe = dict(order)
        if safe.get("cargoCode"): safe["cargoCode"] = mask_cargo(safe["cargoCode"])
        return success(OrderDto.model_validate(safe), request)

    @app.get("/api/v1/dealers")
    async def dealers_endpoint(request: Request, city: str | None = Query(default=None, max_length=80), district: str | None = Query(default=None, max_length=80), latitude: float | None = Query(default=None, ge=-90, le=90), longitude: float | None = Query(default=None, ge=-180, le=180), limit: int = Query(default=20, ge=1, le=50)):
        items = search_dealers(city=city, district=district, latitude=latitude, longitude=longitude, limit=limit)
        return success([DealerDto.model_validate(item) for item in items], request)

    @app.get("/api/v1/knowledge")
    async def knowledge_list(request: Request): return success([FaqDto.model_validate(item) for item in published_faqs()], request)

    @app.post("/api/v1/knowledge/search")
    async def knowledge_search(request: Request, body: KnowledgeSearchRequest):
        result = match_faq(body.query, body.limit)
        dto = KnowledgeSearchDto(match=FaqDto.model_validate(result["match"]) if result["match"] else None, suggestions=[FaqDto.model_validate(item) for item in result["suggestions"]], confidence=result["confidence"])
        return success(dto, request)

    @app.post("/api/v1/chat/messages")
    async def chat_message(request: Request, body: ChatRequest):
        client_key = request.client.host if request.client else "unknown"
        if not request.app.state.rate_limiter.allow(stable_hash(client_key)):
            return failure(request, code="RATE_LIMITED", message="Çok fazla istek gönderildi. Kısa süre sonra tekrar deneyin.", status_code=429, retryable=True)
        session_id = body.session_id or f"demo_{uuid4().hex}"
        payload_hash = hashlib.sha256(json.dumps({"message":body.message, "locale":body.locale}, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        store: SessionStore = request.app.state.session_store
        existing = await store.idempotency_get(session_id, body.client_message_id)
        if existing:
            if existing.get("payloadHash") != payload_hash: return failure(request, code="CONFLICT", message="Aynı clientMessageId farklı içerikle kullanılamaz.", status_code=409)
            if existing.get("status") == "completed": return success(ChatResponseDto.model_validate(existing["response"]), request)
            return failure(request, code="CONFLICT", message="Aynı mesaj hâlen işleniyor.", status_code=409, retryable=True)
        if not await store.idempotency_claim(session_id, body.client_message_id, payload_hash): return failure(request, code="CONFLICT", message="Mesaj kimliği daha önce kullanıldı.", status_code=409, retryable=True)
        try:
            async with store.mutation_lock(session_id):
                graph = request.app.state.graph
                result = await graph.ainvoke({"session_id": session_id, "user_message": body.message, "token_budget": TokenBudget(context_window_tokens=resolved.context_window_tokens, max_output_tokens=resolved.max_output_tokens, safety_margin_tokens=resolved.safety_margin_tokens, compression_trigger_ratio=resolved.compression_trigger_ratio, recent_messages_to_keep=resolved.recent_messages_to_keep).model_dump(mode="json")}, config={"configurable":{"thread_id":session_id}})
                response_data = ChatResponseDto(session_id=session_id, reply=result["reply"])
                raw = response_data.model_dump(mode="json", by_alias=True, exclude_none=True)
                await store.idempotency_complete(session_id, body.client_message_id, payload_hash, raw)
                return success(response_data, request)
        except SessionLockTimeoutError:
            await store.idempotency_release(session_id, body.client_message_id, payload_hash)
            return failure(request, code="CONFLICT", message="Oturum başka bir istek tarafından güncelleniyor.", status_code=409, retryable=True)
        except SessionConflictError:
            await store.idempotency_release(session_id, body.client_message_id, payload_hash)
            return failure(request, code="CONFLICT", message="Oturum sürümü değişti. Aynı mesaj kimliğiyle tekrar deneyin.", status_code=409, retryable=True)
        except IdempotencyConflictError:
            await store.idempotency_release(session_id, body.client_message_id, payload_hash)
            return failure(request, code="CONFLICT", message="Mesaj kimliği çakışması.", status_code=409)
        except Exception:
            await store.idempotency_release(session_id, body.client_message_id, payload_hash)
            raise

    @app.post("/api/v1/chat/reset")
    async def reset_chat(request: Request, session_id: str = Query(min_length=12, max_length=128)):
        await request.app.state.session_store.delete(session_id)
        return success({"reset": True}, request)

    @app.post("/api/v1/auth/login")
    async def login(request: Request, body: LoginRequest):
        database: Database = request.app.state.database
        with database.session_factory() as session:
            user = session.scalar(select(User).where(User.email == body.email.lower()))
            if not user or not user.is_active or not verify_password(body.password, user.password_hash):
                return failure(request, code="UNAUTHORIZED", message="E-posta veya parola hatalı.", status_code=401)
            token, expires = create_access_token(user_id=user.id, email=user.email, role=user.role, settings=resolved)
            return success(TokenDto(access_token=token, expires_in=expires, role=user.role), request)

    @app.get("/api/v1/admin/summary")
    async def admin_summary(request: Request, user=Depends(require_roles("admin", "operator", "viewer"))):
        database: Database = request.app.state.database
        with database.session_factory() as session:
            config = session.scalar(select(ChatbotConfig).where(ChatbotConfig.key == "runtime"))
            dto = AdminSummaryDto(users=session.scalar(select(func.count()).select_from(User)) or 0, orders=session.scalar(select(func.count()).select_from(OrderRecord)) or 0, conversations=session.scalar(select(func.count()).select_from(Conversation)) or 0, knowledge_documents=session.scalar(select(func.count()).select_from(KnowledgeDocument)) or 0, chatbot_enabled=bool((config.value_json if config else {}).get("enabled", False)), environment=resolved.environment)
            return success(dto, request)

    @app.get("/api/v1/admin/users")
    async def admin_users(request: Request, user=Depends(require_roles("admin", "operator"))):
        with request.app.state.database.session_factory() as session:
            rows = session.scalars(select(User).order_by(User.id)).all()
            return success([{"id":item.id, "email":item.email, "role":item.role, "isActive":item.is_active, "createdAt":item.created_at.isoformat()} for item in rows], request)

    @app.get("/api/v1/admin/orders")
    async def admin_orders(request: Request, user=Depends(require_roles("admin", "operator", "viewer"))):
        with request.app.state.database.session_factory() as session:
            rows = session.scalars(select(OrderRecord).order_by(OrderRecord.id)).all()
            return success([{"id":item.id, "orderNumber":item.order_number, "status":item.status, "estimatedDate":item.estimated_date, "isDemo":item.is_demo} for item in rows], request)

    @app.get("/api/v1/admin/config")
    async def admin_config(request: Request, user=Depends(require_roles("admin", "operator", "viewer"))):
        with request.app.state.database.session_factory() as session:
            row = session.scalar(select(ChatbotConfig).where(ChatbotConfig.key == "runtime"))
            return success(row.value_json if row else {}, request)

    @app.patch("/api/v1/admin/config")
    async def update_config(request: Request, body: dict[str, Any], user=Depends(require_roles("admin"))):
        allowed = {key: value for key, value in body.items() if key in {"enabled", "maxPlanSteps", "dataSource"}}
        with request.app.state.database.session_factory() as session:
            row = session.scalar(select(ChatbotConfig).where(ChatbotConfig.key == "runtime"))
            if not row: row = ChatbotConfig(key="runtime", value_json={}); session.add(row)
            row.value_json = {**row.value_json, **allowed}; row.updated_at = datetime.now(UTC); session.commit()
            return success(row.value_json, request)

    return app

app = create_app()

def run() -> None:
    import uvicorn
    uvicorn.run("merinos_agent.api:app", host="0.0.0.0", port=8000, reload=False)
