repo: AMuetze-Dev/huettenzauber
branch: develop
path: frontend

## Last sync

date: 2026-09-07T06:45:00Z

### Updated in this project

- Bestelleingabe für 10"-Display neu gedacht: Kategorie-Rail, Schnellzugriff, Ein-Tipp-Artikel, Dauer-Warenkorb
- Gastanzeige für 7"-Display ohne Scrollen (kurze Positionen + große Summe, Überlauf als „+ n weitere")
- Barzahlung in zwei Taps inkl. Rückgeld-Schnelltasten und Ein-Tap-Pfandrückgabe
- Rechnungsübersicht mit Beleg-Detail und Storno-Bestätigung
- Optik auf Nocturne umgestellt (dunkel, Inter); Schriften/Logo aus dem Repo kopiert

## Screen map

| Screen | Repo-Quellen |
| --- | --- |
| 1a Bestelleingabe 10" | frontend/src/pages/order/order.page.tsx, order.module.css, frontend/src/pages/service/service.page.tsx, service.module.css, frontend/src/context/ProductContext.tsx, frontend/public/globals.css |
| 1a Bar kassieren (Overlay) | frontend/src/components/modals/CheckoutModal.component.tsx |
| 1b Gastanzeige 7" | frontend/src/pages/billing/billing.page.tsx |
| 1c Rechnungsübersicht & Storno | frontend/src/features/BillsManagement.feature.tsx, frontend/src/context/BillContext.tsx |
