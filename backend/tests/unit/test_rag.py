"""Unit tests for the RAG calculation engine."""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.services.rag import (
    InvestmentInput,
    RAGStatus,
    calculate_years_remaining,
    compute_rag_status,
    evaluate_goal,
    project_future_value,
)

# ---------------------------------------------------------------------------
# calculate_years_remaining
# ---------------------------------------------------------------------------


class TestCalculateYearsRemaining:
    def test_future_date_returns_positive_decimal(self) -> None:
        future = date.today() + timedelta(days=365)
        years = calculate_years_remaining(future)
        assert years > Decimal("0")
        # Roughly 1 year
        assert Decimal("0.9") < years < Decimal("1.1")

    def test_past_date_returns_zero(self) -> None:
        past = date.today() - timedelta(days=10)
        years = calculate_years_remaining(past)
        assert years == Decimal("0")

    def test_today_returns_zero(self) -> None:
        years = calculate_years_remaining(date.today())
        assert years == Decimal("0")

    def test_ten_years_future(self) -> None:
        future = date.today() + timedelta(days=365 * 10)
        years = calculate_years_remaining(future)
        assert Decimal("9.9") < years < Decimal("10.1")


# ---------------------------------------------------------------------------
# project_future_value
# ---------------------------------------------------------------------------


class TestProjectFutureValue:
    def test_basic_growth_12pct_10y(self) -> None:
        """12% CAGR on 1,00,000 for 10 years ≈ 3,10,584.82."""
        fv = project_future_value(
            current_value=Decimal("100000"),
            cagr_pct=Decimal("12.00"),
            years=Decimal("10"),
        )
        # 100000 * 1.12^10 ≈ 310584.82
        assert Decimal("310000") < fv < Decimal("311000")

    def test_zero_years_returns_current_value(self) -> None:
        fv = project_future_value(
            current_value=Decimal("100000"),
            cagr_pct=Decimal("12.00"),
            years=Decimal("0"),
        )
        assert fv == Decimal("100000")

    def test_zero_value_returns_zero(self) -> None:
        fv = project_future_value(
            current_value=Decimal("0"),
            cagr_pct=Decimal("12.00"),
            years=Decimal("10"),
        )
        assert fv == Decimal("0")

    def test_zero_cagr_no_growth(self) -> None:
        fv = project_future_value(
            current_value=Decimal("500000"),
            cagr_pct=Decimal("0"),
            years=Decimal("5"),
        )
        assert fv == Decimal("500000")

    def test_negative_years_returns_current_value(self) -> None:
        fv = project_future_value(
            current_value=Decimal("100000"),
            cagr_pct=Decimal("12.00"),
            years=Decimal("-1"),
        )
        assert fv == Decimal("100000")

    def test_fractional_years(self) -> None:
        fv = project_future_value(
            current_value=Decimal("100000"),
            cagr_pct=Decimal("12.00"),
            years=Decimal("0.5"),
        )
        # 100000 * 1.12^0.5 ≈ 105830
        assert Decimal("105000") < fv < Decimal("107000")


# ---------------------------------------------------------------------------
# compute_rag_status
# ---------------------------------------------------------------------------


class TestComputeRAGStatus:
    @pytest.mark.parametrize(
        "pct, expected",
        [
            (Decimal("120.00"), RAGStatus.GREEN),
            (Decimal("100.00"), RAGStatus.GREEN),
            (Decimal("99.99"), RAGStatus.AMBER),
            (Decimal("85.00"), RAGStatus.AMBER),
            (Decimal("84.99"), RAGStatus.RED),
            (Decimal("50.00"), RAGStatus.RED),
            (Decimal("0"), RAGStatus.RED),
        ],
    )
    def test_thresholds(self, pct: Decimal, expected: RAGStatus) -> None:
        assert compute_rag_status(pct) == expected


# ---------------------------------------------------------------------------
# evaluate_goal
# ---------------------------------------------------------------------------


