import asyncio
import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from event.service import require_active_event
from schemas import ActiveOrderOut, DepositReturnIn, LineDelta

from . import events, service

router = APIRouter(prefix="/api/active-order", tags=["order"])

_KEEPALIVE_SECONDS = 20


@router.get("", response_model=ActiveOrderOut)
def get_active_order(db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.view(db, event.id)


@router.post("/lines", response_model=ActiveOrderOut)
def apply_line_delta(payload: LineDelta, db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.apply_delta(db, event.id, payload.variant_id, payload.delta)


@router.delete("", response_model=ActiveOrderOut)
def clear_active_order(db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.clear_order(db, event.id)


@router.put("/deposit-return", response_model=ActiveOrderOut)
def set_deposit_return(payload: DepositReturnIn, db: Session = Depends(get_db)):
    """Setzt die Stueckzahl fuer einen Pfandbetrag; andere Betraege bleiben."""
    event = require_active_event(db)
    return service.set_deposit_return(db, event.id, payload.unit_amount, payload.quantity)


@router.delete("/deposit-return", response_model=ActiveOrderOut)
def clear_deposit_returns(db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.clear_deposit_returns(db, event.id)


@router.get("/stream")
async def stream(db: Session = Depends(get_db)):
    """Server-Sent Events: aktueller Stand bei Connect, danach bei jeder Aenderung.
    Nach dem ersten Read kein DB-Zugriff mehr - nur die In-Process-Queue."""
    event = require_active_event(db)
    initial = service.view(db, event.id).model_dump(mode="json")
    # Transaktion sofort beenden und die Verbindung an den Pool zurueckgeben.
    # Die Dependency haelt die Session sonst ueber die gesamte Stream-Dauer -
    # zwei Displays plus Handy blockierten damit dauerhaft drei Verbindungen
    # als "idle in transaction" und jedes `alembic upgrade` lief in den Lock.
    db.commit()

    async def gen():
        yield f"data: {json.dumps(initial)}\n\n"
        async with events.subscribe() as queue:
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), _KEEPALIVE_SECONDS)
                    yield f"data: {json.dumps(payload)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
