"""Goals API — CRUD, projection, and RAG status endpoints."""

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_db
from app.core.exceptions import NotFoundException
from app.models.goal import Goal, GoalStatus
from app.models.investment import Investment
from app.models.monthly_entry import MonthlyEntry
from app.models.user import User
from app.schemas.goal import (
    GoalCreate,
    GoalListResponse,
    GoalProjectionResponse,
    GoalRAGStatusResponse,
    GoalResponse,
    GoalUpdate,
    InvestmentProjectionItem,
)
from app.services.formatting import format_inr
from app.services.rag import InvestmentInput, evaluate_goal

router = APIRouter(prefix="/goals", tags=["goals"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_goal_or_404(
    goal_id: uuid.UUID,
    user: User,
    db: AsyncSession,
    *,
    load_investments: bool = False,
) -> Goal:
    stmt = select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id)
    if load_investments:
        stmt = stmt.options(selectinload(Goal.investments))
    result = await db.execute(stmt)
    goal = result.scalar_one_or_none()
    if goal is None:
        raise NotFoundException("Goal", str(goal_id))
    return goal


async def _batch_latest_entries(
    investment_ids: list[uuid.UUID],
    db: AsyncSession,
) -> dict[uuid.UUID, MonthlyEntry]:
    """Load the latest MonthlyEntry for each investment in a single query."""
    if not investment_ids:
        return {}

    # Subquery: max entry_month per investment
    latest_month = (
        select(
            MonthlyEntry.investment_id,
            func.max(MonthlyEntry.entry_month).label("max_month"),
        )
        .where(MonthlyEntry.investment_id.in_(investment_ids))
        .group_by(MonthlyEntry.investment_id)
        .subquery()
    )

    # Join back to get full entry rows
    stmt = select(MonthlyEntry).join(
        latest_month,
        (MonthlyEntry.investment_id == latest_month.c.investment_id)
        & (MonthlyEntry.entry_month == latest_month.c.max_month),
    )
    result = await db.execute(stmt)
    entries = result.scalars().all()
    return {e.investment_id: e for e in entries}


def _build_investment_inputs(
    investments: list[Investment],
    latest_entries: dict[uuid.UUID, MonthlyEntry],
) -> list[InvestmentInput]:
    """Build InvestmentInput list from pre-loaded latest entries."""
    inputs: list[InvestmentInput] = []
    for inv in investments:
        if not inv.is_active:
            continue
        entry = latest_entries.get(inv.id)
        if entry is None:
            continue
        inputs.append(
            InvestmentInput(
                investment_id=str(inv.id),
                name=inv.name,
                asset_class=inv.asset_class.value,
                current_value=entry.current_value,
                expected_cagr=inv.expected_cagr,
            )
        )
    return inputs


async def _build_goal_response(goal: Goal, db: AsyncSession) -> GoalResponse:
    """Compute derived fields and build the GoalResponse."""
    investments_result = await db.execute(select(Investment).where(Investment.goal_id == goal.id))
    investments = list(investments_result.scalars().all())

    inv_ids = [inv.id for inv in investments]
    latest_entries = await _batch_latest_entries(inv_ids, db)

    total_invested = Decimal("0")
    total_current_value = Decimal("0")
    for inv in investments:
        entry = latest_entries.get(inv.id)
        if entry:
            total_invested += entry.total_invested
            total_current_value += entry.current_value

    inv_inputs = _build_investment_inputs(investments, latest_entries)
    result = evaluate_goal(goal.target_amount, goal.target_date, inv_inputs)

    return GoalResponse(
        id=goal.id,
        name=goal.name,
        description=goal.description,
        target_amount=goal.target_amount,
        target_amount_formatted=format_inr(goal.target_amount),
        target_date=goal.target_date,
        status=goal.status,
        total_invested=total_invested,
        total_current_value=total_current_value,
        total_projected_value=result["total_projected"],
        progress_pct=result["progress_pct"],
        rag_status=result["rag_status"].value,
        investment_count=len(investments),
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("", response_model=GoalListResponse)
async def list_goals(
    status: GoalStatus | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalListResponse:
    """List all goals, optionally filtered by status."""
    stmt = select(Goal).where(Goal.user_id == current_user.id)
    if status is not None:
        stmt = stmt.where(Goal.status == status)
    stmt = stmt.order_by(Goal.created_at.asc())

    result = await db.execute(stmt)
    goals = list(result.scalars().all())

    # Batch-load all investments for this user's goals in one query
    goal_ids = [g.id for g in goals]
    if goal_ids:
        inv_result = await db.execute(select(Investment).where(Investment.goal_id.in_(goal_ids)))
        all_investments = list(inv_result.scalars().all())
    else:
        all_investments = []

    # Batch-load latest entries for all investments
    all_inv_ids = [inv.id for inv in all_investments]
    latest_entries = await _batch_latest_entries(all_inv_ids, db)

    # Group investments by goal
    invs_by_goal: dict[uuid.UUID, list[Investment]] = {}
    for inv in all_investments:
        invs_by_goal.setdefault(inv.goal_id, []).append(inv)

    # Build responses without additional queries
    responses: list[GoalResponse] = []
    for goal in goals:
        investments = invs_by_goal.get(goal.id, [])

        total_invested = Decimal("0")
        total_current_value = Decimal("0")
        for inv in investments:
            entry = latest_entries.get(inv.id)
            if entry:
                total_invested += entry.total_invested
                total_current_value += entry.current_value

        inv_inputs = _build_investment_inputs(investments, latest_entries)
        eval_result = evaluate_goal(goal.target_amount, goal.target_date, inv_inputs)

        responses.append(
            GoalResponse(
                id=goal.id,
                name=goal.name,
                description=goal.description,
                target_amount=goal.target_amount,
                target_amount_formatted=format_inr(goal.target_amount),
                target_date=goal.target_date,
                status=goal.status,
                total_invested=total_invested,
                total_current_value=total_current_value,
                total_projected_value=eval_result["total_projected"],
                progress_pct=eval_result["progress_pct"],
                rag_status=eval_result["rag_status"].value,
                investment_count=len(investments),
                created_at=goal.created_at,
                updated_at=goal.updated_at,
            )
        )

    return GoalListResponse(goals=responses, count=len(responses))


@router.post("", response_model=GoalResponse, status_code=201)
async def create_goal(
    body: GoalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalResponse:
    """Create a new financial goal."""
    goal = Goal(
        user_id=current_user.id,
        name=body.name,
        description=body.description,
        target_amount=body.target_amount,
        target_date=body.target_date,
        status=GoalStatus.ACTIVE,
    )
    db.add(goal)
    await db.flush()
    return await _build_goal_response(goal, db)


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalResponse:
    """Get a single goal with all computed fields."""
    goal = await _get_goal_or_404(goal_id, current_user, db)
    return await _build_goal_response(goal, db)


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: uuid.UUID,
    body: GoalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalResponse:
    """Update a goal. All fields are optional (PATCH semantics via PUT)."""
    goal = await _get_goal_or_404(goal_id, current_user, db)

    if body.name is not None:
        goal.name = body.name
    if body.description is not None:
        goal.description = body.description
    if body.target_amount is not None:
        goal.target_amount = body.target_amount
    if body.target_date is not None:
        goal.target_date = body.target_date
    if body.status is not None:
        goal.status = body.status

    await db.flush()
    await db.refresh(goal)
    return await _build_goal_response(goal, db)


@router.delete("/{goal_id}", status_code=204)
async def delete_goal(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a goal and all its linked investments/entries (cascade)."""
    goal = await _get_goal_or_404(goal_id, current_user, db)
    await db.delete(goal)


@router.get("/{goal_id}/projection", response_model=GoalProjectionResponse)
async def get_goal_projection(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalProjectionResponse:
    """Detailed projection breakdown for a goal."""
    goal = await _get_goal_or_404(goal_id, current_user, db)

    investments_result = await db.execute(select(Investment).where(Investment.goal_id == goal.id))
    investments = list(investments_result.scalars().all())
    inv_ids = [inv.id for inv in investments]
    latest_entries = await _batch_latest_entries(inv_ids, db)
    inv_inputs = _build_investment_inputs(investments, latest_entries)

    result = evaluate_goal(goal.target_amount, goal.target_date, inv_inputs)

    proj_items = [
        InvestmentProjectionItem(
            id=uuid.UUID(str(p["investment_id"])),
            name=str(p["name"]),
            asset_class=str(p["asset_class"]),
            latest_value=Decimal(str(p["latest_value"])),
            expected_cagr=Decimal(str(p["expected_cagr"])),
            projected_value=Decimal(str(p["projected_value"])),
        )
        for p in result["investment_projections"]
    ]

    shortfall = result["shortfall"]
    return GoalProjectionResponse(
        goal_id=goal.id,
        goal_name=goal.name,
        target_amount=goal.target_amount,
        target_date=goal.target_date,
        years_remaining=result["years_remaining"],
        investments=proj_items,
        total_current_value=result["total_current_value"],
        total_projected_value=result["total_projected"],
        progress_pct=result["progress_pct"],
        rag_status=result["rag_status"].value,
        shortfall=shortfall,
        shortfall_formatted=format_inr(shortfall) if shortfall > 0 else "0",
        recommended_monthly_sip=result["recommended_monthly_sip"],
    )


@router.get("/{goal_id}/rag-status", response_model=GoalRAGStatusResponse)
async def get_goal_rag_status(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalRAGStatusResponse:
    """Lightweight endpoint returning only the RAG status for a goal."""
    goal = await _get_goal_or_404(goal_id, current_user, db)

    investments_result = await db.execute(select(Investment).where(Investment.goal_id == goal.id))
    investments = list(investments_result.scalars().all())
    inv_ids = [inv.id for inv in investments]
    latest_entries = await _batch_latest_entries(inv_ids, db)
    inv_inputs = _build_investment_inputs(investments, latest_entries)

    result = evaluate_goal(goal.target_amount, goal.target_date, inv_inputs)
    shortfall = result["shortfall"]

    return GoalRAGStatusResponse(
        goal_id=goal.id,
        rag_status=result["rag_status"].value,
        progress_pct=result["progress_pct"],
        shortfall=shortfall,
        shortfall_formatted=format_inr(shortfall) if shortfall > 0 else "0",
    )
