#!/usr/bin/env python3
"""
================================================================================
MERINOS A/B BENCHMARK: Fine-tuned vs Base Model
================================================================================
Aynı test seti üzerinde fine-tuned model ve base model'i karşılaştır.
Hakem: Gemma-2-9B (farklı aile = tarafsız)

Kullanım:
    python benchmark_vs_baseline.py \
        --fine_tuned ./merinos_7b_8gb/lora_adapters \
        --base unsloth/Qwen2.5-7B-Instruct-bnb-4bit \
        --judge unsloth/gemma-2-9b-it-bnb-4bit \
        --test_data ./split/chatml/test.jsonl \
        --max_samples 100
================================================================================
"""

import argparse
import json
import random
import time
import torch
from datasets import load_dataset
from unsloth import FastLanguageModel
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fine_tuned", type=str, required=True, help="Fine-tuned LoRA path")
    parser.add_argument("--base", type=str, required=True, help="Base model")
    parser.add_argument("--judge", type=str, default="unsloth/gemma-2-9b-it-bnb-4bit",
                        help="Hakem modeli (farklı aile önerilir)")
    parser.add_argument("--test_data", type=str, default="./split/chatml/test.jsonl")
    parser.add_argument("--max_samples", type=int, default=100,
                        help="Karşılaştırılacak örnek sayısı (100 önerilir)")
    parser.add_argument("--output", type=str, default="./benchmark_results.json")
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def load_model(model_path, base_model=None):
    """Model yükle."""
    if base_model:
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=base_model, max_seq_length=2048, dtype=None, load_in_4bit=True,
        )
        model = FastLanguageModel.get_peft_model(model)
        model.load_adapter(model_path)
    else:
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=model_path, max_seq_length=2048, dtype=None, load_in_4bit=True,
        )
    FastLanguageModel.for_inference(model)
    return model, tokenizer


def generate(model, tokenizer, messages, max_tokens=256):
    """Yanıt üret."""
    inputs = tokenizer.apply_chat_template(
        messages, tokenize=True, return_tensors="pt", add_generation_prompt=True
    ).to("cuda")
    with torch.no_grad():
        outputs = model.generate(
            input_ids=inputs, max_new_tokens=max_tokens,
            temperature=0.7, top_p=0.9, use_cache=True,
            pad_token_id=tokenizer.eos_token_id,
        )
    return tokenizer.decode(outputs[0][inputs.shape[1]:], skip_special_tokens=True).strip()


def judge_compare(judge_model, judge_tokenizer, question, resp_a, resp_b, model_a_name, model_b_name):
    """Hakem: hangi yanıt daha iyi?"""
    prompt = f"""Aşağıdaki soruya verilen iki yanıtı karşılaştırın.

Soru: {question}

[{model_a_name}]:
{resp_a}

[{model_b_name}]:
{resp_b}

Hangi yanıt daha doğru, daha yardımcı ve daha profesyonel? Sadece şu formatta yanıt verin:
KAZANAN: A veya B
SKOR_FARKI: 0.0 ile 1.0 arasında (0=eşdeğer, 1=birisi çok üstün)
GEREKCE: Tek cümlelik açıklama"""

    messages = [{"role": "user", "content": prompt}]
    inputs = judge_tokenizer.apply_chat_template(
        messages, tokenize=True, return_tensors="pt", add_generation_prompt=True
    ).to("cuda")

    with torch.no_grad():
        outputs = judge_model.generate(
            input_ids=inputs, max_new_tokens=100, temperature=0.2, top_p=0.9,
        )

    return judge_tokenizer.decode(outputs[0][inputs.shape[1]:], skip_special_tokens=True).strip()


def parse_judge_response(response):
    """Hakem yanıtını parse et."""
    winner = None
    score_diff = 0.0

    for line in response.split("\n"):
        line = line.strip().upper()
        if "KAZANAN:" in line:
            if "A" in line:
                winner = "A"
            elif "B" in line:
                winner = "B"
        elif "SKOR_FARKI:" in line or "SKOR:" in line:
            try:
                score_diff = float(line.split(":")[-1].strip().replace(",", "."))
            except:
                pass

    return winner, min(max(score_diff, 0.0), 1.0)


