#!/usr/bin/env python3
"""
ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)

Meri Sürekli Öğrenme — Otomatik Yeniden Eğitim Pipeline'ı
==========================================================
Onaylanmış eğitim verisi belirli bir eşiği aştığında Unsloth QLoRA
fine-tuning'i otomatik başlatır, yeni adaptör sürümünü kaydeder ve
çalışan inference sunucusunu sıcak (hot-swap) olarak günceller.

Kullanım:
    python scripts/auto_retrain.py                    # Normal kontrol
    python scripts/auto_retrain.py --dry-run          # Simülasyon (eğitim yok)
    python scripts/auto_retrain.py --force            # Eşik beklemeden zorla
    python scripts/auto_retrain.py --threshold 50     # Özel eşik
    python scripts/auto_retrain.py --eval-only        # Sadece değerlendirme
"""

import os
import sys
import json
import time
import shutil
import argparse
import datetime
import subprocess
from pathlib import Path

# Windows terminali için UTF-8 stdout zorla
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
os.environ["PYTHONIOENCODING"] = "utf-8"


# ─── Yapılandırma ──────────────────────────────────────────────────────────────

BASE_DIR        = Path(__file__).parent.parent
COLLECTED_DIR   = BASE_DIR / "data" / "collected"
APPROVED_FILE   = COLLECTED_DIR / "approved.jsonl"
STATS_FILE      = COLLECTED_DIR / "stats.json"
RUNS_FILE       = COLLECTED_DIR / "training_runs.jsonl"
MODEL_BASE_DIR  = BASE_DIR / "merinos_meri_model"
ADAPTERS_STABLE = MODEL_BASE_DIR / "lora_adapters"
INFERENCE_PID_FILE = BASE_DIR / ".inference_server.pid"

BASE_MODEL_NAME = "unsloth/Qwen2.5-7B-Instruct-bnb-4bit"
DEFAULT_THRESHOLD = 100      # Kaç onaylı kayıtta eğitim tetiklensin
DEFAULT_MAX_STEPS = 500      # QLoRA eğitim adımı
DEFAULT_BATCH_SIZE = 2
DEFAULT_GRAD_ACCUM = 4
DEFAULT_LORA_RANK = 16
DEFAULT_LR = 2e-4

SYSTEM_PROMPT = (
    "Sen Merinos'un Kidemli Musteri Hizmetleri Uzmanisın. "
    "Ismin Meri. Turkce konusuyorsun. "
    "Merinos hali, ev tekstili, leke temizligi, siparis takibi, "
    "bayi ve garanti sureclerinde uzmanlasmis nazik, empati kuran "
    "ve cozum odakli profesyonel bir destek temsilcisisin."
)


# ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

def log(msg: str, level: str = "INFO"):
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    prefix = {"INFO": "ℹ️ ", "OK": "✅", "WARN": "⚠️ ", "ERR": "❌", "STEP": "🔹"}.get(level, "  ")
    print(f"[{ts}] {prefix} {msg}", flush=True)


def read_jsonl(path: Path) -> list:
    if not path.exists():
        return []
    records = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return records


def write_jsonl(path: Path, records: list):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def get_next_version() -> str:
    """Varolan sürüm klasörlerine bakarak sıradaki sürüm numarasını döndürür."""
    existing = [
        d for d in MODEL_BASE_DIR.iterdir()
        if d.is_dir() and d.name.startswith("lora_adapters_v")
    ]
    version_nums = []
    for d in existing:
        try:
            version_nums.append(int(d.name.replace("lora_adapters_v", "")))
        except ValueError:
            pass
    next_num = max(version_nums, default=1) + 1
    return f"v{next_num}"


def check_inference_server() -> bool:
    """localhost:8000/health endpoint'ini kontrol eder."""
    import urllib.request
    try:
        req = urllib.request.urlopen("http://localhost:8000/health", timeout=3)
        data = json.loads(req.read())
        return data.get("ok", False)
    except Exception:
        return False


