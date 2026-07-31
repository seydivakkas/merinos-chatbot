from __future__ import annotations

from merinos_agent.context_manager import compress_context, count_context_tokens, redact_text
from merinos_agent.state import ChatMessage, SummaryArtifact, TokenBudget


def test_short_history_is_not_compressed() -> None:
    history = [ChatMessage(role="user", content="Mavi halı arıyorum.").model_dump(mode="json")]
    compacted, summary, usage = compress_context(history, SummaryArtifact(), TokenBudget())
    assert compacted == history
    assert summary.text == ""
    assert usage.compressed is False
    assert usage.before == usage.after


def test_long_history_moves_complete_turns_to_redacted_summary() -> None:
    history = [
        ChatMessage(role="user" if index % 2 == 0 else "assistant", content=f"Mesaj {index}: " + ("uzun içerik " * 12) + (" MRN-2026-1042" if index == 0 else "")).model_dump(mode="json")
        for index in range(12)
    ]
    budget = TokenBudget(context_window_tokens=480, max_output_tokens=100, safety_margin_tokens=40, compression_trigger_ratio=0.40, recent_messages_to_keep=4)
    before = count_context_tokens(history, "")
    compacted, summary, usage = compress_context(history, SummaryArtifact(), budget, source_revision=3)
    assert usage.compressed is True
    assert len(compacted) < len(history)
    assert summary.text
    assert "MRN-2026-1042" not in summary.text
    assert "[REDACTED]" in summary.text
    assert usage.before == before
    assert usage.after <= budget.input_limit
    assert summary.source_revision == 3


def test_redaction_removes_common_sensitive_values() -> None:
    output = redact_text("MRN-2026-1042 kullanıcı@example.com 05551234567")
    assert "MRN-2026-1042" not in output
    assert "kullanıcı@example.com" not in output
    assert "05551234567" not in output
