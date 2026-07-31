#!/usr/bin/env python3
"""
Convert merged model to GGUF format for llama.cpp / Ollama.

Usage:
    python convert_gguf.py --model ./merinos_model/merged --output ./merinos_model/gguf
"""

import argparse
from unsloth import FastLanguageModel

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str, required=True, help="Merged model path")
    parser.add_argument("--output", type=str, required=True, help="Output directory")
    parser.add_argument("--quantization", type=str, default="q4_k_m",
                        choices=["q4_k_m", "q5_k_m", "q8_0", "f16"],
                        help="GGUF quantization method")
    return parser.parse_args()

def main():
    args = parse_args()

    print(f"📥 Loading model: {args.model}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.model,
        max_seq_length=2048,
        dtype=None,
        load_in_4bit=False,
    )

    print(f"🔧 Converting to GGUF ({args.quantization})...")
    model.save_pretrained_gguf(
        args.output,
        tokenizer,
        quantization_method=args.quantization,
    )

    print(f"✅ GGUF model saved to: {args.output}")
    print(f"\nTo use with Ollama:")
    print(f"  1. Create Modelfile:")
    print(f"     FROM {args.output}/model-{args.quantization}.gguf")
    print(f"     SYSTEM "Sen Merinos'un yapay zeka müşteri hizmetleri asistanısın..."")
    print(f"  2. ollama create merinos -f Modelfile")
    print(f"  3. ollama run merinos")

if __name__ == "__main__":
    main()
