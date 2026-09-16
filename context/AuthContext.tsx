'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/services/api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  avatar?: string | null;
  emailVerified?: boolean;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ token: string; user: User }>;
  register: (name: string, email: string, password: string, role?: string) => Promise<{ message: string; email: string; requireVerification?: boolean; token?: string; user?: User }>;
  verifyEmail: (email: string, code: string) => Promise<{ token: string; user: User }>;
  resendCode: (email: string) => Promise<{ message: string }>;
  googleLogin: (credential: string) => Promise<{ token: string; user: User }>;
  logout: () => void;
  updateUser: (updatedUser: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const { data } = await api.get('/auth/profile');
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          document.cookie = 'token=; Max-Age=0; path=/;';
          setUser(null);
        }
      } else {
        document.cookie = 'token=; Max-Age=0; path=/;';
        setUser(null);
      }
      setLoading(false);
    };
    initAuth();

    const handleUnauthorized = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      document.cookie = 'token=; Max-Age=0; path=/;';
      setUser(null);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'token') {
        if (!e.newValue) {
          // Token was removed in another tab (logout)
          setUser(null);
          localStorage.removeItem('user');
          document.cookie = 'token=; Max-Age=0; path=/;';
        } else if (e.newValue !== e.oldValue) {
          // Token was updated / switched user in another tab
          initAuth();
        }
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const login = async (email: string, password: string, rememberMe?: boolean) => {
    const { data } = await api.post('/auth/login', { email, password, rememberMe });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
    document.cookie = `token=${data.token}; path=/; max-age=${maxAge}; SameSite=Lax`;
    setUser(data.user);
    return data;
  };

  const register = async (name: string, email: string, password: string, role?: string) => {
    const { data } = await api.post('/auth/register', { name, email, password, role });
    if (data.token && data.user) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      document.cookie = `token=${data.token}; path=/; max-age=604800; SameSite=Lax`;
      setUser(data.user);
    }
    return data;
  };

  const verifyEmail = async (email: string, code: string) => {
    const { data } = await api.post('/auth/verify-email', { email, code });
    if (data.token && data.user) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      document.cookie = `token=${data.token}; path=/; max-age=604800; SameSite=Lax`;
      setUser(data.user);
    }
    return data;
  };

  const resendCode = async (email: string) => {
    const { data } = await api.post('/auth/resend-code', { email });
    return data;
  };

  const googleLogin = async (credential: string) => {
    const { data } = await api.post('/auth/google', { credential });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    document.cookie = `token=${data.token}; path=/; max-age=604800; SameSite=Lax`;
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors during logout
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      document.cookie = 'token=; Max-Age=0; path=/;';
      setUser(null);
    }
  };

  const updateUser = (updatedFields: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updatedFields };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyEmail, resendCode, googleLogin, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
