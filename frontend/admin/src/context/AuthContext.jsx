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
    setAuthToken(null); // Clear the token from the API client
  };

  // Handle auth failures triggered by the API client
  useEffect(() => {
    const handleAuthFailure = () => {
      logout();
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
