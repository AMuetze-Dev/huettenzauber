# Architektur Hüttenzauber – Senior-Review (IST) & Zielbild v2

Stand: 2026-09-07. Teil A/B mit `/junior-to-senior` (Review der IST-Architektur). Teil C/D/E mit `/grill-me` verdichtet und finalisiert.

Beleg-Regel: Aussagen über den Code zitieren `Datei:Zeile`. Aussagen über den Stand der Technik zitieren eine Quelle mit Datum (siehe Quellenliste). Ohne Websuche belegte Aussagen sind mit `[training-data]` markiert.

**Rechtlicher Rahmen (in `/grill-me` geklärt):** Die Hütte wird offiziell vom Landgasthof betrieben, dieser führt eine offene Ladenkasse. Hüttenzauber ist ein **Anzeige- und Mitschreibsystem zur Kundeninformation**, nicht die steuerliche Kasse of record. Keine TSE-/Fiskalpflicht für v2. Konsequenz: nicht „Rechnung" nennen, sondern **Bon / Bestellung**; keine rechtsverbindliche Belegnummerierung; der Beleg-Snapshot (D2) ist rein betrieblich (Kassensturz, Verbrauch, Tagesabrechnung).

---

## Teil A – Eingefrorenes IST (Phase 0)

Gegenstand des Reviews ist die real existierende Architektur, nicht ein geschriebener Plan.

### Backend

- **Stack:** FastAPI, SQLAlchemy 2.x (sync), Pydantic v2, PostgreSQL. `requirements.txt` ohne obere Schranken, kein Lockfile.
- **Schichten:** `controller/` (APIRouter + DTOs) → `service/` (Geschäftslogik, wirft `fastapi.HTTPException`) → `entity/DAO.py` (ein Modul, alle ORM-Klassen). Kein Repository, kein DI-Container.
- **DB-Bootstrap:** `backend/database.py:6-9` – `create_engine("postgresql://root:root@{DATABASE_HOST}:5432/huettenzauber")` und `Base.metadata.create_all(bind=engine)` **auf Modulebene**. `sessionmaker(autoflush=True, ...)` (`database.py:8`).
- **Migrationen:** keine. Schema-Evolution ist im Code sichtbar (`version`, `is_active`, `is_deleted`, `base_item_id` in `entity/DAO.py`).
- **Domänenmodell:** Artikel-/Varianten-Änderung = neue Zeile + alte auf `is_active=False` (`service/StockItemService.py:99-124`, `service/ItemVariantService.py:87-108`); die `id` ändert sich bei jedem Edit. `BillItem` speichert nur `item_variant_id` + `item_quantity`, **keinen Preis-Snapshot** (`entity/DAO.py:60-68`).
- **Fehlerbehandlung:** Service wirft HTTP-Fehler; `BillService.create` committet die `Bill` vor Positionsvalidierung und fängt danach `except Exception` – wodurch ein `HTTPException(404)` zu `400` wird und eine verwaiste Bill bleibt (`service/BillService.py:19-56`).
- **CORS:** `allow_origins=["*"]` + `allow_credentials=True` (`app.py:17-23`).
- **`ItemVariantController`** ist nicht in `app.py` eingebunden.
- **Tests:** pytest, jede Datei dupliziert Engine + `override_get_db` + Fixture; kein `conftest.py`; Ziel-DB `huettenzauber_test` auf einem Postgres (Docker), Lebenszyklus ungeregelt.

### Frontend

- **Stack:** Create React App (`react-scripts` 5.0.1), React 19 (`@types/react` 18 – Mismatch), TypeScript 4.9, Context API, CSS Modules, `react-beautiful-dnd` 13, `chart.js`, `jspdf`, `xlsx`, `sockjs-client` + `stompjs` (ungenutzt). `package.json:5-38`.
- **State:** drei Cart-Kontexte, einer aktiv (`context/PersistentCartContext.tsx`), zwei tot (`context/CartContext.tsx`, `context/PersistentCartContextUpdated.tsx`).
- **Cross-Screen-Sync (7"/10" am Pi):** Reducer schreibt bei jeder Änderung `localStorage['huettenzauber_cart']` und feuert `window.dispatchEvent(new CustomEvent('cartUpdated'))`; andere Fenster hören `storage` + `cartUpdated` (`context/PersistentCartContext.tsx:214-306`).
- **API-Adresse:** fest verdrahtete LAN-IP `http://192.168.189.162:8000` (`assets/constants.ts:1`).
- **Falsche Endpunkte:** `ProductContext` nutzt `/item_variants/` (Unterstrich, Route existiert nicht, `context/ProductContext.tsx:153-183`) und `PUT /categories/bulk` für Sortierung (existiert nicht, `:187`).
- **Fehlerbehandlung:** `BillContext.addBill` fängt `!res.ok` selbst ab und wirft nicht weiter (`context/BillContext.tsx:56-70`); der Checkout leert den Warenkorb trotzdem.
- **Provider:** `App.tsx` + `service.page.tsx` + `order.page.tsx` legen je einen `ProductProvider` an (verschachtelt, mehrfaches `reloadAll`).
- **Auswertung:** `BillsStatistics` rekonstruiert Umsätze aus dem aktuellen Variantenpreis, weil `item_price` nie von der API kommt (`features/BillsStatistics.feature.tsx:54-68`).

### Deployment

- `docker-compose.yml`: `db` (postgres:latest), `backend` (Dockerfile.windows), `frontend`, `pgadmin`, `proxy` (nginx). Backend-Env setzt `DATABASE_URL`, der Code liest aber `DATABASE_HOST`. Service heißt `db`, Code-Default-Host `postgres_db`.
- Ziel: Raspberry Pi 5 (16 GB), 7"-Kundendisplay + 10"-Bedienterminal, **zwei getrennte Chromium-Instanzen** im Vollbild per Startskript, keine Tastatur. Der Pi spannt einen **WLAN-Hotspot** auf, über den weitere Eingabegeräte (Handy) mitkassieren können.

---

## Teil B – Senior Review

**Altitude-Diagnose: mixed.** Das IST ist kein Plan mit Fog/Tunnel, sondern gewachsener Code. Übertragen: Die *Produktvision* ist klar (Hütten-POS mit Pfand, zwei Bildschirme, Touch). Die *architektonische Ebene* schwankt – manche Teile sind zu naiv umgesetzt (Cross-Screen-Sync über einen `localStorage`-Hack, Versionierung per Insert ohne Snapshot), andere überentwickelt für den Kontext (drei Cart-Kontexte, Versions-Ketten über `base_item_id` statt einfachem Preis-Snapshot).

### Blocker

**[B1] Kein Preis-Snapshot in `BillItem` – die Kernaufgabe eines Kassensystems ist nicht erfüllt.**
Beleg: `entity/DAO.py:60-68` (`BillItem` = `item_variant_id`, `item_quantity`); `features/BillsStatistics.feature.tsx:54-68` (Fallback auf Live-Preis). Ein Bon muss festhalten, *was tatsächlich kassiert wurde*. Aktuell verändert jede spätere Preisänderung die Historie – solange die alte Variantenzeile überhaupt noch existiert. Für Kassensturz und Verbrauchsauswertung disqualifizierend.
Fix: `bill_item` bekommt `unit_price`, `deposit_per_unit`, `item_name`, `variant_name` – gefüllt beim Anlegen, nie wieder geändert. Auswertungen nur aus dem Bon, nie aus dem aktuellen Katalog.

