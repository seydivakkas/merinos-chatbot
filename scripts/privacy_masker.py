#!/usr/bin/env python3
"""
ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)

KVKK Gelişmiş Gizlilik Maskeleme Motoru
========================================
Türkiye Kişisel Verilerin Korunması Kanunu (KVKK/GDPR) uyumlu
kişisel veri maskeleme modülü.

Desteklenen Veri Türleri:
  - TC Kimlik Numarası (Luhn benzeri doğrulama ile)
  - Türk cep/sabit hat telefon numaraları (10+ format)
  - E-posta adresleri
  - IBAN numaraları (TR + uluslararası)
  - Kredi kartı numaraları (Luhn doğrulama)
  - Ad-Soyad (Türkçe NER kuralları)
  - Türk posta adresleri (Sokak/Cad/Mah/Apt)
  - Sipariş/referans numaraları (MRN-XXXXXXXX vb.)
  - Araç plakaları (Türk plaka formatı)
  - Doğum tarihleri

Kullanım:
  # Modül olarak:
  from scripts.privacy_masker import mask_text, MaskingResult
  result = mask_text("TC: 12345678901, Tel: 0532 123 45 67")

  # CLI olarak:
  python scripts/privacy_masker.py "TC: 12345678901"
  python scripts/privacy_masker.py --file data/collected/pending_review.jsonl
  python scripts/privacy_masker.py --test
  python scripts/privacy_masker.py --level strict "metin..."
"""

import os
import re
import sys
import json
import time
import hashlib
import argparse
import datetime
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# Windows terminal UTF-8
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
os.environ["PYTHONIOENCODING"] = "utf-8"


# ─── Maskeleme Etiketleri ─────────────────────────────────────────────────────

MASKS = {
    "tc":       "[TC_GIZLI]",
    "phone":    "[TEL_GIZLI]",
    "email":    "[EPOSTA_GIZLI]",
    "iban":     "[IBAN_GIZLI]",
    "card":     "[KART_GIZLI]",
    "name":     "[ISIM_GIZLI]",
    "address":  "[ADRES_GIZLI]",
    "order":    "[SIPARIS_GIZLI]",
    "plate":    "[PLAKA_GIZLI]",
    "dob":      "[DOGUM_GIZLI]",
    "generic":  "[GIZLI]",
}

MASKING_LEVELS = ("lenient", "moderate", "strict")


# ─── TC Kimlik Doğrulama ─────────────────────────────────────────────────────

def _validate_tc(tc: str) -> bool:
    """
    TC Kimlik No doğrulaması:
    - 11 haneli, ilk hane sıfır olamaz
    - 1-9. basamakların toplamının % 10'u = 10. basamak
    - Tüm basamakların toplamının % 10'u = 11. basamak
    """
    if not tc.isdigit() or len(tc) != 11:
        return False
    if tc[0] == "0":
        return False
    digits = [int(d) for d in tc]
    # 10. hane kontrolü
    odd_sum = sum(digits[i] for i in range(0, 9, 2))   # 1,3,5,7,9. basamaklar
    even_sum = sum(digits[i] for i in range(1, 8, 2))  # 2,4,6,8. basamaklar
    digit10 = ((odd_sum * 7) - even_sum) % 10
    if digit10 != digits[9]:
        return False
    # 11. hane kontrolü
    digit11 = sum(digits[:10]) % 10
    return digit11 == digits[10]


# ─── Luhn Algoritması (Kredi Kartı) ──────────────────────────────────────────

def _luhn_check(number: str) -> bool:
    digits = [int(d) for d in number if d.isdigit()]
    if len(digits) < 13:
        return False
    total = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


# ─── Regex Kalıpları ──────────────────────────────────────────────────────────

# TC Kimlik No
TC_PATTERN = re.compile(r"\b([1-9]\d{10})\b")

