FROM python:3.13-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y libpq-dev && rm -rf /var/lib/apt/lists/*


# Kopiere nur die installierten Pakete aus dem Dependency-Image
COPY --from=huettenzauber_backend_deps:latest /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=huettenzauber_backend_deps:latest /usr/local/bin /usr/local/bin

# Kopiere nur den App-Code (ohne .venv, Tests etc. dank .dockerignore)
COPY . .

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]