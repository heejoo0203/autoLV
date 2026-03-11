"use client";

import { useState, type ReactNode } from "react";

import { LoadingIndicator } from "@/app/components/ui/loading-indicator";
import type { MapLookupResponse } from "@/app/lib/types";

export type MapQuickSearchOption = {
  label: string;
  query: string;
  caption: string;
};

export function MapFloatingWorkbench({
  collapsed,
  onToggleCollapse,
  compactMode,
  viewMode,
  onModeChange,
  isLoggedIn,
  addressQuery,
  onAddressQueryChange,
  onSearchSubmit,
  addressLoading,
  searchIntentLabel,
  quickSearchOptions,
  onQuickSearch,
  result,
  zoneName,
  onZoneNameChange,
  zonePointCount,
  overlapThreshold,
  onOverlapThresholdChange,
  zoneLoading,
  onZoneAnalyze,
  onUndoZonePoint,
  onClearZonePoints,
  zoneLibraryOpen,
  onToggleZoneLibrary,
  zoneLibrary,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  compactMode: boolean;
  viewMode: "basic" | "zone";
  onModeChange: (mode: "basic" | "zone") => void;
  isLoggedIn: boolean;
  addressQuery: string;
  onAddressQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  addressLoading: boolean;
  searchIntentLabel: string;
  quickSearchOptions: readonly MapQuickSearchOption[];
  onQuickSearch: (query: string) => void;
  result: MapLookupResponse | null;
  zoneName: string;
  onZoneNameChange: (value: string) => void;
  zonePointCount: number;
  overlapThreshold: number;
  onOverlapThresholdChange: (value: number) => void;
  zoneLoading: boolean;
  onZoneAnalyze: () => void;
  onUndoZonePoint: () => void;
  onClearZonePoints: () => void;
  zoneLibraryOpen: boolean;
  onToggleZoneLibrary: () => void;
  zoneLibrary?: ReactNode;
}) {
  const isBasic = viewMode === "basic";
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className={`map-workspace-panel ${collapsed ? "collapsed" : ""}`}>
      <div className="map-workspace-panel-head">
        <div>
          <span className="map-workspace-panel-kicker">{isBasic ? "Parcel Lookup" : "Zone Workspace"}</span>
          <strong>{isBasic ? "필지 조회" : "구역 분석"}</strong>
        </div>
        <button type="button" className="map-workspace-panel-toggle" onClick={onToggleCollapse}>
          {collapsed ? "패널 열기" : "패널 접기"}
        </button>
      </div>

      {collapsed ? null : (
        <>
          <div className="map-mode-segment" role="tablist" aria-label="지도 조회 모드">
            <button type="button" className={`map-mode-segment-btn ${isBasic ? "active" : ""}`} onClick={() => onModeChange("basic")}>
              기본 조회
            </button>
            <button
              type="button"
              className={`map-mode-segment-btn ${!isBasic ? "active" : ""}`}
              onClick={() => onModeChange("zone")}
            >
              구역 조회
            </button>
          </div>

          {isBasic ? (
            <>
              <form
                className="map-floating-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSearchSubmit();
                }}
              >
                <label className="sr-only" htmlFor="map-floating-search-input">
                  주소 또는 지번 또는 PNU 검색
                </label>
                <input
                  id="map-floating-search-input"
                  className="lab-input map-floating-search-input"
                  value={addressQuery}
                  onChange={(event) => onAddressQueryChange(event.target.value)}
                  placeholder="주소, 지번, PNU를 입력하세요"
                />
                <button type="submit" className="lab-btn lab-btn-primary compact" disabled={addressLoading}>
                  {addressLoading ? <LoadingIndicator label="조회 중" kind="dots" /> : "검색"}
                </button>
              </form>

              {compactMode ? (
                <div className="map-search-mini-state">
                  <span>{result ? "현재 선택" : "조회 힌트"}</span>
                  <strong>
                    {result
                      ? result.jibun_address || result.address_summary || result.road_address || "필지 조회 결과"
                      : "주소, 지번, PNU를 입력하거나 지도를 눌러 조회하세요."}
                  </strong>
                </div>
              ) : (
                <div className="map-search-assist-card">
                  <div className="map-search-assist-head">
                    <span>검색 인식</span>
                    <strong>{searchIntentLabel}</strong>
                  </div>
                  <div className="map-search-suggestion-list">
                    {quickSearchOptions.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        className="map-search-suggestion-item"
                        onClick={() => onQuickSearch(option.query)}
                      >
                        <strong>{option.label}</strong>
                        <span>{option.caption}</span>
                      </button>
                    ))}
                  </div>
                  {result ? (
                    <div className="map-search-current-result">
                      <span>현재 선택</span>
                      <strong>{result.jibun_address || result.address_summary || result.road_address || "필지 조회 결과"}</strong>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          ) : isLoggedIn ? (
            <>
              <div className="map-zone-workbench-card">
                <div className="lab-field">
                  <label htmlFor="map-zone-name-input">구역 이름</label>
                  <input
                    id="map-zone-name-input"
                    className="lab-input compact"
                    value={zoneName}
                    onChange={(event) => onZoneNameChange(event.target.value)}
                    placeholder="예: 북창동 검토 구역"
                  />
                </div>
              <div className="map-zone-meta-strip">
                  <span>선택 좌표 {zonePointCount}개</span>
                  <button type="button" className={`lab-chip subtle ${zoneLibraryOpen ? "active" : ""}`} onClick={onToggleZoneLibrary}>
                    저장 구역 {zoneLibraryOpen ? "숨기기" : "보기"}
                  </button>
                </div>
                <div className="map-zone-advanced">
                  <button
                    type="button"
                    className={`lab-chip subtle ${advancedOpen ? "active" : ""}`}
                    onClick={() => setAdvancedOpen((prev) => !prev)}
                  >
                    고급 옵션 {advancedOpen ? "닫기" : "열기"}
                  </button>
                  {advancedOpen ? (
                    <div className="map-zone-advanced-panel">
                      <label className="lab-field">
                        <span>포함 기준</span>
                        <div className="map-threshold-control">
                          <input
                            type="range"
                            min={0.7}
                            max={0.95}
                            step={0.05}
                            value={overlapThreshold}
                            onChange={(event) => onOverlapThresholdChange(Number(event.target.value))}
                          />
                          <strong>{Math.round(overlapThreshold * 100)}%</strong>
                        </div>
                      </label>
                      <p>기본은 보수적 기준입니다. 낮추면 경계 필지가 더 많이 검토 대상으로 들어옵니다.</p>
                    </div>
                  ) : null}
                </div>
                <div className="map-zone-primary-actions">
                  <button type="button" className="lab-btn lab-btn-primary" onClick={onZoneAnalyze} disabled={zoneLoading || zonePointCount < 3}>
                    {zoneLoading ? <LoadingIndicator label="분석 중" kind="dots" /> : compactMode ? "분석 실행" : "구역 분석"}
                  </button>
                  <button type="button" className="lab-btn lab-btn-tertiary" onClick={onUndoZonePoint} disabled={zonePointCount === 0 || zoneLoading}>
                    {compactMode ? "점 되돌리기" : "마지막 점 되돌리기"}
                  </button>
                  <button type="button" className="lab-btn lab-btn-danger" onClick={onClearZonePoints} disabled={zoneLoading}>
                    전체 초기화
                  </button>
                </div>
              </div>
              {zoneLibraryOpen ? zoneLibrary : null}
            </>
          ) : (
            <div className="lab-empty-state compact map-guest-card">
              <strong>구역 분석은 로그인 후 사용할 수 있습니다.</strong>
              <p>비로그인 상태에서는 기본조회만 바로 사용할 수 있습니다.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
