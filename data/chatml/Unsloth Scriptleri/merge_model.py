#!/usr/bin/env python3
"""
Merge LoRA adapters with base model.

Usage:
    python merge_model.py --base unsloth/Qwen2.5-7B-Instruct \
                          --lora ./merinos_model/lora_adapters \
                          --output ./merinos_model/merged
"""

import argparse
from unsloth import FastLanguageModel

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", type=str, required=True, help="Base model name/path")
    parser.add_argument("--lora", type=str, required=True, help="LoRA adapters path")
    parser.add_argument("--output", type=str, required=True, help="Output directory")
    parser.add_argument("--quantization", type=str, default="f16",
                        choices=["f16", "q4_k_m", "q5_k_m", "q8_0"],
                        help="Quantization for merged model")
    return parser.parse_args()

def main():
    args = parse_args()

    print(f"📥 Loading base model: {args.base}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base,
        max_seq_length=2048,
        dtype=None,
        load_in_4bit=False,  # Load in full precision for merging
    )

    print(f"🔌 Loading LoRA adapters: {args.lora}")
    model = FastLanguageModel.get_peft_model(model)
    model.load_adapter(args.lora)

    print(f"🔧 Merging and saving to: {args.output}")

    if args.quantization == "f16":
        model.save_pretrained_merged(args.output, tokenizer, save_method="merged_16bit")
    elif args.quantization == "q8_0":
        model.save_pretrained_merged(args.output, tokenizer, save_method="merged_16bit")
        # Then use llama.cpp for q8_0
    else:
        # GGUF format
        model.save_pretrained_gguf(args.output, tokenizer, quantization_method=args.quantization)

    print(f"✅ Model saved to: {args.output}")

if __name__ == "__main__":
    main()
