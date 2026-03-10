# 데이터 저장 구조 (2026-03-10 기준, v3.0 준비 중)

> 최신 안정 릴리즈는 `v2.2.1`이며, 현재 스키마에는 `building_register_caches`와 `zone_ai_feedbacks`까지 반영돼 있다.

## 0. 저장 구조 방향
- 현재 DB 구조는 단순 조회 결과 보관보다, `작업 재현성`과 `정확도 추적`을 확보하는 쪽으로 확장 중이다.
- 저장 계층의 목적은 다음 4가지다.
  1. 결과 재열람
  2. 저장/비교
  3. 정확도 설명과 감사 추적
  4. 향후 프로젝트/워크스페이스 확장 준비
- 장기적으로는 `raw -> normalized -> serving` 3계층을 더 명확히 분리해야 한다.

## 1. DB 런타임 구성
- 로컬 개발 기본 DB: SQLite (`apps/api/autolv.db`)
- 운영 배포 DB: PostgreSQL (Neon/Railway)
- 공간 확장: PostgreSQL `postgis` 확장 사용
- 마이그레이션: Alembic (`apps/api/alembic/versions`)

마이그레이션 이력:
- `20260302_0001`: `users`, `bulk_jobs`
- `20260302_0002`: `query_logs`
- `20260304_0003`: `parcels`
- `20260305_0004`: `email_verifications` + `users` 약관 컬럼
- `20260305_0005`: `users.phone_number`
- `20260306_0006`: `zone_analyses`, `zone_analysis_parcels`
- `20260306_0007`: `parcels.geom` 타입을 `MULTIPOLYGON`으로 변경(지적도 호환)
- `20260307_0008`: `zone_analysis_parcels.land_category_name`, `zone_analysis_parcels.purpose_area_name`
- `20260309_0009`: `building_register_caches`
- `20260310_0010`: `building_register_caches` 추가 지표(`건폐율`, `세대수`, `연면적`)
- `20260310_0011`: `zone_analysis_parcels` 정확도 필드(`overlap_area_sqm`, `centroid_in`, `selected_by_rule`, `inclusion_mode`, `confidence_score`)
- `20260310_0012`: `zone_analysis_parcels` AI/이상치/신뢰도 필드 + `zone_ai_feedbacks`

비고:
- PostGIS 관련 컬럼과 인덱스는 `parcels` 및 구역 분석 마이그레이션 흐름 안에서 함께 반영된다.

## 2. 테이블 상세
### 2.1 users
- `id` (String(36), PK)
- `email` (String(255), UNIQUE, NOT NULL, INDEX)
- `password_hash` (String(255), NOT NULL)
- `full_name` (String(100), NULL)
- `phone_number` (String(20), NULL, INDEX)
- `profile_image_path` (String(500), NULL)
- `role` (String(20), NOT NULL, 기본값 `user`)
- `auth_provider` (String(20), NOT NULL, 기본값 `local`)
- `terms_version` (String(30), NOT NULL)
- `terms_snapshot` (Text, NOT NULL)
- `terms_accepted_at` (DateTime(timezone=True), NULL)
- `created_at` (DateTime(timezone=True), NOT NULL)
- `updated_at` (DateTime(timezone=True), NOT NULL)

### 2.2 email_verifications
- `id` (String(36), PK)
- `purpose` (String(30), NOT NULL, INDEX)  
  허용: `signup | find_id | reset_password`
- `email` (String(255), NOT NULL, INDEX)
- `full_name` (String(100), NULL)
- `code_hash` (String(128), NOT NULL)
- `attempt_count` (Integer, NOT NULL)
- `max_attempts` (Integer, NOT NULL)
- `expires_at` (DateTime(timezone=True), NOT NULL, INDEX)
- `verified_at` (DateTime(timezone=True), NULL)
- `consumed_at` (DateTime(timezone=True), NULL)
- `meta_json` (Text, NOT NULL)
- `created_at` (DateTime(timezone=True), NOT NULL)
- `updated_at` (DateTime(timezone=True), NOT NULL)

