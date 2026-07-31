# Merinos Chatbot — Meri Model Fine-Tuning & Hızlandırma Rehberi

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

---

## 📌 Genel Bakış ve Amaç
Bu doküman, **Merinos Müşteri Hizmetleri Kıdemli Temsilcisi (Meri)** yapay zeka modelinin `unsloth/Qwen2.5-7B-Instruct-bnb-4bit` temel modeli üzerinde yerel **NVIDIA GeForce RTX 4070 Laptop GPU (8GB VRAM)** ile gerçekleştirilen QLoRA fine-tuning optimizasyonlarını, karşılaşılan performans darboğazlarını, kök neden analizlerini ve canlı eğitim metriklerini içerir.

---

## 🛠️ Donanım & Sistem Yapılandırması

| Bileşen | Özellik |
| :--- | :--- |
| **GPU** | NVIDIA GeForce RTX 4070 Laptop GPU (8 GB GDDR6 VRAM) |
| **CUDA Sürücüsü** | Driver 592.82 / CUDA 13.1 |
| **İşletim Sistemi** | Windows 11 64-bit |
| **PyTorch & CUDA** | PyTorch 2.x + BitsAndBytes 4-bit NF4 Quantization |
| **Sürücü Optimizasyonu** | `CUDA - Sysmem Fallback Policy` -> **Prefer No Sysmem Fallback** |
| **Güç Seçeneği** | Windows High Performance / Laptop Turbo Cooling Mode |

---

## 🔬 Fine-Tuning Darboğazları & Kök Neden Analizi (Empirik Bulgular)

### 1. Windows Triton Bağımlılığı Darboğazı
- **Sorun:** Unsloth'un varsayılan `train_unsloth.py` script'i Linux özel C++ kütüphanesi olan Triton gerektirdiği için Windows ortamında hata vermektedir.
- **Çözüm:** Windows CUDA uyumlu yerel PyTorch + PEFT + BitsAndBytes 4-bit NF4 boru hattı (`scripts/train_meri_qlora.py`) yazılmıştır.

### 2. Dizi Uzunluğu (Sequence Length) Etkisi
- **Sorun:** 2048 token dizi uzunluğu kullanıldığında 12,000 ChatML örneği gereksiz yere pad edilerek GPU matris işlem yükünü 16 kat artırmıştır.
- **Çözüm:** Müşteri hizmetleri SSS ve ürün Q&A yapısına uygun olarak `max_seq_length=512` olarak ayarlanmıştır.

### 3. TRL 1.9 Chunked Cross-Entropy Float32 Upcasting OOM Hatası (Kritik Keşif ⭐)
- **Sorun:** TRL `SFTTrainer` kütüphanesi, kayıp (loss) hesaplarken Qwen 2.5'in **152,064 jetonluk devasa vokabüler matrisini (`w.float()`)** GPU VRAM üzerinde float32 tipine dönüştürür (`_chunked_cross_entropy_loss`). Bu durum **2.18 GiB** tutarında anlık bellek sıçramasına yol açarak 8GB GPU'larda `CUDA Out of Memory` hatası üretmiş ve 1 adımı 6.000 saniyeye düşürmüştür.
- **Çözüm:** TRL `SFTTrainer` yerine doğrudan yerel PyTorch matris hesaplaması yapan `transformers.Trainer` + ön-tokenize edilmiş ChatML veri akışına geçilmiştir.

---

## 🚀 Performans Karşılaştırma Tablosu

| Metrik | Varsayılan TRL Yapılandırması | Optimize Edilmiş PyTorch Trainer | Fark / Kazanç |
| :--- | :--- | :--- | :--- |
| **Adım Başına Süre** | ~6,000 saniye / adım | **~10 saniye / adım** | **600X Hızlanma** ⚡ |
| **Örnek Başına Süre** | ~750 saniye / örnek | **~1.25 saniye / örnek** | **600X Hızlanma** ⚡ |
| **VRAM Kullanımı** | 8.21 GB (OOM Taşması) | **5.3 GB / 8.0 GB** | **%100 VRAM Güvenliği** |
| **Vokabüler Matris Upcast** | Float32 (2.18 GB İsraf) | Float16 Native | **2.18 GB VRAM Tasarrufu** |
| **Tahmini Eğitim Süresi** | 7.500+ Saat | **~12.5 Saat (Tam 3 Epoch)** | **Kesintisiz Tam Eğitim** |

