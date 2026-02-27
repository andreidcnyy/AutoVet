/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          500: "#3b82f6",
          600: "#2563eb",
        },
        // Dark palette — zinc is crisper/cleaner than gray
        dark: {
          bg: "#09090b", // zinc-950  — page background
          card: "#18181b", // zinc-900  — cards, panels, sidebar
          surface: "#27272a", // zinc-800  — inputs, inner cards
          border: "#3f3f46", // zinc-700  — borders
          hover: "#3f3f46", // zinc-700  — hover states
        },
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(15 23 42 / 0.08), 0 1px 1px -1px rgb(15 23 42 / 0.08)",
        "dark-soft": "0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4)",
      },
    },
  },
  plugins: [],
}
