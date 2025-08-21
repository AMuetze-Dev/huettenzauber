# Hüttenzauber POS System

Ein modernes Point-of-Sale (POS) System für Restaurants und Gastronomie mit integrierter Pfandfunktion.

## 🚀 Features

- **Artikelverwaltung** mit Kategorien und Varianten
- **Pfandsystem** - automatische Pfandberechnung und -rückgabe
- **Drag & Drop** Sortierung für Kategorien und Artikel
- **Responsive Design** - optimiert für Touch-Bedienung
- **Warenkorb-System** mit persistenter Speicherung
- **Kundendisplay** für transparente Bestellanzeige
- **Rechnungsverwaltung** mit Backend-Integration

## 🏗️ Architektur

### Frontend (React/TypeScript)

- **React 18** mit TypeScript
- **Context API** für State Management
- **CSS Modules** für Component-Styling
- **React Icons** für konsistente Iconographie

### Backend (Python/FastAPI)

- **FastAPI** für REST API
- **SQLAlchemy** für Datenbankzugriff
- **SQLite** als Datenbank
- **Pydantic** für Datenvalidierung

## 📦 Installation

### Voraussetzungen

- Node.js 18+
- Python 3.9+
- Git

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

### Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
uvicorn app:app --reload
```

## 🐳 Docker Setup

### Gesamtes System starten

```bash
docker-compose up -d
```

### Einzelne Services

```bash
# Backend
.\compose-backend.ps1

# Frontend
.\compose-frontend.ps1
```

## 🛠️ Entwicklung

### Projektstruktur

```
huettenzauber/
├── backend/                 # FastAPI Backend
│   ├── controller/         # API Endpoints
│   ├── service/           # Business Logic
│   ├── entity/            # Datenmodelle
│   └── test/              # Unit Tests
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── components/    # UI Komponenten
│   │   ├── context/       # State Management
│   │   ├── pages/         # Seiten
│   │   └── features/      # Feature-Module
└── docker-compose.yml      # Docker Configuration
```

### Wichtige Endpoints

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 💰 Pfandsystem

Das integrierte Pfandsystem ermöglicht:

- Automatische Pfandberechnung bei Bestellungen
- Pfandrückgabe im Checkout-Prozess
- Transparente Aufschlüsselung in allen Anzeigen
- Historische Pfand-Transaktionen

## 🧪 Testing

### Backend Tests

```bash
cd backend
python -m pytest
```

### Frontend Tests

```bash
cd frontend
npm test
```

## 📝 API Dokumentation

Die vollständige API-Dokumentation ist verfügbar unter:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🤝 Contributing

1. Fork das Repository
2. Erstelle einen Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Committe deine Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. Push zum Branch (`git push origin feature/AmazingFeature`)
5. Öffne einen Pull Request

## 📄 License

Dieses Projekt ist unter der MIT License lizenziert - siehe [LICENSE](LICENSE) für Details.

## 📞 Support

Bei Fragen oder Problemen erstellen Sie bitte ein Issue im GitHub Repository.

---

**Hüttenzauber** - Modernes POS für moderne Gastronomie 🍺🏔️
