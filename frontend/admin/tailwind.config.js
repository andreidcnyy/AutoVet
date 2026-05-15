/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
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
        autovet: {
          navy: "#002D5A",
          teal: "#00A396",
          "teal-light": "#e6f6f5",
          "navy-light": "#e6eaef",
        },
        light: {
          bg: "#f0f2f5",      // page background — comfortable cool gray (Google/Linear standard)
          card: "#ffffff",     // card surfaces — white with visible depth against bg
          surface: "#f7f8fa",  // inner surfaces, inputs, secondary panels
          border: "#e0e2e7",   // borders — visible but soft
          muted: "#6b7280",    // secondary text
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
      keyframes: {
        "slide-in-right": {
          "0%": { transform: "translateX(100%)", opacity: 0 },
          "100%": { transform: "translateX(0)", opacity: 1 },
        },
        "slide-out-right": {
          "0%": { transform: "translateX(0)", opacity: 1 },
          "100%": { transform: "translateX(100%)", opacity: 0 },
        },
      },
      animation: {
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-out-right": "slide-out-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
}
