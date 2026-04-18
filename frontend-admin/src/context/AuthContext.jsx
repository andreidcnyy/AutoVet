import { createContext, useContext, useState, useEffect } from "react";
import { destroyEcho } from "../utils/echo";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const sanitizeUser = (data) => {
    if (!data) return null;
    return {
      ...data,
      name: typeof data.name === 'string' ? data.name : (data.name?.message || data.name?.text || String(data.name || 'User')),
      role: typeof data.role === 'string' ? data.role : (data.role?.message || data.role?.text || String(data.role || 'Guest')),
    };
  };

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.token || (parsed.user && parsed.user.token))) {
          const userData = parsed.token ? parsed : { ...parsed.user, token: parsed.user.token };
          setUser(sanitizeUser(userData));
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
    if (data && (data.error || (data.message && !data.token))) {
      console.error("AuthContext: Attempted to login with error data", data);
      return;
    }
    const sanitized = sanitizeUser(data);
    setUser(sanitized);
    localStorage.setItem("user", JSON.stringify(sanitized));
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
