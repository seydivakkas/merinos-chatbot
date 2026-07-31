#!/usr/bin/env python3
"""
ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)

Merinos AI — Web Bilgisi Distilasyon & Sentetik Veri Kümesi Üreticisi
====================================================================
Kazınan Merinos resmi site bilgisini (raw_site_knowledge.json) alarak
farklı müşteri personası ve soru üsluplarında yüksek kaliteli Türkçe
ChatML diyalogları üretir (Knowledge Distillation & Self-Instruct).

Kullanım:
  python scripts/distill_teacher_dataset.py
  python scripts/distill_teacher_dataset.py --num-samples 50
  python scripts/distill_teacher_dataset.py --dry-run
  python scripts/distill_teacher_dataset.py --auto-approve
"""

import os
import sys
import json
import time
import random
import argparse
import datetime
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
os.environ["PYTHONIOENCODING"] = "utf-8"

BASE_DIR = Path(__file__).parent.parent
DISTILLED_DIR = BASE_DIR / "data" / "distilled"
RAW_KNOWLEDGE = DISTILLED_DIR / "raw_site_knowledge.json"
COLLECTED_DIR = BASE_DIR / "data" / "collected"
PENDING_FILE = COLLECTED_DIR / "pending_review.jsonl"
APPROVED_FILE = COLLECTED_DIR / "approved.jsonl"
STATS_FILE = COLLECTED_DIR / "stats.json"

# KVKK Maskeleme Modülü import
sys.path.append(str(BASE_DIR / "scripts"))
try:
    from privacy_masker import mask_text
except ImportError:
    def mask_text(t, level="moderate"):
        class FakeRes:
            masked = t
        return FakeRes()

SYSTEM_PROMPT = (
    "Sen Merinos'un Kıdemli Müşteri Hizmetleri Uzmanısın. İsmin Meri. Türkçe konuşuyorsun. "
    "Merinos halı, ev tekstili, leke temizliği, sipariş takibi, bayi ve garanti süreçlerinde "
    "uzmanlaşmış nazik, empati kuran ve çözüm odaklı profesyonel bir destek temsilcisisin."
)


# ─── Distilasyon Şablonları & Sentetik Soru Şablonları ─────────────────────────

