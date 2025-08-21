import { Link } from "react-router-dom";
import style from "./landing.module.css";
import * as MdIcons from "react-icons/md";

export default function LandingPage() {
  const navigationItems = [
    {
      to: "service",
      title: "Service-Bereich",
      description: "Artikel und Kategorien verwalten",
      icon: MdIcons.MdSettings,
      color: "primary",
    },
    {
      to: "billing",
      title: "Live-Rechnung",
      description: "Kassensystem und Abrechnung",
      icon: MdIcons.MdPointOfSale,
      color: "secondary",
    },
  ];

  return (
    <main className={style.mainLanding}>
      <header className={style.header}>
        <div className={style.headerContent}>
          <h1 className={style.title}>Hüttenzauber</h1>
          <p className={style.subtitle}>
            Premium Kassensystem für Ihr Unternehmen
          </p>
        </div>
      </header>

      <section className={style.navigationGrid}>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`${style.navigationCard} ${style[item.color]}`}
            >
              <div className={style.cardIcon}>
                <Icon size={48} />
              </div>
              <div className={style.cardContent}>
                <h2 className={style.cardTitle}>{item.title}</h2>
                <p className={style.cardDescription}>{item.description}</p>
              </div>
              <div className={style.cardArrow}>
                <MdIcons.MdArrowForward size={24} />
              </div>
            </Link>
          );
        })}
      </section>

      <footer className={style.footer}>
        <p className={style.footerText}>
          Optimiert für 10-Zoll Tablets • Premium Design
        </p>
      </footer>
    </main>
  );
}
