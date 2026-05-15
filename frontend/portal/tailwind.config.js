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
          50: "#f0fdf4",
          500: "#059669",
          600: "#047857",
        },
        light: {
          bg: "#f0f2f5",
          card: "#ffffff",
          surface: "#f7f8fa",
          border: "#e0e2e7",
          muted: "#6b7280",
        },
        dark: {
          bg: "#121212",
          card: "#1c1c1c",
          surface: "#282828",
          border: "#3f3f3f",
          hover: "#3f3f3f",
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
