# Backend-Image. Standard-CMD ist Produktion (kein Reload).
# Der Dev-Modus ueberschreibt `command:` in docker-compose.yml (Bind-Mount + --reload).
FROM python:3.13-slim

ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WATCHFILES_FORCE_POLLING=true

# psycopg2-binary bringt libpq statisch mit -> keine Build-Tools noetig.
#
# pg_dump wird gebraucht: ohne ihn schreibt der Tagesabschluss stillschweigend
# keine Sicherung. Seine Version muss >= der des Servers sein (aktuell 17) -
# ein aelterer pg_dump verweigert den Dump. Debian 13 liefert 17 direkt mit.
# Der Test laesst den Build scheitern, falls das Basisimage einmal etwas
# Aelteres mitbringt, statt ein Image mit totem Backup auszuliefern.
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client \
 && rm -rf /var/lib/apt/lists/* \
 && pg_dump --version \
 && test "$(pg_dump --version | awk '{print $3}' | cut -d. -f1)" -ge 17

RUN pip install --no-cache-dir uv

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

EXPOSE 8000

# Produktion: Schema aktualisieren, dann uvicorn ohne Reload.
CMD ["sh", "-c", "uv run --no-sync alembic upgrade head && exec uv run --no-sync uvicorn app:app --host 0.0.0.0 --port 8000"]