**[B2] Geldbeträge als `float`.**
Beleg: `entity/DAO.py:26,45,75-76` (`Column(Float)` für `deposit_amount`, `price`, `total_amount`). `0.1 + 0.2 != 0.3`. Rundungsdifferenzen bei Tagesabschluss sind garantiert.
SOTA: Geld als `NUMERIC`/`DECIMAL` in der DB, `decimal.Decimal` in Python, Integer-Cent im Frontend. `[training-data]` – unstrittig.
Fix: alle Geldspalten `NUMERIC(10,2)`; Pydantic-`condecimal`; Frontend rechnet in Cent.

**[B3] Cross-Screen-Sync über `localStorage` + `CustomEvent` trägt auf dem Zielsystem nicht.**
Beleg: `context/PersistentCartContext.tsx:214-306`. `storage`-Events und `CustomEvent` bleiben **innerhalb eines Browser-Prozesses**. Die 7"- und 10"-Anzeige laufen (in `/grill-me` bestätigt) als **zwei getrennte Chromium-Instanzen** → es kommt **keine** Synchronisierung an. Zusätzlich verliert ein Reload des Kundendisplays den Zustand.
SOTA: BroadcastChannel ersetzt den `localStorage`-Hack für *echte* Cross-Tab-Fälle (Baseline 2022), löst aber das Mehr-Prozess-Problem **nicht** (openreplay/blog 2024). Für zwei Prozesse/Geräte: Zustand server-seitig, Push per SSE.
Fix: „Aktive Bestellung" wird eine Backend-Ressource, Kundendisplay abonniert per SSE. Details Teil C 3.3.

**[B4] `database.py` erzeugt Engine und Schema als Import-Seiteneffekt.**
Beleg: `database.py:6-9`. Import von `app` ⇒ sofortiger Verbindungsaufbau + `create_all` – auch gegen die Produktiv-DB, auch im Test, bevor eine Fixture die Engine ersetzen kann. Mit `create_all` statt Migrationen driftet das Schema.
Fix: Engine/Session in einer Factory, Schema über Alembic, Aufbau im FastAPI-Lifespan-Handler.

**[B5] Create React App ist offiziell abgekündigt und mit React 19 nicht sauber lauffähig.**
Beleg: React-Team, 2025-02-14 – CRA deprecated, keine Updates, „React 19 hat bereits einen harten Dependency-Mismatch, der das CRA-Setup bricht" (build5nines / legacyleap 2025). `package.json` hält `react` 19 **und** `@types/react` 18 gleichzeitig.
Fix: Migration auf Vite (React-Team nennt Vite/Parcel/Rsbuild als Nachfolger).

### Major

**[M1] Service-Schicht wirft `fastapi.HTTPException`.** Beleg: alle `service/*.py`. Geschäftslogik ist ans Web-Framework genagelt, schwer ohne HTTP testbar, Statuscodes lecken durch `except Exception`. SOTA: Domänen-Exceptions + zentraler `exception_handler` (FastAPI-Best-Practice-Quellen 2025, u. a. zhanymkanov/fastapi-best-practices). Fix: `core/exceptions.py`, Handler in `app.py`, Services frameworkfrei.

**[M2] `except Exception` verschluckt Fehlerklassen.** Beleg: `service/BillService.py:51-56`, analog in `CategoryService`, `StockItemService`, `ItemVariantService`. Fix: kein Catch-all; `IntegrityError` gezielt, sonst durchlassen.

**[M3] Versionierung per Insert mit wechselnder `id`.** Beleg: `service/StockItemService.py:99-124`. Folgen: bei Artikel-Edit werden Varianten nicht mitkopiert; `bulk_update` gibt neue IDs zurück; `item_sorting` muss umgehängt werden. Der Zweck – Historie – ist mit einem Snapshot in `bill_item` (B1) einfacher und vollständig erreicht. Fix: In-Place-Update des Katalogs, `is_active` nur als echtes Soft-Delete, `base_item_id`/`version` entfallen.

**[M4] `ItemVariantService.get_all_in_stock_item` schreibt Anzeigewerte in die DB.** Beleg: `service/ItemVariantService.py:12-14` mutiert `v.name`; Prod-Session ist `autoflush=True` (`database.py:8`). Fix: Fallback nur im Response-Schema.

**[M5] `react-beautiful-dnd` ist archiviert (2025-08-18), kein React-18/19-Support.** Beleg: atlassian/react-beautiful-dnd#2672; pkgpulse 2026. Fix: `@dnd-kit` (klein, a11y, aktiv), Zwischenschritt `@hello-pangea/dnd` (Drop-in).

**[M6] Frontend spricht die API über eine fest verdrahtete LAN-IP an.** Beleg: `assets/constants.ts:1`. Fix: relativer Pfad `/api` über den nginx-Proxy.

**[M7] Kein Alembic – `create_all` als Migrationsersatz.** Beleg: kein `alembic/`, `database.py:9`. `create_all` ändert nie bestehende Spalten. SOTA: Alembic bleibt Standard 2025 (atlasgo.io/blog 2025-02-10). Fix: Alembic, Baseline aus dem v2-Schema.

**[M8] `requirements.txt` ohne obere Schranken, `postgres:latest` im Compose.** Beleg: `requirements.txt`, `docker-compose.yml:9`. Fix: `postgres:17-bookworm` pinnen; Python-Deps mit `uv`/`pip-tools` + Lockfile.

**[M9] Kein Auth, `pgadmin` mit `root/root` im selben Compose exponiert.** Beleg: `docker-compose.yml:43-53`. Zusätzlich brisant: der Pi spannt einen **offenen Hotspot** auf, über den geschrieben werden kann. Fix: `pgadmin` in `compose.dev.yml`; für die schreibenden Endpunkte einen statischen Zugangscode erwägen (offene Frage Teil E).

### Minor

- **[m1]** Doppelter `import pytest`, `sys.path.append` in jeder Testdatei, leere `test_BillController_fixed.py`.
- **[m2]** `ProductContext.ItemVariant.stock_item_od` – Tippfehler.
- **[m3]** `sockjs-client` + `stompjs` in `package.json`, nirgends importiert.
- **[m4]** `billing.page.getItemName` erkennt „Standard" über Magic Strings `'1.0'`/`'Default'`.
- **[m5]** `<CartModal>` in `order.page.tsx` zweimal gerendert.
- **[m6]** `get_all_in_category` liefert 400 statt `200/[]` bei leerer Kategorie.
- **[m7]** `move_item` in `StockItemSortingService` ist toter Code.

### Was das IST richtig macht

- **Schichtung Controller/Service/Entity** ist die passende Grobstruktur – muss nur konsequent (frameworkfrei im Service) durchgezogen werden.
- **Soft-Delete-Grundidee** (`is_deleted` bei Bill, `is_active` bei Artikel) ist richtig; nur die Umsetzung über Versions-Inserts ist zu viel.
- **DTO-Trennung** (`*CreateDTO`, `*UpdateDTO`, Response-Model) ist bereits sauber pro Controller.
- **Pfand als First-Class-Konzept** ist fachlich goldrichtig und selten so früh mitgedacht.
- **Getrennte Views** Kundendisplay / Bedienterminal / Service ist die richtige Produktzerlegung.
- **Docker-Compose mit nginx-Proxy** ist die richtige Deployment-Form für den Pi – der Proxy wird nur noch nicht genutzt (M6).

---

## Teil C – Zielbild v2

### 1. Ziel und Nicht-Ziele

**Ziel.** Ein wartbares Anzeige-/Kassenhilfssystem für den Hüttenbetrieb auf einem Raspberry Pi 5: ein Bedienterminal (10") und optional Handys über den Pi-Hotspot erfassen **eine gemeinsame** laufende Bestellung inkl. Pfand, ein Kundendisplay (7") zeigt sie live. Bons, Tagesabrechnung und Verbrauchs-/Umsatzstatistik sind je Veranstaltung nachvollziehbar und exportierbar. Kataloge sind wiederverwendbare Vorlagen je Festtyp. Läuft offline im LAN, ohne Tastatur, neustart-fest.

