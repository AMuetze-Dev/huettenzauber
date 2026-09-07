import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./admin/AdminLayout";
import CatalogAdmin from "./admin/CatalogAdmin";
import EventsAdmin from "./admin/EventsAdmin";
import StatsAdmin from "./admin/StatsAdmin";
import BillsOverview from "./pages/BillsOverview";
import GuestDisplay from "./pages/GuestDisplay";
import OrderTerminal from "./pages/OrderTerminal";

export default function App() {
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
        <Route path="statistik" element={<StatsAdmin />} />
      </Route>
      <Route path="*" element={<Navigate to="/order" replace />} />
    </Routes>
  );
}
