# 데이터 저장 구조 (v2.2.0)

## 1. DB 런타임 구성
- 로컬 개발 기본 DB: SQLite (`apps/api/autolv.db`)
- 운영 배포 DB: PostgreSQL (Neon/Railway)
- 공간 확장: PostgreSQL `postgis` 확장 사용
- 마이그레이션: Alembic (`apps/api/alembic/versions`)

마이그레이션 이력:
- `20260302_0001`: `users`, `bulk_jobs`
- `20260302_0002`: `query_logs`
- `20260304_0003`: `parcels` + PostGIS 컬럼/인덱스(`geog`, `geom`)
- `20260305_0004`: `email_verifications` + `users` 약관 컬럼
- `20260305_0005`: `users.phone_number`
- `20260306_0006`: `zone_analyses`, `zone_analysis_parcels`

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
- `geom` (Geometry POLYGON, 4326, PostgreSQL 전용)

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

### 2.7 zone_analysis_parcels
- `id` (String(36), PK)
- `zone_analysis_id` (String(36), FK -> `zone_analyses.id`, NOT NULL, INDEX)
- `pnu` (String(19), NOT NULL, INDEX)
- `jibun_address` (String(300), NOT NULL)
- `road_address` (String(300), NOT NULL)
- `area_sqm` (Float, NOT NULL)
- `price_current` (BigInteger, NULL)
- `price_year` (String(4), NULL)
- `overlap_ratio` (Float, NOT NULL)
- `included` (Boolean, NOT NULL)
- `excluded_at` (DateTime(timezone=True), NULL)
- `excluded_reason` (String(200), NULL)
- `lat` (Float, NULL)
- `lng` (Float, NULL)
- `created_at` (DateTime(timezone=True), NOT NULL)
- `updated_at` (DateTime(timezone=True), NOT NULL)
- Unique 제약: `uq_zone_analysis_parcel` (`zone_analysis_id`, `pnu`)

## 3. 파일 저장소 구조
- 대량조회 업로드/결과: `apps/api/storage/bulk`
- 프로필 이미지: `apps/api/storage/profile_images`

운영에서는 스토리지 볼륨 또는 외부 오브젝트 스토리지 연계를 권장한다.

## 4. 데이터 보존/삭제 정책
- `query_logs`: 사용자 조회기록 영구 저장(회원 탈퇴 시 함께 삭제)
- `bulk_jobs`: 사용자 작업 이력 저장(회원 탈퇴 시 파일 포함 삭제)
- `zone_analyses`, `zone_analysis_parcels`: 구역분석 이력/상세 저장(회원 탈퇴 시 함께 삭제)
- `email_verifications`: 인증 수명주기 테이블(만료/사용 완료 데이터 정리 권장)
- `users`: 회원 탈퇴 시 관련 참조 데이터 정리 후 삭제

## 5. 운영 체크포인트
1. `alembic_version`이 `head`인지 확인
2. 필수 테이블 존재 확인: `users`, `email_verifications`, `bulk_jobs`, `query_logs`, `parcels`, `zone_analyses`, `zone_analysis_parcels`
3. PostgreSQL 환경에서 `postgis_version()` 확인
4. `parcels` 인덱스(`idx_parcels_geog_gist`, `idx_parcels_geom_gist`) 존재 확인
5. 관리자 계정 시드 필요 시 `scripts/reset_db_and_seed_admin.py` 실행