### 2.3 bulk_jobs
- `id` (String(36), PK)
- `user_id` (String(36), FK -> `users.id`, NOT NULL, INDEX)
- `file_name` (String(255), NOT NULL)
- `upload_path` (String(500), NOT NULL)
- `result_path` (String(500), NULL)
- `status` (String(20), NOT NULL, INDEX)
- `total_rows` (Integer, NOT NULL)
- `processed_rows` (Integer, NOT NULL)
- `success_rows` (Integer, NOT NULL)
- `failed_rows` (Integer, NOT NULL)
- `error_message` (Text, NULL)
- `created_at` (DateTime(timezone=True), NOT NULL)
- `updated_at` (DateTime(timezone=True), NOT NULL)

상태 값:
- `queued`
- `processing`
- `completed`
- `failed`

### 2.4 query_logs
- `id` (String(36), PK)
- `user_id` (String(36), FK -> `users.id`, NOT NULL, INDEX)
- `search_type` (String(10), NOT NULL)  
  허용: `jibun | road | map`
- `pnu` (String(19), NOT NULL, INDEX)
- `address_summary` (String(300), NOT NULL)
- `rows_json` (Text, NOT NULL)
- `result_count` (Integer, NOT NULL)
- `created_at` (DateTime(timezone=True), NOT NULL, INDEX)

### 2.5 parcels
- `id` (String(36), PK)
- `pnu` (String(19), UNIQUE, NOT NULL, INDEX)
- `lat` (Float, NOT NULL)
- `lng` (Float, NOT NULL)
- `area` (Float, NULL)
- `price_current` (BigInteger, NULL)
- `price_previous` (BigInteger, NULL)
- `updated_at` (DateTime(timezone=True), NOT NULL)
- `geog` (Geography POINT, 4326, PostgreSQL 전용)
- `geom` (Geometry MULTIPOLYGON, 4326, PostgreSQL 전용)

공간 인덱스(PostgreSQL):
- `idx_parcels_geog_gist` (GIST on `geog`)
- `idx_parcels_geom_gist` (GIST on `geom`)

### 2.6 zone_analyses
- `id` (String(36), PK)
- `user_id` (String(36), FK -> `users.id`, NOT NULL, INDEX)
- `zone_name` (String(100), NOT NULL)
- `zone_wkt` (Text, NOT NULL)
- `overlap_threshold` (Float, NOT NULL, 기본값 `0.9`)
- `zone_area_sqm` (Float, NOT NULL)
- `base_year` (String(4), NULL)
- `parcel_count` (Integer, NOT NULL)
- `counted_parcel_count` (Integer, NOT NULL)
- `excluded_parcel_count` (Integer, NOT NULL)
- `unit_price_sum` (BigInteger, NOT NULL)
- `assessed_total_price` (BigInteger, NOT NULL)
- `created_at` (DateTime(timezone=True), NOT NULL, INDEX)
- `updated_at` (DateTime(timezone=True), NOT NULL)

비고:
- `zone_analyses`는 `/map/zones/analyze` 호출 시 자동 생성되지 않는다.
- 사용자가 `구역 저장`을 눌러 `/map/zones`를 호출했을 때만 영속 저장된다.
- `zone_area_sqm`는 드로잉 폴리곤 면적이 아니라, 저장 시점 기준 포함 필지 `area_sqm` 합계다.
- 이 테이블은 향후 프로젝트/워크스페이스 계층의 스냅샷 기본 단위로 확장될 수 있다.