**Nicht-Ziele (v2).** Keine TSE/Fiskalisierung (Anzeigesystem, siehe oben). Kein Multi-Counter (nur ein Ausgabe-Counter, ein Kundendisplay). Kein Offline-Queue-/Sync-System (Backend läuft lokal auf dem Pi). **Kein Backup-Mechanismus** (bewusst akzeptiertes Risiko, Teil E). Kein veranstaltungsübergreifendes Reporting. Keine Katalog-Kopien/-Versionen pro Jahr. Keine Cloud, kein Mandantensystem, keine Nutzerrollen, kein Zahlungsterminal, keine Tisch-/Angebotsverwaltung, kein Microservice-Umbau, kein Realtime-Framework mit Broker (kein STOMP/SockJS).

### 2. Entscheidungen

| # | Thema | Wahl | Version | Begründung | Stärkste verworfene Alternative | Beleg |
|---|---|---|---|---|---|---|
| D1 | Geld | `NUMERIC(10,2)` in DB, `Decimal` in Python, Integer-Cent im FE | – | Rundungssicherheit beim Kassensturz | `float` beibehalten | B2 |
| D2 | Bon-Historie | Snapshot in `bill_item` (`unit_price`, `deposit_per_unit`, `item_name`, `variant_name`) | – | Bon = was kassiert wurde; entkoppelt Historie vom Katalog; Bon bleibt korrekt nach Artikel-Löschung | Versions-Insert-Kette behalten (M3) | B1, `entity/DAO.py:60-68` |
| D3 | Katalog-Mutation | In-Place-Update, `is_active` als echtes Soft-Delete; kein `base_item_id`/`version` | – | einfacher, stabile IDs, Historie kommt aus D2 | Versionierung im Katalog | M3, `service/StockItemService.py:99-124` |
| D4 | Fehlermodell | Domänen-Exceptions + zentraler FastAPI-Handler | – | Service frameworkfrei & testbar; keine Statuscode-Lecks | HTTPException im Service lassen | M1, M2, Best-Practice-Quellen 2025 |
| D5 | Migrationen | Alembic, Baseline = v2-Schema, `create_all` raus | Alembic 1.13+ | Standard 2025, deckt Spaltenänderungen ab | Atlas (mehr Setup, kein Mehrwert hier) | M7, atlasgo.io/blog 2025-02-10 |
| D6 | DB-Zugriff | SQLAlchemy 2.0 **sync** + `Session`, Engine-Factory, Lifespan-Bootstrap; **nur die SSE-Stream-Route ist `async def`** (Event über `asyncio.Queue`, kein DB-Zugriff in der Stream-Schleife) | SQLAlchemy 2.0.x | Last ist minimal (eine Hütte); sync ist einfacher zu betreiben | async `AsyncSession` überall | `[training-data]` (async lohnt erst unter Last) |
| D7 | Test-DB | **echtes PostgreSQL** via `testcontainers[postgresql]`, Session-scope Container, Transaktions-Rollback pro Test | testcontainers 4.x | gleiche Engine wie Prod; SQLite weicht bei `ON DELETE CASCADE`, Typen, Dialekt ab | SQLite `:memory:` | oneuptime 2025-01-06; testcontainers-python docs |
| D8 | Frontend-Build | Vite + **React 18.3 (stabil)** + TS 5 + Vitest | Vite 5/6, React 18.3 | CRA tot; 18.3 stabil, keine React-19-Features nötig, dnd-kit läuft auf beiden | React 19 / Next.js (SSR unnötig, Kiosk) | B5, React-Team 2025-02-14 |
| D9 | Drag & Drop | `@dnd-kit` (Ziel), Zwischenschritt `@hello-pangea/dnd` | dnd-kit 6.x | rbd archiviert; dnd-kit klein, a11y, gepflegt | rbd behalten | M5, pkgpulse 2026, rbd#2672 |
| D10 | Cross-Screen-State | Backend hält **eine** „aktive Bestellung" (Singleton je aktiver Veranstaltung), Kundendisplay per **SSE**; BroadcastChannel nur für Tabs *einer* Instanz | – | zwei getrennte Chromium-Instanzen → client-seitiger Sync unmöglich; überlebt Reload/Absturz | localStorage+CustomEvent / WebSocket | B3, openreplay 2024, MDN SSE |
| D11 | API-Adresse | relativer `/api`-Pfad über nginx-Proxy | – | kein IP-Hardcoding, funktioniert auf dem Pi | `REACT_APP_API_URL`-Env behalten | M6, `assets/constants.ts:1` |
| D12 | Deps/Pins | Backend: `uv` + Lockfile; Compose: `postgres:17-bookworm`, alle Images gepinnt | – | reproduzierbarer Build auf einem selten gebauten Gerät | `latest` | M8 |
| D13 | Projektlayout Backend | nach Domäne (`catalog/`, `event/`, `order/`, `billing/`, `deposit/`) je `router.py`/`service.py`/`models.py`/`schemas.py`/`exceptions.py`; `core/` für DB, Config, Errors | – | wächst mit dem Fachmodell statt mit Dateitypen | „by type" behalten | zhanymkanov/fastapi-best-practices |
| **D14** | **Katalog** | Wiederverwendbare, benannte **Vorlage** (`catalog`), in einer Bibliothek. Wird **direkt bearbeitet** (aktueller Preis gewinnt). Kategorien/Artikel/Varianten hängen an `catalog_id` | – | bildet den realen Ablauf ab (pro Festtyp ein Katalog: Glühweinmeile, Männertag …); alte Bons bleiben per D2 korrekt | Katalog-Kopie/-Version pro Veranstaltung | `/grill-me` F5–F7 |
| **D15** | **Veranstaltung/Zyklus** | `event(id, catalog_id, name, started_at, ended_at, is_active)`. Genau **eine** aktiv (oder keine). Bons + Pfandrückgaben + aktive Bestellung hängen an `event_id`. „Archivieren + neue starten" ersetzt das DB-Löschen | – | oberste Laufzeit-Einheit; ersetzt destruktives DB-Wipe durch nicht-destruktives Archivieren | Alles global, Filter über Datum | `/grill-me` F4–F5 |
| **D16** | **Abrechnungstag** | **weich**: `business_day = created_at::date` (lokale Zeit, Schnitt Mitternacht). Optionale `day_close(event_id, business_day, closed_at, total_gross, total_deposit)` als Nachschlage-Merker, **keine Sperre** | – | mehrtägige Events, tägliche Abrechnung; ohne Fiskalpflicht kein Sperren nötig | harter Tagesabschluss mit Storno-Regeln | `/grill-me` F6 |
| **D17** | Aktive Bestellung | `active_order` = **Singleton je aktiver Veranstaltung**. Alle Eingabegeräte schreiben per **Zeilen-Delta** (`POST /api/active-order/lines {variant_id, delta}`), nicht per Voll-`PUT` | – | ein Counter, ein Kundendisplay; Zeilen-Deltas verhindern gegenseitiges Überschreiben bei parallelem Tippen (10" + Handy) | Voll-Warenkorb-`PUT` (last-write-wins, Geisterartikel) | `/grill-me` F8–F9 |
| **D18** | Datenbestand | **frisches Schema, keine Migration von Altbeständen**. Entwicklung lokal auf Docker, letztes Fest abgeschlossen | – | keine erhaltenswerten Produktivdaten; spart die riskanteste Sequenz-Stufe | `float`→`NUMERIC`-Migration auf Altdaten bauen | `/grill-me` F10 |
| **D19** | Offline-Verhalten | Eingabegeräte halten lokalen Warenkorb + Retry bei kurzem Backend-Aussetzer; **kein** Offline-Queue-System. 7"-Display friert bei Aussetzer ein, korrigiert sich bei SSE-Reconnect | – | Backend läuft lokal auf dem Pi, „nie weg" ist der Normalfall; voller Offline-Sync wäre über-engineered | Vollständiger Offline-First-Client | `/grill-me` F8 |
| **D20** | `bulk_update` | **atomar**: erst alle Einträge prüfen, dann in einer Transaktion schreiben | – | teil-angewandte Bulk-Updates sind schwer nachvollziehbar | bewusst nicht-atomar (IST-Verhalten) | `/grill-me`; `TESTPLAN.md` ITM-45 |

### 3. Design an der richtigen Flughöhe

#### 3.1 Datenmodell

```
catalog(id, name UNIQUE, created_at)                              -- wiederverwendbare Vorlage je Festtyp

category(id, catalog_id FK, name, icon, sort_order INT)           -- an Katalog gebunden, sort_order 0-basiert
                                                                  -- (name unique je catalog_id)
stock_item(id, catalog_id FK, category_id FK NULL, name,
           deposit_amount NUMERIC(10,2), is_active BOOL,
           sort_order INT)                                        -- kein base_item_id, kein version
item_variant(id, stock_item_id FK, name NULL, price NUMERIC(10,2),
             bill_steps NUMERIC(10,3), is_active BOOL)            -- kein version

event(id, catalog_id FK, name, started_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ NULL, is_active BOOL)                  -- genau eine mit is_active=true (partial unique index)

active_order(event_id PK/FK, updated_at TIMESTAMPTZ)              -- 1:1 zur aktiven Veranstaltung
active_order_line(id, event_id FK, item_variant_id FK,
                  quantity NUMERIC(10,3))                         -- Zeilen, per Delta verändert
active_order_deposit_return(event_id FK, unit_amount NUMERIC(10,2),
                            quantity INT)                          -- laufende Pfandrückgabe

bill(id, event_id FK, created_at TIMESTAMPTZ, business_day DATE,
     is_deleted BOOL, total_gross NUMERIC(10,2),
     total_deposit NUMERIC(10,2), deposit_return_total NUMERIC(10,2))
bill_item(id, bill_id FK, item_variant_id FK NULL,
          item_name TEXT, variant_name TEXT NULL,
          unit_price NUMERIC(10,2), deposit_per_unit NUMERIC(10,2),
          quantity NUMERIC(10,3))                                 -- vollständiger Snapshot

deposit_return(id, event_id FK, bill_id FK NULL, created_at TIMESTAMPTZ,
               unit_amount NUMERIC(10,2), quantity INT,
               total_amount NUMERIC(10,2))

day_close(event_id FK, business_day DATE, closed_at TIMESTAMPTZ,
          total_gross NUMERIC(10,2), total_deposit NUMERIC(10,2))  -- PK (event_id, business_day); reiner Merker
```

Kernänderungen ggü. IST: **`catalog` und `event` als neue oberste Einheiten**; `category_sorting`/`item_sorting` entfallen – `sort_order` zieht in `category`/`stock_item` ein (weniger Umhäng-Logik, konsequent 0-basiert). `created_at` ist ein echter `TIMESTAMPTZ` (Sortierung innerhalb eines Tages eindeutig). Geld durchgehend `NUMERIC`. `bill`/`bill_item` tragen den vollständigen Snapshot.

#### 3.2 Fehlermodell

```python
# core/exceptions.py
class DomainError(Exception): ...
class NotFoundError(DomainError): ...          # -> 404
class ConflictError(DomainError): ...          # -> 409  (Name existiert, Kategorie nicht leer, kein aktiver Event)
class ValidationError(DomainError): ...        # -> 422  (Preis < 0, bill_steps <= 0)
class DepositNotAllowedError(DomainError): ... # -> 400

# app.py
@app.exception_handler(DomainError)
def handle_domain_error(request, exc): ...     # ein Mapping-Ort
```
Services importieren nur `core.exceptions`, nie `fastapi`. `IntegrityError` wird im Service in `ConflictError` übersetzt, alles andere fliegt bis zum 500-Handler.

#### 3.3 Aktive Bestellung + Cross-Screen ohne Broker

```
POST /api/events/{id}/activate                                       -> setzt is_active, legt active_order an
POST /api/active-order/lines      { variant_id, delta:+1|-1 }        -> 200, Zeile inkrementiert/entfernt
PUT  /api/active-order/deposit-return { unit_amount, quantity }      -> 200
GET  /api/active-order                                               -> aktueller Stand (Zeilen + Pfandrückgabe + Summen)
GET  /api/active-order/stream     (text/event-stream)                -> SSE-Event bei jeder Änderung
POST /api/bills   (aus aktiver Bestellung -> Bon mit Snapshots)      -> 201, leert active_order_line(s)
```

- **Bedienterminal (10") / Handy:** halten den Warenkorb weiter lokal für schnelle Interaktion, schicken pro Tap ein **Zeilen-Delta** an `POST /api/active-order/lines`. Kein Voll-`PUT` → paralleles Tippen auf 10" + Handy addiert sich sauber statt sich zu überschreiben.
- **Kundendisplay (7"):** rein lesend, `EventSource('/api/active-order/stream')`, **kein** lokaler State, **kein** `localStorage`. Reload = sofort wieder korrekt. Reconnect ist in `EventSource` eingebaut.
- **Server:** hält je aktiver Veranstaltung eine In-Process-`asyncio.Queue` pro SSE-Verbindung; jede schreibende Route legt nach dem Commit den neuen `active-order`-Stand in alle Queues. Kein Redis, kein Broker.
- **nginx:** für die Stream-Route `proxy_buffering off;` + `X-Accel-Buffering: no`. Fallback wenn SSE klemmt: Polling `GET /api/active-order` alle 2 s.
- STOMP/SockJS raus aus `package.json`.

#### 3.4 Was grob bleiben darf

Katalog-CRUD, Kategorie-/Artikel-Sortierung (jetzt Feld statt Tabelle), Statistik-Aggregation + Export (PDF/Excel/CSV), Theme-Toggle, Icon-Auswahl – Struktur unverändert, an D1–D20 angepasst. Statistik/Export filtern **immer** auf die aktive Veranstaltung, Default-Ansicht = aktueller `business_day`. Die UI-Überarbeitung (claude.ai/design) läuft getrennt; `TESTPLAN.md` beschreibt das Soll unabhängig vom Aussehen.

### 4. Sequenzierung (jede Stufe mit prüfbarem „fertig")

1. **Testfundament.** `conftest.py` mit testcontainers-Postgres; `database.py` in Engine-Factory + Lifespan zerlegen; Alembic initialisieren. *Fertig:* `pytest` läuft grün gegen einen frisch gestarteten Container.
2. **Schema & Kern-Datenmodell (D1–D3, D14–D18).** v2-Schema als erste Alembic-Revision (frisch, keine Altbestände): `catalog`, `event`, Geld als `NUMERIC`, `bill`/`bill_item` mit Snapshot, Sortierung als Feld. *Fertig:* `alembic upgrade head` baut das v2-Schema; ORM-Modelle + Pydantic-Schemas kompilieren; leerer Happy-Path-Test (Katalog anlegen → Event aktivieren → Artikel → Bon) grün.
3. **Fehlermodell (D4, M2).** `core/exceptions`, Handler, alle Services frameworkfrei; `BillService.create` transaktional. *Fertig:* ungültige Variante → 404 **und** kein Bon in der DB (`TESTPLAN.md` BILL-05, BILL-19).
4. **Katalog + Veranstaltung (D14, D15, D20).** CRUD für `catalog`; Event aktivieren/archivieren; In-Place-Katalog-Edit; `bulk_update` atomar; Sortier-Tabellen droppen. *Fertig:* Artikel 5× editieren → `id` stabil, Varianten bleiben, `sort_order` lückenlos; Event archivieren → Bons bleiben abrufbar, neuer Event startet leer/aus Katalog.
5. **Aktive Bestellung + Abrechnungstag (D10, D16, D17, D19).** `active_order` + Zeilen-Deltas + SSE; `business_day` auf jedem Bon; `day_close`-Merker; Kundendisplay auf `EventSource`. *Fertig:* Tap am 10" → 7"-Display < 300 ms aktualisiert (als **eigener** Chromium-Prozess); 7"-Reload → Stand sofort korrekt; 10" + zweites Gerät tippen parallel → Mengen addieren sich; Tagesabschluss zeigt korrekte Summe für `business_day`.
6. **Frontend-Build (D8, D11).** CRA → Vite; `constants.ts` → `/api`; Vitest; `cartReducer` als eigenes Modul + Tests; tote Kontexte weg; ein `ProductProvider`; `<CartModal>` einmal. *Fertig:* `vite build` erzeugt Bundle, `vitest` grün (`TESTPLAN.md` RED-*/CART-*), App läuft im Compose über den Proxy.
7. **Drag & Drop (D9).** `@hello-pangea/dnd` als Drop-in, dann `@dnd-kit`. *Fertig:* Sortierung per Touch am 10" ändert Reihenfolge, ein Request, Drop an gleicher Stelle = kein Request.
8. **Deployment-Härtung (D12, M8, M9).** Images pinnen, `uv`-Lock, `pgadmin` in `compose.dev.yml`, `DATABASE_URL` konsistent, CORS auf konkrete Origins. *Fertig:* `docker compose build` reproduzierbar, Prod-Compose ohne pgadmin startet auf dem Pi.
9. **Kiosk-Autostart.** Startskript nach `~/.config/labwc/autostart` (Bookworm/Wayland), Chromium `--kiosk --ozone-platform=wayland`, ein Fenster je Output/Instanz, 10" → `/order`, 7" → `/billing`. *Fertig:* Pi-Kaltstart → beide Displays im Vollbild ohne Eingriff.

### 5. Risiken und Rollback

| Risiko | Härte | Escape |
|---|---|---|
| **Offener Pi-Hotspot ohne Auth + schreibende API** | mittel–hoch | offene Frage Teil E: statischer Zugangscode vor `POST/PUT`-Routen; bis dahin bewusst offen für abgelegene Standorte |
| **Kein Backup** – SD-Kartenausfall im Fest = Totalverlust Tagesabrechnung | hoch | **bewusst akzeptiert** (Teil E). Minimal-Milderung ohne Bau: Betreiber weiß, dass er Summen parallel notiert; SD-Karte mit Industrie-Qualität |
| `active_order`-Zeilen-Deltas bei echt parallelem Tap | mittel | Delta-Endpunkt idempotent pro Request-ID; DB-`UPDATE ... SET quantity = quantity + :delta` (kein Read-Modify-Write im App-Code) |
| SSE hinter nginx (Proxy-Buffering) | niedrig | `proxy_buffering off` + `X-Accel-Buffering: no`; Fallback Polling alle 2 s |
| SSE-Reconnect nach WLAN-Blip am 7" | niedrig | `EventSource` reconnectet selbst; Server schickt bei Connect sofort den Vollstand |
| CRA→Vite: Env-Vars, SVG-Import, Jest→Vitest | niedrig | Branch, parallel lauffähig bis alle FE-Testfälle grün |
| `@dnd-kit` andere API als rbd (kein Drop-in) | niedrig | Zwischenschritt `@hello-pangea/dnd` (reines Import-Rename) |
| Katalogwechsel während aktiver Veranstaltung | niedrig | offene Frage Teil E; vorerst: Katalog nur wechselbar, wenn keine Veranstaltung aktiv |

Frisches Schema (D18) → **keine** Datenmigration, damit fällt das früher schwerste Rollback-Thema weg. Am schwersten rückgängig ist jetzt Stufe 5 (aktive Bestellung/SSE), weil sie das Frontend-Zustandsmodell umstellt – deshalb erst nach stabilem Backend-Kern (Stufe 2–4).

---

## Teil D – Delta IST → v2

- **Neue oberste Einheiten:** `catalog` (wiederverwendbare Vorlage je Festtyp) + `event` (Laufzeit-Zyklus). „Archivieren + neu starten" ersetzt das bisherige **DB-Löschen vor jedem Fest**.
- **Bon-Historie:** Versions-Insert-Kette mit wandernder `id` → **Snapshot in `bill_item`**; Katalog wird in-place editiert. Weniger Code, vollständige Belege, stabile IDs.
- **Geld:** `float` → `NUMERIC`/`Decimal`/Cent. Kassensturz wird exakt.
- **Cross-Screen:** `localStorage`+`CustomEvent` (prozess-lokal, funktioniert bei zwei Chromium-Instanzen **gar nicht**) → **Backend-Singleton `active_order` + SSE**, Eingabe per Zeilen-Delta. Prozessübergreifend, absturz- und reloadfest.
- **Abrechnung:** implizit → **weicher Tagesabschluss** (`business_day`, optionaler `day_close`-Merker).
- **Fehler:** `HTTPException` im Service + `except Exception` → **Domänen-Exceptions + ein Handler**; `POST /bills` transaktional; `bulk_update` atomar.
- **Build:** CRA (tot) → **Vite + React 18.3**; `react-beautiful-dnd` (archiviert) → **dnd-kit**.
- **Schema-Pflege:** `create_all` → **Alembic** (Baseline = v2-Schema, keine Altbestände). `database.py`-Import-Seiteneffekt → **Factory + Lifespan**.
- **Betrieb:** Hardcoded-IP → `/api` über Proxy; `latest`-Images → gepinnt; `pgadmin` raus aus Prod; CORS konkret.
- **Tests:** dupliziertes Setup → `conftest.py` + **testcontainers-Postgres** (nicht SQLite).

---

## Teil E – Offene Fragen & akzeptierte Risiken

### Noch zu entscheiden

1. **Hotspot-Auth:** Der offene Pi-Hotspot + schreibende API heißt: jeder in Funkreichweite kann Bons ändern. Für eine abgelegene Hütte vertretbar, in Ortsnähe (Glühweinmeile) fraglich. → Statischer Zugangscode vor `POST/PUT`-Routen einbauen, ja/nein?
2. **Katalogwechsel bei aktiver Veranstaltung:** vorerst gesperrt (nur zwischen Veranstaltungen). Bestätigen oder soll ein Wechsel mitten im Fest möglich sein?
3. **SSE hinter nginx auf dem Pi:** `proxy_buffering off` in der Praxis ausreichend, oder direkt Polling-Fallback aktiv lassen? → beim Deploy (Stufe 5/9) verifizieren.

### Bewusst akzeptierte Risiken (nicht mehr diskutieren, nur dokumentiert)

- **Kein Backup-Mechanismus** für die Pi-Datenbank in v2. SD-Kartenausfall während eines Fests = Verlust der Tagesabrechnung dieses Fests. Vom Betreiber akzeptiert.

---

## Teil F – UI/UX-Vorlage (Designer-Mockup)

Quelle: Claude-Design-Handoff, abgelegt unter `design/mockup-pos.dc.html` (primäre Vorlage) + `design/mockup-handoff-notes.md`. Zusätzlich mitgeliefert: ein „Nocturne"-Design-System (`design/nocturne/`) – **nicht deckungsgleich** mit den Screens (siehe F.4).

### F.1 Screen-Inventar

**Designt (pixelgenau nachzubauen, Ziel-Viewports):**

| ID | Screen | Viewport | Kern |
|---|---|---|---|
| 1a | Bestelleingabe 10" | 1280 × 800 | Kategorie-Rail links (104 px) · Schnellzugriff (5 Kacheln) · Artikelraster (4 Spalten, Größen-Chips inline aufklappend) · Fußleiste: Undo · Warenkorb-Sheet-Toggle · „Zu zahlen" + Betrag · „Bar kassieren" |
| 1a-Sheet | Warenkorb (Bottom-Sheet über 1a) | – | 2-spaltige Zeilenliste mit −/+ (44 px) · Pfandrückgabe „+1 Tasse zurück" + Reset · Summe · „Bar kassieren" |
| 1a-Pay | „Bar kassieren" (Overlay) | – | Großbetrag (52 px) · 3 Schein-Schnelltasten (10/20/50 → Rückgeld) · „Passend erhalten · abschließen" · „Zurück zur Bestellung" |
| 1b | Gastanzeige 7" | 1024 × 600 | **Reine Anzeige, spiegelt 1a live, kein Scrollen.** Letzte 7 Positionen + „+ n weitere" · rechte Spalte: Artikel/Pfand/Pfandrückgabe · Riesensumme (76 px) · Leerzustand „Willkommen" |
| 1c | Rechnungsübersicht & Storno 10" | 1280 × 800 | „Rechnungen heute" · Belegliste (Nr · Zeit · Positionen · Status · Summe) · Detailspalte rechts · **Storno mit Inline-Bestätigung** („Beleg #… über … wirklich stornieren?") · Beleg-Neudruck |

**Nicht designt – Umsetzung in derselben Bildsprache nach Bau-Urteil (E5: mitbauen; je Bereich ein Wireframe zur Freigabe vor Umsetzung):**

- Katalog-/Artikel-/Preisverwaltung (im Mockup-Skript nur als Tab-Liste `Berichte & E-Mail` / `Kategorien` / `Artikel & Preise` angedeutet)
- Veranstaltung anlegen/aktivieren/archivieren, Katalog-Bibliothek/-Wechsel (D14/D15)
- Verkaufs-/Verbrauchsstatistik (im Skript als `STATS`-Daten vorhanden, kein Screen)
- Berichte / E-Mail-Versand
- Landing/Startscreen, Kiosk-Routing (10" → `/order`, 7" → `/gast`)

### F.2 Übernommene UX-Muster (verbindlich)

- **Ein Tipp = +1 in den Warenkorb. Langdruck / Rechtsklick = −1.** Gilt für Schnellzugriff, Artikelkachel (bei Ein-Größen-Artikeln) und Größen-Chip. (Ersetzt/präzisiert das brüchige `VariantItem`-Long-Press aus dem IST – `TESTPLAN.md` F-12: robust bauen mit Pointer-Capture + `pointercancel`.)
- **Warenkorb ist ein Bottom-Sheet**, keine eigene Seite, kein zentraler Modal. Über 1a, halbtransparenter Backdrop, schließt per Tap daneben.
- **Mehr-Größen-Artikel:** Kachel-Tipp klappt Größen-Chips inline auf; Ein-Größen-Artikel legt direkt an.
- **Dauer-Warenkorb:** bleibt zwischen Kategoriewechseln bestehen; Fußleiste zeigt immer Anzahl, „zuletzt: …", Betrag.
- **Bar kassieren in 2 Taps:** „Bar kassieren" → Schein-Schnelltaste **oder** „Passend erhalten" → fertig, Warenkorb leert. Schein-Tasten unter Gesamtbetrag sind deaktiviert dargestellt.
- **Pfandrückgabe:** ein Tap = +1 Tasse zurück (Betrag pro Tasse aus dem Artikel-`deposit_amount`, **nicht** hart 2 € wie im Mockup-Prototyp), „×" = zurücksetzen.
- **7" ist unbedienbar:** nur `EventSource`-Anzeige, keine Buttons, kein lokaler Zustand (deckt sich mit D10).
- **Storno = weiches Soft-Delete** (`bill.is_deleted`): Beleg wird ausgegraut, Status „Storniert", Inline-Bestätigung vor Ausführung, aus Tagessumme ausgenommen. (Bezeichnung „Storno" ist umgangssprachlich; rechtlich ist es keine fiskalische Stornierung – Anzeigesystem, siehe Rahmen oben.)
- **Keine destruktive Aktion ohne Bestätigung/Undo:** „Leeren" (Warenkorb), „Beleg stornieren" – beide mit Rückfrage; Fußleisten-Undo reduziert die zuletzt getippte Position um 1.

### F.3 DAU-Härtung (explizite Anforderung: „mit DAUs rechnen")

- Touch-Ziele ≥ 44 px (Mockup nutzt 44–64 px – als Testkriterium fixieren).
- Jede irreversible Aktion: Bestätigung **oder** Undo (s. o.).
- Doppel-Submit unmöglich (`isProcessing`-Sperre am „Bar kassieren", Delta-Endpunkt idempotent).
- Fehler sind sichtbar, nicht still: `ErrorBoundary` um die Routen, Toast bei fehlgeschlagenem `POST /bills` (behebt `TESTPLAN.md` F-3), 7"-Display friert nur ein statt weiß zu werden.
- `:focus-visible`-Ring (Nocturne-Konvention) für den seltenen Tastaturfall / Wartung.
- Kein Zustand, der den Bediener „einsperrt": Sheet/Overlay immer mit sichtbarem Schließen/Zurück.
- Leerzustände überall ausformuliert (1b „Willkommen", leerer Warenkorb, „Rechnungen heute" leer).

### F.4 Visuelle Tokens – Quelle der Wahrheit

Die **Screens** in `mockup-pos.dc.html` sind maßgeblich, **nicht** das mitgelieferte Nocturne-DS. Nocturne ist blau-grau (`#161826` / Akzent `#9184d9`) und lädt Inter von Google Fonts; die Screens verwenden inline eine **warme Wirtshaus-Palette** und sollen offline laufen. Aus den Screens abzuleitende Tokens:

| Rolle | Wert (aus den Screens) |
|---|---|
| Grund | `#1a1917` |
| Chrome / Sheet / Panel | `#22201d` · Rail `#1d1b19` |
| Fläche Kachel | `#2a2724` · aktiv/gefüllt `#383026` / `#4a3f2e` |
| Rahmen | `#3d3a35` · aktiv `#8a7550` · Fokus/Hover `#c8a875` |
| Text | `#ece9e4` · gedämpft `rgba(236,233,228,.66)` |
| Akzent (Gold) | `#c8a875` · hell `#e0cba4` · Betragsgold `#e0cba4` |
| Gefahr / Storno | `#e39c8a` · Panel `#382622` / Rahmen `#6b473c` |
| Radius | 9–12 px (Kacheln), 16–18 px (Panels) |
| Schrift | **Inter** (400/500/600), `font-variant-numeric: tabular-nums` für alle Beträge/Mengen |
| Icons | **Phosphor** (`ph`, `ph-fill`) |

Aus Nocturne übernommen wird nur **Struktur**: 8 px Radius-Konvention, kompakte Spacing-Skala (0,7×), Elevation als „Kante + Umgebungsdunkel" statt Schlagschatten, `:focus-visible`-Regel. Kein Nocturne-Farbwert, kein Google-Fonts-Import.

### F.5 Frontend-Tech-Stack – final (alles Pi-OS-tauglich)

Der Pi baut nichts – er serviert statische Dateien (nginx) und startet Chromium. Build/Test laufen auf dem Dev-Rechner / CI. Damit sind moderne Frameworks unkritisch, **solange kein CDN zur Laufzeit nötig ist** (Pi läuft offline).

| Zweck | Wahl | Pi-tauglich, weil |
|---|---|---|
| Build | **Vite 5/6** + React **18.3** + TypeScript 5 | Ausgabe = statische ES-Module + CSS; nginx serviert sie |
| Icons | **`@phosphor-icons/react`** (gebündelt, **kein** `unpkg`) | reine SVG-Komponenten im Bundle |
| Schrift | **Inter self-hosted** (`.woff2` im Repo, `@font-face`), **kein** Google Fonts | Datei liegt im Bundle |
| Drag & Drop (nur Verwaltung) | **`@dnd-kit`** | reines JS, keine Laufzeit-Abhängigkeit |
| State | React Context + `useReducer` (Cart lokal am Eingabegerät) + `EventSource` (7") | Browser-nativ |
| Routing | `react-router` 6 | statisch |
| HTTP | `fetch` gegen relativen `/api` (D11) | – |

**Verboten zur Laufzeit:** jede CDN-URL (`unpkg`, Google Fonts, jsdelivr). Alles ins Bundle.

### F.6 Test-Stack & TDD-Vorgehen

„Alles muss getestet werden" + „am besten TDD" → Tests **vor** der Komponente, abgeleitet aus dem Mockup.

| Ebene | Werkzeug | Deckt |
|---|---|---|
| Reducer / reine Logik | **Vitest** | Warenkorb-Deltas, `sums()` (Artikel + Pfand − Pfandrückgabe, `max(0, …)`), `slice(-7)` + „+ n weitere", Wechselgeld `schein ≥ total`, Storno-Zustand. **Referenz ist die `Component`-Klasse im Mockup-Skript** (`mockup-pos.dc.html`, Zeile 333 ff.) – die Testfälle werden 1:1 aus deren Verhalten geschrieben. |
| Komponente / Screen | **Vitest + React Testing Library + `@testing-library/user-event` + jsdom** | 1a-Interaktionen (Tipp/Langdruck/Chip-Aufklappen/Undo/Sheet), 1a-Pay (Schein-Tasten, Doppel-Submit-Sperre), 1b-Rendering aus SSE-Payload, 1c (Auswahl, Storno-Inline-Confirm) |
| API-Mock | **`msw`** | `active-order`, `bills`, `catalog` – Erfolg **und** Fehlerpfade (F-3) |
| E2E-Golden-Path | **Playwright** (Dev/CI, nicht Pi) auf **echten Viewports 1280×800 / 1024×600** | „Bestellung aufnehmen → 7" spiegelt → bar kassieren → Beleg erscheint in 1c → stornieren"; SSE-Reconnect nach simuliertem Netzabriss |
| Backend | **pytest + `testcontainers[postgresql]`** (D7) | `TESTPLAN.md` §4 |

`TESTPLAN.md` §5 (Frontend) wird an dieses 3-Screen-Modell und die Mockup-Referenzlogik angeglichen; §6-Fachentscheidungen, die inzwischen entschieden sind, werden dort nachgezogen.

### F.7 Abweichungen der Vorlage vom IST-Frontend (was sich ändert)

- Sidebar mit Sektionen (`service.page`) → **Kategorie-Rail** + eigener Verwaltungsbereich.
- `CartModal` / `CheckoutModal` (zwei Wege, `order.page` rendert `CartModal` doppelt) → **ein** Bottom-Sheet + **ein** Pay-Overlay.
- `react-icons/md` (Material) → **Phosphor**.
- Trueno/Library3 + altes gelbes `globals.css` → **Inter + warme Palette** aus F.4. `frontend/public/globals.css` wird ersetzt.
- `billing.page` scrollende Liste → **feste 7-Zeilen-Anzeige** + „+ n weitere".
- `BillsManagement` Tabelle → Liste + Detailspalte + Inline-Storno-Confirm.

### F.8 Vorlagen-Entscheidungen

E4–E7 (unten) sind entschieden: warme Screen-Palette maßgeblich · fehlende Screens nach Urteil mitbauen (Wireframe-Freigabe je Bereich) · Phosphor + Inter self-hosted für das ganze Frontend · Storno = weiches, umkehrbares Soft-Delete ohne Grund.

---

## Teil E (Fortsetzung) – aus dem Mockup, entschieden 2026-09-07

4. **Token-Quelle:** ✅ **Screens (warme Palette, F.4) sind maßgeblich.** Nocturne-DS wird nur strukturell genutzt (Spacing 0,7×, 8 px Radius, Elevation-Ansatz, `:focus-visible`-Regel). Kein Nocturne-Farbwert.
5. **Nicht designte Screens:** ✅ **Mitbauen nach Bau-Urteil** in derselben Bildsprache. Vorgehen: vor der Umsetzung je Bereich ein Wireframe/Skizze zur Freigabe, dann bauen. Blockiert 1a/1b/1c nicht.
6. **Icons/Schrift:** ✅ **Beides wechseln** – Phosphor (`@phosphor-icons/react`, gebündelt) + Inter self-hosted (`.woff2`). Betrifft das **ganze** Frontend; `react-icons/md` und Trueno/Library3 fliegen raus.
7. **Storno-Semantik:** ✅ **Weich, ohne Grund, umkehrbar.** `bill.is_deleted`; Beleg ausgegraut + Status „Storniert"; aus Tagessumme raus; per Klick reaktivierbar; **kein** Grund-Feld.

---

## Teil G – Entscheidungen aus dem Betriebs-Feedback (2026-09-07)

Nach der ersten Bedienung am fertigen Produkt. Alle Punkte sind umgesetzt.

- **D21 – Revisionszähler an der aktiven Bestellung.** `active_order.revision`
  steigt bei jeder Änderung; Client übernimmt nur einen *neueren* Stand.
  Grund: 10"-Terminal und Handy tippen auf denselben Korb, Antworten und
  SSE-Nachrichten überholen sich. Ohne Zähler verschluckte die letzte
  eintreffende (alte) Antwort fremde Positionen.
  Migration `0004`.
- **D22 – Zeilen-Delta als ein einziges `INSERT … ON CONFLICT DO UPDATE`.**
  Zwei zeitgleiche erste Tipps auf dieselbe Position liefen vorher in eine
  Unique-Verletzung („Integritätsverletzung"). Test: `test_concurrency.py`.
- **D23 – Der SSE-Stream hält keine DB-Verbindung.** Die Request-Session wird
  nach dem ersten Lesen committet. Vorher blockierten zwei Displays plus Handy
  dauerhaft drei Verbindungen als `idle in transaction` – und jedes
  `alembic upgrade` lief in den Lock.
- **D24 – Pfandrückgabe je Pfandbetrag eine Zeile** (`active_deposit_return`).
  Gemischtes Leergut in einem Vorgang: 3 Weingläser à 2,00 € + 2 Biergläser
  à 1,50 € = 9,00 €. Die Sorten kommen aus dem Katalog (Artikel-Pfand), der
  Bediener tippt das Gefäß an, nicht den Betrag. Migration `0005`.
- **D25 – Bargeldbewegungen** (`cash_movement`, vorzeichenbehaftet).
  Wechselgeld nachlegen (+), Losung in den Tresor (−). Fließt in den
  Soll-Bestand des Kassenschnitts ein. Migration `0005`.
- **D26 – Kategorie-Symbol ist gewählt, nicht geraten.** Feste Icon-Tabelle
  (`CATEGORY_ICONS`), Schlüssel steht in `category.icon`. Die alte Namens-
  Heuristik bleibt nur als Notnagel für Alt-Bestand. Grund: am Ausschank wird
  auf das Bild getippt, nicht gelesen.
- **D27 – Artikelfarbe färbt die Kachel**, nicht nur einen Randstreifen
  (`color-mix`). Immer zusätzlich zum Namen, nie an seiner Stelle.
- **D28 – `sort_order` bleibt beim Bearbeiten stehen** (`None` = unverändert),
  Neues hängt hinten an. Vorher sprang ein Artikel bei jeder Preisänderung an
  den Anfang der Kachelwand.
- **D29 – „Leeren" ist eine Server-Operation** (`DELETE /api/active-order`).
  Vorher nur lokal: das Kundendisplay zeigte weiter die alte Bestellung.
- **D30 – Kein festes Spaltenraster.** Kachelwand `auto-fill`, Fußleiste und
  Kopfzeile schrumpfen statt zu überlaufen. Eine Querleiste kostet am Tresen
  Zeit.
- **D31 – Kein eigener Proxy-Container mehr** (nachträglich dokumentiert; die
  Änderung fiel beim v2-Umbau an, ohne hier vermerkt zu werden).
  Bis dahin: Service `proxy` (`nginx:alpine`, Port 80, `./nginx.conf`), der
  `/api/` an `backend:8000` und alles andere an `frontend:80` weiterreichte.
  Die Aufgabe liegt jetzt an zwei Stellen:
  - **Prod:** `frontend/nginx.conf` im Frontend-Container – Port 80, SPA aus
    `/usr/share/nginx/html`, `/api/` an `backend:8000`, dazu
    `proxy_buffering off` und `proxy_read_timeout 1h` für den SSE-Strom.
    Einstieg bleibt `http://<pi>/`.
  - **Dev:** der Proxy des Vite-Dev-Servers (`server.proxy["/api"]`).

  Zusätzlich hätte die alte `nginx.conf` mit v2 nicht mehr funktioniert:
  `proxy_pass http://…:8000/` (mit Schrägstrich) schnitt das `/api`-Präfix ab,
  und sie zeigte auf `frontend:80` – im Dev-Stack läuft Vite auf 3000.
  **Preis:** kein gemeinsamer Einstiegspunkt auf Port 80 im Dev-Stack (dort
  `:3000` fürs Frontend, `:8000` fürs Backend) und keine Stelle für
  TLS-Terminierung. Beides wird derzeit nicht gebraucht; wenn doch, kommt der
  Container mit ~15 Zeilen zurück.

  **Zweites Gerät (Handy im Hotspot):** unkritisch, weil das Frontend
  ausschließlich relative Pfade benutzt (`BASE = "/api"`, `EventSource
  ("/api/active-order/stream")`) – wer die Seite ausliefert, beantwortet auch
  die API. Auf dem Pi ist das `http://<pi>/`, Port 80; das Backend hat in
  `docker-compose.prod.yml` gar kein `ports:` und ist von außen nicht
  erreichbar. Nachgemessen am gebauten Prod-Image: SPA, SPA-Fallback,
  `GET/POST /api` und der live gepushte SSE-Strom laufen alle über Port 80.
  Im Dev-Stack wies Vite fremde Host-**Namen** mit 403 ab (IP-Adressen gingen
  durch) – deshalb `server.allowedHosts: true` in `vite.config.ts`.

- **D32 – Rückgeld über die Stückelung, nicht über feste Scheine.** Vorher
  gab es 5/10/20/50 als Auswahl; bei 40,30 € war davon nur der 50er
  anklickbar. Jetzt: „passend", zwei zum Betrag berechnete Vorschläge
  (`changeSuggestions`: nächste Fünferstufe, nächster Schein, Zehnerstufe,
  fünf Euro mehr – gedeckelt auf rund 20 € Rückgeld, damit für 52,80 € kein
  100er vorgeschlagen wird), eine Zeile Stückelung zum Aufaddieren und die
  freie Eingabe. 45 € oder 42 € sind damit drei Tipps.
  **Darstellung:** Scheine (50/20/10/5) eckig und warm hinterlegt, Münzen
  (2/1/0,50) rund – das trennt die Gruppen ohne eine zweite Zeile, für die
  auf 600 px Höhe kein Platz ist. Beschriftung über `euroShort()`: glatte
  Beträge als „20 €", Münzen als „50 ct"; Summen und Rückgeld bleiben bei
  `euro()`, dort zählt jeder Cent.
  **Höhe:** Der Dialog muss ohne Rollbalken auf das 10"-Terminal passen –
  beim Kassieren steht der Gast davor. Deshalb ist bei offener Zehnertastatur
  alles darunter ausgeblendet (erst übernehmen, dann abschließen), und unter
  560 px Höhe greift eine Media-Query, die Schriftgrößen und Knopfhöhen
  strafft.
- **D33 – Trinkgeld ist eine Bargeldbewegung, kein Umsatz.** Bleibt beim
  Kassieren etwas übrig und der Gast sagt „stimmt so", bucht der Knopf
  „Stimmt so · X Trinkgeld" die Differenz als `cash_movement` mit dem Grund
  „Trinkgeld" (siehe D25). Der Bon bleibt unverändert – das Geld liegt aber in
  der Kasse und muss im Soll-Bestand stehen, sonst zeigt der Kassenschnitt
  abends einen unerklärten Überschuss. Scheitert nur die Trinkgeld-Buchung,
  bleibt der Bon stehen und der Bediener wird ausdrücklich darauf hingewiesen.

---

## Quellen

- [Create React App is Now Deprecated – Build5Nines](https://build5nines.com/create-react-app-is-now-deprecated-time-to-migrate-to-vite-or-next-js/) (2025)
- [Create React App Deprecated: Enterprise Migration Guide – LegacyLeap](https://www.legacyleap.ai/blog/create-react-app-deprecated/) (2025)
- [react-beautiful-dnd is now deprecated · Issue #2672](https://github.com/atlassian/react-beautiful-dnd/issues/2672) (Archiv 2025-08-18)
- [dnd-kit vs react-beautiful-dnd vs Pragmatic DnD 2026 – PkgPulse](https://www.pkgpulse.com/guides/dnd-kit-vs-react-beautiful-dnd-vs-pragmatic-drag-drop-2026)
- [Top 5 Drag-and-Drop Libraries for React – Puck](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) (2026)
- [zhanymkanov/fastapi-best-practices](https://github.com/zhanymkanov/fastapi-best-practices)
- [Exception Handling Best Practices in Python: A FastAPI Perspective – Medium/delivus](https://medium.com/delivus/exception-handling-best-practices-in-python-a-fastapi-perspective-98ede2256870)
- [The Hidden Bias of Alembic and Django Migrations – Atlas](https://atlasgo.io/blog/2025/02/10/the-hidden-bias-alembic-django-migrations) (2025-02-10)
- [How to Write Integration Tests for Python APIs with Testcontainers – OneUptime](https://oneuptime.com/blog/post/2025-01-06-python-testcontainers-integration/view) (2025-01-06)
- [testcontainers-python documentation](https://testcontainers-python.readthedocs.io/)
- [Browser Tab Synchronization with BroadcastChannel – OpenReplay](https://blog.openreplay.com/browser-tab-sync-broadcastchannel/)
- [Setting up a FastAPI App with Async SQLAlchemy 2.0 & Pydantic V2 – ByteGoblin](https://bytegoblin.io/blog/setting-up-a-fastapi-app-with-async-sqlalchemy-2-0-pydantic-v2)
- [Kiosk mode on RPi 5 with Bookworm (working in 2025) – Raspberry Pi Forums](https://forums.raspberrypi.com/viewtopic.php?t=389880)
- [Automated RPi Web Kiosk Setup in 2025 – benswift.me](https://benswift.me/blog/2025/07/16/automated-rpi-web-kiosk-setup-in-2025/)
