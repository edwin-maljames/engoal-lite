"""Integration tests for Monthly Entries API endpoints."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from httpx import AsyncClient


@pytest.fixture
async def investment_id(client: AsyncClient, auth_headers: dict[str, str]) -> str:
    goal_resp = await client.post(
        "/goals",
        json={"name": "Entry Test Goal", "target_amount": 1000000, "target_date": "2040-01-01"},
        headers=auth_headers,
    )
    goal_id = goal_resp.json()["id"]

    inv_resp = await client.post(
        "/investments",
        json={
            "goal_id": goal_id,
            "name": "Entry Test Fund",
            "asset_class": "equity_mf",
            "expected_cagr": 12.0,
        },
        headers=auth_headers,
    )
    return str(inv_resp.json()["id"])


class TestEntriesCRUD:
    @pytest.mark.anyio
    async def test_create_entry(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        investment_id: str,
    ) -> None:
        response = await client.post(
            f"/investments/{investment_id}/entries",
            json={
                "entry_month": "2026-02-01",
                "total_invested": 560000.00,
                "current_value": 640000.00,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["investment_id"] == investment_id
        assert data["entry_month"] == "2026-02-01"
        assert data["total_invested"] == 560000.0
        assert data["current_value"] == 640000.0
        assert data["unrealized_gain"] == 80000.0
        assert "absolute_return_pct" in data
        assert "goal_rag_status" in data

    @pytest.mark.anyio
    async def test_upsert_existing_entry_updates(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        investment_id: str,
    ) -> None:
        # Create entry
        await client.post(
            f"/investments/{investment_id}/entries",
            json={
                "entry_month": "2026-03-01",
                "total_invested": 100000.0,
                "current_value": 110000.0,
            },
            headers=auth_headers,
        )
        # Upsert (same month, different values)
        update_resp = await client.post(
            f"/investments/{investment_id}/entries",
            json={
                "entry_month": "2026-03-01",
                "total_invested": 110000.0,
                "current_value": 125000.0,
            },
            headers=auth_headers,
        )
        assert update_resp.status_code == 201
        data = update_resp.json()
        assert data["total_invested"] == 110000.0
        assert data["current_value"] == 125000.0

    @pytest.mark.anyio
    async def test_entry_month_must_be_first_of_month(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        investment_id: str,
    ) -> None:
        response = await client.post(
            f"/investments/{investment_id}/entries",
            json={
                "entry_month": "2026-02-15",  # Not first of month
                "total_invested": 100000.0,
                "current_value": 110000.0,
            },
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_negative_amounts_rejected(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        investment_id: str,
    ) -> None:
        response = await client.post(
            f"/investments/{investment_id}/entries",
            json={
                "entry_month": "2026-01-01",
                "total_invested": -1000.0,
                "current_value": 10000.0,
            },
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_list_entries(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        investment_id: str,
    ) -> None:
        # Create a few entries
        for month in ["2026-01-01", "2026-02-01", "2026-03-01"]:
            await client.post(
                f"/investments/{investment_id}/entries",
                json={
                    "entry_month": month,
                    "total_invested": 100000.0,
                    "current_value": 110000.0,
                },
                headers=auth_headers,
            )

        response = await client.get(
            f"/investments/{investment_id}/entries",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 3
        assert data["investment_id"] == investment_id
        # Entries should be ordered month descending
        months = [e["entry_month"] for e in data["entries"]]
        assert months == sorted(months, reverse=True)

    @pytest.mark.anyio
    async def test_list_entries_respects_limit(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        investment_id: str,
    ) -> None:
        response = await client.get(
            f"/investments/{investment_id}/entries?limit=2",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert len(response.json()["entries"]) <= 2

    @pytest.mark.anyio
    async def test_delete_entry(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        investment_id: str,
    ) -> None:
        create_resp = await client.post(
            f"/investments/{investment_id}/entries",
            json={
                "entry_month": "2025-12-01",
                "total_invested": 50000.0,
                "current_value": 55000.0,
            },
            headers=auth_headers,
        )
        entry_id = create_resp.json()["id"]

        delete_resp = await client.delete(
            f"/investments/{investment_id}/entries/{entry_id}",
            headers=auth_headers,
        )
        assert delete_resp.status_code == 204

    @pytest.mark.anyio
    async def test_entry_for_wrong_investment_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ) -> None:
        response = await client.get(
            "/investments/00000000-0000-0000-0000-000000000000/entries",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_mom_change_calculated(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        investment_id: str,
    ) -> None:
        """Month-over-month change should be computed from the previous entry."""
        await client.post(
            f"/investments/{investment_id}/entries",
            json={
                "entry_month": "2026-04-01",
                "total_invested": 100000.0,
                "current_value": 110000.0,
            },
            headers=auth_headers,
        )
        resp = await client.post(
            f"/investments/{investment_id}/entries",
            json={
                "entry_month": "2026-05-01",
                "total_invested": 110000.0,
                "current_value": 125000.0,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        # MoM change = 125000 - 110000 = 15000
        assert resp.json()["month_over_month_value_change"] == 15000.0
