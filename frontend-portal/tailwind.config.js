/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Zacbel X", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eff6ff",
          500: "#3b82f6",
          600: "#2563eb",
        },
        dark: {
          bg: "#09090b",
          card: "#18181b",
          surface: "#27272a",
          border: "#3f3f46",
          hover: "#3f3f46",
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
