#!/usr/bin/env python3
"""
ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)

Merinos Chatbot — Fine-Tuned Meri QLoRA İnteraktif Test Scripti
================================================================
Eğitilmiş LoRA adaptörlerini (./merinos_meri_model/lora_adapters) ve Qwen2.5-7B
modelini yükleyerek terminal üzerinden Meri ile canlı sohbet testi yapmanızı sağlar.
"""

import os
import sys
import torch

os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    base_model_name = "unsloth/Qwen2.5-7B-Instruct-bnb-4bit"
    adapter_dir = "./merinos_meri_model/lora_adapters"

    print("=" * 75)
    print("🧵 MERİNOS CHATBOT — FINE-TUNED MERİ İNTERAKTİF TEST MERKEZİ")
    print("=" * 75)
    print(f"📦 Temel Model:     {base_model_name}")
    print(f"📂 LoRA Adaptörü:   {adapter_dir}")
    print(f"💻 CUDA Kullanılabilir: {torch.cuda.is_available()}")

    if torch.cuda.is_available():
        print(f"🎮 GPU Cihazı:        {torch.cuda.get_device_name(0)}")
        torch.cuda.empty_cache()

    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from peft import PeftModel

    print("\n📥 Model ve Tokenizer yükleniyor...")
    tokenizer = AutoTokenizer.from_pretrained(
        adapter_dir if os.path.exists(adapter_dir) else base_model_name,
        trust_remote_code=True
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        bnb_4bit_use_double_quant=True,
    )

    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        quantization_config=bnb_config,
        device_map="auto" if torch.cuda.is_available() else None,
        trust_remote_code=True
    )

    if os.path.exists(adapter_dir):
        print(f"🔧 Fine-tuned LoRA ağırlıkları entegre ediliyor ({adapter_dir})...")
        model = PeftModel.from_pretrained(base_model, adapter_dir)
        print("✅ Fine-Tuned Meri LoRA modeli başarıyla yüklendi!")
    else:
        print("⚠️ LoRA adaptörü bulunamadı, temel model ile çalışılıyor.")
        model = base_model

    model.eval()

    system_prompt = (
        "<|im_start|>system\n"
        "Sen Merinos'un Kıdemli Müşteri Hizmetleri Uzmanısın. İsmin Meri. Türkçe konuşuyorsun. "
        "Merinos halı, ev tekstili, leke temizliği, sipariş takibi, bayi ve garanti süreçlerinde uzmanlaşmış "
        "nazik, empati kuran ve çözüm odaklı profesyonel bir destek temsilcisisin.<|im_end|>\n"
    )

    print("\n" + "=" * 75)
    print("✨ MERİ İLE CANLI SOHBET BAŞLADI!")
    print("Soru sorabilirsiniz. Çıkmak için 'q', 'exit' veya 'cikis' yazabilirsiniz.")
    print("=" * 75 + "\n")

    history = system_prompt

    while True:
        try:
            user_input = input("👤 Siz: ").strip()
            if not user_input:
                continue
            if user_input.lower() in ["q", "exit", "cikis", "çıkış"]:
                print("\n👋 Meri: Merinos'u tercih ettiğiniz için teşekkür eder, iyi günler dilerim!")
                break

            prompt = history + f"<|im_start|>user\n{user_input}<|im_end|>\n<|im_start|>assistant\n"
            inputs = tokenizer(prompt, return_tensors="pt").to("cuda" if torch.cuda.is_available() else "cpu")

            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=256,
                    temperature=0.7,
                    top_p=0.9,
                    do_sample=True,
                    pad_token_id=tokenizer.pad_token_id,
                    eos_token_id=tokenizer.encode("<|im_end|>")[0] if "<|im_end|>" in tokenizer.get_vocab() else tokenizer.eos_token_id
                )

            generated_ids = outputs[0][inputs.input_ids.shape[1]:]
            response = tokenizer.decode(generated_ids, skip_special_tokens=True).strip()

            # Clean any trailing special tokens
            if "<|im_end|>" in response:
                response = response.split("<|im_end|>")[0].strip()

            print(f"\n🧵 Meri: {response}\n")
            history += f"<|im_start|>user\n{user_input}<|im_end|>\n<|im_start|>assistant\n{response}<|im_end|>\n"

        except KeyboardInterrupt:
            print("\n\n👋 Görüşme sonlandırıldı.")
            break
        except Exception as e:
            print(f"\n❌ Bir hata oluştu: {e}\n")

if __name__ == "__main__":
    main()
