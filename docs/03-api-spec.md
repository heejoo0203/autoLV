# API 명세 (v2.2.0)

기본 경로: `/api/v1`  
인증: 쿠키 기반 JWT (`access_token`, `refresh_token`)

## 0. 공통
### GET `/`
응답 200:
```json
{ "service": "autoLV-api", "status": "ok" }
```

### GET `/health`
응답 200:
```json
{ "status": "healthy" }
```

## 1. 인증 API (`/auth`)
### POST `/auth/register`
설명:
- 이메일 중복 확인 + 이메일 인증코드 검증 후 회원가입

요청:
```json
{
  "email": "user@example.com",
  "password": "Abcd1234!",
  "confirm_password": "Abcd1234!",
  "full_name": "홍길동",
  "phone_number": "010-1234-5678",
  "agreements": true,
  "verification_id": "uuid",
  "verification_code": "123456"
}
```

응답 201:
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "full_name": "홍길동"
}
```

### GET `/auth/email-availability?email=user@example.com`
응답 200:
```json
{
  "email": "user@example.com",
  "available": true
}
```

### POST `/auth/login`
요청:
```json
{
  "email": "user@example.com",
  "password": "Abcd1234!"
}
```

응답 200:
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "full_name": "홍길동"
}
```

비고:
- 성공 시 HttpOnly 쿠키를 설정한다.

### POST `/auth/logout`
응답 204:
- 본문 없음, 인증 쿠키 삭제

### GET `/auth/me`
응답 200:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "홍길동",
  "phone_number": "01012345678",
  "role": "user",
  "auth_provider": "local",
  "profile_image_url": "/media/profile/abc123.png"
}
```

### GET `/auth/terms`
설명:
- 로그인 사용자가 동의한 약관 버전/본문/동의시각 반환

응답 200:
```json
{
  "version": "2026-03-05-v1",
  "content": "[autoLV 서비스 이용약관] ...",
  "accepted_at": "2026-03-05T06:31:15+00:00"
}
```

### GET `/auth/terms/current`
설명:
- 비로그인(회원가입 화면 포함)에서 현재 약관 본문 조회

응답 200:
```json
{
  "version": "2026-03-05-v1",
  "content": "[autoLV 서비스 이용약관] ...",
  "accepted_at": null
}
```

### PATCH `/auth/profile`
설명:
- 이름/연락처/프로필 이미지를 수정

요청:
- `multipart/form-data`
  - `full_name` (옵션)
  - `phone_number` (옵션)
  - `profile_image` (옵션, png/jpg/jpeg/webp, 최대 5MB)

응답 200:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "홍길동",
  "phone_number": "01012345678",
  "role": "user",
  "auth_provider": "local",
  "profile_image_url": "/media/profile/abc123.webp"
}
```

### POST `/auth/password/change`
요청:
```json
{
  "current_password": "OldPass123!",
  "new_password": "NewPass456!",
  "confirm_new_password": "NewPass456!"
}
```

응답 200:
```json
{ "message": "비밀번호가 변경되었습니다." }
```

### DELETE `/auth/account`
설명:
- `[이름] 탈퇴를 동의합니다` 문구를 정확히 입력해야 탈퇴 가능

요청:
```json
{ "confirmation_text": "홍길동 탈퇴를 동의합니다" }
```

응답 204:
- 본문 없음

### POST `/auth/recovery/send-code`
설명:
- 회원가입/아이디찾기/비밀번호재설정 인증코드 발송

요청:
```json
{
  "purpose": "signup",
  "email": "user@example.com"
}
```

응답 200:
```json
{
  "verification_id": "uuid",
  "expires_in_seconds": 600,
  "message": "인증 코드가 발송되었습니다.",
  "debug_code": null
}
```

비고:
- `purpose`: `signup | find_id | reset_password`

### POST `/auth/recovery/find-id/profile`
설명:
- 이름+연락처로 마스킹 이메일 반환

요청:
```json
{
  "full_name": "홍길동",
  "phone_number": "010-1234-5678"
}
```

응답 200:
```json
{ "masked_email": "he***03@naver.com" }
```

### POST `/auth/recovery/find-id`
설명:
- 코드 검증 기반 이메일 조회(내부/확장용)

