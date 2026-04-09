import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (data: any) => void;
  logout: () => void;
  register: (data: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to load user from localStorage
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Robustness check: Ensure token exists in flattened structure
        if (parsed && (parsed.token || (parsed.user && parsed.user.token))) {
          // If nested, flatten it (similar to admin migration)
          const userData = parsed.token ? parsed : { ...parsed.user, token: parsed.user.token };
          setUser(userData);
          if (!parsed.token) {
            localStorage.setItem("user", JSON.stringify(userData));
          }
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

  const login = (data: any) => {
    setUser(data);
    localStorage.setItem("user", JSON.stringify(data));
  };

  const register = (data: any) => {
    setUser(data);
    localStorage.setItem("user", JSON.stringify(data));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
