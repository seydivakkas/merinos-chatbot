from merinos_agent.auth import hash_password, verify_password
from merinos_agent.security import redact, request_id


def test_password_hash_is_salted_and_verifiable() -> None:
    first = hash_password("ChangeMe123!")
    second = hash_password("ChangeMe123!")
    assert first != second
    assert verify_password("ChangeMe123!", first)
    assert not verify_password("wrong-password", first)


def test_redaction_and_request_id_validation() -> None:
    assert "MRN-2026-1042" not in redact("Sipariş MRN-2026-1042")
    assert request_id("valid-request-123") == "valid-request-123"
    assert request_id("bad value") != "bad value"
