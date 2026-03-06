"use client";

import type {
  MapLandDetailsResponse,
  MapLookupResponse,
  MapPriceRowsResponse,
  MapZoneCoordinate,
  MapZoneResponse,
} from "@/app/lib/types";

const DEFAULT_API_BASE = "http://127.0.0.1:8000";

export async function fetchMapLookup(lat: number, lng: number): Promise<MapLookupResponse> {
  const res = await apiFetch("/api/v1/map/click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng }),
  });
  const payload = (await safeJson(res)) as MapLookupResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "지도 조회에 실패했습니다."));
  }
  return payload as MapLookupResponse;
}

export async function searchMapLookupByAddress(address: string): Promise<MapLookupResponse> {
  const res = await apiFetch("/api/v1/map/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  const payload = (await safeJson(res)) as MapLookupResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "주소 기반 지도 조회에 실패했습니다."));
  }
  return payload as MapLookupResponse;
}

export async function fetchMapLookupByPnu(pnu: string): Promise<MapLookupResponse> {
  const query = new URLSearchParams({ pnu });
  const res = await apiFetch(`/api/v1/map/by-pnu?${query.toString()}`, { method: "GET" });
  const payload = (await safeJson(res)) as MapLookupResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "PNU 기반 지도 조회에 실패했습니다."));
  }
  return payload as MapLookupResponse;
}

export async function fetchMapPriceRows(pnu: string): Promise<MapPriceRowsResponse> {
  const query = new URLSearchParams({ pnu });
  const res = await apiFetch(`/api/v1/map/price-rows?${query.toString()}`, { method: "GET" });
  const payload = (await safeJson(res)) as MapPriceRowsResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "연도별 공시지가 조회에 실패했습니다."));
  }
  return payload as MapPriceRowsResponse;
}

export async function fetchMapLandDetails(pnu: string): Promise<MapLandDetailsResponse> {
  const query = new URLSearchParams({ pnu });
  const res = await apiFetch(`/api/v1/map/land-details?${query.toString()}`, { method: "GET" });
  const payload = (await safeJson(res)) as MapLandDetailsResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "토지 상세 정보 조회에 실패했습니다."));
  }
  return payload as MapLandDetailsResponse;
}

export async function downloadMapLookupCsv(pnu: string): Promise<void> {
  const query = new URLSearchParams({ pnu });
  const res = await apiFetch(`/api/v1/map/export?${query.toString()}`, { method: "GET" });
  if (!res.ok) {
    const payload = (await safeJson(res)) as { detail?: unknown };
    throw new Error(extractError(payload, "CSV 다운로드에 실패했습니다."));
  }
  const blob = await res.blob();
  triggerDownload(blob, `parcel_${pnu}.csv`);
}

export async function analyzeMapZone(
  zoneName: string,
  coordinates: MapZoneCoordinate[],
  overlapThreshold?: number,
): Promise<MapZoneResponse> {
  const res = await apiFetch("/api/v1/map/zones/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      zone_name: zoneName,
      coordinates,
      overlap_threshold: overlapThreshold,
    }),
  });
  const payload = (await safeJson(res)) as MapZoneResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "구역 분석에 실패했습니다."));
  }
  return payload as MapZoneResponse;
}

export async function fetchMapZone(zoneId: string): Promise<MapZoneResponse> {
  const res = await apiFetch(`/api/v1/map/zones/${encodeURIComponent(zoneId)}`, { method: "GET" });
  const payload = (await safeJson(res)) as MapZoneResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "구역 분석 결과를 불러오지 못했습니다."));
  }
  return payload as MapZoneResponse;
}

export async function excludeMapZoneParcels(
  zoneId: string,
  pnuList: string[],
  reason?: string,
): Promise<MapZoneResponse> {
  const res = await apiFetch(`/api/v1/map/zones/${encodeURIComponent(zoneId)}/parcels/exclude`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pnu_list: pnuList, reason }),
  });
  const payload = (await safeJson(res)) as MapZoneResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "필지 제외 처리에 실패했습니다."));
  }
  return payload as MapZoneResponse;
}

export async function downloadMapZoneCsv(zoneId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/map/zones/${encodeURIComponent(zoneId)}/export`, { method: "GET" });
  if (!res.ok) {
    const payload = (await safeJson(res)) as { detail?: unknown };
    throw new Error(extractError(payload, "구역 CSV 다운로드에 실패했습니다."));
  }
  const blob = await res.blob();
  triggerDownload(blob, `zone_${zoneId}.csv`);
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

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

function resolveApiBases(): string[] {
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const bases: string[] = [];
  const isBrowser = typeof window !== "undefined";
  const hasProxy = Boolean(envBase);
  const hostname = isBrowser ? window.location.hostname.toLowerCase() : "";
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");

  if (isBrowser && hasProxy) {
    bases.push(normalizeBase(window.location.origin));
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
  if (lastError instanceof Error) {
    throw lastError;
  }
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
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (detail && typeof detail === "object") {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return fallback;
}