### 2.7 zone_analysis_parcels
- `id` (String(36), PK)
- `zone_analysis_id` (String(36), FK -> `zone_analyses.id`, NOT NULL, INDEX)
- `pnu` (String(19), NOT NULL, INDEX)
- `jibun_address` (String(300), NOT NULL)
- `road_address` (String(300), NOT NULL)
- `land_category_name` (String(100), NULL)
- `purpose_area_name` (String(100), NULL)
- `area_sqm` (Float, NOT NULL)
- `overlap_area_sqm` (Float, NOT NULL)
- `price_current` (BigInteger, NULL)
- `price_year` (String(4), NULL)
- `overlap_ratio` (Float, NOT NULL)
- `centroid_in` (Boolean, NOT NULL)
- `selected_by_rule` (Boolean, NOT NULL)
- `inclusion_mode` (String(30), NOT NULL)
- `confidence_score` (Float, NOT NULL)
- `ai_recommendation` (String(20), NULL)
- `ai_confidence_score` (Float, NULL)
- `ai_reason_codes` (Text, NULL)
- `ai_reason_text` (String(300), NULL)
- `ai_model_version` (String(40), NULL)
- `ai_applied` (Boolean, NOT NULL)
- `selection_origin` (String(20), NOT NULL)
- `anomaly_codes` (Text, NULL)
- `anomaly_level` (String(20), NULL)
- `building_confidence` (String(20), NULL)
- `household_confidence` (String(20), NULL)
- `floor_area_ratio_confidence` (String(20), NULL)
- `included` (Boolean, NOT NULL)
- `excluded_at` (DateTime(timezone=True), NULL)
- `excluded_reason` (String(200), NULL)
- `lat` (Float, NULL)
- `lng` (Float, NULL)
- `created_at` (DateTime(timezone=True), NOT NULL)
- `updated_at` (DateTime(timezone=True), NOT NULL)
- Unique 제약: `uq_zone_analysis_parcel` (`zone_analysis_id`, `pnu`)

비고:
- `included`는 최종 반영 여부다.
- `selected_by_rule`는 규칙/점수 기반 기본 선택 결과다.
- `inclusion_mode`는 기본 분석 단계에서는 `rule_overlap | score_auto | boundary_candidate | excluded`를 사용하고, 저장 후 사용자/AI 반영 단계에서는 `user_excluded | user_included | ai_included | ai_not_applied`까지 확장될 수 있다.
- `confidence_score`는 규칙 기반 점수다.
- `ai_recommendation`은 휴리스틱 AI의 권고 상태(`included | uncertain | excluded`)다.
- `selection_origin`은 최종 포함/제외 결정의 출처(`rule | user | ai`)다.
- `anomaly_level`은 `none | review | critical` 중 하나로 해석한다.
- 이 테이블이 사실상 구역 검토 워크플로우의 핵심 작업 아이템 단위다.

### 2.8 building_register_caches
- `id` (String(36), PK)
- `pnu` (String(19), UNIQUE, NOT NULL, INDEX)
- `has_building_register` (Boolean, NOT NULL)
- `building_count` (Integer, NOT NULL)
- `aged_building_count` (Integer, NOT NULL)
- `residential_building_count` (Integer, NOT NULL)
- `approval_year_sum` (Integer, NOT NULL)
- `approval_year_count` (Integer, NOT NULL)
- `average_approval_year` (Integer, NULL)
- `total_floor_area_sqm` (Float, NULL)
- `site_area_sqm` (Float, NULL)
- `floor_area_ratio` (Float, NULL)
- `building_coverage_ratio` (Float, NULL)
- `household_count` (Integer, NULL)
- `primary_purpose_name` (String(120), NULL)
- `synced_at` (DateTime(timezone=True), NOT NULL, INDEX)
- `updated_at` (DateTime(timezone=True), NOT NULL)

비고:
- 건축물대장 API 응답의 정규화 캐시 테이블이다.
- 구역 요약의 노후도/평균 용적률/과소필지 비율 계산 시 우선 사용한다.
- `approval_year_sum`, `approval_year_count`는 구역 평균 사용승인년도 재계산용 내부 집계 필드다.
- 구역 상세 응답의 `household_count`, `primary_purpose_name`, `floor_area_ratio`, `building_coverage_ratio`도 이 캐시와 결합해 구성된다.

