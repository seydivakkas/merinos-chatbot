# 🎓 Post-Training Kılavuzu

Eğitim tamamlandı. Şimdi ne yapacaksınız? Bu kılavuz, eğitimden sonraki tüm adımları, karar ağaçlarını ve dosyaları içerir.

---

## 📂 Eğitim Çıktıları (Nerede?)

Eğitim tamamlandıktan sonra şu dizin yapısı oluşur:

```
merinos_7b_8gb/
├── lora_adapters/              # 🎯 Eğitilmiş LoRA adapter'ları
│   ├── adapter_config.json     # LoRA konfigürasyonu
│   ├── adapter_model.safetensors  # Ağırlıklar (~10-50 MB)
│   ├── tokenizer.json
│   └── tokenizer_config.json
│
├── checkpoint-500/             # Ara checkpoint'ler
├── checkpoint-1000/
│
├── training_stats.json         # 📊 Eğitim istatistikleri
│   ├── final_loss
│   ├── peak_vram_gb
│   ├── training_time_hours
│   └── total_steps
│
└── vram_log.jsonl             # 📈 Adım adım VRAM log'u
```

---

## 🎯 Eğitimden Sonraki 5 Adım

### Adım 1: Eğitim Başarılı mı? Kontrol Et (2 dk)

```bash
# 1. training_stats.json var mı?
cat ./merinos_7b_8gb/training_stats.json

# Beklenen çıktı:
# {
#   "final_loss": 1.234,        # < 3.0 ise iyi, < 2.0 ise çok iyi
#   "peak_vram_gb": 6.8,        # < 7.5 ise güvenli
#   "training_time_hours": 22.5
# }
```

**Başarı kriterleri:**
- ✅ `final_loss` < 3.0 → İyi
- ✅ `peak_vram_gb` < 7.5 → OOM olmamış
- ✅ `training_stats.json` var → Eğitim tamamlanmış

**Eğer başarısızsa:**
- ❌ `final_loss` > 5.0 → Underfit. Epoch artır veya LR yükselt
- ❌ Dosya yok → OOM veya crash. Logları kontrol et: `cat merinos_7b_8gb/vram_log.jsonl | tail -20`

---

### Adım 2: Hızlı Inference Testi (5 dk)

```bash
python inference.py     --model ./merinos_7b_8gb/lora_adapters     --base_model unsloth/Qwen2.5-7B-Instruct-bnb-4bit
```

**Test soruları:**
```
👤 Siz: Merinos ne zaman kuruldu?
🤖 Meri: Merinos, 1970 yılında Onursal Başkanımız merhum Mehmet Erdemoğlu...

👤 Siz: Nepal serisi 160x230 fiyatı?
🤖 Meri: Nepal serisi 160x230 cm ölçüsünde; yün iplikten üretilmiş...

👤 Siz: Hisse almalı mıyım?
🤖 Meri: Yatırım tavsiyesi veremem...
```

**Doğru yanıt veriyorsa** → Adım 3'e geç  
**Yanıtlar bozuksa** → Eğitim verisini kontrol et, muhtemelen overfit

---

### Adım 3: Detaylı Değerlendirme (30 dk)

```bash
# 1. Perplexity + ROUGE + BLEU
python eval_model.py     --model ./merinos_7b_8gb/lora_adapters     --base_model unsloth/Qwen2.5-7B-Instruct-bnb-4bit     --test_data ./split/chatml/test.jsonl     --max_samples 500     --output ./evaluation_results/eval_results.json

# 2. Fine-tuned vs Base karşılaştırması (Hakem: Gemma-2-9B)
python benchmark_vs_baseline.py     --fine_tuned ./merinos_7b_8gb/lora_adapters     --base unsloth/Qwen2.5-7B-Instruct-bnb-4bit     --judge unsloth/gemma-2-9b-it-bnb-4bit     --test_data ./split/chatml/test.jsonl     --max_samples 100     --output ./evaluation_results/benchmark_results.json
```

**Sonuçları yorumla:**

