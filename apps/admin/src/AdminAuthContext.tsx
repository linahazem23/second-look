import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

interface AdminInfo {
  id: string;
  fullName: string;
  role: string;
}

interface AdminAuthState {
  admin: AdminInfo | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminInfo | null>(() => {
    const raw = localStorage.getItem('sl_admin_info');
    return raw ? JSON.parse(raw) : null;
  });

  // If a token exists but we don't have cached admin info (e.g. after a hard refresh
  // in a different tab), treat as logged out and require re-login rather than guessing.
  useEffect(() => {
    if (getToken() && !admin) setToken(null);
  }, [admin]);

  async function login(email: string, password: string) {
    const res = await api.post('/api/admin/auth/login', { email, password });
    setToken(res.token);
    localStorage.setItem('sl_admin_info', JSON.stringify(res.admin));
    setAdmin(res.admin);
  }

  function logout() {
    setToken(null);
    localStorage.removeItem('sl_admin_info');
    setAdmin(null);
  }

  return <AdminAuthContext.Provider value={{ admin, login, logout }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
