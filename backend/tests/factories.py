"""Simple factory functions for test data (no factory_boy dependency)."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING

from app.core.security import hash_password
from app.models.goal import Goal, GoalStatus
from app.models.investment import AssetClass, Investment
from app.models.monthly_entry import MonthlyEntry
from app.models.user import User

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def make_user(
    db: AsyncSession,
    *,
    email: str = "user@test.com",
    password: str = "TestPass123!@",
    full_name: str = "Test User",
    is_active: bool = True,
) -> User:
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        is_active=is_active,
    )
    db.add(user)
    await db.flush()
    return user


async def make_goal(
    db: AsyncSession,
    user: User,
    *,
    name: str = "Test Goal",
    target_amount: Decimal = Decimal("1000000.00"),
    target_date: date | None = None,
    status: GoalStatus = GoalStatus.ACTIVE,
) -> Goal:
    if target_date is None:
        target_date = date.today() + timedelta(days=365 * 10)
    goal = Goal(
        user_id=user.id,
        name=name,
        target_amount=target_amount,
        target_date=target_date,
        status=status,
    )
    db.add(goal)
    await db.flush()
    return goal


async def make_investment(
    db: AsyncSession,
    user: User,
    goal: Goal,
    *,
    name: str = "Test Fund",
    asset_class: AssetClass = AssetClass.EQUITY_MF,
    expected_cagr: Decimal = Decimal("12.00"),
    is_active: bool = True,
) -> Investment:
    inv = Investment(
        goal_id=goal.id,
        user_id=user.id,
        name=name,
        asset_class=asset_class,
        expected_cagr=expected_cagr,
        is_active=is_active,
    )
    db.add(inv)
    await db.flush()
    return inv


async def make_entry(
    db: AsyncSession,
    investment: Investment,
    *,
    entry_month: date | None = None,
    total_invested: Decimal = Decimal("100000.00"),
    current_value: Decimal = Decimal("120000.00"),
) -> MonthlyEntry:
    if entry_month is None:
        entry_month = date.today().replace(day=1)
    entry = MonthlyEntry(
        investment_id=investment.id,
        entry_month=entry_month,
        total_invested=total_invested,
        current_value=current_value,
    )
    db.add(entry)
    await db.flush()
    return entry
