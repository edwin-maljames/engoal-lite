"""Dashboard API — aggregated portfolio overview."""

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.goal import Goal, GoalStatus
from app.models.investment import Investment
from app.models.monthly_entry import MonthlyEntry
from app.models.user import User
from app.schemas.dashboard import (
    AssetAllocationItem,
    DashboardGoalItem,
    DashboardResponse,
    DashboardSummary,
    RecentEntryItem,
)
from app.services.formatting import format_inr
from app.services.rag import InvestmentInput, evaluate_goal

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


async def _batch_latest_entries(
    investment_ids: list[uuid.UUID],
    db: AsyncSession,
) -> dict[uuid.UUID, MonthlyEntry]:
    """Load the latest MonthlyEntry for each investment in a single query."""
    if not investment_ids:
        return {}

    latest_month = (
        select(
            MonthlyEntry.investment_id,
            func.max(MonthlyEntry.entry_month).label("max_month"),
        )
        .where(MonthlyEntry.investment_id.in_(investment_ids))
        .group_by(MonthlyEntry.investment_id)
        .subquery()
    )

    stmt = select(MonthlyEntry).join(
        latest_month,
        (MonthlyEntry.investment_id == latest_month.c.investment_id)
        & (MonthlyEntry.entry_month == latest_month.c.max_month),
    )
    result = await db.execute(stmt)
    entries = result.scalars().all()
    return {e.investment_id: e for e in entries}


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardResponse:
    """Aggregated portfolio overview: summary, asset allocation, goals, recent entries."""

    # Load ALL investments for this user (both active and inactive, for recent entries)
    all_inv_result = await db.execute(
        select(Investment).where(Investment.user_id == current_user.id)
    )
    all_investments = list(all_inv_result.scalars().all())
    all_inv_map = {inv.id: inv for inv in all_investments}

    active_investments = [inv for inv in all_investments if inv.is_active]

    # Batch-load latest entries for all investments in one query
    all_inv_ids = [inv.id for inv in all_investments]
    latest_entries = await _batch_latest_entries(all_inv_ids, db)

    # ── Portfolio summary ────────────────────────────────────────────────────
    total_invested = Decimal("0")
    total_current_value = Decimal("0")

    for inv in active_investments:
        entry = latest_entries.get(inv.id)
        if entry:
            total_invested += entry.total_invested
            total_current_value += entry.current_value

    unrealized_gain = total_current_value - total_invested
    overall_return_pct: Decimal | None = None
    if total_invested > 0:
        overall_return_pct = (unrealized_gain / total_invested * Decimal("100")).quantize(
            Decimal("0.01")
        )

    # ── Asset allocation by class ────────────────────────────────────────────
    allocation_map: dict[str, Decimal] = {}
    for inv in active_investments:
        entry = latest_entries.get(inv.id)
        if entry and entry.current_value > 0:
            cls = inv.asset_class.value
            allocation_map[cls] = allocation_map.get(cls, Decimal("0")) + entry.current_value

    asset_allocation: list[AssetAllocationItem] = []
    for cls, cv in sorted(allocation_map.items(), key=lambda x: x[1], reverse=True):
        pct = (
            (cv / total_current_value * Decimal("100")).quantize(Decimal("0.01"))
            if total_current_value > 0
            else Decimal("0")
        )
        asset_allocation.append(
            AssetAllocationItem(asset_class=cls, current_value=cv, allocation_pct=pct)
        )

    # ── Goals — active only ──────────────────────────────────────────────────
    goals_result = await db.execute(
        select(Goal).where(
            Goal.user_id == current_user.id,
            Goal.status == GoalStatus.ACTIVE,
        )
    )
    active_goals = list(goals_result.scalars().all())

    # Group active investments by goal (reuse already-loaded data)
    invs_by_goal: dict[uuid.UUID, list[Investment]] = {}
    for inv in active_investments:
        invs_by_goal.setdefault(inv.goal_id, []).append(inv)

    dashboard_goals: list[DashboardGoalItem] = []
    goals_on_track = 0
    goals_at_risk = 0

    for goal in active_goals:
        goal_invs = invs_by_goal.get(goal.id, [])

        inv_inputs: list[InvestmentInput] = []
        for inv in goal_invs:
            entry = latest_entries.get(inv.id)
            if entry is None:
                continue
            inv_inputs.append(
                InvestmentInput(
                    investment_id=str(inv.id),
                    name=inv.name,
                    asset_class=inv.asset_class.value,
                    current_value=entry.current_value,
                    expected_cagr=inv.expected_cagr,
                )
            )

        eval_result = evaluate_goal(goal.target_amount, goal.target_date, inv_inputs)
        rag = eval_result["rag_status"].value

        if rag == "green":
            goals_on_track += 1
        elif rag in ("amber", "red"):
            goals_at_risk += 1

        dashboard_goals.append(
            DashboardGoalItem(
                id=goal.id,
                name=goal.name,
                target_amount=goal.target_amount,
                target_amount_formatted=format_inr(goal.target_amount),
                rag_status=rag,
                progress_pct=eval_result["progress_pct"],
                target_date=goal.target_date,
            )
        )

    # ── Recent entries — last 10 across all investments ──────────────────────
    recent_result = await db.execute(
        select(MonthlyEntry)
        .join(Investment, MonthlyEntry.investment_id == Investment.id)
        .where(Investment.user_id == current_user.id)
        .order_by(MonthlyEntry.created_at.desc())
        .limit(10)
    )
    recent_raw = list(recent_result.scalars().all())

    # Batch-load goal names for recent entries
    goal_ids_needed = list(
        {all_inv_map[e.investment_id].goal_id for e in recent_raw if e.investment_id in all_inv_map}
    )
    goal_name_map: dict[uuid.UUID, str] = {}
    if goal_ids_needed:
        goal_name_result = await db.execute(
            select(Goal.id, Goal.name).where(Goal.id.in_(goal_ids_needed))
        )
        goal_name_map = {row.id: row.name for row in goal_name_result}

    recent_entries: list[RecentEntryItem] = []
    for entry in recent_raw:
        recent_inv = all_inv_map.get(entry.investment_id)
        if recent_inv is None:
            continue

        recent_entries.append(
            RecentEntryItem(
                investment_id=entry.investment_id,
                investment_name=recent_inv.name,
                goal_name=goal_name_map.get(recent_inv.goal_id, "\u2014"),
                entry_month=entry.entry_month,
                current_value=entry.current_value,
                total_invested=entry.total_invested,
                created_at=entry.created_at,
            )
        )

    summary = DashboardSummary(
        total_invested=total_invested,
        total_invested_formatted=format_inr(total_invested),
        total_current_value=total_current_value,
        total_current_value_formatted=format_inr(total_current_value),
        total_unrealized_gain=unrealized_gain,
        overall_return_pct=overall_return_pct,
        active_goals=len(active_goals),
        goals_on_track=goals_on_track,
        goals_at_risk=goals_at_risk,
    )

    return DashboardResponse(
        summary=summary,
        asset_allocation=asset_allocation,
        goals=dashboard_goals,
        recent_entries=recent_entries,
    )