요청:
```json
{
  "verification_id": "uuid",
  "code": "123456"
}
```

응답 200:
```json
{ "email": "user@example.com" }
```

### POST `/auth/recovery/reset-password`
요청:
```json
{
  "email": "user@example.com",
  "verification_id": "uuid",
  "code": "123456",
  "new_password": "NewPass456!",
  "confirm_new_password": "NewPass456!"
}
```

응답 200:
```json
{ "message": "비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해 주세요." }
```

## 2. 개별조회 API (`/land`)
### POST `/land/single`
지번 검색 요청 예시:
```json
{
  "search_type": "jibun",
  "ld_code": "1168011800",
  "san_type": "일반",
  "main_no": "970",
  "sub_no": "0"
}
```

도로명 검색 요청 예시:
```json
{
  "search_type": "road",
  "sido": "서울특별시",
  "sigungu": "강남구",
  "road_name": "도곡로",
  "building_main_no": "21",
  "building_sub_no": ""
}
```

응답 200:
```json
{
  "search_type": "road",
  "pnu": "1168011800109700000",
  "address_summary": "서울특별시 강남구 도곡동 970",
  "rows": [
    {
      "기준년도": "2025",
      "토지소재지": "서울특별시 강남구 도곡동",
      "지번": "970",
      "개별공시지가": "14,000,000 원/㎡",
      "기준일자": "01월 01일",
      "공시일자": "20250430",
      "비고": ""
    }
  ]
}
```

### GET `/land/road-initials`
쿼리:
- `sido`, `sigungu`

응답 200:
```json
{
  "sido": "서울특별시",
  "sigungu": "강남구",
  "initials": ["ㄱ", "ㄴ", "ㄷ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅌ", "ㅎ"]
}
```

### GET `/land/road-names`
쿼리:
- `sido`, `sigungu`, `initial`

응답 200:
```json
{
  "sido": "서울특별시",
  "sigungu": "강남구",
  "initial": "ㄷ",
  "roads": ["도곡로", "도곡로11길", "도곡로13길"]
}
```

## 3. 파일조회 API (`/bulk`)
인증: 로그인 필수

### GET `/bulk/guide`
응답 200:
```json
{
  "max_rows": 10000,
  "required_common": ["주소유형"],
  "recommended_jibun": ["시도", "시군구", "읍면동", "산구분", "본번", "부번"],
  "recommended_road": ["시도", "시군구", "도로명", "건물본번", "건물부번"],
  "alias_examples": {
    "시도": ["시도", "시/도"],
    "본번": ["본번", "주번"],
    "주소": ["주소", "전체주소"]
  }
}
```

### GET `/bulk/template`
설명:
- 표준 양식(`autolv_bulk_template.xlsx`) 다운로드

### POST `/bulk/jobs`
요청:
- `multipart/form-data`
  - `file`: `.xlsx | .xls | .csv`
  - `address_mode`: `auto | jibun | road` (기본 `auto`)

응답 202:
```json
{
  "job_id": "uuid",
  "status": "queued",
  "total_rows": 6500,
  "created_at": "2026-03-02T02:10:30Z"
}
```

### GET `/bulk/jobs`
쿼리:
- `page` (기본 1)
- `page_size` (기본 10, 최대 10)

응답 200:
```json
{
  "page": 1,
  "page_size": 10,
  "total_count": 24,
  "total_pages": 3,
  "items": [
    {
      "job_id": "uuid",
      "file_name": "sample.xlsx",
      "status": "processing",
      "total_rows": 6500,
      "processed_rows": 2150,
      "success_rows": 2000,
      "failed_rows": 150,
      "progress_percent": 33.08,
      "created_at": "2026-03-02T02:10:30Z",
      "updated_at": "2026-03-02T02:11:10Z",
      "error_message": null,
      "can_download": false
    }
  ]
}
```

### GET `/bulk/jobs/{job_id}`
설명:
- 단일 작업 상태 조회

### GET `/bulk/jobs/{job_id}/download`
설명:
- 완료 작업 결과 파일 다운로드

### POST `/bulk/jobs/delete`
요청:
```json
{ "job_ids": ["job-id-1", "job-id-2"] }
```

