#!/usr/bin/env bash
# Startet zwei Chromium-Kiosk-Instanzen (10" Bestellung, 7" Gastanzeige).
# Wird aus ~/.config/labwc/autostart aufgerufen. Output-Zuordnung + Vollbild
# uebernehmen die labwc-windowRules (siehe rc.xml.snippet) anhand der app_id
# hz-order / hz-guest.
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="$DIR/kiosk.conf"
[ -f "$CONF" ] || CONF="$DIR/kiosk.conf.example"
# shellcheck disable=SC1090
source "$CONF"

log() { echo "[kiosk] $*"; }

# --- auf die App warten -------------------------------------------------
log "warte auf $HEALTH_URL (max ${WAIT_FOR_APP}s)"
for _ in $(seq 1 "$WAIT_FOR_APP"); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
  case "$code" in 2??|3??) log "App bereit ($code)"; break ;; esac
  sleep 1
done

COMMON=(
  --ozone-platform=wayland
  --kiosk
  --noerrdialogs
  --disable-infobars
  --disable-session-crashed-bubble
  --disable-features=TranslateUI
  --check-for-update-interval=31536000
  --overscroll-history-navigation=0
  --autoplay-policy=no-user-gesture-required
)

CHROMIUM="$(command -v chromium-browser || command -v chromium || echo chromium)"

launch() {
  local appid="$1" url="$2" profile="$HOME/.hz-kiosk/$1"
  mkdir -p "$profile"
  log "starte $appid -> $url"
  "$CHROMIUM" "${COMMON[@]}" \
    --class="$appid" \
    --user-data-dir="$profile" \
    --app="$url" &
}

launch hz-order "$ORDER_URL"
sleep 2
launch hz-guest "$GUEST_URL"

wait
