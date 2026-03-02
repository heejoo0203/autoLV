"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { AuthMode, AuthUser } from "@/app/lib/types";

const DEFAULT_API_BASE = "http://127.0.0.1:8000";
let preferredApiBase: string | null = null;

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  authLoading: boolean;
  authOpen: boolean;
  authMode: AuthMode;
  authMessage: string;
  openAuth: (mode: AuthMode) => void;
  closeAuth: () => void;
  setAuthMode: (mode: AuthMode) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    full_name: string;
    email: string;
    password: string;
    confirm_password: string;
    agreements: boolean;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: { full_name?: string; profile_image?: File | null }) => Promise<void>;
  changePassword: (payload: {
    current_password: string;
    new_password: string;
    confirm_new_password: string;
  }) => Promise<void>;
  deleteAccount: (confirmationText: string) => Promise<void>;
  expectedWithdrawalText: string;
  setAuthMessage: (message: string) => void;
  refreshMe: () => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authMessage, setAuthMessage] = useState("로그인 후 파일 조회 기능을 사용할 수 있습니다.");

  async function refreshMe(): Promise<AuthUser | null> {
    try {
      const res = await authFetch("/api/v1/auth/me", { method: "GET" });
      if (!res.ok) {
        setUser(null);
        return null;
      } else {
        const data = (await res.json()) as AuthUser;
        const normalized = normalizeUser(data);
        setUser(normalized);
        return normalized;
      }
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshMe();
  }, []);

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const closeAuth = () => setAuthOpen(false);

  const login = async (email: string, password: string) => {
    if (!email || !password) throw new Error("이메일과 비밀번호를 입력해 주세요.");
    setAuthLoading(true);
    try {
      const res = await authFetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await safeJson(res)) as AuthUser | { detail?: unknown };
      if (!res.ok) throw new Error(extractError(payload, "로그인에 실패했습니다."));
      await refreshMe();
      setAuthMessage("로그인되었습니다.");
      setAuthOpen(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const register = async (payload: {
    full_name: string;
    email: string;
    password: string;
    confirm_password: string;
    agreements: boolean;
  }) => {
    setAuthLoading(true);
    try {
      const res = await authFetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await safeJson(res)) as { detail?: unknown };
      if (!res.ok) throw new Error(extractError(body, "회원가입에 실패했습니다."));
      setAuthMessage("회원가입이 완료되었습니다. 로그인해 주세요.");
      setAuthMode("login");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    setAuthLoading(true);
    // Optimistically update UI first so logout feels instant.
    setUser(null);
    setAuthMode("login");
    setAuthOpen(false);
    setAuthMessage("로그아웃 처리 중입니다...");

    let remoteSuccess = false;
    try {
      for (const base of resolveApiBases()) {
        try {
          const res = await fetch(`${base}/api/v1/auth/logout`, {
            method: "POST",
            credentials: "include",
          });
          if (res.ok) {
            remoteSuccess = true;
            preferredApiBase = base;
            break;
          }
        } catch {
          // Ignore and try the next base.
        }
      }
    } catch {
      remoteSuccess = false;
    } finally {
      setAuthMessage(remoteSuccess ? "로그아웃되었습니다." : "서버 연결 문제로 로컬 로그아웃 처리되었습니다.");
      setAuthLoading(false);
    }
  };

  const updateProfile = async (payload: { full_name?: string; profile_image?: File | null }) => {
    setAuthLoading(true);
    try {
      const form = new FormData();
      if (payload.full_name !== undefined) {
        form.append("full_name", payload.full_name);
      }
      if (payload.profile_image) {
        form.append("profile_image", payload.profile_image);
      }
      const res = await authFetch("/api/v1/auth/profile", {
        method: "PATCH",
        body: form,
      });
      const body = (await safeJson(res)) as AuthUser | { detail?: unknown };
      if (!res.ok) throw new Error(extractError(body, "회원정보 수정에 실패했습니다."));
      setUser(normalizeUser(body as AuthUser));
      setAuthMessage("회원정보가 수정되었습니다.");
    } finally {
      setAuthLoading(false);
    }
  };

  const changePassword = async (payload: {
    current_password: string;
    new_password: string;
    confirm_new_password: string;
  }) => {
    setAuthLoading(true);
    try {
      const res = await authFetch("/api/v1/auth/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await safeJson(res)) as { message?: string; detail?: unknown };
      if (!res.ok) throw new Error(extractError(body, "비밀번호 변경에 실패했습니다."));
      setAuthMessage(body.message ?? "비밀번호가 변경되었습니다.");
    } finally {
      setAuthLoading(false);
    }
  };

  const deleteAccount = async (confirmationText: string) => {
    setAuthLoading(true);
    try {
      const res = await authFetch("/api/v1/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation_text: confirmationText }),
      });
      const body = (await safeJson(res)) as { detail?: unknown };
      if (!res.ok) throw new Error(extractError(body, "회원 탈퇴에 실패했습니다."));
      setUser(null);
      setAuthOpen(false);
      setAuthMode("login");
      setAuthMessage("회원 탈퇴가 완료되었습니다.");
    } finally {
      setAuthLoading(false);
    }
  };

  const expectedWithdrawalText = useMemo(() => {
    const nickname = (user?.full_name ?? user?.email?.split("@")[0] ?? "").trim();
    return nickname ? `${nickname} 탈퇴를 동의합니다` : "";
  }, [user?.full_name, user?.email]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      authLoading,
      authOpen,
      authMode,
      authMessage,
      openAuth,
      closeAuth,
      setAuthMode,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      deleteAccount,
      expectedWithdrawalText,
      setAuthMessage,
      refreshMe,
    }),
    [user, loading, authLoading, authOpen, authMode, authMessage, expectedWithdrawalText]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 AuthProvider 내부에서 사용해야 합니다.");
  return ctx;
}

function extractError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: unknown };
    if (first && typeof first.msg === "string") return first.msg;
  }
  if (detail && typeof detail === "object") {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

function normalizeUser(user: AuthUser): AuthUser {
  if (!user.profile_image_url) return user;
  if (user.profile_image_url.startsWith("http://") || user.profile_image_url.startsWith("https://")) {
    return user;
  }
  if (!user.profile_image_url.startsWith("/")) return user;
  const base = resolveApiBases()[0];
  return {
    ...user,
    profile_image_url: `${base}${user.profile_image_url}`,
  };
}

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

function resolveApiBases(): string[] {
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const bases: string[] = [];
  const isBrowser = typeof window !== "undefined";
  const hostname = isBrowser ? window.location.hostname.toLowerCase() : "";
  const hasProxy = Boolean(envBase);
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local");

  if (preferredApiBase) {
    bases.push(normalizeBase(preferredApiBase));
  }

  if (isBrowser && hasProxy) {
    bases.push(normalizeBase(window.location.origin));
  }

  if (envBase) bases.push(normalizeBase(envBase));

  if (isBrowser && isLocalHost) {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    const hostBase = `${protocol}//${window.location.hostname}:8000`;
    bases.push(normalizeBase(hostBase));
    bases.push("http://localhost:8000");
    bases.push(DEFAULT_API_BASE);
  }

  return Array.from(new Set(bases));
}

async function authFetch(path: string, init: RequestInit): Promise<Response> {
  const bases = resolveApiBases();
  let lastError: unknown = null;

  for (const base of bases) {
    try {
      const response = await fetch(`${base}${path}`, {
        ...init,
        credentials: "include",
      });
      preferredApiBase = base;
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("API 연결 실패");
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}
