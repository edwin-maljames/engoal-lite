"""
RAG (Red / Amber / Green) calculation engine.

Projection model: corpus-only.
  projected_value = current_value * (1 + cagr/100) ^ years_remaining

No future SIP contributions are assumed.  The projection answers:
"If I invest no more money, will my existing portfolio grow to reach the goal?"
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum
from typing import TypedDict


class RAGStatus(StrEnum):
    GREEN = "green"
    AMBER = "amber"
    RED = "red"


class InvestmentInput(TypedDict):
    """Input data for a single investment contributing to a goal."""

    investment_id: str
    name: str
    asset_class: str
    current_value: Decimal  # latest MTM from monthly_entries
    expected_cagr: Decimal  # annual CAGR %


class GoalEvalResult(TypedDict):
    years_remaining: Decimal
    total_current_value: Decimal
    total_projected: Decimal
    progress_pct: Decimal
    rag_status: RAGStatus
    shortfall: Decimal
    investment_projections: list[dict[str, object]]
    recommended_monthly_sip: Decimal | None


# ---------------------------------------------------------------------------
# Core calculation functions
# ---------------------------------------------------------------------------


def calculate_years_remaining(target_date: date) -> Decimal:
    """Return fractional years from today to target_date (0 if already past)."""
    delta = target_date - date.today()
    days = Decimal(str(delta.days))
    if days <= 0:
        return Decimal("0")
    return (days / Decimal("365.25")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def project_future_value(
    current_value: Decimal,
    cagr_pct: Decimal,
    years: Decimal,
) -> Decimal:
    """
    Compound-growth future value.

    FV = CV * (1 + r)^t

    Uses Decimal arithmetic for financial precision.
    Returns current_value unchanged when years <= 0 or current_value <= 0.
    """
    if years <= 0 or current_value <= 0:
        return current_value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    rate = cagr_pct / Decimal("100")
    growth_factor = (Decimal("1") + rate) ** years
    fv = current_value * growth_factor
    return fv.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_rag_status(progress_pct: Decimal) -> RAGStatus:
    """Map a progress percentage to a RAG status."""
    if progress_pct >= Decimal("100"):
        return RAGStatus.GREEN
    if progress_pct >= Decimal("85"):
        return RAGStatus.AMBER
    return RAGStatus.RED


# ---------------------------------------------------------------------------
# Goal-level aggregation
# ---------------------------------------------------------------------------


def evaluate_goal(
    target_amount: Decimal,
    target_date: date,
    investments: list[InvestmentInput],
) -> GoalEvalResult:
    """
    Evaluate a goal's RAG status using snapshot-based corpus projection.

    Args:
        target_amount: Goal target in INR.
        target_date:   Goal deadline.
        investments:   Active investments linked to this goal, each with their
                       latest monthly_entry.current_value.
                       Pass an empty list if the goal has no linked investments.

    Returns:
        GoalEvalResult dict with all computed fields.
    """
    years = calculate_years_remaining(target_date)

    # Sum current values across all investments
    total_current_value: Decimal = sum((inv["current_value"] for inv in investments), Decimal("0"))

    # When there is nothing invested, the goal can never be on track
    if total_current_value <= 0:
        zero = Decimal("0")
        return GoalEvalResult(
            years_remaining=years,
            total_current_value=zero,
            total_projected=zero,
            progress_pct=zero,
            rag_status=RAGStatus.RED,
            shortfall=target_amount,
            investment_projections=[],
            recommended_monthly_sip=None,
        )

    # Weighted average CAGR (weighted by current_value)
    weighted_cagr: Decimal = (
        sum(inv["current_value"] * inv["expected_cagr"] for inv in investments)
        / total_current_value
    )

    # Project each investment individually and accumulate total
    total_projected = Decimal("0")
    projections: list[dict[str, object]] = []

    for inv in investments:
        fv = project_future_value(inv["current_value"], inv["expected_cagr"], years)
        total_projected += fv
        projections.append(
            {
                "investment_id": inv["investment_id"],
                "name": inv["name"],
                "asset_class": inv["asset_class"],
                "latest_value": inv["current_value"],
                "expected_cagr": inv["expected_cagr"],
                "projected_value": fv,
            }
        )

    # Progress percentage
    if target_amount > 0:
        progress_pct = (total_projected / target_amount * Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    else:
        progress_pct = Decimal("0")

    shortfall = max(Decimal("0"), target_amount - total_projected)
    rag_status = compute_rag_status(progress_pct)

    # Recommended monthly SIP to close the gap (informational only)
    recommended_sip: Decimal | None = None
    if shortfall > 0 and years > 0 and weighted_cagr > 0:
        try:
            monthly_rate = (Decimal("1") + weighted_cagr / Decimal("100")) ** (
                Decimal("1") / Decimal("12")
            ) - Decimal("1")
            months_remaining = (years * Decimal("12")).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
            if monthly_rate > 0 and months_remaining > 0:
                denominator = (Decimal("1") + monthly_rate) ** months_remaining - Decimal("1")
                if denominator > 0:
                    recommended_sip = (shortfall * monthly_rate / denominator).quantize(
                        Decimal("0.01"), rounding=ROUND_HALF_UP
                    )
        except Exception:  # noqa: BLE001
            # Arithmetic edge cases — leave recommended_sip as None
            recommended_sip = None

    return GoalEvalResult(
        years_remaining=years,
        total_current_value=total_current_value,
        total_projected=total_projected,
        progress_pct=progress_pct,
        rag_status=rag_status,
        shortfall=shortfall,
        investment_projections=projections,
        recommended_monthly_sip=recommended_sip,
    )
