"use client";

import type { LandResultRow, SearchHistoryLog, SearchHistoryLogDetail, SearchHistoryLogListResponse } from "@/app/lib/types";

const DEFAULT_API_BASE = "http://127.0.0.1:8000";

export async function createSearchHistoryLog(payload: {
  search_type: "jibun" | "road" | "map";
  pnu: string;
  address_summary: string;
  rows: LandResultRow[];
}): Promise<SearchHistoryLog> {
  const res = await apiFetch("/api/v1/history/query-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await safeJson(res)) as SearchHistoryLog | { detail?: unknown };
  if (!res.ok) throw new Error(extractError(body, "조회기록 저장에 실패했습니다."));
  return body as SearchHistoryLog;
}

export async function fetchSearchHistoryLogs(page = 1, pageSize = 100): Promise<SearchHistoryLogListResponse> {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  const res = await apiFetch(`/api/v1/history/query-logs?${query.toString()}`, { method: "GET" });
  const body = (await safeJson(res)) as SearchHistoryLogListResponse | { detail?: unknown };
  if (!res.ok) throw new Error(extractError(body, "조회기록 목록을 불러오지 못했습니다."));
  return body as SearchHistoryLogListResponse;
}

export async function fetchSearchHistoryLogsWithFilter(params: {
  page?: number;
  pageSize?: number;
  searchType?: "jibun" | "road" | "map" | "all";
  sido?: string;
  sigungu?: string;
  sortBy?: "created_at" | "address_summary" | "search_type" | "result_count";
  sortOrder?: "asc" | "desc";
}): Promise<SearchHistoryLogListResponse> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    page_size: String(params.pageSize ?? 100),
    sort_by: params.sortBy ?? "created_at",
    sort_order: params.sortOrder ?? "desc",
  });
  if (params.searchType && params.searchType !== "all") {
    query.set("search_type", params.searchType);
  }
  if ((params.sido ?? "").trim()) query.set("sido", (params.sido ?? "").trim());
  if ((params.sigungu ?? "").trim()) query.set("sigungu", (params.sigungu ?? "").trim());

  const res = await apiFetch(`/api/v1/history/query-logs?${query.toString()}`, { method: "GET" });
  const body = (await safeJson(res)) as SearchHistoryLogListResponse | { detail?: unknown };
  if (!res.ok) throw new Error(extractError(body, "조회기록 목록을 불러오지 못했습니다."));
  return body as SearchHistoryLogListResponse;
}

export async function fetchSearchHistoryDetail(logId: string): Promise<SearchHistoryLogDetail> {
  const res = await apiFetch(`/api/v1/history/query-logs/${encodeURIComponent(logId)}`, { method: "GET" });
  const body = (await safeJson(res)) as SearchHistoryLogDetail | { detail?: unknown };
  if (!res.ok) throw new Error(extractError(body, "조회기록을 불러오지 못했습니다."));
  return body as SearchHistoryLogDetail;
}

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

function resolveApiBases(): string[] {
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const bases: string[] = [];
  const isBrowser = typeof window !== "undefined";
  const hasProxy = Boolean(envBase);
  const hostname = isBrowser ? window.location.hostname.toLowerCase() : "";
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local");

  if (isBrowser && hasProxy) {
    bases.push(normalizeBase(window.location.origin));
  }
  if (envBase) bases.push(normalizeBase(envBase));

  if (isBrowser && isLocalHost) {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    bases.push(`${protocol}//${window.location.hostname}:8000`);
    bases.push("http://localhost:8000");
    bases.push(DEFAULT_API_BASE);
  }

  return Array.from(new Set(bases.map(normalizeBase)));
}

async function apiFetch(path: string, init: RequestInit): Promise<Response> {
  let lastError: unknown = null;
  for (const base of resolveApiBases()) {
    try {
      return await fetch(`${base}${path}`, {
        ...init,
        credentials: "include",
      });
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error("API 연결 실패");
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function extractError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}