def hot_swap_adapter(new_adapter_dir: Path, dry_run: bool = False) -> bool:
    """
    Çalışan inference_server.py sürecine yeni LoRA adaptörünü sıcak yükletir.
    Sunucu hot-swap için POST /reload_adapter endpoint'ini kullanır.
    """
    import urllib.request
    body = json.dumps({
        "adapter_path": str(new_adapter_dir),
        "version": new_adapter_dir.name
    }).encode("utf-8")

    if dry_run:
        log(f"DRY-RUN: POST http://localhost:8000/reload_adapter -> {new_adapter_dir.name}", "STEP")
        return True

    try:
        req = urllib.request.Request(
            "http://localhost:8000/reload_adapter",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        res = urllib.request.urlopen(req, timeout=30)
        result = json.loads(res.read())
        if result.get("ok"):
            log(f"Sıcak adaptör değişimi başarılı: {result.get('version')}", "OK")
            return True
    except Exception as e:
        log(f"Hot-swap endpoint erişilemedi: {e} — Manuel yeniden başlatma gerekebilir.", "WARN")

    # Fallback: lora_adapters/ sembolik bağlantısını güncelle
    log("Fallback: lora_adapters/ dizini güncelleniyor...", "STEP")
    if ADAPTERS_STABLE.exists():
        backup = MODEL_BASE_DIR / f"lora_adapters_backup_{int(time.time())}"
        shutil.move(str(ADAPTERS_STABLE), str(backup))
        log(f"Eski adaptör yedeklendi: {backup.name}", "INFO")

    shutil.copytree(str(new_adapter_dir), str(ADAPTERS_STABLE))
    log(f"Yeni adaptör kopyalandı → lora_adapters/", "OK")
    return True


# ─── Eğitim Verisi Hazırlama ──────────────────────────────────────────────────

def prepare_training_file(approved_records: list, output_path: Path) -> int:
    """
    Onaylı JSONL kayıtlarını Unsloth beklediği formata dönüştürür.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    count = 0

    with open(output_path, "w", encoding="utf-8") as f:
        for rec in approved_records:
            user_msg = rec.get("userMessage", "").strip()
            asst_msg = rec.get("assistantMessage", "").strip()

            if not user_msg or not asst_msg:
                continue
            if len(asst_msg) < 10:
                continue

            chatml = (
                f"<|im_start|>system\n{SYSTEM_PROMPT}<|im_end|>\n"
                f"<|im_start|>user\n{user_msg}<|im_end|>\n"
                f"<|im_start|>assistant\n{asst_msg}<|im_end|>"
            )

            entry = {
                "text": chatml,
                "source": rec.get("source", "unknown"),
                "quality": rec.get("qualityScore", 0.5),
            }
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            count += 1

    return count


# ─── QLoRA Fine-Tuning ────────────────────────────────────────────────────────

def run_qlora_finetuning(
    train_file: Path,
    output_dir: Path,
    max_steps: int,
    dry_run: bool,
) -> bool:
    """
    Unsloth QLoRA fine-tuning script'ini Python API üzerinden çalıştırır.
    """
    if dry_run:
        log(f"DRY-RUN: QLoRA eğitimi simüle ediliyor ({max_steps} adım)", "STEP")
        time.sleep(2)
        output_dir.mkdir(parents=True, exist_ok=True)
        # Sahte adaptör dosyaları oluştur
        (output_dir / "adapter_config.json").write_text(
            json.dumps({"base_model_name_or_path": BASE_MODEL_NAME, "r": DEFAULT_LORA_RANK}),
            encoding="utf-8"
        )
        (output_dir / "README.md").write_text(
            f"# Meri QLoRA {output_dir.name} (Dry-Run)\nOluşturuldu: {datetime.datetime.now().isoformat()}",
            encoding="utf-8"
        )
        log("DRY-RUN tamamlandı, sahte adaptör dosyaları oluşturuldu.", "OK")
        return True

    log("Unsloth QLoRA fine-tuning başlatılıyor...", "STEP")

    # Unsloth inline fine-tuning betiği
    train_script = f"""
import sys
import os
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

try:
    from unsloth import FastLanguageModel
    from trl import SFTTrainer
    from transformers import TrainingArguments
    from datasets import load_dataset
    import torch

    print("[1/4] Model yukleniyor...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name="{BASE_MODEL_NAME}",
        max_seq_length=1024,
        load_in_4bit=True,
        dtype=None,
    )

    print("[2/4] LoRA adaptoru ekleniyor (r={DEFAULT_LORA_RANK})...")
    model = FastLanguageModel.get_peft_model(
        model,
        r={DEFAULT_LORA_RANK},
        target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"],
        lora_alpha={DEFAULT_LORA_RANK * 2},
        lora_dropout=0.05,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=42,
    )

    print("[3/4] Veri seti yukleniyor...")
    dataset = load_dataset("json", data_files="{str(train_file).replace(chr(92), '/')}", split="train")

    EOS_TOKEN = tokenizer.eos_token
    def format_sample(sample):
        return {{"text": sample["text"] + EOS_TOKEN}}
    dataset = dataset.map(format_sample)

    print("[4/4] Egitim baslatiliyor ({max_steps} adim)...")
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=1024,
        dataset_num_proc=2,
        packing=True,
        args=TrainingArguments(
            per_device_train_batch_size={DEFAULT_BATCH_SIZE},
            gradient_accumulation_steps={DEFAULT_GRAD_ACCUM},
            warmup_steps=30,
            max_steps={max_steps},
            learning_rate={DEFAULT_LR},
            fp16=not torch.cuda.is_bf16_supported(),
            bf16=torch.cuda.is_bf16_supported(),
            logging_steps=25,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="cosine",
            seed=42,
            output_dir="{str(output_dir).replace(chr(92), '/')}",
        ),
    )

    trainer_stats = trainer.train()
    print(f"Egitim tamamlandi. Son kayip: {{trainer_stats.training_loss:.4f}}")

    model.save_pretrained("{str(output_dir).replace(chr(92), '/')}")
    tokenizer.save_pretrained("{str(output_dir).replace(chr(92), '/')}")
    print("Adaptor kaydedildi: {str(output_dir)}")

