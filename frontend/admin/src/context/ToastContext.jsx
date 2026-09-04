import { createContext, useContext, useState, useCallback, useRef, useMemo } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const idCounter = useRef(0);

    // At most this many toasts on screen at once. Websocket bursts (a run of
    // low-stock events, several appointments landing together) could otherwise
    // stack faster than they expire and cover the screen until dismissed.
    const MAX_VISIBLE = 3;

    const addToast = useCallback((message, type = "info", duration = 4000) => {
        const id = idCounter.current++;

        setToasts((prev) => {
            // Collapse an identical message that is still showing rather than
            // stacking a second copy of it.
            const duplicate = prev.find(
                (t) => !t.isExiting && t.type === type && typeof t.message === "string" && t.message === message
            );
            if (duplicate) return prev;

            const next = [...prev, { id, message, type, isExiting: false }];

            // Drop the oldest beyond the cap immediately; their own timers are
            // harmless once they are gone.
            return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
        });

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

/**
 * Same context, but returns null instead of throwing when no provider is above.
 * For callers that only want to notify if a toaster happens to be mounted.
 */
export function useToastOptional() {
    return useContext(ToastContext);
}
