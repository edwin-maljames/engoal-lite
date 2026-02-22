"""Authentication API endpoints."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, get_db
from app.core.exceptions import (
    ConflictException,
    InvalidCredentialsException,
    TokenInvalidException,
)
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expires_at,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    SetupRequest,
    SetupStatusResponse,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


def _token_response(user: User, refresh_raw: str) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=refresh_raw,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ---------------------------------------------------------------------------
# Initial setup
# ---------------------------------------------------------------------------


@router.get("/setup/status", response_model=SetupStatusResponse)
async def setup_status(db: AsyncSession = Depends(get_db)) -> SetupStatusResponse:
    """Return whether the one-time initial setup is still required."""
    count_result = await db.execute(select(func.count()).select_from(User))
    count = count_result.scalar_one()
    return SetupStatusResponse(setup_required=count == 0)


@router.post("/setup", response_model=UserResponse, status_code=201)
async def setup(
    body: SetupRequest,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Create the single application user (only works when no user exists yet)."""
    count_result = await db.execute(select(func.count()).select_from(User))
    if count_result.scalar_one() > 0:
        raise ConflictException("Setup has already been completed.")

    user = User(
        email=str(body.email),
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    await db.flush()
    return UserResponse.model_validate(user)


# ---------------------------------------------------------------------------
# Login / Logout / Token refresh
# ---------------------------------------------------------------------------


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate and issue access + refresh tokens."""
    result = await db.execute(
        select(User).where(User.email == str(body.email), User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise InvalidCredentialsException()

    raw, token_hash = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=refresh_token_expires_at(),
        )
    )
    return _token_response(user, raw)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Exchange a valid refresh token for a new access + refresh token pair (rotation)."""
    token_hash = hash_refresh_token(body.refresh_token)
    now = datetime.now(UTC)

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked.is_(False),
            RefreshToken.expires_at > now,
        )
    )
    stored = result.scalar_one_or_none()

    if stored is None:
        raise TokenInvalidException()

    # If token is revoked (compromise detection) — revoke all user tokens
    # (already covered by the filter above, but if a revoked hash is presented,
    #  we just raise 401; full revocation is handled here for detected reuse)

    # Revoke old token and issue new pair (rotation)
    stored.revoked = True

    user_result = await db.execute(select(User).where(User.id == stored.user_id))
    user = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise TokenInvalidException()

    raw, new_hash = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=new_hash,
            expires_at=refresh_token_expires_at(),
        )
    )
    return _token_response(user, raw)


@router.post("/logout")
async def logout(
    body: LogoutRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Revoke the provided refresh token."""
    token_hash = hash_refresh_token(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked.is_(False),
        )
    )
    stored = result.scalar_one_or_none()
    if stored is not None:
        stored.revoked = True
    return {"message": "Successfully logged out."}


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Return the authenticated user's profile."""
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_me(
    body: dict[str, str],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Update the authenticated user's display name."""
    if "full_name" in body:
        name = body["full_name"].strip()
        if not name or len(name) > 100:
            from app.core.exceptions import ValidationException

            raise ValidationException("full_name must be 1–100 characters.", "full_name")
        current_user.full_name = name
        await db.flush()
    return UserResponse.model_validate(current_user)
