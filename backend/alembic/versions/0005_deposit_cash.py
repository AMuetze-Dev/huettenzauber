"""Gemischte Pfandrueckgabe + Bargeldbewegungen

1. Pfandrueckgabe im laufenden Vorgang wird zur Liste: ein Gast bringt
   3 Weinglaeser (2,00 €) und 2 Bierglaeser (1,50 €) zusammen zurueck.
   Die alten Einzelfelder an `active_order` fallen weg (fluechtiger Zustand,
   nichts zu retten).
2. `cash_movement`: Wechselgeld nachlegen / Geld in den Tresor bringen.

Revision ID: 0005_deposit_cash
Revises: 0004_active_order_revision
Create Date: 2026-09-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_deposit_cash"
down_revision: Union[str, Sequence[str], None] = "0004_active_order_revision"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "active_deposit_return",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("unit_amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["event_id"], ["active_order.event_id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "unit_amount", name="uq_active_deposit_unit"),
    )
    op.create_index(
        op.f("ix_active_deposit_return_event_id"),
        "active_deposit_return",
        ["event_id"],
    )

    op.create_table(
        "cash_movement",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("business_day", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("reason", sa.String(length=120), server_default="", nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["event.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cash_movement_event_id"), "cash_movement", ["event_id"])
    op.create_index(
        op.f("ix_cash_movement_business_day"), "cash_movement", ["business_day"]
    )

    op.drop_column("active_order", "deposit_return_unit_amount")
    op.drop_column("active_order", "deposit_return_quantity")


def downgrade() -> None:
    op.add_column(
        "active_order",
        sa.Column("deposit_return_quantity", sa.Integer(), nullable=True),
    )
    op.add_column(
        "active_order",
        sa.Column(
            "deposit_return_unit_amount",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
        ),
    )
    op.drop_index(op.f("ix_cash_movement_business_day"), table_name="cash_movement")
    op.drop_index(op.f("ix_cash_movement_event_id"), table_name="cash_movement")
    op.drop_table("cash_movement")
    op.drop_index(
        op.f("ix_active_deposit_return_event_id"), table_name="active_deposit_return"
    )
    op.drop_table("active_deposit_return")
