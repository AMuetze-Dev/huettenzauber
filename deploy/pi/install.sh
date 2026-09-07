#!/usr/bin/env bash
# Einmalige Einrichtung auf dem Raspberry Pi (Pi OS Bookworm, Wayland/labwc).
# Ausfuehren als der Benutzer, unter dem die Grafik laeuft (meist "pi"), mit sudo-Rechten.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET="/opt/huettenzauber"

echo "== 1) Repo nach $TARGET spiegeln =="
sudo mkdir -p "$TARGET"
sudo rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' --exclude '.venv' \
  --exclude '_legacy_ist' --exclude 'dist' --exclude 'build' \
  "$REPO_DIR/" "$TARGET/"
sudo chown -R "$USER":"$USER" "$TARGET"

echo "== 2) .env anlegen (falls fehlt) =="
[ -f "$TARGET/.env" ] || cp "$TARGET/.env.example" "$TARGET/.env"
echo "   -> $TARGET/.env pruefen (POSTGRES_PASSWORD, CORS_ORIGINS=http://localhost)"

echo "== 3) Images bauen =="
( cd "$TARGET" && docker compose -f docker-compose.prod.yml build )

echo "== 4) systemd-Service =="
sudo cp "$TARGET/deploy/pi/huettenzauber.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable huettenzauber.service
echo "   -> Start jetzt:  sudo systemctl start huettenzauber.service"

echo "== 5) Kiosk-Autostart (labwc) =="
mkdir -p "$HOME/.config/labwc"
AUTOSTART="$HOME/.config/labwc/autostart"
LINE="$TARGET/deploy/pi/kiosk.sh &"
grep -qF "$LINE" "$AUTOSTART" 2>/dev/null || echo "$LINE" >> "$AUTOSTART"
[ -f "$TARGET/deploy/pi/kiosk.conf" ] || cp "$TARGET/deploy/pi/kiosk.conf.example" "$TARGET/deploy/pi/kiosk.conf"
echo "   -> Output-Namen pruefen:  wlr-randr"
echo "   -> $TARGET/deploy/pi/kiosk.conf anpassen (ORDER_OUTPUT / GUEST_OUTPUT)"
echo "   -> windowRules aus deploy/pi/labwc-rc.xml.snippet in ~/.config/labwc/rc.xml uebernehmen"

echo
echo "Fertig. Reihenfolge beim ersten Mal:"
echo "  1. .env + kiosk.conf + rc.xml anpassen"
echo "  2. sudo systemctl start huettenzauber.service   (baut die Images, dauert)"
echo "  3. Neustart des Pi -> beide Displays im Vollbild"
