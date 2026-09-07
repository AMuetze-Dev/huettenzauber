from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.db import commit
from core.exceptions import ConflictError, NotFoundError, ValidationError
from models import ActiveOrder, Bill, Catalog, Event

NAME_MAX = 80


def _clean_name(value: str) -> str:
    text = (value or "").strip()
    if not text:
        raise ValidationError("Veranstaltungsname darf nicht leer sein")
    if len(text) > NAME_MAX:
        raise ValidationError(f"Veranstaltungsname darf höchstens {NAME_MAX} Zeichen haben")
    return text


def _get_event(db: Session, event_id: int) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise NotFoundError("Veranstaltung nicht gefunden")
    return event


def list_events(db: Session) -> list[Event]:
    return list(db.scalars(select(Event).order_by(Event.started_at.desc(), Event.id.desc())))


def get_event(db: Session, event_id: int) -> Event:
    return _get_event(db, event_id)


def get_active_event(db: Session) -> Event | None:
    return db.scalars(select(Event).where(Event.is_active.is_(True))).first()


def require_active_event(db: Session) -> Event:
    event = get_active_event(db)
    if event is None:
        raise ConflictError("Keine aktive Veranstaltung")
    return event


def create_event(db: Session, catalog_id: int, name: str) -> Event:
    if db.get(Catalog, catalog_id) is None:
        raise NotFoundError("Katalog nicht gefunden")
    event = Event(catalog_id=catalog_id, name=_clean_name(name), is_active=False)
    db.add(event)
    commit(db)
    db.refresh(event)
    return event


def update_event(db: Session, event_id: int, name: str) -> Event:
    event = _get_event(db, event_id)
    event.name = _clean_name(name)
    commit(db)
    db.refresh(event)
    return event


def activate_event(db: Session, event_id: int) -> Event:
    event = _get_event(db, event_id)
    if event.ended_at is not None:
        raise ConflictError("Archivierte Veranstaltung kann nicht aktiviert werden")

    current = get_active_event(db)
    if current is not None and current.id != event_id:
        current.is_active = False
        db.flush()  # partial unique index: alten Aktiv-Status erst freigeben

    event.is_active = True
    if db.get(ActiveOrder, event_id) is None:
        db.add(ActiveOrder(event_id=event_id))
    commit(db)
    db.refresh(event)
    return event


def archive_event(db: Session, event_id: int) -> Event:
    event = _get_event(db, event_id)
    event.is_active = False
    if event.ended_at is None:
        event.ended_at = datetime.now(timezone.utc)
    commit(db)
    db.refresh(event)
    return event


def delete_event(db: Session, event_id: int) -> None:
    event = _get_event(db, event_id)
    if db.scalars(select(Bill.id).where(Bill.event_id == event_id)).first():
        raise ConflictError(
            "Veranstaltung kann nicht gelöscht werden - es gibt Bons dazu (stattdessen archivieren)"
        )
    db.delete(event)
    commit(db)
