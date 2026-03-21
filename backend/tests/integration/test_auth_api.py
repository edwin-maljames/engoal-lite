"""Integration tests for auth endpoints."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession


class TestSetup:
    @pytest.mark.anyio
    async def test_setup_required_when_no_users(self, client: AsyncClient) -> None:
        response = await client.get("/auth/setup/status")
        assert response.status_code == 200
        # May be true or false depending on whether test_user fixture ran
        assert "setup_required" in response.json()

    @pytest.mark.anyio
    async def test_create_initial_user(self, client: AsyncClient, db_session: AsyncSession) -> None:
        from sqlalchemy import func, select

        from app.models.user import User

        count_result = await db_session.execute(select(func.count()).select_from(User))
        if count_result.scalar_one() > 0:
            pytest.skip("Users already exist — setup already done in this session")

        response = await client.post(
            "/auth/setup",
            json={
                "full_name": "Setup User",
                "email": "setup@test.com",
                "password": "SetupPass123!@",
                "confirm_password": "SetupPass123!@",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "setup@test.com"
        assert data["full_name"] == "Setup User"
        assert "id" in data

    @pytest.mark.anyio
    async def test_setup_with_weak_password_fails(self, client: AsyncClient) -> None:
        response = await client.post(
            "/auth/setup",
            json={
                "full_name": "Test",
                "email": "weak@test.com",
                "password": "weak",
                "confirm_password": "weak",
            },
        )
        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_setup_with_mismatched_passwords_fails(self, client: AsyncClient) -> None:
        response = await client.post(
            "/auth/setup",
            json={
                "full_name": "Test",
                "email": "mismatch@test.com",
                "password": "StrongPass123!@",
                "confirm_password": "DifferentPass456!@",
            },
        )
        assert response.status_code == 422


class TestLogin:
    @pytest.mark.anyio
    async def test_login_success(self, client: AsyncClient, test_user: object) -> None:
        response = await client.post(
            "/auth/login",
            json={"email": "test@engoal-lite.app", "password": "TestPass123!@"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

    @pytest.mark.anyio
    async def test_login_invalid_password(self, client: AsyncClient, test_user: object) -> None:
        response = await client.post(
            "/auth/login",
            json={"email": "test@engoal-lite.app", "password": "WrongPassword!@"},
        )
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"

    @pytest.mark.anyio
    async def test_login_unknown_email(self, client: AsyncClient) -> None:
        response = await client.post(
            "/auth/login",
            json={"email": "nobody@nowhere.com", "password": "SomePass123!@"},
        )
        assert response.status_code == 401

    @pytest.mark.anyio
    async def test_login_invalid_email_format(self, client: AsyncClient) -> None:
        response = await client.post(
            "/auth/login",
            json={"email": "not-an-email", "password": "TestPass123!@"},
        )
        assert response.status_code == 422


class TestMe:
    @pytest.mark.anyio
    async def test_get_me_authenticated(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        response = await client.get("/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@engoal-lite.app"
        assert data["full_name"] == "Test User"
        assert data["is_active"] is True

    @pytest.mark.anyio
    async def test_get_me_unauthenticated(self, client: AsyncClient) -> None:
        response = await client.get("/auth/me")
        assert response.status_code in (401, 403)


class TestTokenRefresh:
    @pytest.mark.anyio
    async def test_refresh_token_rotation(self, client: AsyncClient, test_user: object) -> None:
        # Login to get initial tokens
        login_resp = await client.post(
            "/auth/login",
            json={"email": "test@engoal-lite.app", "password": "TestPass123!@"},
        )
        assert login_resp.status_code == 200
        old_refresh = login_resp.json()["refresh_token"]

        # Refresh
        refresh_resp = await client.post(
            "/auth/refresh",
            json={"refresh_token": old_refresh},
        )
        assert refresh_resp.status_code == 200
        new_data = refresh_resp.json()
        assert "access_token" in new_data
        assert "refresh_token" in new_data
        # New refresh token must differ from old one
        assert new_data["refresh_token"] != old_refresh

    @pytest.mark.anyio
    async def test_invalid_refresh_token_rejected(self, client: AsyncClient) -> None:
        response = await client.post(
            "/auth/refresh",
            json={"refresh_token": "totally-invalid-token"},
        )
        assert response.status_code == 401


class TestLogout:
    @pytest.mark.anyio
    async def test_logout_revokes_refresh_token(
        self, client: AsyncClient, test_user: object
    ) -> None:
        # Login
        login_resp = await client.post(
            "/auth/login",
            json={"email": "test@engoal-lite.app", "password": "TestPass123!@"},
        )
        tokens = login_resp.json()
        auth = {"Authorization": f"Bearer {tokens['access_token']}"}

        # Logout
        logout_resp = await client.post(
            "/auth/logout",
            json={"refresh_token": tokens["refresh_token"]},
            headers=auth,
        )
        assert logout_resp.status_code == 200

        # Attempt to use revoked refresh token → 401
        refresh_resp = await client.post(
            "/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
        assert refresh_resp.status_code == 401