# Telefon numaraları (Türkiye)
PHONE_PATTERNS = [
    # Boşluk/tire ayraçlı cep: 0532 123 45 67 / 0532-123-45-67
    re.compile(r"\b(0[5][0-9]{2}[\s\-\.]?\d{3}[\s\-\.]?\d{2}[\s\-\.]?\d{2})\b"),
    # Uluslararası format: +90 532 123 45 67
    re.compile(r"(\+90[\s\-\.]?[5][0-9]{2}[\s\-\.]?\d{3}[\s\-\.]?\d{2}[\s\-\.]?\d{2})"),
    # Şehir kodu sabit hat: 0312 123 45 67
    re.compile(r"\b(0[2-4]\d{2}[\s\-\.]?\d{3}[\s\-\.]?\d{2}[\s\-\.]?\d{2})\b"),
    # Kısa format (parantezli): (0532) 123 45 67
    re.compile(r"\(0[5][0-9]{2}\)[\s\-\.]?\d{3}[\s\-\.]?\d{2}[\s\-\.]?\d{2}"),
]

# E-posta
EMAIL_PATTERN = re.compile(
    r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b", re.IGNORECASE
)

# IBAN (TR + global)
IBAN_PATTERN = re.compile(
    r"\b(TR\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{2}|"
    r"[A-Z]{2}\d{2}[\s\-]?(?:[A-Z0-9]{4}[\s\-]?){2,7}[A-Z0-9]{1,4})\b",
    re.IGNORECASE,
)

# Kredi kartı (13-19 hane, boşluk/tire ayraçlı)
CARD_PATTERN = re.compile(
    r"\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{1,4}[\s\-]?\d{0,4})\b"
)

# Türk araç plakaları: 34 ABC 1234 / 06 A 1234
PLATE_PATTERN = re.compile(
    r"\b(0[1-9]|[1-7]\d|80|81)\s?[A-Z]{1,3}\s?\d{2,4}\b", re.IGNORECASE
)

# Doğum tarihleri: 01.01.1990 / 1990-01-01 / 01/01/1990
DOB_PATTERN = re.compile(
    r"\b(\d{1,2}[./\-]\d{1,2}[./\-](19|20)\d{2}|(19|20)\d{2}[./\-]\d{1,2}[./\-]\d{1,2})\b"
)

# Sipariş/referans numaraları
ORDER_PATTERNS = [
    re.compile(r"\bMRN[-\s]?\d{5,12}\b", re.IGNORECASE),
    re.compile(r"\b[A-Z]{2,4}[-]?\d{8,12}\b"),  # Genel referans kodu
]

# Adres kalıpları (Türkçe)
ADDRESS_PATTERNS = [
    re.compile(
        r"[A-ZÇĞİÖŞÜa-zçğışöşü\s]+\s+(Sokak|Sok\.|Caddesi|Cad\.|Bulvarı|Blv\.|"
        r"Mahallesi|Mah\.|Apartmanı|Apt\.|No[:.]?\s*\d+|Kat\s*\d+|Daire\s*\d+)",
        re.IGNORECASE | re.UNICODE,
    ),
    re.compile(
        r"(Posta Kodu|PostaKodu)[\s:]+\d{5}\b", re.IGNORECASE
    ),
    re.compile(r"\b\d{5}\b(?=\s+[A-ZÇĞİÖŞÜ])", re.UNICODE),  # Posta kodu (5 hane + şehir)
]

# Ad-Soyad (prefix + ad-soyad birlikte yakalanır, sonra prefix korunur)
NAME_PREFIX_FULL = re.compile(
    r"((?:Bay|Bayan|Sayın|Müşteri|Müşterimiz|Adı|Soyadı|Ad Soyad|İsim)[\s:]+)"
    r"([A-ZÇĞİÖŞÜ][a-zçğışöşü]{1,15}(?:\s+[A-ZÇĞİÖŞÜ][a-zçğışöşü]{1,15}){1,2})",
    re.UNICODE,
)


# ─── Maskeleme Sonucu ─────────────────────────────────────────────────────────

