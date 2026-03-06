"use client";

import type { LandResultRow, MapZoneResponse } from "@/app/lib/types";

export function rebuildZonePreview(zoneResult: MapZoneResponse, parcels: MapZoneResponse["parcels"]): MapZoneResponse {
  const includedParcels = parcels.filter((item) => item.included);
  const baseYearCandidates = includedParcels
    .filter((item) => item.price_current !== null && item.price_year)
    .map((item) => item.price_year as string);
  const baseYear = baseYearCandidates.length > 0 ? baseYearCandidates.sort().at(-1) ?? null : null;
  const countedParcels = includedParcels.filter(
    (item) => item.price_current !== null && item.price_year !== null && item.price_year === baseYear,
  );
  const assessedTotalPrice = countedParcels.reduce((sum, item) => sum + (item.estimated_total_price ?? 0), 0);
  const zoneAreaSqm = includedParcels.reduce((sum, item) => sum + (item.area_sqm ?? 0), 0);
  const averageUnitPrice = zoneAreaSqm > 0 ? Math.round(assessedTotalPrice / zoneAreaSqm) : null;

  const nextParcels = parcels.map((item) => ({
    ...item,
    counted_in_summary:
      item.included && item.price_current !== null && item.price_year !== null && item.price_year === baseYear,
  }));

  return {
    ...zoneResult,
    summary: {
      ...zoneResult.summary,
      base_year: baseYear,
      zone_area_sqm: Math.round(zoneAreaSqm * 100) / 100,
      parcel_count: includedParcels.length,
      counted_parcel_count: countedParcels.length,
      excluded_parcel_count: parcels.length - includedParcels.length,
      average_unit_price: averageUnitPrice,
      assessed_total_price: assessedTotalPrice,
      updated_at: new Date().toISOString(),
    },
    parcels: nextParcels,
  };
}

export function toPointKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)}:${lng.toFixed(6)}`;
}

export function buildZonePointMarker(index: number, isFirst: boolean): HTMLDivElement {
  const element = document.createElement("div");
  element.className = `map-zone-point-marker ${isFirst ? "first" : ""}`;
  element.innerHTML = `<span>${index}</span>`;
  return element;
}

export function parseParcelPolygonPaths(geometryGeojson: string, kakaoMaps: any): any[] {
  if (!geometryGeojson || !kakaoMaps?.LatLng) return [];

  try {
    const geometry = JSON.parse(geometryGeojson) as { type?: string; coordinates?: unknown };
    if (!geometry?.type || !geometry?.coordinates) return [];

    if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
      const rings = buildPolygonRings(geometry.coordinates, kakaoMaps);
      return rings.length > 0 ? [rings.length === 1 ? rings[0] : rings] : [];
    }

    if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
      const paths: any[] = [];
      for (const polygon of geometry.coordinates) {
        if (!Array.isArray(polygon)) continue;
        const rings = buildPolygonRings(polygon, kakaoMaps);
        if (rings.length > 0) {
          paths.push(rings.length === 1 ? rings[0] : rings);
        }
      }
      return paths;
    }
  } catch {
    return [];
  }

  return [];
}

function buildPolygonRings(rawPolygon: unknown[], kakaoMaps: any): any[] {
  const rings: any[] = [];
  for (const rawRing of rawPolygon) {
    if (!Array.isArray(rawRing)) continue;
    const ring = rawRing
      .map((point) => {
        if (!Array.isArray(point) || point.length < 2) return null;
        const lng = Number(point[0]);
        const lat = Number(point[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return new kakaoMaps.LatLng(lat, lng);
      })
      .filter(Boolean);
    if (ring.length >= 3) {
      rings.push(ring);
    }
  }
  return rings;
}

export function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("ko-KR");
}

export function formatArea(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

export function formatRate(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(2)}%`;
}

export function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function toDisplayAddress(summary: string, results: LandResultRow[]): string {
  if (results.length > 0) {
    const first = results[0];
    const location = (first.토지소재지 ?? "").trim();
    const jibun = (first.지번 ?? "").trim();
    if (location && jibun) return `${location} ${jibun}`;
    if (location) return location;
  }
  return summary;
}
