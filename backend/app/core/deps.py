"""FastAPI dependencies — database session and authenticated user."""

import uuid

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import TokenExpiredException, TokenInvalidException
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User

__all__ = ["get_db", "get_current_user"]

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validate the Bearer JWT and return the authenticated User.
    Raises 401 if the token is missing, expired, or invalid.
    """
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except ExpiredSignatureError as err:
        raise TokenExpiredException() from err
    except JWTError as err:
        raise TokenInvalidException() from err

    user_id_str = payload.get("sub")
    if not user_id_str or not isinstance(user_id_str, str):
        raise TokenInvalidException()

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError as err:
        raise TokenInvalidException() from err

    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if user is None:
        raise TokenInvalidException()

    return user
