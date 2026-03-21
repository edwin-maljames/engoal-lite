"""Investments API — CRUD endpoints."""

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.exceptions import NotFoundException
from app.models.goal import Goal
from app.models.investment import AssetClass, Investment
from app.models.monthly_entry import MonthlyEntry
from app.models.user import User
from app.schemas.investment import (
    InvestmentCreate,
    InvestmentListResponse,
    InvestmentResponse,
    InvestmentUpdate,
)

router = APIRouter(prefix="/investments", tags=["investments"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_investment_or_404(
    investment_id: uuid.UUID,
    user: User,
    db: AsyncSession,
) -> Investment:
    result = await db.execute(
        select(Investment).where(
            Investment.id == investment_id,
            Investment.user_id == user.id,
        )
    )
    inv = result.scalar_one_or_none()
    if inv is None:
        raise NotFoundException("Investment", str(investment_id))
    return inv


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


def _build_investment_response(
    inv: Investment,
    goal_name: str,
    entry: MonthlyEntry | None,
) -> InvestmentResponse:
    """Build InvestmentResponse from pre-loaded data (no extra queries)."""
    latest_total_invested: Decimal | None = None
    latest_current_value: Decimal | None = None
    unrealized_gain: Decimal | None = None
    absolute_return_pct: Decimal | None = None

    if entry is not None:
        latest_total_invested = entry.total_invested
        latest_current_value = entry.current_value
        unrealized_gain = entry.current_value - entry.total_invested
        if entry.total_invested > 0:
            absolute_return_pct = (
                unrealized_gain / entry.total_invested * Decimal("100")
            ).quantize(Decimal("0.01"))

    return InvestmentResponse(
        id=inv.id,
        goal_id=inv.goal_id,
        goal_name=goal_name,
        name=inv.name,
        asset_class=inv.asset_class,
        expected_cagr=inv.expected_cagr,
        is_active=inv.is_active,
        latest_total_invested=latest_total_invested,
        latest_current_value=latest_current_value,
        unrealized_gain=unrealized_gain,
        absolute_return_pct=absolute_return_pct,
        latest_entry_month=entry.entry_month if entry else None,
        notes=inv.notes,
        created_at=inv.created_at,
        updated_at=inv.updated_at,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("", response_model=InvestmentListResponse)
async def list_investments(
    goal_id: uuid.UUID | None = Query(None),
    asset_class: AssetClass | None = Query(None),
    is_active: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvestmentListResponse:
    """List investments, optionally filtered by goal, asset class, or active status."""
    stmt = select(Investment).where(Investment.user_id == current_user.id)
    if goal_id is not None:
        stmt = stmt.where(Investment.goal_id == goal_id)
    if asset_class is not None:
        stmt = stmt.where(Investment.asset_class == asset_class)
    if is_active is not None:
        stmt = stmt.where(Investment.is_active == is_active)
    stmt = stmt.order_by(Investment.created_at.asc())

    result = await db.execute(stmt)
    investments = list(result.scalars().all())

    # Batch-load goal names
    goal_ids = list({inv.goal_id for inv in investments})
    goal_name_map: dict[uuid.UUID, str] = {}
    if goal_ids:
        goal_result = await db.execute(select(Goal.id, Goal.name).where(Goal.id.in_(goal_ids)))
        goal_name_map = {row.id: row.name for row in goal_result}

    # Batch-load latest entries
    inv_ids = [inv.id for inv in investments]
    latest_entries = await _batch_latest_entries(inv_ids, db)

    responses = [
        _build_investment_response(
            inv,
            goal_name=goal_name_map.get(inv.goal_id, "\u2014"),
            entry=latest_entries.get(inv.id),
        )
        for inv in investments
    ]
    return InvestmentListResponse(investments=responses, count=len(responses))


@router.post("", response_model=InvestmentResponse, status_code=201)
async def create_investment(
    body: InvestmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvestmentResponse:
    """Create a new investment linked to a goal."""
    goal_result = await db.execute(
        select(Goal).where(Goal.id == body.goal_id, Goal.user_id == current_user.id)
    )
    goal = goal_result.scalar_one_or_none()
    if goal is None:
        raise NotFoundException("Goal", str(body.goal_id))

    inv = Investment(
        goal_id=body.goal_id,
        user_id=current_user.id,
        name=body.name,
        asset_class=body.asset_class,
        expected_cagr=body.expected_cagr,
        notes=body.notes,
        is_active=True,
    )
    db.add(inv)
    await db.flush()
    return _build_investment_response(inv, goal_name=goal.name, entry=None)


@router.get("/{investment_id}", response_model=InvestmentResponse)
async def get_investment(
    investment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvestmentResponse:
    """Get a single investment with computed fields."""
    inv = await _get_investment_or_404(investment_id, current_user, db)

    goal_result = await db.execute(select(Goal.name).where(Goal.id == inv.goal_id))
    goal_name = goal_result.scalar_one_or_none() or "\u2014"

    latest_entries = await _batch_latest_entries([inv.id], db)
    return _build_investment_response(inv, goal_name=goal_name, entry=latest_entries.get(inv.id))


@router.put("/{investment_id}", response_model=InvestmentResponse)
async def update_investment(
    investment_id: uuid.UUID,
    body: InvestmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvestmentResponse:
    """Update investment details. Cannot change the linked goal."""
    inv = await _get_investment_or_404(investment_id, current_user, db)

    if body.name is not None:
        inv.name = body.name
    if body.expected_cagr is not None:
        inv.expected_cagr = body.expected_cagr
    if body.is_active is not None:
        inv.is_active = body.is_active
    if body.notes is not None:
        inv.notes = body.notes

    await db.flush()
    await db.refresh(inv)

    goal_result = await db.execute(select(Goal.name).where(Goal.id == inv.goal_id))
    goal_name = goal_result.scalar_one_or_none() or "\u2014"

    latest_entries = await _batch_latest_entries([inv.id], db)
    return _build_investment_response(inv, goal_name=goal_name, entry=latest_entries.get(inv.id))


@router.delete("/{investment_id}", status_code=204)
async def delete_investment(
    investment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete an investment and all its monthly entries (cascade)."""
    inv = await _get_investment_or_404(investment_id, current_user, db)
    await db.delete(inv)
