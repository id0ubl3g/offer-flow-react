import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getSession, onUnauthorized, setSession } from "../api/client";
import type { Session, User } from "../api/types";

type AuthApi = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  reload: () => Promise<void>;
};

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!getSession()) {
      setUser(null);
      return;
    }

    try {
      const data = await api<{ user: User }>("/profile");
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    onUnauthorized(() => setUser(null));
    reload().finally(() => setLoading(false));
  }, [reload]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<Session & { user: User }>("/auth/login", { body: { email, password }, auth: false });

    setSession({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at });
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout, reload }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
