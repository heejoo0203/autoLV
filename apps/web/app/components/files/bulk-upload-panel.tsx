"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";

import type { BulkAddressMode, BulkGuide, BulkJob } from "@/app/lib/types";

type Props = {
  guide: BulkGuide | null;
  selectedFileName: string;
  addressMode: BulkAddressMode;
  uploading: boolean;
  message: string;
  latestJob: BulkJob | null;
  onSelectFile: (file: File | null) => void;
  onAddressModeChange: (mode: BulkAddressMode) => void;
  onUpload: () => void;
  onDownloadTemplate: () => void;
};

export function BulkUploadPanel(props: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const rowsLimitText = props.guide ? `최대 ${props.guide.max_rows.toLocaleString()}행` : "최대 10,000행";

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const file = event.dataTransfer.files?.[0] ?? null;
    props.onSelectFile(file);
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLLabelElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker();
    }
  };

  return (
    <section className="panel">
      <h2>파일 조회</h2>

      <div className="bulk-guide-grid">
        <div className="bulk-guide-card">
          <h3>표준 양식 안내</h3>
          <p>권장 컬럼을 사용하면 정확도가 높아집니다. 열 순서가 달라도 자동 매핑됩니다.</p>
          <p className="guide-row">
            <strong>공통:</strong> 주소유형(지번/도로명)
          </p>
          <p className="guide-row">
            <strong>지번 권장:</strong> {props.guide?.recommended_jibun.join(", ") ?? "시도, 시군구, 읍면동, 산구분, 본번, 부번"}
          </p>
          <p className="guide-row">
            <strong>도로명 권장:</strong> {props.guide?.recommended_road.join(", ") ?? "시도, 시군구, 도로명, 건물본번, 건물부번"}
          </p>
          <p className="guide-row hint">{rowsLimitText}</p>
          <button type="button" className="nav-item" onClick={props.onDownloadTemplate}>
            표준 양식 다운로드
          </button>
        </div>

        <div className="task-box">
          <h3>작업 상태</h3>
          {!props.latestJob ? (
            <p>최근 작업이 없습니다.</p>
          ) : (
            <div className="task-status-list">
              <p>상태: {toStatusLabel(props.latestJob.status)}</p>
              <p>
                진행: {props.latestJob.processed_rows.toLocaleString()} / {props.latestJob.total_rows.toLocaleString()}행 (
                {props.latestJob.progress_percent.toFixed(2)}%)
              </p>
              <p>
                성공: {props.latestJob.success_rows.toLocaleString()} / 실패: {props.latestJob.failed_rows.toLocaleString()}
              </p>
              {props.latestJob.error_message ? <p className="error-text">오류: {props.latestJob.error_message}</p> : null}
            </div>
          )}
        </div>
      </div>

      <div className="file-grid">
        <label
          className={`dropzone file-picker ${isDragOver ? "drag-over" : ""}`}
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={handleKeyDown}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => props.onSelectFile(e.target.files?.[0] ?? null)}
            hidden
          />
          <span>{props.selectedFileName || "엑셀 파일 Drag & Drop 또는 클릭 업로드 (.xlsx/.xls/.csv)"}</span>
        </label>

        <div className="bulk-actions">
          <label className="field-label" htmlFor="address-mode">
            지번/도로명
          </label>
          <select
            id="address-mode"
            className="mini-select"
            value={props.addressMode}
            onChange={(e) => props.onAddressModeChange(e.target.value as BulkAddressMode)}
          >
            <option value="auto">자동</option>
            <option value="jibun">지번</option>
            <option value="road">도로명</option>
          </select>
          <button type="button" className="btn-primary full" disabled={props.uploading} onClick={props.onUpload}>
            {props.uploading ? "조회 중..." : "조회"}
          </button>
        </div>
      </div>

      <p className="hint">{props.message}</p>
    </section>
  );
}

function toStatusLabel(status: BulkJob["status"]): string {
  if (status === "queued") return "대기";
  if (status === "processing") return "처리중";
  if (status === "completed") return "완료";
  return "실패";
}
