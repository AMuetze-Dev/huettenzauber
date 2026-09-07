"""Revisionszaehler an der aktiven Bestellung

Zwei Eingabepunkte (10"-Terminal und Handy im Hotspot) tippen auf denselben
Warenkorb. Antworten und SSE-Nachrichten koennen sich dabei ueberholen; der
Zaehler laesst den Client den aelteren Stand verwerfen.

Revision ID: 0004_active_order_revision
Revises: 0003_favorites_cash_deposit
Create Date: 2026-09-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_active_order_revision"
down_revision: Union[str, Sequence[str], None] = "0003_favorites_cash_deposit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "active_order",
        sa.Column("revision", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("active_order", "revision")
