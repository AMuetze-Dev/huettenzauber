import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from billing.router import router as billing_router
from catalog.router import router as catalog_router
from core.config import settings
from core.exceptions import DomainError
from event.router import router as event_router
from order import events as order_events
from order.router import router as order_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Kein Schema-Aufbau hier - Schema-Hoheit liegt bei Alembic (`alembic upgrade head`).
    order_events.bind_loop(asyncio.get_running_loop())
    yield


app = FastAPI(lifespan=lifespan)


@app.exception_handler(DomainError)
async def _domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


app.include_router(catalog_router)
app.include_router(event_router)
app.include_router(order_router)
app.include_router(billing_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
