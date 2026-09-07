"""Domänen-Fehler. Services werfen diese - nie `fastapi.HTTPException`.
Ein zentraler Handler in app.py mappt auf HTTP.

Mapping (bewusst abweichend vom Sketch in ARCHITEKTUR.md §3.2):
- NotFoundError      -> 404
- ConflictError      -> 409  (Name existiert, Kategorie nicht leer, keine aktive Veranstaltung)
- ValidationError    -> 400  (Geschäftsregel: Preis < 0, Name leer/zu lang, ...)
- DepositNotAllowedError -> 400
Request-Shape-Fehler bleiben Pydantic/FastAPI -> 422.
"""
from __future__ import annotations


class DomainError(Exception):
    status_code = 400

    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class NotFoundError(DomainError):
    status_code = 404


class ConflictError(DomainError):
    status_code = 409


class ValidationError(DomainError):
    status_code = 400


class DepositNotAllowedError(DomainError):
    status_code = 400
