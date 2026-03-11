"use client";

import { useState } from "react";

import { MapRowsTable } from "@/app/components/map/map-rows-table";
import { MetricCard } from "@/app/components/map/metric-card";
import { LoadingIndicator } from "@/app/components/ui/loading-indicator";
import { ZoneComparisonCard } from "@/app/components/map/zone-comparison-card";
import { ZoneReviewQueue } from "@/app/components/map/zone-review-queue";
import { ZoneResultTable } from "@/app/components/map/zone-result-table";
import { formatArea, formatNumber, formatRate } from "@/app/lib/map-view-utils";
import type { MapLandDetailsResponse, MapLookupResponse, MapZoneComparisonSummary, MapZoneResponse } from "@/app/lib/types";

export function MapResultDrawer({
  open,
  onToggleOpen,
  viewMode,
  message,
  result,
  landDetails,
  showLandDetails,
  detailLoading,
  yearlyLoading,
  onToggleLandDetails,
  onDownloadCsv,
  onLoadRows,
  onCopyResult,
  zoneResult,
  aiApplicableCount,
  aiPreviewEnabled,
  zoneExcludeLoading,
  zoneSaveLoading,
  zoneComparison,
  zoneComparisonLoading,
  activeZoneParcelPnu,
  deferredZonePnuSet,
  onApplyAi,
  onDisableAi,
  onIncludeSelected,
  onExcludeSelected,
  onSaveZone,
  onPersistZone,
  onDownloadZoneCsv,
  onClearComparison,
  onFocusZoneParcel,
  onIncludeZoneParcel,
  onExcludeZoneParcel,
  onToggleDeferZoneParcel,
  selectedPnuSet,
  onSelectZoneParcel,
  onOpenZoneParcelInBasic,
}: {
  open: boolean;
  onToggleOpen: () => void;
  viewMode: "basic" | "zone";
  message: string;
  result: MapLookupResponse | null;
  landDetails: MapLandDetailsResponse | null;
  showLandDetails: boolean;
  detailLoading: boolean;
  yearlyLoading: boolean;
  onToggleLandDetails: () => void;
  onDownloadCsv: () => void;
  onLoadRows: () => void;
  onCopyResult: () => void;
  zoneResult: MapZoneResponse | null;
  aiApplicableCount: number;
  aiPreviewEnabled: boolean;
  zoneExcludeLoading: boolean;
  zoneSaveLoading: boolean;
  zoneComparison: MapZoneComparisonSummary | null;
  zoneComparisonLoading: boolean;
  activeZoneParcelPnu: string | null;
  deferredZonePnuSet: Set<string>;
  onApplyAi: () => void;
  onDisableAi: () => void;
  onIncludeSelected: () => void;
  onExcludeSelected: () => void;
  onSaveZone: () => void;
  onPersistZone: () => void;
  onDownloadZoneCsv: () => void;
  onClearComparison: () => void;
  onFocusZoneParcel: (parcel: MapZoneResponse["parcels"][number]) => void;
  onIncludeZoneParcel: (pnu: string) => void;
  onExcludeZoneParcel: (pnu: string) => void;
  onToggleDeferZoneParcel: (pnu: string) => void;
  selectedPnuSet: Set<string>;
  onSelectZoneParcel: (pnu: string, checked: boolean) => void;
  onOpenZoneParcelInBasic: (parcel: MapZoneResponse["parcels"][number]) => void;
}) {
  const [tableExpanded, setTableExpanded] = useState(false);
  const hasContent = viewMode === "basic" ? Boolean(result) : Boolean(zoneResult);
  const drawerHandleLabel = open ? "패널 닫기" : "결과 보기";

  return (
    <aside className={`map-result-drawer ${open ? "open" : ""} ${viewMode === "zone" ? "zone-mode" : "basic-mode"}`}>
      <button type="button" className="map-result-drawer-handle" onClick={onToggleOpen}>
        {drawerHandleLabel}
      </button>
      <div className="map-result-drawer-body">
        <div className="map-result-drawer-head">
          <div>
            <span className="map-result-drawer-kicker">{viewMode === "basic" ? "Parcel Sheet" : "Zone Sheet"}</span>
            <h3>{viewMode === "basic" ? "필지 상세" : "구역 분석 결과"}</h3>
          </div>
          <button type="button" className="map-result-drawer-close" onClick={onToggleOpen}>
            닫기
          </button>
        </div>

        <p className="map-status-text">{message}</p>

        {viewMode === "basic" ? (
          !result ? (
            <div className="lab-empty-state compact">
              <strong>아직 선택된 필지가 없습니다.</strong>
              <p>지도를 클릭하거나 검색창에서 주소, 지번, PNU를 입력해 바로 조회해 주세요.</p>
            </div>
          ) : (
            <>
              <div className="map-result-identity-card">
                <span className="map-result-identity-label">선택 필지</span>
                <strong>{result.jibun_address || result.address_summary || "지번 정보 없음"}</strong>
                <p>{result.road_address || "도로명 주소 정보 없음"}</p>
                <code>PNU {result.pnu}</code>
              </div>

              <div className="map-result-action-row">
                <button type="button" className="lab-btn lab-btn-secondary compact" onClick={onCopyResult}>
                  주소 복사
                </button>
                <button type="button" className="lab-btn lab-btn-secondary compact" onClick={onToggleLandDetails} disabled={detailLoading}>
                  {detailLoading ? <LoadingIndicator label="불러오는 중" kind="dots" /> : showLandDetails ? "토지특성 닫기" : "토지특성 열기"}
                </button>
                <button type="button" className="lab-btn lab-btn-tertiary compact" onClick={onLoadRows} disabled={yearlyLoading}>
                  {yearlyLoading ? <LoadingIndicator label="조회 중" kind="dots" /> : "연도별 이력"}
                </button>
                <button type="button" className="lab-btn lab-btn-tertiary compact" onClick={onDownloadCsv}>
                  CSV
                </button>
              </div>

              <div className="map-result-metric-grid">
                <MetricCard label="현재 공시지가(원/㎡)" value={formatNumber(result.price_current)} />
                <MetricCard label="전년 대비" value={formatRate(result.growth_rate)} />
                <MetricCard label="면적(㎡)" value={formatArea(result.area)} />
                <MetricCard label="면적×공시지가(원)" value={formatNumber(result.estimated_total_price)} />
                <MetricCard label={`인근 평균(${result.nearby_radius_m}m)`} value={formatNumber(result.nearby_avg_price)} />
                <MetricCard label="전년도 공시지가(원/㎡)" value={formatNumber(result.price_previous)} />
              </div>

              {showLandDetails && landDetails ? (
                <div className="map-result-section">
                  <div className="map-result-section-head">
                    <strong>토지특성</strong>
                  </div>
                  <div className="map-result-metric-grid compact">
                    <MetricCard label="기준연도" value={landDetails.stdr_year || "-"} />
                    <MetricCard label="지목" value={landDetails.land_category_name || "-"} />
                    <MetricCard label="용도지역" value={landDetails.purpose_area_name || "-"} />
                    <MetricCard label="용도지구" value={landDetails.purpose_district_name || "-"} />
                    <MetricCard label="토지면적(㎡)" value={formatArea(landDetails.area)} />
                  </div>
                </div>
              ) : null}

              <div className="map-result-section">
                <div className="map-result-section-head">
                  <strong>연도별 공시지가</strong>
                </div>
                <MapRowsTable rows={result.rows} cacheHit={result.cache_hit} loading={yearlyLoading} onLoadRows={onLoadRows} />
              </div>
            </>
          )
        ) : !zoneResult ? (
          <div className="lab-empty-state compact">
            <strong>구역 분석 결과가 아직 없습니다.</strong>
            <p>좌측 패널에서 구역을 그린 뒤 분석을 실행하면 포함 필지와 요약 결과가 이 패널에 표시됩니다.</p>
          </div>
        ) : (
          <>
            <div className="map-result-section zone-actions">
              <div className="map-result-section-head">
                <strong>분석 액션</strong>
                <span>{zoneResult.summary.is_saved ? "저장 구역" : "미저장 미리보기"}</span>
              </div>
              <div className="map-zone-ai-toggle drawer">
                <button
                  type="button"
                  className={`lab-filter-chip ${aiPreviewEnabled ? "active" : ""}`}
                  onClick={onApplyAi}
                  disabled={zoneExcludeLoading || aiApplicableCount === 0}
                >
                  AI 추천 적용 {`(${aiApplicableCount})`}
                </button>
                <button
                  type="button"
                  className={`lab-filter-chip ${!aiPreviewEnabled ? "active" : ""}`}
                  onClick={onDisableAi}
                  disabled={zoneExcludeLoading || !aiPreviewEnabled}
                >
                  AI 추천 미적용
                </button>
              </div>
              <div className="map-result-action-row zone">
                {!zoneResult.summary.is_saved ? (
                  <button type="button" className="lab-btn lab-btn-primary compact" onClick={onSaveZone} disabled={zoneSaveLoading}>
                    {zoneSaveLoading ? "저장 중..." : "구역 저장"}
                  </button>
                ) : (
                  <button type="button" className="lab-btn lab-btn-primary compact" onClick={onPersistZone} disabled={zoneSaveLoading}>
                    {zoneSaveLoading ? "저장 중..." : "변경 저장"}
                  </button>
                )}
                <button type="button" className="lab-btn lab-btn-tertiary compact" onClick={onDownloadZoneCsv}>
                  CSV 내보내기
                </button>
                <button type="button" className="lab-btn lab-btn-secondary compact" onClick={() => setTableExpanded(true)}>
                  표 크게 보기
                </button>
              </div>
            </div>
            <ZoneComparisonCard comparison={zoneComparison} loading={zoneComparisonLoading} onClear={onClearComparison} />
            <ZoneReviewQueue
              zoneResult={zoneResult}
              activePnu={activeZoneParcelPnu}
              deferredPnuSet={deferredZonePnuSet}
              onFocusParcel={onFocusZoneParcel}
              onIncludeParcel={onIncludeZoneParcel}
              onExcludeParcel={onExcludeZoneParcel}
              onToggleDeferParcel={onToggleDeferZoneParcel}
            />
            <ZoneResultTable
              zoneResult={zoneResult}
              selectedPnuSet={selectedPnuSet}
              onSelect={onSelectZoneParcel}
              activePnu={activeZoneParcelPnu}
              onFocus={onFocusZoneParcel}
              onOpenBasic={onOpenZoneParcelInBasic}
            />
            {selectedPnuSet.size > 0 ? (
              <div className="zone-selection-dock">
                <strong>{selectedPnuSet.size}개 필지 선택됨</strong>
                <div className="zone-selection-dock-actions">
                  <button
                    type="button"
                    className="lab-btn lab-btn-secondary compact"
                    onClick={onIncludeSelected}
                    disabled={zoneExcludeLoading}
                  >
                    {zoneExcludeLoading ? "처리 중..." : "선택 포함"}
                  </button>
                  <button
                    type="button"
                    className="lab-btn lab-btn-danger compact"
                    onClick={onExcludeSelected}
                    disabled={zoneExcludeLoading}
                  >
                    {zoneExcludeLoading ? "처리 중..." : "선택 삭제"}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
      {viewMode === "zone" && zoneResult && tableExpanded ? (
        <div className="zone-table-modal-overlay" onClick={() => setTableExpanded(false)}>
          <div className="zone-table-modal" onClick={(event) => event.stopPropagation()}>
            <div className="map-result-drawer-head zone-table-modal-head">
              <div>
                <span className="map-result-drawer-kicker">Table View</span>
                <h3>구역 내 필지 목록</h3>
              </div>
              <button type="button" className="map-result-drawer-close" onClick={() => setTableExpanded(false)}>
                닫기
              </button>
            </div>
            <ZoneResultTable
              zoneResult={zoneResult}
              selectedPnuSet={selectedPnuSet}
              onSelect={onSelectZoneParcel}
              activePnu={activeZoneParcelPnu}
              onFocus={onFocusZoneParcel}
              onOpenBasic={onOpenZoneParcelInBasic}
              presentation="table-only"
            />
          </div>
        </div>
      ) : null}
    </aside>
  );
}
