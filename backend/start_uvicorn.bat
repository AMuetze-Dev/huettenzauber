set DATABASE_URL=postgresql+psycopg2://root:root@localhost:5432/huettenzauber
uv run alembic upgrade head
uv run uvicorn app:app --reload