| Metrik | İyi Değer | Yorum |
|--------|----------|-------|
| Perplexity | < 50 | Düşük = daha iyi tahmin |
| ROUGE-L | > 0.3 | Reference ile benzerlik |
| BLEU | > 10 | N-gram overlap |
| Hakem kazanma | > 55% | Fine-tuned base'den iyi |

**Karar ağacı:**
```
Hakem sonucu:
├── Fine-tuned > 55% kazandı
│   └── ✅ BAŞARILI! Deploy et.
│
├── Fine-tuned 45-55%
│   └── ⚠️ MARJINAL. Daha fazla veri/epoch dene.
│
└── Fine-tuned < 45%
    └── ❌ BAŞARISIZ. Nedenleri:
        - Veri kalitesi düşük
        - Overfit (epoch çok yüksek)
        - Underfit (epoch çok düşük)
        - LoRA rank çok düşük (bilgi sığmıyor)
```

---

### Adım 4: Model Birleştirme + Dönüşüm (10 dk)

```bash
# 1. LoRA + Base = Tek model
python merge_model.py     --base unsloth/Qwen2.5-7B-Instruct-bnb-4bit     --lora ./merinos_7b_8gb/lora_adapters     --output ./merinos_7b_8gb/merged

# 2. GGUF (Ollama / llama.cpp için)
python convert_gguf.py     --model ./merinos_7b_8gb/merged     --output ./merinos_7b_8gb/gguf     --quantization q4_k_m

# 3. Ollama'ya yükle
ollama create merinos -f Modelfile
ollama run merinos
```

---

### Adım 5: Production Deployment (Opsiyonel)

```bash
# A. REST API olarak çalıştır
python api_server.py     --model ./merinos_7b_8gb/lora_adapters     --base_model unsloth/Qwen2.5-7B-Instruct-bnb-4bit     --port 8000

# B. RAG + API
python rag_pipeline.py     --mode serve     --index_dir ./rag_index     --model ./merinos_7b_8gb/lora_adapters     --port 8001

# C. Docker ile tüm stack
./run_full_pipeline.sh --mode deploy
```

---

## 📊 Eğitim Sonrası Karar Ağacı

```
Eğitim tamamlandı
│
├── 1. training_stats.json var mı?
│   ├── HAYIR → Logları kontrol et, OOM veya crash
│   └── EVET → Devam et
│
├── 2. final_loss < 3.0?
│   ├── HAYIR (> 5.0) → Underfit
│   │   ├── Epoch artır (3 → 5)
│   │   ├── LR artır (1e-4 → 2e-4)
│   │   └── LoRA rank artır (8 → 16)
│   └── EVET → Devam et
│
├── 3. Inference testi başarılı mı?
│   ├── HAYIR (bozuk yanıtlar) → Overfit
│   │   ├── Epoch düşür (5 → 3)
│   │   ├── LR düşür (2e-4 → 5e-5)
│   │   └── Daha fazla veri ekle
│   └── EVET → Devam et
│
├── 4. Benchmark > 55%?
│   ├── HAYIR (< 45%) → Fine-tune başarısız
│   │   ├── Veri kalitesini kontrol et
│   │   ├── Daha fazla epoch dene
│   │   └── Veya 3B'ye geç (daha hızlı iterasyon)
│   └── EVET → 🎉 BAŞARILI! Deploy et.
│
└── 5. Deploy seçeneği:
    ├── A. Ollama (yerel kullanım)
    ├── B. FastAPI (REST endpoint)
    ├── C. RAG Pipeline (bilgi tabanlı)
    └── D. Docker (production stack)
```

---

## 🔧 Sık Karşılaşılan Sorunlar

### Sorun 1: "Model bozuk yanıtlar veriyor"
**Neden:** Overfit veya veri format hatası  
**Çözüm:**
```bash
# Veri formatını kontrol et
head -1 ./split/chatml/train.jsonl | python -m json.tool

# Eğitim log'larını kontrol et
cat ./merinos_7b_8gb/vram_log.jsonl | tail -50

# Daha düşük epoch ile tekrar dene
python train_7b_aggressive.py --epochs 1 --lora_r 4
```

