"use client";

import { formatDateTime, formatNumber } from "@/app/lib/map-view-utils";
import type { MapZoneComparisonSummary } from "@/app/lib/types";

function formatSignedNumber(value: number | null): string {
  if (value === null || value === undefined) return "-";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumber(value)}`;
}

function formatThreshold(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function ZoneComparisonCard({
  comparison,
  loading,
  onClear,
}: {
  comparison: MapZoneComparisonSummary | null;
  loading: boolean;
  onClear: () => void;
}) {
  if (!comparison && !loading) return null;

  return (
    <section className="map-result-section zone-compare-section">
      <div className="map-result-section-head">
        <strong>저장 구역 비교</strong>
        {comparison ? <span>{comparison.target_zone_name}</span> : null}
      </div>

      {loading ? (
        <div className="lab-empty-state compact">
          <strong>비교 결과를 불러오는 중입니다.</strong>
          <p>현재 구역과 저장 구역의 차이를 계산하고 있습니다.</p>
        </div>
      ) : comparison ? (
        <>
          <div className="lab-inline-status neutral">
            <strong>{comparison.target_zone_name}</strong>
            <span>{formatDateTime(comparison.target_updated_at)} 저장본과 {formatDateTime(comparison.compared_at)} 기준으로 비교합니다.</span>
          </div>
          <div className="zone-compare-config-grid">
            <div className="map-zone-detail-item">
              <span>현재 분석 기준</span>
              <strong>{comparison.current_zone_name}</strong>
            </div>
            <div className="map-zone-detail-item">
              <span>포함 임계값</span>
              <strong>{formatThreshold(comparison.current_overlap_threshold)} → {formatThreshold(comparison.target_overlap_threshold)}</strong>
            </div>
            <div className="map-zone-detail-item">
              <span>알고리즘 버전</span>
              <strong>{comparison.current_algorithm_version} / {comparison.target_algorithm_version}</strong>
            </div>
            <div className="map-zone-detail-item">
              <span>AI 모델</span>
              <strong>{comparison.current_ai_model_version || "-"} / {comparison.target_ai_model_version || "-"}</strong>
            </div>
          </div>
          <div className="map-result-metric-grid compact">
            <div className="map-zone-detail-item">
              <span>필지 증감</span>
              <strong>{formatSignedNumber(comparison.parcel_delta)}</strong>
            </div>
            <div className="map-zone-detail-item">
              <span>포함 필지 추가</span>
              <strong>{formatNumber(comparison.added_parcel_count)}</strong>
            </div>
            <div className="map-zone-detail-item">
              <span>포함 필지 제거</span>
              <strong>{formatNumber(comparison.removed_parcel_count)}</strong>
            </div>
            <div className="map-zone-detail-item">
              <span>총가치 차이(원)</span>
              <strong>{formatSignedNumber(comparison.assessed_total_price_delta)}</strong>
            </div>
            <div className="map-zone-detail-item">
              <span>구역 내부 기준 가치 차이</span>
              <strong>{formatSignedNumber(comparison.geometry_assessed_total_price_delta)}</strong>
            </div>
            <div className="map-zone-detail-item">
              <span>평균 공시지가 차이</span>
              <strong>{formatSignedNumber(comparison.average_unit_price_delta)}</strong>
            </div>
            <div className="map-zone-detail-item">
              <span>경계 후보 증감</span>
              <strong>{formatSignedNumber(comparison.boundary_parcel_delta)}</strong>
            </div>
            <div className="map-zone-detail-item">
              <span>이상치 증감</span>
              <strong>{formatSignedNumber(comparison.anomaly_parcel_delta)}</strong>
            </div>
            <div className="map-zone-detail-item">
              <span>건축물 수 증감</span>
              <strong>{formatSignedNumber(comparison.building_count_delta)}</strong>
            </div>
          </div>
          <div className="zone-compare-lists">
            <div className="zone-compare-list">
              <strong>추가된 필지</strong>
              {comparison.added_parcels.length > 0 ? (
                <ul>
                  {comparison.added_parcels.slice(0, 6).map((item) => (
                    <li key={item.pnu}>{item.jibun_address || item.pnu}</li>
                  ))}
                </ul>
              ) : (
                <p>추가된 필지가 없습니다.</p>
              )}
            </div>
            <div className="zone-compare-list">
              <strong>제거된 필지</strong>
              {comparison.removed_parcels.length > 0 ? (
                <ul>
                  {comparison.removed_parcels.slice(0, 6).map((item) => (
                    <li key={item.pnu}>{item.jibun_address || item.pnu}</li>
                  ))}
                </ul>
              ) : (
                <p>제거된 필지가 없습니다.</p>
              )}
            </div>
          </div>
          <div className="map-result-action-row">
            <button type="button" className="lab-btn lab-btn-tertiary compact" onClick={onClear}>
              비교 닫기
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
