#!/usr/bin/env python3
"""
ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)

Merinos Chatbot — Fine-Tuned Meri QLoRA Inference Sunucusu
===========================================================
Fine-tuned Qwen2.5-7B QLoRA modelini yükleyerek http://localhost:8000/chat
üzerinden REST API ile servis eder.

Endpoint:
    POST /chat
    Body: { "message": "...", "conversation_id": "...", "temperature": 0.7, "max_tokens": 512, "system_prompt": "..." }
    Response: { "response": "...", "tokens_generated": N, "generation_time_sec": X.XX }

Kullanım:
    python scripts/inference_server.py
"""

import os
import sys
import json
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"
os.environ["PYTHONIOENCODING"] = "utf-8"

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_MODEL_NAME = "unsloth/Qwen2.5-7B-Instruct-bnb-4bit"
ADAPTER_DIR = "./merinos_meri_model/lora_adapters"
PORT = 8000

print("=" * 70)
print("  MERINOS CHATBOT — FINE-TUNED MERI QLORA INFERENCE SUNUCUSU")
print("=" * 70)
print(f"  Temel Model:   {BASE_MODEL_NAME}")
print(f"  LoRA Adaptör:  {ADAPTER_DIR}")
print(f"  Dinleme Portu: http://localhost:{PORT}")
print("=" * 70 + "\n")

import torch
print(f"CUDA Kullanılabilir: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    torch.cuda.empty_cache()

from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

print("\n[1/3] Tokenizer yükleniyor...")
tokenizer = AutoTokenizer.from_pretrained(
    ADAPTER_DIR if os.path.exists(ADAPTER_DIR) else BASE_MODEL_NAME,
    trust_remote_code=True
)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

print("[2/3] Temel model 4-bit NF4 ile yükleniyor...")
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    bnb_4bit_use_double_quant=True,
)

base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL_NAME,
    quantization_config=bnb_config,
    device_map="auto" if torch.cuda.is_available() else None,
    trust_remote_code=True
)

if os.path.exists(ADAPTER_DIR):
    print(f"[3/3] Fine-tuned LoRA ağırlıkları entegre ediliyor ({ADAPTER_DIR})...")
    model = PeftModel.from_pretrained(base_model, ADAPTER_DIR)
    print("Fine-Tuned Meri QLoRA modeli basariyla yuklendi!\n")
else:
    print("[3/3] LoRA adaptoru bulunamadi, temel model ile calisiyor.")
    model = base_model

model.eval()

# Conversation history store (in-memory, per conversation_id)
conversation_histories = {}
history_lock = threading.Lock()
model_lock = threading.Lock()  # Model hot-swap kilidi
current_adapter_version = os.path.basename(ADAPTER_DIR) if os.path.exists(ADAPTER_DIR) else "base"

# ─── A/B Testi Trafik Yönlendirici Durumu ─────────────────────────────────────
ab_config = {
    "enabled": False,
    "candidate_version": "candidate_v2",
    "candidate_adapter_path": "",
    "traffic_percent": 10,  # Aday modele %10 trafik gönderilir
}
ab_stats = {
    "version_A": {"version": current_adapter_version, "requests": 0, "total_tokens": 0, "total_ms": 0.0},
    "version_B": {"version": "candidate", "requests": 0, "total_tokens": 0, "total_ms": 0.0},
}


DEFAULT_SYSTEM_PROMPT = (
    "Sen Merinos'un Kidemli Musteri Hizmetleri Uzmanisın. İsmin Meri. Turkce konusuyorsun. "
    "Merinos hali, ev tekstili, leke temizligi, siparis takibi, bayi ve garanti sureclerinde "
    "uzmanlasmis nazik, empati kuran ve cozum odakli profesyonel bir destek temsilcisisin."
)

EOS_TOKEN_IDS = []
if "<|im_end|>" in tokenizer.get_vocab():
    EOS_TOKEN_IDS.append(tokenizer.convert_tokens_to_ids("<|im_end|>"))
EOS_TOKEN_IDS.append(tokenizer.eos_token_id)

def build_prompt(system_prompt: str, conversation_id: str, user_message: str) -> str:
    """Builds a ChatML format prompt with conversation history."""
    with history_lock:
        if conversation_id not in conversation_histories:
            conversation_histories[conversation_id] = []
        history = conversation_histories[conversation_id]

    prompt = f"<|im_start|>system\n{system_prompt}<|im_end|>\n"
    for turn in history[-6:]:  # Son 3 tur (6 mesaj) konuşma geçmişi
        prompt += f"<|im_start|>user\n{turn['user']}<|im_end|>\n<|im_start|>assistant\n{turn['assistant']}<|im_end|>\n"
    prompt += f"<|im_start|>user\n{user_message}<|im_end|>\n<|im_start|>assistant\n"
    return prompt

def save_history(conversation_id: str, user_message: str, response: str):
    """Saves a conversation turn to history."""
    with history_lock:
        if conversation_id not in conversation_histories:
            conversation_histories[conversation_id] = []
        conversation_histories[conversation_id].append({
            "user": user_message,
            "assistant": response
        })

