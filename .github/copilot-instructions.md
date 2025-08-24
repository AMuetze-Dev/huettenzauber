# Huettenzauber - Development Guidelines

## 🎯 Projekt-Fokus

### Zielgruppe

**Servicekräfte in einem Restaurant**

- Zeitdruck im Arbeitsalltag
- Häufig wechselnde Mitarbeiter (kurze Einarbeitungszeit erforderlich)
- Verwendung von Touch-Devices (Tablets/Touch-Screens)
- Verschiedene Erfahrungslevel mit digitalen Systemen

### Hardware-Environment

- **Deployment:** Raspberry Pi (lokal)
- **Interface:** Touch-Devices (primär)
- **Performance:** Nicht kritisch (lokales Netzwerk)

---

## 🎨 UI/UX-Design Prinzipien

### 1. Touch-First Design

- **Minimum Touch-Target:** 44px × 44px (Apple/Google Standard)
- **Optimum Touch-Target:** 48px × 48px oder größer
- **Abstand zwischen Touch-Targets:** Mindestens 8px
- **Finger-freundliche Bereiche:** Keine wichtigen Elemente in Ecken/Rändern

### 2. Restaurant-spezifische UX

- **Schnelligkeit vor Schönheit:** Maximal 2 Taps für häufige Aktionen
- **Sofortiges visuelles Feedback:** Bei jeder Interaktion
- **Fehlertoleranz:** Einfache Korrektur-Möglichkeiten

### 3. Accessibility & Verständlichkeit

- **Selbsterklärende Icons:** Mit zusätzlichen Text-Labels
- **Konsistente Interaktionsmuster:** Gleiche Gesten für gleiche Aktionen
- **Visuell klare Hierarchie:** Wichtige Elemente hervorheben
- **Kontrast-reiche Darstellung:** Auch bei schlechten Lichtverhältnissen

---

## 🏗️ Code-Architektur Standards

### 1. Komponenten-Struktur

```
components/
├── atomic/           # Kleinste wiederverwendbare Einheiten
│   ├── Button/
│   ├── Input/
│   └── Icon/
├── molecular/        # Kombinationen von Atomen
│   ├── SearchBar/
│   ├── ProductCard/
│   └── CategoryNav/
├── organisms/        # Komplexe UI-Bereiche
│   ├── Sidebar/
│   ├── ProductGrid/
│   └── Cart/
└── templates/        # Layout-Strukturen
    ├── PageLayout/
    └── ModalLayout/
```

### 2. Naming Conventions

- **Komponenten:** PascalCase + beschreibender Suffix
  - `TouchOptimizedButton` statt `Button`
  - `RestaurantCategoryCard` statt `Card`
- **Hooks:** `use` + Beschreibung
  - `useRestaurantCart` statt `useCart`
- **Konstanten:** SCREAMING_SNAKE_CASE mit Kontext
  - `TOUCH_TARGET_MINIMUM_SIZE` statt `MIN_SIZE`

### 3. Design Patterns

- **Container/Presentational Pattern:** Logik von UI trennen
- **Compound Components:** Flexible, wiederverwendbare Komponenten
- **Custom Hooks:** Business Logic kapseln
- **Context + Reducer:** Für komplexe State-Verwaltung

---

## 📁 Datei-Organisation

### 1. Konstanten-Management

```typescript
// constants/
├── ui.constants.ts        # Touch-Targets, Spacing, etc.
├── restaurant.constants.ts # Kategorien, Prioritäten
├── api.constants.ts       # Endpoints, URLs
└── theme.constants.ts     # Colors, Typography
```

### 2. Typen-Definitionen

```typescript
// types/
├── restaurant.types.ts    # Cart, Product, Category
├── ui.types.ts           # Component Props, Events
└── api.types.ts          # API Responses, Requests
```

---

## 🚫 Anti-Patterns (Was vermieden werden sollte)

### Code

