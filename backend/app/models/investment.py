"""Investment ORM model."""

import enum
import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, Enum, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.goal import Goal
    from app.models.monthly_entry import MonthlyEntry
    from app.models.user import User


class AssetClass(enum.StrEnum):
    EQUITY_MF = "equity_mf"
    DEBT_MF = "debt_mf"
    FIXED_DEPOSIT = "fixed_deposit"
    GOLD = "gold"
    REAL_ESTATE = "real_estate"
    SMALLCASE = "smallcase"


class Investment(TimestampMixin, Base):
    __tablename__ = "investments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("goals.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    asset_class: Mapped[AssetClass] = mapped_column(
        Enum(AssetClass, name="asset_class", values_callable=lambda e: [x.value for x in e]),
        nullable=False,
    )
    # Annual expected CAGR — e.g. 12.50 means 12.50 %
    expected_cagr: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    goal: Mapped["Goal"] = relationship("Goal", back_populates="investments")
    user: Mapped["User"] = relationship("User", back_populates="investments")
    monthly_entries: Mapped[list["MonthlyEntry"]] = relationship(
        "MonthlyEntry",
        back_populates="investment",
        cascade="all, delete-orphan",
        lazy="select",
    )

    __table_args__ = (
        CheckConstraint(
            "expected_cagr >= 0 AND expected_cagr <= 100",
            name="chk_investments_cagr",
        ),
        Index("idx_investments_goal_id", "goal_id"),
        Index("idx_investments_user_id", "user_id"),
        Index("idx_investments_asset_class", "asset_class"),
    )

    def __repr__(self) -> str:
        return f"<Investment id={self.id} name={self.name!r} asset_class={self.asset_class}>"