def generate_response(user_message: str, conversation_id: str, system_prompt: str, temperature: float = 0.7, max_tokens: int = 512) -> dict:
    """Runs inference on the fine-tuned Meri model."""
    start = time.time()
    prompt = build_prompt(system_prompt, conversation_id, user_message)

    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=1500)
    if torch.cuda.is_available():
        inputs = {k: v.cuda() for k, v in inputs.items()}

    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=temperature,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=EOS_TOKEN_IDS if EOS_TOKEN_IDS else tokenizer.eos_token_id,
            repetition_penalty=1.1,
        )

    generated_ids = output_ids[0][inputs["input_ids"].shape[1]:]
    response_text = tokenizer.decode(generated_ids, skip_special_tokens=True).strip()

    # Clean up any trailing special tokens
    for stop_token in ["<|im_end|>", "<|endoftext|>", "<|im_start|>"]:
        if stop_token in response_text:
            response_text = response_text.split(stop_token)[0].strip()

    elapsed = time.time() - start
    tokens_generated = len(generated_ids)

    # Save to history
    save_history(conversation_id, user_message, response_text)

    return {
        "response": response_text,
        "tokens_generated": tokens_generated,
        "generation_time_sec": round(elapsed, 2),
    }


class MeriInferenceHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Quiet logging - only errors
        pass

    def send_json(self, status: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {
                "ok": True,
                "model": "Qwen2.5-7B QLoRA (Fine-Tuned Meri)",
                "adapter": ADAPTER_DIR,
                "version": current_adapter_version,
                "cuda": torch.cuda.is_available(),
                "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
                "activeConversations": len(conversation_histories),
                "abTestEnabled": ab_config["enabled"],
            })
        elif self.path == "/ab_test/stats":
            self.send_json(200, {
                "config": ab_config,
                "stats": ab_stats,
            })
        else:
            self.send_json(404, {"error": "not_found"})

    def do_POST(self):
        if self.path == "/config/ab_test":
            global ab_config
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
                ab_config["enabled"] = bool(body.get("enabled", ab_config["enabled"]))
                ab_config["traffic_percent"] = int(body.get("traffic_percent", ab_config["traffic_percent"]))
                if "candidate_version" in body:
                    ab_config["candidate_version"] = str(body["candidate_version"])
                if "candidate_adapter_path" in body:
                    ab_config["candidate_adapter_path"] = str(body["candidate_adapter_path"])
                return self.send_json(200, {"ok": True, "config": ab_config})
            except Exception as e:
                return self.send_json(400, {"error": str(e)})

        if self.path == "/reload_adapter":

            # ─── Sıcak Adaptör Değişimi (auto_retrain.py tarafından çağrılır) ───
            global model, current_adapter_version
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
                new_adapter_path = str(body.get("adapter_path", "")).strip()
                new_version = str(body.get("version", "unknown"))

                if not new_adapter_path or not os.path.exists(new_adapter_path):
                    return self.send_json(400, {"error": f"adapter_path gecersiz: {new_adapter_path}"})

                print(f"  [HotSwap] Yeni adaptor yukleniyor: {new_adapter_path}")
                with model_lock:
                    new_model = PeftModel.from_pretrained(model.base_model if hasattr(model, 'base_model') else model, new_adapter_path)
                    new_model.eval()
                    model = new_model
                    current_adapter_version = new_version
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()

                print(f"  [HotSwap] Basari: {new_version}")
                return self.send_json(200, {"ok": True, "version": new_version})
            except Exception as e:
                import traceback
                traceback.print_exc()
                return self.send_json(500, {"error": str(e)})

        if self.path == "/chat":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}

                user_message = str(body.get("message", "")).strip()
                conversation_id = str(body.get("conversation_id", "default"))
                temperature = float(body.get("temperature", 0.7))
                max_tokens = int(body.get("max_tokens", 512))
                system_prompt = str(body.get("system_prompt", DEFAULT_SYSTEM_PROMPT))

                if not user_message:
                    return self.send_json(400, {"error": "message is required"})

                print(f"  [Inference] conv={conversation_id[:16]} msg={user_message[:60]}...")
                result = generate_response(user_message, conversation_id, system_prompt, temperature, max_tokens)
                print(f"  [Response] {result['tokens_generated']} token, {result['generation_time_sec']}s")
                self.send_json(200, result)

            except Exception as e:
                import traceback
                traceback.print_exc()
                self.send_json(500, {"error": str(e)})
        else:
            self.send_json(404, {"error": "not_found"})


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), MeriInferenceHandler)
    print(f"Meri QLoRA Inference Sunucusu basladi: http://localhost:{PORT}")
    print(f"  POST /chat  - Mesaj gonder ve cevap al")
    print(f"  GET  /health - Sunucu sagligi kontrol\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSunucu kapatildi.")
        server.server_close()