@dataclass
class MaskingResult:
    original: str
    masked: str
    total_masks: int = 0
    by_type: dict = field(default_factory=dict)
    was_changed: bool = False
    processing_ms: float = 0.0

    def summary(self) -> str:
        if not self.was_changed:
            return "Kişisel veri bulunamadı."
        parts = [f"{k}: {v}" for k, v in self.by_type.items() if v > 0]
        return f"Toplam {self.total_masks} gizleme: {', '.join(parts)}"


# ─── Ana Maskeleme Motoru ─────────────────────────────────────────────────────

def mask_text(text: str, level: str = "moderate") -> MaskingResult:
    """
    Metindeki kişisel verileri KVKK uyumlu olarak maskeler.

    Parametreler:
        text  : Maskelenecek metin
        level : "lenient" | "moderate" | "strict"
                - lenient  : Sadece TC, telefon, e-posta
                - moderate : + IBAN, kart, sipariş, plaka, tarih (varsayılan)
                - strict   : + Ad-soyad, adres, tüm kalıplar
    """
    if not text or not text.strip():
        return MaskingResult(original=text, masked=text)

    start = time.perf_counter()
    result = text
    counts: dict[str, int] = {}

    def apply(pattern, mask_key: str, validator=None):
        nonlocal result
        found = 0

        def replacer(m):
            nonlocal found
            val = m.group(0).replace(" ", "").replace("-", "").replace(".", "")
            if validator and not validator(val):
                return m.group(0)  # Doğrulama başarısız → değiştirme
            found += 1
            return MASKS[mask_key]

        result = pattern.sub(replacer, result)
        if found:
            counts[mask_key] = counts.get(mask_key, 0) + found

    # ── HER SEVİYEDE: TC, Telefon, E-posta ───────────────────────────────────
    apply(TC_PATTERN, "tc", validator=_validate_tc)
    for p in PHONE_PATTERNS:
        apply(p, "phone")
    apply(EMAIL_PATTERN, "email")

    # ── ORTA VE SIKI SEVİYE ───────────────────────────────────────────────────
    if level in ("moderate", "strict"):
        apply(IBAN_PATTERN, "iban")
        apply(CARD_PATTERN, "card", validator=_luhn_check)
        apply(PLATE_PATTERN, "plate")
        apply(DOB_PATTERN, "dob")
        for p in ORDER_PATTERNS:
            apply(p, "order")

    # ── SIKI SEVİYE ONLY ─────────────────────────────────────────────────────
    if level == "strict":
        # Ad-soyad: prefix korunur, ad-soyad kısmı maskelenir
        def name_replacer(m):
            counts["name"] = counts.get("name", 0) + 1
            return m.group(1) + MASKS["name"]
        new_result = NAME_PREFIX_FULL.sub(name_replacer, result)
        if new_result != result:
            result = new_result
        for p in ADDRESS_PATTERNS:
            apply(p, "address")

    total = sum(counts.values())
    elapsed = (time.perf_counter() - start) * 1000

    return MaskingResult(
        original=text,
        masked=result,
        total_masks=total,
        by_type=counts,
        was_changed=total > 0,
        processing_ms=round(elapsed, 2),
    )


