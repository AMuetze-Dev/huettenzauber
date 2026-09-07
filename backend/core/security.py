"""Optionaler Zugangscode fuer schreibende Endpunkte.

Der Pi spannt einen offenen Hotspot auf - ohne Schutz kann jeder in
Funkreichweite Bons aendern. Ist `ACCESS_CODE` leer, ist der Schutz aus
(Default, damit Dev und bestehende Installationen unveraendert laufen).

Client schickt den Code als Header `X-Access-Code`.
"""
from __future__ import annotations

import hmac

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from core.config import settings

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
HEADER = "X-Access-Code"
# Diese Pfade bleiben immer offen (Health, Doku, Anmelde-Pruefung).
OPEN_PATHS = frozenset({"/api/health", "/api/access-check", "/openapi.json", "/docs", "/redoc"})


class AccessCodeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        code = settings.access_code.strip()
        if (
            code
            and request.method not in SAFE_METHODS
            and request.url.path not in OPEN_PATHS
        ):
            sent = request.headers.get(HEADER, "")
            if not hmac.compare_digest(sent, code):
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Zugangscode fehlt oder ist falsch"},
                )
        return await call_next(request)


def access_required() -> bool:
    return bool(settings.access_code.strip())


def check_code(candidate: str) -> bool:
    code = settings.access_code.strip()
    if not code:
        return True
    return hmac.compare_digest(candidate or "", code)
