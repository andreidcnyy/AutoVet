import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { destroyEcho } from "../utils/echo";

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

  const sanitizeUser = (data: any) => {
    if (!data) return null;
    return {
      ...data,
      name: typeof data.name === 'string' ? data.name : (data.name?.message || data.name?.text || String(data.name || 'User')),
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

  const login = (data: any) => {
    if (data && (data.error || (data.message && !data.token))) {
      console.error("AuthContext: Attempted to login with error data", data);
      return;
    }
    const sanitized = sanitizeUser(data);
    setUser(sanitized);
    localStorage.setItem("user", JSON.stringify(sanitized));
  };

  const register = (data: any) => {
    if (data && (data.error || (data.message && !data.token))) {
      console.error("AuthContext: Attempted to register with error data", data);
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
