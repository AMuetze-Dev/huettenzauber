import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarBlank,
  ChartBar,
  Coins,
  SquaresFour,
} from "@phosphor-icons/react";
import { Topbar } from "../components/Topbar";
import topbar from "../components/Topbar.module.css";
import s from "./AdminLayout.module.css";

export default function AdminLayout() {
  const navigate = useNavigate();
  return (
    <div className={`${s.screen} no-select`}>
      <Topbar subtitle="Verwaltung">
        <button className={topbar.navBtn} onClick={() => navigate("/order")}>
          <ArrowLeft size={16} />
          Bestellung
        </button>
      </Topbar>
      <div className={s.body}>
        <nav className={s.side}>
          <NavLink
            to="/verwaltung/veranstaltungen"
            className={({ isActive }) => (isActive ? s.active : "")}
          >
            <CalendarBlank size={18} />
            Veranstaltungen
          </NavLink>
          <NavLink
            to="/verwaltung/katalog"
            className={({ isActive }) => (isActive ? s.active : "")}
          >
            <SquaresFour size={18} />
            Katalog
          </NavLink>
          <NavLink
            to="/verwaltung/kasse"
            className={({ isActive }) => (isActive ? s.active : "")}
          >
            <Coins size={18} />
            Tagesabschluss
          </NavLink>
          <NavLink
            to="/verwaltung/statistik"
            className={({ isActive }) => (isActive ? s.active : "")}
          >
            <ChartBar size={18} />
            Statistik
          </NavLink>
        </nav>
        <div className={s.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
