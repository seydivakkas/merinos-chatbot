# 🧵 Merinos Fine-Tuning Pipeline

Merinos domain'ine özel fine-tuning pipeline'ı. Türkçe müşteri hizmetleri chatbot'u eğitmek için hazır veri setleri, format dönüşümleri ve Unsloth training script'leri.

---

## 📁 Proje Yapısı

```
datasets/
├── raw/                          # Ham mock veri setleri
│   ├── merinos_faq.jsonl         # 3,000 örnek
│   ├── product_qa.jsonl          # 2,000 örnek
│   ├── call_center_anon.jsonl    # 4,000 örnek
│   ├── tool_calls.jsonl          # 3,000 örnek
│   ├── refusals.jsonl            # 1,500 örnek
│   └── turkish_general.jsonl     # 1,500 örnek
│
├── formatted/                    # Fine-tuning formatları
│   ├── merinos_alpaca.jsonl      # Alpaca format
│   ├── merinos_chatml.jsonl      # ChatML format
│   ├── merinos_sharegpt.jsonl    # ShareGPT format
│   ├── merinos_openai_ft.jsonl   # OpenAI Fine-Tuning format
│   ├── merinos_llama2.jsonl      # LLaMA-2 / Vicuna format
│   └── merinos_dpo.jsonl         # DPO (Direct Preference Optimization)
│
├── split/                        # Train/Val/Test split (80/10/10)
│   ├── chatml/
│   │   ├── train.jsonl           # 12,000 örnek
│   │   ├── val.jsonl             # 1,500 örnek
│   │   └── test.jsonl            # 1,500 örnek
│   ├── alpaca/
│   ├── sharegpt/
│   ├── openai_ft/
│   └── llama2/
│
├── train_unsloth.py              # Unsloth training script
├── inference.py                  # Inference / demo script
├── merge_model.py                # LoRA + Base merge
├── convert_gguf.py               # GGUF conversion
└── requirements.txt              # Python dependencies
```

---

## 🚀 Hızlı Başlangıç

### 1. Gereksinimleri Kur

```bash
pip install -r requirements.txt
```

> **Not:** Unsloth için CUDA destekli bir GPU gerekir. Minimum 8GB VRAM önerilir (RTX 3060/4060 ve üstü).

### 2. Eğitimi Başlat

```bash
python train_unsloth.py \
    --model unsloth/Qwen2.5-7B-Instruct \
    --output_dir ./merinos_model \
    --data_dir ./split/chatml \
    --epochs 3 \
    --batch_size 2 \
    --lr 2e-4
```

**Parametreler:**

| Parametre | Varsayılan | Açıklama |
|-----------|-----------|----------|
| `--model` | `unsloth/Qwen2.5-7B-Instruct` | Temel model |
| `--output_dir` | `./merinos_model` | Çıktı dizini |
| `--data_dir` | `./split/chatml` | Veri seti dizini |
| `--epochs` | `3` | Epoch sayısı |
| `--batch_size` | `2` | Batch boyutu |
| `--grad_accum` | `4` | Gradient biriktirme adımı |
| `--lr` | `2e-4` | Öğrenme oranı |
| `--lora_r` | `16` | LoRA rank |
| `--lora_alpha` | `32` | LoRA alpha |
| `--max_seq_length` | `2048` | Maksimum sequence uzunluğu |

### 3. Modeli Test Et

```bash
python inference.py --model ./merinos_model/lora_adapters --base_model unsloth/Qwen2.5-7B-Instruct
```

### 4. Modeli Birleştir (Merge)

```bash
python merge_model.py \
    --base unsloth/Qwen2.5-7B-Instruct \
    --lora ./merinos_model/lora_adapters \
    --output ./merinos_model/merged
```

### 5. GGUF'a Dönüştür (Ollama için)

```bash
python convert_gguf.py \
    --model ./merinos_model/merged \
    --output ./merinos_model/gguf \
    --quantization q4_k_m
```

---

## 📊 Veri Seti Detayları

| Kategori | Örnek | İçerik |
|----------|-------|--------|
| **merinos_faq** | 3,000 | Kurumsal bilgi, garanti, bakım, e-ticaret SSS |
| **product_qa** | 2,000 | Ürün spesifik soru-cevap (seri, malzeme, ölçü, fiyat) |
| **call_center_anon** | 4,000 | Müşteri-temsilci diyalogları (16 farklı intent) |
| **tool_calls** | 3,000 | Fonksiyon çağrıları + reasoning + sonuç |
| **refusals** | 1,500 | Reddetme örnekleri (tıbbi, hukuki, siyasi, jailbreak) |
| **turkish_general** | 1,500 | Genel Türkçe konuşma kalıpları |
| **Toplam** | **15,000** | |

