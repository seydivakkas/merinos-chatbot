#!/usr/bin/env python3
"""
================================================================================
MERINOS MODEL EVALUATION
================================================================================
Eğitilmiş modeli test seti üzerinde değerlendir:
- Perplexity
- BLEU / ROUGE (reference-based)
- GPT-4 judge (reference-free)
- Domain-specific accuracy

Kullanım:
    python eval_model.py --model ./merinos_7b_8gb/lora_adapters \
                         --base_model unsloth/Qwen2.5-7B-Instruct-bnb-4bit \
                         --test_data ./split/chatml/test.jsonl
================================================================================
"""

import argparse
import json
import time
import torch
from pathlib import Path
from datasets import load_dataset
from transformers import AutoTokenizer
from unsloth import FastLanguageModel
import numpy as np

# Metric imports (pip install rouge-score sacrebleu)
try:
    from rouge_score import rouge_scorer
    ROUGE_AVAILABLE = True
except ImportError:
    ROUGE_AVAILABLE = False

try:
    import sacrebleu
    BLEU_AVAILABLE = True
except ImportError:
    BLEU_AVAILABLE = False


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str, required=True, help="LoRA adapters veya merged model")
    parser.add_argument("--base_model", type=str, default=None, help="Base model (LoRA için)")
    parser.add_argument("--test_data", type=str, default="./split/chatml/test.jsonl")
    parser.add_argument("--max_samples", type=int, default=500, help="Değerlendirilecek örnek sayısı")
    parser.add_argument("--max_new_tokens", type=int, default=256)
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument("--top_p", type=float, default=0.9)
    parser.add_argument("--output", type=str, default="./evaluation_results.json")
    parser.add_argument("--judge_model", type=str, default=None,
                        help="Hakem modeli (örn: unsloth/gemma-2-9b-it)")
    return parser.parse_args()


def load_model(model_path, base_model=None):
    """Model yükle."""
    if base_model:
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=base_model,
            max_seq_length=2048,
            dtype=None,
            load_in_4bit=True,
        )
        model = FastLanguageModel.get_peft_model(model)
        model.load_adapter(model_path)
    else:
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=model_path,
            max_seq_length=2048,
            dtype=None,
            load_in_4bit=True,
        )
    FastLanguageModel.for_inference(model)
    return model, tokenizer


def generate_response(model, tokenizer, messages, args):
    """Modelden yanıt üret."""
    inputs = tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        return_tensors="pt",
        add_generation_prompt=True,
    ).to("cuda")

    with torch.no_grad():
        outputs = model.generate(
            input_ids=inputs,
            max_new_tokens=args.max_new_tokens,
            temperature=args.temperature,
            top_p=args.top_p,
            use_cache=True,
            pad_token_id=tokenizer.eos_token_id,
        )

    response = tokenizer.decode(outputs[0][inputs.shape[1]:], skip_special_tokens=True)
    return response.strip()


def calculate_perplexity(model, tokenizer, text):
    """Tek bir metin için perplexity hesapla."""
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to("cuda")
    with torch.no_grad():
        outputs = model(**inputs, labels=inputs["input_ids"])
    return torch.exp(outputs.loss).item()


def evaluate_with_judge(judge_model, judge_tokenizer, question, reference, prediction):
    """Gemma-2-9B hakem ile karşılaştırma."""
    prompt = f"""Aşağıdaki soruya verilen iki yanıtı karşılaştır. Hangisi daha doğru, daha yardımcı ve daha profesyonel?

Soru: {question}

Yanıt A (Referans): {reference}

Yanıt B (Model): {prediction}

Sadece şu formatta yanıt ver:
- Daha iyi yanıt: A veya B
- Skor farkı: 0 ile 1 arasında (0=eşit, 1=birisi çok üstün)
- Kısa gerekçe:"""

    messages = [{"role": "user", "content": prompt}]
    inputs = judge_tokenizer.apply_chat_template(
        messages, tokenize=True, return_tensors="pt", add_generation_prompt=True
    ).to("cuda")

    with torch.no_grad():
        outputs = judge_model.generate(
            input_ids=inputs,
            max_new_tokens=128,
            temperature=0.3,
            top_p=0.9,
        )

    response = judge_tokenizer.decode(outputs[0][inputs.shape[1]:], skip_special_tokens=True)
    return response.strip()


