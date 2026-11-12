import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * The backend has no CORS configuration and is not changed for the frontend. The dev server therefore proxies
 * same-origin /api requests to the backend, which listens on 127.0.0.1:8000 (backend/app/main.py).
 */
const backendTarget = process.env.SEAN_BACKEND_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
});
