"use client";

import type { BulkJob } from "@/app/lib/types";

type Props = {
  jobs: BulkJob[];
  hasAnyJobs?: boolean;
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
    <section className="lab-surface">
      <div className="bulk-table-head">
        <div className="lab-section-head compact">
          <h2>파일 작업 이력</h2>
          <p className="table-toolbar-meta">
            현재 결과 {props.jobs.length}건 · 선택 {props.selectedIds.size}건
          </p>
        </div>
        <div className="bulk-head-actions">
          <button
            type="button"
            className="lab-btn lab-btn-tertiary compact"
            onClick={props.onRefresh}
            disabled={props.loading || props.deleting}
          >
            새로고침
          </button>
          <button
            type="button"
            className="lab-btn lab-btn-danger compact"
            onClick={props.onDeleteSelected}
            disabled={!anySelected || props.deleting || props.loading}
          >
            {props.deleting ? "삭제 중..." : "선택 삭제"}
          </button>
        </div>
      </div>
      {props.jobs.length > 0 ? (
        <div className="table-mobile-controls" aria-label="모바일 선택 도구">
          <p className="table-toolbar-meta">카드 목록에서는 여기서 현재 결과 전체 선택을 제어합니다.</p>
          <div className="bulk-head-actions">
            <button
              type="button"
              className="lab-btn lab-btn-tertiary compact"
              onClick={() => props.onToggleSelectAll(true)}
              disabled={allSelected || props.loading || props.deleting}
            >
              현재 결과 전체 선택
            </button>
            <button
              type="button"
              className="lab-btn lab-btn-tertiary compact"
              onClick={() => props.onToggleSelectAll(false)}
              disabled={!anySelected || props.loading || props.deleting}
            >
              선택 해제
            </button>
          </div>
        </div>
      ) : null}
      {props.jobs.length === 0 ? (
        <div className="empty-box">{props.hasAnyJobs ? "선택한 상태에 해당하는 작업이 없습니다." : "아직 파일 작업 이력이 없습니다."}</div>
      ) : (
        <>
          <table className="data-table bulk-center-table mobile-card-table">
            <thead>
              <tr>
                <th>파일명</th>
                <th>상태</th>
                <th>행 수</th>
                <th>진행률</th>
                <th>조회시작 일시</th>
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
                  <td data-label="파일명">{job.file_name}</td>
                  <td data-label="상태">
                    <span className={`status-badge ${job.status}`}>{toStatusLabel(job.status)}</span>
                    {job.error_message ? <BulkJobDiagnosis message={job.error_message} /> : null}
                  </td>
                  <td data-label="행 수">
                    {job.processed_rows.toLocaleString()} / {job.total_rows.toLocaleString()}
                  </td>
                  <td data-label="진행률">{job.progress_percent.toFixed(2)}%</td>
                  <td data-label="조회시작 일시">{formatDateTime(job.created_at)}</td>
                  <td data-label="다운로드">
                    {job.can_download ? (
                      <button
                        type="button"
                        className="lab-btn lab-btn-secondary compact"
                        disabled={props.deleting}
                        onClick={() => props.onDownload(job)}
                      >
                        다운로드
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="checkbox-col" data-label="선택">
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

function BulkJobDiagnosis({ message }: { message: string }) {
  const diagnosis = diagnoseBulkError(message);
  return (
    <div className="bulk-job-diagnosis">
      <p>{diagnosis.summary}</p>
      <span>{diagnosis.action}</span>
    </div>
  );
}

function Pagination(props: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (props.totalPages <= 1) return null;
  const pages = buildPaginationItems(props.page, props.totalPages);
  return (
    <div className="pagination-wrap">
      <p className="pagination-status">
        {props.page} / {props.totalPages} 페이지
      </p>
      <div className="pagination">
        <button
          type="button"
          className="lab-btn lab-btn-tertiary compact"
          disabled={props.page <= 1}
          onClick={() => props.onChange(props.page - 1)}
        >
          이전
        </button>
        {pages.map((page, index) =>
          typeof page === "number" ? (
            <button
              type="button"
              key={page}
              className={`lab-btn compact ${page === props.page ? "lab-btn-secondary" : "lab-btn-tertiary"}`}
              onClick={() => props.onChange(page)}
            >
              {page}
            </button>
          ) : (
            <span key={`${page}-${index}`} className="pagination-ellipsis" aria-hidden>
              ...
            </span>
          ),
        )}
        <button
          type="button"
          className="lab-btn lab-btn-tertiary compact"
          disabled={props.page >= props.totalPages}
          onClick={() => props.onChange(props.page + 1)}
        >
          다음
        </button>
      </div>
    </div>
  );
}

function buildPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | "ellipsis"> = [1];
  let start = Math.max(2, currentPage - 1);
  let end = Math.min(totalPages - 1, currentPage + 1);

  if (currentPage <= 3) {
    end = 4;
  }
  if (currentPage >= totalPages - 2) {
    start = totalPages - 3;
  }

  if (start > 2) {
    items.push("ellipsis");
  }

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (end < totalPages - 1) {
    items.push("ellipsis");
  }

  items.push(totalPages);
  return items;
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

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"] as const;
  const weekday = weekdays[date.getDay()];

  const hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const ampm = hour < 12 ? "am" : "pm";
  const hour12 = hour % 12 || 12;

  return `${year}.${month}.${day}(${weekday}) ${hour12}:${minute} ${ampm}`;
}

function diagnoseBulkError(message: string): { summary: string; action: string } {
  const normalized = message.toLowerCase();
  if (normalized.includes("duplicate") || normalized.includes("중복")) {
    return {
      summary: "중복 주소 또는 중복 행이 포함된 작업입니다.",
      action: "중복 행을 정리한 뒤 같은 파일을 다시 업로드하는 것이 좋습니다.",
    };
  }
  if (normalized.includes("address") || normalized.includes("주소")) {
    return {
      summary: "주소 형식 또는 필수 주소 요소 누락이 감지됐습니다.",
      action: "지번/도로명 열 이름과 본번·부번 누락 여부를 먼저 확인해 주세요.",
    };
  }
  if (normalized.includes("pnu")) {
    return {
      summary: "PNU 변환 단계에서 해석되지 않은 행이 많습니다.",
      action: "주소 모드를 자동 대신 지번 또는 도로명으로 고정해 다시 시도해 보세요.",
    };
  }
  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return {
      summary: "외부 API 응답 지연으로 작업이 중단됐습니다.",
      action: "잠시 후 다시 업로드하면 정상 처리되는 경우가 많습니다.",
    };
  }
  if (normalized.includes("vworld") || normalized.includes("api")) {
    return {
      summary: "외부 연동 응답 오류입니다.",
      action: "즉시 재시도보다 몇 분 후 다시 업로드하는 편이 안전합니다.",
    };
  }
  if (normalized.includes("xlsx") || normalized.includes("csv") || normalized.includes("excel")) {
    return {
      summary: "파일 형식 또는 읽기 가능한 시트 구조를 확인해 주세요.",
      action: "표준 양식으로 다시 저장하거나 첫 번째 시트 구조를 단순하게 정리해 주세요.",
    };
  }
  return {
    summary: "실패 원인을 재검토해야 하는 작업입니다.",
    action: "작업 파일과 열 구성을 다시 확인한 뒤 재업로드를 권장합니다.",
  };
}
