"""Automatische pg_dump-Sicherung.

Wird beim Tagesabschluss aufgerufen. Ist `BACKUP_DIR` leer, passiert nichts.
Fehler werden geloggt, nie geworfen - ein fehlgeschlagenes Backup darf den
Abschluss nicht verhindern.
"""
from __future__ import annotations

import logging
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from core.config import settings

log = logging.getLogger("huettenzauber.backup")

KEEP = 30  # aeltere Dumps werden entfernt


def _pg_env_and_args() -> tuple[dict[str, str], list[str]] | None:
    url = urlparse(settings.database_url.replace("postgresql+psycopg2://", "postgresql://"))
    if not url.hostname or not url.path:
        return None
    env = {"PGPASSWORD": url.password or ""}
    args = [
        "--host", url.hostname,
        "--port", str(url.port or 5432),
        "--username", url.username or "postgres",
        "--dbname", url.path.lstrip("/"),
        "--no-owner",
        "--no-privileges",
    ]
    return env, args


def dump_database(*, reason: str = "manual") -> Path | None:
    target_dir = settings.backup_dir.strip()
    if not target_dir:
        return None

    exe = shutil.which("pg_dump")
    if not exe:
        log.warning("Backup uebersprungen: pg_dump nicht gefunden")
        return None

    parsed = _pg_env_and_args()
    if parsed is None:
        log.warning("Backup uebersprungen: DATABASE_URL nicht auswertbar")
        return None
    env, args = parsed

    out_dir = Path(target_dir)
    try:
        out_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        log.warning("Backup-Verzeichnis nicht anlegbar: %s", exc)
        return None

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = out_dir / f"huettenzauber-{stamp}-{reason}.sql"

    try:
        import os

        with target.open("wb") as fh:
            subprocess.run(
                [exe, *args],
                stdout=fh,
                stderr=subprocess.PIPE,
                env={**os.environ, **env},
                check=True,
                timeout=300,
            )
    except (subprocess.SubprocessError, OSError) as exc:
        log.warning("Backup fehlgeschlagen: %s", exc)
        target.unlink(missing_ok=True)
        return None

    log.info("Backup geschrieben: %s", target)
    _prune(out_dir)
    return target


def _prune(out_dir: Path) -> None:
    try:
        dumps = sorted(out_dir.glob("huettenzauber-*.sql"))
        for old in dumps[:-KEEP]:
            old.unlink(missing_ok=True)
    except OSError as exc:  # pragma: no cover
        log.warning("Backup-Aufraeumen fehlgeschlagen: %s", exc)