응답 200:
```json
{
  "deleted_count": 1,
  "skipped_count": 1,
  "deleted_job_ids": ["job-id-1"],
  "skipped_job_ids": ["job-id-2"]
}
```

## 4. 지도조회 API (`/map`)
### POST `/map/click`
요청:
```json
{ "lat": 37.5662952, "lng": 126.9779451 }
```

응답 200:
```json
{
  "lat": 37.5662952,
  "lng": 126.9779451,
  "pnu": "1111010100100010000",
  "address_summary": "서울특별시 종로구 청운동 1",
  "jibun_address": "서울특별시 종로구 청운동 1",
  "road_address": "서울특별시 종로구 자하문로 1",
  "area": 1234.5,
  "price_current": 12000000,
  "price_previous": 11200000,
  "growth_rate": 7.14,
  "estimated_total_price": 14814000000,
  "nearby_avg_price": 10650000,
  "nearby_radius_m": 200,
  "cache_hit": false,
  "rows": []
}
```

### POST `/map/search`
요청:
```json
{ "address": "서울특별시 종로구 세종대로 175" }
```

응답:
- `/map/click`과 동일 스키마

### GET `/map/by-pnu?pnu=1111010100100010000`
응답:
- `/map/click`과 동일 스키마

### GET `/map/price-rows?pnu=1111010100100010000`
응답 200:
```json
{
  "pnu": "1111010100100010000",
  "rows": [
    {
      "기준년도": "2025",
      "토지소재지": "서울특별시 종로구 청운동",
      "지번": "1",
      "개별공시지가": "12,000,000 원/㎡",
      "기준일자": "01월 01일",
      "공시일자": "20250430",
      "비고": ""
    }
  ]
}
```

### GET `/map/land-details?pnu=1111010100100010000`
응답 200:
```json
{
  "pnu": "1111010100100010000",
  "stdr_year": "2025",
  "area": 1234.5,
  "land_category_name": "대",
  "purpose_area_name": "제2종일반주거지역",
  "purpose_district_name": "기타경관지구"
}
```

### GET `/map/export?pnu=1111010100100010000`
설명:
- CSV 다운로드 (`pnu, area, current_price, previous_price, growth_rate`)

### POST `/map/zones/analyze`
설명:
- 지도에서 그린 폴리곤 영역을 분석해 포함 필지(90% 이상) 목록과 최신연도 기준 합계를 반환
- 인증: 로그인 필수(HttpOnly 쿠키)

요청:
```json
{
  "zone_name": "한강 북측 분석구역",
  "coordinates": [
    { "lat": 37.57, "lng": 126.96 },
    { "lat": 37.57, "lng": 126.98 },
    { "lat": 37.56, "lng": 126.98 },
    { "lat": 37.56, "lng": 126.96 }
  ],
  "overlap_threshold": 0.9
}
```

응답 200:
```json
{
  "summary": {
    "zone_id": "zone-uuid",
    "zone_name": "한강 북측 분석구역",
    "base_year": "2025",
    "overlap_threshold": 0.9,
    "zone_area_sqm": 18234.3,
    "parcel_count": 128,
    "counted_parcel_count": 126,
    "excluded_parcel_count": 0,
    "average_unit_price": 50646974,
    "assessed_total_price": 923456700000,
    "created_at": "2026-03-06T01:23:45+00:00",
    "updated_at": "2026-03-06T01:23:45+00:00"
  },
  "coordinates": [
    { "lat": 37.57, "lng": 126.96 },
    { "lat": 37.57, "lng": 126.98 },
    { "lat": 37.56, "lng": 126.98 },
    { "lat": 37.56, "lng": 126.96 }
  ],
  "parcels": [
    {
      "pnu": "1111010100100010000",
      "jibun_address": "서울특별시 종로구 청운동 1",
      "road_address": "",
      "area_sqm": 123.4,
      "price_current": 12000000,
      "estimated_total_price": 1480800000,
      "price_year": "2025",
      "overlap_ratio": 0.9543,
      "included": true,
      "counted_in_summary": true,
      "lat": 37.58,
      "lng": 126.97
    }
  ]
}
```

### GET `/map/zones`
설명:
- 로그인 사용자의 구역 분석 이력 목록 조회
- 인증: 로그인 필수(HttpOnly 쿠키)

쿼리:
- `page`, `page_size`

