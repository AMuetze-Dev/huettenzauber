# Kiosk-Betrieb auf dem Raspberry Pi 5

Pi OS Bookworm (64-bit, Desktop), Wayland/labwc (Standard auf Pi 5). Zwei HDMI-Displays:
10" = Bedienterminal (`/order`), 7" = Kundendisplay (`/guest`). Keine Tastatur noetig.

## Voraussetzungen (einmalig, mit Tastatur/SSH)

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin chromium-browser wlr-randr rsync curl
sudo usermod -aG docker "$USER"      # ab-/anmelden danach
```

## Einrichtung

```bash
git clone <repo> ~/huettenzauber
~/huettenzauber/deploy/pi/install.sh
```

`install.sh` macht:

1. Repo nach `/opt/huettenzauber` spiegeln.
2. `.env` aus `.env.example` (danach `POSTGRES_PASSWORD` und `CORS_ORIGINS=http://localhost` setzen).
3. systemd-Service `huettenzauber.service` installieren + aktivieren
   (startet `docker compose -f docker-compose.prod.yml up -d --build` beim Boot).
4. `deploy/pi/kiosk.sh` in `~/.config/labwc/autostart` eintragen, `kiosk.conf` anlegen.

Danach von Hand:

- **Output-Namen ermitteln:** `wlr-randr` → z. B. `HDMI-A-1`, `HDMI-A-2`.
  In `/opt/huettenzauber/deploy/pi/kiosk.conf` `ORDER_OUTPUT` / `GUEST_OUTPUT` setzen
  (falsch herum? Werte tauschen).
- **windowRules:** Block aus `labwc-rc.xml.snippet` in `~/.config/labwc/rc.xml`
  einfuegen (Output-Namen anpassen). Ordnet je Fenster ein Display zu + Vollbild.
- **Erststart:** `sudo systemctl start huettenzauber.service` (baut Images, dauert
  ein paar Minuten). Dann `sudo reboot`.

## Ablauf beim Booten

1. systemd startet die Container (`docker-compose.prod.yml`).
2. labwc startet, ruft `kiosk.sh` auf.
3. `kiosk.sh` wartet auf `http://localhost/`, startet dann zwei Chromium-Instanzen
   (`--app`, `--kiosk`, eigene `--user-data-dir`, `--class hz-order` / `hz-guest`).
4. labwc-windowRules schieben `hz-order` auf das 10"-Display, `hz-guest` auf das 7",
   beide Vollbild.

## Fehlersuche

| Symptom | Pruefen |
|---|---|
| Weisse Seite | `docker compose -f docker-compose.prod.yml logs` in `/opt/huettenzauber` |
| Beide Fenster auf einem Display | labwc-Version < 0.7 → `output=` in windowRule nicht unterstuetzt; Displays per `wlr-randr` / `kanshi` anordnen, Fenster manuell einmal verschieben, oder labwc aktualisieren |
| Displays vertauscht | `ORDER_OUTPUT` / `GUEST_OUTPUT` in `kiosk.conf` **und** die `output=`-Werte in `rc.xml` tauschen |
| App startet nicht beim Boot | `systemctl status huettenzauber.service` |
| Kein Vollbild | `fullscreen="yes"` in der windowRule, `--kiosk` in `kiosk.sh` |

## Updates

```bash
cd ~/huettenzauber && git pull
deploy/pi/install.sh
sudo systemctl restart huettenzauber.service
sudo reboot
```
