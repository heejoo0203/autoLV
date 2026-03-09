"use client";

import { Fragment, useMemo, useState } from "react";

import { MetricCard } from "@/app/components/map/metric-card";
import { formatArea, formatNumber } from "@/app/lib/map-view-utils";
import type { MapZoneResponse } from "@/app/lib/types";

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;
}

function getParcelAgedLabel(parcel: MapZoneResponse["parcels"][number]): string {
  if (!parcel.building_count) return "-";
  return parcel.aged_building_count > 0 ? "노후" : "일반";
}

function getParcelAgeDisplay(parcel: MapZoneResponse["parcels"][number]): string {
  if (!parcel.building_count) return "-";
  if (parcel.average_approval_year) {
    return `${parcel.average_approval_year} · ${getParcelAgedLabel(parcel)}`;
  }
  return getParcelAgedLabel(parcel);
}

function getInclusionLabel(parcel: MapZoneResponse["parcels"][number]): string {
  if (parcel.inclusion_mode === "boundary_candidate") return "경계 후보";
  if (parcel.inclusion_mode === "user_excluded") return "수동 제외";
  if (parcel.included) return "확정 포함";
  return "제외";
}

function getConfidenceLabel(score: number): string {
  if (score >= 0.9) return "높음";
  if (score >= 0.7) return "보통";
  return "낮음";
}

function getAiRecommendationLabel(parcel: MapZoneResponse["parcels"][number]): string {
  if (parcel.ai_recommendation === "included") return "추천 포함";
  if (parcel.ai_recommendation === "uncertain") return "검토 필요";
  if (parcel.ai_recommendation === "excluded") return "추천 제외";
  return "-";
}

