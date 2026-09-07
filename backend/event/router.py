from fastapi import APIRouter, Depends, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from schemas import EventCreate, EventOut, EventUpdate

from . import service

router = APIRouter(prefix="/api/events", tags=["event"])


@router.get("", response_model=list[EventOut])
def list_events(db: Session = Depends(get_db)):
    return service.list_events(db)


@router.get("/active")
def get_active_event(db: Session = Depends(get_db)):
    """Die aktive Veranstaltung, oder 204 wenn keine aktiv ist."""
    event = service.get_active_event(db)
    if event is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return JSONResponse(jsonable_encoder(EventOut.model_validate(event)))


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, db: Session = Depends(get_db)):
    return service.create_event(db, payload.catalog_id, payload.name)


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: Session = Depends(get_db)):
    return service.get_event(db, event_id)


@router.put("/{event_id}", response_model=EventOut)
def update_event(event_id: int, payload: EventUpdate, db: Session = Depends(get_db)):
    return service.update_event(db, event_id, payload.name)


@router.post("/{event_id}/activate", response_model=EventOut)
def activate_event(event_id: int, db: Session = Depends(get_db)):
    return service.activate_event(db, event_id)


@router.post("/{event_id}/archive", response_model=EventOut)
def archive_event(event_id: int, db: Session = Depends(get_db)):
    return service.archive_event(db, event_id)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    service.delete_event(db, event_id)
