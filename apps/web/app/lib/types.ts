export type AuthMode = "login" | "register";

export type AuthUser = {
  id?: string;
  user_id?: string;
  email: string;
  full_name?: string | null;
};

export type SearchTab = "지번" | "도로명";

export type LdMap = Record<string, Record<string, Record<string, string>>>;

export type LandResultRow = {
  기준년도: string;
  토지소재지: string;
  지번: string;
  개별공시지가: string;
  기준일자: string;
  공시일자: string;
  비고: string;
};

export type SearchHistoryRecord = {
  id: string;
  ownerKey: string;
  시각: string;
  유형: SearchTab;
  주소요약: string;
  결과: LandResultRow[];
};

export type BulkAddressMode = "auto" | "jibun" | "road";

export type BulkJobStatus = "queued" | "processing" | "completed" | "failed";

export type BulkGuide = {
  max_rows: number;
  required_common: string[];
  recommended_jibun: string[];
  recommended_road: string[];
  alias_examples: Record<string, string[]>;
};

export type BulkJob = {
  job_id: string;
  file_name: string;
  status: BulkJobStatus;
  total_rows: number;
  processed_rows: number;
  success_rows: number;
  failed_rows: number;
  progress_percent: number;
  created_at: string;
  updated_at: string;
  error_message?: string | null;
  can_download: boolean;
};

export type BulkJobListResponse = {
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
  items: BulkJob[];
};

export type BulkJobCreateResponse = {
  job_id: string;
  status: BulkJobStatus;
  total_rows: number;
  created_at: string;
};

export type BulkDeleteResponse = {
  deleted_count: number;
  skipped_count: number;
  deleted_job_ids: string[];
  skipped_job_ids: string[];
};
