[![Tüm Hakları Saklıdır](https://img.shields.io/badge/license-All%20Rights%20Reserved-red?style=flat-square)](#-lisans)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-yellow?style=flat-square&logo=python)](https://www.python.org/)
[![Qwen2.5-7B](https://img.shields.io/badge/Model-Qwen2.5--7B--Instruct-purple?style=flat-square)](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct)
[![Unsloth QLoRA](https://img.shields.io/badge/FineTuning-Unsloth_QLoRA-green?style=flat-square)](https://github.com/unslothai/unsloth)
[![NVIDIA RTX 4070](https://img.shields.io/badge/GPU-NVIDIA_RTX_4070-76B900?style=flat-square&logo=nvidia)](https://www.nvidia.com/)

# 🧶 Merinos AI Chatbot & Sürekli Öğrenme Platformu

Merinos için özel olarak geliştirilmiş **Fine-Tuned Qwen 2.5 7B QLoRA yapay zeka modeli**, **İnternet Erişimli Öğretmen AI Distilasyon Boru Hattı (Teacher-Student & DPO)**, **KVKK Gizlilik Maskeleme Motoru**, **Gölge Değerlendirme (Shadow Evaluation)** ve **Yönetim Paneli (Admin Panel)** içeren kurumsal müşteri destek ve sürekli öğrenme platformu.

---

## 📌 İçindekiler

1. [🎯 Projenin Öne Çıkan Özellikleri](#-projenin-öne-çıkan-özellikleri)
2. [🏗️ Sistem Mimarisi ve Veri Akışı](#️-sistem-mimarisi-ve-veri-akışı)
3. [📁 Klasör Yapısı](#-klasör-yapısı)
4. [⚡ Kurulum ve Çalıştırma](#-kurulum-ve-çalıştırma)
5. [🛠️ Sürekli Öğrenme & Distilasyon Komutları](#️-sürekli-öğrenme--distilasyon-komutları)
6. [🌐 Online Öğretmen AI & DPO Mimarisi](#-online-öğretmen-ai--dpo-mimarisi)
7. [🔒 KVKK Gizlilik & Maskeleme Motoru (`privacy_masker.py`)](#-kvkk-gizlilik--maskeleme-motoru-privacy_maskerpy)
8. [📊 Gölge Değerlendirme Motoru (`shadow_eval.py`)](#-gölge-değerlendirme-motoru-shadow_evalpy)
9. [📑 API Uç Noktaları (Support Core - Port 8787)](#-api-uç-noktaları-support-core---port-8787)
10. [💻 Admin Yönetim Paneli](#-admin-yönetim-paneli)
11. [📜 Lisans](#-lisans)

---

## 🎯 Projenin Öne Çıkan Özellikleri

### 1. Fine-Tuned Meri LLM (Qwen 2.5 7B QLoRA)
- Merinos'un marka dili, müşteri ilişkileri yaklaşımı, leke temizliği ve garanti prosedürlerine tam uyumlu.
- **Unsloth QLoRA 4-bit NF4 Quantization:** NVIDIA RTX 4070 (8GB/12GB VRAM) gibi tüketici seviyesi GPU'larda ultra hızlı bellek optimize eğitim ve çıkarım (inference).
- **ChatML Formatı:** `<|im_start|>system`, `<|im_start|>user`, `<|im_start|>assistant` özel yapılandırılmış diyalog formatı.

### 2. Sıcak Adaptör Değişimi (Hot-Swap Reload)
- `scripts/inference_server.py` sunucusu ve Python süreci yeniden başlatılmadan `POST /reload_adapter` çağrısı ile yeni eğitilen LoRA adaptörleri belleğe dinamik yüklenir.
- `model_lock` (threading kilidi) sayesinde canlı müşteri sohbetlerinde kesinti ve bellek çakışması yaşanmaz.

### 3. İnternet Erişimli Öğretmen AI Distilasyonu (Teacher-Student)
- Canlı internet erişimine sahip **Öğretmen AI** (Google Gemini 1.5 Flash, Groq Cloud Llama 3.3 70B, OpenAI GPT-4o, DeepSeek AI) entegrasyonu.
- `merinos.com.tr` resmi web sitesinden ürün, leke rehberi, garanti ve bayi verilerini kazıyarak altın diyaloglar üretir.

### 4. DPO (Direct Preference Optimization) Tercih Çiftleri
- Geri bildirimlerden ve öğretmen modellerden `{prompt, chosen, rejected}` tercih verileri üretilir.
- Model sadece doğru cevabı değil, müşteriyi yanlış yönlendiren hatalı ifadeleri (`rejected`) reddetmeyi öğrenir.

### 5. KVKK / GDPR Gizlilik Maskeleme Motoru
- TC Kimlik No (Luhn doğrulamalı), Türk Telefon Numaraları (10+ format), E-posta, IBAN (TR ve uluslararası), Kredi Kartı (Luhn doğrulamalı), Ad-Soyad (NER) ve Adres bilgilerini eğitim verisine girmeden maskeler (`[TC_GIZLI]`, `[TEL_GIZLI]` vb.).

### 6. Otomatik Gölge Değerlendirme (Shadow Evaluation)
- Eğitilen yeni LoRA modelleri canlıya alınmadan önce ROUGE-1, ROUGE-L, BLEU metrikleri ve politika kuralları ile otomatik kıyaslanır.
- Skor `%80+` ise `PROMOTE` (canlıya geç), `%65-%79` ise `HOLD` (incele), `<%65` ise `REJECT` (reddet) kararı verilir.

### 7. 4-Göz İlkesi (Four-Eyes Principle Approval)
- İade, yüksek maliyetli garanti değişimi ve kurumsal bilet işlemlerinde tek yöneticinin onayı yetmez; iki farklı yetkilinin onayı zorunludur.

---

## 🏗️ Sistem Mimarisi ve Veri Akışı

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

### Veri Akış Aşamaları:
1. **Veri Toplama:** Müşteri sohbetleri veya site kazıma bilgileri `collect_training_data.ts` tarafından toplanır.
2. **KVKK Filtresi:** `privacy_masker.py` kişisel verileri maskeler ve `pending_review.jsonl` dosyasına yazar.
3. **Yönetici Onayı:** Admin Panelinden ([http://localhost:8080](http://localhost:8080)) incelenen veriler onaylanır (`approved.jsonl`).
4. **Otomatik Yeniden Eğitim:** Onaylı kayıt sayısı 100'e ulaştığında `auto_retrain.py` Unsloth QLoRA eğitimi başlatır.
5. **Gölge Test & Sıcak Değişim:** `shadow_eval.py` model kalitesini onaylarsa `/reload_adapter` ile canlı model güncellenir.

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

## 🌐 Online Öğretmen AI & DPO Mimarisi

İnternete bağlı dev Öğretmen AI modelleri (Gemini 1.5 Pro, GPT-4o, Groq Llama 3.3 70B, DeepSeek) kullanarak yerel Meri modelimizin kalitesini sürekli artıran `Teacher-Student Distillation` ve `DPO Preference Alignment` mimarisi.

- **Sağlayıcı Seçenekleri:**
  - 🌐 **Canlı Web Araması:** API Key gerektirmeden DuckDuckGo / Merinos Web Engine üzerinden güncel arama yapar.
  - ⚡ **Google Gemini 1.5 Flash:** Google AI Studio üzerinden 15 RPM ücretsiz Kota.
  - ⚡ **Groq Llama 3.3 70B:** Groq Console üzerinden 30 RPM ücretsiz yüksek hızlı çıkarım.
  - 🟢 **OpenAI GPT-4o & DeepSeek AI.**

- **DPO Tercih Çiftleri Yapısı:**
```json
{
  "id": "dpo_17854751_001",
  "prompt": "Merinos akrilik halımdaki mürekkep lekesini çamaşır suyu ile silebilir miyim?",
  "chosen": "Çamaşır suyu halının renk ve ip dokusuna zarar verir. Lekeyi yaymadan kolonyalı pamuk veya nötr sabunlu nemli bezle tampon yapınız.",
  "rejected": "Çamaşır suyu dökebilirsiniz fark etmez.",
  "source": "online_teacher_gemini"
}
```

---

## 🔒 KVKK Gizlilik & Maskeleme Motoru (`privacy_masker.py`)

Platform, Türkiye Kişisel Verilerin Korunması Kanunu (KVKK) gereği kişisel verilerin model eğitimine ve loglara girmesini engeller:

- **TC Kimlik Numarası (`_validate_tc`):** 11 hane kontrolünün yanında basamak algoritması doğrulaması:
  $$\text{Basamak}_{10} = ((1,3,5,7,9.\text{toplamı} \times 7) - (2,4,6,8.\text{toplamı})) \bmod 10$$
  $$\text{Basamak}_{11} = (1..10.\text{basamakların toplamı}) \bmod 10$$
- **Telefon Numaraları:** `05XX`, `+90 5XX`, `(05XX)` dahil 10+ Türk cep ve sabit hat biçimi (`[TEL_GIZLI]`).
- **Kredi Kartı (`_luhn_check`):** Luhn algoritması ile doğrulanan kart numaraları (`[KART_GIZLI]`).
- **E-posta & IBAN:** TR ve uluslararası IBAN formatları (`[IBAN_GIZLI]`, `[EPOSTA_GIZLI]`).
- **Ad-Soyad & Adres:** Türkçe unvan, hitap ve adres ekleri kalıpları (`[ISIM_GIZLI]`, `[ADRES_GIZLI]`).

Birim test sonuçları: **12 / 12 Test %100 Geçti ✅**

---

## 📊 Gölge Değerlendirme Motoru (`shadow_eval.py`)

Yeni eğitilen aday LoRA adaptörlerini canlıya almadan önce kıyaslayan ve karar veren değerlendirme sistemi:

- **ROUGE-1 / ROUGE-L:** Cümle ve N-Gram örtüşme oranları.
- **BLEU Skoru:** N-gram kesinlik F1 hesaplayıcısı.
- **Kural & Politika Uyumu:** Halı leke temizliği ve garanti koşullarına %100 uyum kontrolü.
- **Karar Mekanizması:**
  - `%80+` → `PROMOTE` (Canlıya Geç)
  - `%65-%79` → `HOLD` (Yönetici İncelemesine Al)
  - `<%65` → `REJECT` (Reddet)

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

## 💻 Admin Yönetim Paneli

[http://localhost:8080](http://localhost:8080) adresinde çalışan build'siz statik yönetim arayüzü:

- **🧠 Sürekli Öğrenme:** Bekleyen/Onaylı diyalogları onaylama, düzenleme modalı ve istatistik kartları.
- **🌐 Online Öğretmen AI Kartı:** Gemini, Groq, GPT-4o ve WebSearch sağlayıcı seçimi ve aktif/pasif anahtarı.
- **🛡️ Denetim Kaydı (Audit Log):** KVKK maskeli sistem eylem geçmişi.
- **🧪 RAG Testi:** RAG kalite kapısı senaryolarını canlı koşturma arayüzü.

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
