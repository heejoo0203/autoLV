"use client";

import { apiFetch, extractError, safeJson } from "@/app/lib/api-client";
import type {
  MapLandDetailsResponse,
  MapZoneDeleteResponse,
  MapZoneListResponse,
  MapLookupResponse,
  MapPriceRowsResponse,
  MapZoneCoordinate,
  MapZoneResponse,
} from "@/app/lib/types";

export async function fetchMapLookup(lat: number, lng: number): Promise<MapLookupResponse> {
  const res = await apiFetch("/api/v1/map/click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng }),
  }, { preferDirectLocalApi: true });
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
  }, { preferDirectLocalApi: true });
  const payload = (await safeJson(res)) as MapLookupResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "주소 기반 지도 조회에 실패했습니다."));
  }
  return payload as MapLookupResponse;
}

export async function fetchMapLookupByPnu(pnu: string): Promise<MapLookupResponse> {
  const query = new URLSearchParams({ pnu });
  const res = await apiFetch(`/api/v1/map/by-pnu?${query.toString()}`, { method: "GET" }, { preferDirectLocalApi: true });
  const payload = (await safeJson(res)) as MapLookupResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "PNU 기반 지도 조회에 실패했습니다."));
  }
  return payload as MapLookupResponse;
}

export async function fetchMapPriceRows(pnu: string): Promise<MapPriceRowsResponse> {
  const query = new URLSearchParams({ pnu });
  const res = await apiFetch(`/api/v1/map/price-rows?${query.toString()}`, { method: "GET" }, { preferDirectLocalApi: true });
  const payload = (await safeJson(res)) as MapPriceRowsResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "연도별 공시지가 조회에 실패했습니다."));
  }
  return payload as MapPriceRowsResponse;
}

export async function fetchMapLandDetails(pnu: string): Promise<MapLandDetailsResponse> {
  const query = new URLSearchParams({ pnu });
  const res = await apiFetch(`/api/v1/map/land-details?${query.toString()}`, { method: "GET" }, { preferDirectLocalApi: true });
  const payload = (await safeJson(res)) as MapLandDetailsResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "토지 상세 정보 조회에 실패했습니다."));
  }
  return payload as MapLandDetailsResponse;
}

export async function downloadMapLookupCsv(pnu: string): Promise<void> {
  const query = new URLSearchParams({ pnu });
  const res = await apiFetch(`/api/v1/map/export?${query.toString()}`, { method: "GET" }, { preferDirectLocalApi: true });
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
  }, { requireSameOriginAuth: true });
  const payload = (await safeJson(res)) as MapZoneResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "구역 분석에 실패했습니다."));
  }
  return payload as MapZoneResponse;
}

export async function saveMapZone(
  zoneName: string,
  coordinates: MapZoneCoordinate[],
  excludedPnuList: string[] = [],
  overlapThreshold?: number,
): Promise<MapZoneResponse> {
  const res = await apiFetch("/api/v1/map/zones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      zone_name: zoneName,
      coordinates,
      overlap_threshold: overlapThreshold,
      excluded_pnu_list: excludedPnuList,
    }),
  }, { requireSameOriginAuth: true });
  const payload = (await safeJson(res)) as MapZoneResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "구역 저장에 실패했습니다."));
  }
  return payload as MapZoneResponse;
}

export async function fetchMapZone(zoneId: string): Promise<MapZoneResponse> {
  const res = await apiFetch(
    `/api/v1/map/zones/${encodeURIComponent(zoneId)}`,
    { method: "GET" },
    { requireSameOriginAuth: true },
  );
  const payload = (await safeJson(res)) as MapZoneResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "구역 분석 결과를 불러오지 못했습니다."));
  }
  return payload as MapZoneResponse;
}

export async function fetchMapZones(page = 1, pageSize = 50): Promise<MapZoneListResponse> {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  const res = await apiFetch(
    `/api/v1/map/zones?${query.toString()}`,
    { method: "GET" },
    { requireSameOriginAuth: true },
  );
  const payload = (await safeJson(res)) as MapZoneListResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "저장된 구역 목록을 불러오지 못했습니다."));
  }
  return payload as MapZoneListResponse;
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
  }, { requireSameOriginAuth: true });
  const payload = (await safeJson(res)) as MapZoneResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "필지 제외 처리에 실패했습니다."));
  }
  return payload as MapZoneResponse;
}

export async function renameMapZone(zoneId: string, zoneName: string): Promise<MapZoneResponse> {
  const res = await apiFetch(`/api/v1/map/zones/${encodeURIComponent(zoneId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zone_name: zoneName }),
  }, { requireSameOriginAuth: true });
  const payload = (await safeJson(res)) as MapZoneResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "구역 이름 변경에 실패했습니다."));
  }
  return payload as MapZoneResponse;
}

export async function deleteMapZone(zoneId: string): Promise<MapZoneDeleteResponse> {
  const res = await apiFetch(
    `/api/v1/map/zones/${encodeURIComponent(zoneId)}`,
    { method: "DELETE" },
    { requireSameOriginAuth: true },
  );
  const payload = (await safeJson(res)) as MapZoneDeleteResponse | { detail?: unknown };
  if (!res.ok) {
    throw new Error(extractError(payload, "구역 삭제에 실패했습니다."));
  }
  return payload as MapZoneDeleteResponse;
}

export async function downloadMapZoneCsv(zoneId: string): Promise<void> {
  const res = await apiFetch(
    `/api/v1/map/zones/${encodeURIComponent(zoneId)}/export`,
    { method: "GET" },
    { requireSameOriginAuth: true },
  );
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
