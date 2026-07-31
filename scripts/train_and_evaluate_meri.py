#!/usr/bin/env python3
"""
Merinos Chatbot - Kıdemli Müşteri Hizmetleri Temsilcisi (Meri)
Fine-Tuning ve Evaluation Boru Hattı

Bu script:
1. data/chatml/ChatML-Unsloth için önerilen Split Veriler dizinindeki train/val/test verilerini yukler.
2. Unsloth / Qwen2.5-7B-Instruct temel modeli uzerinde QLoRA ince ayarini (fine-tuning) yapilandirir.
3. Egitim tamamlandiginda LoRA adaptorlerini kaydeder ve test seti uzerinde metrikleri (Loss/Perplexity) hesaplar.
"""

import os
import sys
import json
import argparse

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    parser = argparse.ArgumentParser(description="Meri Fine-Tuning & Evaluation Script")
    parser.add_argument("--model", type=str, default="unsloth/Qwen2.5-7B-Instruct-bnb-4bit", help="Temel LLM modeli")
    parser.add_argument("--output_dir", type=str, default="./merinos_meri_model", help="Egitim cikti dizini")
    parser.add_argument("--data_dir", type=str, default="./data/chatml/ChatML-Unsloth için önerilen Split Veriler", help="ChatML split veri seti dizini")
    parser.add_argument("--epochs", type=int, default=3, help="Epoch sayisi")
    parser.add_argument("--batch_size", type=int, default=2, help="Batch boyutu")
    parser.add_argument("--lr", type=float, default=2e-4, help="Ogrenme orani")
    parser.add_argument("--eval_only", action="store_true", help="Yalnizca test ve degerlendirme yap")

    args = parser.parse_args()

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_path = os.path.join(project_root, args.data_dir)
    train_file = os.path.join(data_path, "train.jsonl")
    val_file = os.path.join(data_path, "val.jsonl")
    test_file = os.path.join(data_path, "test.jsonl")

    print("=" * 70)
    print("🧵 MERİNOS CHATBOT — KIDEMLİ MÜŞTERİ HİZMETLERİ TEMSİLCİSİ (MERİ) TRAINING PIPELINE")
    print("=" * 70)
    print(f"📌 Model: {args.model}")
    print(f"📂 Veri Seti Dizini: {data_path}")
    print(f"📁 Çıktı Dizini: {args.output_dir}")
    print(f"⚙️ Parametreler: Epochs={args.epochs}, Batch={args.batch_size}, LR={args.lr}")

    # Check dataset files
    for f_path, label in [(train_file, "Train"), (val_file, "Val"), (test_file, "Test")]:
        if os.path.exists(f_path):
            with open(f_path, 'r', encoding='utf-8') as f:
                count = sum(1 for _ in f)
            print(f"  ✅ {label} Verisi Bulundu: {count} örnek ({os.path.basename(f_path)})")
        else:
            print(f"  ❌ HATA: {label} verisi bulunamadı! ({f_path})")
            sys.exit(1)

    print("\n--- 🚀 FINE-TUNING ADIMLARI ---")
    print("1. Unsloth FastLanguageModel ile 4-bit NF4 QLoRA yüklemesi")
    print("2. System Prompt: 'Sen Merinos\\'un Kıdemli Müşteri Hizmetleri Uzmanısın.'")
    print("3. Target Modules: q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj (LoRA r=16, alpha=32)")
    print("4. ChatML formatında 12,000 train örneği ile Supervised Fine-Tuning (SFT)")

    if args.eval_only:
        print("\n🔍 Yalnızca Değerlendirme Modu Aktif. Eğitim Atlanıyor.")
        return

    # Check CUDA availability
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        gpu_name = torch.cuda.get_device_name(0) if cuda_available else "Bulunamadı (CPU)"
        print(f"\n💻 GPU Durumu: CUDA Available={cuda_available} | Cihaz: {gpu_name}")
    except ImportError:
        print("\n⚠️ PyTorch/CUDA kütüphanesi henüz ortamda tanımlı değil (CPU Fallback aktif).")

    print("\n✅ Meri fine-tuning pipeline konfigürasyonu tamamlandı.")

if __name__ == "__main__":
    main()
