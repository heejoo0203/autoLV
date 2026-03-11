"use client";

import { useState } from "react";

export function MapWorkspaceToolbar({
  showDistrictOverlay,
  onToggleDistrictOverlay,
  onMoveToCurrentLocation,
  onResetView,
  onToggleFullscreen,
  isFullscreen,
  compactMode,
}: {
  showDistrictOverlay: boolean;
  onToggleDistrictOverlay: () => void;
  onMoveToCurrentLocation: () => void;
  onResetView: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  compactMode: boolean;
}) {
  const [compactOpen, setCompactOpen] = useState(false);
  const actions = [
    {
      label: showDistrictOverlay ? "지적도 끄기" : "지적도 켜기",
      className: `lab-float-btn ${showDistrictOverlay ? "active" : ""}`,
      onClick: onToggleDistrictOverlay,
    },
    {
      label: "현재 위치",
      className: "lab-float-btn",
      onClick: onMoveToCurrentLocation,
    },
    {
      label: "시야 초기화",
      className: "lab-float-btn",
      onClick: onResetView,
    },
    {
      label: isFullscreen ? "전체화면 종료" : "전체화면",
      className: "lab-float-btn map-toolbar-btn-fixed",
      onClick: onToggleFullscreen,
    },
  ];

  if (compactMode) {
    return (
      <div className={`map-toolbar-cluster compact ${compactOpen ? "open" : ""}`}>
        {compactOpen ? (
          <div className="map-toolbar-popover">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={action.className}
                onClick={() => {
                  action.onClick();
                  setCompactOpen(false);
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className={`lab-float-btn map-toolbar-toggle ${compactOpen ? "active" : ""}`}
          onClick={() => setCompactOpen((prev) => !prev)}
        >
          {compactOpen ? "도구 닫기" : "도구"}
        </button>
      </div>
    );
  }

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
        <button type="button" className="lab-float-btn map-toolbar-btn-fixed" onClick={onToggleFullscreen}>
          {isFullscreen ? "전체화면 종료" : "전체화면"}
        </button>
      </div>
    </div>
  );
}