def main():
    args = parse_args()

    print("=" * 70)
    print("🧪 MERINOS MODEL EVALUATION")
    print("=" * 70)
    print(f"Model: {args.model}")
    print(f"Test data: {args.test_data}")
    print(f"Max samples: {args.max_samples}")
    print("=" * 70)

    # 1. Model yükle
    print("\n📥 Model yükleniyor...")
    model, tokenizer = load_model(args.model, args.base_model)
    print("  ✅ Model hazır")

    # 2. Hakem model yükle (isteğe bağlı)
    judge_model, judge_tokenizer = None, None
    if args.judge_model:
        print(f"\n📥 Hakem model yükleniyor: {args.judge_model}")
        judge_model, judge_tokenizer = load_model(args.judge_model, None)
        print("  ✅ Hakem hazır")

    # 3. Test verisi yükle
    print("\n📚 Test verisi yükleniyor...")
    test_dataset = load_dataset("json", data_files={"test": args.test_data})["test"]
    if args.max_samples:
        test_dataset = test_dataset.select(range(min(args.max_samples, len(test_dataset))))
    print(f"  ✅ {len(test_dataset)} örnek yüklendi")

    # 4. Metrik hazırlıkları
    rouge = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True) if ROUGE_AVAILABLE else None

    # 5. Değerlendirme
    results = {
        "model": args.model,
        "base_model": args.base_model,
        "test_samples": len(test_dataset),
        "metrics": {},
        "samples": [],
    }

    perplexities = []
    rouge1_scores = []
    rouge2_scores = []
    rougeL_scores = []
    bleu_scores = []
    judge_scores = []

    generation_times = []

    print("\n🔄 Değerlendirme başlıyor...")
    for i, example in enumerate(test_dataset):
        # ChatML formatından mesajları çıkar
        messages = example.get("messages", [])
        if not messages:
            continue

        # Son assistant mesajını reference olarak al
        reference = ""
        input_messages = []
        for msg in messages:
            if msg["role"] == "assistant" and not reference:
                reference = msg["content"]
            else:
                input_messages.append(msg)

        if not reference:
            continue

        # Generate
        t0 = time.time()
        prediction = generate_response(model, tokenizer, input_messages, args)
        gen_time = time.time() - t0
        generation_times.append(gen_time)

        # Perplexity (reference üzerinden)
        try:
            ppl = calculate_perplexity(model, tokenizer, reference)
            perplexities.append(ppl)
        except:
            ppl = None

        # ROUGE
        if rouge and reference and prediction:
            scores = rouge.score(reference, prediction)
            rouge1_scores.append(scores["rouge1"].fmeasure)
            rouge2_scores.append(scores["rouge2"].fmeasure)
            rougeL_scores.append(scores["rougeL"].fmeasure)

        # BLEU
        if BLEU_AVAILABLE and reference and prediction:
            bleu = sacrebleu.sentence_bleu(prediction, [reference])
            bleu_scores.append(bleu.score)

        # Judge evaluation
        judge_result = None
        if judge_model and input_messages:
            try:
                last_user_msg = [m for m in input_messages if m["role"] == "user"]
                question = last_user_msg[-1]["content"] if last_user_msg else ""
                judge_result = evaluate_with_judge(
                    judge_model, judge_tokenizer, question, reference, prediction
                )
            except Exception as e:
                judge_result = f"Error: {str(e)}"

        # Kaydet
        sample_result = {
            "index": i,
            "question": input_messages[-1]["content"] if input_messages else "",
            "reference": reference,
            "prediction": prediction,
            "perplexity": ppl,
            "generation_time_sec": round(gen_time, 2),
            "judge_evaluation": judge_result,
        }
        results["samples"].append(sample_result)

        if (i + 1) % 50 == 0:
            print(f"  📊 {i+1}/{len(test_dataset)} tamamlandı")

    # 6. Özet metrikler
    print("\n📊 SONUÇLAR")
    print("=" * 70)

    if perplexities:
        results["metrics"]["perplexity"] = {
            "mean": round(np.mean(perplexities), 3),
            "std": round(np.std(perplexities), 3),
            "median": round(np.median(perplexities), 3),
        }
        print(f"  Perplexity:    {results['metrics']['perplexity']['mean']:.3f} (±{results['metrics']['perplexity']['std']:.3f})")

    if rouge1_scores:
        results["metrics"]["rouge1"] = round(np.mean(rouge1_scores), 4)
        results["metrics"]["rouge2"] = round(np.mean(rouge2_scores), 4)
        results["metrics"]["rougeL"] = round(np.mean(rougeL_scores), 4)
        print(f"  ROUGE-1:       {results['metrics']['rouge1']:.4f}")
        print(f"  ROUGE-2:       {results['metrics']['rouge2']:.4f}")
        print(f"  ROUGE-L:       {results['metrics']['rougeL']:.4f}")

    if bleu_scores:
        results["metrics"]["bleu"] = round(np.mean(bleu_scores), 2)
        print(f"  BLEU:          {results['metrics']['bleu']:.2f}")

    if generation_times:
        results["metrics"]["generation_time"] = {
            "mean_sec": round(np.mean(generation_times), 2),
            "tokens_per_sec": round(args.max_new_tokens / np.mean(generation_times), 1),
        }
        print(f"  Gen. süresi:   {results['metrics']['generation_time']['mean_sec']:.2f}s")
        print(f"  Token/s:       {results['metrics']['generation_time']['tokens_per_sec']:.1f}")

    # 7. Kaydet
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n💾 Sonuçlar kaydedildi: {args.output}")

    # 8. Hızlı özet
    print("\n" + "=" * 70)
    print("📋 HIZLI ÖZET")
    print("=" * 70)
    print(f"""
Model: {args.model}
Test örnekleri: {len(test_dataset)}

METRIKLER:
  Perplexity:     {results['metrics'].get('perplexity', {}).get('mean', 'N/A')}
  ROUGE-L:        {results['metrics'].get('rougeL', 'N/A')}
  BLEU:           {results['metrics'].get('bleu', 'N/A')}
  Token/s:        {results['metrics'].get('generation_time', {}).get('tokens_per_sec', 'N/A')}

SONUÇ: {"✅ BAŞARILI" if results['metrics'].get('perplexity', {}).get('mean', 999) < 50 else "⚠️ İNCELENMELİ"}
""")

if __name__ == "__main__":
    main()
