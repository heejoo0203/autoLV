"use client";

import type { MapZoneComparisonSummary, MapZoneResponse } from "@/app/lib/types";

export function buildZoneComparisonSummary(
  current: MapZoneResponse,
  baseline: MapZoneResponse,
): MapZoneComparisonSummary {
  const currentIncluded = current.parcels.filter((item) => item.included);
  const baselineIncluded = baseline.parcels.filter((item) => item.included);
  const currentMap = new Map(currentIncluded.map((item) => [item.pnu, item]));
  const baselineMap = new Map(baselineIncluded.map((item) => [item.pnu, item]));

  const addedParcels = currentIncluded
    .filter((item) => !baselineMap.has(item.pnu))
    .map((item) => ({ pnu: item.pnu, jibun_address: item.jibun_address }));
  const removedParcels = baselineIncluded
    .filter((item) => !currentMap.has(item.pnu))
    .map((item) => ({ pnu: item.pnu, jibun_address: item.jibun_address }));

  return {
    target_zone_id: baseline.summary.zone_id ?? "",
    target_zone_name: baseline.summary.zone_name,
    target_updated_at: baseline.summary.updated_at,
    current_zone_name: current.summary.zone_name,
    current_updated_at: current.summary.updated_at,
    compared_at: new Date().toISOString(),
    added_parcel_count: addedParcels.length,
    removed_parcel_count: removedParcels.length,
    added_parcels: addedParcels,
    removed_parcels: removedParcels,
    parcel_delta: current.summary.parcel_count - baseline.summary.parcel_count,
    assessed_total_price_delta: current.summary.assessed_total_price - baseline.summary.assessed_total_price,
    geometry_assessed_total_price_delta:
      current.summary.geometry_assessed_total_price - baseline.summary.geometry_assessed_total_price,
    average_unit_price_delta:
      current.summary.average_unit_price !== null && baseline.summary.average_unit_price !== null
        ? current.summary.average_unit_price - baseline.summary.average_unit_price
        : null,
    boundary_parcel_delta: current.summary.boundary_parcel_count - baseline.summary.boundary_parcel_count,
    anomaly_parcel_delta: current.summary.anomaly_parcel_count - baseline.summary.anomaly_parcel_count,
    building_count_delta: current.summary.total_building_count - baseline.summary.total_building_count,
    current_overlap_threshold: current.summary.overlap_threshold,
    target_overlap_threshold: baseline.summary.overlap_threshold,
    current_algorithm_version: current.summary.algorithm_version,
    target_algorithm_version: baseline.summary.algorithm_version,
    current_ai_model_version: current.summary.ai_model_version,
    target_ai_model_version: baseline.summary.ai_model_version,
  };
}
