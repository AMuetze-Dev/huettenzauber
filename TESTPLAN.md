# Testplan & Code-Review – Hüttenzauber

Stand: 2026-09-07. Grundlage: aktueller Stand in `backend/` und `frontend/src/`.

Dieses Dokument hat zwei Teile:

1. **Befunde** aus dem Code-Review (was fehlerhaft ist oder brechen kann).
2. **Testfallkatalog** – Testfälle je Komponente, die *nach* den Korrekturen grün sein sollen. Sie beschreiben das Soll-Verhalten, nicht das aktuelle.

Der nächste Schritt (Qualität mit `grill-me` / `junior-to-senior`, UI mit claude.ai/design) baut auf Abschnitt „Priorisierte Bugliste" auf.

> **Update 2026-09-07 (v2-Umbau, Stufe 1-3):** §4 unten beschreibt die **alten IST-Controller** (jetzt in `backend/_legacy_ist/`, nicht mehr aktiv). Die v2-API hat andere Endpunkte (`/api/catalogs`, `/api/events`, `/api/active-order`, `/api/bills`) und ein modernisiertes Statuscode-Mapping: **404** not-found, **409** Konflikt (statt 400 „existiert bereits"), **400** Geschäftsregel, **422** Request-Shape (Pydantic). Aktive Tests: `backend/test/test_happy_path.py`, `test_catalog_errors.py`, `test_flow_errors.py`. §4 wird beim Ausbau der v2-CRUD (Stufe 4) an die neue API angeglichen.

---

## 1. Testinfrastruktur – Ist-Zustand

### Backend

| Punkt | Ist | Problem |
|---|---|---|
| Test-Runner | `pytest`, `pytest-watch` (`start_pytest.bat` → `ptw`) | ok |
| DB für Tests | PostgreSQL, `huettenzauber_test` auf `DATABASE_HOST` (Batch setzt `localhost`) | DB `huettenzauber_test` wird nicht automatisch angelegt; Test-DB-Lebenszyklus ungeregelt |
| `database.py` | `create_engine(...)` + `Base.metadata.create_all()` **auf Modulebene** | Import von `app` löst sofort Verbindungsaufbau + `create_all` aus – auch gegen die Produktiv-DB `huettenzauber`; Tests können die Engine nicht sauber ersetzen, bevor der Seiteneffekt gelaufen ist |
| `conftest.py` | fehlt | Jede Testdatei kopiert denselben ~30-Zeilen-Block (Engine, `override_get_db`, Fixture). Drift ist schon da: mal mit `drop_all` im Teardown, mal ohne |
| `test_BillController_fixed.py` | leere Datei | löschen |
| Doppelter `import pytest` | in `test_StockItemController.py`, `test_StockItemSortingController.py` | Kosmetik |
| Fehlende Testdateien | `DepositReturnController` / `DepositReturnService`, `ItemVariantController` / `ItemVariantService`, `app.py` (Routing/CORS), `database.py` | keinerlei Abdeckung |

**Empfehlung Backend-Infra (vor dem Testschreiben):**

- `conftest.py` mit einer gemeinsamen Fixture, `app.dependency_overrides` einmalig.
- `database.py` entkoppeln: Engine/`create_all` in eine Funktion (`init_db()` / Lifespan-Handler), nicht auf Modulebene. So kann die Test-Fixture die Engine setzen, bevor irgendein Seiteneffekt läuft.
- **Tests gegen echtes PostgreSQL** (Docker in Dev, gleiches Setup auf dem Pi) – kein SQLite. SQLite weicht bei Dialekt, `ON DELETE CASCADE` und Typen ab und würde genau die Bugs verdecken, die die Tests fangen sollen. Optionen: dedizierter Test-Container (`testcontainers-python`) oder `huettenzauber_test`-DB im selben Container, per Fixture `create_all`/`drop_all` oder transaktionales Rollback pro Test.
- Ein `pytest.ini` / `pyproject.toml` mit `testpaths`, `pythonpath = ["."]` statt `sys.path.append` in jeder Datei.

### Frontend

| Punkt | Ist | Problem |
|---|---|---|
| Test-Setup | `react-scripts test` + `@testing-library/*` in `package.json` | vorhanden, aber **keine einzige Testdatei** |
| Reine Logik | `PersistentCartContext` Reducer, `calculateTotals`, `getItemName`, `calculateChange`/`getTotalToPay` | gut isoliert testbar, aktuell ungetestet |
| React-Version | `package.json` nennt `react` 19 **und** `@types/react` 18; `react-beautiful-dnd` (nur bis React 18) | Kompatibilitäts-/Typrisiko, vor UI-Rework klären |

**Empfehlung Frontend-Infra:**

- Helferfunktionen und den Reducer aus den Kontext-Dateien in eigene, importierbare Module ziehen (`cartReducer.ts`), dann ohne Renderer testen.
- Für Komponenten: `@testing-library/react` + `msw` (Mock Service Worker) für die `fetch`-Aufrufe der Kontexte.

---

## 2. Befunde Backend

Nummerierung `B-n`. Schweregrad: 🔴 Datenintegrität/falscher Statuscode · 🟠 Logikfehler · 🟡 Wartbarkeit.

### B-1 🔴 `CategoryService.delete` – 500 statt 404 bei unbekannter ID
`service/CategoryService.py` Zeile ~57:
```python
if stock_items := db.query(Category).filter(Category.id == category_id).first().stock_items:
```
Der `.first()` liefert `None`, wenn die Kategorie nicht existiert → `None.stock_items` → `AttributeError` → HTTP 500. Die `if not category`-Prüfung steht erst *danach*. Der bestehende Test `test_delete_category_not_found` (erwartet 404) schlägt fehl.
**Soll:** zuerst Existenz prüfen (404), dann „hat noch Artikel" prüfen (400), dann löschen.

### B-2 🔴 `BillService.create` – verwaiste Bill + falscher Statuscode
`service/BillService.py`:
- Der `Bill`-Datensatz wird **committet** (Zeile ~28), *bevor* die Positionen validiert werden.
- Schlägt danach eine Position fehl (`ItemVariant` nicht gefunden → `HTTPException(404)`), wird diese Exception vom `except Exception`-Block gefangen und als **HTTP 400** mit generischer Meldung neu geworfen. Der 404 geht verloren.
- Die zuvor committete leere `Bill` bleibt in der DB.
**Soll:** Bill und Positionen in *einer* Transaktion; `HTTPException` nicht neu einpacken (vor `except Exception` abfangen oder `except HTTPException: raise`); ungültige Variante → 404; keine Teil-Bill.

### B-3 🟠 `BillController.create_bill` ignoriert das Client-Datum
`BillCreateDTO` hat kein `date`-Feld; der Controller setzt `datetime.now().strftime("%Y-%m-%d %H:%M:%S")`. Das Frontend (`CheckoutModal`, `CartModal`) schickt `date`, es wird still verworfen. Zusätzlich wandert ein *Datetime*-String in eine `Date`-Spalte (`Bill.date`).
**Soll:** entweder `date` im DTO akzeptieren und validieren, oder Feld im Frontend entfernen; Spaltentyp klären (für POS mit vielen Rechnungen pro Tag ist ein echter Zeitstempel nötig, sonst ist `get_all().order_by(Bill.date.desc())` innerhalb eines Tages zufällig).

### B-4 🟠 `ItemVariantController` ist nicht registriert
`app.py` bindet `category`, `category_sorting`, `stock_item`, `stock_item_sorting`, `bill`, `deposit_return` – **nicht** `item_variant`. Alle `/item-variants/*`-Endpunkte liefern 404.
**Soll:** entweder `app.include_router(item_variant_router)` ergänzen oder den Controller entfernen, falls Varianten bewusst nur über `/stock-items` verwaltet werden.

### B-5 🔴 `ItemVariantService.get_all_in_stock_item` / `get_by_id` – Anzeige-Fallback wird in die DB geschrieben
```python
for v in variants:
    if v.name is None or v.name.strip() == "": v.name = str(v.bill_steps)
```
Die ORM-Objekte werden mutiert. Die Produktiv-Session (`database.py`: `sessionmaker(autoflush=True, ...)`) flusht diese Änderung beim nächsten Query zurück → der generierte Name („1.0") landet dauerhaft in der DB. Die Testsession nutzt `autoflush=False` und verdeckt das.
**Soll:** Fallback nur im DTO/Response berechnen, ORM-Objekt nicht anfassen (z. B. Wert im Controller mappen oder `expunge`/detached Kopie).

### B-6 🟠 Sortier-`sort_order` – 0-basiert vs. 1-basiert gemischt
- `CategoryService.create` → neuer Eintrag `sort_order = count + 1` (1-basiert).
- `CategorySortingService.bulk_update_sorting` → `sort_order = idx` (0-basiert).
- `CategorySortingService.move_category` → lehnt `sort_order < 1` ab und begrenzt auf `count`.
Nach einem Bulk-Update hat der erste Eintrag `sort_order = 0`; `move_category` kann diese Position nie mehr ansteuern (Off-by-one). Analog `StockItemSortingService`.
**Soll:** eine Konvention (empfohlen: 0-basiert durchgehend) und `move_*` entsprechend anpassen.

### B-7 🟠 `StockItemService.create` – `sort_order` per `count()` kann kollidieren
```python
StockItemSortingService.add_item_to_sorting(db, item_id=item.id, sort_order=db.query(ItemSorting).count())
```
Nach Löschungen ist `count()` kleiner als der höchste vergebene `sort_order` → doppelte Werte. `ItemSorting.item_id` ist `unique`, `sort_order` nicht. Ordnung wird nicht-deterministisch.
**Soll:** `sort_order = max(sort_order) + 1` oder `COALESCE(MAX,-1)+1`.

### B-8 🟠 `StockItemService` – Längenprüfung nur bei `create`, falsche Meldung
`create`: `... or name.__len__() > 50: raise HTTPException(400, "Name darf nicht leer sein")` – Meldung passt nicht zur Ursache. `update` hat *keine* Längenprüfung → Update auf >50 Zeichen läuft in einen DB-Fehler (`String(50)`), der als generischer 400 zurückkommt.
**Soll:** gemeinsame Validierung für `create`/`update`, eigene Meldung „Name darf höchstens 50 Zeichen haben".

### B-9 🟠 `bulk_update` (StockItem) ist nicht atomar
`StockItemService.bulk_update` ruft in der Schleife `update()` (mit `commit`) auf und wirft bei einer späteren fehlenden ID einen 404 – die vorher verarbeiteten Items sind bereits geändert. Der bestehende Test `test_bulk_update_partial_failure` zementiert dieses Verhalten sogar.
**Soll (Entscheidung nötig):** entweder dokumentiert nicht-atomar (Test umbenennen, Verhalten bewusst) oder alle Prüfungen *vor* der ersten Schreiboperation, dann ein `commit`.

### B-10 🟡 `update` erzeugt bei jeder Änderung neue Zeilen (Versionierung über Insert)
`StockItemService.update` und `ItemVariantService.update` legen eine neue Zeile an und setzen die alte auf `is_active=False`. Folge: die `id` eines Artikels/einer Variante ändert sich bei jedem Edit. `BillItem.item_variant_id` zeigt danach auf die alte (inaktive) Variante; Statistiken müssen inaktive Varianten mitladen (tun sie, `get_all_in_stock_item` filtert nicht auf `is_active`). Bei reinem StockItem-Edit werden die Varianten *nicht* mitkopiert → der neue Artikel hat keine Varianten, die alten hängen an der alten ID.
**Soll:** bewusst entscheiden – echtes Verlaufsmodell (eigene History-Tabelle) oder In-Place-Update mit Preis-Snapshot in `BillItem` (siehe B-11).

### B-11 🟠 `BillItem` speichert keinen Preis-Snapshot
`BillItem` hat nur `item_variant_id` + `item_quantity`. Der Umsatz wird im Frontend rückwirkend aus dem *aktuellen* Variantenpreis berechnet. Ändert sich ein Preis, ändern sich historische Auswertungen (solange die alte Variantenzeile noch existiert, ist der Wert eingefroren – aber das ist Zufall, kein Design).
**Soll:** `BillItem.item_price` (und ggf. `item_name`) beim Anlegen persistieren. Das Frontend erwartet das Feld bereits (`BillContext.BillItem.item_price`, `BillsStatistics.getItemPrice`).

### B-12 🟡 `app.py` CORS: `allow_origins=["*"]` + `allow_credentials=True`
Starlette sendet mit Credentials kein `Access-Control-Allow-Origin: *`; der Browser blockt. Aktuell funktioniert es nur, weil das Frontend die API absolut über `http://192.168.189.162:8000` (`constants.ts`) anspricht und `credentials` nie gesetzt wird – fragil.
**Soll:** konkrete Origins listen (Pi-IP, `localhost:3000`) oder `allow_credentials=False`.

### B-13 🟡 `database.py`: fest verdrahtete Zugangsdaten, kein Migrationskonzept
`postgresql://root:root@{host}:5432/huettenzauber` im Code. Schema entwickelt sich sichtbar weiter (`version`, `is_active`, `is_deleted`, `base_item_id`) ohne Alembic. `docker-compose.yml` setzt `DATABASE_URL`, der Code liest aber `DATABASE_HOST` – die `DATABASE_URL` aus Compose wird ignoriert. Zusätzlich: Compose-Service heißt `db`, der Code-Default-Host ist `postgres_db` (nur `container_name`), das ist im Compose-Netz kein DNS-Alias.
**Soll:** eine Variable (`DATABASE_URL`) konsistent nutzen; Alembic einführen; Compose und Code angleichen.

### B-14 🟡 N+1-Queries bei Artikel-Listen
`StockItemController.get_all` / `get_all_with_deleted` / `get_all_in_category` laden Varianten pro Artikel einzeln. Auf dem Pi bei großem Sortiment spürbar.
**Soll:** `selectinload(StockItem.item_variants)` bzw. ein Join.

### B-15 🟡 `get_all_in_category` liefert 400 bei leerer Kategorie
`StockItemService.get_all_in_category` wirft 400 „Kein Item in dieser Kategorie gefunden". REST-üblich wäre `200` + `[]`. Der bestehende Test erwartet aktuell 400.
**Soll:** Entscheidung; falls leer = 200/`[]`, Test anpassen.

### B-16 🟡 Toter Code
`StockItemSortingService.move_item` wird von keinem Controller aufgerufen (`StockItemSortingController` hat nur `GET /` und `PUT /`). `CategorySortingService.add_category_to_sorting` wird nur intern nicht genutzt (Kategorie-Anlage macht es inline).

### B-17 🟠 `DepositReturn` – keine Verknüpfung zur Rechnung, kein Storno-Konzept
`DepositReturnService.create` prüft `stock_item.is_active` und `deposit_amount > 0`, legt einen Einzelposten an. Es gibt keine Beziehung zu einer `Bill` und `delete` ist ein Hard-Delete. Für eine spätere Kassenabrechnung fehlt der Bezug „Pfandrückgabe gehört zu Vorgang X".
**Soll:** fachlich klären, ob Pfandrückgaben eigenständig bleiben oder an eine Bill hängen.

---

## 3. Befunde Frontend

Nummerierung `F-n`.

### F-1 🔴 `ProductContext` – falsche Varianten-Endpunkte
```js
fetch(`${api}/item_variants/`, ...)      // POST
fetch(`${api}/item_variants/${id}`, ...) // PUT/DELETE
```
Der Backend-Prefix ist `/item-variants` (Bindestrich) – und der Router ist ohnehin nicht registriert (B-4). `addItemVariant` / `updateItemVariant` / `deleteItemVariant` sind komplett funktionslos.
**Soll:** Pfad korrigieren *und* Backend-Router registrieren, oder Varianten ausschließlich über `PUT /stock-items/{id}` pflegen und diese drei Funktionen entfernen.

### F-2 🔴 `ProductContext.updateCategorySorting` – falscher Endpunkt
```js
fetch(`${api}/categories/bulk`, { method: 'PUT', body: JSON.stringify({ ordered_category_ids }) })
```
Diese Route existiert nicht. Richtig: `PUT /category-sorting/bulk`. Kategorie-Sortierung per Drag & Drop wird nicht gespeichert (stiller `toast.error`).

### F-3 🟠 `BillContext.addBill` schluckt Fehler – Checkout „gelingt" trotzdem
`addBill` fängt `!res.ok` selbst ab (`toast.error`) und wirft **nicht** weiter. `CheckoutModal.handleConfirmOrder` und `CartModal.handleConfirmOrder` haben ein `try/catch`, das nie auslöst → `cart.clearCart()` läuft auch dann, wenn die Rechnung nicht gespeichert wurde. Der Warenkorb ist weg, die Bestellung verloren.
**Soll:** `addBill` wirft bei Fehler; Modal räumt den Warenkorb nur nach Erfolg.

### F-4 🟠 Zwei bis drei Warenkorb-Implementierungen
`context/CartContext.tsx` (nicht persistent, **nirgends importiert**), `context/PersistentCartContext.tsx` (aktiv), `context/PersistentCartContextUpdated.tsx` (verwaist). Nur der mittlere wird genutzt.
**Soll:** die beiden ungenutzten löschen.

### F-5 🟠 `order.page.tsx` – `<CartModal>` doppelt gerendert
Zeilen ~164 und ~183 rendern beide `<CartModal isOpen={isCartModalOpen} ...>` (einmal ohne, einmal mit `onCheckoutComplete`). Zwei Overlays im DOM.
**Soll:** eine Instanz.

### F-6 🟠 Verschachtelte `ProductProvider`
`App.tsx` umschließt alle Routen mit `ProductProvider`. `service.page.tsx` und `order.page.tsx` (Default-Export) legen jeweils einen **weiteren** `ProductProvider` darüber. Doppeltes `reloadAll()` (3 fetches × Provider-Ebenen) beim Seitenaufbau auf dem Pi.
**Soll:** genau ein `ProductProvider` (in `App.tsx`).

### F-7 🟠 `CheckoutModal.handleConfirmOrder` – `setDepositReturn(2, 0)` hart kodiert
Nach dem Bestätigen wird der Pfandpreis fest auf 2 € zurückgesetzt, unabhängig vom eingestellten Wert (`CartModal` nutzt `localStorage['depositReturnPrice']`).
**Soll:** auf 0/`undefined` zurücksetzen und den Preis aus dem gespeicherten Wert lesen.

### F-8 🟠 `CheckoutModal` vs. `CartModal` – zwei Checkout-Wege, unterschiedliches Verhalten
`CheckoutModal` (Props `onConfirm`) wird im Code nirgends mit `isOpen=true` eingebunden; genutzt wird `CartModal`. Der auskommentierte Rückgeldrechner steckt in beiden.
**Soll:** einen Checkout behalten, den anderen entfernen.

### F-9 🟡 `ProductContext.ItemVariant` – Tippfehler im Typ
`stock_item_od: number` statt `stock_item_id`. Wird aktuell nirgends gelesen, aber eine Falle.

### F-10 🟡 `BillContext.BillItem` deklariert Felder, die die API nicht liefert
`id`, `bill_id`, `item_price` – die `BillDTO`-Antwort enthält nur `item_variant_id` + `item_quantity`. `BillsStatistics.getItemPrice` fällt deshalb immer auf den Live-Variantenpreis zurück (siehe B-11).
**Soll:** nach B-11 (Preis-Snapshot im Backend) auflösen; bis dahin Typ ehrlich machen (`item_price?`).

### F-11 🟡 `billing.page.getItemName` – fragile Heuristik
Variantenname gilt als „Standard", wenn er `=== '1.0'` oder `'Default'` ist. Bricht, sobald ein echtes Produkt „1.0" heißt (z. B. „1.0 L").
**Soll:** Flag `is_standard` oder Vergleich über Varianten-Anzahl + leeren Namen, nicht über Magic Strings.

### F-12 🟡 `VariantItem` (order.page) – Long-Press ohne Pointer-Capture
`handlePointerDown` startet einen 500-ms-Timer; `handlePointerLeave` und `handlePointerUp` löschen ihn. Auf Touch kann zwischen Down und Up ein `pointercancel` (Scroll) kommen, das nicht behandelt wird → hängender Timer, „-1" feuert nach dem Loslassen. `event.preventDefault()` in `pointerdown` unterdrückt zudem Fokus/Klick-Fallbacks.
**Soll:** `onPointerCancel` behandeln, `setPointerCapture`, Timer in `useRef`-Cleanup bei Unmount.

### F-13 🟡 `service.page` – `window.innerWidth` / `matchMedia` ohne Resize-Listener
`isSmallScreen`, `isTouchDevice`, `defaultDark` (`App.tsx`) werden einmalig beim Mount gelesen. Drehen des 10-Zoll-Terminals oder Theme-Wechsel des OS wird nicht übernommen.
**Soll:** `matchMedia`-Listener bzw. Resize-Handler.

### F-14 🟡 `PersistentCartContext` – `localStorage`/`CustomEvent` ohne try/catch beim Schreiben
Der Reducer schreibt bei jeder Änderung `localStorage.setItem` und feuert ein `CustomEvent`. Im privaten Modus / bei vollem Speicher wirft `setItem` → der Reducer bricht ab, State-Update verloren. Cross-Window-Sync (7"/10") hängt komplett an diesem einen Event.
**Soll:** Schreiben in try/catch; `storage`-Event als Fallback reicht für echte Fenster, das `CustomEvent` nur für Same-Window-Komponenten.

### F-15 🟡 Kein `ErrorBoundary`, `fetch`-Fehler nur als Toast
Fällt das Backend auf dem Pi weg, bleiben `categories`/`items`/`bills` leer, die Kontexte werfen in `reload*` – ohne Boundary sieht der Bediener eine weiße Seite.
**Soll:** `ErrorBoundary` um die Routen, Retry-Button.

---

## 4. Testfallkatalog Backend

Konvention der Tabellen: **Vorbedingung → Aktion → Erwartetes Ergebnis**. Alle Endpunkt-Tests laufen über `TestClient(app)` mit isolierter Test-DB pro Test.

### 4.1 CategoryController / CategoryService  (`/categories`)

| ID | Vorbedingung | Aktion | Erwartet |
|---|---|---|---|
| CAT-01 | leere DB | `GET /categories/` | 200, `[]` |
| CAT-02 | – | `POST` `{name:"Getränke", icon:"MdLocalBar"}` | 201, Body mit `id`, Name/Icon gespiegelt |
| CAT-03 | nach CAT-02 | `GET /categories/{id}` | 200, korrekte Kategorie |
| CAT-04 | – | `GET /categories/999999` | 404, `detail:"Kategorie nicht gefunden"` |
| CAT-05 | – | `GET /categories/abc` | 422 |
| CAT-06 | „Getränke" existiert | `POST` `{name:"Getränke", icon:"X"}` | 400, „existiert bereits" |
| CAT-07 | – | `POST` `{name:"", icon:"X"}` | 400, „Name darf nicht leer sein" |
| CAT-08 | – | `POST` `{name:"   ", icon:"X"}` | 400, „Name darf nicht leer sein" |
| CAT-09 | – | `POST` `{name:"X", icon:""}` | 400, „Icon darf nicht leer sein" |
| CAT-10 | – | `POST` `{name:"X"}` (kein Icon) | 422 |
| CAT-11 | – | `POST` `{name:null, icon:"X"}` | 422 |
| CAT-12 | – | `POST` Name mit Umlauten/Emoji `"Küche & Bar 🍕"` | 201, unverändert gespeichert |
| CAT-13 | – | `POST` Name 51 Zeichen | 400 **oder** 422 (definiert festlegen – aktuell undefiniert) |
| CAT-14 | „A" existiert | `PUT /categories/{id}` `{name:"B", icon:"Y"}` | 200, aktualisiert |
| CAT-15 | „A", „B" existieren | `PUT` B → `{name:"A", ...}` | 400, „existiert bereits" |
| CAT-16 | „A" existiert | `PUT` A → `{name:"A", icon:"A"}` (keine Änderung) | 200 |
| CAT-17 | – | `PUT /categories/999999` | 404 |
| CAT-18 | „A" existiert | `PUT` A → `{name:"", icon:"A"}` | 400 |
| CAT-19 | Kategorie ohne Artikel | `DELETE /categories/{id}` | 204, danach `GET` → 404 |
| CAT-20 | **Kategorie existiert nicht** | `DELETE /categories/999999` | **404** (aktuell 500 – B-1) |
| CAT-21 | Kategorie mit ≥1 aktivem Artikel | `DELETE` | 400, „noch Artikel dieser Kategorie zugewiesen" |
| CAT-22 | Kategorie gelöscht | `DELETE` erneut | 404 |
| CAT-23 | Anlage einer Kategorie | – | es entsteht **genau ein** `category_sorting`-Eintrag mit nächsthöherem `sort_order` |
| CAT-24 | Kategorie gelöscht | – | zugehöriger `category_sorting`-Eintrag ist ebenfalls weg |
| CAT-25 | „TestCase" existiert | `POST` `{name:"testcase"}` | 201 (Namensvergleich case-sensitiv) – *oder* bewusst 400, festlegen |

### 4.2 StockItemController / StockItemService  (`/stock-items`)

| ID | Vorbedingung | Aktion | Erwartet |
|---|---|---|---|
| ITM-01 | Kategorie K | `POST` `{name:"Cola", category_id:K, item_variants:[{name:"0,5L", price:2.5, bill_steps:1}]}` | 201, `is_active=true`, 1 Variante |
| ITM-02 | K, „Cola" aktiv | `POST` erneut „Cola" in K | 400, „existiert bereits ... aktiv" |
| ITM-03 | K | `POST` `{name:"", ...}` | 400 |
| ITM-04 | K | `POST` Name 51 Zeichen | 400, Meldung nennt **Länge** (B-8) |
| ITM-05 | – | `POST` `category_id:999999` | 404, „Kategorie nicht gefunden" |
| ITM-06 | – | `POST` `category_id:"abc"` | 422 |
| ITM-07 | 2 Artikel in K | `GET /stock-items/` | 200, beide enthalten, nur aktive |
| ITM-08 | Artikel I | `GET /stock-items/{I}` | 200, mit `item_variants` |
| ITM-09 | – | `GET /stock-items/999999` | 404 |
| ITM-10 | Artikel I | `PUT /stock-items/{I}` `{name:"Cola Zero", category_id:K}` | 200, Name geändert, weiterhin aktiv |
| ITM-11 | Artikel I | `PUT` Name `""` | 400 |
| ITM-12 | „A", „B" in K | `PUT` B → Name „A" | 400 |
| ITM-13 | Artikel I | `PUT` `category_id:999999` | 404 |
| ITM-14 | – | `PUT /stock-items/999999` | 404 |
| ITM-15 | Artikel I aktiv | `DELETE /stock-items/{I}` | 204; danach `GET` → 404; Artikel `is_active=false`, `category_id=NULL`; `item_sorting`-Eintrag weg; alle Varianten `is_active=false` |
| ITM-16 | Artikel gelöscht | `DELETE` erneut | 400, „Inaktiver Artikel ..." |
| ITM-17 | – | `DELETE /stock-items/abc` | 422 |
| ITM-18 | gelöschter + aktiver Artikel | `GET /stock-items/all` | 200, enthält auch den inaktiven |
| ITM-19 | Kategorie K mit Artikel | `GET /stock-items/category/{K}` | 200, nur aktive Artikel aus K |
| ITM-20 | – | `GET /stock-items/category/999999` | 404 |
| ITM-21 | leere Kategorie K | `GET /stock-items/category/{K}` | **festlegen**: 200/`[]` (empfohlen) vs. aktuell 400 (B-15) |
| ITM-22 | `POST` mit 2 Varianten unterschiedlicher Preise | – | 201, 2 Varianten |
| ITM-23 | `POST` Variante `name:""` | – | 201, Variantenname = `str(bill_steps)` in der Antwort, **DB-Wert bleibt leer/NULL** (B-5) |
| ITM-24 | `POST` Variante ohne `name` | – | 201, Antwort-Name = `str(bill_steps)` |
| ITM-25 | `POST` Variante `price:-1` | – | 400, „Preis muss >= 0 sein" |
| ITM-26 | `POST` Variante `bill_steps:0` | – | 400, „> 0" |
| ITM-27 | `POST` 2 Varianten gleicher Name **und** Preis | – | 400 |
| ITM-28 | `POST` 2 Varianten gleicher Name **und** bill_steps, anderer Preis | – | 400 |
| ITM-29 | `POST` 2 Varianten gleicher Preis, **anderer** Name | – | 201 (erlaubt) |
| ITM-30 | Artikel I mit 1 Variante | `PUT` mit Variantenliste + neuer Variante (id fehlt/≤0) | 200, neue Variante angelegt |
| ITM-31 | Artikel I mit 2 Varianten | `PUT` mit nur der ersten Variante | 200, Antwort hat 1 Variante |
| ITM-32 | Artikel I | `PUT` Variante `price` → 9.99 | 200, Preis 9.99 |
| ITM-33 | Artikel I | `PUT` Variante `price:"abc"` | 422 |
| ITM-34 | Artikel I | `PUT` Variante ohne `price` | 422 |
| ITM-35 | Artikel I | `PUT` Variante `bill_steps:0` | 400 |
| ITM-36 | Artikel I | `PUT` `item_variants: []` | **festlegen** – aktuell 200 mit 0 Varianten (Test heißt „forbidden", Verhalten widerspricht Namen, B-10) |
| ITM-37 | 2 Artikel B1,B2 in K | `PUT /stock-items/bulk` `[{id:B1,name:"B1x",category_id:K},{id:B2,name:"B2",category_id:K}]` | 200, B1 umbenannt, beide aktiv |
| ITM-38 | Bulk mit `{id:999999,...}` | – | 404 |
| ITM-39 | Bulk mit inaktivem Artikel | – | 400 |
| ITM-40 | Bulk, ein Eintrag ohne `id` | – | 422 |
| ITM-41 | `PUT /stock-items/bulk` `[]` | – | 200, `[]` |
| ITM-42 | Bulk, zwei Einträge gleiche `id` | – | 400 |
| ITM-43 | Bulk, `name:null` | – | 422 |
| ITM-44 | Bulk, zwei Einträge gleicher neuer Name | – | 400 |
| ITM-45 | Bulk mit gültigem + ungültigem Eintrag | – | 404; **Verhalten bei Teilanwendung dokumentieren** (B-9) |
| ITM-46 | nach mehreren `create` + `delete` | – | alle `item_sorting.sort_order` sind **paarweise verschieden** (B-7) |

### 4.3 ItemVariantController / ItemVariantService  (`/item-variants`)

> Setzt B-4 voraus (Router registrieren). Bis dahin: alle Endpunkte 404.

| ID | Vorbedingung | Aktion | Erwartet |
|---|---|---|---|
| VAR-01 | Artikel I | `GET /item-variants/stock-item/{I}` | 200, Liste der Varianten von I |
| VAR-02 | Variante V | `GET /item-variants/{V}` | 200 |
| VAR-03 | – | `GET /item-variants/999999` | 404, „Variante nicht gefunden" |
| VAR-04 | Artikel I | `POST` `{stock_item_id:I, name:"1L", price:3, bill_steps:1}` | 201 |
| VAR-05 | – | `POST` `stock_item_id:999999` | 404, „StockItem nicht gefunden" |
| VAR-06 | Artikel I | `POST` `price:-1` | 400 |
| VAR-07 | Artikel I | `POST` `bill_steps:0` | 400 |
| VAR-08 | I hat Variante „1L"/3 € | `POST` erneut „1L"/3 € | 400 |
| VAR-09 | Variante V | `PUT /item-variants/{V}` `{price:4}` | 200, neuer Datensatz, `version` erhöht, alter `is_active=false` |
| VAR-10 | inaktive Variante | `PUT` | 400, „Inaktive Variante ..." |
| VAR-11 | Variante V | `DELETE /item-variants/{V}` | 204, `is_active=false` |
| VAR-12 | inaktive Variante | `DELETE` | 400, „bereits inaktiv" |
| VAR-13 | Variante ohne Namen | `GET` | 200, `name == str(bill_steps)` in Antwort; DB unverändert (B-5) |

### 4.4 BillController / BillService  (`/bills`)

| ID | Vorbedingung | Aktion | Erwartet |
|---|---|---|---|
| BILL-01 | Variante V | `POST /bills/` `{items:[{item_variant_id:V, item_quantity:1}]}` | 201, `id`, `date`, 1 Position |
| BILL-02 | 3 Varianten | `POST` mit 3 Positionen | 201, 3 Positionen |
| BILL-03 | – | `POST` `{items:[]}` | 400 oder 422 |
| BILL-04 | – | `POST` `{}` | 422 |
| BILL-05 | – | `POST` `{items:[{item_variant_id:999999, item_quantity:1}]}` | **404** (aktuell 400 – B-2), **und keine Bill in der DB** |
| BILL-06 | Variante V | `POST` `item_quantity:0` | 400 (definiert), keine Bill |
| BILL-07 | Variante V | `POST` `item_quantity:-1` | 400/422, keine Bill |
| BILL-08 | Variante V | `POST` `item_quantity:2.5` | 201 (Teilmengen erlaubt) |
| BILL-09 | Variante V | `POST` `item_quantity:"abc"` | 422 |
| BILL-10 | Bill B | `GET /bills/{B}` | 200 |
| BILL-11 | – | `GET /bills/999999` | 404 |
| BILL-12 | 3 Bills | `GET /bills/` | 200, ≥3, absteigend nach Datum |
| BILL-13 | Bill B | `DELETE /bills/{B}` | 204; nicht mehr in `GET /bills/`; in `GET /bills/all` mit `is_deleted=true` |
| BILL-14 | Bill B gelöscht | `GET /bills/{B}` | 404 |
| BILL-15 | – | `DELETE /bills/999999` | 404 |
| BILL-16 | 2 Bills, eine gelöscht | `GET /bills/all` | beide enthalten |
| BILL-17 | Variante V | `POST` mit derselben Variante zweimal in `items` | 201, 2 Positionen |
| BILL-18 | erfolgreicher `POST` | – | Antwort enthält Positionen mit `item_price` (Snapshot) – setzt B-11 voraus |
| BILL-19 | `POST` schlägt bei Position 2 fehl | – | Position 1 wurde **nicht** persistiert (Transaktion, B-2) |

### 4.5 CategorySortingController / CategorySortingService  (`/category-sorting`)

| ID | Vorbedingung | Aktion | Erwartet |
|---|---|---|---|
| CSORT-01 | leer | `GET /category-sorting/` | 200, `[]` |
| CSORT-02 | 2 Kategorien angelegt | `GET` | 200, 2 Einträge, aufsteigend `sort_order` |
| CSORT-03 | Kategorie K im Sorting | `DELETE /category-sorting/{K}` | 204 |
| CSORT-04 | – | `DELETE /category-sorting/999999` | 404 |
| CSORT-05 | K schon entfernt | `DELETE` erneut | 404 |
| CSORT-06 | K1,K2 | `PUT /category-sorting/move/{K1}?sort_order=2` | 200, `sort_order=2`, K2 rutscht auf 1 |
| CSORT-07 | K | `move` `sort_order=0` | 400 |
| CSORT-08 | K | `move` `sort_order=99` (> Anzahl) | 400 |
| CSORT-09 | – | `move /999999?sort_order=1` | 400 (nicht gefunden → aktuell 400, ggf. 404 gewünscht) |
| CSORT-10 | K | `move` `sort_order=abc` | 422 |
| CSORT-11 | K | `move` ohne `sort_order` | 422 |
| CSORT-12 | K1,K2,K3 | `PUT /category-sorting/bulk` `{ordered_category_ids:[K3,K1,K2]}` | 204; danach `GET` in genau dieser Reihenfolge |
| CSORT-13 | – | `bulk` `{ordered_category_ids:[]}` | 400 |
| CSORT-14 | K1 | `bulk` `[K1,K1]` | 400, „doppelte" |
| CSORT-15 | K1 | `bulk` `[K1, 999999]` | 400, „fehlen" |
| CSORT-16 | K1 | `bulk` `["abc"]` | 422 |
| CSORT-17 | K1 | `bulk` `{}` | 422 |
| CSORT-18 | K1,K2,K3 per Bulk sortiert | danach `move` eines Eintrags | konsistente, lückenlose `sort_order`-Folge (B-6: 0/1-Basis vorher festlegen) |

### 4.6 StockItemSortingController / StockItemSortingService  (`/item-sorting`)

| ID | Vorbedingung | Aktion | Erwartet |
|---|---|---|---|
| ISORT-01 | keine Items | `GET /item-sorting/` | 200, `[]` |
| ISORT-02 | 3 Items I1,I2,I3 | `PUT /item-sorting/` `{ordered_item_ids:[I3,I1,I2]}` | 204; `GET` → exakt `[I3,I1,I2]` |
| ISORT-03 | I1,I2 | `PUT` `[I1,I2,I1]` | 400, „doppelte" |
| ISORT-04 | I1 | `PUT` `[I1, 9999]` | 400, „fehlen oder sind inaktiv" |
| ISORT-05 | – | `PUT` `{ordered_item_ids:[]}` | 400 |
| ISORT-06 | – | `PUT` `{}` | 422 |
| ISORT-07 | I1,I2 sortiert, I1 gelöscht | `GET` | I1 nicht mehr enthalten |
| ISORT-08 | I2 → andere Kategorie (Update erzeugt neue ID) | `PUT` mit neuer ID | 204; neue ID in `GET` |
| ISORT-09 | 100 Items | `PUT` in umgekehrter Reihenfolge | 204; `GET` gibt exakt diese Reihenfolge |
| ISORT-10 | Items mit Umlaut/Emoji-Namen | `PUT` | Reihenfolge korrekt |
| ISORT-11 | nach mehreren Löschungen | `PUT` Restliste | `sort_order` lückenlos 0..n-1 |
| ISORT-12 | Item inaktiv (gelöscht) | `GET` | inaktives Item wird nicht gelistet (`get_all_sortings` joint `is_active`) |

### 4.7 DepositReturnController / DepositReturnService  (`/deposit-returns`)

| ID | Vorbedingung | Aktion | Erwartet |
|---|---|---|---|
| DEP-01 | Artikel mit `deposit_amount=0.15` | `POST /deposit-returns/` `{stock_item_id:I, quantity:10}` | 201, `deposit_amount_per_item=0.15`, `total_amount=1.5`, `created_at=heute` |
| DEP-02 | – | `POST` `quantity:0` | 400, „größer als 0" |
| DEP-03 | – | `POST` `quantity:-5` | 400 |
| DEP-04 | – | `POST` `stock_item_id:999999` | 404, „Artikel nicht gefunden" |
| DEP-05 | inaktiver Artikel | `POST` | 404 (Filter `is_active`) |
| DEP-06 | Artikel mit `deposit_amount=0` | `POST` | 400, „hat keinen Pfand" |
| DEP-07 | – | `POST` `quantity:"x"` | 422 |
| DEP-08 | 2 Pfandrückgaben | `GET /deposit-returns/` | 200, beide |
| DEP-09 | Pfandrückgabe D | `GET /deposit-returns/{D}` | 200 |
| DEP-10 | – | `GET /deposit-returns/999999` | 404 |
| DEP-11 | Pfandrückgabe D | `DELETE /deposit-returns/{D}` | 204; danach `GET` → 404 |
| DEP-12 | – | `DELETE /deposit-returns/999999` | 404 |
| DEP-13 | – | `GET /deposit-returns/abc` | 422 |

### 4.8 app.py / Routing / CORS

| ID | Aktion | Erwartet |
|---|---|---|
| APP-01 | `GET /docs` | 200 (OpenAPI erreichbar) |
| APP-02 | OpenAPI-Schema | enthält Prefixe `/categories`, `/category-sorting`, `/stock-items`, `/item-sorting`, `/bills`, `/deposit-returns` **und** `/item-variants` (nach B-4) |
| APP-03 | `OPTIONS /categories/` mit `Origin: http://<pi>:3000` | 200, `Access-Control-Allow-Origin` gesetzt (nach B-12 konkret, nicht `*`) |
| APP-04 | unbekannte Route `GET /foo` | 404 |

### 4.9 database.py

| ID | Aktion | Erwartet |
|---|---|---|
| DB-01 | `init_db()` (nach Refactor B-13) gegen die Test-Postgres-Instanz | legt alle Tabellen an, Seiteneffekt erst bei Aufruf – nicht beim Import |
| DB-02 | `get_db()` | liefert Session, schließt sie im `finally` |
| DB-03 | fehlende `DATABASE_URL` | klare Fehlermeldung statt stiller Default auf nicht auflösbaren Host |

---

## 5. Testfallkatalog Frontend

### 5.1 `cartReducer` (aus `PersistentCartContext` zu extrahieren) – reine Logik

| ID | Ausgangs-State | Action | Erwartet |
|---|---|---|---|
| RED-01 | leer | `ADD_ITEM` (Cola 2,50 €, Pfand 0,15) | 1 Item, `quantity=1`, `totalAmount=2.5`, `totalItems=1`, `totalDepositAmount=0.15` |
| RED-02 | 1× Cola | `ADD_ITEM` gleiche `stockItemId-variantId` | `quantity=2`, `totalAmount=5.0` |
| RED-03 | 1× Cola | `ADD_ITEM` andere Variante | 2 Items |
| RED-04 | 2× Cola | `INCREASE_QUANTITY` | `quantity=3` |
| RED-05 | 2× Cola | `DECREASE_QUANTITY` | `quantity=1` |
| RED-06 | 1× Cola | `DECREASE_QUANTITY` | Item entfernt (Menge 0 → weg) |
| RED-07 | 2× Cola | `UPDATE_QUANTITY {quantity:0}` | Item bleibt mit `quantity:0`, zählt **nicht** in `totalAmount`/`totalItems` |
| RED-08 | 2× Cola | `UPDATE_QUANTITY {quantity:-1}` | Item entfernt |
| RED-09 | Items mit `quantity:0` und `quantity:2` | `CLEANUP_ZERO_QUANTITY` | nur das `quantity:2`-Item bleibt |
| RED-10 | beliebig | `CLEAR_CART` | alles 0, `depositReturn=undefined` |
| RED-11 | Cart mit Betrag | `SET_DEPOSIT_RETURN {pricePerItem:2, quantity:3}` | `depositReturn.totalReturn=6` |
| RED-12 | `depositReturn` gesetzt | `SET_DEPOSIT_RETURN {pricePerItem:0, quantity:0}` | `depositReturn=undefined` |
| RED-13 | `depositReturn` = {2,3,6} | dieselbe Action nochmal | identische State-Referenz (kein Re-Render) |
| RED-14 | – | `LOAD_FROM_STORAGE {payload}` | State == payload |
| RED-15 | Reducer-Aufruf, `localStorage.setItem` wirft | beliebige Action | State-Update geht trotzdem durch (nach F-14) |
| RED-16 | Preisberechnung | `price*quantity` mit `0.1 + 0.2`-Fällen | Rundung auf 2 Nachkommastellen definiert (Cent-Arithmetik) |

### 5.2 `PersistentCartProvider` / `usePersistentCart` (mit Renderer)

| ID | Aktion | Erwartet |
|---|---|---|
| CART-01 | Provider mountet, `localStorage` leer | Initialstate leer, kein Crash |
| CART-02 | `localStorage['huettenzauber_cart']` = valides JSON | State daraus geladen |
| CART-03 | `localStorage` = kaputtes JSON | Fallback auf leeren State, `console.error`, kein Crash |
| CART-04 | `addItem` aufrufen | State + `localStorage` aktualisiert, `cartUpdated`-Event gefeuert |
| CART-05 | zweiter Provider hört `cartUpdated` | übernimmt neuen State (Simulation 7"/10"-Sync) |
| CART-06 | `storage`-Event von „anderem Tab" | State übernommen |
| CART-07 | `usePersistentCart` außerhalb Provider | wirft „must be used within a PersistentCartProvider" |
| CART-08 | `getItemQuantity(id, variantId)` | korrekte Menge bzw. 0 |

### 5.3 `BillContext` (fetch gemockt via msw)

| ID | Aktion | Erwartet |
|---|---|---|
| BC-01 | Mount | `GET /bills/` einmal, `bills` gesetzt |
| BC-02 | `switchReloadWithDeleted()` | lädt `GET /bills/all`, `isShowingDeleted=true` |
| BC-03 | `addBill(payload)` → 201 | `POST /bills/`, danach Reload, Erfolgs-Toast |
| BC-04 | `addBill` → 400 | Fehler-Toast **und** Promise **rejectet** (nach F-3) |
| BC-05 | `deleteBill(id)` → 204 | `DELETE`, Reload, Toast |
| BC-06 | `deleteBill` → Fehler | Fehler-Toast, kein Reload |
| BC-07 | `GET /bills/` → 500 | `reloadBills` wirft, Toast; UI zeigt Fehlerzustand (kein weißer Screen, F-15) |

### 5.4 `ProductContext`

| ID | Aktion | Erwartet |
|---|---|---|
| PC-01 | Mount | `GET /categories/`, `/stock-items/`, `/stock-items/all` je einmal |
| PC-02 | `addCategory` → ok | Reload Kategorien |
| PC-03 | `updateCategory` / `deleteCategory` | passende URL + Methode, Reload |
| PC-04 | `addItem` / `updateItem` / `deleteItem` | `/stock-items` + Methode, Reload |
| PC-05 | `updateItemSorting([...])` | `PUT /item-sorting/` mit `{ordered_item_ids}` |
| PC-06 | `updateCategorySorting([...])` | `PUT /category-sorting/bulk` mit `{ordered_category_ids}` (nach F-2) |
| PC-07 | `addItemVariant` | `POST /item-variants/` (Bindestrich) und Erfolg (nach F-1) – *oder* Funktion entfernt |
| PC-08 | `useProduct` außerhalb Provider | wirft |
| PC-09 | Fehler bei `reloadItems` | Toast, `items` bleibt letzter guter Stand |

### 5.5 `useProductWithDeleted`

| ID | Aktion | Erwartet |
|---|---|---|
| UPD-01 | Hook mountet, `GET /stock-items/all` → 200 | `loading` false, `items` gesetzt, `error=null` |
| UPD-02 | → 500 | `error` gesetzt, `items=[]`, `loading` false |
| UPD-03 | Unmount während laufendem Fetch | kein State-Update nach Unmount (Cleanup-Flag – aktuell fehlt) |

### 5.6 `CartModal`

| ID | Vorbedingung | Aktion | Erwartet |
|---|---|---|---|
| CM-01 | `isOpen=false` | render | nichts im DOM |
| CM-02 | Cart leer, `isOpen` | render | „Warenkorb ist leer" |
| CM-03 | 2 Items | `+`-Button | `updateQuantity(id, n+1)` |
| CM-04 | Item `quantity=1` | `−`-Button | `quantity=0`, Item bleibt sichtbar, `markedForRemoval`-Klasse |
| CM-05 | Item `quantity=0` | Schließen (`X`) | `cleanupZeroQuantity()` läuft, dann `onClose` |
| CM-06 | Mülleimer-Button | Klick | `removeItem(id)` sofort |
| CM-07 | Pfandpreis „2,00", Anzahl 0 → `+` | – | `setDepositReturn(2, 1)`, Anzeige `getTotalDepositReturn()=2,00 €` |
| CM-08 | Pfandanzahl 1 → `−` | – | `setDepositReturn(0, 0)` |
| CM-09 | Pfandpreis-Feld ändern auf „" | – | kein NaN, „Zu zahlen" bleibt Zahl |
| CM-10 | `depositReturnPrice` geändert | – | `localStorage['depositReturnPrice']` aktualisiert |
| CM-11 | „Zu zahlen" | Artikel 10 €, Pfand 1 €, Rückgabe 2 € | 9,00 € |
| CM-12 | „Bestellung abschließen" → `addBill` ok | – | `clearCart()`, `onClose()`, `onCheckoutComplete()`; Doppelklick währenddessen wirkungslos (`isProcessing`) |
| CM-13 | `addBill` **schlägt fehl** | – | Warenkorb bleibt erhalten, `alert`/Toast, Modal offen (nach F-3) |
| CM-14 | Checkout | `billItems` enthält nur Positionen mit `quantity>0` |

### 5.7 `CheckoutModal` (falls behalten – sonst Löschtest)

| ID | Aktion | Erwartet |
|---|---|---|
| CO-01 | `isOpen=false` | `null` |
| CO-02 | Bestellübersicht | jede Cart-Position mit `menge x` und `preis*menge` |
| CO-03 | Pfand > 0 | Pfandzeile sichtbar, im Gesamtbetrag enthalten |
| CO-04 | „Pfandrückgabe" an, Betrag 3 € | „Zu zahlen" = Gesamt − 3 € |
| CO-05 | Bestätigen, `addBill` ok | `onConfirm`, `onClose`, `clearCart`; Pfand-Reset **auf 0/undefined**, nicht hart auf 2 (nach F-7) |
| CO-06 | Bestätigen, `addBill` Fehler | Warenkorb bleibt, Fehlermeldung |

### 5.8 `billing.page` (Kundendisplay 7")

| ID | Vorbedingung | Erwartet |
|---|---|---|
| BP-01 | Cart leer | „Willkommen!" + Hinweistext |
| BP-02 | 2 Positionen | Liste mit `getItemName`, `menge x`, `preis*menge` |
| BP-03 | `getItemName` – Artikel mit 1 Variante | nur Artikelname |
| BP-04 | Artikel mit mehreren Varianten, aussagekräftiger Name | „Artikel - Variante" |
| BP-05 | Variante heißt echt „1.0" bei mehreren Varianten | Name wird trotzdem angezeigt (nach F-11) |
| BP-06 | unbekannte `stockItemId` | „Unbekanntes Item" |
| BP-07 | Pfand > 0 | Pfandzeile |
| BP-08 | `depositReturn.totalReturn > 0` | grüne „Pfandrückgabe (n Stück)"-Zeile, im Gesamt abgezogen |
| BP-09 | Gesamtsumme | `totalAmount + totalDepositAmount − depositReturn.totalReturn` |
| BP-10 | neue Position kommt rein | Auto-Scroll ans Listenende (mock `scrollTo`) |

### 5.9 `order.page` – `VariantItem` (Touch-Bedienung 10")

| ID | Aktion | Erwartet |
|---|---|---|
| VI-01 | kurzer Tap | `onAdd()` einmal |
| VI-02 | 500 ms halten, `currentQuantity>0` | `onRemove()` einmal, danach Tap-Release löst **kein** zusätzliches `onAdd` aus |
| VI-03 | 500 ms halten, `currentQuantity=0` | nichts passiert |
| VI-04 | `pointerdown` dann `pointercancel` (Scroll) | Timer gelöscht, kein `onRemove` (nach F-12) |
| VI-05 | `pointerleave` vor Ablauf | Timer gelöscht |
| VI-06 | `currentQuantity>0` | Badge zeigt Menge, Hint „Tippen: +1 \| Lang: -1" |
| VI-07 | Rechtsklick / `contextmenu` | unterdrückt |
| VI-08 | Komponente unmountet mit laufendem Timer | kein Callback nach Unmount |

### 5.10 `order.page` – `OrderContent`

| ID | Vorbedingung | Erwartet |
|---|---|---|
| OC-01 | Kategorien geladen, keine Prop-Kategorie | erste Kategorie automatisch gewählt |
| OC-02 | Kategorie ohne Artikel | Empty-State „Keine Artikel gefunden" |
| OC-03 | Artikel vorhanden | Grid mit Karten je Artikel, Varianten je Karte |
| OC-04 | Item im Cart | Cart-Button unten rechts mit `totalItems` und `totalAmount+totalDepositAmount` |
| OC-05 | Cart leer | kein Cart-Button |
| OC-06 | genau **eine** `<CartModal>`-Instanz im DOM (nach F-5) |
| OC-07 | „Add to Cart" | `cart.addItem` mit `depositAmount = item.deposit_amount` |

### 5.11 `service.page` – Navigation

| ID | Aktion | Erwartet |
|---|---|---|
| SP-01 | Mount | Default-Sektion „einstellungen", `Settings` sichtbar |
| SP-02 | Klick „Rechnungen" | `BillsManagement` sichtbar |
| SP-03 | Klick „Statistik" | `BillsStatistics` sichtbar |
| SP-04 | Klick Kategorie | `OrderPage` mit `selectedCategoryId` |
| SP-05 | Touch-Gerät | Sidebar startet collapsed, Toggle-Button verborgen |
| SP-06 | Theme-Toggle | `ThemeContext.switchTheme`, `data-theme` am `body`, `localStorage['theme']` |
| SP-07 | Kategorie-Icon-String unbekannt | Fallback `MdCategory` |
| SP-08 | genau **ein** `ProductProvider` in der Baum-Hierarchie (nach F-6) |

### 5.12 `landing.page`

| ID | Erwartet |
|---|---|
| LP-01 | zwei Links: `/service` und `/billing` mit Titel/Beschreibung |
| LP-02 | Icons gerendert, Karten klickbar (react-router `Link`) |

### 5.13 `BillsStatistics`

| ID | Vorbedingung | Erwartet |
|---|---|---|
| BS-01 | Bills + `itemsWithDeleted` | `consumptionData` aggregiert Menge & Umsatz je Artikel, absteigend nach Menge |
| BS-02 | Bill-Position mit `item_price` (nach B-11) | Umsatz = `item_price * quantity` |
| BS-03 | Bill-Position ohne `item_price` | Fallback auf aktuellen Variantenpreis; fehlt auch der → 0 |
| BS-04 | gelöschte Bill | wird ausgeschlossen (`!bill.is_deleted`) |
| BS-05 | Variante nicht auffindbar | Position übersprungen, kein Crash |
| BS-06 | Artikel mit >1 Variante | `variantDetails` mit Einzelmengen/-umsätzen |
| BS-07 | Chart-Daten | Top 10 nach Menge, Labels = Artikelnamen |
| BS-08 | PDF/Excel/CSV-Export | erzeugt Datei (jsPDF/XLSX/FileSaver gemockt), Kopfzeile „Rang, Artikel, Variante, Menge, Umsatz" |
| BS-09 | `bill_steps`-Umrechnung im Export | Anzeige-Menge = `quantity * bill_steps` |
| BS-10 | leere Datenlage | „Gesamt: 0 Artikel", kein Crash im Chart |

### 5.14 `BillsManagement` (Testfälle nach Sichtung der Datei ergänzen)

| ID | Erwartet (Rahmen) |
|---|---|
| BM-01 | Liste aller Rechnungen, Umschalter „gelöschte anzeigen" |
| BM-02 | Rechnung löschen → `deleteBill`, verschwindet aus Liste |
| BM-03 | Positionsauflösung über `getItemVariant` (inaktive Varianten inkl.) |
| BM-04 | Summenanzeige je Rechnung |

### 5.15 `Settings.feature`, `CategoryEditModal`, `ItemEditModal`, Karten-Komponenten

| Komponente | Rahmen-Testfälle |
|---|---|
| `Settings.feature` | Kategorie anlegen/bearbeiten/löschen (ruft `ProductContext`); Validierung leerer Name blockt Submit; Icon-Auswahl setzt Wert |
| `CategoryEditModal` | Öffnen mit Werten vorbefüllt; Speichern ruft `updateCategory`; Abbrechen verwirft; leerer Name → Button disabled/Fehlermeldung |
| `ItemEditModal` | Varianten hinzufügen/entfernen in der Liste; negativer Preis blockt Speichern; `bill_steps ≤ 0` blockt; Speichern schickt vollständige Variantenliste an `updateItem` |
| `AddCard` / `CompactAddCard` | Klick → Callback „neu anlegen" |
| `CategoryCard` / `ItemCard` / `CompactItemCard` | zeigt Name/Preis/Icon; Klick-Callback; „inaktiv"-Zustand visuell |
| `CategoryGrid` / `CardGrid` layout | rendert n Karten + genau eine AddCard |
| `BaseModal` | `Esc` schließt; Klick auf Overlay schließt (bzw. bewusst nicht); Fokus-Trap; `children` gerendert |
| `ConfirmModal` | „Bestätigen" → `onConfirm`, „Abbrechen" → `onCancel`; Text/Titel aus Props |
| Drag-Layouts (`DraggableCompactList`, `CategoryDragLayout`) | Drop in neuer Reihenfolge → `updateItemSorting` / `updateCategorySorting` mit korrekter ID-Reihenfolge; Drop an gleicher Stelle → kein Request |

---

## 6. Priorisierte Bugliste (Input für `grill-me` / `junior-to-senior`)

**Zuerst – Datenverlust / falsche Zahlen:**

1. **B-2** – `BillService.create`: verwaiste Bill + 404→400. (Kassenbelege!)
2. **B-11 / F-10** – kein Preis-Snapshot in `BillItem` → Statistiken driften bei Preisänderung.
3. **F-3** – `addBill` schluckt Fehler → Warenkorb wird trotz fehlgeschlagener Rechnung geleert.
4. **B-5** – Anzeige-Fallbackname wird in die DB geschrieben (`autoflush=True` in Prod).
5. **B-1** – `CategoryService.delete` 500 statt 404.

**Danach – kaputte Funktionen:**

6. **B-4 + F-1** – Varianten-CRUD (Router nicht registriert, falscher Pfad).
7. **F-2** – Kategorie-Sortierung wird nie gespeichert.
8. **B-6 / B-7** – `sort_order`-Basis inkonsistent, Kollisionen möglich.
9. **F-5 / F-6** – doppeltes `CartModal`, verschachtelte Provider (Pi-Performance).

**Struktur / Wartbarkeit (vor UI-Rework sinnvoll):**

10. **B-13** – `DATABASE_URL` konsistent, Alembic, Compose/Code angleichen.
11. **B-2-Infra** – `database.py` entkoppeln, `conftest.py`, Tests gegen echte Postgres-Instanz (Docker), kein SQLite.
12. **F-4 / B-16** – toten Code entfernen (`CartContext`, `PersistentCartContextUpdated`, `move_item`).
13. **B-9 / ITM-45** – `bulk_update`-Atomarität entscheiden und dokumentieren.
14. **B-12** – CORS konkretisieren.
15. **B-3 / F-11 / F-12 / F-13 / F-14 / F-15** – Detailhärtung.

**Offene Fachentscheidungen (nicht Code, sondern Festlegung nötig):**

- Leere Kategorie: `200/[]` oder `400`? (B-15, ITM-21)
- `PUT /stock-items/{id}` mit `item_variants: []` – erlaubt oder 400? (ITM-36)
- Versionierung: History-Tabelle vs. In-Place + Snapshot? (B-10)
- Pfandrückgabe eigenständig oder an Bill gekoppelt? (B-17)
- Namensvergleich Kategorie/Artikel case-sensitiv? (CAT-25)

---

## 7. Vorgeschlagene Reihenfolge

1. Backend-Testinfra: `conftest.py`, `database.py` entkoppeln, Test gegen echte Postgres-Instanz (Abschnitt 1).
2. Bestehende Backend-Tests grün bekommen (decken B-1, B-2-Statuscode teilweise auf).
3. Neue Backend-Tests nach Abschnitt 4 schreiben – **erst rot**, dann Bugs B-1…B-17 fixen.
4. Frontend: `cartReducer` extrahieren, Abschnitt 5.1 (reine Logik, schnell, hoher Wert).
5. Frontend-Kontexte mit `msw`, Abschnitte 5.2–5.5.
6. Komponenten-Tests 5.6–5.15 parallel zum UI-Rework (claude.ai/design) – die Testfälle beschreiben Soll-Verhalten unabhängig vom Aussehen.

Jede Code-Änderung aus Abschnitt 6 zusammen mit `/junior-to-senior` + `/grill-me` durchgehen (siehe Projekt-Konvention).
