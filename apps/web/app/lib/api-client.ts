"use client";

const DEFAULT_API_BASE = "http://127.0.0.1:8000";

let preferredApiBase: string | null = null;

export type ApiFetchOptions = {
  preferDirectLocalApi?: boolean;
  requireSameOriginAuth?: boolean;
  rememberPreferredBase?: boolean;
};

export function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

export function isLocalApiBase(base: string | null | undefined): boolean {
  if (!base) return false;
  try {
    const parsed = new URL(base);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
  } catch {
    return false;
  }
}

export function resolveApiBases(options?: ApiFetchOptions): string[] {
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const bases: string[] = [];
  const isBrowser = typeof window !== "undefined";
  const hostname = isBrowser ? window.location.hostname.toLowerCase() : "";
  const hasProxy = Boolean(envBase);
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
  const preferDirectLocalApi = Boolean(options?.preferDirectLocalApi);
  const requireSameOriginAuth = Boolean(options?.requireSameOriginAuth);
  const shouldPreferDirectLocalApi = preferDirectLocalApi && isLocalApiBase(envBase);

  if (!requireSameOriginAuth && preferredApiBase) {
    bases.push(normalizeBase(preferredApiBase));
  }

  if (isBrowser && hasProxy) {
    bases.push(normalizeBase(window.location.origin));
  }

  if (requireSameOriginAuth && isBrowser && hasProxy) {
    return Array.from(new Set(bases.map(normalizeBase)));
  }

  if (envBase && shouldPreferDirectLocalApi) {
    bases.unshift(normalizeBase(envBase));
  }

  if (envBase) {
    bases.push(normalizeBase(envBase));
  }

  if (isBrowser && isLocalHost) {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    bases.push(`${protocol}//${window.location.hostname}:8000`);
    bases.push("http://localhost:8000");
    bases.push(DEFAULT_API_BASE);
  }

  return Array.from(new Set(bases.map(normalizeBase)));
}

export async function apiFetch(path: string, init: RequestInit, options?: ApiFetchOptions): Promise<Response> {
  let lastError: unknown = null;
  for (const base of resolveApiBases(options)) {
    try {
      const response = await fetch(`${base}${path}`, {
        ...init,
        credentials: "include",
      });
      if (options?.rememberPreferredBase && response.ok) {
        preferredApiBase = base;
      }
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("API 연결 실패");
}

export async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export function extractError(payload: unknown, fallback: string): string {
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

export function buildMediaUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const [base] = resolveApiBases();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
