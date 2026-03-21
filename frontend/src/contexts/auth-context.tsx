"use client";
import React from "react";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { apiClient, initializeApiClient } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import type { UserProfile, AuthTokens } from "@/types";

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleAuthFailure = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    queryClient.clear();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<string> => {
    const stored = sessionStorage.getItem("refresh_token") || localStorage.getItem("refresh_token");
    if (!stored) throw new Error("No refresh token");
    const tokens = await apiClient.post<AuthTokens>("/auth/refresh", { refresh_token: stored });
    sessionStorage.setItem("refresh_token", tokens.refresh_token);
    return tokens.access_token;
  }, []);

  // Initialize API client with token store
  useEffect(() => {
    initializeApiClient({
      accessToken,
      setAccessToken,
      refreshToken,
      onAuthFailure: handleAuthFailure,
    });
  }, [accessToken, refreshToken, handleAuthFailure]);

  // Restore session on mount
  useEffect(() => {
    const storedRefreshToken =
      sessionStorage.getItem("refresh_token") || localStorage.getItem("refresh_token");
    if (!storedRefreshToken) {
      setIsLoading(false);
      return;
    }
    refreshToken()
      .then(async (newAccessToken) => {
        setAccessToken(newAccessToken);
        const profile = await apiClient.get<UserProfile>("/auth/me");
        setUser(profile);
      })
      .catch(() => {
        sessionStorage.removeItem("refresh_token");
        localStorage.removeItem("refresh_token");
      })
      .finally(() => setIsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(
    async (email: string, password: string, remember = false) => {
      const tokens = await apiClient.post<AuthTokens>("/auth/login", {
        email,
        password,
      });
      setAccessToken(tokens.access_token);
      if (remember) {
        localStorage.setItem("refresh_token", tokens.refresh_token);
      } else {
        sessionStorage.setItem("refresh_token", tokens.refresh_token);
      }
      const profile = await apiClient.get<UserProfile>("/auth/me");
      setUser(profile);
    },
    [],
  );

  const logout = useCallback(async () => {
    const storedRefreshToken =
      sessionStorage.getItem("refresh_token") || localStorage.getItem("refresh_token");
    try {
      if (storedRefreshToken) {
        await apiClient.post("/auth/logout", { refresh_token: storedRefreshToken });
      }
    } catch {
      // Ignore logout errors
    } finally {
      setAccessToken(null);
      setUser(null);
      sessionStorage.removeItem("refresh_token");
      localStorage.removeItem("refresh_token");
      queryClient.clear();
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
