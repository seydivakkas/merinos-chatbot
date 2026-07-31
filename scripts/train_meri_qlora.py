#!/usr/bin/env python3
"""
Merinos Chatbot — Meri QLoRA Fine-Tuning Script (Windows Compatible)
=====================================================================
NVIDIA GPU üzerinde Triton gereksinimi olmadan yerel PyTorch + PEFT + BitsAndBytes
ile Qwen2.5-7B-Instruct 4-bit QLoRA ince ayarını gerçekleştirir.
"""

import os
import sys
import json
import argparse
import torch

os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def parse_args():
    parser = argparse.ArgumentParser(description="Meri Native QLoRA Fine-Tuning")
    parser.add_argument("--model", type=str, default="Qwen/Qwen2.5-7B-Instruct", help="Temel model")
    parser.add_argument("--data_dir", type=str, default="./data/chatml/ChatML-Unsloth için önerilen Split Veriler", help="ChatML split veri seti dizini")
    parser.add_argument("--output_dir", type=str, default="./merinos_meri_model", help="Model çıktı dizini")
    parser.add_argument("--epochs", type=int, default=3, help="Epoch sayısı")
    parser.add_argument("--batch_size", type=int, default=1, help="Batch boyutu")
    parser.add_argument("--grad_accum", type=int, default=8, help="Gradient accumulation")
    parser.add_argument("--lr", type=float, default=2e-4, help="Öğrenme oranı")
    parser.add_argument("--max_seq_length", type=int, default=512, help="Max sequence length")
    return parser.parse_args()

def format_chatml(example):
    text = ""
    messages = example.get("messages", [])
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "system":
            text += f"<|im_start|>system\n{content}<|im_end|>\n"
        elif role == "user":
            text += f"<|im_start|>user\n{content}<|im_end|>\n"
        elif role == "assistant":
            text += f"<|im_start|>assistant\n{content}<|im_end|>\n"
    return {"text": text}

def main():
    args = parse_args()
    print("=" * 70)
    print("🧵 MERİNOS CHATBOT — HIGH SPEED QLORA FINE-TUNING (NVIDIA RTX 4070)")
    print("=" * 70)
    print(f"📌 Model: {args.model}")
    print(f"📂 Veri Dizi: {args.data_dir}")
    print(f"📁 Çıktı: {args.output_dir}")
    print(f"📐 Max Seq Length: {args.max_seq_length}")
    print(f"⚡ Batch Size: {args.batch_size} (Grad Accum: {args.grad_accum})")
    print(f"💻 CUDA Kullanılabilir: {torch.cuda.is_available()}")

    if torch.cuda.is_available():
        print(f"🎮 GPU Cihazı: {torch.cuda.get_device_name(0)}")
        torch.cuda.empty_cache()

    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainingArguments, Trainer, DataCollatorForLanguageModeling
    from peft import LoraConfig, get_peft_model
    from datasets import load_dataset

    # 1. BitsAndBytes 4-Bit NF4 Quantization Config
    print("\n📦 BitsAndBytes 4-bit NF4 yapılandırması hazırlanıyor...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        bnb_4bit_use_double_quant=True,
    )

    # 2. Tokenizer ve Model Yükleme
    print(f"\n📥 Model yükleniyor: {args.model} ...")
    tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        args.model,
        quantization_config=bnb_config,
        device_map="auto" if torch.cuda.is_available() else None,
        trust_remote_code=True,
    )

    # 3. LoRA Yapılandırması
    print("\n🔧 LoRA katmanları ekleniyor (r=16, alpha=32)...")
    peft_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    # 4. Veri Seti Yükleme ve Tokenize Etme
    print("\n📚 Veri seti yükleniyor ve tokenize ediliyor (Max Length: 512)...")
    train_path = os.path.join(args.data_dir, "train.jsonl")
    val_path = os.path.join(args.data_dir, "val.jsonl")

    raw_dataset = load_dataset("json", data_files={"train": train_path, "validation": val_path})

    def preprocess_function(examples):
        texts = []
        for messages in examples["messages"]:
            text = ""
            for msg in messages:
                role = msg.get("role", "")
                content = msg.get("content", "")
                if role == "system":
                    text += f"<|im_start|>system\n{content}<|im_end|>\n"
                elif role == "user":
                    text += f"<|im_start|>user\n{content}<|im_end|>\n"
                elif role == "assistant":
                    text += f"<|im_start|>assistant\n{content}<|im_end|>\n"
            texts.append(text)
        
        tokenized = tokenizer(
            texts,
            max_length=args.max_seq_length,
            truncation=True,
            padding="max_length",
        )
        tokenized["labels"] = [list(ids) for ids in tokenized["input_ids"]]
        return tokenized

    tokenized_dataset = raw_dataset.map(
        preprocess_function,
        batched=True,
        remove_columns=raw_dataset["train"].column_names,
    )

    print(f"  ✅ Train örnek sayısı: {len(tokenized_dataset['train']):,}")
    print(f"  ✅ Val örnek sayısı:   {len(tokenized_dataset['validation']):,}")

    # 5. Training Arguments (Optimum GPU Performansı)
    # NOT: eval_strategy="no" — epoch sonu değerlendirmesi OOM'a yol açıyor.
    # transformers ForCausalLMLoss logits.float() ile 2.32 GiB VRAM tüketiyor.
    training_args = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        warmup_steps=50,
        learning_rate=args.lr,
        fp16=False,
        bf16=False,
        logging_steps=20,
        save_strategy="steps",
        save_steps=500,
        save_total_limit=3,
        eval_strategy="no",
        optim="paged_adamw_8bit",
        gradient_checkpointing=True,
        report_to="none",
    )

    # 6. Trainer (eval_dataset kaldırıldı — OOM önlemi)
    print("\n🏋️ Yüksek hızlı fine-tuning başlatılıyor...")
    trainer = Trainer(
        model=model,
        train_dataset=tokenized_dataset["train"],
        args=training_args,
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
    )

    trainer.train()

    # 7. Model Kaydetme
    print(f"\n💾 LoRA adaptörleri kaydediliyor: {args.output_dir}/lora_adapters ...")
    os.makedirs(f"{args.output_dir}/lora_adapters", exist_ok=True)
    model.save_pretrained(f"{args.output_dir}/lora_adapters")
    tokenizer.save_pretrained(f"{args.output_dir}/lora_adapters")
    print("🎉 Meri QLoRA Eğitimi Başarıyla Tamamlandı!")

if __name__ == "__main__":
    main()
