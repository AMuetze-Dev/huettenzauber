import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Billing, Landing, Service, Order } from "./pages";
import { ToastContainer } from "react-toastify";
import { PersistentCartProvider } from "./context/PersistentCartContext";

// Theme Context für globalen Zugriff
export const ThemeContext = React.createContext<{
  theme: string;
  switchTheme: () => void;
}>({
  theme: "light",
  switchTheme: () => {},
});

export default function App() {
  const defaultDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [theme, setTheme] = React.useState(
    localStorage.getItem("theme") || (defaultDark ? "dark" : "light")
  );

  const switchTheme = React.useCallback(() => {
    setTheme((prev) => {
      const newTheme = prev === "dark" ? "light" : "dark";
      localStorage.setItem("theme", newTheme);
      return newTheme;
    });
  }, []);

  React.useEffect(() => {
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, switchTheme }}>
      <PersistentCartProvider>
        <BrowserRouter>
          <ToastContainer position="top-right" autoClose={2000} />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/service" element={<Service />} />
            <Route path="/order" element={<Order />} />
            <Route path="/billing" element={<Billing />} />
          </Routes>
        </BrowserRouter>
      </PersistentCartProvider>
    </ThemeContext.Provider>
  );
}
