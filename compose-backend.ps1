# Backend + DB starten. Beim ersten Mal wird das Image gebaut.
# Danach reicht `docker compose up backend -d` - Code-Aenderungen im Ordner
# ./backend sind sofort im Container, uvicorn --reload startet neu.
# Neu bauen (--build) nur noetig, wenn sich pyproject.toml / uv.lock aendern.
docker compose up db backend --build -d
