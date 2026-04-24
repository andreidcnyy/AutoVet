import { createContext, useContext, useState, useCallback, useRef, useMemo } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const idCounter = useRef(0);

    const addToast = useCallback((message, type = "info", duration = 4000) => {
        const id = idCounter.current++;
        setToasts((prev) => [...prev, { id, message, type, isExiting: false }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id) => {
        // Trigger exit animation
        setToasts((prev) => prev.map(t => t.id === id ? { ...t, isExiting: true } : t));

        // Remove from DOM after animation completes (300ms matches tailwind duration-300)
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 300);
    }, []);

    // Convenience methods
    const success = useCallback((message, duration) => addToast(message, "success", duration), [addToast]);
    const error = useCallback((message, duration) => addToast(message, "error", duration), [addToast]);
    const warning = useCallback((message, duration) => addToast(message, "warning", duration), [addToast]);
    const info = useCallback((message, duration) => addToast(message, "info", duration), [addToast]);
    const aiForecast = useCallback((data, duration = 6000) => addToast(data, "ai_forecast", duration), [addToast]);

    const value = useMemo(() => ({ toasts, addToast, removeToast, success, error, warning, info, aiForecast }), [toasts, addToast, removeToast, success, error, warning, info, aiForecast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}
