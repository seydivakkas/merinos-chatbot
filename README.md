[![Tüm Hakları Saklıdır](https://img.shields.io/badge/license-All%20Rights%20Reserved-red?style=flat-square)](#lisans)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-yellow?style=flat-square&logo=python)](https://www.python.org/)
[![Qwen2.5-7B](https://img.shields.io/badge/Model-Qwen2.5--7B--Instruct-purple?style=flat-square)](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct)
[![Unsloth QLoRA](https://img.shields.io/badge/FineTuning-Unsloth_QLoRA-green?style=flat-square)](https://github.com/unslothai/unsloth)
[![NVIDIA RTX 4070](https://img.shields.io/badge/GPU-NVIDIA_RTX_4070-76B900?style=flat-square&logo=nvidia)](https://www.nvidia.com/)

# 🧶 Merinos AI Chatbot & Sürekli Öğrenme Platformu

Merinos için özel olarak geliştirilmiş **Fine-Tuned Qwen 2.5 7B QLoRA yapay zeka modeli**, **İnternet Erişimli Öğretmen AI Distilasyon Boru Hattı (Teacher-Student & DPO)**, **KVKK Gizlilik Maskeleme Motoru**, **Gölge Değerlendirme (Shadow Evaluation)** ve **Yönetim Paneli (Admin Panel)** içeren kurumsal müşteri destek ve sürekli öğrenme platformu.

---

## 🎯 Projenin Öne Çıkan Özellikleri

- **🧠 Fine-Tuned Meri LLM (Qwen 2.5 7B QLoRA):** Merinos'un kurum dili, leke temizlik rehberleri, garanti prosedürleri ve ürün gamına göre Unsloth QLoRA 4-bit NF4 ile eğitilmiş özel Türkçe model.
- **🔄 Sıcak Adaptör Değişimi (Hot-Swap):** Model sunucusu (`inference_server.py`) yeniden başlatılmadan `POST /reload_adapter` ile yeni eğitilen LoRA ağırlıklarını anında yükler.
- **🌐 Canlı Web Distilasyonu (Web-to-QLoRA):** `merinos.com.tr` resmi sitesinden kazınan bilgiler ve canlı internet erişimine sahip **Öğretmen AI (Gemini 1.5 / GPT-4o / DeepSeek / Web Search)** ile otomatik altın diyaloglar üretir.
- **⚡ DPO (Direct Preference Optimization):** Müşteri geri bildirimlerinden (👍 / 👎) ve öğretmen modellerden `{prompt, chosen, rejected}` tercih çiftleri üreterek modele doğrudan ne yapacağını ve ne yapmaması gerektiğini öğretir.
- **🔒 KVKK Gizlilik Maskeleme Motoru (`privacy_masker.py`):** TC Kimlik Numarası (Luhn doğrulama), 10+ Türk cep/sabit hat formatı, E-posta, IBAN (TR/Int), Kredi Kartı (Luhn), Ad-Soyad (NER) ve Adres bilgilerini eğitim verisine ve loglara girmeden otomatik maskeler.
- **📊 Gölge Değerlendirme (Shadow Evaluation):** Yeni eğitilen modeller canlıya alınmadan önce ROUGE-1, ROUGE-L, BLEU ve kural kontrolleri ile otomatik test edilerek `PROMOTE`, `HOLD` veya `REJECT` kararı verilir.
- **🛡️ 4-Göz İlkesi (Four-Eyes Approval):** Yüksek riskli işlemler için iki farklı yöneticinin onayını zorunlu kılan kurumsal onay mekanizması.
- **💻 Bütünleşik Admin Yönetim Paneli:** Sürekli öğrenme metriklerini, onay bekleyen diyalogları, online öğretmen ayarlarını ve inference sunucu durumunu canlı izleme ekranı.

---

## 🏗️ Sistem Mimarisi

```
[ Müşteri Sohbeti (Widget / Web) ]
                │
                ▼
  ┌──────────────────────────┐
  │   Support Core REST API   │ <───> [ KVKK Maskeleme Engine ]
  └─────────────┬────────────┘
                │
                ├───> (Sohbet verisini kaydeder) ───> [ data/collected/pending_review.jsonl ]
                │                                                    │
                ▼                                                    ▼
  ┌──────────────────────────┐                     ┌────────────────────────────────┐
  │ Admin Panel (Sürekli Öğr)│ <── (Onay/Düzenle) ─┤  data/collected/approved.jsonl │
  └──────────────────────────┘                     └────────────────┬───────────────┘
                │                                                   │
                ▼                                                   │ (100 Kayıt Eşiği)
  ┌──────────────────────────┐                                      ▼
  │ Online Öğretmen AI       │                             ┌────────────────────────────────┐
  │ (Gemini/GPT-4o/DeepSeek) │                             │ auto_retrain.py (Unsloth QLoRA)│
  └─────────────┬────────────┘                             └────────────────┬───────────────┘
                │ (Distilasyon & DPO)                                      │ (Yeni Adaptör)
                └──────────────────────────────────────────────────────────┼───────────────┐
                                                                           ▼               ▼
                                                           ┌───────────────────┐ ┌───────────────────┐
                                                           │ Shadow Evaluation │ │ Hot-Swap Reload   │
                                                           │ (ROUGE / BLEU)    │ │ (/reload_adapter) │
                                                           └───────────────────┘ └───────────────────┘
```

---

## 📁 Klasör Yapısı

```
merinos-chatbot/
├── admin-panel/                   # Statik, canlı izleme ve sürekli öğrenme yönetim paneli
│   ├── index.html                 # HTML Arayüz (🧠 Sürekli Öğrenme, AI & Bilgi Tabanı, Sandbox)
│   ├── app.js                     # Canlı API entegrasyonu, grafikler ve onay mantığı
│   └── styles.css                 # Modern karanlık/aydınlık tema tasarım sistemi
├── support-core/                  # Ana İş Mantığı, API ve Güvenlik Katmanı
│   └── src/
│       ├── index.ts               # REST API Sunucusu (Port 8787)
│       ├── types.ts               # TypeScript Veri Modellere (AuditEvent, TrainingRecord vb.)
│       ├── services/
│       │   ├── auditLogger.ts     # KVKK maskeli denetim kaydı motoru
│       │   ├── authService.ts     # Servis hesapları, Bearer Token & TOTP 2FA
│       │   ├── embeddingIndex.ts  # BM25 + Önek (Edge-Ngram) Hibrit Arama
│       │   ├── policyEngine.ts    # Seviye 0 / Seviye 1 Politika Motoru
│       │   ├── ragEvaluation.ts   # RAG Kalite Kapısı Ölçümü
│       │   ├── workCalendar.ts    # Türkiye Çalışma Takvimi ve Tatil Hesaplayıcı
│       │   └── slaEngine.ts       # Mesai saati farkındalıklı SLA Motoru
│       └── utils/
│           ├── ids.ts             # PII Maskeleme & ID Üreticileri
│           └── circuitBreaker.ts  # Dış servisler için Devre Kesici (Circuit Breaker)
├── scripts/                       # Makine Öğrenimi & Otomasyon Betikleri
│   ├── inference_server.py        # Qwen 2.5 7B QLoRA Inference Sunucusu (Port 8000 + HotSwap + A/B)
│   ├── auto_retrain.py            # Unsloth QLoRA Otomatik Eğitim Pipeline'ı
│   ├── collect_training_data.ts   # Canlı diyaloglardan ChatML veri derleyici
│   ├── distill_teacher_dataset.py # Öğretmen AI & Self-Instruct Distilasyon Motoru
│   ├── online_teacher_distiller.py# Gemini/GPT-4o/DeepSeek/WebSearch canlı distilasyon & DPO
│   ├── privacy_masker.py          # KVKK Gizlilik Maskeleme Motoru (12/12 Unit Test)
│   ├── shadow_eval.py             # ROUGE-1/L & BLEU Otomatik Model Değerlendirme
│   ├── scrape_merinos_site.py     # Merinos resmi web sitesi bilgi kazıyıcı
│   ├── scheduler.ts               # 6 saatlik veri toplama & gece 02:00 eğitim zamanlayıcısı
│   └── serve-all.ts               # Tüm sistemi tek komutla ayağa kaldıran Orkestratör
├── data/                          # Veri Deposu
│   ├── collected/                 # Toplanan pending/approved/dpo veriler ve stats.json
│   ├── distilled/                 # Kazınan site bilgisi (raw_site_knowledge.json / site_knowledge.md)
│   └── raw/                       # SSS, çağrı merkezi ve ürün SSS ham verileri
├── widget/                        # Web Mağazası Canlı Sohbet Widget'ı (Vanilla JS)
├── LICENSE                        # Özel "Tüm Hakları Saklıdır" Lisans Metni
└── package.json                   # Bağımlılıklar ve Npm Komutları
```

---

## ⚡ Kurulum ve Çalıştırma

### 1. Bağımlılıkları Yükleme
```bash
npm install
pip install -r ml/post_training/requirements.txt
```

### 2. Tüm Sistemi Tek Komutla Başlatma
Support Core API (8787), Admin Panel (8080) ve Web Mağazasını (3000) ayağa kaldırır:
```bash
npm run ui
```

### 3. QLoRA Inference Sunucusunu Başlatma (Python / GPU)
```bash
npm run meri-server
# veya: python scripts/inference_server.py
```

---

## 🛠️ Sürekli Öğrenme & Distilasyon Komutları

```powershell
# 1. Merinos web sitesinden güncel bilgileri kazı
npm run scrape-site

# 2. Canlı diyaloglardan ChatML verilerini topla (KVKK maskelemesi otomatik çalışır)
npm run collect

# 3. İnternete bağlı Öğretmen AI ile DPO & ChatML verisi üret
npm run distill-online

# 4. 100 onaylı kayıtla doğrudan eğitim verisi oluştur
npm run distill-auto

# 5. KVKK Gizlilik Maskeleme testini çalıştır
npm run mask-test

# 6. Gölge Değerlendirme (Shadow Eval) testini çalıştır
npm run shadow-eval-test

# 7. Model Durumunu Kontrol Et
npm run retrain-status

# 8. RTX 4070 GPU üzerinde QLoRA Yeniden Eğitimi Başlat!
npm run retrain

# 9. Zamanlanmış Görev Yöneticisini Başlat (Gece 02:00 otomatik eğitim)
npm run scheduler
```

---

## 🔒 KVKK Gizlilik & Maskeleme Motoru (`privacy_masker.py`)

Platform, Türkiye Kişisel Verilerin Korunması Kanunu (KVKK) gereği kişisel verilerin model eğitimine ve loglara girmesini engeller:

- **TC Kimlik Numarası:** 11 hane + 10. ve 11. basamak algoritmik doğrulaması (`_validate_tc`).
- **Telefon Numaraları:** `05XX`, `+90 5XX`, `(05XX)` dahil 10+ Türk telefon biçimi.
- **Kredi Kartı:** Luhn algoritması ile doğrulanan kart numaraları (`[KART_GIZLI]`).
- **E-posta & IBAN:** TR ve uluslararası IBAN formatları.
- **Ad-Soyad & Adres:** Türkçe unvan, hitap ve adres ekleri kalıpları.

---

## 📑 API Uç Noktaları (Support Core - Port 8787)

| Yöntem | Yol | Açıklama |
|---|---|---|
| GET | `/v1/health` | Sistem ve GPU canlanma durumu |
| POST | `/v1/chat/message` | Meri ile sohbet mesajı gönderir |
| GET | `/v1/training/stats` | Bekleyen/onaylı kayıtlar ve sürekli öğrenme istatistikleri |
| POST | `/v1/training/interaction` | Canlı sohbet diyalogunu eğitim kümesine ekler |
| POST | `/v1/training/approve` | Bekleyen kaydı onaylar, düzenler veya reddeder |
| POST | `/v1/training/mask` | KVKK maskelemesini manuel tetikler |
| GET | `/v1/training/online-teacher/config` | Online Öğretmen AI konfigürasyonunu döner |
| POST | `/v1/training/online-teacher/config` | Öğretmen AI modunu ve API Key'ini günceller |
| POST | `/v1/training/online-teacher/distill` | Online öğretmen distilasyonunu çalıştırır |
| GET | `/v1/snapshot` | Admin paneli için tüm sistem verisini döner |

---

## 📜 Lisans

```
ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR

Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)

Bu yazılım ve ilgili tüm dosyalar ("Yazılım") yalnızca görüntüleme ve eğitim
amaçlı olarak paylaşılmıştır.

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