---

## ⚙️ Model & Fine-Tuning Hiperparametreleri

```python
# LoRA Katmanı Yapılandırması
peft_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

# Eğitim Parametreleri
training_args = TrainingArguments(
    output_dir="./merinos_meri_model",
    num_train_epochs=3,
    per_device_train_batch_size=1,
    gradient_accumulation_steps=8,
    learning_rate=2e-4,
    fp16=False,
    bf16=False,
    logging_steps=20,
    optim="paged_adamw_8bit",
    gradient_checkpointing=True,
)
```

---

## 📈 Canlı Eğitim İlerleme Takibi (`/goal` Modu Aktif)

> [!NOTE]
> Bu bölüm arka planda çalışan zamanlayıcılar tarafından canlı olarak güncellenmektedir.

- **Aktif Task ID:** `task-1287` (Tamamlandı)
- **Model:** `unsloth/Qwen2.5-7B-Instruct-bnb-4bit` (QLoRA)
- **Eğitim Örnek Sayısı:** 12,000 ChatML örneği (Train) / 1,500 örnek (Validation)
- **Düzeltme:** `eval_strategy="no"` + `save_steps=500` (OOM önlemi)
- **Mevcut Durum:** **COMPLETED 🎉 (Epoch 3/3, Loss: 0.2399)**

