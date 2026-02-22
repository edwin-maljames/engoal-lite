"""MonthlyEntry ORM model — one snapshot per investment per calendar month."""

import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.investment import Investment


class MonthlyEntry(TimestampMixin, Base):
    __tablename__ = "monthly_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    investment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("investments.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Always set to the first of the month, e.g. 2026-02-01 for February 2026
    entry_month: Mapped[date] = mapped_column(Date, nullable=False)
    # Cumulative total invested in this investment to date (snapshot, NOT monthly increment)
    total_invested: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    # Mark-to-market value as of this month
    current_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)

    investment: Mapped["Investment"] = relationship(
        "Investment",
        back_populates="monthly_entries",
    )

    __table_args__ = (
        CheckConstraint("total_invested >= 0", name="chk_entries_total_invested"),
        CheckConstraint("current_value >= 0", name="chk_entries_value"),
        UniqueConstraint(
            "investment_id",
            "entry_month",
            name="uq_entries_investment_month",
        ),
        Index("idx_entries_investment_id", "investment_id"),
        Index("idx_entries_month", "entry_month"),
        Index("idx_entries_investment_month", "investment_id", "entry_month"),
    )

    def __repr__(self) -> str:
        return (
            f"<MonthlyEntry investment={self.investment_id} "
            f"month={self.entry_month} value={self.current_value}>"
        )
