import { createContext, useContext, useState, useEffect } from "react";
import { destroyEcho } from "../utils/echo";
import { setAuthToken } from "../api"; // Import the new function

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On initial load, read from localStorage to handle page refreshes
  useEffect(() => {
    setLoading(true);
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.token) {
          // Set the user state AND directly inject the token into the API client
          setUser(parsed);
          setAuthToken(parsed.token);
        } else {
          localStorage.removeItem("user");
          setAuthToken(null);
        }
      }
    } catch (e) {
      console.error("Failed to parse stored user", e);
      localStorage.removeItem("user");
      setAuthToken(null);
    }
    setLoading(false);
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
