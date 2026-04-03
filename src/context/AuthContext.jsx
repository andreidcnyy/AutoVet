import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to load user from localStorage
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Robustness check: Ensure token exists in flattened structure
        if (parsed && parsed.token) {
          setUser(parsed);
        } else if (parsed && parsed.user && parsed.user.token) {
          // Migration: Flatten nested structure if found
          const migrated = { ...parsed.user, token: parsed.user.token };
          setUser(migrated);
          localStorage.setItem("user", JSON.stringify(migrated));
        } else {
          // Invalid session: missing token
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
    // Ensure all data (including must_change_password) is preserved
    const userWithToken = { ...data }; 
    setUser(userWithToken);
    localStorage.setItem("user", JSON.stringify(userWithToken));
  };

  const logout = () => {
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
