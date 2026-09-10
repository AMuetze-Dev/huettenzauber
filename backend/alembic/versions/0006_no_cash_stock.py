"""Kassenbestand faellt weg

Im Alltagsgeschaeft wandert staendig Geld in die Kasse und wieder heraus:
Trinkgeld, Zwischenablagen im Tresor, nachgelegtes Wechselgeld. Diese
Bewegungen werden nicht zuverlaessig erfasst - damit war jeder Soll-Ist-
Vergleich nur scheingenau und hat mehr Fragen aufgeworfen als beantwortet.

Weg fallen: gezaehlter Bestand, Wechselgeld-Startbestand, Bargeldbewegungen.
Es bleibt, was hart belegt ist: was ueber die Theke ging (Bons, Pfand,
Pfandrueckgaben) und der Tagesabschluss.

Revision ID: 0006_no_cash_stock
Revises: 0005_deposit_cash
Create Date: 2026-09-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006_no_cash_stock"
down_revision: Union[str, Sequence[str], None] = "0005_deposit_cash"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f("ix_cash_movement_business_day"), table_name="cash_movement")
    op.drop_index(op.f("ix_cash_movement_event_id"), table_name="cash_movement")
    op.drop_table("cash_movement")
    op.drop_table("cash_float")
    op.drop_column("day_close", "counted_cash")
    op.drop_column("day_close", "opening_float")


def downgrade() -> None:
    op.add_column(
        "day_close",
        sa.Column(
            "opening_float",
            sa.Numeric(precision=10, scale=2),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "day_close",
        sa.Column("counted_cash", sa.Numeric(precision=10, scale=2), nullable=True),
    )
    op.create_table(
        "cash_float",
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("business_day", sa.Date(), nullable=False),
        sa.Column(
            "amount", sa.Numeric(precision=10, scale=2), server_default="0", nullable=False
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["event_id"], ["event.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("event_id", "business_day"),
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
