import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AdminLayout from "./admin/AdminLayout";
import CashDeskAdmin from "./admin/CashDeskAdmin";
import CatalogAdmin from "./admin/CatalogAdmin";
import EventsAdmin from "./admin/EventsAdmin";
import StatsAdmin from "./admin/StatsAdmin";
import { AccessGate } from "./components/AccessGate";
import { ConnectionBanner } from "./components/ConnectionBanner";
import BillsOverview from "./pages/BillsOverview";
import GuestDisplay from "./pages/GuestDisplay";
import OrderTerminal from "./pages/OrderTerminal";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/order" replace />} />
      <Route path="/order" element={<OrderTerminal />} />
      <Route path="/bills" element={<BillsOverview />} />
      <Route path="/guest" element={<GuestDisplay />} />
      <Route path="/verwaltung" element={<AdminLayout />}>
        <Route index element={<Navigate to="veranstaltungen" replace />} />
        <Route path="veranstaltungen" element={<EventsAdmin />} />
        <Route path="katalog" element={<CatalogAdmin />} />
        <Route path="kasse" element={<CashDeskAdmin />} />
        <Route path="statistik" element={<StatsAdmin />} />
      </Route>
      <Route path="*" element={<Navigate to="/order" replace />} />
    </Routes>
  );
}

export default function App() {
  // Das 7"-Kundendisplay bleibt bewusst nackt: kein Schloss (es liest nur) und
  // keine Stoerungsmeldung vor Gaesten.
  const guest = useLocation().pathname.startsWith("/guest");
  if (guest) return <AppRoutes />;

  return (
    <AccessGate>
      <div className="app-shell">
        <ConnectionBanner />
        <div className="app-main">
          <AppRoutes />
        </div>
      </div>
    </AccessGate>
  );
}
