"""Pydantic schemas for the Dashboard endpoint."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.schemas._types import JSONDecimal


class DashboardSummary(BaseModel):
    total_invested: JSONDecimal
    total_invested_formatted: str
    total_current_value: JSONDecimal
    total_current_value_formatted: str
    total_unrealized_gain: JSONDecimal
    overall_return_pct: JSONDecimal | None
    active_goals: int
    goals_on_track: int
    goals_at_risk: int


class AssetAllocationItem(BaseModel):
    asset_class: str
    current_value: JSONDecimal
    allocation_pct: JSONDecimal


class DashboardGoalItem(BaseModel):
    id: uuid.UUID
    name: str
    target_amount: JSONDecimal
    target_amount_formatted: str
    rag_status: str
    progress_pct: JSONDecimal
    target_date: date


class RecentEntryItem(BaseModel):
    investment_id: uuid.UUID
    investment_name: str
    goal_name: str
    entry_month: date
    current_value: JSONDecimal
    total_invested: JSONDecimal
    created_at: datetime


class DashboardResponse(BaseModel):
    summary: DashboardSummary
    asset_allocation: list[AssetAllocationItem]
    goals: list[DashboardGoalItem]
    recent_entries: list[RecentEntryItem]
