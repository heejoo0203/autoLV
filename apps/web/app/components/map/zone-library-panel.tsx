"use client";

import { formatDateTime, formatNumber } from "@/app/lib/map-view-utils";
import type { MapZoneListItem } from "@/app/lib/types";

export function ZoneLibraryPanel({
  open,
  loading,
  items,
  activeZoneId,
  busyZoneId,
  onSelect,
  onRename,
  onDelete,
}: {
  open: boolean;
  loading: boolean;
  items: MapZoneListItem[];
  activeZoneId: string | null;
  busyZoneId: string | null;
  onSelect: (item: MapZoneListItem) => void;
  onRename: (item: MapZoneListItem) => void;
  onDelete: (item: MapZoneListItem) => void;
}) {
  return (
    <div className={`map-zone-library ${open ? "open" : ""}`}>
      <div className="map-zone-library-head">
        <h3>저장된 구역</h3>
        <span>{items.length}건</span>
      </div>
      {loading ? <div className="map-zone-library-empty">목록을 불러오는 중입니다...</div> : null}
      {!loading && items.length === 0 ? <div className="map-zone-library-empty">저장된 구역이 없습니다.</div> : null}
      {!loading && items.length > 0 ? (
        <div className="map-zone-library-list">
          {items.map((item) => {
            const busy = busyZoneId === item.zone_id;
            return (
              <div
                key={item.zone_id}
                className={`map-zone-library-item ${activeZoneId === item.zone_id ? "active" : ""}`}
                onClick={() => {
                  if (!busy) onSelect(item);
                }}
              >
                <div className="map-zone-library-title-row">
                  <strong>{item.zone_name}</strong>
                  <span>{item.base_year || "-"}</span>
                </div>
                <div className="map-zone-library-meta">
                  <span>필지 {formatNumber(item.parcel_count)}</span>
                  <span>{formatDateTime(item.updated_at)}</span>
                </div>
                <div className="map-zone-library-meta">
                  <span>총합 {formatNumber(item.assessed_total_price)}원</span>
                </div>
                <div className="map-zone-library-actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="map-zone-mini-btn" disabled={busy} onClick={() => onRename(item)}>
                    이름 수정
                  </button>
                  <button type="button" className="map-zone-mini-btn danger" disabled={busy} onClick={() => onDelete(item)}>
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
