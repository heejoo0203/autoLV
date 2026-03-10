"use client";

import { LoadingIndicator } from "@/app/components/ui/loading-indicator";
import type { LandResultRow } from "@/app/lib/types";

function formatBaseDate(value: string | null | undefined): string {
  if (!value) return "-";
  const trimmed = value.trim();
  const match = trimmed.match(/^0?(\d{1,2})월\s*0?(\d{1,2})일$/);
  if (match) {
    return `${Number(match[1])}/${Number(match[2])}`;
  }
  return trimmed;
}

export function MapRowsTable({
  rows,
  cacheHit,
  loading,
  onLoadRows,
}: {
  rows: LandResultRow[];
  cacheHit: boolean;
  loading: boolean;
  onLoadRows: () => void;
}) {
  if (!rows.length) {
    return (
      <div className="map-empty">
        <p className="map-empty-text">
          {cacheHit ? "캐시 데이터에는 연도별 상세가 저장되지 않았습니다." : "연도별 상세 데이터가 없습니다."}
        </p>
        {cacheHit ? (
          <button type="button" className="map-inline-action" onClick={onLoadRows} disabled={loading}>
            {loading ? <LoadingIndicator label="조회 중" kind="dots" /> : "연도별 공시지가 조회"}
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <table className="data-table map-yearly-table mobile-card-table">
      <colgroup>
        <col style={{ width: "20%" }} />
        <col style={{ width: "34%" }} />
        <col style={{ width: "16%" }} />
        <col style={{ width: "30%" }} />
      </colgroup>
      <thead>
        <tr>
          <th>가격기준년도</th>
          <th>개별공시지가</th>
          <th>기준일자</th>
          <th>공시일자</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={`${row.토지소재지}-${row.기준년도}-${idx}`}>
            <td data-label="가격기준년도">{row.기준년도}</td>
            <td data-label="개별공시지가">{row.개별공시지가}</td>
            <td data-label="기준일자">{formatBaseDate(row.기준일자)}</td>
            <td data-label="공시일자">{row.공시일자}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