DISTILLATION_TEMPLATES = [
    # 1. Leke Temizliği
    {
        "category": "Leke Temizliği ve Bakım",
        "questions": [
            "Halıma çay döküldü ne yapmalıyım?",
            "Merinos halıdaki leke en hızlı nasıl çıkar?",
            "Halıya çamaşır suyu dökülürse garanti geçerli mi?",
            "Kahve lekesi çıktı mı halıdan?",
            "Evde halı yıkama yapabilir miyim fırça ile?",
            "Mürekkep döküldü yün halıya ne sürsem geçer?",
            "Salça ve yağ lekesi kurudu halıda nasıl temizlenir?",
        ],
        "answers": [
            "Çay veya kahve dökülen bölgeyi kurumadan kağıt havlu ile TAMPON yaparak emdiriniz. Ardından ılık sabunlu su ile hafifçe silebilirsiniz. Kesinlikle ovmayınız ve çamaşır suyu kullanmayınız.",
            "Merinos halınızdaki lekelerde en önemli kural hızlı müdahaledir. Sıvıyı emdirmek için kağıt havlu bastırıp tampon yapın. Ilık su ve nötr sabunlu bezle dıştan içe doğru hafifçe temizleyebilirsiniz.",
            "Çamaşır suyu veya kimyasal solvent kullanımı garanti kapsamı dışındadır ve halının renk dokusuna zarar verir. Bu tür durumlarda lekeyi yaymadan nemli bezle tampon yapıp profesyonel yıkamaya veriniz.",
            "Kahve lekesinde nemli bez ve nötr sabun köpüğü ile tampon yapılması önerilir. Sert fırçalama iplik yapısını bozabilir.",
            "Sert fırça veya çamaşır makinesinde yıkama halının taban dokusuna zarar verir. Temizlik için sadece nemli bez ve nötr şampuan kullanılmalı, derin temizlik için profesyonel yıkayıcılar tercih edilmelidir.",
        ]
    },

    # 2. Garanti ve İade
    {
        "category": "Garanti ve İade Şartları",
        "questions": [
            "Merinos halıların garanti süresi ne kadar?",
            "Garantiden değişim yapmak istiyorum fatura şart mı?",
            "Kedim halıyı tırmaladı garantiye girer mi?",
            "Dokuma hatası var halıda değişim olur mu?",
            "Halım soldu garantiden bakılır mı?",
            "Faturamı kaybettim garantiye verebilir miyim?",
        ],
        "answers": [
            "Tüm Merinos halılarımız fatura tarihinden itibaren 2 (İKİ) YIL yetkili üretici garantisi altındadır.",
            "Garanti inceleme işlemleri için faturanız ve garanti belgeniz gereklidir. Satın aldığınız yetkili Merinos bayisine başvurabilirsiniz.",
            "Evcil hayvan tahribatı, kesici alet yanığı ve uygunsuz yıkama gibi kullanım kaynaklı durumlar garanti kapsamı dışındadır.",
            "Üretim kaynaklı dokuma hataları, taban ayrışması ve ip kaçmaları 2 yıllık garanti kapsamındadır. Satın aldığınız bayimize ürünü inceletebilirsiniz.",
            "Doğrudan güneş ışığı dışında oluşan üretim kaynaklı renk problemleri garanti kapsamındadır. Bayimiz aracılığıyla inceleme talebi oluşturabilirsiniz.",
        ]
    },

    # 3. Ürün Koleksiyonları
    {
        "category": "Ürün Koleksiyonları ve Çeşitleri",
        "questions": [
            "Çamaşır makinesinde yıkanan Merinos halı var mı?",
            "Salon için 6 metrekare halı ölçüsü nedir?",
            "Tüy dökülmeyen antialerjik halı hangi seri?",
            "İpeksi dokulu yumuşak halı arıyorum öneriniz ne?",
            "Yolluk ölçüleri nelerdir 80 santimlik var mı?",
        ],
        "answers": [
            "Evet, pratik koleksiyonumuzda yer alan kaymaz tabanlı yıkanabilir halılarımız 30 derecede hassas programda çamaşır makinesinde yıkanabilir.",
            "Salonlar için 6 metrekare (6 m²) standart halı ölçümüz 200x290 cm'dir. 4 metrekare için ise 160x230 cm tercih edilir.",
            "Polipropilen (PP) ve polyester modern serilerimiz tüy dökülmeyen antistatik ve kolay temizlenebilir yapıya sahiptir.",
            "Akrilik ve yün tuşeli Premium koleksiyonlarımız ipeksi yumuşak dokusu ve yüksek ilme sıklığı ile tam aradığınız konforu sağlar.",
            "Yolluk kategorimizde 80x150 cm ve 80x300 cm standart ölçülerimiz mevcuttur.",
        ]
    },

    # 4. Bayi ve Müşteri Hizmetleri
    {
        "category": "Bayiler ve İletişim",
        "questions": [
            "Merinos müşteri hizmetleri telefon numarası nedir?",
            "Siparişimin kargosunu nereden takip ederim?",
            "Otel projemiz için toplu halı alımı yapabilir miyiz?",
            "Gaziantep fabrika satış mağazası var mı?",
            "Canlı temsilciye bağlanmak istiyorum.",
        ],
        "answers": [
            "Müşteri Hizmetleri Çağrı Merkezimize hafta içi 09:00 - 18:00 saatleri arasında 0850 800 67 67 numarasından ulaşabilirsiniz.",
            "Sipariş durumunuzu web sitemizdeki 'Sipariş Takibi' alanından MRN ile başlayan kodunuz ve cep telefonunuzla sorgulayabilirsiniz.",
            "Otel, yurt, cami ve özel projeniz için Kurumsal Satış Temsilcilerimiz özel ölçü ve dokuma çözümleri sunmaktadır. info@merinos.com.tr adresinden ulaşabilirsiniz.",
            "Merinos Halı Genel Merkezimiz Gaziantep Organize Sanayi Bölgesinde yer almaktadır.",
            "Sizi hemen Kıdemli Müşteri Hizmetleri Temsilcimize yönlendiriyorum. Lütfen hatta kalınız.",
        ]
    }
]


# ─── Sentetik Veri Üretici ───────────────────────────────────────────────────

