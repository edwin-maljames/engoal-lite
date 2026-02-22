"""Pydantic schemas for Investment endpoints."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.investment import AssetClass
from app.schemas._types import JSONDecimal

# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class InvestmentCreate(BaseModel):
    goal_id: uuid.UUID
    name: str = Field(..., min_length=1, max_length=200)
    asset_class: AssetClass
    expected_cagr: Decimal = Field(..., ge=0, le=100)
    notes: str | None = Field(None, max_length=1000)


class InvestmentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    expected_cagr: Decimal | None = Field(None, ge=0, le=100)
    is_active: bool | None = None
    notes: str | None = Field(None, max_length=1000)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class InvestmentResponse(BaseModel):
    id: uuid.UUID
    goal_id: uuid.UUID
    goal_name: str
    name: str
    asset_class: AssetClass
    expected_cagr: JSONDecimal
    is_active: bool
    # Computed from latest MonthlyEntry (None if no entries yet)
    latest_total_invested: JSONDecimal | None
    latest_current_value: JSONDecimal | None
    unrealized_gain: JSONDecimal | None
    absolute_return_pct: JSONDecimal | None
    latest_entry_month: date | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvestmentListResponse(BaseModel):
    investments: list[InvestmentResponse]
    count: int
