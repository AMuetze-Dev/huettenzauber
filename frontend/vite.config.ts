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