function getAnomalyLabel(parcel: MapZoneResponse["parcels"][number]): string {
  if (!parcel.anomaly_level || parcel.anomaly_level === "none") return "없음";
  if (parcel.anomaly_level === "critical") return "중요 검토";
  return "검토 필요";
}

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
  const [expandedPnuSet, setExpandedPnuSet] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<"all" | "included" | "boundary" | "excluded">("all");
  const previewSummary = zoneResult?.summary ?? null;
  const parcels = zoneResult?.parcels ?? [];
  const overlapPercent = Math.round(((previewSummary?.overlap_threshold ?? 0.9) || 0.9) * 100);
  const visibleParcels = useMemo(() => {
    if (filterMode === "included") return parcels.filter((row) => row.included);
    if (filterMode === "boundary") return parcels.filter((row) => row.inclusion_mode === "boundary_candidate");
    if (filterMode === "excluded") return parcels.filter((row) => !row.included && row.inclusion_mode !== "boundary_candidate");
    return parcels;
  }, [filterMode, parcels]);

  if (!zoneResult) {
    return <div className="map-empty">구역 좌표를 선택하고 `구역 분석`을 실행해 주세요.</div>;
  }

  const summary = zoneResult.summary;

  const toggleExpanded = (pnu: string) => {
    setExpandedPnuSet((prev) => {
      const next = new Set(prev);
      if (next.has(pnu)) {
        next.delete(pnu);
      } else {
        next.add(pnu);
      }
      return next;
    });
  };

  return (
    <>
      <div className="map-metrics">
        <MetricCard label="구역명" value={summary.zone_name} />
        <MetricCard label="기준연도(최신)" value={summary.base_year || "-"} />
        <MetricCard label="포함 필지 면적(㎡)" value={formatArea(summary.zone_area_sqm)} />
        <MetricCard label="구역 내부 면적(㎡)" value={formatArea(summary.overlap_area_sqm_total)} />
        <MetricCard label="구역 내 필지 수" value={formatNumber(summary.parcel_count)} />
        <MetricCard label="경계 필지 수" value={formatNumber(summary.boundary_parcel_count)} />
        <MetricCard label="AI 추천 포함" value={formatNumber(summary.ai_recommended_include_count)} />
        <MetricCard label="AI 검토 필요" value={formatNumber(summary.ai_uncertain_count)} />
        <MetricCard label="평균 공시지가(원/㎡)" value={formatNumber(summary.average_unit_price)} />
        <MetricCard label="포함 필지 기준 총가치(원)" value={formatNumber(summary.assessed_total_price)} />
        <MetricCard label="구역 내부 기준 총가치(원)" value={formatNumber(summary.geometry_assessed_total_price)} />
        <MetricCard label="건축물 수" value={formatNumber(summary.total_building_count)} />
        <MetricCard label="노후 건축물 수" value={formatNumber(summary.aged_building_count)} />
        <MetricCard label="노후도(%)" value={formatNumber(summary.aged_building_ratio)} />
        <MetricCard label="사용승인년도" value={summary.average_approval_year ? String(summary.average_approval_year) : "-"} />
        <MetricCard label="총 대지면적(㎡)" value={formatArea(summary.total_site_area_sqm)} />
        <MetricCard label="총 연면적(㎡)" value={formatArea(summary.total_floor_area_sqm)} />
        <MetricCard label="용적률(%)" value={formatNumber(summary.average_floor_area_ratio)} />
        <MetricCard label="과소필지 비율(%)" value={formatNumber(summary.undersized_parcel_ratio)} />
      </div>
      {summary.ai_report_text ? <p className="hint">{summary.ai_report_text}</p> : null}
      <p className="hint">필지 포함 기준: 구역 내부 {overlapPercent}% 이상 포함된 경우만 집계하며, 계산 반영 필지는 지도에서 진하게 표시합니다.</p>
      <p className="hint">값 구분: 공시지가·용도지역은 원문값, 총가치는 계산값, 경계 후보/세대수 보정은 추정 또는 보정값입니다.</p>
      <p className="hint">건축 지표 기준: 노후도는 사용승인 30년 이상, 과소필지는 90㎡ 미만 필지를 기준으로 계산합니다.</p>
      {summary.building_data_message ? <p className="hint">{summary.building_data_message}</p> : null}
      <div className="map-zone-filter-row">
        <button type="button" className={`lab-filter-chip ${filterMode === "all" ? "active" : ""}`} onClick={() => setFilterMode("all")}>
          전체 {formatNumber(parcels.length)}
        </button>
        <button type="button" className={`lab-filter-chip ${filterMode === "included" ? "active" : ""}`} onClick={() => setFilterMode("included")}>
          확정 포함 {formatNumber(summary.parcel_count)}
        </button>
        <button type="button" className={`lab-filter-chip ${filterMode === "boundary" ? "active" : ""}`} onClick={() => setFilterMode("boundary")}>
          경계 후보 {formatNumber(summary.boundary_parcel_count)}
        </button>
        <button type="button" className={`lab-filter-chip ${filterMode === "excluded" ? "active" : ""}`} onClick={() => setFilterMode("excluded")}>
          제외 {formatNumber(summary.excluded_parcel_count)}
        </button>
      </div>
      <div className="map-zone-table-wrap">
        <table className="data-table map-zone-table">
          <thead>
            <tr>
              <th className="center narrow">선택</th>
              <th className="address-col">지번 주소</th>
              <th className="center">용도지역명</th>
              <th className="center">주용도</th>
              <th className="right">대지면적(㎡)</th>
              <th className="right">공시지가(원/㎡)</th>
              <th className="right">총 공시지가</th>
              <th className="right">전년 대비 증감률(%)</th>
              <th className="center">건물연식/노후</th>
              <th className="right">노후도(%)</th>
              <th className="right">현재 용적률(%)</th>
              <th className="center narrow">상세</th>
            </tr>
          </thead>
          <tbody>
            {visibleParcels.map((row) => {
              const selected = selectedPnuSet.has(row.pnu);
              const expanded = expandedPnuSet.has(row.pnu);
              return (
                <Fragment key={row.pnu}>
                  <tr className={!row.included ? "excluded" : ""} onClick={() => onLocate(row.lat, row.lng)}>
                    <td className="center" data-label="선택" onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" checked={selected} onChange={(event) => onSelect(row.pnu, event.target.checked)} aria-label={`필지 선택 ${row.pnu}`} />
                    </td>
                    <td className="address-col" data-label="지번 주소" onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="map-address-link" onClick={() => onOpenBasic(row)}>
                        {row.jibun_address || "-"}
                      </button>
                    </td>
                    <td className="center" data-label="용도지역명">{row.purpose_area_name || "-"}</td>
                    <td className="center" data-label="주용도">{row.primary_purpose_name || "-"}</td>
                    <td className="right" data-label="대지면적(㎡)">{formatArea(row.site_area_sqm ?? row.area_sqm)}</td>
                    <td className="right" data-label="공시지가(원/㎡)">{formatNumber(row.price_current)}</td>
                    <td className="right" data-label="총 공시지가">{formatNumber(row.estimated_total_price)}</td>
                    <td className="right" data-label="전년 대비 증감률(%)">{formatPercent(row.growth_rate)}</td>
                    <td className="center" data-label="건물연식/노후">{getParcelAgeDisplay(row)}</td>
                    <td className="right" data-label="노후도(%)">{formatPercent(row.aged_building_ratio)}</td>
                    <td className="right" data-label="현재 용적률(%)">{formatPercent(row.floor_area_ratio)}</td>
                    <td className="center" data-label="상세" onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="map-inline-detail-btn" onClick={() => toggleExpanded(row.pnu)}>
                        {expanded ? "닫기" : "열기"}
                      </button>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="map-zone-detail-row">
                      <td colSpan={12}>
                        <div className="map-zone-detail-grid">
                          <div className="map-zone-detail-item">
                            <span>포함 판정</span>
                            <strong>{getInclusionLabel(row)}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>AI 추천</span>
                            <strong>{getAiRecommendationLabel(row)}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>AI 신뢰도</span>
                            <strong>
                              {row.ai_confidence_score === null ? "-" : `${getConfidenceLabel(row.ai_confidence_score)} (${formatPercent(row.ai_confidence_score * 100)})`}
                            </strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>AI 추천 사유</span>
                            <strong>{row.ai_reason_text || "-"}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>이상치 검토</span>
                            <strong>{getAnomalyLabel(row)}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>신뢰도</span>
                            <strong>{getConfidenceLabel(row.confidence_score)} ({formatPercent(row.confidence_score * 100)})</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>교집합 면적(㎡)</span>
                            <strong>{formatArea(row.overlap_area_sqm)}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>중심점 포함</span>
                            <strong>{row.centroid_in ? "Y" : "N"}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>지목</span>
                            <strong>{row.land_category_name || "-"}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>건축물 수</span>
                            <strong>{formatNumber(row.building_count)}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>노후 건물 수</span>
                            <strong>{formatNumber(row.aged_building_count)}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>사용승인년도</span>
                            <strong>{row.average_approval_year || "-"}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>연도</span>
                            <strong>{row.price_year || "-"}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>연면적(㎡)</span>
                            <strong>{formatArea(row.total_floor_area_sqm)}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>건폐율(%)</span>
                            <strong>{formatPercent(row.building_coverage_ratio)}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>세대수/가구수</span>
                            <strong>{row.household_count === null ? "-" : formatNumber(row.household_count)}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>법적 상한 용적률</span>
                            <strong>-</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>잔여 용적률</span>
                            <strong>-</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>건축 데이터 신뢰도</span>
                            <strong>{row.building_confidence || "-"}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>세대수 신뢰도</span>
                            <strong>{row.household_confidence || "-"}</strong>
                          </div>
                          <div className="map-zone-detail-item">
                            <span>용적률 신뢰도</span>
                            <strong>{row.floor_area_ratio_confidence || "-"}</strong>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
