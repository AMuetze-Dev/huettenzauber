# Hüttenzauber Backend

FastAPI + SQLAlchemy 2.0 + PostgreSQL.

## Setup

```bash
cd backend
uv sync --group dev
```

Abhängigkeiten stehen in `pyproject.toml`. `requirements.txt` wird daraus per
`uv export --no-hashes --no-dev -o requirements.txt` erzeugt (die Dockerfiles
nutzen es weiterhin).

## Konfiguration

Einzige Variable: **`DATABASE_URL`**
(Default `postgresql+psycopg2://root:root@db:5432/huettenzauber`).
`DATABASE_HOST` wird noch als Fallback unterstützt, gibt aber eine
`DeprecationWarning` aus.

## Datenbank-Schema

Schema-Hoheit liegt bei Alembic – nicht mehr bei `create_all`:

```bash
uv run alembic upgrade head      # Schema anlegen / aktualisieren
uv run alembic revision -m "..."      # neue Migration
```

Stand Stufe 1: nur eine leere Baseline-Revision. Das echte v2-Schema kommt in
Stufe 2; bis dahin ist `alembic upgrade head` auf einer frischen DB praktisch
ein No-Op (die Tests bauen ihr Schema selbst per `create_all`).

## Tests

```bash
uv run pytest
```

Braucht einen laufenden **Docker-Daemon**: `testcontainers` startet für den
Testlauf automatisch einen `postgres:17-bookworm`-Container. Kein manuelles
Setup, kein SQLite. Isolation pro Test über eine äußere Transaktion mit
`join_transaction_mode="create_savepoint"` – der Code darf frei committen.

## App starten (Entwicklung)

```bash
uv run alembic upgrade head
uv run uvicorn app:app --reload
```
