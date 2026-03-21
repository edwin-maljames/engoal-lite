"""Pydantic schemas for authentication endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.core.security import validate_password_policy

# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class SetupRequest(BaseModel):
    """One-time initial user setup (first launch only)."""

    full_name: str
    email: EmailStr
    password: str
    confirm_password: str

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Full name is required.")
        if len(v) > 100:
            raise ValueError("Full name must be at most 100 characters.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_policy(v)

    @model_validator(mode="after")
    def passwords_match(self) -> "SetupRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class UpdateMeRequest(BaseModel):
    """Update the authenticated user's profile."""

    full_name: str = Field(..., min_length=1, max_length=100)

    @field_validator("full_name")
    @classmethod
    def strip_full_name(cls, v: str) -> str:
        return v.strip()


# ---------------------------------------------------------------------------
# Response bodies
# ---------------------------------------------------------------------------


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SetupStatusResponse(BaseModel):
    setup_required: bool
