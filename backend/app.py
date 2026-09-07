import asyncio
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from billing.router import router as billing_router
from catalog.router import router as catalog_router
from core.config import settings
from core.exceptions import DomainError
from core.security import AccessCodeMiddleware, access_required, check_code
from database import get_db
from event.router import router as event_router
from order import events as order_events
from order.router import router as order_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Kein Schema-Aufbau hier - Schema-Hoheit liegt bei Alembic (`alembic upgrade head`).
    order_events.bind_loop(asyncio.get_running_loop())
    yield


app = FastAPI(lifespan=lifespan, title="Hüttenzauber API")


@app.exception_handler(DomainError)
async def _domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.get("/api/health", tags=["system"])
def health(db: Session = Depends(get_db)) -> dict:
    """Liveness + DB-Ping. Vom Compose-Healthcheck und vom Kiosk-Start genutzt."""
    db_ok = True
    detail = "ok"
    try:
        db.execute(sql_text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - Health darf nie werfen
        db_ok = False
        detail = type(exc).__name__
    return {
        "status": "ok" if db_ok else "degraded",
        "database": detail,
        "access_code_required": access_required(),
    }


@app.get("/api/access-check", tags=["system"])
def access_check(x_access_code: str | None = Header(default=None)) -> dict:
    """Prueft einen Zugangscode, ohne etwas zu veraendern."""
    return {"required": access_required(), "valid": check_code(x_access_code or "")}


app.include_router(catalog_router)
app.include_router(event_router)
app.include_router(order_router)
app.include_router(billing_router)

app.add_middleware(AccessCodeMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
