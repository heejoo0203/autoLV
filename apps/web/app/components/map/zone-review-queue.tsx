"use client";

import { useMemo, useState } from "react";

import { formatArea, formatNumber } from "@/app/lib/map-view-utils";
import type { MapZoneResponse } from "@/app/lib/types";

type ParcelItem = MapZoneResponse["parcels"][number];

type ReviewBucket = "anomaly" | "conflict" | "boundary" | "ai" | "deferred";

type ReviewItem = {
  parcel: ParcelItem;
  bucket: ReviewBucket;
  priority: number;
  title: string;
  reason: string;
};

type ReviewFilter = "all" | ReviewBucket;

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;
}

function buildDecisionExplanation(parcel: ParcelItem): string {
  const overlapText = `${Math.round((parcel.overlap_ratio ?? 0) * 100)}%`;
  if (parcel.anomaly_level && parcel.anomaly_level !== "none") {
    return `이 필지는 이상치 검토 대상으로 분류되었습니다. 겹침률은 ${overlapText}이며, 원문값과 주변 패턴 차이를 함께 확인해야 합니다.`;
  }
  if (
    (parcel.included && parcel.ai_recommendation === "excluded") ||
    (!parcel.included && parcel.ai_recommendation === "included")
  ) {
    return `규칙 판정과 AI 보조 판정이 다릅니다. 현재 규칙 기준은 ${parcel.included ? "포함" : "제외"}이고, AI는 ${parcel.ai_recommendation === "included" ? "포함" : "제외"}을 추천합니다.`;
  }
  if (parcel.inclusion_mode === "boundary_candidate") {
    return `경계 필지입니다. 겹침률 ${overlapText}, 중심점 ${parcel.centroid_in ? "포함" : "미포함"} 상태라 수동 검토가 필요합니다.`;
  }
  if (parcel.ai_recommendation === "uncertain") {
    return `AI가 확정하지 못한 필지입니다. 겹침률 ${overlapText}와 주변 연속성을 함께 보는 것이 좋습니다.`;
  }
  if (parcel.included) {
    return `현재는 포함으로 반영됩니다. 겹침률 ${overlapText}와 규칙 점수가 기준 이상입니다.`;
  }
  return `현재는 제외 상태입니다. 겹침률 ${overlapText}가 낮거나 보조 판정 신뢰도가 충분하지 않습니다.`;
}

function buildReviewItems(parcels: ParcelItem[], deferredPnuSet: Set<string>): ReviewItem[] {
  return parcels
    .map((parcel) => {
      if (deferredPnuSet.has(parcel.pnu)) {
        return {
          parcel,
          bucket: "deferred" as const,
          priority: 5,
          title: "보류 중",
          reason: "사용자가 검토를 보류한 필지입니다.",
        };
      }
      if (parcel.anomaly_level && parcel.anomaly_level !== "none") {
        return {
          parcel,
          bucket: "anomaly" as const,
          priority: parcel.anomaly_level === "critical" ? 1 : 2,
          title: "이상치 검토",
          reason: "공시지가, 건축값 또는 좌표 품질에 재검토가 필요합니다.",
        };
      }
      const hasAiConflict =
        (parcel.included && parcel.ai_recommendation === "excluded") ||
        (!parcel.included && parcel.ai_recommendation === "included");
      if (hasAiConflict) {
        return {
          parcel,
          bucket: "conflict" as const,
          priority: 3,
          title: "판정 충돌",
          reason: "규칙 기반 판정과 AI 추천이 서로 다릅니다.",
        };
      }
      if (parcel.inclusion_mode === "boundary_candidate") {
        return {
          parcel,
          bucket: "boundary" as const,
          priority: 4,
          title: "경계 후보",
          reason: "구역 경계에 걸친 필지라 수동 검토가 필요합니다.",
        };
      }
      if (parcel.ai_recommendation === "uncertain") {
        return {
          parcel,
          bucket: "ai" as const,
          priority: 6,
          title: "AI 검토 필요",
          reason: "AI가 확정하지 못한 필지입니다.",
        };
      }
      return null;
    })
    .filter((item): item is ReviewItem => Boolean(item))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.parcel.confidence_score !== b.parcel.confidence_score) {
        return a.parcel.confidence_score - b.parcel.confidence_score;
      }
      return b.parcel.overlap_ratio - a.parcel.overlap_ratio;
    });
}

