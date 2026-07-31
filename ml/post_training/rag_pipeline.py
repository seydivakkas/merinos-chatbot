#!/usr/bin/env python3
"""
================================================================================
MERINOS RAG PIPELINE
================================================================================
Fine-tuned model + FAISS vector store + BM25 hybrid retrieval.
Ürün bilgileri, SSS ve dokümanlar üzerinde RAG.

Kullanım:
    # 1. Index oluştur
    python rag_pipeline.py --mode index --data ./datasets/raw/merinos_faq.jsonl \
                           --index_dir ./rag_index

    # 2. Sorgula
    python rag_pipeline.py --mode query --index_dir ./rag_index \
                           --model ./merinos_7b_8gb/lora_adapters \
                           --question "Nepal serisi fiyatı nedir?"

    # 3. API olarak çalıştır
    python rag_pipeline.py --mode serve --index_dir ./rag_index \
                           --model ./merinos_7b_8gb/lora_adapters \
                           --port 8001
================================================================================
"""

import argparse
import json
import os
import re
from pathlib import Path
from typing import List, Dict, Optional

import numpy as np
import torch
from sentence_transformers import SentenceTransformer
from unsloth import FastLanguageModel

# FAISS opsiyonel
try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    print("⚠️  FAISS yüklü değil. pip install faiss-cpu veya faiss-gpu")

# BM25 opsiyonel
try:
    from rank_bm25 import BM25Okapi
    BM25_AVAILABLE = True
except ImportError:
    BM25_AVAILABLE = False


class MerinosRAG:
    """Merinos domain RAG pipeline."""

    def __init__(self, index_dir: str, model_path: str, base_model: Optional[str] = None):
        self.index_dir = Path(index_dir)

        # Embedding model (Türkçe için E5-multilingual veya BGE)
        print("📥 Embedding model yükleniyor...")
        self.embedder = SentenceTransformer("intfloat/multilingual-e5-large")
        self.embed_dim = self.embedder.get_sentence_embedding_dimension()

        # LLM
        print("📥 LLM yükleniyor...")
        if base_model:
            self.model, self.tokenizer = FastLanguageModel.from_pretrained(
                model_name=base_model, max_seq_length=2048, dtype=None, load_in_4bit=True,
            )
            self.model = FastLanguageModel.get_peft_model(self.model)
            self.model.load_adapter(model_path)
        else:
            self.model, self.tokenizer = FastLanguageModel.from_pretrained(
                model_name=model_path, max_seq_length=2048, dtype=None, load_in_4bit=True,
            )
        FastLanguageModel.for_inference(self.model)

        # Index yükle
        self.load_index()

    def load_index(self):
        """FAISS index ve dokümanları yükle."""
        if not FAISS_AVAILABLE:
            raise RuntimeError("FAISS gerekli")

        index_path = self.index_dir / "faiss.index"
        docs_path = self.index_dir / "documents.json"

        if not index_path.exists() or not docs_path.exists():
            raise FileNotFoundError(f"Index bulunamadı: {self.index_dir}. Önce --mode index çalıştırın.")

        self.index = faiss.read_index(str(index_path))
        with open(docs_path, "r", encoding="utf-8") as f:
            self.documents = json.load(f)

        # BM25 index
        if BM25_AVAILABLE:
            tokenized_docs = [self._tokenize(doc["text"]) for doc in self.documents]
            self.bm25 = BM25Okapi(tokenized_docs)
        else:
            self.bm25 = None

        print(f"  ✅ {len(self.documents)} doküman yüklendi")

    def _tokenize(self, text: str) -> List[str]:
        """Basit Türkçe tokenizasyon."""
        text = text.lower()
        text = re.sub(r'[^\w\s]', ' ', text)
        return text.split()

    def _embed(self, texts: List[str]) -> np.ndarray:
        """Metinleri embed et."""
        return self.embedder.encode(texts, normalize_embeddings=True, show_progress_bar=False)

    def retrieve(self, query: str, top_k: int = 5, alpha: float = 0.7) -> List[Dict]:
        """Hybrid retrieval: Dense (FAISS) + Sparse (BM25)."""
        # Dense retrieval
        query_embedding = self._embed([f"query: {query}"])
        distances, indices = self.index.search(query_embedding, top_k * 2)

        dense_scores = {}
        for idx, dist in zip(indices[0], distances[0]):
            if idx < len(self.documents):
                dense_scores[int(idx)] = float(1.0 / (1.0 + dist))

        # Sparse retrieval
        sparse_scores = {}
        if self.bm25:
            tokenized_query = self._tokenize(query)
            bm25_scores = self.bm25.get_scores(tokenized_query)
            top_bm25 = np.argsort(bm25_scores)[-top_k * 2:][::-1]
            for idx in top_bm25:
                if bm25_scores[idx] > 0:
                    sparse_scores[int(idx)] = float(bm25_scores[idx])

        # Fusion
        all_indices = set(dense_scores.keys()) | set(sparse_scores.keys())
        fused = []
        for idx in all_indices:
            d_score = dense_scores.get(idx, 0)
            s_score = sparse_scores.get(idx, 0)
            # Normalize sparse scores
            max_sparse = max(sparse_scores.values()) if sparse_scores else 1
            s_score_norm = s_score / max_sparse if max_sparse > 0 else 0
            final_score = alpha * d_score + (1 - alpha) * s_score_norm
            fused.append((idx, final_score))

        fused.sort(key=lambda x: x[1], reverse=True)

        results = []
        for idx, score in fused[:top_k]:
            doc = self.documents[idx].copy()
            doc["score"] = round(score, 4)
            results.append(doc)

        return results

    def generate(self, query: str, context: str, temperature: float = 0.7, max_tokens: int = 512) -> str:
        """LLM ile yanıt üret."""
        prompt = f"""Aşağıdaki bağlam bilgilerini kullanarak soruyu yanıtla. Eğer bağlamda cevap yoksa, bilmediğini söyle.

BAĞLAM:
{context}

SORU: {query}

YANIT:"""

        messages = [
            {"role": "system", "content": "Sen Merinos'un yapay zeka müşteri hizmetleri asistanısın. Sadece verilen bağlamdaki bilgileri kullan."},
            {"role": "user", "content": prompt},
        ]

        inputs = self.tokenizer.apply_chat_template(
            messages, tokenize=True, return_tensors="pt", add_generation_prompt=True
        ).to("cuda")

        with torch.no_grad():
            outputs = self.model.generate(
                input_ids=inputs, max_new_tokens=max_tokens,
                temperature=temperature, top_p=0.9, use_cache=True,
                pad_token_id=self.tokenizer.eos_token_id,
            )

        return self.tokenizer.decode(outputs[0][inputs.shape[1]:], skip_special_tokens=True).strip()

    def query(self, question: str, top_k: int = 5) -> Dict:
        """Tam RAG pipeline: retrieve + generate."""
        # Retrieve
        retrieved = self.retrieve(question, top_k=top_k)
        context = "\n\n".join([f"[{i+1}] {doc['text']}" for i, doc in enumerate(retrieved)])

        # Generate
        response = self.generate(question, context)

        return {
            "question": question,
            "response": response,
            "sources": retrieved,
            "context_used": context,
        }


