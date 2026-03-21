"""Pydantic schemas for Goal endpoints."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.models.goal import GoalStatus
from app.schemas._types import JSONDecimal

# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class GoalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(None, max_length=1000)
    target_amount: Decimal = Field(..., gt=0, le=Decimal("9999999999999.99"))
    target_date: date

    @field_validator("target_date")
    @classmethod
    def target_date_must_be_future(cls, v: date) -> date:
        from datetime import date as _date

        if v <= _date.today():
            raise ValueError("Target date must be in the future.")
        return v


class GoalUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=1000)
    target_amount: Decimal | None = Field(None, gt=0, le=Decimal("9999999999999.99"))
    target_date: date | None = None
    status: GoalStatus | None = None

    @field_validator("target_date")
    @classmethod
    def target_date_must_be_future(cls, v: date | None) -> date | None:
        from datetime import date as _date

        if v is not None and v <= _date.today():
            raise ValueError("Target date must be in the future.")
        return v


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class GoalResponse(BaseModel):
    """Full goal representation returned from CRUD endpoints."""

    id: uuid.UUID
    name: str
    description: str | None
    target_amount: JSONDecimal
    target_amount_formatted: str
    target_date: date
    status: GoalStatus
    # Computed fields
    total_invested: JSONDecimal
    total_current_value: JSONDecimal
    total_projected_value: JSONDecimal
    progress_pct: JSONDecimal
    rag_status: str  # "green" | "amber" | "red"
    investment_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GoalListResponse(BaseModel):
    goals: list[GoalResponse]
    count: int


class InvestmentProjectionItem(BaseModel):
    id: uuid.UUID
    name: str
    asset_class: str
    latest_value: JSONDecimal
    expected_cagr: JSONDecimal
    projected_value: JSONDecimal


class GoalProjectionResponse(BaseModel):
    goal_id: uuid.UUID
    goal_name: str
    target_amount: JSONDecimal
    target_date: date
    years_remaining: JSONDecimal
    investments: list[InvestmentProjectionItem]
    total_current_value: JSONDecimal
    total_projected_value: JSONDecimal
    progress_pct: JSONDecimal
    rag_status: str
    shortfall: JSONDecimal
    shortfall_formatted: str
    recommended_monthly_sip: JSONDecimal | None


class GoalRAGStatusResponse(BaseModel):
    goal_id: uuid.UUID
    rag_status: str
    progress_pct: JSONDecimal
    shortfall: JSONDecimal
    shortfall_formatted: str