except ImportError as e:
    print(f"HATA: Gerekli kutuphane eksik: {{e}}")
    print("Cozum: pip install unsloth trl datasets transformers")
    sys.exit(1)
"""

    script_file = BASE_DIR / "scripts" / "_temp_retrain.py"
    script_file.write_text(train_script, encoding="utf-8")

    try:
        result = subprocess.run(
            [sys.executable, str(script_file)],
            capture_output=False,
            text=True,
            timeout=3600,  # Max 1 saat
        )
        script_file.unlink(missing_ok=True)
        if result.returncode == 0:
            log("QLoRA fine-tuning başarıyla tamamlandı.", "OK")
            return True
        else:
            log(f"Eğitim başarısız. Çıkış kodu: {result.returncode}", "ERR")
            return False
    except subprocess.TimeoutExpired:
        log("Eğitim zaman aşımına uğradı (1 saat).", "ERR")
        return False
    except Exception as e:
        log(f"Eğitim sırasında beklenmeyen hata: {e}", "ERR")
        return False


# ─── Ana Pipeline ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Meri Otomatik Yeniden Eğitim Pipeline")
    parser.add_argument("--dry-run", action="store_true", help="Eğitim simüle edilir, dosyalara yazılmaz")
    parser.add_argument("--force", action="store_true", help="Eşik beklemeden eğitimi başlat")
    parser.add_argument("--threshold", type=int, default=DEFAULT_THRESHOLD, help="Eğitim tetikleme eşiği")
    parser.add_argument("--max-steps", type=int, default=DEFAULT_MAX_STEPS, help="QLoRA eğitim adım sayısı")
    parser.add_argument("--eval-only", action="store_true", help="Sadece mevcut durum değerlendirmesi")
    args = parser.parse_args()

    print("\n╔══════════════════════════════════════════════════════════════╗")
    print("║  MERİ SÜREKLİ ÖĞRENME — OTOMATİK YENİDEN EĞİTİM PIPELINE  ║")
    print("╚══════════════════════════════════════════════════════════════╝\n")
    print(f"  Mod          : {'DRY-RUN' if args.dry_run else ('EVAL-ONLY' if args.eval_only else 'CANLI')}")
    print(f"  Eşik         : {args.threshold} onaylı kayıt")
    print(f"  Eğitim Adımı : {args.max_steps}")
    print()

    # ── 1. Onaylı veri sayısını kontrol et ──────────────────────────────────
    approved_records = read_jsonl(APPROVED_FILE)
    approved_count = len(approved_records)
    log(f"Onaylı kayıt sayısı: {approved_count} / {args.threshold}", "INFO")

    # İstatistik güncelle
    if STATS_FILE.exists():
        try:
            stats = json.loads(STATS_FILE.read_text(encoding="utf-8"))
        except Exception:
            stats = {}
    else:
        stats = {}
    stats["lastCheckedAt"] = datetime.datetime.now().isoformat()
    stats["totalApproved"] = approved_count
    stats["retrainingReady"] = approved_count >= args.threshold

    if args.eval_only:
        print(f"\n{'═'*60}")
        print(f"  DURUM DEĞERLENDİRMESİ")
        print(f"  Onaylı Kayıt     : {approved_count}")
        print(f"  Eğitim Eşiği     : {args.threshold}")
        print(f"  Eğitime Hazır    : {'✅ EVET' if stats['retrainingReady'] else '⏳ Hayır'}")
        infer_ok = check_inference_server()
        print(f"  Inference Sunucu : {'✅ Çalışıyor' if infer_ok else '❌ Kapalı'}")
        if infer_ok:
            import urllib.request
            try:
                health = json.loads(urllib.request.urlopen("http://localhost:8000/health", timeout=3).read())
                print(f"  Aktif Adaptör    : {health.get('adapter', 'bilinmiyor')}")
                print(f"  GPU              : {health.get('gpu', 'bilinmiyor')}")
            except Exception:
                pass
        print(f"{'═'*60}\n")

        # Son eğitim koşusunu göster
        runs = read_jsonl(RUNS_FILE)
        if runs:
            last = runs[-1]
            print(f"  Son Eğitim: {last.get('completedAt', '?')}")
            print(f"  Versiyon  : {last.get('version', '?')}")
            print(f"  Kayıp     : {last.get('finalLoss', '?')}")
        STATS_FILE.parent.mkdir(parents=True, exist_ok=True)
        STATS_FILE.write_text(json.dumps(stats, indent=2, ensure_ascii=False), encoding="utf-8")
        return

    # ── 2. Eşik kontrolü ────────────────────────────────────────────────────
    if not args.force and approved_count < args.threshold:
        log(f"Eşik henüz aşılmadı ({approved_count}/{args.threshold}). Eğitim ertelendi.", "WARN")
        log(f"Eksik kayıt: {args.threshold - approved_count} — Daha fazla onay bekleyin.", "INFO")
        STATS_FILE.write_text(json.dumps(stats, indent=2, ensure_ascii=False), encoding="utf-8")
        return

    if approved_count == 0:
        log("Onaylı veri yok. Lütfen Admin Panel'den kayıtları onaylayın.", "ERR")
        return

    log(f"{'FORCE modu aktif! ' if args.force else ''}Eğitim başlatılıyor...", "STEP")

    # ── 3. Yeni sürüm dizini oluştur ────────────────────────────────────────
    version = get_next_version()
    new_adapter_dir = MODEL_BASE_DIR / f"lora_adapters_{version}"
    log(f"Yeni adaptör dizini: {new_adapter_dir}", "INFO")

    # ── 4. Eğitim dosyasını hazırla ─────────────────────────────────────────
    train_file = COLLECTED_DIR / f"train_{version}.jsonl"
    record_count = prepare_training_file(approved_records, train_file)
    log(f"Eğitim dosyası hazır: {record_count} geçerli kayıt → {train_file.name}", "OK")

    if record_count < 10:
        log("Çok az geçerli kayıt (< 10). Eğitim iptal edildi.", "ERR")
        return

    # ── 5. QLoRA Fine-Tuning çalıştır ───────────────────────────────────────
    start_time = time.time()
    success = run_qlora_finetuning(train_file, new_adapter_dir, args.max_steps, args.dry_run)
    elapsed = time.time() - start_time

    run_log = {
        "version": version,
        "startedAt": datetime.datetime.fromtimestamp(start_time).isoformat(),
        "completedAt": datetime.datetime.now().isoformat(),
        "elapsedSec": round(elapsed),
        "recordsUsed": record_count,
        "maxSteps": args.max_steps,
        "dryRun": args.dry_run,
        "success": success,
        "adapterDir": str(new_adapter_dir),
        "finalLoss": None,  # TODO: Eğitim betiğinden parse edilebilir
    }

    if not success:
        log("Eğitim başarısız. Eski adaptör korunuyor.", "ERR")
        run_log["note"] = "Eğitim başarısız"
        runs = read_jsonl(RUNS_FILE)
        runs.append(run_log)
        write_jsonl(RUNS_FILE, runs)
        return

    log(f"Eğitim tamamlandı: {elapsed:.0f} saniye, {record_count} kayıt kullanıldı", "OK")

    # ── 6. Hot-swap: Çalışan inference sunucusunu güncelle ──────────────────
    if check_inference_server():
        log("Inference sunucusu çalışıyor, sıcak adaptör değişimi yapılıyor...", "STEP")
        hot_swap_adapter(new_adapter_dir, dry_run=args.dry_run)
    else:
        log("Inference sunucusu kapalı. Adaptör dosyaları güncellendi.", "WARN")
        if not args.dry_run:
            hot_swap_adapter(new_adapter_dir, dry_run=False)

    # ── 7. Onaylı veriyi arşivle (bir daha kullanılmasın) ───────────────────
    if not args.dry_run:
        archived_file = COLLECTED_DIR / f"archived_{version}.jsonl"
        shutil.copy(str(APPROVED_FILE), str(archived_file))
        APPROVED_FILE.write_text("", encoding="utf-8")  # Temizle
        log(f"Onaylı veriler arşivlendi: {archived_file.name}", "OK")

    # ── 8. Eğitim koşusunu kaydet ────────────────────────────────────────────
    runs = read_jsonl(RUNS_FILE)
    runs.append(run_log)
    write_jsonl(RUNS_FILE, runs)

    # İstatistik güncelle
    stats["lastTrainedAt"] = datetime.datetime.now().isoformat()
    stats["lastVersion"] = version
    stats["totalRuns"] = len(runs)
    STATS_FILE.write_text(json.dumps(stats, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\n{'═'*60}")
    print(f"  🎉 YENİDEN EĞİTİM TAMAMLANDI!")
    print(f"  Yeni Sürüm   : Meri QLoRA {version}")
    print(f"  Süre         : {elapsed:.0f} saniye")
    print(f"  Kullanılan   : {record_count} onaylı diyalog")
    print(f"  Adaptör Dizini: {new_adapter_dir.name}/")
    print(f"  Bir sonraki kontrol: {args.threshold} onaylı kayıt birikmesini bekleyin.")
    print(f"{'═'*60}\n")


if __name__ == "__main__":
    main()
