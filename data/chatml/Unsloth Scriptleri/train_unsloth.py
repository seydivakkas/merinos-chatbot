#!/usr/bin/env python3
"""
Merinos Domain Fine-Tuning Script with Unsloth
==============================================
Optimized for Turkish customer service chatbot training.

Requirements:
    pip install unsloth transformers datasets trl peft accelerate bitsandbytes

Usage:
    python train_unsloth.py --model unsloth/Qwen2.5-7B-Instruct                             --output_dir ./merinos_model                             --epochs 3                             --batch_size 2
"""

import os
import sys
import argparse
import torch
from datasets import load_dataset
from transformers import TrainingArguments
from trl import SFTTrainer
from unsloth import FastLanguageModel, is_bfloat16_supported

# ================================================================
# CONFIGURATION
# ================================================================

def parse_args():
    parser = argparse.ArgumentParser(description="Merinos Fine-Tuning with Unsloth")
    parser.add_argument("--model", type=str, default="unsloth/Qwen2.5-7B-Instruct",
                        help="Base model (Qwen2.5-7B-Instruct recommended for TR)")
    parser.add_argument("--output_dir", type=str, default="./merinos_model",
                        help="Output directory for trained model")
    parser.add_argument("--data_dir", type=str, default="./datasets/split/chatml",
                        help="Directory containing train/val/test.jsonl")
    parser.add_argument("--max_seq_length", type=int, default=2048,
                        help="Maximum sequence length")
    parser.add_argument("--epochs", type=int, default=3,
                        help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=2,
                        help="Per-device batch size")
    parser.add_argument("--grad_accum", type=int, default=4,
                        help="Gradient accumulation steps")
    parser.add_argument("--lr", type=float, default=2e-4,
                        help="Learning rate")
    parser.add_argument("--lora_r", type=int, default=16,
                        help="LoRA rank")
    parser.add_argument("--lora_alpha", type=int, default=32,
                        help="LoRA alpha")
    parser.add_argument("--warmup_steps", type=int, default=100,
                        help="Warmup steps")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed")
    return parser.parse_args()

# ================================================================
# SYSTEM PROMPT
# ================================================================

SYSTEM_PROMPT = """Sen Merinos'un yapay zeka müşteri hizmetleri asistanısın. Adın Meri. Türkçe konuşuyorsun ve halı, ev tekstili ürünleri, sipariş takibi, garanti ve bakım konularında uzmanlaşmışsın.

Görevlerin:
- Müşterilere ürünler, fiyatlar, stok durumu ve sipariş takibi hakkında bilgi vermek
- Garanti ve iade süreçlerini açıklamak
- Halı bakımı ve temizliği konusunda öneriler sunmak
- Profesyonel, nazik ve çözüm odaklı yanıtlar vermek
- Tıbbi, hukuki, finansal tavsiye veya zararlı içerik isteyen talepleri nazikçe reddetmek
- Gerekli olduğunda araçları (ürün arama, sipariş sorgulama, mağaza bulma vb.) kullanmak"""

# ================================================================
# FORMATTING FUNCTION
# ================================================================

def format_chatml(examples):
    """Convert ChatML format to text for Unsloth training."""
    texts = []
    for messages in examples["messages"]:
        # Build conversation text
        text = ""
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            if role == "system":
                text += f"<|im_start|>system\n{content}<|im_end|>\n"
            elif role == "user":
                text += f"<|im_start|>user\n{content}<|im_end|>\n"
            elif role == "assistant":
                text += f"<|im_start|>assistant\n{content}<|im_end|>\n"
        texts.append(text)
    return {"text": texts}

# ================================================================
# MAIN
# ================================================================