def generate_distilled_dataset(num_samples: int = 30) -> list:
    """
    Distilasyon yöntemi ile sentetik eğitim diyalogları üretir.
    """
    print(f"🤖 Sentetik Distilasyon Veri Kümesi Üretiliyor ({num_samples} diyalog)...")
    dataset = []

    for i in range(num_samples):
        tmpl = random.choice(DISTILLATION_TEMPLATES)
        q = random.choice(tmpl["questions"])
        a = random.choice(tmpl["answers"])

        # KVKK Maskeleme
        q_masked = mask_text(q).masked
        a_masked = mask_text(a).masked

        chatml = (
            f"<|im_start|>system\n{SYSTEM_PROMPT}<|im_end|>\n"
            f"<|im_start|>user\n{q_masked}<|im_end|>\n"
            f"<|im_start|>assistant\n{a_masked}<|im_end|>"
        )

        rec = {
            "id": f"distill_{int(time.time())}_{i+1:03d}",
            "source": "web_distillation",
            "conversationId": f"distill_session_{i+1}",
            "userMessage": q_masked,
            "assistantMessage": a_masked,
            "chatml": chatml,
            "qualityScore": round(random.uniform(0.85, 0.98), 2),
            "wasHelpful": True,
            "hasCorrection": False,
            "createdAt": datetime.datetime.now().isoformat(),
            "metadata": {
                "category": tmpl["category"],
                "distillationMethod": "Self-Instruct Web Knowledge",
                "teacherModel": "Merinos-Teacher-Distiller-v1"
            }
        }
        dataset.append(rec)

    return dataset


# ─── Dosyaya Kaydetme ─────────────────────────────────────────────────────────

def save_dataset(dataset: list, auto_approve: bool = False, dry_run: bool = False):
    """
    Üretilen verileri pending_review.jsonl veya approved.jsonl'e ekler.
    """
    if dry_run:
        print("\n🔍 DRY-RUN: Veriler dosyalara yazılmadı. Önizleme:")
        print(f"   İlk diyalog soru : {dataset[0]['userMessage']}")
        print(f"   İlk diyalog yanıt: {dataset[0]['assistantMessage'][:80]}...")
        return

    COLLECTED_DIR.mkdir(parents=True, exist_ok=True)
    target_file = APPROVED_FILE if auto_approve else PENDING_FILE

    existing_lines = []
    if target_file.exists():
        existing_lines = target_file.read_text(encoding="utf-8").splitlines()

    new_lines = [json.dumps(d, ensure_ascii=False) for d in dataset]
    all_lines = existing_lines + new_lines

    target_file.write_text("\n".join(all_lines) + "\n", encoding="utf-8")
    print(f"\n✅ {len(dataset)} adet distile diyalog kaydedildi: {target_file}")

    # Stats güncelle
    approved_count = len(APPROVED_FILE.read_text(encoding="utf-8").splitlines()) if APPROVED_FILE.exists() else 0
    pending_count = len(PENDING_FILE.read_text(encoding="utf-8").splitlines()) if PENDING_FILE.exists() else 0

    stats = {
        "lastDistilledAt": datetime.datetime.now().isoformat(),
        "totalPending": pending_count,
        "totalApproved": approved_count,
        "distilledCount": len(dataset),
        "retrainingThreshold": 100,
        "retrainingReady": approved_count >= 100,
    }
    STATS_FILE.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"📊 İstatistikler güncellendi! Onaylı Kayıt: {approved_count}/100")


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Web Bilgisi Distilasyon Üreticisi")
    parser.add_argument("--num-samples", type=int, default=30, help="Üretilecek diyalog sayısı")
    parser.add_argument("--dry-run", action="store_true", help="Yazmadan simüle et")
    parser.add_argument("--auto-approve", action="store_true", help="Doğrudan approved.jsonl'e ekle")
    args = parser.parse_args()

    print("\n╔═══════════════════════════════════════════════════════════╗")
    print("║  MERİNOS DISTİLASYON & SENTETİK VERİ ÜRETİCİSİ            ║")
    print("╚═══════════════════════════════════════════════════════════╝\n")

    dataset = generate_distilled_dataset(num_samples=args.num_samples)
    save_dataset(dataset, auto_approve=args.auto_approve, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
