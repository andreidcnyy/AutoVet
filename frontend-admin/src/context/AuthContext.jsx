import { createContext, useContext, useState, useEffect } from "react";
import { destroyEcho } from "../utils/echo";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // This function is fine as it is, it handles data shaping.
  const sanitizeUser = (data) => {
    if (!data) return null;
    return {
      ...data,
      name: typeof data.name === 'string' ? data.name : (data.name?.message || data.name?.text || String(data.name || 'User')),
      role: typeof data.role === 'string' ? data.role : (data.role?.message || data.role?.text || String(data.role || 'Guest')),
    };
  };

  useEffect(() => {
    setLoading(true);
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // The object stored in localStorage IS the user object, which contains the token.
        if (parsed && parsed.token) {
          setUser(sanitizeUser(parsed));
        } else {
          localStorage.removeItem("user");
          setUser(null);
        }
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem("user");
      }
    }
    setLoading(false);
  }, []);

  const login = (data) => {
    // The 'data' from the API is the flat user object containing the token.
    // It's exactly what we need to store.
    if (data && data.token) {
        const sanitized = sanitizeUser(data);
        setUser(sanitized);
        localStorage.setItem("user", JSON.stringify(sanitized));
    } else {
        console.error("AuthContext: Invalid login data received, token missing.", data);
    }
  };

  const logout = () => {
    destroyEcho();
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
