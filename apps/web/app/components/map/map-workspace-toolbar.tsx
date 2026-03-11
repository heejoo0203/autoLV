"use client";

export function MapWorkspaceToolbar({
  showDistrictOverlay,
  onToggleDistrictOverlay,
  onMoveToCurrentLocation,
  onResetView,
  onToggleFullscreen,
  isFullscreen,
  viewMode,
  zoneLibraryOpen,
  onToggleZoneLibrary,
  onClearZonePoints,
}: {
  showDistrictOverlay: boolean;
  onToggleDistrictOverlay: () => void;
  onMoveToCurrentLocation: () => void;
  onResetView: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  viewMode: "basic" | "zone";
  zoneLibraryOpen: boolean;
  onToggleZoneLibrary: () => void;
  onClearZonePoints: () => void;
}) {
  return (
    <div className="map-toolbar-cluster">
      <div className="map-toolbar-group">
        <button type="button" className={`lab-float-btn ${showDistrictOverlay ? "active" : ""}`} onClick={onToggleDistrictOverlay}>
          지적도
        </button>
        <button type="button" className="lab-float-btn" onClick={onMoveToCurrentLocation}>
          현재 위치
        </button>
        <button type="button" className="lab-float-btn" onClick={onResetView}>
          시야 초기화
        </button>
      </div>
      <div className="map-toolbar-group">
        {viewMode === "zone" ? (
          <>
            <button type="button" className={`lab-float-btn ${zoneLibraryOpen ? "active" : ""}`} onClick={onToggleZoneLibrary}>
              저장 구역
            </button>
            <button type="button" className="lab-float-btn danger" onClick={onClearZonePoints}>
              구역 초기화
            </button>
          </>
        ) : null}
        <button type="button" className="lab-float-btn map-toolbar-btn-fixed" onClick={onToggleFullscreen}>
          {isFullscreen ? "전체화면 종료" : "전체화면"}
        </button>
      </div>
    </div>
  );
}
