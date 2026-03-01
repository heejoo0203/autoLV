"use client";

import type { BulkJob } from "@/app/lib/types";

type Props = {
  jobs: BulkJob[];
  page: number;
  totalPages: number;
  loading: boolean;
  deleting: boolean;
  selectedIds: Set<string>;
  onRefresh: () => void;
  onDeleteSelected: () => void;
  onDownload: (job: BulkJob) => void;
  onToggleSelect: (jobId: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onPageChange: (page: number) => void;
};

export function BulkJobTable(props: Props) {
  const allSelected = props.jobs.length > 0 && props.jobs.every((job) => props.selectedIds.has(job.job_id));
  const anySelected = props.selectedIds.size > 0;

  return (
    <section className="panel">
      <div className="bulk-table-head">
        <h2>파일 작업 이력</h2>
        <div className="bulk-head-actions">
          <button type="button" className="nav-item" onClick={props.onRefresh} disabled={props.loading || props.deleting}>
            새로고침
          </button>
          <button
            type="button"
            className="nav-item danger"
            onClick={props.onDeleteSelected}
            disabled={!anySelected || props.deleting || props.loading}
          >
            {props.deleting ? "삭제 중..." : "선택 삭제"}
          </button>
        </div>
      </div>
      {props.jobs.length === 0 ? (
        <div className="empty-box">아직 파일 작업 이력이 없습니다.</div>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>파일명</th>
                <th>상태</th>
                <th>행 수</th>
                <th>진행률</th>
                <th>일시</th>
                <th>다운로드</th>
                <th className="checkbox-col">
                  <input
                    type="checkbox"
                    aria-label="현재 페이지 전체 선택"
                    checked={allSelected}
                    onChange={(e) => props.onToggleSelectAll(e.target.checked)}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {props.jobs.map((job) => (
                <tr key={job.job_id}>
                  <td>{job.file_name}</td>
                  <td>
                    <span className={`status-badge ${job.status}`}>{toStatusLabel(job.status)}</span>
                  </td>
                  <td>
                    {job.processed_rows.toLocaleString()} / {job.total_rows.toLocaleString()}
                  </td>
                  <td>{job.progress_percent.toFixed(2)}%</td>
                  <td>{formatDateTime(job.created_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="nav-item"
                      disabled={!job.can_download || props.deleting}
                      onClick={() => props.onDownload(job)}
                    >
                      다운로드
                    </button>
                  </td>
                  <td className="checkbox-col">
                    <input
                      type="checkbox"
                      aria-label={`${job.file_name} 선택`}
                      checked={props.selectedIds.has(job.job_id)}
                      onChange={() => props.onToggleSelect(job.job_id)}
                      disabled={props.deleting || job.status === "processing"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={props.page} totalPages={props.totalPages} onChange={props.onPageChange} />
        </>
      )}
    </section>
  );
}

function Pagination(props: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (props.totalPages <= 1) return null;
  const pages = Array.from({ length: props.totalPages }, (_, idx) => idx + 1);
  return (
    <div className="pagination">
      <button type="button" className="nav-item" disabled={props.page <= 1} onClick={() => props.onChange(props.page - 1)}>
        이전
      </button>
      {pages.map((page) => (
        <button
          type="button"
          key={page}
          className={`nav-item ${page === props.page ? "active" : ""}`}
          onClick={() => props.onChange(page)}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        className="nav-item"
        disabled={props.page >= props.totalPages}
        onClick={() => props.onChange(props.page + 1)}
      >
        다음
      </button>
    </div>
  );
}

function toStatusLabel(status: BulkJob["status"]): string {
  if (status === "queued") return "대기";
  if (status === "processing") return "처리중";
  if (status === "completed") return "완료";
  return "실패";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", { hour12: false });
}