def mask_jsonl_file(
    input_path: Path,
    output_path: Optional[Path] = None,
    level: str = "moderate",
    fields: list[str] = None,
    dry_run: bool = False,
) -> dict:
    """
    JSONL dosyasındaki belirtilen alanlardaki kişisel verileri maskeler.
    output_path verilmezse orijinal dosyanın üzerine yazar.
    """
    if fields is None:
        fields = ["userMessage", "assistantMessage", "messageMasked"]

    records = []
    total_masks_all = 0
    changed_count = 0

    with open(input_path, encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                records.append(line)
                continue

            record_changed = False
            for field_name in fields:
                if field_name not in rec or not isinstance(rec[field_name], str):
                    continue
                r = mask_text(rec[field_name], level=level)
                if r.was_changed:
                    if not dry_run:
                        rec[field_name] = r.masked
                    total_masks_all += r.total_masks
                    record_changed = True

            if record_changed:
                changed_count += 1
                # Maskeleme meta verisi ekle
                if not dry_run:
                    rec.setdefault("metadata", {})["kvkkMaskedAt"] = datetime.datetime.now().isoformat()
                    rec["metadata"]["maskingLevel"] = level

            records.append(json.dumps(rec, ensure_ascii=False))

    stats = {
        "inputFile": str(input_path),
        "totalRecords": len(records),
        "changedRecords": changed_count,
        "totalMasks": total_masks_all,
        "level": level,
        "dryRun": dry_run,
    }

    if not dry_run:
        dest = output_path or input_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "w", encoding="utf-8") as f:
            f.write("\n".join(records) + "\n")
        stats["outputFile"] = str(dest)

    return stats


# ─── Test Paketi ──────────────────────────────────────────────────────────────

TEST_CASES = [
    {
        "desc": "TC Kimlik No (geçerli — algoritmik doğrulama)",
        "input": "TC numaranız: 97897456690",
        "expected_mask": "tc",
    },
    {
        "desc": "TC Kimlik No (geçersiz — maskelenmemeli)",
        "input": "Numara: 12345678901",
        "expected_mask": None,
    },
    {
        "desc": "Cep telefonu (boşluklu)",
        "input": "Beni 0532 123 45 67 numarasından arayın",
        "expected_mask": "phone",
    },
    {
        "desc": "Cep telefonu (tireli)",
        "input": "Tel: 0542-321-65-87",
        "expected_mask": "phone",
    },
    {
        "desc": "Uluslararası telefon",
        "input": "+90 532 111 22 33 numarasına mesaj atın",
        "expected_mask": "phone",
    },
    {
        "desc": "E-posta adresi",
        "input": "e-posta adresim: ahmet.yilmaz@gmail.com",
        "expected_mask": "email",
    },
    {
        "desc": "IBAN numarası",
        "input": "TR33 0006 1005 1978 6457 8413 26 numaralı hesabım",
        "expected_mask": "iban",
    },
    {
        "desc": "Sipariş numarası",
        "input": "MRN-20250731 siparişim nerede?",
        "expected_mask": "order",
    },
    {
        "desc": "Türk plakası",
        "input": "34 ABC 1234 plakalı araçla geldim",
        "expected_mask": "plate",
    },
    {
        "desc": "Doğum tarihi",
        "input": "Doğum tarihim: 15.03.1985",
        "expected_mask": "dob",
    },
    {
        "desc": "Ad-soyad (strict modda)",
        "input": "Sayın Ahmet Yılmaz müşterimiz",
        "expected_mask": "name",
        "level": "strict",
    },
    {
        "desc": "Karma PII (TC + telefon + e-posta)",
        "input": "TC: 97897456690, Tel: 0532 123 45 67, e-posta: test@example.com",
        "expected_masks": ["tc", "phone", "email"],
    },
]


def run_tests() -> bool:
    print("\n" + "═" * 65)
    print("  KVKK MASKELEME MOTORU — TEST PAKETİ")
    print("═" * 65)
    passed = 0
    failed = 0

    for i, tc in enumerate(TEST_CASES, 1):
        level = tc.get("level", "moderate")
        r = mask_text(tc["input"], level=level)

        expected = tc.get("expected_mask")
        expected_list = tc.get("expected_masks", [expected] if expected else [])

        if expected is None and not expected_list:
            # Maskelenmemeli
            ok = not r.was_changed
        else:
            ok = all(mask_key in r.by_type for mask_key in expected_list)

        status = "✅ GEÇTI" if ok else "❌ KALDI"
        if ok:
            passed += 1
        else:
            failed += 1

        print(f"\n  [{i:02d}] {tc['desc']}")
        print(f"       Seviye  : {level}")
        print(f"       Giriş   : {tc['input'][:70]}")
        print(f"       Çıkış   : {r.masked[:70]}")
        print(f"       Maskeler: {r.by_type or 'Yok'}")
        print(f"       Sonuç   : {status}")

    print("\n" + "─" * 65)
    print(f"  Toplam: {passed + failed} | Geçti: {passed} ✅ | Kaldı: {failed} ❌")
    print("─" * 65 + "\n")
    return failed == 0


