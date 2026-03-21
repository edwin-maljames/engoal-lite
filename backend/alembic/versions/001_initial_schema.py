"""Initial database schema

Revision ID: 001
Revises:
Create Date: 2026-02-22 00:00:00.000000+00:00

"""

from __future__ import annotations

from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

if TYPE_CHECKING:
    from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Extensions
    # ------------------------------------------------------------------
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    # ------------------------------------------------------------------
    # Enum types
    # ------------------------------------------------------------------
    asset_class = postgresql.ENUM(
        "equity_mf",
        "debt_mf",
        "fixed_deposit",
        "gold",
        "real_estate",
        "smallcase",
        name="asset_class",
    )
    asset_class.create(op.get_bind(), checkfirst=True)

    rag_status = postgresql.ENUM("green", "amber", "red", name="rag_status")
    rag_status.create(op.get_bind(), checkfirst=True)

    goal_status = postgresql.ENUM("active", "achieved", "abandoned", name="goal_status")
    goal_status.create(op.get_bind(), checkfirst=True)

    # ------------------------------------------------------------------
    # Table: users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("idx_users_email", "users", ["email"])

    # ------------------------------------------------------------------
    # Table: goals
    # ------------------------------------------------------------------
    op.create_table(
        "goals",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("active", "achieved", "abandoned", name="goal_status"),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_goals_user", ondelete="CASCADE"
        ),
        sa.CheckConstraint("target_amount > 0", name="chk_goals_target_amount"),
    )
    op.create_index("idx_goals_user_id", "goals", ["user_id"])
    op.create_index("idx_goals_status", "goals", ["user_id", "status"])

    # ------------------------------------------------------------------
    # Table: investments
    # ------------------------------------------------------------------
    op.create_table(
        "investments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("goal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column(
            "asset_class",
            sa.Enum(
                "equity_mf",
                "debt_mf",
                "fixed_deposit",
                "gold",
                "real_estate",
                "smallcase",
                name="asset_class",
            ),
            nullable=False,
        ),
        sa.Column("expected_cagr", sa.Numeric(5, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(
            ["goal_id"], ["goals.id"], name="fk_investments_goal", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_investments_user", ondelete="CASCADE"
        ),
        sa.CheckConstraint(
            "expected_cagr >= 0 AND expected_cagr <= 100", name="chk_investments_cagr"
        ),
    )
    op.create_index("idx_investments_goal_id", "investments", ["goal_id"])
    op.create_index("idx_investments_user_id", "investments", ["user_id"])
    op.create_index("idx_investments_asset_class", "investments", ["asset_class"])

    # ------------------------------------------------------------------
    # Table: monthly_entries
    # ------------------------------------------------------------------
    op.create_table(
        "monthly_entries",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("investment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entry_month", sa.Date(), nullable=False),
        sa.Column("total_invested", sa.Numeric(15, 2), nullable=False),
        sa.Column("current_value", sa.Numeric(15, 2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(
            ["investment_id"], ["investments.id"], name="fk_entries_investment", ondelete="CASCADE"
        ),
        sa.CheckConstraint("total_invested >= 0", name="chk_entries_total_invested"),
        sa.CheckConstraint("current_value >= 0", name="chk_entries_value"),
        sa.UniqueConstraint("investment_id", "entry_month", name="uq_entries_investment_month"),
    )
    op.create_index("idx_entries_investment_id", "monthly_entries", ["investment_id"])
    op.create_index("idx_entries_month", "monthly_entries", ["entry_month"])
    op.create_index(
        "idx_entries_investment_month", "monthly_entries", ["investment_id", "entry_month"]
    )

    # ------------------------------------------------------------------
    # Table: refresh_tokens
    # ------------------------------------------------------------------
    op.create_table(
        "refresh_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_refresh_tokens_user", ondelete="CASCADE"
        ),
    )
    op.create_index("idx_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("idx_refresh_tokens_hash", "refresh_tokens", ["token_hash"])

    # ------------------------------------------------------------------
    # Triggers: auto-update updated_at
    # ------------------------------------------------------------------
    op.execute("""
        CREATE OR REPLACE FUNCTION trigger_set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    for table in ("users", "goals", "investments", "monthly_entries"):
        op.execute(f"""
            CREATE TRIGGER set_{table}_updated_at
                BEFORE UPDATE ON {table}
                FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
        """)


def downgrade() -> None:
    for table in ("users", "goals", "investments", "monthly_entries"):
        op.execute(f"DROP TRIGGER IF EXISTS set_{table}_updated_at ON {table}")

    op.execute("DROP FUNCTION IF EXISTS trigger_set_updated_at()")

    op.drop_table("refresh_tokens")
    op.drop_table("monthly_entries")
    op.drop_table("investments")
    op.drop_table("goals")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS asset_class")
    op.execute("DROP TYPE IF EXISTS rag_status")
    op.execute("DROP TYPE IF EXISTS goal_status")
