"""Goal ORM model."""

import enum
import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, Enum, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.investment import Investment
    from app.models.user import User


class GoalStatus(enum.StrEnum):
    ACTIVE = "active"
    ACHIEVED = "achieved"
    ABANDONED = "abandoned"


class Goal(TimestampMixin, Base):
    __tablename__ = "goals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[GoalStatus] = mapped_column(
        Enum(GoalStatus, name="goal_status", values_callable=lambda e: [x.value for x in e]),
        nullable=False,
        default=GoalStatus.ACTIVE,
    )

    user: Mapped["User"] = relationship("User", back_populates="goals")
    investments: Mapped[list["Investment"]] = relationship(
        "Investment",
        back_populates="goal",
        cascade="all, delete-orphan",
        lazy="select",
    )

    __table_args__ = (
        CheckConstraint("target_amount > 0", name="chk_goals_target_amount"),
        Index("idx_goals_user_id", "user_id"),
        Index("idx_goals_status", "user_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<Goal id={self.id} name={self.name!r} status={self.status}>"