---

## 🎯 Fine-Tuning Formatları

| Format | Framework | Dosya |
|--------|-----------|-------|
| **Alpaca** | Axolotl, FastChat | `merinos_alpaca.jsonl` |
| **ChatML** | Mistral, Qwen, Unsloth | `merinos_chatml.jsonl` |
| **ShareGPT** | FastChat, LMSYS | `merinos_sharegpt.jsonl` |
| **OpenAI FT** | OpenAI API, Azure | `merinos_openai_ft.jsonl` |
| **LLaMA-2** | LLaMA-2, Vicuna | `merinos_llama2.jsonl` |
| **DPO** | TRL, Axolotl | `merinos_dpo.jsonl` |

---

## 🧠 Model Önerileri

| Model | Boyut | Türkçe | VRAM (4-bit) | Uygunluk |
|-------|-------|--------|-------------|----------|
| `unsloth/Qwen2.5-7B-Instruct` | 7B | ⭐⭐⭐⭐⭐ | ~6GB | **Önerilen** |
| `unsloth/Mistral-7B-Instruct-v0.3` | 7B | ⭐⭐⭐⭐ | ~6GB | İyi |
| `unsloth/Llama-3.1-8B-Instruct` | 8B | ⭐⭐⭐⭐ | ~7GB | İyi |
| `unsloth/gemma-2-9b-it` | 9B | ⭐⭐⭐ | ~7GB | Orta |

---

## 🔧 Alternatif Framework'ler

### Axolotl ile Training

```yaml
# axolotl_config.yaml
base_model: unsloth/Qwen2.5-7B-Instruct
model_type: AutoModelForCausalLM
load_in_4bit: true
adapter: lora
lora_r: 16
lora_alpha: 32
lora_target_modules:
  - q_proj
  - k_proj
  - v_proj
  - o_proj
  - gate_proj
  - up_proj
  - down_proj
sequence_len: 2048
num_epochs: 3
micro_batch_size: 2
gradient_accumulation_steps: 4
learning_rate: 2e-4
optimizer: adamw_8bit
datasets:
  - path: datasets/split/chatml/train.jsonl
    type: chat_template
val_set_size: 0.1
output_dir: ./merinos_axolotl
```

### OpenAI API ile Fine-Tuning

```bash
# Veri setini OpenAI formatına dönüştür (hazır: merinos_openai_ft.jsonl)
openai api fine_tunes.create -t datasets/formatted/merinos_openai_ft.jsonl -m gpt-3.5-turbo
```

---

## 📈 Eğitim Takibi

### Weights & Biases

```bash
pip install wandb
wandb login
# train_unsloth.py içinde report_to="wandb" olarak değiştir
```

### TensorBoard

```bash
tensorboard --logdir ./merinos_model/logs
```

---

## 📝 Örnek Çıktılar

### Ürün Bilgisi
```
👤 Siz: Nepal serisi 160x230 cm fiyatı nedir?
🤖 Meri: Nepal serisi 160x230 cm ölçüsünde; yün iplikten üretilmiş,
   heat-set teknolojisi ile dokunmuş, yumuşak dokulu bir halıdır.
   Fiyat aralığı 1,200-5,000 TL'dir. Stok durumunu ve güncel
   fiyatı için ürün sayfasını inceleyebilirsiniz.
```

### Sipariş Takibi
```
👤 Siz: MRN123456 siparişim nerede?
🤖 Meri: MRN123456 numaralı siparişiniz 'Kargoya Verildi' durumunda.
   Aras Kargo ile gönderilmiştir. Tahmini teslimat: 30.07.2026.
   Takip numarası: TR987654321.
```

### Reddetme
```
👤 Siz: Merinos hissesi almalı mıyım?
🤖 Meri: Yatırım tavsiyesi veremem. Finansal kararlarınız için
   bir yatırım danışmanına başvurmanızı öneririm. Size ürünlerimiz
   hakkında nasıl yardımcı olabilirim?
```

---

## ⚠️ Notlar

- **Veri setleri mock/toy veridir.** Gerçek fine-tuning için gerçek müşteri verileriyle değiştirilmelidir.
- **Gizlilik:** Gerçek veri kullanımında KVKK/GDPR uyumuna dikkat edilmelidir.
- **GPU Gereksinimi:** Eğitim için minimum 8GB VRAM önerilir.
- **Türkçe Tokenizer:** Qwen2.5 ve Mistral Türkçe tokenizasyonda iyi performans gösterir.

---

## 📄 Lisans

Bu proje eğitim ve geliştirme amaçlıdır. Merinos markası ve bilgileri kamuya açık kaynaklardan derlenmiştir.

---

## 🤝 Katkı

Geliştirmeler ve öneriler için issue açabilirsiniz.
