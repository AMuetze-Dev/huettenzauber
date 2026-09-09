/// <reference types="node" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Dev: /api wird an das Backend weitergereicht (Container: VITE_API_TARGET=http://backend:8000).
const apiTarget = process.env.VITE_API_TARGET || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    // Zweites Geraet im selben Netz (Handy als zusaetzlicher Eingabepunkt):
    // Vite weist fremde Host-Namen sonst mit 403 ab. Nur der Dev-Server im
    // lokalen Netz - die Produktion laeuft ueber nginx im Frontend-Container.
    allowedHosts: true,
    // Bind-Mount auf Docker Desktop (Windows): Datei-Events kommen nicht durch -> pollen.
    watch: { usePolling: true, interval: 300 },
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
