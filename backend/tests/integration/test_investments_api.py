"""Integration tests for Investments API endpoints."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from httpx import AsyncClient


@pytest.fixture
async def goal_id(client: AsyncClient, auth_headers: dict[str, str]) -> str:
    resp = await client.post(
        "/goals",
        json={"name": "Inv Test Goal", "target_amount": 5000000, "target_date": "2040-01-01"},
        headers=auth_headers,
    )
    return str(resp.json()["id"])


class TestInvestmentsCRUD:
    @pytest.mark.anyio
    async def test_create_investment(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        goal_id: str,
    ) -> None:
        response = await client.post(
            "/investments",
            json={
                "goal_id": goal_id,
                "name": "Nifty 50 Index Fund",
                "asset_class": "equity_mf",
                "expected_cagr": 12.0,
                "notes": "SIP of 10k/month",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Nifty 50 Index Fund"
        assert data["asset_class"] == "equity_mf"
        assert data["expected_cagr"] == 12.0
        assert data["is_active"] is True
        assert data["latest_current_value"] is None  # No entries yet
        assert data["goal_id"] == goal_id

    @pytest.mark.anyio
    async def test_create_investment_invalid_goal(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/investments",
            json={
                "goal_id": "00000000-0000-0000-0000-000000000000",
                "name": "Fund",
                "asset_class": "equity_mf",
                "expected_cagr": 12.0,
            },
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_list_investments(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        goal_id: str,
    ) -> None:
        # Create two investments
        for i in range(2):
            await client.post(
                "/investments",
                json={
                    "goal_id": goal_id,
                    "name": f"Fund {i}",
                    "asset_class": "equity_mf",
                    "expected_cagr": 12.0,
                },
                headers=auth_headers,
            )

        response = await client.get("/investments", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 2

    @pytest.mark.anyio
    async def test_list_investments_filter_by_goal(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        goal_id: str,
    ) -> None:
        # Create another goal with its own investment
        other_goal_resp = await client.post(
            "/goals",
            json={"name": "Other Goal", "target_amount": 100000, "target_date": "2040-01-01"},
            headers=auth_headers,
        )
        other_goal_id = other_goal_resp.json()["id"]
        await client.post(
            "/investments",
            json={
                "goal_id": other_goal_id,
                "name": "Other Fund",
                "asset_class": "debt_mf",
                "expected_cagr": 7.0,
            },
            headers=auth_headers,
        )

        # Filter by goal_id — should only return investments for that goal
        resp = await client.get(
            f"/investments?goal_id={goal_id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        goal_ids = [inv["goal_id"] for inv in resp.json()["investments"]]
        assert all(gid == goal_id for gid in goal_ids)

    @pytest.mark.anyio
    async def test_filter_by_is_active(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        goal_id: str,
    ) -> None:
        # Create and deactivate an investment
        inv_resp = await client.post(
            "/investments",
            json={
                "goal_id": goal_id,
                "name": "Inactive Fund",
                "asset_class": "gold",
                "expected_cagr": 9.0,
            },
            headers=auth_headers,
        )
        inv_id = inv_resp.json()["id"]
        await client.put(
            f"/investments/{inv_id}",
            json={"is_active": False},
            headers=auth_headers,
        )

        active_resp = await client.get("/investments?is_active=true", headers=auth_headers)
        active_ids = [inv["id"] for inv in active_resp.json()["investments"]]
        assert inv_id not in active_ids

        inactive_resp = await client.get("/investments?is_active=false", headers=auth_headers)
        inactive_ids = [inv["id"] for inv in inactive_resp.json()["investments"]]
        assert inv_id in inactive_ids

    @pytest.mark.anyio
    async def test_get_investment(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        goal_id: str,
    ) -> None:
        inv_resp = await client.post(
            "/investments",
            json={
                "goal_id": goal_id,
                "name": "Get Me Fund",
                "asset_class": "fixed_deposit",
                "expected_cagr": 7.5,
            },
            headers=auth_headers,
        )
        inv_id = inv_resp.json()["id"]

        get_resp = await client.get(f"/investments/{inv_id}", headers=auth_headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == inv_id

    @pytest.mark.anyio
    async def test_get_nonexistent_investment(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        response = await client.get(
            "/investments/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_update_investment(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        goal_id: str,
    ) -> None:
        inv_resp = await client.post(
            "/investments",
            json={
                "goal_id": goal_id,
                "name": "Old Fund Name",
                "asset_class": "equity_mf",
                "expected_cagr": 12.0,
            },
            headers=auth_headers,
        )
        inv_id = inv_resp.json()["id"]

        update_resp = await client.put(
            f"/investments/{inv_id}",
            json={"name": "Updated Fund", "expected_cagr": 14.0, "notes": "New notes"},
            headers=auth_headers,
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["name"] == "Updated Fund"
        assert update_resp.json()["expected_cagr"] == 14.0
        assert update_resp.json()["notes"] == "New notes"

    @pytest.mark.anyio
    async def test_delete_investment(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        goal_id: str,
    ) -> None:
        inv_resp = await client.post(
            "/investments",
            json={
                "goal_id": goal_id,
                "name": "Delete Me Fund",
                "asset_class": "gold",
                "expected_cagr": 9.0,
            },
            headers=auth_headers,
        )
        inv_id = inv_resp.json()["id"]

        delete_resp = await client.delete(f"/investments/{inv_id}", headers=auth_headers)
        assert delete_resp.status_code == 204

        get_resp = await client.get(f"/investments/{inv_id}", headers=auth_headers)
        assert get_resp.status_code == 404

    @pytest.mark.anyio
    async def test_unauthenticated_access_denied(self, client: AsyncClient) -> None:
        response = await client.get("/investments")
        assert response.status_code in (401, 403)
