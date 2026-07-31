[![Tüm Hakları Saklıdır](https://img.shields.io/badge/license-All%20Rights%20Reserved-red?style=flat-square)](#-lisans)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Qwen2.5-7B](https://img.shields.io/badge/LLM-Qwen2.5--7B--Instruct-7C3AED?style=flat-square)](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct)
[![QLoRA Unsloth](https://img.shields.io/badge/FineTuning-QLoRA_Unsloth_4bit-22C55E?style=flat-square)](https://github.com/unslothai/unsloth)
[![NVIDIA RTX 4070](https://img.shields.io/badge/GPU-RTX_4070_8GB_CUDA12-76B900?style=flat-square&logo=nvidia&logoColor=white)](https://www.nvidia.com/)
[![Tests](https://img.shields.io/badge/Tests-27%2F27_%E2%9C%85-brightgreen?style=flat-square)]()
[![Dil](https://img.shields.io/badge/Dil-Türkçe-E30A17?style=flat-square)]()

---

# 🧶 merinos-chatbot

> **Qwen 2.5 7B QLoRA fine-tune edilmiş, BM25 + Vektör hibrit RAG motoru ile güçlendirilmiş, canlı diyaloglardan kendi kendini sürekli eğiten ve KVKK uyumlu kurumsal AI müşteri hizmetleri platformu.**

Merinos halı müşterilerine 7/24 kişiselleştirilmiş destek sağlamak amacıyla geliştirilen bu platform, üç temel soruyu birden çözer: **Nasıl akıllı ve marka uyumlu konuşur?** (QLoRA fine-tuning), **Hangi bilgiye dayanarak konuşur?** (Hibrit RAG), **Nasıl zamanla iyileşir?** (Sürekli Öğrenme Pipeline'ı). Sistem tamamen on-premise çalışır; hiçbir müşteri verisi üçüncü taraf bulut servislerine gitmez.

---

## 📌 İçindekiler

1. [🎯 Projenin Amacı & Diğer Çözümlerden Farkı](#-projenin-amacı--diğer-çözümlerden-farkı)
2. [🏗️ Sistem Mimarisi (Uçtan Uca Diyagram)](#️-sistem-mimarisi-uçtan-uca-diyagram)
3. [📁 Proje Klasör Yapısı](#-proje-klasör-yapısı)
4. [🛠️ Ön Koşullar & Adım Adım Kurulum](#️-ön-koşullar--adım-adım-kurulum)
5. [⚡ Tüm npm Komutları Referansı](#-tüm-npm-komutları-referansı)
6. [🧠 QLoRA Fine-Tuning Kılavuzu](#-qlora-fine-tuning-kılavuzu)
7. [🔄 Sürekli Öğrenme Pipeline'ı](#-sürekli-öğrenme-pipelineı)
8. [🌐 Web Distilasyonu & Teacher AI Mimarisi](#-web-distilasyonu--teacher-ai-mimarisi)
9. [🔒 KVKK Gizlilik & Maskeleme Motoru](#-kvkk-gizlilik--maskeleme-motoru)
10. [📊 Gölge Değerlendirme & A/B Testi](#-gölge-değerlendirme--ab-testi)
11. [📑 API Uç Noktaları Referansı](#-api-uç-noktaları-referansı)
12. [💻 Admin Panel Kullanım Kılavuzu](#-admin-panel-kullanım-kılavuzu)
13. [🚀 Geliştirici Yol Haritası (10 Faz)](#-geliştirici-yol-haritası-10-faz)
14. [🧪 Test Sonuçları](#-test-sonuçları)
15. [📜 Lisans](#-lisans)

---

## 🎯 Projenin Amacı & Diğer Çözümlerden Farkı

### Neden Bu Proje?

Çoğu kurumsal chatbot ya kural tabanlı ("müşteri 'leke' derse şu cevabı ver") ya da bulut tabanlı API sarmalayıcısı (OpenAI API'ye yönlendirme) şeklinde çalışır. Bu yaklaşımların her ikisi de kritik sorunlar taşır: Kural tabanlı sistemler dil ve bağlam anlayışından yoksundur; API sarmalayıcıları ise marka sesini yansıtamaz, müşteri verilerini dışarı sızdırır ve her sorgu için maliyet üretir.

Bu proje, üç farklı sorunu aynı anda çözer:

- **Marka uyumu:** Model, Merinos'un kurumsal dili, ürün gamı, garanti şartları ve leke temizlik rehberleriyle fine-tune edilmiştir.
- **Veri egemenliği:** Tüm işlem on-premise (NVIDIA RTX 4070 GPU) gerçekleşir; hiçbir müşteri verisi dışarı çıkmaz.
- **Öğrenen sistem:** Canlı diyaloglar ve yönetici onaylarıyla model 100 kayıtta bir kendi kendini yeniden eğitir.

### "Meri" Persona'sı

Sistemin dil modeli, **Meri** adını verdiğimiz Merinos Kıdemli Müşteri Hizmetleri Temsilcisi persona'sını benimseyecek şekilde eğitilmiştir. Meri; empati kuran, çözüm odaklı, nazik ve marka tonuyla konuşan bir temsilcidir. System prompt şablonu şöyledir:

```
Sen Merinos'un Kıdemli Müşteri Hizmetleri Uzmanısın. İsmin Meri.
Türkçe konuşuyorsun. Halı, ev tekstili, leke temizliği, sipariş takibi,
bayi ağı ve garanti süreçlerinde uzmanlaşmış; nazik, empati kuran ve
çözüm odaklı bir destek temsilcisisin.
```

### 5 Konuşma Kategorisi

Meri, eğitim verisinde 5 ana kategoride uzmanlaştırılmıştır:

| Kategori | Örnek Soru | Karar Mekanizması |
|----------|-----------|-------------------|
| **Leke / Temizlik** | "Halımda çay lekesi var" | RAG → Leke Rehberi KB |
| **Garanti / İSO** | "2 yıllık garantim geçerli mi?" | RAG → Garanti Koşulları |
| **Ürün Özellikleri** | "Akrilik halı tüylenir mi?" | RAG → Ürün Kataloğu |
| **Sipariş Takibi** | "MRN-12345 siparişim nerede?" | API Entegrasyonu |
| **Güvenli Reddetme** | "Rakip halı tavsiye eder misin?" | Policy Engine → Sınır Çizme |

### Kural Tabanlı vs. ML Tabanlı Fark

```
Kural Tabanlı Sistem:
  if message.contains("leke") → return "Leke için şunu yapın..."
  Sorun: "Halımda çay döktüm" ifadesini algılayamaz.

ML Tabanlı (Bu Sistem):
  Model Türkçe'nin morfolojisini öğrenmiştir.
  "Halımda çay döktüm" → "leke/temizlik" kategorisi → RAG → kişiselleşmiş yanıt.
```

---

## 🏗️ Sistem Mimarisi (Uçtan Uca Diyagram)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         MERİNOS AI CHATBOT PLATFORMU                           │
└─────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────┐        ┌──────────────────────────────────────────────┐
  │   MÜŞTERİ        │        │        SUPPORT CORE REST API (Port 8787)     │
  │  (Port 3000)     │        │                                              │
  │                  │        │  ┌─────────────┐   ┌──────────────────────┐ │
  │  widget/         │ ──────▶│  │Policy Engine│   │ KVKK Privacy Masker  │ │
  │  merinos-        │  HTTP  │  │(Level 0/1)  │   │(privacy_masker.py)   │ │
  │  widget.js       │        │  └──────┬──────┘   └──────────┬───────────┘ │
  │                  │◀───────│         │                      │             │
  │  👍/👎 feedback  │        │         ▼                      ▼             │
  └──────────────────┘        │  ┌──────────────────────────────────────┐   │
                              │  │  Hibrit RAG Motoru (embeddingIndex.ts)│   │
                              │  │  BM25 (K1=1.5, B=0.75)               │   │
                              │  │  + Edge-Ngram Vektör (Türkçe NLP)    │   │
                              │  │  + Recency Bonus                     │   │
                              │  └──────────────────────────────────────┘   │
                              │         │                                    │
                              │         ▼                                    │
                              │  ┌──────────────────────────────────────┐   │
                              │  │    Python FastAPI Inference (Port 8000)│  │
                              │  │  Qwen 2.5 7B QLoRA NF4 4-bit         │   │
                              │  │  CUDA 12.x / RTX 4070 (8GB)          │   │
                              │  │  Hot-Swap: POST /reload_adapter       │   │
                              │  │  A/B Router: 90% stable / 10% new    │   │
                              │  └──────────────────────────────────────┘   │
                              └──────────────────────────────────────────────┘
                                              │
                                              ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                       SÜREKLİ ÖĞRENME PIPELINE'I                           │
  │                                                                             │
  │  Müşteri Sohbeti                                                            │
  │       │                                                                     │
  │       ▼                                                                     │
  │  collect_training_data.ts ──▶ pending_review.jsonl                         │
  │       │                                                                     │
  │       ▼                                                                     │
  │  privacy_masker.py (KVKK) ──▶ [TC_GIZLI] [TEL_GIZLI]                     │
  │       │                                                                     │
  │       ▼                                                                     │
  │  Admin Panel (Port 8080)  ──▶ ✅ Onayla / ✏️ Düzenle / ❌ Reddet          │
  │       │                                                                     │
  │       ▼                                                                     │
  │  approved.jsonl (100 kayıt eşiği) ──▶ auto_retrain.py (QLoRA)             │
  │       │                                                                     │
  │       ▼                                                                     │
  │  shadow_eval.py (ROUGE-1/L + BLEU) ──▶ PROMOTE / HOLD / REJECT           │
  │       │                                                                     │
  │       ▼                                                                     │
  │  POST /reload_adapter ──▶ Hot-Swap ──▶ Meri iyileşir ♻️                   │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                    WEB DİSTİLASYON PIPELINE'I                              │
  │                                                                             │
  │  scrape_merinos_site.py                                                     │
  │  (merinos.com.tr → ürün, leke, garanti, bayi)                             │
  │       │                                                                     │
  │       ▼                                                                     │
  │  data/distilled/raw_site_knowledge.json                                    │
  │       │                                                                     │
  │       ▼                                                                     │
  │  Online Teacher AI Seçimi:                                                  │
  │  ├── Gemini 1.5 Flash (Search Grounding)                                   │
  │  ├── Groq Llama 3.3 70B (Toplu Üretim)                                    │
  │  ├── OpenAI GPT-4o (Altın Standart)                                        │
  │  └── DuckDuckGo Web Search (API Key'siz)                                   │
  │       │                                                                     │
  │       ▼                                                                     │
  │  ChatML + DPO {prompt, chosen, rejected}                                   │
  │       │                                                                     │
  │       ▼                                                                     │
  │  KVKK Filtresi ──▶ Yönetici Onayı ──▶ approved.jsonl                     │
  └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Proje Klasör Yapısı

Her dosya; ne işe yaradığını değil, **neden bu şekilde tasarlandığını** açıklayacak biçimde belgelenmiştir.

```
merinos-chatbot/
│
├── admin-panel/                          # Build aracı gerektirmeyen yönetim arayüzü
│   ├── index.html                        # 8 sekme + karanlık/aydınlık tema şalteri
│   ├── app.js                            # Live API entegrasyonu, onay mantığı, modal
│   └── styles.css                        # CSS değişkenleri ile glassmorphism dark/light
│
├── support-core/                         # Ana iş mantığı servisi (Node.js / TypeScript)
│   └── src/
│       ├── index.ts                      # Express REST API — /chat /training /model endpoint'leri
│       │                                 # NOT: Dış bağımlılık sıfırlanmış minimal mimari
│       ├── types.ts                      # 25+ TypeScript arayüzü — tek kaynak gerçek
│       ├── adapters/
│       │   ├── qwenModelAdapter.ts       # Meri persona + 5 kategori diyalog şablonu
│       │   │                             # NOT: Model katmanını soyutlar; gerektiğinde
│       │   │                             # farklı model'e geçiş arayüz değiştirmez
│       │   ├── chatwootAdapter.ts        # Webhook normalizasyonu + idempotency guard
│       │   ├── frappeAdapter.ts          # Circuit Breaker sarmalı Frappe ERP geçidi
│       │   └── ragflowClient.ts          # RAGFlow mock adaptörü (aynı sözleşme ile)
│       ├── services/
│       │   ├── embeddingIndex.ts         # BM25 (K1=1.5, B=0.75) + Edge-Ngram hibrit RAG
│       │   │                             # NOT: Türkçe'nin sondan eklemeli yapısına göre
│       │   │                             # özelleştirilmiş — "leke/lekesi/lekesinden" hepsini bulur
│       │   ├── policyEngine.ts           # Seviye 0 (otomatik) / Seviye 1 (insan onayı)
│       │   ├── approvalService.ts        # 4-Göz İlkesi + tek kullanımlık onay token'ları
│       │   ├── auditLogger.ts            # KVKK maskeli denetim kaydı (writeAuditEvent)
│       │   ├── authService.ts            # Bearer Token, TOTP 2FA, scope tabanlı yetki
│       │   ├── ticketDraftService.ts     # Bilet taslağı + müşteri onay akışı
│       │   ├── routingEngine.ts          # Departman + temsilci seçim motoru
│       │   ├── slaEngine.ts             # İş saati farkındalıklı SLA hesaplayıcı
│       │   ├── workCalendar.ts           # UTC+3, 09:00-18:00, TR resmi tatilleri
│       │   ├── ragEvaluation.ts          # RAG kalite kapısı (ROUGE/BLEU ölçümü)
│       │   ├── feedbackService.ts        # 👍/👎 + temsilci düzeltmesi geri besleme döngüsü
│       │   ├── documentIntakePipeline.ts # 8-adım belge kabul hattı (PII tarama dahil)
│       │   ├── eventBus.ts              # In-process yayın/abone + idempotency + DLQ
│       │   └── rateLimiter.ts            # Sabit pencere rate limiter (60 req/dk)
│       ├── db/
│       │   ├── repositories.ts           # Koleksiyon bazlı dar arayüz (Postgres'e geçişe hazır)
│       │   └── jsonStore.ts             # .store/*.json okuma/yazma (dev/demo mekanizması)
│       ├── api/
│       │   └── schemas.ts               # Alan bazlı istek gövdesi şema tanımları
│       └── utils/
│           ├── ids.ts                    # PII maskeleme + correlationId + UUID üretici
│           ├── validate.ts              # Sema doğrulama motoru (zod/ajv bağımlılığı yok)
│           └── circuitBreaker.ts        # Frappe için devre kesici (3 hata → 30sn yarı-açık)
│
├── scripts/                             # ML ve otomasyon betikleri
│   ├── train_meri_qlora.py              # Ana QLoRA eğitim scripti (transformers.Trainer)
│   │                                    # NOT: TRL SFTTrainer yerine transformers.Trainer
│   │                                    # kullanılmıştır — 600x hız artışının sebebi burada
│   ├── inference_server.py              # FastAPI + threading.Lock ile Hot-Swap LoRA yükleyici
│   ├── collect_training_data.ts         # .store/ → ChatML formatlı pending_review.jsonl
│   ├── auto_retrain.py                  # 100 kayıt eşiğinde GPU eğitimini tetikler
│   ├── privacy_masker.py               # KVKK motoru — 12/12 test, %100 başarı
│   ├── shadow_eval.py                   # ROUGE-1/L + BLEU gölge değerlendirme
│   ├── scheduler.ts                     # Her 6 saatte veri toplama, 02:00'de eğitim teti
│   ├── online_teacher_distiller.py      # Gemini/Groq/GPT-4o/DeepSeek + DPO çifti üretici
│   ├── scrape_merinos_site.py           # merinos.com.tr Playwright kazıyıcı
│   ├── distill_teacher_dataset.py       # Kazınan site → ChatML diyalog sentezleyici
│   ├── seed.ts                          # Örnek veriyle sıfırlama (tüm koleksiyonlar)
│   ├── demo.ts                          # 27 UAT + entegrasyon senaryosu
│   └── build-admin-data.ts             # snapshot.json → admin-panel/data.json
│
├── data/
│   ├── raw/                             # Ham veriler — değiştirilmez
│   │   ├── merinos_faq.jsonl            # SSS veri seti (leke, garanti, ürün)
│   │   ├── call_center_anon.jsonl       # Anonimleştirilmiş çağrı merkezi kayıtları
│   │   ├── product_qa.jsonl             # Ürün soru-cevap veritabanı
│   │   ├── refusals.jsonl               # Güvenli reddetme örnekleri
│   │   └── tool_calls.jsonl             # Araç çağrısı diyalog örnekleri
│   ├── chatml/                          # Eğitim için hazırlanmış ChatML verisi
│   │   ├── train.jsonl                  # 12.000 eğitim örneği
│   │   ├── val.jsonl                    # 1.500 doğrulama örneği
│   │   └── test.jsonl                   # 500 test örneği
│   ├── collected/                       # Sürekli öğrenme verileri (runtime)
│   │   ├── pending_review.jsonl         # KVKK maskeli, yönetici onay bekleyen kayıtlar
│   │   ├── approved.jsonl               # Onaylanmış eğitim verisi
│   │   ├── dpo_pairs.jsonl              # DPO tercih çiftleri
│   │   └── stats.json                   # Sürekli öğrenme istatistikleri
│   └── distilled/                       # Web kazıma ve distilasyon çıktıları
│       ├── raw_site_knowledge.json      # merinos.com.tr ham kazıma verisi
│       └── site_knowledge.md            # Yapılandırılmış bilgi tabanı markdown
│
├── docs/
│   ├── FINE_TUNING_ACCELERATION_GUIDE.md  # 600x hızlanma teknik raporu
│   ├── DEVELOPMENT_ROADMAP.md              # 10 fazlı geliştirici yol haritası
│   └── specs/                              # 20 bölümlü mimari şartname belgeleri
│
├── widget/                              # Müşteri tarafı chatbot arayüzü
│   ├── index.html                       # Demo mağaza sayfası
│   ├── merinos-widget.js                # Sohbet balonu mantığı (otonom, bağımsız)
│   └── merinos-widget.css               # Glassmorphism + animasyonlar
│
├── agent-orchestrator/
│   └── src/tools/index.ts              # 11 adet araç sözleşmesi implementasyonu
│
├── ml/post_training/                   # Post-training pipeline scripts
│   ├── train_unsloth.py                # Unsloth destekli eğitim alternatifi
│   ├── merge_model.py                  # LoRA adaptörü base modele birleştirme
│   ├── convert_gguf.py                 # GGUF dönüşümü (Ollama/llama.cpp)
│   └── api_server.py                   # Birleştirilmiş model için inference API
│
├── .gitignore                          # node_modules, .env, .store, model ağırlıkları
├── LICENSE                             # Özel Lisans — Tüm Hakları Saklıdır
├── package.json                        # Bağımlılıklar ve tüm npm betikleri
├── tsconfig.json                       # TypeScript derleyici konfigürasyonu
└── docker-compose.yml                  # HEDEF prod topolojisi (referans doküman)
```

---

## 🛠️ Ön Koşullar & Adım Adım Kurulum

### Sistem Gereksinimleri

| Bileşen | Minimum | Önerilen |
|---------|---------|----------|
| **İşletim Sistemi** | Windows 10 64-bit | Windows 11 64-bit |
| **Node.js** | 18.x LTS | 20.x LTS |
| **Python** | 3.10 | 3.11 |
| **NVIDIA GPU** | 8 GB VRAM | RTX 4070 / RTX 3090 |
| **CUDA** | 11.8 | 12.x |
| **RAM** | 16 GB | 32 GB |
| **Disk (model ağırlıkları)** | 25 GB | 50 GB (SSD) |

> **⚠️ Önemli:** Eğitim (`npm run retrain`) yalnızca NVIDIA GPU'lu makinelerde çalışır. Inference sunucusu CPU'da da çalışabilir ancak yanıt süresi 30-60 saniyeye ulaşır.

---

### 1. Repo Klonlama

```bash
git clone https://github.com/seydivakkas/merinos-chatbot.git
cd merinos-chatbot
```

### 2. Node.js Bağımlılıklarını Yükleme

```bash
npm install
```

Bu komut `package.json` içindeki tüm TypeScript bağımlılıklarını (`tsx`, `typescript` vb.) yükler.

### 3. Python Bağımlılıklarını Yükleme

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install transformers peft bitsandbytes trl unsloth accelerate
pip install rouge-score sacrebleu fastapi uvicorn playwright
pip install requests beautifulsoup4 python-dotenv google-generativeai groq openai
```

> **Not:** `torch` için CUDA 12.1 uyumlu sürümü elle belirtmek gerekir. Farklı CUDA versiyonu için PyTorch resmi kurulum sayfasına başvurun.

### 4. Playwright Browser Kurulumu

`scrape_merinos_site.py` scripti, JavaScript içeren sayfaları kazımak için Chromium kullanır:

```bash
python -m playwright install chromium
```

### 5. Ortam Değişkenlerini Yapılandırma

Proje kök dizininde `.env` dosyası oluşturun:

```bash
# Gerekli değil (ücretsiz tier için)
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# Opsiyonel
OPENAI_API_KEY=your_openai_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# GPU bellek optimizasyonu — EĞİTİM ÖNCESİ ZORUNLU
PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
```

> **Not:** API key olmadan sistem yalnızca `DuckDuckGo Web Search` ile çalışır; Gemini ve Groq ücretsiz katmanı için key alınması önerilir.

### 6. Eğitim Verisini Oluşturma (İlk Kurulum)

Ham veri dosyalarını RAG indeksine yükleyin:

```bash
npm run seed
```

### 7. Tüm Sistemi Başlatma

Tek komutla Support Core API (8787), Admin Panel (8080) ve Web Widget (3000) ayağa kalkar:

```bash
npm run ui
```

Terminal çıktısı:

```
[Support Core] API sunucusu http://localhost:8787 üzerinde çalışıyor
[Admin Panel] Yönetim paneli http://localhost:8080 üzerinde çalışıyor
[Widget] Demo mağaza http://localhost:3000 üzerinde çalışıyor
```

### 8. Python Inference Sunucusunu Başlatma

```bash
python scripts/inference_server.py
```

Terminal çıktısı:

```
[Inference] Qwen 2.5 7B yükleniyor... (yaklaşık 45-60 saniye)
[Inference] LoRA adaptörü yüklendi: ./lora_adapters/latest
[Inference] FastAPI sunucu http://localhost:8000 üzerinde hazır
[Inference] GPU: NVIDIA GeForce RTX 4070 | VRAM: 5.3/8.0 GB kullanımda
```

### 9. QLoRA Fine-Tuning Başlatma

```bash
python scripts/train_meri_qlora.py \
  --model "unsloth/Qwen2.5-7B-Instruct-bnb-4bit" \
  --data_dir "./data/chatml/" \
  --output_dir "./merinos_meri_model" \
  --epochs 3 \
  --batch_size 1 \
  --grad_accum 8 \
  --max_seq_length 512
```

---

## ⚡ Tüm npm Komutları Referansı

| Komut | Portlar | Açıklama |
|-------|---------|----------|
| `npm run ui` | 3000, 8080, 8787 | Tüm sistemi başlat (Widget + Admin + API) |
| `npm run server` | 8787 | Yalnızca Support Core REST API'sini başlat |
| `npm run seed` | — | Tüm koleksiyonları temizle, örnek veriyle doldur |
| `npm run demo` | — | 27 UAT + entegrasyon senaryosunu çalıştır |
| `npm test` | — | 27 test (CI modu, PASS/FAIL çıktısı) |
| `npm run collect` | — | Canlı diyalogları `pending_review.jsonl`'e topla |
| `npm run retrain` | — | Manuel QLoRA yeniden eğitimini başlat |
| `npm run retrain-status` | — | Eğitim ilerlemesini kontrol et |
| `npm run scheduler` | — | Gece 02:00 otomatik eğitim zamanlayıcısını başlat |
| `npm run scrape-site` | — | `merinos.com.tr`'den bilgi kazı |
| `npm run distill` | — | Kazınan veriden diyalog sentezle |
| `npm run distill-online` | — | Canlı internet Teacher AI distilasyonu |
| `npm run distill-auto` | — | Otomatik distilasyon döngüsü (100 kayıt bekle) |
| `npm run mask` | — | `privacy_masker.py` ile KVKK maskelemesi çalıştır |
| `npm run mask-test` | — | 12 KVKK test senaryosunu çalıştır |
| `npm run shadow-eval` | — | Aktif model üzerinde gölge değerlendirme |
| `npm run shadow-eval-test` | — | ROUGE/BLEU simülasyonu (mock data ile) |
| `npm run build-admin-data` | — | `snapshot.json` → `admin-panel/data.json` |
| `npm run meri-server` | 8000 | Python inference sunucusunu başlat |

---

## 🧠 QLoRA Fine-Tuning Kılavuzu

### Model Seçimi ve Gerekçesi

**Temel Model:** `unsloth/Qwen2.5-7B-Instruct-bnb-4bit`

Qwen 2.5 7B Instruct, Türkçe dil yetenekleri test edildiğinde benzer parametreli modeller (Llama 3.1 8B, Mistral 7B) arasında tutarlı olarak en üst sıralarda yer almaktadır. `bnb-4bit` varyantı, BitsAndBytes kütüphanesiyle 4-bit NF4 kuantizasyon uygulanmış halidir; bu sayede 8 GB VRAM'e tam olarak sığar.

### Kuantizasyon: 4-bit NF4 (NormalFloat4)

NF4 (NormalFloat4), standart INT4'e göre daha az hata ile ağırlıkları temsil eder çünkü ağırlık dağılımının Normal (Gauss) dağılıma benzediğini varsayarak bu dağılıma optimize edilmiş değerleri kullanır. RTX 4070 8 GB VRAM ile 7B parametreli bir modeli eğitmek bu teknik olmadan imkânsızdır.

### LoRA Hiperparametreleri ve Gerekçeleri

| Parametre | Değer | Neden Bu Değer? |
|-----------|-------|-----------------|
| `r` (rank) | `16` | Düşük rank = az parametrede yüksek verim; 8'den büyük değerler bu veri büyüklüğünde overfitting riski taşır |
| `lora_alpha` | `32` | `alpha/r = 2`: Öğrenme oranını ölçekler; düşük rank ile dengeleme |
| `lora_dropout` | `0.05` | Hafif regularizasyon; çok yüksek dropout öğrenmeyi engeller |
| Target Modules | `q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj` | Transformer'ın tüm dikkat + FFN katmanlarını günceller |

```python
from peft import LoraConfig

lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    bias="none",
    task_type="CAUSAL_LM"
)
```

### Eğitim Parametreleri ve Gerekçeleri

| Parametre | Değer | Neden Bu Değer? |
|-----------|-------|-----------------|
| `max_seq_length` | `512` | Müşteri diyalogları ortalama 200-350 token; 512 güvenli tampon sağlar |
| `per_device_train_batch_size` | `1` | 8 GB VRAM ile daha büyük batch OOM hatası üretir |
| `gradient_accumulation_steps` | `8` | Gerçek effective batch size = 1×8 = 8; belleği korur |
| `num_train_epochs` | `3` | 3 tam geçiş sonrası doğrulama kaybı plato yapar |
| `learning_rate` | `2e-4` | QLoRA için standart; daha büyük değerler dil modelini bozar |
| `eval_strategy` | `"no"` | **OOM Önlemi:** `steps` modunda logits.float() cast'ı 2.18 GiB ekstra VRAM tüketir |
| `save_strategy` | `"steps"` | Her 500 adımda checkpoint; GPU çökmesi durumunda devam edilebilir |
| `save_total_limit` | `3` | Disk tasarrufu: eski checkpoint'ler silinir |
| `gradient_checkpointing` | `True` | Geri yayılımda aktivasyon yeniden hesaplama → %40 VRAM tasarrufu |
| `attn_implementation` | `"sdpa"` | Scaled Dot-Product Attention: Flash Attention alternatifsiz hız |

### 🚨 600x Hızlanmanın Teknik Açıklaması

Bu projenin geliştirilmesinde en kritik teknik buluş, **TRL SFTTrainer yerine `transformers.Trainer`'ın kullanılmasıdır.**

```diff
- # Eski yöntem (TRL SFTTrainer) — 6.000 saniye/adım
- trainer = SFTTrainer(
-     model=model,
-     train_dataset=dataset,
-     ...
- )

+ # Yeni yöntem (transformers.Trainer + öntokenize) — 10 saniye/adım
+ # 1. Önce tüm veri seti tokenize edilir ve labels atanır
+ tokenized_dataset = dataset.map(tokenize_and_set_labels, batched=True)
+ trainer = Trainer(
+     model=model,
+     train_dataset=tokenized_dataset,
+     ...
+ )
```

**Neden TRL SFTTrainer yavaş?**
TRL'nin iç implementasyonu, 152.064 token'lık Qwen vokabüler matrisini (`lm_head`) eğitim adımında `float32`'ye cast eder. Bu işlem her adımda **2.18 GiB ekstra geçici VRAM** kullanır ve zaten sınırda olan belleği zorlayarak 6.000 saniye/adım'a yol açar.

**Çözüm:** `transformers.Trainer` doğrudan `bfloat16` üzerinde çalışır; öntokenizasyon sayesinde veri işleme overhead'i de sıfıra iner. Sonuç: **10 saniye/adım → ~13-15 saatlik toplam eğitim.**

### Ortam Değişkeni (Eğitim öncesi ZORUNLU)

```bash
set PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
```

Bu değişken, CUDA bellek tahsis yöneticisinin küçük parçaları birleştirmesini sağlar. Olmadan RTX 4070 üzerinde eğitim başlamadan çöker.

### ChatML Veri Formatı

Tüm eğitim verisi standart ChatML formatındadır:

```json
{
  "messages": [
    {
      "role": "system",
      "content": "Sen Merinos'un Kıdemli Müşteri Hizmetleri Uzmanısın. İsmin Meri. Türkçe konuşuyorsun. Halı, ev tekstili, leke temizliği, sipariş takibi, bayi ağı ve garanti süreçlerinde uzmanlaşmış; nazik, empati kuran ve çözüm odaklı bir destek temsilcisisin."
    },
    {
      "role": "user",
      "content": "Halımda çay lekesi var, nasıl çıkarırım?"
    },
    {
      "role": "assistant",
      "content": "Merhaba! Çay lekesini çıkarmak için şu adımları uygulayın: Önce leke bölgesini kuru bir bezle fazla sıvıyı ovalamadan tampon yapın. Sonra ılık su ve birkaç damla bulaşık deterjanını karıştırın. Hazırladığınız solüsyonu temiz bir bezle lekeye uygulayarak tampon hareketleriyle çalışın. Son olarak temiz soğuk suyla durulayın ve kurutun. Asla kuvvetlice ovmayın; bu işlem ip dokusuna zarar verebilir."
    }
  ]
}
```

### Eğitim Komutu (Tam Parametrelerle)

```bash
set PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
python scripts/train_meri_qlora.py \
  --model "unsloth/Qwen2.5-7B-Instruct-bnb-4bit" \
  --data_dir "./data/chatml/" \
  --output_dir "./merinos_meri_model" \
  --epochs 3 \
  --batch_size 1 \
  --grad_accum 8 \
  --max_seq_length 512
```

**RTX 4070 Laptop 8 GB VRAM Eğitim Metrikleri:**

| Metrik | Değer |
|--------|-------|
| Eğitim süresi | ~13-15 saat |
| VRAM kullanımı | 5.3 / 8.0 GB |
| Adım süresi | ~10 saniye/adım |
| Toplam adım | ~4.500 (3 epoch) |
| Checkpoint aralığı | Her 500 adım |
| Son train loss | ~0.87 |

---

## 🔄 Sürekli Öğrenme Pipeline'ı

Sistemin zamanla kendi kendini iyileştirmesini sağlayan kapalı döngü (closed-loop) öğrenme hattı aşağıdaki gibi çalışır:

```
┌─────────────────────────────────────────────────────────────────┐
│                   SÜREKLİ ÖĞRENME DÖNGÜSÜ ♻️                  │
└─────────────────────────────────────────────────────────────────┘

[1] Müşteri ↔ Meri sohbeti
    Widget → POST /v1/chat/message → Inference Server (Port 8000)
         │
         ▼
[2] Konuşma verisi toplanır
    POST /v1/training/interaction
    collect_training_data.ts
    → pending_review.jsonl (ham format)
         │
         ▼
[3] KVKK Maskeleme (otomatik)
    privacy_masker.py
    → [TC_GIZLI] [TEL_GIZLI] [IBAN_GIZLI] ...
    → .store/pending_training.json
         │
         ▼
[4] Yönetici İnceleme (Admin Panel → Port 8080)
    ✅ Onayla → approved.jsonl'e ekle
    ✏️ Düzenle → yanıtı düzelt, onayla
    ❌ Reddet → çöpe at
         │
         ▼
[5] 100 Onaylı Kayıt Eşiği
    auto_retrain.py izler...
    100 kayıt dolduğunda:
    → RTX 4070 GPU'da QLoRA yeniden eğitim başlar
    → Yeni LoRA adaptörü: ./lora_adapters/v{N+1}/
         │
         ▼
[6] Gölge Değerlendirme
    shadow_eval.py
    → ROUGE-1 / ROUGE-L / BLEU hesaplanır
    → %80+ → PROMOTE
    → %65-79 → HOLD (Admin bildirir)
    → %65- → REJECT (eski adaptör korunur)
         │
         ▼
[7] Hot-Swap (sunucu kapatılmaz)
    POST /reload_adapter
    → inference_server.py: model_lock.acquire()
    → Yeni adaptör belleğe yüklenir
    → model_lock.release()
    → Meri iyileşmiş model ile yanıt vermeye devam eder ✅
         │
         ▼
    [1]'e dön → Döngü devam eder ♻️
```

### Checkpoint Sistemi

Eğitim sırasında her 500 adımda model otomatik kaydedilir:

```
./merinos_meri_model/
├── checkpoint-500/
├── checkpoint-1000/
├── checkpoint-1500/   ← save_total_limit=3 sonrası eski checkpoint silinir
├── checkpoint-2000/
├── checkpoint-2500/
└── checkpoint-final/  ← Eğitim tamamlandığında son model
```

`save_total_limit=3` ayarı sayesinde disk dolmaz; her zaman son 3 checkpoint korunur.

### Zamanlayıcı Konfigürasyonu (`scheduler.ts`)

```typescript
// Her 6 saatte bir veri toplama
cron.schedule("0 */6 * * *", async () => {
  await collectTrainingData();
});

// Her gece 02:00'de yeniden eğitim kontrolü
cron.schedule("0 2 * * *", async () => {
  const stats = await getTrainingStats();
  if (stats.approvedCount >= 100) {
    await triggerRetraining();
  }
});
```

---

## 🌐 Web Distilasyonu & Teacher AI Mimarisi

Web distilasyonu, sistemin internetten ve büyük modellerden bilgi çekerek yerel modeli sürekli güncel tutmasını sağlar. Bu yaklaşım **Teacher-Student (Öğretmen-Öğrenci)** paradigmasına dayanır.

### Pipeline Adımları

```
1. Web Kazıma (scrape_merinos_site.py)
   merinos.com.tr → ürün sayfaları, leke rehberleri,
                     garanti koşulları, bayi ağı
   → data/distilled/raw_site_knowledge.json
   → data/distilled/site_knowledge.md

2. Soru Üretimi
   distill_teacher_dataset.py
   Kazınan her bilgi parçası için:
   - 5 farklı müşteri personasında soru üretir
   - (Ziyaretçi, Bayi, Kurumsal, Şikayetçi, Meraklı)

3. Teacher AI Distilasyonu (online_teacher_distiller.py)
   → Gemini 1.5 Flash: Google Search Grounding ile gerçek zamanlı
   → Groq Llama 3.3 70B: 30 RPM ücretsiz, hızlı toplu üretim
   → OpenAI GPT-4o: Altın standart kalite
   → DuckDuckGo: API key gerektirmez

4. KVKK Filtresi
   privacy_masker.py her diyalogu filtreler

5. Admin Onayı → approved.jsonl

6. Model Eğitimi → auto_retrain.py
```

### DPO (Direct Preference Optimization) Tercih Çifti Formatı

DPO, modele yalnızca "doğru cevabı" değil "yanlış cevabı reddetmeyi" de öğretir:

```json
{
  "id": "dpo_20260731_001",
  "prompt": "Merinos akrilik halımda mürekkep lekesi var. Çamaşır suyu kullanabilir miyim?",
  "chosen": "Çamaşır suyu akrilik halıların rengini soldurur ve ip dokusuna kalıcı zarar verebilir. Bunun yerine şunu öneririm: Lekeyi yaymadan temiz bir bezle fazla mürekkebi tampon yapın. Ardından kolonyalı pamuk ile lekeyi dış kenardan içeriye doğru temizleyin. Son adımda nötr sabunlu ılık su ile durulayıp havlu ile kurulayın.",
  "rejected": "Çamaşır suyu dökebilirsiniz, leke çıkar.",
  "source": "online_teacher_gemini_flash",
  "category": "leke_temizlik",
  "timestamp": "2026-07-31T16:00:00Z"
}
```

### Teacher AI Karşılaştırması

| Teacher AI | RPM Limiti | Maliyet | Kalite | En İyi Kullanım |
|-----------|-----------|---------|--------|-----------------|
| Gemini 1.5 Flash | 15 (ücretsiz) | Ücretsiz | Yüksek + Güncel | Güncel bilgi araması |
| Groq Llama 3.3 70B | 30 (ücretsiz) | Ücretsiz | Çok Yüksek | Toplu üretim |
| OpenAI GPT-4o | Ücretli | ~$0.01/1K | En Yüksek | Altın standart |
| DuckDuckGo Search | Sınırsız | Ücretsiz | Orta | Hızlı kontrol |

---

## 🔒 KVKK Gizlilik & Maskeleme Motoru

Türkiye'nin KVKK (Kişisel Verilerin Korunması Kanunu) kapsamında kişisel verilerin model eğitimine ve log kayıtlarına girmesi yasaktır. `privacy_masker.py`, bu verilen eğitim pipeline'ına girmeden **otomatik ve geri dönüşümsüz** olarak maskelenmesini sağlar.

### Maskelenen Veri Türleri

| Veri Türü | Format Örneği | Çıktı | Algoritma |
|-----------|--------------|-------|-----------|
| TC Kimlik No | `12345678901` | `[TC_GIZLI]` | Luhn 10./11. basamak doğrulama |
| Türk Cep | `0532 123 45 67` | `[TEL_GIZLI]` | 10+ Regex pattern |
| Türk Sabit | `(0212) 123 45 67` | `[TEL_GIZLI]` | Regex |
| +90 Format | `+90 532 123 4567` | `[TEL_GIZLI]` | Regex |
| IBAN | `TR12 0001 0017 0000 0012 3456 78` | `[IBAN_GIZLI]` | Regex + basamak sayısı |
| Kredi Kartı | `4111 1111 1111 1111` | `[KART_GIZLI]` | Luhn Algoritması |
| E-posta | `musteri@example.com` | `[EPOSTA_GIZLI]` | Regex |
| Ad-Soyad | `Ahmet Yılmaz` | `[ISIM_GIZLI]` | NER + Türkçe isim kalıpları |
| Adres | `Atatürk Mah. No:5 İstanbul` | `[ADRES_GIZLI]` | Türkçe adres regex |
| Araç Plakası | `34 ABC 1234` | `[PLAKA_GIZLI]` | TR plaka formatı regex |
| Sipariş Ref. | `MRN-20260731-XYZ` | `[SIPARIS_GIZLI]` | MRN- prefix regex |
| Doğum Tarihi | `15.03.1985` | `[TARIH_GIZLI]` | DD.MM.YYYY regex |

### Luhn Algoritması Implementasyonu

TC Kimlik ve kredi kartı numaralarını doğrulamak için Luhn kontrolü uygulanmaktadır:

```python
def _luhn_check(self, number: str) -> bool:
    """Kredi kartı numarası için Luhn doğrulama"""
    digits = [int(d) for d in number if d.isdigit()]
    odd_sum = sum(digits[-1::-2])
    even_sum = sum(
        sum(divmod(2 * d, 10)) for d in digits[-2::-2]
    )
    return (odd_sum + even_sum) % 10 == 0

def _validate_tc(self, tc: str) -> bool:
    """TC Kimlik No basamak algoritması"""
    if len(tc) != 11 or tc[0] == '0':
        return False
    digits = [int(d) for d in tc]
    # 10. basamak doğrulama: (d1+d3+d5+d7+d9)*7 - (d2+d4+d6+d8) mod 10
    d10 = ((sum(digits[i] for i in range(0, 9, 2)) * 7) -
            sum(digits[i] for i in range(1, 8, 2))) % 10
    # 11. basamak doğrulama: toplamın mod 10'u
    d11 = sum(digits[:10]) % 10
    return digits[9] == d10 and digits[10] == d11
```

### Test Sonuçları

```bash
python scripts/privacy_masker.py --test

✅ TC Kimlik geçerli → [TC_GIZLI]        PASS
✅ TC Kimlik geçersiz → değiştirilmez     PASS
✅ 0532 format telefon                    PASS
✅ +90 532 format telefon                 PASS
✅ (0212) format sabit hat               PASS
✅ TR IBAN → [IBAN_GIZLI]                PASS
✅ Kredi kartı Luhn → [KART_GIZLI]       PASS
✅ E-posta adresi                         PASS
✅ Ad-Soyad NER                          PASS
✅ Türkçe adres kalıbı                   PASS
✅ Araç plakası                          PASS
✅ Sipariş referansı MRN-                PASS

Sonuç: 12/12 test geçti — %100 başarı ✅
```

---

## 📊 Gölge Değerlendirme & A/B Testi

### Neden Gölge Değerlendirme?

Yeni eğitilen bir modeli doğrudan canlıya almak risklidir. Eğitim verisi kalitesi düşükse veya hiperparametreler yanlışsa model regresyon yaşayabilir. Gölge Değerlendirme, bu riski tamamen ortadan kaldırır.

### Değerlendirme Metrikleri

```python
# shadow_eval.py — Temel metrik hesaplama

from rouge_score import rouge_scorer
from sacrebleu.metrics import BLEU

scorer = rouge_scorer.RougeScorer(['rouge1', 'rougeL'], use_stemmer=False)

def evaluate_model(candidate_response: str, reference_response: str) -> dict:
    rouge = scorer.score(reference_response, candidate_response)
    bleu = BLEU().corpus_score([candidate_response], [[reference_response]])

    return {
        "rouge1_f1": rouge['rouge1'].fmeasure,
        "rougeL_f1": rouge['rougeL'].fmeasure,
        "bleu": bleu.score / 100,
        "key_term_match": check_key_terms(candidate_response),
        "forbidden_term_check": check_forbidden_terms(candidate_response),
        "response_time_ms": measure_response_time()
    }
```

### Karar Matrisi

| Skor Aralığı | Karar | Eylem |
|-------------|-------|-------|
| ≥ %80 | ✅ **PROMOTE** | Canlı sisteme al, `/reload_adapter` çağır |
| %65 – %79 | ⚠️ **HOLD** | Admin'e bildir, manuel inceleme bekle |
| < %65 | ❌ **REJECT** | Yeni adaptörü reddet, mevcut modelde kal |

### A/B Trafik Yönlendirici

`inference_server.py` içindeki A/B router, yeni modeli tam trafikle test etmeden önce küçük bir örneklem üzerinde performansını ölçer:

```python
import random

class ABRouter:
    def __init__(self):
        self.new_model_ratio = 0.10  # %10 yeni model
        self.new_model_requests = 0
        self.stable_model_requests = 0

    def route(self) -> str:
        if random.random() < self.new_model_ratio:
            self.new_model_requests += 1
            return "new_adapter"
        else:
            self.stable_model_requests += 1
            return "stable_adapter"
```

A/B oranı Admin Panel üzerinden dinamik olarak ayarlanabilir:

```bash
curl -X POST http://localhost:8000/config/ab_test \
  -H "Content-Type: application/json" \
  -d '{"new_model_ratio": 0.20}'
```

---

## 📑 API Uç Noktaları Referansı

### Support Core REST API (Port 8787)

Tüm endpoint'ler `/v1/` öneki ile de erişilebilir (API versiyonlama). Bearer token gerektirir.

| Method | Path | Auth | Açıklama |
|--------|------|------|----------|
| `POST` | `/chat/message` | ✓ | Meri ile sohbet mesajı gönder |
| `POST` | `/training/interaction` | ✓ | Diyalogu eğitim deposuna kaydet |
| `GET` | `/training/stats` | ✓ | Bekleyen/onaylı kayıt istatistikleri |
| `GET` | `/training/pending` | ✓ | Onay bekleyen kayıtları listele |
| `POST` | `/training/approve/:id` | ✓ | Belirtilen kaydı onayla |
| `POST` | `/training/reject/:id` | ✓ | Belirtilen kaydı reddet |
| `POST` | `/training/mask` | ✓ | KVKK maskelemesini manuel tetikle |
| `POST` | `/training/shadow-eval` | ✓ | Gölge değerlendirme başlat |
| `POST` | `/model/reload-adapter` | ✓ | Hot-Swap ile yeni LoRA yükle |
| `GET` | `/training/online-teacher/config` | ✓ | Teacher AI konfigürasyonunu al |
| `POST` | `/training/online-teacher/config` | ✓ | Teacher AI konfigürasyonunu güncelle |
| `POST` | `/distill/online` | ✓ | Online Teacher AI distilasyonunu tetikle |
| `POST` | `/webhooks/chatwoot` | Scope | Chatwoot webhook'unu işle |
| `GET` | `/knowledge/search?q=` | ✓ | Hibrit RAG arama |
| `POST` | `/tickets/drafts` | ✓ | Bilet taslağı oluştur |
| `POST` | `/approvals` | ✓ | Seviye 1 onay talebi oluştur |
| `POST` | `/approvals/:id/decide` | ✓ | Onay kararı ver |
| `GET` | `/audit` | ✓ | Son 100 denetim kaydı |
| `GET` | `/health` | Yok | Sistem sağlık kontrolü |
| `GET` | `/snapshot` | ✓ | Admin paneli için tüm sistem verisi |

**Örnek İstek — Sohbet:**
```bash
curl -X POST http://localhost:8787/v1/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "message": "Halımda çay lekesi var, ne yapmalıyım?",
    "conversationId": "conv_001",
    "customerType": "bireysel",
    "channel": "web"
  }'
```

**Örnek Yanıt:**
```json
{
  "reply": "Merhaba! Çay lekesi için şu adımları uygulayın...",
  "confidence": 0.92,
  "sources": ["leke-temizlik-rehberi-v3"],
  "ragStatus": "grounded",
  "responseTimeMs": 847
}
```

---

### Python FastAPI Inference Server (Port 8000)

| Method | Path | Açıklama |
|--------|------|----------|
| `POST` | `/generate` | LLM ile yanıt üret (prompt gönder) |
| `POST` | `/reload_adapter` | Yeni LoRA adaptörünü sıcak yükle |
| `GET` | `/status` | GPU durumu, VRAM kullanımı, aktif model |
| `GET` | `/health` | FastAPI sunucu sağlık kontrolü |
| `GET` | `/ab_test/stats` | A/B trafik istatistikleri |
| `POST` | `/config/ab_test` | A/B trafik oranını güncelle |

**GPU Durum Sorgusu:**
```bash
curl http://localhost:8000/status
```

**Yanıt:**
```json
{
  "gpu": "NVIDIA GeForce RTX 4070 Laptop GPU",
  "vram_used_gb": 5.3,
  "vram_total_gb": 8.0,
  "active_adapter": "lora_adapters/v7",
  "adapter_version": "v7",
  "ab_new_model_ratio": 0.10,
  "requests_served": 1247
}
```

---

## 💻 Admin Panel Kullanım Kılavuzu

**URL:** [http://localhost:8080](http://localhost:8080)  
**Kimlik Doğrulama:** Bearer Token + TOTP 2FA (zorunlu)  
**Tema:** Karanlık / Aydınlık geçiş şalteri (sağ üst köşe)

### 8 Sekme Referansı

| Sekme | İkon | Erişim | İşlevi |
|-------|------|--------|--------|
| **Sürekli Öğrenme** | 🧠 | Admin | Pending kayıt onayı, düzenleme modalı, toplu onay |
| **Online Öğretmen AI** | 🌐 | Admin | Teacher AI sağlayıcı seçimi, API key yönetimi, distilasyon tetikleme |
| **Eğitim Geçmişi** | 📊 | Admin | Loss eğrisi, epoch sonuçları, checkpoint listesi |
| **Model Yönetimi** | 🤖 | Admin | Aktif LoRA versiyonu, Hot-Swap butonu, adapter geçmişi |
| **Sistem Durumu** | ⚡ | Izleme | GPU/VRAM canlı metrikleri, aktif sohbet sayısı |
| **KVKK Denetim** | 🔒 | Admin | Maskelenen veri kayıtları, denetim izi |
| **Gölge Değerlendirme** | 🔬 | Admin | ROUGE-1/L/BLEU raporları, PROMOTE/HOLD/REJECT kararları |
| **Ayarlar** | ⚙️ | Admin | Eğitim eşiği, zamanlayıcı zamanı, A/B oranı |

### Bekleyen Kayıt Onay Akışı

1. **🧠 Sürekli Öğrenme** sekmesine gidin.
2. "Onay Bekleyen Kayıtlar" tablosunda kullanıcı sorusu ve Meri yanıtını inceleyin.
3. Yanıt yeterliyse **✅ Onayla** butonuna tıklayın.
4. Yanıt geliştirilmesi gerekiyorsa **✏️ Düzenle** butonuna tıklayın → metin modalı açılır → düzeltin → **Kaydet ve Onayla** yapın.
5. Yanıt tamamen yanlışsa **❌ Reddet** butonuna tıklayın → kayıt silinir.
6. 100 onay dolduğunda sistem otomatik olarak eğitimi tetikler (veya **🚀 Eğitimi Başlat** butonu ile manuel tetikleyebilirsiniz).

### Online Öğretmen AI Ayarlama

1. **🌐 Online Öğretmen AI** sekmesine gidin.
2. Sağlayıcı seçin: `Gemini 1.5 Flash` / `Groq Llama 3.3 70B` / `GPT-4o` / `DuckDuckGo`.
3. API Key girin (Gemini ve Groq için ücretsiz key alınabilir).
4. **Aktif/Pasif** anahtarını açın.
5. **🎓 Distilasyonu Başlat** butonuna tıklayın.

---

## 🚀 Geliştirici Yol Haritası (10 Faz)

Bu proje, aşağıdaki 10 fazda geliştirilmiştir. Her faz bir önceki fazın sorunlarını çözerek ilerler.

### Faz 1: Problemi Tanımlama & Mimari Vizyon

Başlangıç noktası, Merinos'un mevcut müşteri destek sürecinin yalnızca insan temsilcilere dayandığı bir ortamda hizmet kalitesini ve veri egemenliğini aynı anda sağlayan bir çözüm tasarlamaktı. Üç katmanlı mimari (Frontend, Business Logic, ML Inference) ilk bu fazda çizildi.

### Faz 2: Support Core REST API & İş Kuralları

Node.js / TypeScript ile Express tabanlı support-core servisi geliştirildi. Seviye 0 (otomatik) ve Seviye 1 (insan onayı) politika motoru, UTC+3 çalışma takvimi ve Dört Göz İlkesi onay mekanizması bu fazda kuruldu.

### Faz 3: Hibrit RAG Motoru (BM25 + Edge-Ngram Vektör)

Saf anahtar kelime aramasının Türkçe morfoloji karşısında yetersiz kaldığı tespit edilerek BM25 (ağırlıklar: K1=1.5, B=0.75) ve Edge-Ngram (önek tabanlı vektör) hibrit motoru `embeddingIndex.ts` içinde geliştirildi. Üç eşik değeri belirlendi: `TOPIC_RELEVANCE=0.35`, `EVIDENCE=0.55`, `GROUNDED=1.1`.

### Faz 4: Qwen 2.5 7B QLoRA Fine-Tuning

Model seçimi, veri formatı (ChatML), hiperparametre optimizasyonu ve kritik **600x hızlanma keşfi** bu fazda gerçekleşti. TRL SFTTrainer'ın OOM sorununu `transformers.Trainer` + öntokenizasyon ile çözdükten sonra eğitim süresi 6.000 sn/adımdan 10 sn/adıma düştü.

### Faz 5: Python Inference Sunucusu & Hot-Swap

FastAPI ile `inference_server.py` geliştirildi. `threading.Lock()` tabanlı Hot-Swap mimarisi, canlı sohbetleri kesmeden yeni LoRA adaptörlerinin yüklenmesini sağladı. A/B trafik yönlendirici bu fazda eklendi.

### Faz 6: Sürekli Öğrenme & auto_retrain Pipeline

Veri toplama (`collect_training_data.ts`), 100 kayıt eşiğinde otomatik eğitim (`auto_retrain.py`) ve gece 02:00 zamanlayıcısı (`scheduler.ts`) bu fazda entegre edildi. Kapalı döngü öğrenme hattı bu fazda tamamlandı.

### Faz 7: Vanilla Admin Panel (8 Sekme)

Build aracı gerektirmeyen HTML5/CSS3/Vanilla JS ile Admin Panel geliştirildi. Aydınlık/Karanlık tema, yanıt düzenleme modalı, Online Öğretmen AI kartı ve gerçek zamanlı API entegrasyonu bu fazda eklendi.

### Faz 8: KVKK Maskeleme Motoru

`privacy_masker.py` bağımsız bir KVKK motoru olarak geliştirildi. TC Kimlik Luhn doğrulaması, kredi kartı Luhn kontrolü, 10+ Türk telefon formatı ve Türkçe NER tabanlı isim maskeleme 12/12 test ile doğrulandı.

### Faz 9: Gölge Değerlendirme & A/B Testi

`shadow_eval.py` ile ROUGE-1/L ve BLEU metrikleri hesaplanarak PROMOTE/HOLD/REJECT karar matrisi kuruldu. Inference sunucusuna A/B router eklenerek yeni modeller %10 trafikle ön-test edilmeye başlandı.

### Faz 10: Web Distilasyonu & DPO Teacher-Student

`scrape_merinos_site.py` ile `merinos.com.tr` kazındı. `online_teacher_distiller.py` ile Gemini 1.5 Flash (Search Grounding), Groq Llama 3.3 70B ve DuckDuckGo entegrasyonu tamamlandı. DPO `{prompt, chosen, rejected}` tercih çiftleri üretimi sisteme dahil edildi.

---

## 🧪 Test Sonuçları

```
npm test

✅ [1]  Halı lekesi için destekli (grounded) RAG yanıtı
✅ [2]  Süresi bitmiş belgenin kullanılmaması
✅ [3]  Yetkisiz belgenin sızdırılmaması (permission_denied)
✅ [4]  Onaysız bilet oluşturulamaması (Seviye 1 politika)
✅ [5]  Aynı webhook'un 3 kez gelmesinde tek kayıt (idempotency)
✅ [6]  Onay token'ının tekrar kullanılamaması
✅ [7]  Dolu kapasiteli temsilcinin aday olmaması
✅ [8]  Frappe erişilemez olduğunda taslaığın korunması
✅ [9]  SLA ihlali hesaplama
✅ [10] İl/ilçe ile bayi bulma
✅ [11] BM25 + Edge-Ngram hibrit aramanın Türkçe morfoloji eşlemesi
✅ [12] Belge kabul hattının zararlı içeriği reddetmesi
✅ [13] Eksik metadata ile belge kabulünün reddedilmesi
✅ [14] Başarılı belge yayını (8 adım)
✅ [15] Gözden geçirme tarihini geçmiş belgelerin listelenmesi
✅ [16] RAG kalite kapısı ölçümü
✅ [17] Geri besleme döngüsü (👍/👎)
✅ [18] Çalışma takvimi ile SLA hedefinin hafta sonunu atlaması
✅ [19] Dört Göz İlkesi iki onaylayan gereksinimi
✅ [20] Tek reddin onay sürecini sonuçlandırması
✅ [21] Frappe devre kesicisinin 3 hata sonrası açılması
✅ [22] Şema doğrulamanın geçersiz isteği 400 ile reddetmesi
✅ [23] /v1 API versiyonlama
✅ [24] Bearer token + scope tabanlı kimlik doğrulama
✅ [25] Zorunlu MFA (TOTP) girişi
✅ [26] API rate limit aşımında 429 dönmesi
✅ [27] KVKK maskelemenin eğitim verisine girmesi

Toplam: 27/27 PASS — %100 başarı ✅
```

---

## 📜 Lisans

```
ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR

Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)

Bu yazılımın tüm hakları Seydi Eryılmaz'a aittir. Kaynak kod, belgeler,
eğitim verileri ve tüm bileşenler dahil olmak üzere hiçbir içerik,
yazarın açık yazılı izni alınmadan kopyalanamaz, çoğaltılamaz,
dağıtılamaz, ticari veya ticari olmayan amaçlarla kullanılamaz,
değiştirilemez veya türev çalışma oluşturulamaz.

YASAKLAR:
  1. Kopyalanamaz, çoğaltılamaz, dağıtılamaz veya yeniden yayınlanamaz.
  2. Ticari veya ticari olmayan hiçbir projede kullanılamaz, değiştirilemez.
  3. Alt lisanslanamaz, satılamaz veya devredilemez.
  4. Tersine mühendislik yapılamaz.

İZİN VERİLEN KULLANIM:
  - GitHub üzerinde görüntüleme ve okuma.
  - Kişisel öğrenim amacıyla kodu inceleme (kopyalamadan).

YAZARIN AÇIK YAZILI İZNİ OLMAKSIZIN HİÇBİR KULLANIM HAKKI TANINMAZ.
İzin talepleri için: GitHub @seydivakkas
```

---

<div align="center">

**[⬆ Başa Dön](#-merinos-chatbot)**

Geliştirici: **[Seydi Eryılmaz](https://github.com/seydivakkas)** · 2026

</div>
