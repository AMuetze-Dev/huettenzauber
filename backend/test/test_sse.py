"""Stufe 5 - SSE-Stream fuer das Kundendisplay.

Der eigentliche Stream (initialer Stand + Live-Push bei jeder Aenderung) wird
gegen den laufenden Container per curl verifiziert - SSE ueber den sync-
TestClient blockiert. Hier nur der billige Fehlerpfad.
"""


def test_stream_without_active_event_conflicts(client):
    assert client.get("/api/active-order/stream").status_code == 409
