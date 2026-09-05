import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  area: string;
  verifiedFemale: boolean;
  kycStatus: string;
  status: string;
  blockedUntil: string | null;
  buyOnlyUntil: string | null;
  guidelinesComplete: boolean;
  profileQuizComplete: boolean;
  completedSalesCount: number;
  createdAt: string;
}

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  signup: (data: { email: string; password: string; fullName: string; area: string; age?: number; languagePreference?: string; referralCode?: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await api.get('/api/auth/me');
      setUser(me);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signup: AuthState['signup'] = async (data) => {
    const res = await api.post('/api/auth/signup', data);
    setToken(res.token);
    await refresh();
  };

  const login: AuthState['login'] = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    setToken(res.token);
    await refresh();
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
