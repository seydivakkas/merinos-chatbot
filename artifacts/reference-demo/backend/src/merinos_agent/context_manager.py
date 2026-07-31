"""Deterministic token budgeting, redaction and context compression."""
from __future__ import annotations

import re
from math import ceil
from typing import Any, Protocol
from .state import ChatMessage, SummaryArtifact, TokenBreakdown, TokenBudget, TokenUsage

SENSITIVE_PATTERNS = [
    re.compile(r"\bMRN-\d{4}-\d{4}\b", re.I),
    re.compile(r"\b\d{10,11}\b"),
    re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}"),
    re.compile(r"\b\d{1,3}\.\d+\s*,\s*\d{1,3}\.\d+\b"),
]

class TokenCounter(Protocol):
    def count(self, text: str) -> int: ...

class EstimatedTokenCounter:
    def count(self, text: str) -> int:
        return 0 if not text else max(1, ceil(len(text) / 4))

def redact_text(text: str) -> str:
    redacted = text
    for pattern in SENSITIVE_PATTERNS:
        redacted = pattern.sub("[REDACTED]", redacted)
    return redacted

def approximate_text_tokens(text: str) -> int:
    return EstimatedTokenCounter().count(text)

def count_context_tokens(history: list[dict[str, Any]], rolling_summary: str | SummaryArtifact) -> int:
    summary_text = rolling_summary.text if isinstance(rolling_summary, SummaryArtifact) else rolling_summary
    return sum(approximate_text_tokens(str(item.get("content", ""))) + 4 for item in history) + approximate_text_tokens(summary_text)

def _turns(history: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    turns: list[list[dict[str, Any]]] = []
    for message in history:
        if message.get("role") == "user" or not turns:
            turns.append([message])
        else:
            turns[-1].append(message)
    return turns

def _summarize(messages: list[dict[str, Any]], previous: SummaryArtifact, max_tokens: int, revision: int) -> SummaryArtifact:
    lines = [previous.text] if previous.text else []
    redaction_applied = "[REDACTED]" in previous.text
    for raw in messages:
        message = ChatMessage.model_validate(raw)
        redacted_content = redact_text(message.content)
        redaction_applied = redaction_applied or redacted_content != message.content
        compact = " ".join(redacted_content.split())
        if len(compact) > 180: compact = compact[:177] + "..."
        lines.append(("Kullanıcı: " if message.role == "user" else "Asistan: ") + compact)
    text = " | ".join(line for line in lines if line)
    max_chars = max(120, max_tokens * 4)
    if len(text) > max_chars: text = "[Özet kısaltıldı] " + text[-max_chars:]
    if redaction_applied and "[REDACTED]" not in text:
        text = "[REDACTED] " + text
    return SummaryArtifact(text=text, source_revision=revision, token_count=approximate_text_tokens(text), redacted=True)

def compress_context(history: list[dict[str, Any]], rolling_summary: str | SummaryArtifact, budget: TokenBudget, *, source_revision: int = 0) -> tuple[list[dict[str, Any]], SummaryArtifact, TokenUsage]:
    summary = rolling_summary if isinstance(rolling_summary, SummaryArtifact) else SummaryArtifact(text=rolling_summary, token_count=approximate_text_tokens(rolling_summary), source_revision=source_revision)
    before = count_context_tokens(history, summary)
    trigger = budget.compression_trigger_tokens
    if before <= trigger:
        breakdown = TokenBreakdown(history=before-summary.token_count, summary=summary.token_count, total=before)
        return history, summary, TokenUsage(before=before, after=before, input_limit=budget.input_limit, compression_trigger=trigger, compressed=False, breakdown=breakdown)

    turns = _turns(history)
    keep_turns = max(1, budget.recent_messages_to_keep // 2)
    archived_turns = turns[:-keep_turns]
    recent_turns = turns[-keep_turns:]
    recent = [item for turn in recent_turns for item in turn]
    archived = [item for turn in archived_turns for item in turn]
    summary = _summarize(archived, summary, max(64, int(budget.input_limit * 0.2)), source_revision)

    while count_context_tokens(recent, summary) > budget.input_limit and len(recent_turns) > 1:
        moved = recent_turns.pop(0)
        summary = _summarize(moved, summary, max(64, int(budget.input_limit * 0.2)), source_revision)
        recent = [item for turn in recent_turns for item in turn]

    after = count_context_tokens(recent, summary)
    if after > budget.input_limit:
        summary = SummaryArtifact(text=summary.text[-max(120, int(budget.input_limit * 2)):], source_revision=source_revision, redacted=True)
        summary.token_count = approximate_text_tokens(summary.text)
        after = count_context_tokens(recent, summary)
    breakdown = TokenBreakdown(history=max(0, after-summary.token_count), summary=summary.token_count, total=after)
    return recent, summary, TokenUsage(before=before, after=after, input_limit=budget.input_limit, compression_trigger=trigger, compressed=True, breakdown=breakdown)
