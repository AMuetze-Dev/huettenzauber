import React, { useState, useContext } from "react";
import style from "./service.module.css";
import * as MdIcons from "react-icons/md";
import Settings from "../../features/Settings.feature";
import { ProductProvider, useProduct } from "../../context/ProductContext";
import { ThemeContext } from "../../App";
import OrderPage from "../order/order.page";

// === CONSTANTS ===

// UI Configuration
const UI_CONFIG = {
  ICON_SIZE: 24,
  DEFAULT_SECTION: "einstellungen",
  SIDEBAR_WIDTH: {
    EXPANDED: 220,
    COLLAPSED: 60,
  },
};

// Text Constants
const TEXT_LABELS = {
  NAVIGATION: "Navigation",
  SIDEBAR_EXPAND: "Sidebar erweitern",
  SIDEBAR_MINIMIZE: "Sidebar minimieren",
  LIGHT_MODE_ACTIVATE: "Light Mode aktivieren",
  DARK_MODE_ACTIVATE: "Dark Mode aktivieren",
  LIGHT_MODE: "Light Mode",
  DARK_MODE: "Dark Mode",
  COMING_SOON: "wird bald verfügbar sein",
  ORDER_SYSTEM: "Bestellsystem",
  ORDER_DESCRIPTION: "Artikel bestellen und verwalten",
};

// Theme Icons
const THEME_ICONS = {
  EXPAND: MdIcons.MdChevronRight,
  COLLAPSE: MdIcons.MdChevronLeft,
  LIGHT_MODE: MdIcons.MdLightMode,
  DARK_MODE: MdIcons.MdDarkMode,
};

// Bottom Navigation Items (Management)
const BOTTOM_NAVIGATION_CONFIG = [
  {
    id: "lagerbestand",
    label: "Lagerbestand",
    icon: MdIcons.MdInventory,
    description: "Bestandsverwaltung",
  },
  {
    id: "statistik",
    label: "Statistik",
    icon: MdIcons.MdBarChart,
    description: "Auswertungen und Berichte",
  },
  {
    id: "einstellungen",
    label: "Einstellungen",
    icon: MdIcons.MdSettings,
    description: "Systemeinstellungen",
  },
];

// === TYPES ===
interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  description: string;
}

