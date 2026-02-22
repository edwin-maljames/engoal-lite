"""Pydantic schemas for MonthlyEntry endpoints."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.schemas._types import JSONDecimal

# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class EntryCreate(BaseModel):
    """
    entry_month must be the first day of the month (e.g. 2026-02-01).
    total_invested is the CUMULATIVE total invested to date — NOT the monthly increment.
    """

    entry_month: date
    total_invested: Decimal = Field(..., ge=0)
    current_value: Decimal = Field(..., ge=0)

    @field_validator("entry_month")
    @classmethod
    def must_be_first_of_month(cls, v: date) -> date:
        if v.day != 1:
            raise ValueError(
                f"entry_month must be the first day of the month, got {v}. "
                f"Use {v.replace(day=1)} instead."
            )
        return v


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class EntryResponse(BaseModel):
    id: uuid.UUID
    investment_id: uuid.UUID
    entry_month: date
    total_invested: JSONDecimal
    current_value: JSONDecimal
    unrealized_gain: JSONDecimal
    absolute_return_pct: JSONDecimal | None
    month_over_month_value_change: JSONDecimal | None
    created_at: datetime
    updated_at: datetime
    # Included when the entry is created/updated (triggers RAG recalc)
    goal_rag_status: str | None = None

    model_config = {"from_attributes": True}


class EntryListResponse(BaseModel):
    entries: list[EntryResponse]
    count: int
    investment_id: uuid.UUID
    investment_name: str
