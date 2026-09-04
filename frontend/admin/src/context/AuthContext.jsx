import { createContext, useContext, useState, useEffect } from "react";
import { destroyEcho } from "../utils/echo";
import { setAuthToken } from "../api"; // Import the new function

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

  // Sync token on mount just in case
  useEffect(() => {
    if (user?.token) {
      setAuthToken(user.token);
    }
  }, []);

  // When login happens, update state, localStorage, AND the API client
  const login = (data) => {
    if (data && data.token) {
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
   * A 401 from any single request used to end the session immediately. With
   * background polling on several screens that meant an unrelated hiccup could
   * sign an admin out mid-work with no warning, which is what looked like an
   * automatic timeout — there has never been an inactivity timer.
   *
   * The session is now only ended when the token itself is actually rejected,
   * checked once against /api/user. Anything else — a flaky endpoint, a route
   * this role cannot reach, the backend still waking up — leaves the user
   * signed in.
   */
  useEffect(() => {
    let verifying = false;

    const handleAuthFailure = async () => {
      if (verifying) return;

      let token = null;
      try {
        token = JSON.parse(localStorage.getItem("user") || "null")?.token ?? null;
      } catch (_) {}

      // Nothing left to verify with — the session really is gone.
      if (!token) {
        logout();
        return;
      }

      verifying = true;
      try {
        // Deliberately raw fetch: going through the API client would dispatch
        // auth-failure again and recurse.
        const res = await fetch("/api/user", {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) logout();
      } catch (_) {
        // A network error proves nothing about the token. Stay signed in.
      } finally {
        verifying = false;
      }
    };

    window.addEventListener('auth-failure', handleAuthFailure);
    return () => {
      window.removeEventListener('auth-failure', handleAuthFailure);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