응답 필드:
- `updated_at`: 최근 수정 시각
- `assessed_total_price`: 최신연도 기준 총 공시지가 합계

### PATCH `/map/zones/{zone_id}`
설명:
- 저장된 구역 이름 수정
- 인증: 로그인 필수(HttpOnly 쿠키)

요청:
```json
{
  "zone_name": "남대문 업무권 분석구역"
}
```

### GET `/map/zones/{zone_id}`
설명:
- 구역 분석 상세 조회(요약 + 필지 목록)
- 인증: 로그인 필수(HttpOnly 쿠키)

### PATCH `/map/zones/{zone_id}/parcels/exclude`
설명:
- 분석 결과에서 선택한 필지를 수동 제외하고 요약 재계산
- 인증: 로그인 필수(HttpOnly 쿠키)

요청:
```json
{
  "pnu_list": ["1111010100100010000", "1111010100100020000"],
  "reason": "사용자 수동 제외"
}
```

### GET `/map/zones/{zone_id}/export`
설명:
- 구역 분석 결과 CSV 다운로드
- 인증: 로그인 필수(HttpOnly 쿠키)

### DELETE `/map/zones/{zone_id}`
설명:
- 저장된 구역 분석 결과 삭제
- 인증: 로그인 필수(HttpOnly 쿠키)

## 5. 조회기록 API (`/history`)
인증: 로그인 필수

### POST `/history/query-logs`
설명:
- 개별/지도 조회 결과 저장
- 최근 3분 내 동일 `search_type+pnu` 요청은 병합(결과 건수/주소/rows 갱신)

요청:
```json
{
  "search_type": "map",
  "pnu": "1111010100100010000",
  "address_summary": "서울특별시 종로구 청운동 1",
  "rows": []
}
```

### GET `/history/query-logs`
쿼리:
- `page` (기본 1)
- `page_size` (기본 20, 최대 100)
- `search_type` (`jibun|road|map`)
- `sido`, `sigungu`
- `sort_by` (`created_at|address_summary|search_type|result_count`)
- `sort_order` (`asc|desc`)

응답 200:
```json
{
  "page": 1,
  "page_size": 20,
  "total_count": 132,
  "total_pages": 7,
  "items": [
    {
      "id": "log-uuid",
      "search_type": "jibun",
      "pnu": "1168011800109700000",
      "address_summary": "서울특별시 강남구 도곡동 970",
      "result_count": 12,
      "created_at": "2026-03-05T05:19:10.230000+00:00"
    }
  ]
}
```

### GET `/history/query-logs/{log_id}`
설명:
- 상세 조회기록 + 연도별 결과 rows 조회

## 6. 오류 응답 형식
FastAPI 기본 `detail` 형식 사용:

```json
{
  "detail": {
    "code": "ERROR_CODE",
    "message": "설명 메시지"
  }
}
```

주요 오류 코드:
- 인증/계정: `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `EMAIL_ALREADY_EXISTS`, `PASSWORD_MISMATCH`, `WITHDRAW_CONFIRM_INVALID`
- 인증코드: `VERIFICATION_NOT_FOUND`, `VERIFICATION_EXPIRED`, `VERIFICATION_CODE_INVALID`, `ACCOUNT_NOT_FOUND`
- 개별조회: `VWORLD_UNREACHABLE`, `VWORLD_HTTP_ERROR`, `VWORLD_DIRECT_AND_PROXY_FAILED`, `ROAD_FILE_NOT_FOUND`
- 파일조회: `BULK_FILE_INVALID`, `BULK_ROW_LIMIT_EXCEEDED`, `BULK_JOB_NOT_FOUND`, `BULK_JOB_NOT_READY`
- 지도조회: `INVALID_COORDINATE`, `INVALID_PNU`, `MAP_ADDRESS_NOT_FOUND`, `PARCEL_NOT_FOUND`
- 구역조회: `POSTGIS_REQUIRED`, `ZONE_TOO_FEW_POINTS`, `ZONE_TOO_MANY_POINTS`, `ZONE_AREA_TOO_LARGE`, `INVALID_ZONE_GEOMETRY`, `ZONE_ANALYSIS_NOT_FOUND`
- 조회기록: `QUERY_LOG_NOT_FOUND`
