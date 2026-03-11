"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { apiFetch, buildMediaUrl, extractError, resolveApiBases, safeJson } from "@/app/lib/api-client";
import type { AuthMode, AuthUser, UserTerms } from "@/app/lib/types";

type RecoveryPurpose = "signup" | "find_id" | "reset_password";
type AuthMessageTone = "info" | "success" | "error";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  authLoading: boolean;
  authOpen: boolean;
  authMode: AuthMode;
  authMessage: string;
  authMessageTone: AuthMessageTone;
  openAuth: (mode: AuthMode) => void;
  closeAuth: () => void;
  setAuthMode: (mode: AuthMode) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    full_name: string;
    phone_number: string;
    email: string;
    password: string;
    confirm_password: string;
    agreements: boolean;
    verification_id: string;
    verification_code: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: { full_name?: string; phone_number?: string; profile_image?: File | null }) => Promise<void>;
  changePassword: (payload: {
    current_password: string;
    new_password: string;
    confirm_new_password: string;
  }) => Promise<void>;
  deleteAccount: (confirmationText: string) => Promise<void>;
  expectedWithdrawalText: string;
  setAuthMessage: (message: string, tone?: AuthMessageTone) => void;
  refreshMe: () => Promise<AuthUser | null>;
  sendRecoveryCode: (payload: {
    purpose: RecoveryPurpose;
    email: string;
  }) => Promise<{
    verification_id: string;
    expires_in_seconds: number;
    message: string;
    debug_code?: string | null;
  }>;
  findIdByProfile: (payload: { full_name: string; phone_number: string }) => Promise<{ masked_email: string }>;
  checkEmailAvailability: (email: string) => Promise<boolean>;
  resetPasswordByCode: (payload: {
    email: string;
    verification_id: string;
    code: string;
    new_password: string;
    confirm_new_password: string;
  }) => Promise<string>;
  loadTerms: () => Promise<UserTerms>;
  loadPublicTerms: () => Promise<UserTerms>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authMessage, setAuthMessageState] = useState("");
  const [authMessageTone, setAuthMessageTone] = useState<AuthMessageTone>("info");

  const setAuthMessage = (message: string, tone: AuthMessageTone = "info") => {
    setAuthMessageState(message);
    setAuthMessageTone(tone);
  };

  async function refreshMe(): Promise<AuthUser | null> {
    try {
      const res = await authFetch("/api/v1/auth/me", { method: "GET" });
      if (!res.ok) {
        setUser(null);
        return null;
      }
      const data = (await res.json()) as AuthUser;
      const normalized = normalizeUser(data);
      setUser(normalized);
      return normalized;
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
    setAuthMessage("");
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
      setAuthMessage("로그인되었습니다.", "success");
      setAuthOpen(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const register = async (payload: {
    full_name: string;
    phone_number: string;
    email: string;
    password: string;
    confirm_password: string;
    agreements: boolean;
    verification_id: string;
    verification_code: string;
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
      setAuthMessage("회원가입이 완료되었습니다. 로그인해 주세요.", "success");
      setAuthMode("login");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    setAuthLoading(true);
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
            break;
          }
        } catch {
          // next base
        }
      }
    } finally {
      setAuthMessage(
        remoteSuccess ? "로그아웃되었습니다." : "서버 연결 문제로 로컬 로그아웃 처리되었습니다.",
        remoteSuccess ? "success" : "error"
      );
      setAuthLoading(false);
    }
  };

  const updateProfile = async (payload: { full_name?: string; phone_number?: string; profile_image?: File | null }) => {
    setAuthLoading(true);
    try {
      const form = new FormData();
      if (payload.full_name !== undefined) {
        form.append("full_name", payload.full_name);
      }
      if (payload.phone_number !== undefined) {
        form.append("phone_number", payload.phone_number);
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
      setAuthMessage("회원정보가 수정되었습니다.", "success");
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
      setAuthMessage(body.message ?? "비밀번호가 변경되었습니다.", "success");
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
      setAuthMessage("회원 탈퇴가 완료되었습니다.", "success");
    } finally {
      setAuthLoading(false);
    }
  };

  const sendRecoveryCode = async (payload: { purpose: RecoveryPurpose; email: string }) => {
    const res = await authFetch("/api/v1/auth/recovery/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await safeJson(res)) as
      | { verification_id: string; expires_in_seconds: number; message: string; debug_code?: string }
      | { detail?: unknown };
    if (!res.ok) throw new Error(extractError(body, "인증 코드 발송에 실패했습니다."));
    return body as { verification_id: string; expires_in_seconds: number; message: string; debug_code?: string };
  };

  const findIdByProfile = async (payload: { full_name: string; phone_number: string }) => {
    const res = await authFetch("/api/v1/auth/recovery/find-id/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await safeJson(res)) as { masked_email: string } | { detail?: unknown };
    if (!res.ok) throw new Error(extractError(body, "아이디 찾기에 실패했습니다."));
    return body as { masked_email: string };
  };

  const checkEmailAvailability = async (email: string) => {
    const query = encodeURIComponent(email.trim());
    const res = await authFetch(`/api/v1/auth/email-availability?email=${query}`, { method: "GET" });
    const body = (await safeJson(res)) as { available: boolean } | { detail?: unknown };
    if (!res.ok) throw new Error(extractError(body, "이메일 중복 확인에 실패했습니다."));
    return (body as { available: boolean }).available;
  };

  const resetPasswordByCode = async (payload: {
    email: string;
    verification_id: string;
    code: string;
    new_password: string;
    confirm_new_password: string;
  }) => {
    const res = await authFetch("/api/v1/auth/recovery/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await safeJson(res)) as { message?: string; detail?: unknown };
    if (!res.ok) throw new Error(extractError(body, "비밀번호 재설정에 실패했습니다."));
    return body.message ?? "비밀번호가 재설정되었습니다.";
  };

  const loadTerms = async () => {
    const res = await authFetch("/api/v1/auth/terms", { method: "GET" });
    const body = (await safeJson(res)) as UserTerms | { detail?: unknown };
    if (!res.ok) throw new Error(extractError(body, "약관 조회에 실패했습니다."));
    return body as UserTerms;
  };

  const loadPublicTerms = async () => {
    const res = await authFetch("/api/v1/auth/terms/current", { method: "GET" });
    const body = (await safeJson(res)) as UserTerms | { detail?: unknown };
    if (!res.ok) throw new Error(extractError(body, "약관 조회에 실패했습니다."));
    return body as UserTerms;
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
      authMessageTone,
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
      sendRecoveryCode,
      findIdByProfile,
      checkEmailAvailability,
      resetPasswordByCode,
      loadTerms,
      loadPublicTerms,
    }),
    [
      user,
      loading,
      authLoading,
      authOpen,
      authMode,
      authMessage,
      authMessageTone,
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
      sendRecoveryCode,
      findIdByProfile,
      checkEmailAvailability,
      resetPasswordByCode,
      loadTerms,
      loadPublicTerms,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 AuthProvider 내부에서 사용해야 합니다.");
  return ctx;
}

function normalizeUser(user: AuthUser): AuthUser {
  if (!user.profile_image_url) return user;
  if (user.profile_image_url.startsWith("http://") || user.profile_image_url.startsWith("https://")) {
    return user;
  }
  if (!user.profile_image_url.startsWith("/")) return user;
  return {
    ...user,
    profile_image_url: buildMediaUrl(user.profile_image_url),
  };
}

async function authFetch(path: string, init: RequestInit): Promise<Response> {
  return apiFetch(path, init, { rememberPreferredBase: true });
}