### 2.9 zone_ai_feedbacks
- `id` (String(36), PK)
- `zone_analysis_id` (String(36), FK -> `zone_analyses.id`, NOT NULL, INDEX)
- `pnu` (String(19), NOT NULL, INDEX)
- `user_id` (String(36), FK -> `users.id`, NOT NULL, INDEX)
- `ai_model_version` (String(40), NULL)
- `ai_recommendation` (String(20), NULL)
- `final_decision` (String(20), NOT NULL)
- `decision_origin` (String(20), NOT NULL)
- `created_at` (DateTime(timezone=True), NOT NULL, INDEX)

비고:
- 사용자가 AI 추천을 수락/거절/수정한 결과를 저장한다.
- ML 재학습 이전 단계에서도 추천 품질 회고와 운영 지표에 사용한다.

## 3. 파일 저장소 구조
- 대량조회 업로드/결과: `apps/api/storage/bulk`
- 프로필 이미지: `apps/api/storage/profile_images`

운영에서는 스토리지 볼륨 또는 외부 오브젝트 스토리지 연계를 권장한다.

## 3.1 응답 조합 필드
- 아래 값들은 별도 영속 테이블이 아니라 응답 생성 시 조합되는 경우가 있다.
- 지도조회:
  - `growth_rate`
  - `estimated_total_price`
  - `nearby_avg_price`
- 구역조회:
  - `geometry_assessed_total_price`
  - `average_floor_area_ratio`
  - `undersized_parcel_ratio`
  - 필지 단위 `price_previous`, `growth_rate`, `aged_building_ratio`

비고:
- 즉, 모든 화면 필드가 1:1로 단일 테이블 컬럼에 저장되는 구조는 아니다.
- 현재 구조는 `parcels + building_register_caches + zone_analysis_parcels + runtime calculation` 조합이 많다.

## 4. 데이터 보존/삭제 정책
- `query_logs`: 사용자 조회기록 영구 저장(회원 탈퇴 시 함께 삭제)
- `bulk_jobs`: 사용자 작업 이력 저장(회원 탈퇴 시 파일 포함 삭제)
- `zone_analyses`, `zone_analysis_parcels`, `zone_ai_feedbacks`: 구역분석 이력/상세/AI 피드백 저장(회원 탈퇴 시 함께 삭제)
- `email_verifications`: 인증 수명주기 테이블(만료/사용 완료 데이터 정리 권장)
- `users`: 회원 탈퇴 시 관련 참조 데이터 정리 후 삭제

## 5. 운영 체크포인트
1. `alembic_version`이 `head`인지 확인
2. 필수 테이블 존재 확인: `users`, `email_verifications`, `bulk_jobs`, `query_logs`, `parcels`, `zone_analyses`, `zone_analysis_parcels`, `building_register_caches`, `zone_ai_feedbacks`
3. PostgreSQL 환경에서 `postgis_version()` 확인
4. `parcels` 인덱스(`idx_parcels_geog_gist`, `idx_parcels_geom_gist`) 존재 확인
5. 관리자 계정 시드 필요 시 `scripts/reset_db_and_seed_admin.py` 실행

## 6. 예정 스키마 확장 (v3.x)
정확도 추적과 작업 시스템 고도화를 위해 다음 확장을 권장한다.

### 6.1 zone_building_metrics (예정)
- `id` (String(36), PK)
- `zone_analysis_id` (String(36), FK -> `zone_analyses.id`, NOT NULL, UNIQUE)
- `aging_threshold_years` (Integer, NOT NULL)
- `building_count` (Integer, NOT NULL)
- `aged_building_count` (Integer, NOT NULL)
- `aging_ratio` (Float, NOT NULL)
- `average_approval_year` (Integer, NULL)
- `total_site_area_sqm` (Float, NULL)
- `total_gross_floor_area_sqm` (Float, NULL)
- `floor_area_ratio` (Float, NULL)
- `created_at` (DateTime(timezone=True), NOT NULL)
- `updated_at` (DateTime(timezone=True), NOT NULL)