def main():
    args = parse_args()

    print("=" * 60)
    print("🚀 Merinos Fine-Tuning with Unsloth")
    print("=" * 60)
    print(f"Model: {args.model}")
    print(f"Output: {args.output_dir}")
    print(f"Epochs: {args.epochs} | Batch: {args.batch_size} | LR: {args.lr}")
    print(f"LoRA: r={args.lora_r}, alpha={args.lora_alpha}")
    print("=" * 60)

    # Set seed
    torch.manual_seed(args.seed)

    # ============================================================
    # 1. LOAD MODEL
    # ============================================================
    print("\n📥 Loading base model...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.model,
        max_seq_length=args.max_seq_length,
        dtype=None,  # Auto-detect (float16 or bfloat16)
        load_in_4bit=True,
    )

    # Add special tokens if not present
    special_tokens = ["<|im_start|>", "<|im_end|>"]
    tokenizer.add_special_tokens({"additional_special_tokens": special_tokens})
    model.resize_token_embeddings(len(tokenizer))

    print(f"  ✅ Model loaded: {args.model}")
    print(f"  📐 Vocab size: {len(tokenizer)}")

    # ============================================================
    # 2. ADD LoRA ADAPTERS
    # ============================================================
    print("\n🔧 Adding LoRA adapters...")
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_r,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_alpha=args.lora_alpha,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=args.seed,
        use_rslora=False,
    )
    print(f"  ✅ LoRA adapters added (r={args.lora_r}, alpha={args.lora_alpha})")

    # ============================================================
    # 3. LOAD DATASET
    # ============================================================
    print("\n📚 Loading datasets...")

    dataset = load_dataset("json", data_files={
        "train": f"{args.data_dir}/train.jsonl",
        "validation": f"{args.data_dir}/val.jsonl",
    })

    # Format to text
    dataset = dataset.map(format_chatml, batched=True)

    print(f"  ✅ Train: {len(dataset['train']):,} samples")
    print(f"  ✅ Val:   {len(dataset['validation']):,} samples")

    # ============================================================
    # 4. TRAINING ARGUMENTS
    # ============================================================
    print("\n⚙️  Configuring training...")

    training_args = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        warmup_steps=args.warmup_steps,
        learning_rate=args.lr,
        fp16=not is_bfloat16_supported(),
        bf16=is_bfloat16_supported(),
        logging_steps=50,
        eval_strategy="steps",
        eval_steps=200,
        save_strategy="steps",
        save_steps=500,
        save_total_limit=3,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="linear",
        seed=args.seed,
        report_to="none",  # Change to "wandb" or "tensorboard" if needed
    )

    # ============================================================
    # 5. TRAINER
    # ============================================================
    print("\n🏋️  Starting training...")

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset["train"],
        eval_dataset=dataset["validation"],
        dataset_text_field="text",
        max_seq_length=args.max_seq_length,
        dataset_num_proc=2,
        packing=False,
        args=training_args,
    )

    # Train
    trainer_stats = trainer.train()

    print(f"\n✅ Training completed!")
    print(f"   Final loss: {trainer_stats.training_loss:.4f}")
    print(f"   Training time: {trainer_stats.metrics.get('train_runtime', 0)/60:.1f} minutes")

    # ============================================================
    # 6. SAVE MODEL
    # ============================================================
    print("\n💾 Saving model...")

    # Save LoRA adapters
    model.save_pretrained(f"{args.output_dir}/lora_adapters")
    tokenizer.save_pretrained(f"{args.output_dir}/lora_adapters")

    # Save merged model (optional - requires more VRAM)
    # model.save_pretrained_merged(f"{args.output_dir}/merged", tokenizer, save_method="merged_16bit")

    # Save GGUF (optional - for llama.cpp)
    # model.save_pretrained_gguf(f"{args.output_dir}/gguf", tokenizer, quantization_method="q4_k_m")

    print(f"  ✅ Model saved to: {args.output_dir}/lora_adapters")
    print(f"  📁 Files: adapter_config.json, adapter_model.safetensors, tokenizer files")

    # ============================================================
    # 7. EVALUATION ON TEST SET
    # ============================================================
    print("\n🧪 Evaluating on test set...")

    test_dataset = load_dataset("json", data_files={"test": f"{args.data_dir}/test.jsonl"})
    test_dataset = test_dataset.map(format_chatml, batched=True)

    eval_results = trainer.evaluate(eval_dataset=test_dataset["test"])
    print(f"  📊 Test loss: {eval_results['eval_loss']:.4f}")
    print(f"  📊 Test perplexity: {torch.exp(torch.tensor(eval_results['eval_loss'])).item():.2f}")

    print("\n" + "=" * 60)
    print("🎉 MERINOS FINE-TUNING COMPLETE!")
    print("=" * 60)
    print(f"\nNext steps:")
    print(f"  1. Run inference: python inference.py --model {args.output_dir}/lora_adapters")
    print(f"  2. Merge adapters: python merge_model.py --base {args.model} --lora {args.output_dir}/lora_adapters")
    print(f"  3. Convert to GGUF: python convert_gguf.py --model {args.output_dir}/merged")

if __name__ == "__main__":
    main()
