import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      "^/app/": {
        target: "ws://127.0.0.1:8080",
        ws: true,
        changeOrigin: true,
      },
      "/api": {
        target: "http://autovet.test",
        changeOrigin: true,
        secure: false,
      },
      "/sanctum": {
        target: "http://autovet.test",
        changeOrigin: true,
        secure: false,
      },
      "/storage": {
        target: "http://autovet.test",
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    outDir: "dist",
    manifest: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
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
    port: 4173,
    proxy: {
      "^/app/": {
        target: "ws://127.0.0.1:8080",
        ws: true,
        changeOrigin: true,
      },
      "/api": {
        target: "http://autovet.test",
        changeOrigin: true,
      },
      "/storage": {
        target: "http://autovet.test",
        changeOrigin: true,
      },
    },
  },
});
