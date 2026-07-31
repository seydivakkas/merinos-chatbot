# 🚀 Geliştirici Yol Haritası: Merinos AI Chatbot Platformunu Baştan Sona Nasıl Kodladım?

**Yazar / Geliştirici:** Seydi Eryılmaz ([@seydivakkas](https://github.com/seydivakkas))  
**Telif Hakkı:** © 2026 Seydi Eryılmaz — Tüm Hakları Saklıdır.

---

## 📌 İçindekiler

- [Giriş ve Mimari Vizyon](#giriş-ve-mimari-vizyon)
- [Faz 1: Problemi Tanımlama & Sistem Mimarisi](#faz-1-problemi-tanımlama--sistem-mimarisi)
- [Faz 2: Support Core REST API ve İş Kuralları Katmanı](#faz-2-support-core-rest-api-ve-iş-kuralları-katmanı)
- [Faz 3: Türkçe Morfolojiye Uyumlu Hibrit RAG Motoru](#faz-3-türkçe-morfolojiye-uyumlu-hibrit-rag-motoru)
- [Faz 4: LLM Seçimi ve QLoRA İnce Ayar (Qwen 2.5 7B + Unsloth)](#faz-4-llm-seçimi-ve-qlora-ince-ayar-qwen-25-7b--unsloth)
- [Faz 5: Python Çıkarım Sunucusu ve Kesintisiz Sıcak Değişim (Hot-Swap)](#faz-5-python-çıkarım-sunucusu-ve-kesintisiz-sıcak-değişim-hot-swap)
- [Faz 6: Sürekli Öğrenme ve Otomatik Yeniden Eğitim Pipeline'ı](#faz-6-sürekli-öğrenme-ve-otomatik-yeniden-eğitim-pipelineı)
- [Faz 7: Bütünleşik Canlı Admin Yönetim Paneli](#faz-7-bütünleşik-canlı-admin-yönetim-paneli)
- [Faz 8: KVKK Gizlilik ve Maskeleme Motoru (`privacy_masker.py`)](#faz-8-kvkk-gizlilik-ve-maskeleme-motoru-privacy_maskerpy)
- [Faz 9: Gölge Değerlendirme Motoru (Shadow Eval) ve A/B Testi](#faz-9-gölge-değerlendirme-motoru-shadow-eval-ve-ab-testi)
- [Faz 10: İnternet Erişimli Öğretmen AI Distilasyonu ve DPO](#faz-10-internet-erişimli-öğretmen-ai-distilasyonu-ve-dpo)
- [Sonuç ve Gelecek Vizyonu](#sonuç-ve-gelecek-vizyonu)

---

## Giriş ve Mimari Vizyon

Bu projeyi kodlarken temel amacım; klasik, kural tabanlı veya sadece OpenAI API'sine bağlı çalışan sıradan bir chatbot yapmak **değildi**. 

Amacım; Merinos markasının kurumsal dilini %100 benimsemiş, leke temizlik rehberlerinden garanti süreçlerine kadar tüm alanlarda uzmanlaşmış, **kendi sunucumuz üzerinde (on-premise) çalışan**, kişisel verileri KVKK standartlarında koruyan ve **canlı müşteri etkileşimlerinden öğrenerek kendi kendini sürekli geliştiren** uçtan uca bir yapay zeka platformu inşa etmekti.

Bu dokümanda, projeyi ilk satır kodundan itibaren adım adım nasıl inşa ettiğimi birinci dilden anlatıyorum.

---

## Faz 1: Problemi Tanımlama & Sistem Mimarisi

İlk adımda sistemin genel mimari katmanlarını belirledim. Modüler, ölçeklenebilir ve bağımsız çalışabilen 4 ana katman tasarladım:

1. **Support Core API (Node.js/TypeScript):** İş kurallarının, onay mekanizmalarının ve veritabanı işlemlerinin yürüdüğü ana servis.
2. **Agent Orchestrator:** Müşteri sorularını analiz edip doğru araçlara (tools) ve servislere yönlendiren karar motoru.
3. **Inference Server (Python / PyTorch):** Fine-tune edilmiş Qwen 2.5 7B modelimizi GPU üzerinde çalıştıran servis.
4. **Admin Yönetim Paneli:** Sürekli öğrenme süreçlerini, KVKK maskelemesini ve model metriklerini canlı izleme arayüzü.

---

## Faz 2: Support Core REST API ve İş Kuralları Katmanı

Projenin temelini Node.js ve TypeScript kullanarak `support-core` modülünde attım.

- **İş Kuralları ve Politika Motoru (`policyEngine.ts`):** Otomatik yanıt verilebilecek **Seviye 0** durumlar ile insan onayı gerektiren **Seviye 1** eylemleri birbirinden ayırdım.
- **Dört Göz İlkesi (Four-Eyes Principle):** Yüksek maliyetli iade veya değişim biletlerinde tek yöneticinin karar veremeyeceği, iki farklı yetkilinin onayını zorunlu kılan mekanizmayı (`approvalService.ts`) kodladım.
- **Türkiye Çalışma Takvimi (`workCalendar.ts`):** UTC+3 saat dilimi, mesai saatleri (09:00 - 18:00) ve resmi tatil günlerini hesaba katan akıllı SLA motorunu geliştirdim.

---

## Faz 3: Türkçe Morfolojiye Uyumlu Hibrit RAG Motoru

Geleneksel anahtar kelime aramasının Türkçe'nin sondan eklemeli yapısında (`leke`, `lekesini`, `lekesinden`) yetersiz kaldığını gördüm.

- Bu sorunu çözmek için **BM25 terim frekansı** ile **Önek (Edge-Ngram) Vektör Benzerliğini** birleştiren hibrit RAG motorunu (`embeddingIndex.ts`) kodladım.
- Aramalarda konu alakası (`0.35`) ve kanıt yeterliliği (`0.55`) eşiklerini koyarak modelin dayanağı olmayan yanıtlar (hallüsinasyon) vermesini engelledim.

---

## Faz 4: LLM Seçimi ve QLoRA İnce Ayar (Qwen 2.5 7B + Unsloth)

Dil modeli olarak Türkçe dil kabiliyeti son derece yüksek olan **Qwen 2.5 7B Instruct** modelini tercih ettim.

- Kendi bilgisayarımdaki **NVIDIA RTX 4070 GPU** üzerinde bellek dostu eğitim yapabilmek için **Unsloth QLoRA 4-bit NF4 Quantization** tekniğini kullandım.
- Merinos'un çağrı merkezi diyaloglarını, SSS verilerini ve leke kılavuzlarını **ChatML formatına** (`<|im_start|>user ... <|im_end|>`) dönüştürerek modeli eğittim (`scripts/train_meri_qlora.py`).

---

## Faz 5: Python Çıkarım Sunucusu ve Kesintisiz Sıcak Değişim (Hot-Swap)

Eğitilen modeli canlıda servis etmek ve yeniden eğitildiğinde sunucuyu kapatmadan güncelleyebilmek için Python tabanlı inference sunucusunu (`scripts/inference_server.py`) yazdım.

- **Hot-Swap Mimarisi:** `/reload_adapter` HTTP endpoint'ini yazdım. `model_lock` (threading kilidi) kullanarak canlı müşteri sohbetleri kesintiye uğramadan yeni LoRA adaptörlerini belleğe sıcak (hot-swap) olarak yükledim.

---

## Faz 6: Sürekli Öğrenme ve Otomatik Yeniden Eğitim Pipeline'ı

Sistemin zamanla kendi kendine iyileşmesi için sürekli öğrenme döngüsünü kurdum.

1. **`collect_training_data.ts`:** Canlı müşteri sohbetlerini ve temsilci düzeltmelerini toplayıp ChatML formatında `pending_review.jsonl` dosyasına yazar.
2. **`auto_retrain.py`:** Onaylı kayıt sayısı 100'e ulaştığında GPU üzerinde Unsloth QLoRA eğitimini otomatik olarak tetikler.
3. **`scheduler.ts`:** Her 6 saatte bir veri toplar ve her gece saat 02:00'de otomatik eğitim koşusunu denetler.

---

## Faz 7: Bütünleşik Canlı Admin Yönetim Paneli

Sistemin tüm aşamalarını izlemek için bağımsız, build gerektirmeyen HTML5, CSS3 ve Vanilla JS ile Admin Yönetim Paneli (`admin-panel/`) geliştirdim.

- Panele **🧠 Sürekli Öğrenme** sekmesini ekledim.
- Bekleyen kayıtları listeleme, metin düzenleme modalı, tek tıkla onaylama ve GPU inference durumunu gösteren bilgi kartlarını entegre ettim.

---

## Faz 8: KVKK Gizlilik ve Maskeleme Motoru (`privacy_masker.py`)

Kişisel verilerin model eğitimine ve loglara girmesini engellemek için bağımsız `privacy_masker.py` motorunu yazdım.

- **TC Kimlik Doğrulama:** 11 hane kontrolüne ek olarak 10. ve 11. basamak algoritmik doğrulaması (`_validate_tc`).
- **Luhn Algoritması:** Kredi kartı numaralarını tespit etmek ve doğrulamak için Luhn algoritması (`_luhn_check`).
- **10+ Telefon & E-posta & IBAN & Adres Kalıpları:** Regex ve Türkçe NER kuralları.
- 12 farklı senaryodan oluşan birim test paketini (`--test`) yazarak %100 başarı sağladım.

---

## Faz 9: Gölge Değerlendirme Motoru (Shadow Eval) ve A/B Testi

Yeni eğitilen LoRA adaptörlerinin kalitesini ölçmeden canlıya almamak için **Gölge Değerlendirme Motorunu (`scripts/shadow_eval.py`)** geliştirdim.

- Yeni model adayını Altın Benchmark Test Paketi ile test ederek **ROUGE-1**, **ROUGE-L**, **BLEU** ve kural uyum puanlarını hesapladım.
- Skora göre **`PROMOTE`** (%80+), **`HOLD`** (%65-%79) veya **`REJECT`** (<%65) karar mekanizmasını kurdum.
- `inference_server.py` içerisine A/B Trafik Yönlendiricisi ekleyerek canlı trafiğin %10'unu yeni modele yönlendirme altyapısı sağladım.

---

## Faz 10: İnternet Erişimli Öğretmen AI Distilasyonu ve DPO

Sistemin en son aşamasında yerel modelimizi internete bağlı dev modeller seviyesine çıkarmak için **Online Öğretmen AI Distilasyon Motorunu (`scripts/online_teacher_distiller.py`)** kodladım.

- **`scrape_merinos_site.py`:** `merinos.com.tr` üzerindeki resmi ürün, leke rehberi ve garanti sayfalarını otomatik kazır.
- **İnternet Erişimli Öğretmen AI Entegrasyonu:** Google Gemini 1.5 Flash (Search Grounding), Groq Cloud Llama 3.3 70B, OpenAI GPT-4o, DeepSeek ve DuckDuckGo Canlı Arama sağlayıcılarını ekledim.
- **DPO Tercih Çiftleri:** `{prompt, chosen, rejected}` yapısıyla yerel modelin hatalı yanıtlarını elerken internetten gelen güncel doğru yanıtları öğrettim.

---

## Sonuç ve Gelecek Vizyonu

Bu yol haritası ile Merinos AI platformunu **sıfırdan uçtan uca çalışan, sürekli öğrenen ve KVKK uyumlu kurumsal bir yapay zeka sistemine** dönüştürdüm.

Tüm kodlar, mimari dokümanlar ve test betikleri başarıyla GitHub depoma aktarılmıştır:  
👉 **[https://github.com/seydivakkas/merinos-chatbot](https://github.com/seydivakkas/merinos-chatbot)**