### Sorun 2: "Inference çok yavaş"
**Neden:** 4-bit quantization inference'da yavaş olabilir  
**Çözüm:**
```bash
# Merge et (full precision inference)
python merge_model.py --base ... --lora ... --output ./merged

# Veya GGUF kullan (llama.cpp daha hızlı)
python convert_gguf.py --model ./merged --quantization q4_k_m
ollama create merinos -f Modelfile
```

### Sorun 3: "Hakem değerlendirmesi çok uzun sürüyor"
**Neden:** Gemma-2-9B de 4-bit yüklüyor, iki model aynı GPU'da  
**Çözüm:**
```bash
# Daha az örnek değerlendir
python benchmark_vs_baseline.py --max_samples 50  # 100 yerine 50

# Veya CPU'ya taşı
export CUDA_VISIBLE_DEVICES=""
python benchmark_vs_baseline.py  # Yavaş ama çalışır
```

### Sorun 4: "RAG index oluşturulmuyor"
**Neden:** FAISS yüklü değil  
**Çözüm:**
```bash
pip install faiss-cpu  # CPU versiyonu
# veya
pip install faiss-gpu  # GPU versiyonu (daha hızlı)
```

---

## 📁 Tüm Kod Dosyaları ve Amaçları

| Dosya | Amaç | Ne Zaman Çalıştırılır? |
|-------|------|----------------------|
| `train_7b_aggressive.py` | 7B QLoRA eğitimi (8GB VRAM) | Eğitim başlangıcı |
| `train_unsloth.py` | Standart Unsloth eğitimi (3B/7B) | Alternatif eğitim |
| `vram_benchmark.py` | VRAM testi ve risk analizi | Eğitim ÖNCESİ |
| `inference.py` | Interaktif chat demo | Eğitim SONRASI test |
| `eval_model.py` | Perplexity, ROUGE, BLEU metrikleri | Eğitim SONRASI değerlendirme |
| `benchmark_vs_baseline.py` | Fine-tuned vs Base karşılaştırması | Eğitim SONRASI benchmark |
| `merge_model.py` | LoRA + Base birleştirme | Deploy öncesi |
| `convert_gguf.py` | GGUF formatına dönüşüm | Ollama deploy öncesi |
| `api_server.py` | FastAPI REST API | Production API |
| `rag_pipeline.py` | FAISS + BM25 RAG pipeline | Bilgi tabanlı QA |
| `run_full_pipeline.sh` | Tek komutla tüm süreç | Otomasyon |
| `Modelfile` | Ollama model tanımı | Ollama entegrasyonu |
| `docker-compose.yml` | Docker stack | Production deploy |

---

## 🎯 Sonraki Adımlar (İterasyon)

Eğer ilk eğitim marjinal çıktıysa:

```bash
# 1. Daha fazla veri üret
# (mock veri yerine gerçek müşteri verileri)

# 2. Daha uzun eğitim
python train_7b_aggressive.py --epochs 5 --seq_length 768

# 3. Veya 3B ile hızlı iterasyon
python train_unsloth.py     --model unsloth/Qwen2.5-3B-Instruct     --epochs 5 --seq_length 1024 --lora_r 16

# 4. Sonra tekrar benchmark
python benchmark_vs_baseline.py ...
```

---

## 🏆 Başarı Tanımı

Projeniz başarılı sayılır eğer:

- ✅ Fine-tuned model base modelden **%55+** daha iyi (hakem)
- ✅ **Perplexity < 50** (test seti üzerinde)
- ✅ **OOM olmadan** eğitim tamamlandı
- ✅ Inference **< 3 saniye** (RTX 4070)
- ✅ Reddetme (refusal) doğru çalışıyor
- ✅ Tool-calling formatı doğru üretiyor

**Tümü sağlandıysa** → 🎉 Tebrikler! Production'a hazırsınız.
