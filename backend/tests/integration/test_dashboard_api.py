"""Integration tests for the Dashboard API endpoint."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from httpx import AsyncClient


class TestDashboard:
    @pytest.mark.anyio
    async def test_dashboard_unauthenticated(self, client: AsyncClient) -> None:
        response = await client.get("/dashboard")
        assert response.status_code in (401, 403)

    @pytest.mark.anyio
    async def test_dashboard_empty_portfolio(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """Dashboard returns valid structure even with no data."""
        response = await client.get("/dashboard", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "summary" in data
        assert "asset_allocation" in data
        assert "goals" in data
        assert "recent_entries" in data

        summary = data["summary"]
        assert "total_invested" in summary
        assert "total_current_value" in summary
        assert "total_unrealized_gain" in summary
        assert "active_goals" in summary
        assert "goals_on_track" in summary
        assert "goals_at_risk" in summary

    @pytest.mark.anyio
    async def test_dashboard_with_goal_and_investment(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """Dashboard reflects data after creating a goal, investment, and entry."""
        # Create goal
        goal_resp = await client.post(
            "/goals",
            json={"name": "Dashboard Goal", "target_amount": 1000000, "target_date": "2040-01-01"},
            headers=auth_headers,
        )
        goal_id = goal_resp.json()["id"]

        # Create investment
        inv_resp = await client.post(
            "/investments",
            json={
                "goal_id": goal_id,
                "name": "Dashboard Fund",
                "asset_class": "equity_mf",
                "expected_cagr": 12.0,
            },
            headers=auth_headers,
        )
        inv_id = inv_resp.json()["id"]

        # Create monthly entry
        await client.post(
            f"/investments/{inv_id}/entries",
            json={
                "entry_month": "2026-02-01",
                "total_invested": 500000.0,
                "current_value": 620000.0,
            },
            headers=auth_headers,
        )

        response = await client.get("/dashboard", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        summary = data["summary"]
        # Total invested and current value should include our entry
        assert summary["total_invested"] >= 500000
        assert summary["total_current_value"] >= 620000

        # Asset allocation should show equity_mf
        allocation_classes = [a["asset_class"] for a in data["asset_allocation"]]
        assert "equity_mf" in allocation_classes

        # Goal should appear in goals list
        goal_ids = [g["id"] for g in data["goals"]]
        assert goal_id in goal_ids

        # Recent entries should include our entry
        assert len(data["recent_entries"]) >= 1

    @pytest.mark.anyio
    async def test_dashboard_rag_counts(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """goals_on_track and goals_at_risk are correctly counted."""
        # Create a goal with massive target → will be RED
        goal_resp = await client.post(
            "/goals",
            json={
                "name": "Red Goal",
                "target_amount": 999999999,
                "target_date": "2027-01-01",
            },
            headers=auth_headers,
        )
        goal_id = goal_resp.json()["id"]
        inv_resp = await client.post(
            "/investments",
            json={
                "goal_id": goal_id,
                "name": "Tiny Fund",
                "asset_class": "equity_mf",
                "expected_cagr": 12.0,
            },
            headers=auth_headers,
        )
        await client.post(
            f"/investments/{inv_resp.json()['id']}/entries",
            json={"entry_month": "2026-02-01", "total_invested": 1000.0, "current_value": 1100.0},
            headers=auth_headers,
        )

        response = await client.get("/dashboard", headers=auth_headers)
        summary = response.json()["summary"]
        assert summary["goals_at_risk"] >= 1

    @pytest.mark.anyio
    async def test_dashboard_formatted_fields_present(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """Verify INR-formatted string fields are present in summary."""
        response = await client.get("/dashboard", headers=auth_headers)
        summary = response.json()["summary"]
        assert "total_invested_formatted" in summary
        assert "total_current_value_formatted" in summary


class TestHealthEndpoint:
    @pytest.mark.anyio
    async def test_health_returns_ok(self, client: AsyncClient) -> None:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data
