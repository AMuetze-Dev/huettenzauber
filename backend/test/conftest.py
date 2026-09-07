"""Gemeinsames Test-Fundament.

- Ein PostgreSQL-Container pro Testlauf (testcontainers).
- Schema einmal via create_all (bis Stufe 2 Alembic uebernimmt).
- Isolation pro Test ueber die SQLAlchemy-2.0-Rezeptur "join into external
  transaction" mit join_transaction_mode="create_savepoint": der App-Code darf
  frei committen/rollbacken, am Test-Ende rollt die Aussentransaktion alles zurueck.
  https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#joining-a-session-into-an-external-transaction-such-as-for-test-suites
"""
import os

# Ryuk (Resource-Reaper-Container) auf Docker Desktop / Windows oft nicht erreichbar.
# Container werden ueber den with-Block der Fixture ohnehin sauber gestoppt.
os.environ.setdefault("TESTCONTAINERS_RYUK_DISABLED", "true")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from testcontainers.community.postgres import PostgresContainer

from app import app
from database import get_db, make_engine
from models import Base


@pytest.fixture(scope="session")
def _postgres():
    with PostgresContainer("postgres:17-bookworm") as pg:
        yield pg


@pytest.fixture(scope="session")
def engine(_postgres):
    eng = make_engine(_postgres.get_connection_url())
    Base.metadata.create_all(eng)
    try:
        yield eng
    finally:
        eng.dispose()


@pytest.fixture
def db_session(engine):
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        with TestClient(app, raise_server_exceptions=True) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


# --- Bausteine fuer die Domaenen-Tests -----------------------------------
@pytest.fixture
def catalog_id(client) -> int:
    return client.post("/api/catalogs", json={"name": "Testkatalog"}).json()["id"]


@pytest.fixture
def active_event(client, catalog_id):
    """Aktive Veranstaltung + ein Artikel mit einer Variante.

    Gibt (event_id, variant_id, deposit_amount) zurueck.
    """
    cat = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "Getränke"}
    ).json()
    item = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "Helles",
            "category_id": cat["id"],
            "deposit_amount": "0",
            "variants": [{"name": "0,5 l", "price": "4.60"}],
        },
    ).json()
    event = client.post(
        "/api/events", json={"catalog_id": catalog_id, "name": "Testfest"}
    ).json()
    client.post(f"/api/events/{event['id']}/activate")
    return event["id"], item["variants"][0]["id"]
