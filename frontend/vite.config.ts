import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The public demo site is served from https://ilmeedesilva.github.io/MESA/, so its build sets
  // MESA_BASE_PATH=/MESA/. Everything else is served from the root.
  base: process.env.MESA_BASE_PATH || "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"]
  },
  server: {
    port: 5173,
    fs: {
      allow: [".."]
    },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
});
