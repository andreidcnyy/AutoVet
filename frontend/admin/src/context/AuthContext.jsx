import { createContext, useContext, useState, useEffect } from "react";
import { destroyEcho } from "../utils/echo";
import { setAuthToken } from "../api"; // Import the new function
import { useToastOptional } from "./ToastContext";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.token) {
          setAuthToken(parsed.token);
          return parsed;
        }
      }
    } catch (e) {
      console.error("AuthContext: Error parsing user", e);
    }
    return null;
  });

  const [loading, setLoading] = useState(false); // No longer needs to wait for useEffect
  // Set when the server has rejected the token. Surfaces a notice; never signs out.
  const [sessionExpired, setSessionExpired] = useState(false);
  const toast = useToastOptional();

  // Sync token on mount just in case
  useEffect(() => {
    if (user?.token) {
      setAuthToken(user.token);
    }
  }, []);

  // When login happens, update state, localStorage, AND the API client
  const login = (data) => {
    if (data && data.token) {
      setSessionExpired(false);
      setUser(data);
      localStorage.setItem("user", JSON.stringify(data));
      setAuthToken(data.token); // Directly set the token
    } else {
      console.error("AuthContext: Invalid login data received, token missing.", data);
    }
  };

  // On logout, clear everything
  const logout = () => {
    destroyEcho();
    setUser(null);
    localStorage.removeItem("user");
    setAuthToken(null);
    window.location.replace("/login");
  };

  /**
   * Handle auth failures reported by the API client.
   *
   * Nothing here signs the user out. A 401 used to end the session outright,
   * then only after verifying the token — but either way the app could decide
   * on its own to throw someone back to the login screen mid-work, which is
   * what the "automatic logout" was. There has never been an inactivity timer;
   * a rejected request was the whole cause.
   *
   * A rejected token is now reported and nothing else: the token stays, the
   * page stays, and signing out is left to the user. The cost of that choice
   * is that a genuinely dead session keeps failing quietly until they sign in
   * again, which is why the notice below does not auto-dismiss.
   */
  useEffect(() => {
    let verifying = false;

    const handleAuthFailure = async () => {
      if (verifying || sessionExpired) return;

      let token = null;
      try {
        token = JSON.parse(localStorage.getItem("user") || "null")?.token ?? null;
      } catch (_) {}

      if (!token) return;

      verifying = true;
      try {
        // Deliberately raw fetch: going through the API client would dispatch
        // auth-failure again and recurse.
        const res = await fetch("/api/user", {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          setSessionExpired(true);
          // duration 0 keeps it on screen until dismissed — the user decides
          // when to sign out, this only tells them why things are failing.
          toast?.error(
            "Your session is no longer valid. Please sign out and sign in again to continue.",
            0
          );
        }
      } catch (_) {
        // A network error proves nothing about the token.
      } finally {
        verifying = false;
      }
    };

    window.addEventListener('auth-failure', handleAuthFailure);
    return () => {
      window.removeEventListener('auth-failure', handleAuthFailure);
    };
  }, [toast, sessionExpired]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, sessionExpired }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
