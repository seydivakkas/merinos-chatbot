"""Privacy-safe request IDs, hashes and log redaction helpers."""
from __future__ import annotations

import hashlib
import re
from uuid import uuid4

PATTERNS = [re.compile(r"\bMRN-\d{4}-\d{4}\b", re.I), re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}"), re.compile(r"\b\d{10,11}\b")]

def request_id(value: str | None) -> str:
    if value and re.fullmatch(r"[A-Za-z0-9._-]{8,128}", value): return value
    return str(uuid4())

def redact(value: str) -> str:
    result = value
    for pattern in PATTERNS: result = pattern.sub("[REDACTED]", result)
    return result

def stable_hash(value: str) -> str: return hashlib.sha256(value.encode()).hexdigest()