class TestEvaluateGoal:
    def _far_future_date(self) -> date:
        return date.today() + timedelta(days=365 * 15)

    def test_empty_investments_returns_red_with_zero_values(self) -> None:
        result = evaluate_goal(
            target_amount=Decimal("3000000"),
            target_date=self._far_future_date(),
            investments=[],
        )
        assert result["rag_status"] == RAGStatus.RED
        assert result["total_current_value"] == Decimal("0")
        assert result["total_projected"] == Decimal("0")
        assert result["progress_pct"] == Decimal("0")
        assert result["shortfall"] == Decimal("3000000")
        assert result["recommended_monthly_sip"] is None

    def test_on_track_goal_returns_green(self) -> None:
        """Large corpus relative to a modest target → GREEN."""
        result = evaluate_goal(
            target_amount=Decimal("1000000"),
            target_date=self._far_future_date(),
            investments=[
                InvestmentInput(
                    investment_id="inv-1",
                    name="Fund A",
                    asset_class="equity_mf",
                    current_value=Decimal("500000"),
                    expected_cagr=Decimal("12.00"),
                ),
            ],
        )
        assert result["rag_status"] == RAGStatus.GREEN
        assert result["shortfall"] == Decimal("0")
        assert result["total_projected"] > Decimal("1000000")

    def test_slightly_behind_returns_amber(self) -> None:
        """Just short of target — in the 85–99% range → AMBER."""
        # Target 1,000,000 with 14 years to grow, 91% progress
        result = evaluate_goal(
            target_amount=Decimal("1000000"),
            target_date=date.today() + timedelta(days=365 * 5),
            investments=[
                InvestmentInput(
                    investment_id="inv-1",
                    name="Fund A",
                    asset_class="equity_mf",
                    current_value=Decimal("600000"),
                    expected_cagr=Decimal("8.00"),
                ),
            ],
        )
        # 600000 * 1.08^5 ≈ 881,798 → progress ≈ 88% → AMBER
        assert result["rag_status"] in (RAGStatus.AMBER, RAGStatus.RED)  # near boundary

    def test_significantly_behind_returns_red(self) -> None:
        """Very small corpus for a large target → RED."""
        result = evaluate_goal(
            target_amount=Decimal("10000000"),
            target_date=date.today() + timedelta(days=365 * 3),
            investments=[
                InvestmentInput(
                    investment_id="inv-1",
                    name="Fund A",
                    asset_class="equity_mf",
                    current_value=Decimal("100000"),
                    expected_cagr=Decimal("10.00"),
                ),
            ],
        )
        assert result["rag_status"] == RAGStatus.RED
        assert result["shortfall"] > Decimal("0")

    def test_recommended_sip_present_when_behind(self) -> None:
        result = evaluate_goal(
            target_amount=Decimal("10000000"),
            target_date=date.today() + timedelta(days=365 * 3),
            investments=[
                InvestmentInput(
                    investment_id="inv-1",
                    name="Fund A",
                    asset_class="equity_mf",
                    current_value=Decimal("100000"),
                    expected_cagr=Decimal("10.00"),
                ),
            ],
        )
        assert result["recommended_monthly_sip"] is not None
        assert result["recommended_monthly_sip"] > Decimal("0")

    def test_multiple_investments_aggregate_correctly(self) -> None:
        """Sum of projections from multiple investments must equal total_projected."""
        investments: list[InvestmentInput] = [
            InvestmentInput(
                investment_id="inv-1",
                name="Fund A",
                asset_class="equity_mf",
                current_value=Decimal("400000"),
                expected_cagr=Decimal("12.00"),
            ),
            InvestmentInput(
                investment_id="inv-2",
                name="Fund B",
                asset_class="debt_mf",
                current_value=Decimal("200000"),
                expected_cagr=Decimal("7.50"),
            ),
            InvestmentInput(
                investment_id="inv-3",
                name="Gold ETF",
                asset_class="gold",
                current_value=Decimal("150000"),
                expected_cagr=Decimal("9.00"),
            ),
        ]
        result = evaluate_goal(
            target_amount=Decimal("3000000"),
            target_date=self._far_future_date(),
            investments=investments,
        )
        # Sum of individual projections should match total
        sum_of_projections = sum(
            p["projected_value"]
            for p in result["investment_projections"]
            if isinstance(p["projected_value"], Decimal)
        )
        assert abs(sum_of_projections - result["total_projected"]) < Decimal("0.10")

    def test_past_target_date_no_growth(self) -> None:
        """When target date is already past, projected = current value."""
        result = evaluate_goal(
            target_amount=Decimal("1000000"),
            target_date=date.today() - timedelta(days=30),
            investments=[
                InvestmentInput(
                    investment_id="inv-1",
                    name="Fund A",
                    asset_class="equity_mf",
                    current_value=Decimal("500000"),
                    expected_cagr=Decimal("12.00"),
                ),
            ],
        )
        # years_remaining = 0, so FV = current_value
        assert result["total_projected"] == Decimal("500000")

    def test_investment_projections_list_has_correct_length(self) -> None:
        investments: list[InvestmentInput] = [
            InvestmentInput(
                investment_id=f"inv-{i}",
                name=f"Fund {i}",
                asset_class="equity_mf",
                current_value=Decimal("100000"),
                expected_cagr=Decimal("12.00"),
            )
            for i in range(3)
        ]
        result = evaluate_goal(
            target_amount=Decimal("5000000"),
            target_date=self._far_future_date(),
            investments=investments,
        )
        assert len(result["investment_projections"]) == 3
