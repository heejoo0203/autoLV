export type AuthMode = "login" | "register";

export type AuthUser = {
  id?: string;
  user_id?: string;
  email: string;
  full_name?: string | null;
  phone_number?: string | null;
  role?: string;
  auth_provider?: string;
  profile_image_url?: string | null;
};

export type UserTerms = {
  version: string;
  content: string;
  accepted_at: string | null;
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

export type SearchHistoryLog = {
  id: string;
  search_type: "jibun" | "road" | "map";
  pnu: string;
  address_summary: string;
  result_count: number;
  created_at: string;
};

export type SearchHistoryLogDetail = SearchHistoryLog & {
  rows: LandResultRow[];
};

export type SearchHistoryLogListResponse = {
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
  items: SearchHistoryLog[];
};

export type SearchHistoryDeleteResponse = {
  deleted_count: number;
  skipped_count: number;
  deleted_log_ids: string[];
  skipped_log_ids: string[];
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

export type MapLookupResponse = {
  lat: number;
  lng: number;
  pnu: string;
  address_summary: string;
  jibun_address: string;
  road_address: string;
  area: number | null;
  price_current: number | null;
  price_previous: number | null;
  growth_rate: number | null;
  estimated_total_price: number | null;
  nearby_avg_price: number | null;
  nearby_radius_m: number;
  cache_hit: boolean;
  rows: LandResultRow[];
};

export type MapPriceRowsResponse = {
  pnu: string;
  rows: LandResultRow[];
};

export type MapLandDetailsResponse = {
  pnu: string;
  stdr_year: string | null;
  area: number | null;
  land_category_name: string | null;
  purpose_area_name: string | null;
  purpose_district_name: string | null;
};

export type MapZoneCoordinate = {
  lat: number;
  lng: number;
};

export type MapZoneParcelItem = {
  pnu: string;
  jibun_address: string;
  road_address: string;
  land_category_name: string | null;
  purpose_area_name: string | null;
  geometry_geojson: string | null;
  area_sqm: number;
  overlap_area_sqm: number;
  price_current: number | null;
  price_year: string | null;
  estimated_total_price: number | null;
  geometry_estimated_total_price: number | null;
  overlap_ratio: number;
  centroid_in: boolean;
  selected_by_rule: boolean;
  inclusion_mode: string;
  confidence_score: number;
  ai_recommendation: string | null;
  ai_confidence_score: number | null;
  ai_reason_codes: string[];
  ai_reason_text: string | null;
  ai_model_version: string | null;
  ai_applied: boolean;
  selection_origin: string;
  anomaly_codes: string[];
  anomaly_level: string | null;
  building_confidence: string | null;
  household_confidence: string | null;
  floor_area_ratio_confidence: string | null;
  included: boolean;
  counted_in_summary: boolean;
  lat: number | null;
  lng: number | null;
  building_count: number;
  aged_building_count: number;
  average_approval_year: number | null;
  price_previous: number | null;
  growth_rate: number | null;
  aged_building_ratio: number | null;
  site_area_sqm: number | null;
  total_floor_area_sqm: number | null;
  floor_area_ratio: number | null;
  building_coverage_ratio: number | null;
  household_count: number | null;
  primary_purpose_name: string | null;
};

export type MapZoneSummary = {
  zone_id: string | null;
  zone_name: string;
  is_saved: boolean;
  base_year: string | null;
  overlap_threshold: number;
  zone_area_sqm: number;
  overlap_area_sqm_total: number;
  parcel_count: number;
  boundary_parcel_count: number;
  counted_parcel_count: number;
  excluded_parcel_count: number;
  average_unit_price: number | null;
  assessed_total_price: number;
  geometry_assessed_total_price: number;
  algorithm_version: string;
  ai_model_version: string | null;
  ai_report_text: string | null;
  ai_recommended_include_count: number;
  ai_uncertain_count: number;
  ai_excluded_count: number;
  anomaly_parcel_count: number;
  building_data_ready: boolean;
  building_data_message: string | null;
  total_building_count: number;
  aged_building_count: number;
  aged_building_ratio: number | null;
  average_approval_year: number | null;
  total_floor_area_sqm: number | null;
  total_site_area_sqm: number | null;
  average_floor_area_ratio: number | null;
  undersized_parcel_count: number;
  undersized_parcel_ratio: number | null;
  created_at: string;
  updated_at: string;
};

export type MapZoneResponse = {
  summary: MapZoneSummary;
  coordinates: MapZoneCoordinate[];
  parcels: MapZoneParcelItem[];
};

export type MapZoneListItem = {
  zone_id: string;
  zone_name: string;
  base_year: string | null;
  parcel_count: number;
  assessed_total_price: number;
  created_at: string;
  updated_at: string;
};

export type MapZoneListResponse = {
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
  items: MapZoneListItem[];
};

export type MapZoneDeleteResponse = {
  zone_id: string;
  deleted: boolean;
};

export type MapZoneComparisonParcelDelta = {
  pnu: string;
  jibun_address: string;
};

export type MapZoneComparisonSummary = {
  target_zone_id: string;
  target_zone_name: string;
  target_updated_at: string;
  current_zone_name: string;
  current_updated_at: string;
  compared_at: string;
  added_parcel_count: number;
  removed_parcel_count: number;
  added_parcels: MapZoneComparisonParcelDelta[];
  removed_parcels: MapZoneComparisonParcelDelta[];
  parcel_delta: number;
  assessed_total_price_delta: number;
  geometry_assessed_total_price_delta: number;
  average_unit_price_delta: number | null;
  boundary_parcel_delta: number;
  anomaly_parcel_delta: number;
  building_count_delta: number;
  current_overlap_threshold: number;
  target_overlap_threshold: number;
  current_algorithm_version: string;
  target_algorithm_version: string;
  current_ai_model_version: string | null;
  target_ai_model_version: string | null;
};
