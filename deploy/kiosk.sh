#!/usr/bin/env bash
# Startet beide Chromium-Fenster im Vollbild - Bedienterminal und
# Kundendisplay. Am Pi haengt keine Tastatur, deshalb muss das ohne
# Zutun laufen und nach einem Absturz von selbst zurueckkommen.
#
#   ./kiosk.sh            startet beide Fenster
#   ./kiosk.sh --stop     beendet sie
#   ./kiosk.sh --swap     Bildschirme vertauschen (einmalig)
#
# Welcher Ausgang welches Geraet ist, sagt einem nur der Augenschein:
# beide Displays melden 1024x600. Passt es nicht, --swap benutzen.
set -u

BASE="${HZ_URL:-http://localhost}"
STATE="$HOME/.config/huettenzauber-kiosk"
SWAP_FILE="$STATE/swap"
mkdir -p "$STATE"

export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"

# Bildschirmgeometrie aus xrandr; ohne Treffer die bekannten Werte.
geometrie() {
  xrandr --query 2>/dev/null \
    | awk '/ connected/ {for (i=1;i<=NF;i++) if ($i ~ /^[0-9]+x[0-9]+\+[0-9]+\+[0-9]+$/) {print $1, $i; break}}'
}

stop_kiosk() {
  pkill -f "chromium.*--user-data-dir=$STATE" 2>/dev/null
  sleep 1
  pkill -9 -f "chromium.*--user-data-dir=$STATE" 2>/dev/null
  echo "Kiosk beendet."
}

case "${1:-}" in
  --stop) stop_kiosk; exit 0 ;;
  --swap)
    if [ -e "$SWAP_FILE" ]; then rm -f "$SWAP_FILE"; echo "Zuordnung: normal";
    else touch "$SWAP_FILE"; echo "Zuordnung: getauscht"; fi
    exit 0 ;;
esac

CHROME="$(command -v chromium-browser || command -v chromium)"
if [ -z "$CHROME" ]; then
  echo "Chromium nicht gefunden." >&2
  exit 1
fi

mapfile -t SCHIRME < <(geometrie)
if [ "${#SCHIRME[@]}" -lt 2 ]; then
  echo "Nur ${#SCHIRME[@]} Bildschirm(e) gefunden - starte nur das Bedienterminal." >&2
fi

# Reihenfolge: erster Ausgang = Bedienterminal, zweiter = Kundendisplay.
ROLLEN=("/order" "/guest")
[ -e "$SWAP_FILE" ] && ROLLEN=("/guest" "/order")

stop_kiosk >/dev/null 2>&1

starte() {
  local pfad="$1" position="$2" breite="$3" hoehe="$4" profil="$5"
  "$CHROME" \
    --user-data-dir="$STATE/$profil" \
    --window-position="$position" \
    --window-size="$breite,$hoehe" \
    --kiosk \
    --start-fullscreen \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --lang=de-DE \
    --accept-lang=de-DE,de \
    --disable-translate \
    --disable-features=Translate,TranslateUI,AutofillServerCommunication \
    --password-store=basic \
    --check-for-update-interval=31536000 \
    --overscroll-history-navigation=0 \
    --autoplay-policy=no-user-gesture-required \
    --app="$BASE$pfad" \
    >/dev/null 2>&1 &
}

i=0
for eintrag in "${SCHIRME[@]}"; do
  [ "$i" -ge 2 ] && break
  geo="${eintrag#* }"                       # 1024x600+1024+0
  aufloesung="${geo%%+*}"                   # 1024x600
  rest="${geo#*+}"; x="${rest%%+*}"; y="${rest#*+}"
  starte "${ROLLEN[$i]}" "$x,$y" "${aufloesung%%x*}" "${aufloesung##*x}" "schirm$i"
  echo "Bildschirm $((i+1)) (${eintrag%% *}) -> ${ROLLEN[$i]}"
  i=$((i+1))
  sleep 2
done

# Bildschirmschoner und Energiesparen aus - der Ausschank laeuft stundenlang.
xset s off -dpms 2>/dev/null
echo "Kiosk gestartet ($BASE)."
