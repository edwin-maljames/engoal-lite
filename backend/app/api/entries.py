"""Monthly entries API — upsert and history for each investment."""

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.exceptions import NotFoundException
from app.models.investment import Investment
from app.models.monthly_entry import MonthlyEntry
from app.models.user import User
from app.schemas.entry import EntryCreate, EntryListResponse, EntryResponse
from app.services.rag import InvestmentInput, evaluate_goal

router = APIRouter(tags=["entries"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_investment_for_user(
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


async def _compute_goal_rag(inv: Investment, db: AsyncSession) -> str:
    """Recalculate the RAG status for the goal linked to this investment."""
    from sqlalchemy import select as _select

    from app.models.goal import Goal

    goal_result = await db.execute(_select(Goal).where(Goal.id == inv.goal_id))
    goal = goal_result.scalar_one_or_none()
    if goal is None:
        return "red"

    siblings_result = await db.execute(
        _select(Investment).where(
            Investment.goal_id == goal.id,
            Investment.is_active.is_(True),
        )
    )
    siblings = list(siblings_result.scalars().all())

    inv_inputs: list[InvestmentInput] = []
    for s in siblings:
        entry_result = await db.execute(
            _select(MonthlyEntry)
            .where(MonthlyEntry.investment_id == s.id)
            .order_by(MonthlyEntry.entry_month.desc())
            .limit(1)
        )
        entry = entry_result.scalar_one_or_none()
        if entry is None:
            continue
        inv_inputs.append(
            InvestmentInput(
                investment_id=str(s.id),
                name=s.name,
                asset_class=s.asset_class.value,
                current_value=entry.current_value,
                expected_cagr=s.expected_cagr,
            )
        )

    result = evaluate_goal(goal.target_amount, goal.target_date, inv_inputs)
    return result["rag_status"].value


def _build_entry_response(
    entry: MonthlyEntry,
    prev_value: Decimal | None,
    goal_rag: str | None,
) -> EntryResponse:
    unrealized_gain = entry.current_value - entry.total_invested
    abs_return_pct: Decimal | None = None
    if entry.total_invested > 0:
        abs_return_pct = (unrealized_gain / entry.total_invested * Decimal("100")).quantize(
            Decimal("0.01")
        )
    mom_change: Decimal | None = None
    if prev_value is not None:
        mom_change = entry.current_value - prev_value

    return EntryResponse(
        id=entry.id,
        investment_id=entry.investment_id,
        entry_month=entry.entry_month,
        total_invested=entry.total_invested,
        current_value=entry.current_value,
        unrealized_gain=unrealized_gain,
        absolute_return_pct=abs_return_pct,
        month_over_month_value_change=mom_change,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        goal_rag_status=goal_rag,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post(
    "/investments/{investment_id}/entries",
    response_model=EntryResponse,
    status_code=201,
)
async def upsert_entry(
    investment_id: uuid.UUID,
    body: EntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryResponse:
    """
    Add or update a monthly entry for an investment (upsert by investment + month).
    Triggers RAG recalculation for the linked goal.
    """
    inv = await _get_investment_for_user(investment_id, current_user, db)

    # Fetch the previous month's value for MoM change calculation
    prev_result = await db.execute(
        select(MonthlyEntry)
        .where(MonthlyEntry.investment_id == investment_id)
        .order_by(MonthlyEntry.entry_month.desc())
        .limit(1)
    )
    prev_entry = prev_result.scalar_one_or_none()
    prev_value: Decimal | None = (
        prev_entry.current_value
        if prev_entry and prev_entry.entry_month != body.entry_month
        else None
    )

    # Check if an entry for this month already exists (upsert semantics)
    existing_result = await db.execute(
        select(MonthlyEntry).where(
            MonthlyEntry.investment_id == investment_id,
            MonthlyEntry.entry_month == body.entry_month,
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing is not None:
        existing.total_invested = body.total_invested
        existing.current_value = body.current_value
        entry = existing
    else:
        entry = MonthlyEntry(
            investment_id=investment_id,
            entry_month=body.entry_month,
            total_invested=body.total_invested,
            current_value=body.current_value,
        )
        db.add(entry)

    await db.flush()

    # RAG recalculation after saving
    goal_rag = await _compute_goal_rag(inv, db)

    return _build_entry_response(entry, prev_value, goal_rag)


@router.get(
    "/investments/{investment_id}/entries",
    response_model=EntryListResponse,
)
async def list_entries(
    investment_id: uuid.UUID,
    from_month: str | None = Query(None, description="ISO date — first of month"),
    to_month: str | None = Query(None, description="ISO date — first of month"),
    limit: int = Query(12, ge=1, le=120),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryListResponse:
    """List monthly entries for an investment, ordered by month descending."""
    inv = await _get_investment_for_user(investment_id, current_user, db)

    stmt = (
        select(MonthlyEntry)
        .where(MonthlyEntry.investment_id == investment_id)
        .order_by(MonthlyEntry.entry_month.desc())
        .limit(limit)
    )
    if from_month:
        from datetime import date as _date

        stmt = stmt.where(MonthlyEntry.entry_month >= _date.fromisoformat(from_month))
    if to_month:
        from datetime import date as _date

        stmt = stmt.where(MonthlyEntry.entry_month <= _date.fromisoformat(to_month))

    result = await db.execute(stmt)
    entries = list(result.scalars().all())

    # Build responses with MoM changes
    responses: list[EntryResponse] = []
    for i, entry in enumerate(entries):
        prev = entries[i + 1] if i + 1 < len(entries) else None
        prev_val = prev.current_value if prev else None
        responses.append(_build_entry_response(entry, prev_val, None))

    return EntryListResponse(
        entries=responses,
        count=len(responses),
        investment_id=investment_id,
        investment_name=inv.name,
    )


@router.delete(
    "/investments/{investment_id}/entries/{entry_id}",
    status_code=204,
)
async def delete_entry(
    investment_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a specific monthly entry."""
    # Verify investment ownership
    await _get_investment_for_user(investment_id, current_user, db)

    result = await db.execute(
        select(MonthlyEntry).where(
            MonthlyEntry.id == entry_id,
            MonthlyEntry.investment_id == investment_id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise NotFoundException("MonthlyEntry", str(entry_id))

    await db.delete(entry)