# ─── CLI Arayüzü ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="KVKK Gelişmiş Gizlilik Maskeleme Motoru",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("text", nargs="?", help="Maskelenecek metin (opsiyonel)")
    parser.add_argument(
        "--level",
        choices=MASKING_LEVELS,
        default="moderate",
        help="Maskeleme seviyesi: lenient | moderate | strict (varsayılan: moderate)",
    )
    parser.add_argument(
        "--file",
        type=Path,
        help="JSONL dosyasını maskele",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Çıktı dosyası (belirtilmezse orijinal dosya güncellenir)",
    )
    parser.add_argument(
        "--fields",
        nargs="+",
        default=["userMessage", "assistantMessage"],
        help="JSONL'de maskelenecek alan adları",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Değişiklikleri göster ama dosyaya yazma",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Test paketini çalıştır",
    )
    parser.add_argument(
        "--stats",
        action="store_true",
        help="Yalnızca istatistik göster, maskelenmiş metni yazdırma",
    )
    parser.add_argument(
        "--mask-pending",
        action="store_true",
        help="data/collected/pending_review.jsonl dosyasını maskele",
    )
    args = parser.parse_args()

    # Test modu
    if args.test:
        success = run_tests()
        sys.exit(0 if success else 1)

    # JSONL dosyası maskeleme
    if args.file or args.mask_pending:
        target = args.file or (Path(__file__).parent.parent / "data" / "collected" / "pending_review.jsonl")

        if not target.exists():
            print(f"HATA: Dosya bulunamadi: {target}", file=sys.stderr)
            sys.exit(1)

        print(f"\n{'═' * 60}")
        print(f"  KVKK MASKELEME — JSONL DOSYASI")
        print(f"{'═' * 60}")
        print(f"  Dosya  : {target}")
        print(f"  Seviye : {args.level}")
        print(f"  Alanlar: {', '.join(args.fields)}")
        print(f"  Mod    : {'DRY-RUN' if args.dry_run else 'CANLI'}")
        print()

        stats = mask_jsonl_file(
            input_path=target,
            output_path=args.output,
            level=args.level,
            fields=args.fields,
            dry_run=args.dry_run,
        )

        print(f"  Toplam Kayit   : {stats['totalRecords']}")
        print(f"  Degistirilen   : {stats['changedRecords']}")
        print(f"  Toplam Gizleme : {stats['totalMasks']}")
        if not args.dry_run and "outputFile" in stats:
            print(f"  Cikti Dosyasi  : {stats['outputFile']}")
        print()

        if stats["changedRecords"] > 0:
            print("  KVKK maskeleme tamamlandi!")
        else:
            print("  Kisisel veri bulunamadi, degisiklik yapilmadi.")

        return

    # Tek metin maskeleme (stdin veya argüman)
    if not args.text and not sys.stdin.isatty():
        args.text = sys.stdin.read()

    if not args.text:
        parser.print_help()
        return

    r = mask_text(args.text, level=args.level)

    print(f"\n  Seviye  : {args.level}")
    print(f"  Sure    : {r.processing_ms} ms")

    if r.was_changed:
        print(f"  Gizleme : {r.total_masks} adet — {r.by_type}")
        if not args.stats:
            print(f"\n  GIRIS : {r.original}")
            print(f"  CIKIS : {r.masked}")
    else:
        print("  Kisisel veri bulunamadi.")
        if not args.stats:
            print(f"\n  Metin : {r.original}")


if __name__ == "__main__":
    main()