// === SERVICE CONTENT COMPONENT ===
const ServiceContent: React.FC = () => {
  const productCtx = useProduct();

  // Detect touchscreen and screen size for adaptive sidebar behavior
  const isTouchDevice =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 1024;
  const isLandscapeTouch =
    isTouchDevice && window.innerWidth > window.innerHeight;

  // Adaptive collapsed state: collapsed on touch devices or small screens
  const shouldAutoCollapse = isTouchDevice || isSmallScreen;
  const [collapsed, setCollapsed] = useState(shouldAutoCollapse);

  const [activeSection, setActiveSection] = useState(UI_CONFIG.DEFAULT_SECTION);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  );
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { theme, switchTheme } = useContext(ThemeContext);

  // === HANDLERS ===
  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
    // Reset category when switching to non-category sections
    if (sectionId !== "category") {
      setSelectedCategoryId(null);
    }
  };

  const handleCategorySelect = (categoryId: number) => {
    setSelectedCategoryId(categoryId);
    setActiveSection("category");
  };

  // Toggle sidebar (only available on non-touch devices)
  const handleToggleSidebar = () => {
    if (!isTouchDevice) {
      setCollapsed(!collapsed);
    }
  };

  // Touch-optimized label display handlers
  const handleIconTouch = (itemId: string) => {
    setHoveredItem(itemId);
    // Auto-hide after 3 seconds
    setTimeout(() => setHoveredItem(null), 3000);
  };

  // === COMPUTED VALUES ===
  const showToggleButton = !isTouchDevice; // Only show toggle on desktop
  const showTouchLabels = isTouchDevice && collapsed; // Only show touch labels on touch devices when collapsed

  const toggleIcon = collapsed ? THEME_ICONS.EXPAND : THEME_ICONS.COLLAPSE;
  const toggleLabel = collapsed
    ? TEXT_LABELS.SIDEBAR_EXPAND
    : TEXT_LABELS.SIDEBAR_MINIMIZE;
  const themeIcon =
    theme === "dark" ? THEME_ICONS.LIGHT_MODE : THEME_ICONS.DARK_MODE;
  const themeLabel =
    theme === "dark" ? TEXT_LABELS.LIGHT_MODE : TEXT_LABELS.DARK_MODE;
  const themeTitle =
    theme === "dark"
      ? TEXT_LABELS.LIGHT_MODE_ACTIVATE
      : TEXT_LABELS.DARK_MODE_ACTIVATE;

  // === RENDER HELPERS ===
  const renderCategoryItem = (category: any) => {
    // Get icon component from string
    const getIconComponent = (iconName: string) => {
      const IconComponent = (MdIcons as any)[iconName];
      return IconComponent || MdIcons.MdCategory;
    };

    const IconComponent = getIconComponent(category.icon);
    const isActive =
      activeSection === "category" && selectedCategoryId === category.id;

    // Priority for mobile display (1 = highest priority)
    const getCategoryPriority = (categoryName: string): number => {
      const priorities: { [key: string]: number } = {
        Getränke: 1,
        Hauptgerichte: 2,
        Vorspeisen: 3,
        Desserts: 4,
        Beilagen: 5,
        Snacks: 6,
        Spirituosen: 7,
        Sonstiges: 8,
      };
      return priorities[categoryName] || 9;
    };

    return (
      <li key={category.id} data-priority={getCategoryPriority(category.name)}>
        <button
          type="button"
          className={isActive ? "active" : ""}
          onClick={() => handleCategorySelect(category.id)}
          onTouchStart={
            showTouchLabels
              ? () => handleIconTouch(`category-${category.id}`)
              : undefined
          }
          title={`${category.name} - Artikel anzeigen`}
        >
          <IconComponent size={UI_CONFIG.ICON_SIZE} />

          {/* Desktop: Normal label when expanded */}
          {!collapsed && !isTouchDevice && (
            <span className={style["nav-label"]}>{category.name}</span>
          )}

          {/* Touch: Overlay label when touched */}
          {showTouchLabels && hoveredItem === `category-${category.id}` && (
            <span className={style["touch-label"]}>{category.name}</span>
          )}
        </button>
      </li>
    );
  };

  const renderNavigationItem = (item: NavigationItem, isBottomNav = false) => {
    const isActive = isBottomNav && activeSection === item.id;

    return (
      <li key={item.id}>
        <button
          type="button"
          className={isActive ? "active" : ""}
          onClick={isBottomNav ? () => handleSectionChange(item.id) : undefined}
          onTouchStart={
            showTouchLabels
              ? () => handleIconTouch(`nav-${item.id}`)
              : undefined
          }
          title={item.description}
        >
          <item.icon size={UI_CONFIG.ICON_SIZE} />

          {/* Desktop: Normal label when expanded */}
          {!collapsed && !isTouchDevice && (
            <span className={style["nav-label"]}>{item.label}</span>
          )}

          {/* Touch: Overlay label when touched */}
          {showTouchLabels && hoveredItem === `nav-${item.id}` && (
            <span className={style["touch-label"]}>{item.label}</span>
          )}
        </button>
      </li>
    );
  };

  const renderPlaceholderContent = (title: string) => (
    <div className={style.placeholder}>
      <h2>{title}</h2>
      <p>
        {title} {TEXT_LABELS.COMING_SOON}.
      </p>
    </div>
  );

  if (!productCtx) {
    return (
      <div className={style.layout}>
        <div className={style.loading}>Lade Kategorien...</div>
      </div>
    );
  }

  const { categories } = productCtx;

  // === MAIN RENDER ===
  return (
    <div className={style.layout}>
      <aside className={`${style.navbar} ${collapsed ? style.collapsed : ""}`}>
        {/* Top Section */}
        <div>
          {/* Desktop Toggle Button */}
          {showToggleButton && (
            <button
              type="button"
              onClick={handleToggleSidebar}
              title={toggleLabel}
              className={style["toggle-button"]}
            >
              {React.createElement(toggleIcon, { size: UI_CONFIG.ICON_SIZE })}
              {!collapsed && (
                <span className={style["nav-label"]}>
                  {TEXT_LABELS.NAVIGATION}
                </span>
              )}
            </button>
          )}

          {/* Categories Navigation */}
          <ul className={style["nav-top"]}>
            {categories.map((category) => renderCategoryItem(category))}
          </ul>
        </div>

        {/* Bottom Section */}
        <div>
          {/* Theme Toggle */}
          <div className={style["nav-theme"]}>
            <button
              type="button"
              onClick={switchTheme}
              onTouchStart={
                showTouchLabels
                  ? () => handleIconTouch("theme-toggle")
                  : undefined
              }
              title={themeTitle}
            >
              {React.createElement(themeIcon, { size: UI_CONFIG.ICON_SIZE })}

              {/* Desktop: Normal label when expanded */}
              {!collapsed && !isTouchDevice && (
                <span className={style["nav-label"]}>{themeLabel}</span>
              )}

              {/* Touch: Overlay label when touched */}
              {showTouchLabels && hoveredItem === "theme-toggle" && (
                <span className={style["touch-label"]}>{themeLabel}</span>
              )}
            </button>
          </div>

          {/* Bottom Navigation Items */}
          <ul className={style["nav-bottom"]}>
            {BOTTOM_NAVIGATION_CONFIG.map((item) =>
              renderNavigationItem(item, true)
            )}
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <main className={style.main}>
        <div className={style.content}>
          {activeSection === "category" && (
            <OrderPage
              selectedCategoryId={selectedCategoryId}
              onCategoryChange={handleCategorySelect}
            />
          )}
          {activeSection === "einstellungen" && <Settings />}
          {activeSection === "lagerbestand" &&
            renderPlaceholderContent("Lagerbestand")}
          {activeSection === "statistik" &&
            renderPlaceholderContent("Statistik")}
        </div>
      </main>
    </div>
  );
};

// === MAIN COMPONENT WITH PROVIDER ===
export default function ServicePage() {
  return (
    <ProductProvider>
      <ServiceContent />
    </ProductProvider>
  );
}
