'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
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
  login: (email: string, password: string, rememberMe?: boolean, turnstileToken?: string) => Promise<{ token: string; user: User }>;
  register: (name: string, email: string, password: string, role?: string) => Promise<{ message: string; email: string; requireVerification?: boolean; token?: string; user?: User }>;
  verifyEmail: (email: string, code: string) => Promise<{ token: string; user: User }>;
  resendCode: (email: string) => Promise<{ message: string }>;
  googleLogin: (credential: string) => Promise<{ token: string; user: User }>;
  logout: () => void;
  updateUser: (updatedUser: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// BroadcastChannel for cross-tab auth state synchronization without localStorage
const AUTH_CHANNEL_NAME = 'smart_lesson_auth_sync';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/profile');
      if (data?.user) {
        setUser(data.user);
        return data.user;
      } else {
        setUser(null);
        if (typeof document !== 'undefined') {
          document.cookie = 'logged_in=; Max-Age=0; path=/;';
        }
        return null;
      }
    } catch {
      setUser(null);
      if (typeof document !== 'undefined') {
        document.cookie = 'logged_in=; Max-Age=0; path=/;';
      }
      return null;
    }
  }, []);

  useEffect(() => {
    // Purge any legacy token/user remnants from localStorage for privacy & security
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch {
      // Ignore in restricted environments
    }

    const initAuth = async () => {
      await fetchProfile();
      setLoading(false);
    };

    initAuth();

    // Listen for global 401 Unauthorized event
    const handleUnauthorized = () => {
      setUser(null);
    };

    // Cross-tab synchronization via BroadcastChannel
    let authChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        authChannel = new BroadcastChannel(AUTH_CHANNEL_NAME);
        authChannel.onmessage = (event) => {
          if (event.data?.type === 'LOGOUT') {
            setUser(null);
          } else if (event.data?.type === 'LOGIN') {
            fetchProfile();
          }
        };
      } catch {
        // Fallback gracefully if BroadcastChannel fails
      }
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      if (authChannel) {
        authChannel.close();
      }
    };
  }, [fetchProfile]);

  const notifyTabs = useCallback((type: 'LOGIN' | 'LOGOUT') => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
        channel.postMessage({ type });
        channel.close();
      } catch {
        // Ignore
      }
    }
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe?: boolean, turnstileToken?: string) => {
    const { data } = await api.post('/auth/login', { email, password, rememberMe, turnstileToken });
    // Cookie is set securely by server via Set-Cookie header (httpOnly, Secure, SameSite)
    setUser(data.user);
    notifyTabs('LOGIN');
    return data;
  }, [notifyTabs]);

  const register = useCallback(async (name: string, email: string, password: string, role?: string) => {
    const { data } = await api.post('/auth/register', { name, email, password, role });
    if (data.user) {
      setUser(data.user);
      notifyTabs('LOGIN');
    }
    return data;
  }, [notifyTabs]);

  const verifyEmail = useCallback(async (email: string, code: string) => {
    const { data } = await api.post('/auth/verify-email', { email, code });
    if (data.user) {
      setUser(data.user);
      notifyTabs('LOGIN');
    }
    return data;
  }, [notifyTabs]);

  const resendCode = useCallback(async (email: string) => {
    const { data } = await api.post('/auth/resend-code', { email });
    return data;
  }, []);

  const googleLogin = useCallback(async (credential: string) => {
    const { data } = await api.post('/auth/google', { credential });
    setUser(data.user);
    notifyTabs('LOGIN');
    return data;
  }, [notifyTabs]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors during logout
    } finally {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (typeof document !== 'undefined') {
          document.cookie = 'logged_in=; Max-Age=0; path=/;';
        }
      } catch {
        // Ignore
      }
      setUser(null);
      notifyTabs('LOGOUT');
    }
  }, [notifyTabs]);

  const updateUser = useCallback((updatedFields: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      return { ...prev, ...updatedFields };
    });
  }, []);

  const contextValue = useMemo(
    () => ({ user, loading, login, register, verifyEmail, resendCode, googleLogin, logout, updateUser }),
    [user, loading, login, register, verifyEmail, resendCode, googleLogin, logout, updateUser]
  );

  return (
    <AuthContext.Provider value={contextValue}>
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
