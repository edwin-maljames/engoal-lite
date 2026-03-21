"""Integration tests for Goals API endpoints."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from httpx import AsyncClient


class TestGoalsCRUD:
    @pytest.mark.anyio
    async def test_create_goal(self, client: AsyncClient, auth_headers: dict[str, str]) -> None:
        response = await client.post(
            "/goals",
            json={
                "name": "Retirement Corpus",
                "description": "Build retirement fund",
                "target_amount": 50000000.00,
                "target_date": "2045-06-01",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Retirement Corpus"
        assert data["target_amount"] == 50000000.00
        assert data["rag_status"] == "red"  # No investments yet
        assert data["progress_pct"] == 0.0
        assert data["investment_count"] == 0
        assert data["status"] == "active"
        assert "id" in data
        assert "target_amount_formatted" in data

    @pytest.mark.anyio
    async def test_create_goal_unauthenticated(self, client: AsyncClient) -> None:
        response = await client.post(
            "/goals",
            json={
                "name": "Test",
                "target_amount": 100000,
                "target_date": "2030-01-01",
            },
        )
        assert response.status_code in (401, 403)

    @pytest.mark.anyio
    async def test_create_goal_past_date_rejected(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/goals",
            json={
                "name": "Test",
                "target_amount": 100000,
                "target_date": "2020-01-01",  # Past date
            },
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_list_goals(self, client: AsyncClient, auth_headers: dict[str, str]) -> None:
        # Create two goals
        for name in ["Goal Alpha", "Goal Beta"]:
            await client.post(
                "/goals",
                json={"name": name, "target_amount": 1000000, "target_date": "2040-01-01"},
                headers=auth_headers,
            )
        response = await client.get("/goals", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "goals" in data
        assert "count" in data
        assert data["count"] >= 2

    @pytest.mark.anyio
    async def test_list_goals_filter_by_status(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        # Create a goal then mark it achieved
        create_resp = await client.post(
            "/goals",
            json={"name": "Filter Test", "target_amount": 100000, "target_date": "2040-01-01"},
            headers=auth_headers,
        )
        goal_id = create_resp.json()["id"]

        await client.put(
            f"/goals/{goal_id}",
            json={"status": "achieved"},
            headers=auth_headers,
        )

        # Filter by active — should not include the achieved goal
        active_resp = await client.get("/goals?status=active", headers=auth_headers)
        active_ids = [g["id"] for g in active_resp.json()["goals"]]
        assert goal_id not in active_ids

        # Filter by achieved — should include it
        achieved_resp = await client.get("/goals?status=achieved", headers=auth_headers)
        achieved_ids = [g["id"] for g in achieved_resp.json()["goals"]]
        assert goal_id in achieved_ids

    @pytest.mark.anyio
    async def test_get_goal(self, client: AsyncClient, auth_headers: dict[str, str]) -> None:
        create_resp = await client.post(
            "/goals",
            json={"name": "Specific Goal", "target_amount": 2000000, "target_date": "2035-01-01"},
            headers=auth_headers,
        )
        goal_id = create_resp.json()["id"]

        get_resp = await client.get(f"/goals/{goal_id}", headers=auth_headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == goal_id
        assert get_resp.json()["name"] == "Specific Goal"

    @pytest.mark.anyio
    async def test_get_nonexistent_goal_returns_404(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        response = await client.get(
            "/goals/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_update_goal(self, client: AsyncClient, auth_headers: dict[str, str]) -> None:
        create_resp = await client.post(
            "/goals",
            json={"name": "Old Name", "target_amount": 1000000, "target_date": "2040-01-01"},
            headers=auth_headers,
        )
        goal_id = create_resp.json()["id"]

        update_resp = await client.put(
            f"/goals/{goal_id}",
            json={"name": "New Name", "target_amount": 2000000},
            headers=auth_headers,
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["name"] == "New Name"
        assert update_resp.json()["target_amount"] == 2000000.0

    @pytest.mark.anyio
    async def test_delete_goal(self, client: AsyncClient, auth_headers: dict[str, str]) -> None:
        create_resp = await client.post(
            "/goals",
            json={"name": "Delete Me", "target_amount": 500000, "target_date": "2040-01-01"},
            headers=auth_headers,
        )
        goal_id = create_resp.json()["id"]

        delete_resp = await client.delete(f"/goals/{goal_id}", headers=auth_headers)
        assert delete_resp.status_code == 204

        get_resp = await client.get(f"/goals/{goal_id}", headers=auth_headers)
        assert get_resp.status_code == 404

    @pytest.mark.anyio
    async def test_delete_goal_cascades_to_investments(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        # Create goal
        goal_resp = await client.post(
            "/goals",
            json={"name": "Cascade Goal", "target_amount": 1000000, "target_date": "2040-01-01"},
            headers=auth_headers,
        )
        goal_id = goal_resp.json()["id"]

        # Create investment under goal
        inv_resp = await client.post(
            "/investments",
            json={
                "goal_id": goal_id,
                "name": "Test Fund",
                "asset_class": "equity_mf",
                "expected_cagr": 12.0,
            },
            headers=auth_headers,
        )
        inv_id = inv_resp.json()["id"]

        # Delete goal — investment should cascade
        await client.delete(f"/goals/{goal_id}", headers=auth_headers)

        inv_check = await client.get(f"/investments/{inv_id}", headers=auth_headers)
        assert inv_check.status_code == 404


class TestGoalProjection:
    @pytest.mark.anyio
    async def test_projection_no_investments(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        create_resp = await client.post(
            "/goals",
            json={"name": "Proj Goal", "target_amount": 3000000, "target_date": "2040-01-01"},
            headers=auth_headers,
        )
        goal_id = create_resp.json()["id"]

        proj_resp = await client.get(f"/goals/{goal_id}/projection", headers=auth_headers)
        assert proj_resp.status_code == 200
        data = proj_resp.json()
        assert data["rag_status"] == "red"
        assert data["total_projected_value"] == 0.0
        assert data["investments"] == []

    @pytest.mark.anyio
    async def test_rag_status_endpoint(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        create_resp = await client.post(
            "/goals",
            json={"name": "RAG Goal", "target_amount": 1000000, "target_date": "2040-01-01"},
            headers=auth_headers,
        )
        goal_id = create_resp.json()["id"]

        rag_resp = await client.get(f"/goals/{goal_id}/rag-status", headers=auth_headers)
        assert rag_resp.status_code == 200
        data = rag_resp.json()
        assert "rag_status" in data
        assert "progress_pct" in data
        assert "shortfall" in data
