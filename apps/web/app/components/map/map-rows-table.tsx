"use client";

import type { LandResultRow } from "@/app/lib/types";

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
            {loading ? "조회 중..." : "연도별 공시지가 조회"}
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>가격기준년도</th>
          <th>토지소재지</th>
          <th>지번</th>
          <th>개별공시지가</th>
          <th>기준일자</th>
          <th>공시일자</th>
          <th>비고</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={`${row.토지소재지}-${row.기준년도}-${idx}`}>
            <td>{row.기준년도}</td>
            <td>{row.토지소재지}</td>
            <td>{row.지번}</td>
            <td>{row.개별공시지가}</td>
            <td>{row.기준일자}</td>
            <td>{row.공시일자}</td>
            <td>{row.비고}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
