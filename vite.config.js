import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite Configuration — AutoVet
 *
 * Two modes:
 *
 *  1. Development (npm run dev):
 *     - Vite dev server on port 5173
 *     - /api/* proxied to Laravel on localhost:8000
 *     - HMR and fast refresh active
 *
 *  2. Production / Offline Clinic Deployment (npm run build):
 *     - Static bundle output to dist/
 *     - Serve dist/ via any local web server (e.g., `npx serve dist`)
 *     - Or configure Laravel to serve the dist/ assets directly
 *     - No Vite dev server or Node.js runtime needed at runtime
 */
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      // All /api requests forwarded to the local Laravel backend
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      // Storage assets (pet photos, etc.) also served from Laravel
      "/storage": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },

  build: {
    // Output directory for production build
    outDir: "dist",

    // Generate a manifest for cache-busting in production
    manifest: true,

    // Keep chunk sizes reasonable for clinic machines (no CDN needed)
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        // Chunk vendor libraries separately for better caching
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          icons:  ["react-icons"],
          forms:  ["react-hook-form", "zod", "@hookform/resolvers"],
          pdf:    ["jspdf", "jspdf-autotable"],
        },
      },
    },
  },

  preview: {
    // Port for `npm run preview` (serves the built dist/ locally)
    port: 4173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/storage": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
