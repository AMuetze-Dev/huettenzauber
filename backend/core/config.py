import os
import warnings

from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_URL = "postgresql+psycopg2://root:root@db:5432/huettenzauber"


def _legacy_host_url() -> str | None:
    """Back-compat: DATABASE_HOST wird noch eine Version lang unterstützt."""
    host = os.getenv("DATABASE_HOST")
    if not host or os.getenv("DATABASE_URL"):
        return None
    warnings.warn(
        "DATABASE_HOST ist veraltet - bitte DATABASE_URL setzen.",
        DeprecationWarning,
        stacklevel=2,
    )
    return f"postgresql+psycopg2://root:root@{host}:5432/huettenzauber"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = _legacy_host_url() or _DEFAULT_URL
    # Betriebs-Zeitzone fuer den Abrechnungstag (business_day).
    business_timezone: str = "Europe/Berlin"
    # Erlaubte CORS-Origins, kommagetrennt. Default deckt Dev ab.
    cors_origins: str = "http://localhost:3000,http://localhost"
    # Optionaler Zugangscode fuer schreibende Endpunkte (offener Pi-Hotspot).
    # Leer = kein Schutz (Default, damit Dev unveraendert laeuft).
    access_code: str = ""
    # Verzeichnis fuer automatische pg_dump-Sicherungen beim Tagesabschluss.
    # Leer = kein Backup.
    backup_dir: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
