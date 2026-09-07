# Backend-Image. Standard-CMD ist Produktion (kein Reload).
# Der Dev-Modus ueberschreibt `command:` in docker-compose.yml (Bind-Mount + --reload).
FROM python:3.13-slim

ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WATCHFILES_FORCE_POLLING=true

# psycopg2-binary bringt libpq statisch mit -> keine Build-Tools noetig.
RUN pip install --no-cache-dir uv

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

EXPOSE 8000

# Produktion: Schema aktualisieren, dann uvicorn ohne Reload.
CMD ["sh", "-c", "uv run --no-sync alembic upgrade head && exec uv run --no-sync uvicorn app:app --host 0.0.0.0 --port 8000"]
