"""baseline (leer)

Alembic-Startpunkt. Das echte v2-Schema kommt als naechste Revision (Stufe 2).
Auf einer bestehenden IST-DB ist `alembic upgrade head` damit ein No-Op.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-09-07
"""
from typing import Sequence, Union

revision: str = "0001_baseline"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