def main():
    args = parse_args()
    random.seed(args.seed)

    print("=" * 70)
    print("⚔️  MERINOS A/B BENCHMARK")
    print("=" * 70)
    print(f"Fine-tuned: {args.fine_tuned}")
    print(f"Base:       {args.base}")
    print(f"Hakem:      {args.judge}")
    print(f"Örnek:      {args.max_samples}")
    print("=" * 70)

    # 1. Modelleri yükle
    print("\n📥 Modeller yükleniyor...")
    ft_model, ft_tokenizer = load_model(args.fine_tuned, args.base)
    base_model, base_tokenizer = load_model(args.base, None)
    judge_model, judge_tokenizer = load_model(args.judge, None)
    print("  ✅ Tüm modeller hazır")

    # 2. Test verisi
    print("\n📚 Test verisi yükleniyor...")
    test_data = load_dataset("json", data_files={"test": args.test_data})["test"]

    # Rastgele örnek seç
    indices = random.sample(range(len(test_data)), min(args.max_samples, len(test_data)))
    print(f"  ✅ {len(indices)} örnek seçildi")

    # 3. Karşılaştırma
    results = {
        "fine_tuned": args.fine_tuned,
        "base": args.base,
        "judge": args.judge,
        "total_samples": len(indices),
        "comparisons": [],
        "summary": {},
    }

    ft_wins = 0
    base_wins = 0
    ties = 0
    total_score_diff = 0.0

    print("\n🔄 Karşılaştırma başlıyor...")
    for i, idx in enumerate(indices):
        example = test_data[idx]
        messages = example.get("messages", [])
        if not messages:
            continue

        # Input ve reference ayır
        reference = ""
        input_messages = []
        for msg in messages:
            if msg["role"] == "assistant" and not reference:
                reference = msg["content"]
            else:
                input_messages.append(msg)

        if not reference or not input_messages:
            continue

        question = input_messages[-1]["content"] if input_messages else ""

        # Her iki modelden yanıt al
        t0 = time.time()
        ft_resp = generate(ft_model, ft_tokenizer, input_messages)
        ft_time = time.time() - t0

        t0 = time.time()
        base_resp = generate(base_model, base_tokenizer, input_messages)
        base_time = time.time() - t0

        # Hakem değerlendirmesi
        # %50 ihtimalle A/B yer değiştir (position bias önleme)
        swap = random.random() < 0.5
        if swap:
            judge_result = judge_compare(
                judge_model, judge_tokenizer, question,
                base_resp, ft_resp, "BASE", "FINE_TUNED"
            )
            winner, score_diff = parse_judge_response(judge_result)
            if winner == "A":
                winner = "BASE"
            elif winner == "B":
                winner = "FINE_TUNED"
        else:
            judge_result = judge_compare(
                judge_model, judge_tokenizer, question,
                ft_resp, base_resp, "FINE_TUNED", "BASE"
            )
            winner, score_diff = parse_judge_response(judge_result)
            if winner == "A":
                winner = "FINE_TUNED"
            elif winner == "B":
                winner = "BASE"

        if winner == "FINE_TUNED":
            ft_wins += 1
        elif winner == "BASE":
            base_wins += 1
        else:
            ties += 1

        total_score_diff += score_diff

        results["comparisons"].append({
            "index": idx,
            "question": question,
            "reference": reference,
            "fine_tuned_response": ft_resp,
            "base_response": base_resp,
            "fine_tuned_time_sec": round(ft_time, 2),
            "base_time_sec": round(base_time, 2),
            "judge_raw": judge_result,
            "winner": winner,
            "score_diff": round(score_diff, 3),
        })

        if (i + 1) % 10 == 0:
            print(f"  📊 {i+1}/{len(indices)} | FT: {ft_wins} | Base: {base_wins} | Berabere: {ties}")

    # 4. Özet
    n = len(results["comparisons"])
    if n > 0:
        results["summary"] = {
            "total_compared": n,
            "fine_tuned_wins": ft_wins,
            "base_wins": base_wins,
            "ties": ties,
            "fine_tuned_win_rate": round(ft_wins / n, 3),
            "base_win_rate": round(base_wins / n, 3),
            "tie_rate": round(ties / n, 3),
            "avg_score_diff": round(total_score_diff / n, 3),
            "improvement": "✅ Fine-tuned daha iyi" if ft_wins > base_wins else (
                "❌ Base daha iyi" if base_wins > ft_wins else "⚖️ Berabere"
            ),
        }

    # 5. Kaydet
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # 6. Rapor
    print("\n" + "=" * 70)
    print("📊 BENCHMARK SONUÇLARI")
    print("=" * 70)
    s = results["summary"]
    print(f"""
Toplam karşılaştırma: {s['total_compared']}

🏆 KAZANAN DAĞILIMI:
   Fine-tuned kazandı:  {s['fine_tuned_wins']} ({s['fine_tuned_win_rate']*100:.1f}%)
   Base kazandı:        {s['base_wins']} ({s['base_win_rate']*100:.1f}%)
   Berabere:            {s['ties']} ({s['tie_rate']*100:.1f}%)

📈 METRIKLER:
   Ortalama skor farkı: {s['avg_score_diff']:.3f}
   Sonuç:               {s['improvement']}

🎯 YORUM:
   {"Fine-tune BAŞARILI! Model domain'e adapte olmuş." if s['fine_tuned_win_rate'] > 0.55 else
    "Fine-tune BAŞARISIZ. Base model daha iyi veya eşdeğer." if s['fine_tuned_win_rate'] < 0.45 else
    "Fine-tune MARJINAL. Daha fazla veri veya epoch gerekebilir."}
""")
    print(f"\n💾 Detaylı sonuçlar: {args.output}")

if __name__ == "__main__":
    main()
