# Betrieb

## Entwicklung (lokal, Docker Desktop)

```
docker compose up -d --build
```

- Bind-Mounts + Hot-Reload: Code speichern = sofort im Container.
- Zugriff: Terminal `http://localhost:3000/order`, Gastanzeige `http://localhost:3000/guest`,
  Verwaltung `http://localhost:3000/verwaltung`.
- pgAdmin: `http://localhost:5050`, DB direkt auf `localhost:5432` (root/root).
- Neu bauen noetig nur bei geaenderten Dependencies:
  - Backend: `pyproject.toml` / `uv.lock` -> `docker compose up -d --build backend`
  - Frontend: `package.json` -> `docker compose up -d --build --renew-anon-volumes frontend`

## Produktion (Raspberry Pi)

```
cp .env.example .env      # anpassen: POSTGRES_PASSWORD, CORS_ORIGINS
docker compose -f docker-compose.prod.yml up -d --build
```

- Ein Einstiegspunkt: `http://<pi>/` (Frontend-Container liefert das gebaute
  SPA-Bundle und proxyt `/api` ans Backend).
- Kein pgAdmin, kein Reload, keine offengelegten DB-/Backend-Ports.
- Alembic-Migrationen laufen beim Backend-Start automatisch (`alembic upgrade head`).
- Images gepinnt: `postgres:17-bookworm`, `node:22.12-alpine`, `nginx:1.27-alpine`.
- DB-Daten im Named Volume `pgdata` (ueberlebt `down`/`up`; **kein automatisches Backup**).

### Kiosk-URLs auf dem Pi

- 10" Bedienterminal: `http://localhost/order`
- 7" Kundendisplay:   `http://localhost/guest`