| Güncelleme Zamanı | Adım (Step) | Toplam Adım | Tamamlanma % | Adım Süresi | Kalan Süre | Durum |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **2026-07-30 08:00:00** | 16 | 4,500 | %0.36 | 10.8 s/it | ~13.4 Saat | 🟢 Aktif |
| **2026-07-30 08:13:30** | 87 | 4,500 | %1.93 | 10.7 s/it | ~12.8 Saat | 🟢 Aktif |
| **2026-07-30 08:25:45** | 157 | 4,500 | %3.50 | 10.1 s/it | ~12 Saat 15 Dk | 🟢 Aktif |
| **2026-07-30 08:28:35** | 173 | 4,500 | %3.84 | 9.86 s/it | ~11 Saat 50 Dk | 🟢 Aktif |
| **2026-07-30 08:43:45** | 260 | 4,500 | %5.78 | 10.68 s/it | ~12 Saat 30 Dk | 🟢 Aktif |
| **2026-07-30 08:59:00** | 344 | 4,500 | %7.64 | 10.65 s/it | ~12 Saat 18 Dk | 🟢 Aktif |
| **2026-07-30 09:14:30** | 429 | 4,500 | %9.53 | 11.14 s/it | ~12 Saat 35 Dk | 🟢 Aktif |
| **2026-07-30 09:29:30** | 513 | 4,500 | %11.40 | 10.62 s/it | ~11 Saat 45 Dk | 🟢 Aktif |
| **2026-07-30 09:44:45** | 598 | 4,500 | %13.29 | 10.69 s/it | ~11 Saat 35 Dk | 🟢 Aktif |
| **2026-07-30 10:00:00** | 684 | 4,500 | %15.20 | 10.68 s/it | ~11 Saat 19 Dk | 🟢 Aktif |
| **2026-07-30 10:15:30** | 735 | 4,500 | %16.33 | 10.63 s/it | ~11 Saat 07 Dk | 🟢 Aktif |
| **2026-07-30 10:31:00** | 804 | 4,500 | %17.87 | 11.90 s/it | ~12 Saat 13 Dk | 🟢 Aktif |
| **2026-07-30 10:46:30** | 928 | 4,500 | %20.62 | 10.93 s/it | ~10 Saat 50 Dk | 🟢 Aktif |
| **2026-07-30 11:02:00** | 1,010 | 4,500 | %22.44 | 11.30 s/it | ~10 Saat 57 Dk | 🟢 Aktif |
| **2026-07-30 11:17:15** | 1,089 | 4,500 | %24.20 | 11.13 s/it | ~10 Saat 32 Dk | 🟢 Aktif |
| **2026-07-30 12:02:00** | 1,328 | 4,500 | %29.51 | 10.76 s/it | ~9 Saat 28 Dk | 🟢 Aktif |
| **2026-07-30 12:17:30** | 1,401 | 4,500 | %31.13 | 12.92 s/it | ~11 Saat 07 Dk | 🟢 Aktif |
| **2026-07-30 12:33:05** | 1,475 | 4,500 | %32.78 | 12.94 s/it | ~10 Saat 52 Dk | 🟢 Aktif |
| **2026-07-30 12:38:35** | ~~1,500~~ | ~~4,500~~ | ~~%33.33~~ | — | — | 🔴 **OOM Çöktü** (Epoch 1 sonu eval) |
| **2026-07-30 12:45:00** | YENİDEN BAŞLADI | 4,500 | %0 | 12.57 s/it | ~15 Saat 39 Dk | 🟢 Aktif (task-1287) |
| **2026-07-30 13:01:00** | 93 | 4,500 | %2.07 | 12.08 s/it | ~14 Saat 47 Dk | 🟢 Aktif |
| **2026-07-30 17:42:45** | 1,419 | 4,500 | %31.53 | 10.72 s/it | ~9 Saat 10 Dk | 🟢 Aktif (Checkpoint 500 & 1000 Saved) |
| **2026-07-30 17:58:00** | 1,496 | 4,500 | %33.24 | 12.04 s/it | ~10 Saat 02 Dk | 🟢 Aktif |
| **2026-07-30 18:00:30** | 1,509 | 4,500 | %33.53 | 10.89 s/it | ~9 Saat 03 Dk | 🟢 Aktif (Checkpoint 1500 Saved) |
| **2026-07-30 18:13:20** | 1,587 | 4,500 | %35.27 | 9.86 s/it | ~7 Saat 58 Dk | 🟢 Aktif |
| **2026-07-30 18:28:30** | 1,672 | 4,500 | %37.16 | 10.71 s/it | ~8 Saat 24 Dk | 🟢 Aktif |
| **2026-07-30 18:43:40** | 1,757 | 4,500 | %39.04 | 10.69 s/it | ~8 Saat 08 Dk | 🟢 Aktif |
| **2026-07-30 18:58:55** | 1,842 | 4,500 | %40.93 | 10.71 s/it | ~7 Saat 54 Dk | 🟢 Aktif |
| **2026-07-30 19:14:10** | 1,927 | 4,500 | %42.82 | 10.69 s/it | ~7 Saat 38 Dk | 🟢 Aktif |
| **2026-07-30 19:29:20** | 2,011 | 4,500 | %44.69 | 10.76 s/it | ~7 Saat 26 Dk | 🟢 Aktif (Checkpoint 2000 Saved) |
| **2026-07-30 19:44:30** | 2,096 | 4,500 | %46.58 | 10.74 s/it | ~7 Saat 10 Dk | 🟢 Aktif |
| **2026-07-30 19:59:40** | 2,181 | 4,500 | %48.47 | 10.75 s/it | ~6 Saat 55 Dk | 🟢 Aktif |
| **2026-07-30 20:14:50** | 2,266 | 4,500 | %50.36 | 10.71 s/it | ~6 Saat 38 Dk | 🟢 Aktif |
| **2026-07-30 20:30:00** | 2,351 | 4,500 | %52.24 | 10.76 s/it | ~6 Saat 25 Dk | 🟢 Aktif |
| **2026-07-30 20:45:20** | 2,436 | 4,500 | %54.13 | 10.76 s/it | ~6 Saat 10 Dk | 🟢 Aktif |
| **2026-07-30 21:00:30** | 2,521 | 4,500 | %56.02 | 10.72 s/it | ~5 Saat 53 Dk | 🟢 Aktif (Checkpoint 2500 Saved) |
| **2026-07-30 21:15:40** | 2,606 | 4,500 | %57.91 | 10.72 s/it | ~5 Saat 38 Dk | 🟢 Aktif |
| **2026-07-30 21:30:50** | 2,691 | 4,500 | %59.80 | 10.72 s/it | ~5 Saat 23 Dk | 🟢 Aktif |
| **2026-07-30 21:46:10** | 2,776 | 4,500 | %61.69 | 10.75 s/it | ~5 Saat 08 Dk | 🟢 Aktif |
| **2026-07-30 22:01:25** | 2,861 | 4,500 | %63.58 | 10.74 s/it | ~4 Saat 53 Dk | 🟢 Aktif |
| **2026-07-30 22:16:40** | 2,946 | 4,500 | %65.47 | 10.76 s/it | ~4 Saat 38 Dk | 🟢 Aktif |
| **2026-07-30 22:32:00** | 3,032 | 4,500 | %67.38 | 10.73 s/it | ~4 Saat 22 Dk | 🟢 Aktif (Checkpoint 3000 Saved) |
| **2026-07-30 22:47:15** | 3,117 | 4,500 | %69.27 | 10.75 s/it | ~4 Saat 07 Dk | 🟢 Aktif |
| **2026-07-30 23:02:30** | 3,202 | 4,500 | %71.16 | 10.75 s/it | ~3 Saat 52 Dk | 🟢 Aktif |
| **2026-07-30 23:17:40** | 3,287 | 4,500 | %73.04 | 10.73 s/it | ~3 Saat 37 Dk | 🟢 Aktif |
| **2026-07-30 23:33:00** | 3,372 | 4,500 | %74.93 | 10.76 s/it | ~3 Saat 22 Dk | 🟢 Aktif |
| **2026-07-30 23:48:15** | 3,457 | 4,500 | %76.82 | 10.75 s/it | ~3 Saat 06 Dk | 🟢 Aktif |
| **2026-07-31 00:03:30** | 3,543 | 4,500 | %78.73 | 10.66 s/it | ~2 Saat 49 Dk | 🟢 Aktif (Checkpoint 3500 Saved) |
| **2026-07-31 00:18:45** | 3,628 | 4,500 | %80.62 | 10.76 s/it | ~2 Saat 36 Dk | 🟢 Aktif |
| **2026-07-31 00:34:00** | 3,713 | 4,500 | %82.51 | 10.75 s/it | ~2 Saat 21 Dk | 🟢 Aktif |
| **2026-07-31 00:49:15** | 3,798 | 4,500 | %84.40 | 10.74 s/it | ~2 Saat 05 Dk | 🟢 Aktif |
| **2026-07-31 01:04:30** | 3,884 | 4,500 | %86.31 | 10.69 s/it | ~1 Saat 49 Dk | 🟢 Aktif |
| **2026-07-31 01:19:45** | 3,969 | 4,500 | %88.20 | 10.72 s/it | ~1 Saat 34 Dk | 🟢 Aktif |
| **2026-07-31 01:35:00** | 4,054 | 4,500 | %90.09 | 10.74 s/it | ~1 Saat 19 Dk | 🟢 Aktif (Checkpoint 4000 Saved) |
| **2026-07-31 01:50:15** | 4,139 | 4,500 | %91.98 | 10.73 s/it | ~1 Saat 04 Dk | 🟢 Aktif |
| **2026-07-31 02:05:30** | 4,224 | 4,500 | %93.87 | 10.75 s/it | ~49 Dakika | 🟢 Aktif |
| **2026-07-31 02:20:45** | 4,310 | 4,500 | %95.78 | 10.68 s/it | ~33 Dakika | 🟢 Aktif |
| **2026-07-31 02:36:00** | 4,395 | 4,500 | %97.67 | 10.75 s/it | ~18 Dakika | 🟢 Aktif |
| **2026-07-31 02:53:20** | **4,500** | **4,500** | **%100.00** | **9.89 s/it** | **0 Dakika** | **🎉 TAMAMLANDI (Loss: 0.2399)** |

---

## 💾 Model Çıktıları & İçe Aktarma
Eğitim tamamlandığında LoRA adaptör ağırlıkları ve tokenizer konfigürasyonu `./merinos_meri_model/lora_adapters` dizinine kaydedilecek ve `qwenModelAdapter.ts` tarafından yüklenecektir.
