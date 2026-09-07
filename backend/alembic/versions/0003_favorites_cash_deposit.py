"""Schnellzugriff/Farbe am Artikel, Kassenbestand, Pfandrueckgabe je Betriebstag

Revision ID: 0003_favorites_cash_deposit
Revises: 0002_v2_schema
Create Date: 2026-09-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_favorites_cash_deposit"
down_revision: Union[str, Sequence[str], None] = "0002_v2_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Startgeld je Veranstaltung + Betriebstag
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

    # Kassenschnitt am Tagesabschluss
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

    # Pfandrueckgaben je Betriebstag auswertbar machen.
    # Bestandszeilen bekommen CURRENT_DATE, danach faellt der Default weg.
    op.add_column(
        "deposit_return",
        sa.Column(
            "business_day",
            sa.Date(),
            server_default=sa.text("CURRENT_DATE"),
            nullable=False,
        ),
    )
    op.alter_column("deposit_return", "business_day", server_default=None)
    op.create_index(
        op.f("ix_deposit_return_business_day"),
        "deposit_return",
        ["business_day"],
        unique=False,
    )

    # Schnellzugriff + optionale Kachelfarbe
    op.add_column(
        "stock_item",
        sa.Column(
            "is_favorite", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
    )
    op.add_column("stock_item", sa.Column("color", sa.String(length=7), nullable=True))


def downgrade() -> None:
    op.drop_column("stock_item", "color")
    op.drop_column("stock_item", "is_favorite")
    op.drop_index(op.f("ix_deposit_return_business_day"), table_name="deposit_return")
    op.drop_column("deposit_return", "business_day")
    op.drop_column("day_close", "counted_cash")
    op.drop_column("day_close", "opening_float")
    op.drop_table("cash_float")
