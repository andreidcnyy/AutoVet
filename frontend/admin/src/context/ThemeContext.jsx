import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
    const [isDark, setIsDark] = useState(() => {
        // 1. Check persisted preference
        const stored = localStorage.getItem("autovet-theme");
        if (stored) return stored === "dark";
        // 2. Fall back to OS preference
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    });

    // Apply / remove the 'dark' class on <html> whenever isDark changes
    useEffect(() => {
        document.documentElement.classList.toggle("dark", isDark);
        localStorage.setItem("autovet-theme", isDark ? "dark" : "light");
    }, [isDark]);

    function toggleTheme() {
        setIsDark((prev) => !prev);
    }

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
    return ctx;
}
