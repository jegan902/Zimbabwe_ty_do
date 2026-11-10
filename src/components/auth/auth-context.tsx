"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName: string | null;
  phone?: string | null;
  role: "USER" | "ADMIN" | "SUPERADMIN";
  status: string;
}

export interface WalletInfo {
  walletId: string;
  balance: string;
  reservedBalance: string;
  availableBalance: string;
  totalDeposits: string;
  totalSpent: string;
}

interface AuthContextType {
  user: UserProfile | null;
  wallet: WalletInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  wallet: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setUser(json.data.user);
        setWallet(json.data.wallet);
      } else {
        setUser(null);
        setWallet(null);
      }
    } catch {
      setUser(null);
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setWallet(null);
      window.location.href = "/";
    }
  };

  return (
    <AuthContext.Provider value={{ user, wallet, loading, refresh: fetchMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

