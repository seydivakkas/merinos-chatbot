#!/usr/bin/env python3
"""
================================================================================
MERINOS API SERVER - FastAPI + Fine-tuned Model
================================================================================
Production-ready REST API. Fine-tuned modeli HTTP endpoint olarak sunar.

Kullanım:
    python api_server.py --model ./merinos_7b_8gb/lora_adapters \
                         --base_model unsloth/Qwen2.5-7B-Instruct-bnb-4bit \
                         --port 8000

Endpoint'ler:
    POST /chat          - Genel chat
    POST /product_qa    - Ürün sorgusu
    POST /order_status  - Sipariş takibi (mock)
    POST /health        - Sağlık kontrolü
    GET  /metrics       - Prometheus metrikleri

================================================================================
"""

import argparse
import json
import time
import os
from typing import Optional, List, Dict
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response
from unsloth import FastLanguageModel

# ================================================================
# PROMETHEUS METRICS
# ================================================================

REQUEST_COUNT = Counter("merinos_requests_total", "Toplam istek", ["endpoint"])
REQUEST_LATENCY = Histogram("merinos_request_duration_seconds", "İstek süresi", ["endpoint"])
TOKEN_COUNT = Counter("merinos_tokens_generated_total", "Üretilen token sayısı")

# ================================================================
# PYDANTIC MODELS
# ================================================================

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 512
    system_prompt: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    model: str
    generation_time_sec: float
    tokens_generated: int
    timestamp: str


class ProductQARequest(BaseModel):
    query: str
    product_series: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None


class OrderStatusRequest(BaseModel):
    order_id: str
    email: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    gpu_available: bool
    gpu_name: Optional[str]
    vram_used_gb: float
    vram_total_gb: float
    uptime_seconds: float


# ================================================================
# GLOBAL STATE
# ================================================================

app_state = {
    "model": None,
    "tokenizer": None,
    "model_name": "",
    "start_time": 0,
    "conversations": {},  # conversation_id -> messages list
}

SYSTEM_PROMPT = """Sen Merinos'un yapay zeka müşteri hizmetleri asistanısın. Adın Meri. Türkçe konuşuyorsun ve halı, ev tekstili ürünleri, sipariş takibi, garanti ve bakım konularında uzmanlaşmışsın. Profesyonel, nazik ve çözüm odaklı yanıtlar ver."""


# ================================================================
# LIFESPAN
# ================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    args = parse_args_silent()
    print("🚀 API Server başlatılıyor...")

    model, tokenizer = load_model(args.model, args.base_model)
    app_state["model"] = model
    app_state["tokenizer"] = tokenizer
    app_state["model_name"] = args.model
    app_state["start_time"] = time.time()

    print(f"  ✅ Model yüklendi: {args.model}")
    print(f"  🌐 http://localhost:{args.port}/docs")
    yield
    # Shutdown
    print("\n👋 API Server kapanıyor...")


# ================================================================
# APP
# ================================================================

app = FastAPI(
    title="Merinos AI API",
    description="Merinos müşteri hizmetleri yapay zeka asistanı API'si",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================================================================
# HELPER FUNCTIONS
# ================================================================

def parse_args_silent():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str, required=True)
    parser.add_argument("--base_model", type=str, default=None)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", type=str, default="0.0.0.0")
    return parser.parse_args()


def load_model(model_path, base_model=None):
    if base_model:
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=base_model, max_seq_length=2048, dtype=None, load_in_4bit=True,
        )
        model = FastLanguageModel.get_peft_model(model)
        model.load_adapter(model_path)
    else:
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=model_path, max_seq_length=2048, dtype=None, load_in_4bit=True,
        )
    FastLanguageModel.for_inference(model)
    return model, tokenizer


def generate_response(messages, temperature=0.7, max_tokens=512):
    model = app_state["model"]
    tokenizer = app_state["tokenizer"]

    inputs = tokenizer.apply_chat_template(
        messages, tokenize=True, return_tensors="pt", add_generation_prompt=True
    ).to("cuda")

    with torch.no_grad():
        outputs = model.generate(
            input_ids=inputs, max_new_tokens=max_tokens,
            temperature=temperature, top_p=0.9, use_cache=True,
            pad_token_id=tokenizer.eos_token_id,
        )

    response = tokenizer.decode(outputs[0][inputs.shape[1]:], skip_special_tokens=True).strip()
    tokens_generated = outputs.shape[1] - inputs.shape[1]
    return response, tokens_generated