def build_index(data_path: str, index_dir: str):
    """FAISS index oluştur."""
    if not FAISS_AVAILABLE:
        raise RuntimeError("FAISS gerekli: pip install faiss-cpu")

    print("🔨 Index oluşturuluyor...")
    index_dir = Path(index_dir)
    index_dir.mkdir(parents=True, exist_ok=True)

    # Veriyi yükle
    documents = []
    with open(data_path, "r", encoding="utf-8") as f:
        for line in f:
            item = json.loads(line)
            # Farklı formatları normalize et
            if "question" in item and "answer" in item:
                text = f"Soru: {item['question']}\nCevap: {item['answer']}"
                documents.append({"text": text, "source": item.get("source", "faq"), "id": item.get("id", "")})
            elif "messages" in item:
                # ChatML format
                msgs = item["messages"]
                text = "\n".join([f"{m['role']}: {m['content']}" for m in msgs])
                documents.append({"text": text, "source": "chat", "id": item.get("id", "")})
            elif "user_message" in item:
                text = f"Soru: {item['user_message']}\nCevap: {item['assistant_response']}"
                documents.append({"text": text, "source": "tool_call", "id": item.get("id", "")})

    print(f"  📄 {len(documents)} doküman yüklendi")

    # Embed
    embedder = SentenceTransformer("intfloat/multilingual-e5-large")
    texts = [f"passage: {doc['text']}" for doc in documents]
    embeddings = embedder.encode(texts, normalize_embeddings=True, show_progress_bar=True)

    # FAISS index
    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)  # Inner product (cosine similarity için normalized)
    index.add(embeddings)

    # Kaydet
    faiss.write_index(index, str(index_dir / "faiss.index"))
    with open(index_dir / "documents.json", "w", encoding="utf-8") as f:
        json.dump(documents, f, ensure_ascii=False, indent=2)

    print(f"  ✅ Index kaydedildi: {index_dir}")
    print(f"     Vektör boyutu: {dim}")
    print(f"     Doküman sayısı: {len(documents)}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", type=str, required=True, choices=["index", "query", "serve"])
    parser.add_argument("--data", type=str, default="./datasets/raw/merinos_faq.jsonl")
    parser.add_argument("--index_dir", type=str, default="./rag_index")
    parser.add_argument("--model", type=str, default=None)
    parser.add_argument("--base_model", type=str, default="unsloth/Qwen2.5-7B-Instruct-bnb-4bit")
    parser.add_argument("--question", type=str, default="Merinos garanti süresi nedir?")
    parser.add_argument("--top_k", type=int, default=5)
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()

    if args.mode == "index":
        build_index(args.data, args.index_dir)

    elif args.mode == "query":
        if not args.model:
            print("❌ --model gerekli (query modu için)")
            return

        rag = MerinosRAG(args.index_dir, args.model, args.base_model)
        result = rag.query(args.question, top_k=args.top_k)

        print("\n" + "=" * 70)
        print("🔍 RAG SONUCU")
        print("=" * 70)
        print(f"\n❓ Soru: {result['question']}")
        print(f"\n💬 Yanıt:\n{result['response']}")
        print(f"\n📚 Kaynaklar:")
        for i, src in enumerate(result['sources'], 1):
            print(f"   [{i}] {src['source']} (skor: {src['score']}) - {src['text'][:100]}...")

    elif args.mode == "serve":
        from fastapi import FastAPI
        from pydantic import BaseModel
        import uvicorn

        if not args.model:
            print("❌ --model gerekli (serve modu için)")
            return

        rag = MerinosRAG(args.index_dir, args.model, args.base_model)

        app = FastAPI(title="Merinos RAG API")

        class QueryRequest(BaseModel):
            question: str
            top_k: int = 5

        @app.post("/query")
        async def query_endpoint(req: QueryRequest):
            return rag.query(req.question, top_k=req.top_k)

        @app.get("/health")
        async def health():
            return {"status": "ok", "documents": len(rag.documents)}

        print(f"🌐 RAG API başlatılıyor: http://localhost:{args.port}")
        uvicorn.run(app, host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()