- ❌ Inline Styles (außer für dynamische Werte)
- ❌ Große monolithische Komponenten (> 200 Zeilen)
- ❌ Unspezifische Namen (`data`, `item`, `thing`)
- ❌ Props Drilling (Context verwenden)

### UX

- ❌ Kleine Touch-Targets (< 44px)
- ❌ Mehr als 2 Taps für häufige Aktionen
- ❌ Versteckte Navigation
- ❌ Langsame Animationen (> 300ms)

---

## ✅ Definierte Standards (Geklärt)

### 1. Touch-Target Spezifikationen
- **Standard Touch-Target:** Einheitlich 48px für alle interaktiven Elemente
- **Abstände zwischen Touch-Targets:** 5 verschiedene Spacing-Level (xs, sm, md, lg, xl)
- **Maximale Touch-Target-Größe:** Keine Begrenzung - Platz optimal ausnutzen ohne UX zu verletzen

### 2. Corporate Design System
- **3-Farb-Schema:** 
  - **Hintergrund:** Weiß (Light) / Dunkelgrau (Dark)
  - **Text:** Schwarz (Light) / Hellgrau (Dark)  
  - **Akzent:** Gelb-Orange (beide Modi)
- **Farbvariationen:** Alle weiteren Farben als Abstufungen der 3 Grundfarben
- **Theme-Modi:** Nur Light/Dark Mode

### 3. Visuelles Feedback
- **Touch-Interaktion:** 5% Skalierung bei Touch
- **Animations-Geschwindigkeit:** 200ms Standard für alle Transitions
- **Haptic Feedback:** Nicht implementiert

### 4. Kategorie-Management
- **Reihenfolge:** Servicekräfte erstellen/sortieren selbst in Einstellungen
- **Priorisierung:** Keine zeitbasierte oder automatische Priorisierung
- **Favoriten/Häufig bestellt:** Nicht implementiert

### 5. Scope-Abgrenzung (Nicht implementiert)
- **Netzwerk-Fehlerbehandlung:** Nicht betrachtet (lokales Raspberry Pi Setup)
- **Offline-Funktionalität:** Nicht erforderlich
- **Responsive Design:** Unterstützt, aber nicht primärer Fokus
- **Accessibility:** Nice-to-have, nicht primärer Fokus
- **Keyboard-Navigation:** Nicht erforderlich
- **UI-Anpassungen:** Nicht erforderlich (via globals.css mit clamp abgedeckt)

### 6. Browser-Support
- **Primär:** Chrome und Edge (Raspberry Pi Chrome)
- **Testing:** Manual Testing auf echten Touch-Devices nach Deployment
- **Automatisierte Tests:** Nicht implementiert

---

## 📋 Referenz-Checkliste für Code Reviews

### ✅ UI/UX Checklist

- [ ] Touch-Targets mindestens 44px
- [ ] Visuelles Feedback bei Interaktionen
- [ ] Maximal 2 Taps für Haupt-Aktionen
- [ ] Selbsterklärende Labels/Icons

### ✅ Code Quality Checklist

- [ ] Komponente < 200 Zeilen
- [ ] Beschreibende Namen ohne Kommentare nötig
- [ ] Wiederverwendbare Logik in Custom Hooks
- [ ] Konstanten aus zentralen Files

### ✅ Performance Checklist

- [ ] Keine unnötigen Re-Renders
- [ ] useCallback/useMemo wo sinnvoll
- [ ] Lazy Loading für große Komponenten
- [ ] Optimierte Bundle Size

---

## 📞 Bei Unklarheiten

**Vor Implementierung klären:**

1. Entspricht die Lösung der Touch-First Philosophie?
2. Ist die Komponente ausreichend wiederverwendbar?
3. Ist der Code ohne Kommentare verständlich?
4. Folgt es den Restaurant-UX Prinzipien?

**Bei Zweifeln:** Referenz auf dieses Dokument und explizit nachfragen.
