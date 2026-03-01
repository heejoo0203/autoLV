"use client";

import type {
  BulkAddressMode,
  BulkDeleteResponse,
  BulkGuide,
  BulkJob,
  BulkJobCreateResponse,
  BulkJobListResponse,
} from "@/app/lib/types";

const DEFAULT_API_BASE = "http://127.0.0.1:8000";

export async function fetchBulkGuide(): Promise<BulkGuide> {
  const res = await apiFetch("/api/v1/bulk/guide", { method: "GET" });
  const payload = (await safeJson(res)) as BulkGuide | { detail?: unknown };
  if (!res.ok) throw new Error(extractError(payload, "파일 조회 가이드를 불러오지 못했습니다."));
  return payload as BulkGuide;
}

export async function createBulkJob(file: File, addressMode: BulkAddressMode): Promise<BulkJobCreateResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("address_mode", addressMode);

  const res = await apiFetch("/api/v1/bulk/jobs", {
    method: "POST",
    body: form,
  });
  const payload = (await safeJson(res)) as BulkJobCreateResponse | { detail?: unknown };
  if (!res.ok) throw new Error(extractError(payload, "파일 업로드에 실패했습니다."));
  return payload as BulkJobCreateResponse;
}

export async function fetchBulkJobs(page = 1, pageSize = 10): Promise<BulkJobListResponse> {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  const res = await apiFetch(`/api/v1/bulk/jobs?${query.toString()}`, { method: "GET" });
  const payload = (await safeJson(res)) as BulkJobListResponse | { detail?: unknown };
  if (!res.ok) throw new Error(extractError(payload, "파일 작업 목록을 불러오지 못했습니다."));
  return payload as BulkJobListResponse;
}

export async function fetchBulkJob(jobId: string): Promise<BulkJob> {
  const res = await apiFetch(`/api/v1/bulk/jobs/${encodeURIComponent(jobId)}`, { method: "GET" });
  const payload = (await safeJson(res)) as BulkJob | { detail?: unknown };
  if (!res.ok) throw new Error(extractError(payload, "작업 상태를 조회하지 못했습니다."));
  return payload as BulkJob;
}

export async function downloadBulkTemplate(): Promise<void> {
  const res = await apiFetch("/api/v1/bulk/template", { method: "GET" });
  if (!res.ok) {
    const payload = (await safeJson(res)) as { detail?: unknown };
    throw new Error(extractError(payload, "양식 파일 다운로드에 실패했습니다."));
  }
  const blob = await res.blob();
  triggerDownload(blob, "autolv_bulk_template.xlsx");
}

export async function downloadBulkResult(jobId: string, fileName: string): Promise<void> {
  const res = await apiFetch(`/api/v1/bulk/jobs/${encodeURIComponent(jobId)}/download`, { method: "GET" });
  if (!res.ok) {
    const payload = (await safeJson(res)) as { detail?: unknown };
    throw new Error(extractError(payload, "결과 파일 다운로드에 실패했습니다."));
  }
  const blob = await res.blob();
  triggerDownload(blob, `${stripExtension(fileName)}_result.xlsx`);
}

export async function deleteBulkJobs(jobIds: string[]): Promise<BulkDeleteResponse> {
  const res = await apiFetch("/api/v1/bulk/jobs/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_ids: jobIds }),
  });
  const payload = (await safeJson(res)) as BulkDeleteResponse | { detail?: unknown };
  if (!res.ok) throw new Error(extractError(payload, "작업 삭제에 실패했습니다."));
  return payload as BulkDeleteResponse;
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function stripExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0) return fileName || "result";
  return fileName.slice(0, idx);
}

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

function resolveApiBases(): string[] {
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const bases: string[] = [];
  if (envBase) bases.push(normalizeBase(envBase));

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    bases.push(`${protocol}//${window.location.hostname}:8000`);
    bases.push("http://localhost:8000");
  }

  bases.push(DEFAULT_API_BASE);
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
