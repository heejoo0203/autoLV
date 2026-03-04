"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/components/auth-provider";
import { BulkJobTable } from "@/app/components/files/bulk-job-table";
import { BulkUploadPanel } from "@/app/components/files/bulk-upload-panel";
import {
  createBulkJob,
  deleteBulkJobs,
  downloadBulkResult,
  downloadBulkTemplate,
  fetchBulkGuide,
  fetchBulkJob,
  fetchBulkJobs,
} from "@/app/lib/bulk-api";
import type { BulkAddressMode, BulkGuide, BulkJob } from "@/app/lib/types";

const POLLING_INTERVAL_MS = 3000;
const PAGE_SIZE = 10;
const ALLOWED_FILE_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

export default function FilesPage() {
  const { user, openAuth } = useAuth();
  const isLoggedIn = Boolean(user);

  const [guide, setGuide] = useState<BulkGuide | null>(null);
  const [jobs, setJobs] = useState<BulkJob[]>([]);
  const [addressMode, setAddressMode] = useState<BulkAddressMode>("auto");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("업로드할 파일을 선택해 주세요.");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const latestJob = useMemo(() => (jobs.length > 0 ? jobs[0] : null), [jobs]);
  const hasRunningJob = useMemo(
    () => jobs.some((job) => job.status === "queued" || job.status === "processing"),
    [jobs]
  );

  const loadGuide = useCallback(async () => {
    try {
      const nextGuide = await fetchBulkGuide();
      setGuide(nextGuide);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "가이드를 불러오지 못했습니다.");
    }
  }, []);

  const loadJobs = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const payload = await fetchBulkJobs(page, PAGE_SIZE);
      setJobs(payload.items);
      setTotalPages(payload.total_pages);
      setSelectedJobIds((prev) => {
        const next = new Set<string>();
        const pageIds = new Set(payload.items.map((item) => item.job_id));
        for (const jobId of prev) {
          if (pageIds.has(jobId)) next.add(jobId);
        }
        return next;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "작업 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, page]);

  useEffect(() => {
    void loadGuide();
  }, [loadGuide]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void loadJobs();
  }, [isLoggedIn, loadJobs]);

  useEffect(() => {
    if (!isLoggedIn || !hasRunningJob) return;
    const timer = window.setInterval(() => {
      void loadJobs();
    }, POLLING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [hasRunningJob, isLoggedIn, loadJobs]);

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage("업로드할 파일을 먼저 선택해 주세요.");
      return;
    }
    setUploading(true);
    try {
      const created = await createBulkJob(selectedFile, addressMode);
      setMessage(`작업이 생성되었습니다. (작업 ID: ${created.job_id})`);
      setSelectedFile(null);
      const job = await fetchBulkJob(created.job_id);
      setJobs((prev) => [job, ...prev.filter((item) => item.job_id !== job.job_id)].slice(0, PAGE_SIZE));
      void loadJobs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "업로드 처리 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const handleSelectFile = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const lowerName = file.name.toLowerCase();
    const hasAllowedExt = ALLOWED_FILE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!hasAllowedExt) {
      setSelectedFile(null);
      setMessage("지원하지 않는 파일 형식입니다. (.xlsx, .xls, .csv)");
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setSelectedFile(null);
      setMessage(`파일 용량이 너무 큽니다. 최대 ${(MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)}MB까지 업로드할 수 있습니다.`);
      return;
    }

    setSelectedFile(file);
    setMessage(`선택된 파일: ${file.name} (${formatFileSize(file.size)})`);
  };

  const handleTemplateDownload = async () => {
    try {
      await downloadBulkTemplate();
      setMessage("표준 양식 다운로드를 시작했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "양식 다운로드에 실패했습니다.");
    }
  };

  const handleResultDownload = async (job: BulkJob) => {
    try {
      await downloadBulkResult(job.job_id, job.file_name);
      setMessage("결과 파일 다운로드를 시작했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "결과 다운로드에 실패했습니다.");
    }
  };

  const handleToggleSelect = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedJobIds(new Set());
      return;
    }
    setSelectedJobIds(new Set(jobs.map((job) => job.job_id)));
  };

  const handleDeleteSelected = async () => {
    if (selectedJobIds.size === 0) {
      setMessage("삭제할 작업을 선택해 주세요.");
      return;
    }
    setDeleting(true);
    try {
      const payload = await deleteBulkJobs(Array.from(selectedJobIds));
      setSelectedJobIds(new Set());
      setMessage(`삭제 완료: ${payload.deleted_count}건, 건너뜀: ${payload.skipped_count}건`);
      if (jobs.length === payload.deleted_count && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        void loadJobs();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "작업 삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <section className="panel">
        <h2>파일 조회</h2>
        <p className="hint">파일 조회는 로그인 후 사용할 수 있습니다.</p>
        <button className="btn-primary" onClick={() => openAuth("login")}>
          로그인하고 파일 조회 사용하기
        </button>
      </section>
    );
  }

  return (
    <>
      <BulkUploadPanel
        guide={guide}
        selectedFileName={selectedFile?.name ?? ""}
        selectedFileSize={selectedFile?.size ?? 0}
        addressMode={addressMode}
        uploading={uploading}
        message={message}
        latestJob={latestJob}
        onSelectFile={handleSelectFile}
        onAddressModeChange={setAddressMode}
        onUpload={() => void handleUpload()}
        onDownloadTemplate={() => void handleTemplateDownload()}
      />
      <BulkJobTable
        jobs={jobs}
        page={page}
        totalPages={totalPages}
        loading={loading}
        deleting={deleting}
        selectedIds={selectedJobIds}
        onRefresh={() => void loadJobs()}
        onDeleteSelected={() => void handleDeleteSelected()}
        onDownload={(job) => void handleResultDownload(job)}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onPageChange={setPage}
      />
    </>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
