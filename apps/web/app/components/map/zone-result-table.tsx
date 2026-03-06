"use client";

import { MetricCard } from "@/app/components/map/metric-card";
import { formatArea, formatNumber } from "@/app/lib/map-view-utils";
import type { MapZoneResponse } from "@/app/lib/types";

export function ZoneResultTable({
  zoneResult,
  selectedPnuSet,
  onSelect,
  onLocate,
  onOpenBasic,
}: {
  zoneResult: MapZoneResponse | null;
  selectedPnuSet: Set<string>;
  onSelect: (pnu: string, checked: boolean) => void;
  onLocate: (lat: number | null, lng: number | null) => void;
  onOpenBasic: (parcel: MapZoneResponse["parcels"][number]) => void;
}) {
  if (!zoneResult) {
    return <div className="map-empty">구역 좌표를 선택하고 `구역 분석`을 실행해 주세요.</div>;
  }

  const { summary, parcels } = zoneResult;
  const overlapPercent = Math.round((summary.overlap_threshold || 0.9) * 100);
  return (
    <>
      <div className="map-metrics">
        <MetricCard label="구역명" value={summary.zone_name} />
        <MetricCard label="기준연도(최신)" value={summary.base_year || "-"} />
        <MetricCard label="구역 면적(㎡)" value={formatArea(summary.zone_area_sqm)} />
        <MetricCard label="구역 내 필지 수" value={formatNumber(summary.parcel_count)} />
        <MetricCard label="평균 공시지가(원/㎡)" value={formatNumber(summary.average_unit_price)} />
        <MetricCard label="총 공시지가 합계(원)" value={formatNumber(summary.assessed_total_price)} />
      </div>
      <p className="hint">필지 포함 기준: 구역 내부 {overlapPercent}% 이상 포함된 경우만 집계하며, 계산 반영 필지는 지도에서 진하게 표시합니다.</p>
      <table className="data-table map-zone-table">
        <thead>
          <tr>
            <th className="center">선택</th>
            <th>지번 주소</th>
            <th className="center">지목</th>
            <th className="center">용도지역명</th>
            <th className="right">면적(㎡)</th>
            <th className="right">공시지가(원/㎡)</th>
            <th className="right">면적×공시지가</th>
            <th className="center">연도</th>
          </tr>
        </thead>
        <tbody>
          {parcels.map((row) => {
            const selected = selectedPnuSet.has(row.pnu);
            return (
              <tr key={row.pnu} className={!row.included ? "excluded" : ""} onClick={() => onLocate(row.lat, row.lng)}>
                <td className="center" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!row.included}
                    onChange={(event) => onSelect(row.pnu, event.target.checked)}
                    aria-label={`필지 선택 ${row.pnu}`}
                  />
                </td>
                <td onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="map-address-link" onClick={() => onOpenBasic(row)}>
                    {row.jibun_address || "-"}
                  </button>
                </td>
                <td className="center">{row.land_category_name || "-"}</td>
                <td className="center">{row.purpose_area_name || "-"}</td>
                <td className="right">{formatArea(row.area_sqm)}</td>
                <td className="right">{formatNumber(row.price_current)}</td>
                <td className="right">{formatNumber(row.estimated_total_price)}</td>
                <td className="center">{row.price_year || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
