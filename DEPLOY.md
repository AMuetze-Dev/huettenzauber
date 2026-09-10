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

Stand 2026-09-10 im Betrieb auf **192.168.0.207** (Pi 5, Raspberry Pi OS
Bookworm, zwei HDMI-Displays je 1024x600).

### Erstmalig einrichten

```
ssh aaron@<pi>
mkdir -p ~/huettenzauber-v2 && cd ~/huettenzauber-v2
cp .env.example .env        # POSTGRES_PASSWORD, CORS_ORIGINS, BACKUP_HOST_DIR
chmod 600 .env
docker compose -f docker-compose.prod.yml up -d --build
```

### Aktualisieren

Vom Windows-Rechner aus:

```
.\deploy\deploy-pi.ps1
```

Das Skript packt den Quellcode (ohne `node_modules`, `.venv`, `.git`),
uebertraegt ihn, **baut auf dem Pi** und startet neu. Die `.env` auf dem Pi
bleibt dabei unangetastet. Danach wartet es, bis `/api/health` gruen meldet.

> Das alte `copy-huettenzauber.ps1` passt nicht mehr: es baute die Images per
> arm64-Emulation auf dem PC, schob sie als `.tar` hinueber und startete jeden
> Container einzeln - inklusive eines eigenen Proxy-Containers, den es in v2
> nicht mehr gibt (siehe D31 in ARCHITEKTUR.md).

### Eigenschaften

- Ein Einstiegspunkt: `http://<pi>/` (Frontend-Container liefert das gebaute
  SPA-Bundle und proxyt `/api` ans Backend). Backend und DB sind von aussen
  **nicht** erreichbar.
- Alembic-Migrationen laufen beim Backend-Start automatisch.
- Images gepinnt: `postgres:17-bookworm`, `node:22.12-alpine`, `nginx:1.27-alpine`.
- DB-Daten im Named Volume `pgdata`.
- `TZ=Europe/Berlin` in allen Containern - sonst laufen Logs und die
  Dateinamen der Sicherungen in UTC.

### Sicherungen

Beim Tagesabschluss schreibt das Backend einen `pg_dump` nach `BACKUP_DIR`
(im Container `/backups`, auf dem Pi der Pfad aus `BACKUP_HOST_DIR`, Vorgabe
`/home/aaron/huettenzauber-backups`). Die letzten 30 bleiben liegen.

Dafuer braucht das Backend-Image `pg_dump` in einer Version **>= der des
Servers**; das Dockerfile installiert `postgresql-client` und laesst den Build
scheitern, falls die Version kleiner als 17 ist.

Von Hand holen:

```
scp aaron@<pi>:'~/huettenzauber-backups/*.sql' .
```

### Sonstiges auf dem Pi

- `portainer` laeuft weiter auf Port 9443 und gehoert nicht zu Huettenzauber.
- Eine Chromium-Policy unterdrueckt Uebersetzungs- und Passwort-Dialoge, die
  sonst ueber der Bedienflaeche liegen:
  `/etc/chromium/policies/managed/huettenzauber-kiosk.json`.
  Entfernen mit `sudo rm` derselben Datei.

### Kiosk auf dem Pi

```
~/huettenzauber-v2/deploy/kiosk.sh          # beide Fenster starten
~/huettenzauber-v2/deploy/kiosk.sh --stop   # beenden
~/huettenzauber-v2/deploy/kiosk.sh --swap   # Bildschirme tauschen
```

Das Skript liest die Bildschirme aus `xrandr` und legt auf den ersten Ausgang
das Bedienterminal (`/order`), auf den zweiten das Kundendisplay (`/guest`).
Beide Displays melden 1024x600 - welcher Ausgang welches Geraet ist, sagt nur
der Augenschein, deshalb `--swap`.

Autostart beim Anmelden: `~/.config/autostart/huettenzauber-kiosk.desktop`
ruft `deploy/kiosk-autostart.sh`, das bis zu 60 s auf `/api/health` wartet -
beim Kaltstart ist der Desktop schneller da als Docker. Log:
`~/.config/huettenzauber-kiosk/autostart.log`.
Abschalten: die `.desktop`-Datei loeschen.

