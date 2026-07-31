#!/usr/bin/env python3
"""
Merinos Inference Script
======================
Load trained model and chat with it.

Usage:
    python inference.py --model ./merinos_model/lora_adapters
    python inference.py --model unsloth/Qwen2.5-7B-Instruct --base_model unsloth/Qwen2.5-7B-Instruct
"""

import argparse
import torch
from unsloth import FastLanguageModel

SYSTEM_PROMPT = """Sen Merinos'un yapay zeka müşteri hizmetleri asistanısın. Adın Meri. Türkçe konuşuyorsun ve halı, ev tekstili ürünleri, sipariş takibi, garanti ve bakım konularında uzmanlaşmışsın. Profesyonel, nazik ve çözüm odaklı yanıtlar ver."""

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str, required=True,
                        help="Path to LoRA adapters or merged model")
    parser.add_argument("--base_model", type=str, default=None,
                        help="Base model (if loading LoRA adapters)")
    parser.add_argument("--max_seq_length", type=int, default=2048)
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument("--top_p", type=float, default=0.9)
    parser.add_argument("--max_new_tokens", type=int, default=512)
    return parser.parse_args()

def main():
    args = parse_args()

    print("🚀 Loading model...")

    if args.base_model:
        # Load base + LoRA
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=args.base_model,
            max_seq_length=args.max_seq_length,
            dtype=None,
            load_in_4bit=True,
        )
        model = FastLanguageModel.get_peft_model(model)
        model.load_adapter(args.model)
    else:
        # Load merged model
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=args.model,
            max_seq_length=args.max_seq_length,
            dtype=None,
            load_in_4bit=True,
        )

    FastLanguageModel.for_inference(model)

    print("✅ Model loaded! Type 'exit' to quit.\n")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    while True:
        user_input = input("👤 Siz: ")
        if user_input.lower() in ["exit", "quit", "çık", "q"]:
            print("👋 Görüşmek üzere!")
            break

        messages.append({"role": "user", "content": user_input})

        # Tokenize
        inputs = tokenizer.apply_chat_template(
            messages,
            tokenize=True,
            return_tensors="pt",
            add_generation_prompt=True,
        ).to("cuda")

        # Generate
        outputs = model.generate(
            input_ids=inputs,
            max_new_tokens=args.max_new_tokens,
            temperature=args.temperature,
            top_p=args.top_p,
            use_cache=True,
        )

        response = tokenizer.batch_decode(outputs, skip_special_tokens=True)[0]
        # Extract assistant response
        if "assistant" in response:
            response = response.split("assistant")[-1].strip()

        print(f"🤖 Meri: {response}\n")
        messages.append({"role": "assistant", "content": response})

if __name__ == "__main__":
    main()
