"""Kleine DB-Helfer, die Infrastruktur-Fehler in Domänen-Fehler übersetzen."""
from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.exceptions import ConflictError


def commit(db: Session, *, on_conflict: str = "Integritätsverletzung") -> None:
    """`db.commit()` mit Rollback + ConflictError bei Constraint-Verletzung.

    Alles andere fliegt bis zum 500-Handler - kein `except Exception`.
    """
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(on_conflict) from exc
