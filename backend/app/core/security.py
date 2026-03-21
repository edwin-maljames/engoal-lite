"""Security utilities — password hashing and JWT token management."""

import hashlib
import re
import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

_BCRYPT_ROUNDS = 12

PASSWORD_POLICY_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{10,}$")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def validate_password_policy(password: str) -> str:
    """
    Raise ValueError if password does not meet policy:
    - Minimum 10 characters
    - At least 1 uppercase, 1 lowercase, 1 digit, 1 special character
    """
    if not PASSWORD_POLICY_RE.match(password):
        raise ValueError(
            "Password must be at least 10 characters and include "
            "uppercase, lowercase, digit, and special character."
        )
    return password


# ---------------------------------------------------------------------------
# JWT access tokens
# ---------------------------------------------------------------------------


def create_access_token(user_id: str, expires_minutes: int | None = None) -> str:
    """Create a signed JWT access token."""
    minutes = expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(UTC) + timedelta(minutes=minutes)
    payload: dict[str, object] = {
        "sub": user_id,
        "exp": expire,
        "iat": datetime.now(UTC),
        "type": "access",
    }
    return str(jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM))


def decode_access_token(token: str) -> dict[str, object]:
    """
    Decode and validate a JWT access token.
    Raises JWTError on invalid / expired tokens.
    """
    payload: dict[str, object] = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
    )
    if payload.get("type") != "access":
        raise JWTError("Invalid token type")
    return payload


# ---------------------------------------------------------------------------
# Refresh tokens (opaque, stored as SHA-256 hash)
# ---------------------------------------------------------------------------


def generate_refresh_token() -> tuple[str, str]:
    """
    Generate a cryptographically random refresh token.
    Returns (raw_token, sha256_hash).
    The raw token is sent to the client; only the hash is stored in the DB.
    """
    raw = secrets.token_urlsafe(48)
    token_hash = hash_refresh_token(raw)
    return raw, token_hash


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def refresh_token_expires_at() -> datetime:
    return datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