def get_conversation(conv_id: str):
    if conv_id not in app_state["conversations"]:
        app_state["conversations"][conv_id] = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]
    return app_state["conversations"][conv_id]


# ================================================================
# ENDPOINTS
# ================================================================

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    t0 = time.time()
    REQUEST_COUNT.labels(endpoint="chat").inc()

    conv_id = request.conversation_id or f"conv_{int(time.time() * 1000)}"
    messages = get_conversation(conv_id)

    # System prompt override
    if request.system_prompt:
        messages[0]["content"] = request.system_prompt

    messages.append({"role": "user", "content": request.message})

    try:
        response, tokens = generate_response(
            messages, request.temperature, request.max_tokens
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    messages.append({"role": "assistant", "content": response})

    gen_time = time.time() - t0
    REQUEST_LATENCY.labels(endpoint="chat").observe(gen_time)
    TOKEN_COUNT.inc(tokens)

    return ChatResponse(
        response=response,
        conversation_id=conv_id,
        model=app_state["model_name"],
        generation_time_sec=round(gen_time, 3),
        tokens_generated=tokens,
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%S"),
    )


@app.post("/product_qa")
async def product_qa(request: ProductQARequest):
    t0 = time.time()
    REQUEST_COUNT.labels(endpoint="product_qa").inc()

    query = request.query
    if request.product_series:
        query += f" (Seri: {request.product_series})"
    if request.size:
        query += f" (Ölçü: {request.size})"
    if request.color:
        query += f" (Renk: {request.color})"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": query},
    ]

    response, tokens = generate_response(messages)
    gen_time = time.time() - t0
    REQUEST_LATENCY.labels(endpoint="product_qa").observe(gen_time)

    return {
        "response": response,
        "query": request.query,
        "filters": {
            "series": request.product_series,
            "size": request.size,
            "color": request.color,
        },
        "generation_time_sec": round(gen_time, 3),
        "tokens": tokens,
    }


@app.post("/order_status")
async def order_status(request: OrderStatusRequest):
    REQUEST_COUNT.labels(endpoint="order_status").inc()

    # Mock order status (gerçek uygulamada DB sorgusu)
    mock_status = {
        "order_id": request.order_id,
        "status": "Kargoya Verildi",
        "cargo": "Aras Kargo",
        "tracking": f"AR{request.order_id[-6:]}{hash(request.order_id) % 1000000:06d}",
        "estimated_delivery": "3 iş günü içinde",
    }

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"{request.order_id} numaralı siparişim nerede?"},
    ]

    response, _ = generate_response(messages, max_tokens=128)

    return {
        "order_id": request.order_id,
        "ai_response": response,
        "status_data": mock_status,
    }


@app.get("/health", response_model=HealthResponse)
async def health():
    gpu_name = None
    vram_used = 0.0
    vram_total = 0.0

    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        vram_used = torch.cuda.memory_allocated() / 1024**3
        vram_total = torch.cuda.get_device_properties(0).total_memory / 1024**3

    return HealthResponse(
        status="healthy",
        model_loaded=app_state["model"] is not None,
        gpu_available=torch.cuda.is_available(),
        gpu_name=gpu_name,
        vram_used_gb=round(vram_used, 2),
        vram_total_gb=round(vram_total, 2),
        uptime_seconds=round(time.time() - app_state["start_time"], 1),
    )


@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/")
async def root():
    return {
        "name": "Merinos AI API",
        "version": "1.0.0",
        "endpoints": ["/chat", "/product_qa", "/order_status", "/health", "/metrics"],
        "docs": "/docs",
    }


# ================================================================
# MAIN
# ================================================================

if __name__ == "__main__":
    import uvicorn
    args = parse_args_silent()
    uvicorn.run(app, host=args.host, port=args.port)