### 6.2 zone_ai_suggestions (예정)
- `id` (String(36), PK)
- `zone_analysis_id` (String(36), FK -> `zone_analyses.id`, NOT NULL, INDEX)
- `pnu` (String(19), NOT NULL, INDEX)
- `model_version` (String(50), NOT NULL, INDEX)
- `recommendation` (String(20), NOT NULL)  
  허용: `included | excluded | uncertain`
- `confidence` (Float, NOT NULL)
- `reason_codes_json` (Text, NOT NULL)
- `reason_text` (Text, NULL)
- `generated_at` (DateTime(timezone=True), NOT NULL, INDEX)
- Unique 제약(권장): `zone_analysis_id + pnu + model_version`

비고:
- 최종 계산 결과 테이블이 아니라, 사용자 검토용 추천 캐시/이력 테이블이다.
- 구역 분석 원본 계산값은 계속 `zone_analysis_parcels`와 `parcels`가 기준이 된다.

### 6.4 vworld_raw_payloads (예정)
- `id` (String(36), PK)
- `source_path` (String(120), NOT NULL, INDEX)
- `request_key` (String(255), NOT NULL, INDEX)
- `request_params_json` (Text, NOT NULL)
- `response_body` (Text, NOT NULL)
- `fetched_at` (DateTime(timezone=True), NOT NULL, INDEX)

비고:
- VWorld 원문 응답 보관용 raw 계층이다.
- 추후 값 재현, 장애 분석, 정규화 로직 회귀 검증에 사용한다.

### 6.5 building_register_raw_payloads (예정)
- `id` (String(36), PK)
- `pnu` (String(19), NOT NULL, INDEX)
- `endpoint_name` (String(80), NOT NULL, INDEX)
- `request_params_json` (Text, NOT NULL)
- `response_body` (Text, NOT NULL)
- `fetched_at` (DateTime(timezone=True), NOT NULL, INDEX)

비고:
- 건축물대장 표제부/총괄표제부/전유부 원문 저장용 raw 계층이다.

### 6.6 parcel_serving_snapshots (예정)
- `id` (String(36), PK)
- `pnu` (String(19), NOT NULL, INDEX)
- `base_year` (String(4), NOT NULL, INDEX)
- `price_current` (BigInteger, NULL)
- `price_previous` (BigInteger, NULL)
- `land_category_name` (String(100), NULL)
- `purpose_area_name` (String(100), NULL)
- `area_sqm` (Float, NULL)
- `source_version` (String(50), NOT NULL)
- `algorithm_version` (String(50), NOT NULL)
- `created_at` (DateTime(timezone=True), NOT NULL)

비고:
- 화면/다운로드/리포트에 바로 쓰는 serving 계층이다.
- 동일 기준연도 기준의 재현성 확보용이다.

### 6.7 zone_ai_model_registry (예정)
- `id` (String(36), PK)
- `model_name` (String(50), NOT NULL, INDEX)
- `model_version` (String(50), NOT NULL, UNIQUE)
- `model_type` (String(30), NOT NULL)  
  예: `lightgbm`, `xgboost`, `rule-ensemble`
- `status` (String(20), NOT NULL)  
  예: `active | shadow | retired`
- `feature_schema_json` (Text, NOT NULL)
- `metrics_json` (Text, NOT NULL)
- `created_at` (DateTime(timezone=True), NOT NULL)
- `updated_at` (DateTime(timezone=True), NOT NULL)

비고:
- 운영 중인 추천 모델 버전과 성능 지표를 관리한다.
- 계산 엔진을 대체하는 목적이 아니라 추천 모델 운영 메타데이터 관리용이다.
