"""PBKDF2 password hashing, JWT access tokens and RBAC dependencies."""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
from datetime import UTC, datetime, timedelta
from typing import Callable
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session
from .config import Settings

bearer = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    rounds = 210_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, rounds)
    return f"pbkdf2_sha256${rounds}${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"

def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, rounds_raw, salt_raw, digest_raw = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256": return False
        salt = base64.urlsafe_b64decode(salt_raw); expected = base64.urlsafe_b64decode(digest_raw)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(rounds_raw))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError): return False

def create_access_token(*, user_id: int, email: str, role: str, settings: Settings) -> tuple[str, int]:
    expires = datetime.now(UTC) + timedelta(minutes=settings.access_token_minutes)
    token = jwt.encode({"sub": str(user_id), "email": email, "role": role, "iat": datetime.now(UTC), "exp": expires, "iss": "merinos-chatbot"}, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, settings.access_token_minutes * 60

def current_user(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if not credentials: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Kimlik doğrulama gerekli.")
    settings: Settings = request.app.state.settings
    try: payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm], issuer="merinos-chatbot")
    except jwt.PyJWTError as exc: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz veya süresi dolmuş token.") from exc
    database = request.app.state.database
    from .database import User
    with database.session_factory() as session:
        user = session.get(User, int(payload["sub"]))
        if not user or not user.is_active: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Kullanıcı aktif değil.")
        session.expunge(user)
        return user

def require_roles(*roles: str) -> Callable:
    def dependency(user=Depends(current_user)):
        if user.role not in roles: raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu işlem için yetkiniz yok.")
        return user
    return dependency