function getBucketLabel(bucket: ReviewBucket): string {
  if (bucket === "anomaly") return "이상치";
  if (bucket === "conflict") return "충돌";
  if (bucket === "boundary") return "경계";
  if (bucket === "ai") return "AI";
  return "보류";
}

function getBucketTone(bucket: ReviewBucket): string {
  if (bucket === "anomaly") return "danger";
  if (bucket === "conflict") return "warning";
  if (bucket === "boundary") return "warning";
  if (bucket === "ai") return "neutral";
  return "subtle";
}

export function ZoneReviewQueue({
  zoneResult,
  activePnu,
  deferredPnuSet,
  onFocusParcel,
  onIncludeParcel,
  onExcludeParcel,
  onToggleDeferParcel,
}: {
  zoneResult: MapZoneResponse | null;
  activePnu: string | null;
  deferredPnuSet: Set<string>;
  onFocusParcel: (parcel: ParcelItem) => void;
  onIncludeParcel: (pnu: string) => void;
  onExcludeParcel: (pnu: string) => void;
  onToggleDeferParcel: (pnu: string) => void;
}) {
  if (!zoneResult) return null;

  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [showAllItems, setShowAllItems] = useState(false);

  const reviewItems = useMemo(() => buildReviewItems(zoneResult.parcels, deferredPnuSet), [zoneResult.parcels, deferredPnuSet]);
  const reviewCounts = useMemo(
    () => ({
      all: reviewItems.length,
      anomaly: reviewItems.filter((item) => item.bucket === "anomaly").length,
      conflict: reviewItems.filter((item) => item.bucket === "conflict").length,
      boundary: reviewItems.filter((item) => item.bucket === "boundary").length,
      ai: reviewItems.filter((item) => item.bucket === "ai").length,
      deferred: reviewItems.filter((item) => item.bucket === "deferred").length,
    }),
    [reviewItems],
  );
  const filteredItems =
    reviewFilter === "all" ? reviewItems : reviewItems.filter((item) => item.bucket === reviewFilter);
  const visibleItems = showAllItems ? filteredItems : filteredItems.slice(0, 6);
  const activeParcel =
    zoneResult.parcels.find((item) => item.pnu === activePnu) ??
    filteredItems.at(0)?.parcel ??
    reviewItems.at(0)?.parcel ??
    null;

  return (
    <section className="map-result-section zone-review-section">
      <div className="map-result-section-head">
        <strong>검토 큐</strong>
        <span>{formatNumber(reviewItems.length)}건</span>
      </div>
      <div className="map-zone-filter-row compact">
        <button
          type="button"
          className={`lab-filter-chip ${reviewFilter === "all" ? "active" : ""}`}
          onClick={() => setReviewFilter("all")}
        >
          전체 {formatNumber(reviewCounts.all)}
        </button>
        <button
          type="button"
          className={`lab-filter-chip ${reviewFilter === "boundary" ? "active" : ""}`}
          onClick={() => setReviewFilter("boundary")}
        >
          경계 후보 {formatNumber(reviewCounts.boundary)}
        </button>
        <button
          type="button"
          className={`lab-filter-chip ${reviewFilter === "conflict" ? "active" : ""}`}
          onClick={() => setReviewFilter("conflict")}
        >
          AI 충돌 {formatNumber(reviewCounts.conflict)}
        </button>
        <button
          type="button"
          className={`lab-filter-chip ${reviewFilter === "anomaly" ? "active" : ""}`}
          onClick={() => setReviewFilter("anomaly")}
        >
          이상치 {formatNumber(reviewCounts.anomaly)}
        </button>
        <button
          type="button"
          className={`lab-filter-chip ${reviewFilter === "deferred" ? "active" : ""}`}
          onClick={() => setReviewFilter("deferred")}
        >
          보류 {formatNumber(reviewCounts.deferred)}
        </button>
      </div>

      {filteredItems.length === 0 ? (
        <div className="lab-empty-state compact">
          <strong>{reviewFilter === "all" ? "지금 바로 검토가 필요한 필지가 없습니다." : "선택한 조건의 검토 대상이 없습니다."}</strong>
          <p>필터를 바꾸거나 확정 포함/제외 판정만으로 현재 결과를 검토할 수 있습니다.</p>
        </div>
      ) : (
        <>
          <div className="zone-review-list">
          {visibleItems.map((item) => (
            <button
              key={item.parcel.pnu}
              type="button"
              className={`zone-review-card ${activeParcel?.pnu === item.parcel.pnu ? "active" : ""}`}
              onClick={() => onFocusParcel(item.parcel)}
            >
              <div className="zone-review-card-head">
                <strong>{item.parcel.jibun_address || item.parcel.pnu}</strong>
                <span className={`lab-inline-pill ${getBucketTone(item.bucket)}`}>{getBucketLabel(item.bucket)}</span>
              </div>
              <p>{item.reason}</p>
              <div className="zone-review-card-meta">
                <span>겹침률 {formatPercent(item.parcel.overlap_ratio * 100)}</span>
                <span>신뢰도 {formatPercent(item.parcel.confidence_score * 100)}</span>
                <span>AI {item.parcel.ai_recommendation || "-"}</span>
              </div>
              <div className="zone-review-card-actions" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="lab-chip active" onClick={() => onIncludeParcel(item.parcel.pnu)}>
                  포함 확정
                </button>
                <button type="button" className="lab-chip danger" onClick={() => onExcludeParcel(item.parcel.pnu)}>
                  제외 확정
                </button>
                <button
                  type="button"
                  className={`lab-chip subtle ${deferredPnuSet.has(item.parcel.pnu) ? "active" : ""}`}
                  onClick={() => onToggleDeferParcel(item.parcel.pnu)}
                >
                  {deferredPnuSet.has(item.parcel.pnu) ? "보류 해제" : "보류"}
                </button>
              </div>
            </button>
          ))}
          </div>
          {filteredItems.length > visibleItems.length ? (
            <div className="map-result-action-row">
              <button
                type="button"
                className="lab-btn lab-btn-tertiary compact"
                onClick={() => setShowAllItems((prev) => !prev)}
              >
                {showAllItems ? "검토 큐 접기" : `검토 큐 더 보기 (${formatNumber(filteredItems.length - visibleItems.length)})`}
              </button>
            </div>
          ) : null}
        </>
      )}

      {activeParcel ? (
        <div className="zone-decision-explainer">
          <div className="map-result-section-head">
            <strong>선택 필지 설명</strong>
            <span>{activeParcel.jibun_address || activeParcel.pnu}</span>
          </div>
          <p>{buildDecisionExplanation(activeParcel)}</p>
          <details className="zone-decision-details" open>
            <summary>판정 근거 상세</summary>
            <div className="map-result-metric-grid compact">
              <div className="map-zone-detail-item">
                <span>포함 방식</span>
                <strong>{activeParcel.inclusion_mode}</strong>
              </div>
              <div className="map-zone-detail-item">
                <span>겹침률</span>
                <strong>{formatPercent(activeParcel.overlap_ratio * 100)}</strong>
              </div>
              <div className="map-zone-detail-item">
                <span>교집합 면적</span>
                <strong>{formatArea(activeParcel.overlap_area_sqm)}</strong>
              </div>
              <div className="map-zone-detail-item">
                <span>중심점 포함</span>
                <strong>{activeParcel.centroid_in ? "예" : "아니오"}</strong>
              </div>
              <div className="map-zone-detail-item">
                <span>규칙 신뢰도</span>
                <strong>{formatPercent(activeParcel.confidence_score * 100)}</strong>
              </div>
              <div className="map-zone-detail-item">
                <span>AI 추천</span>
                <strong>
                  {activeParcel.ai_recommendation || "-"}
                  {activeParcel.ai_confidence_score !== null
                    ? ` · ${formatPercent(activeParcel.ai_confidence_score * 100)}`
                    : ""}
                </strong>
              </div>
              <div className="map-zone-detail-item">
                <span>이상치 수준</span>
                <strong>{activeParcel.anomaly_level || "none"}</strong>
              </div>
              <div className="map-zone-detail-item">
                <span>판정 출처</span>
                <strong>{activeParcel.selection_origin}</strong>
              </div>
            </div>
          </details>
        </div>
      ) : null}
    </section>
  );
}
