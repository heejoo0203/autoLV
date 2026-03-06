"use client";

import { apiFetch, extractError, safeJson } from "@/app/lib/api-client";
import type {
  LandResultRow,
  SearchHistoryDeleteResponse,
  SearchHistoryLog,
  SearchHistoryLogDetail,
  SearchHistoryLogListResponse,
} from "@/app/lib/types";

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

export async function deleteSearchHistoryLogs(logIds: string[]): Promise<SearchHistoryDeleteResponse> {
  const res = await apiFetch("/api/v1/history/query-logs/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ log_ids: logIds }),
  });
  const body = (await safeJson(res)) as SearchHistoryDeleteResponse | { detail?: unknown };
  if (!res.ok) throw new Error(extractError(body, "조회기록 삭제에 실패했습니다."));
  return body as SearchHistoryDeleteResponse;
}
