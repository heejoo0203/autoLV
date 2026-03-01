# API 명세 (v1 구현 반영)

기본 경로: `/api/v1`  
인증: 쿠키 기반 JWT(`access_token`, `refresh_token`)

## 1. 공통 API
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

## 2. 인증 API
### POST `/auth/register`
요청:
```json
{
  "email": "user@example.com",
  "password": "Abcd1234!",
  "confirm_password": "Abcd1234!",
  "full_name": "홍길동",
  "agreements": true
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

검증 규칙:
- `email`: 형식 검증 + 중복 불가
- `password`: 8~16자, 영문/숫자/특수문자 포함, UTF-8 기준 72바이트 이하
- `confirm_password`: `password`와 동일
- `full_name`: 2~20자, 한글/영문/숫자만 허용
- `agreements`: `true` 필수

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
- 성공 시 HttpOnly 쿠키(`access_token`, `refresh_token`)가 설정된다.

### POST `/auth/logout`
응답 204 (쿠키 삭제)

### GET `/auth/me`
응답 200:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "홍길동",
  "role": "user",
  "auth_provider": "local"
}
```

## 3. 개별공시지가 API
### POST `/land/single`
지번 검색 요청:
```json
{
  "search_type": "jibun",
  "ld_code": "1168011800",
  "san_type": "일반",
  "main_no": "970",
  "sub_no": "0"
}
```

도로명 검색 요청:
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
- `sido`: 시/도
- `sigungu`: 시/군/구

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
- `sido`: 시/도
- `sigungu`: 시/군/구
- `initial`: 초성

응답 200:
```json
{
  "sido": "서울특별시",
  "sigungu": "강남구",
  "initial": "ㄷ",
  "roads": ["도곡로", "도곡로11길", "도곡로13길"]
}
```

## 4. 파일조회 API (v1)
인증: 로그인 필수(`credentials: include`)

### GET `/bulk/guide`
설명:
- 파일조회 안내/권장 컬럼 메타 정보를 반환한다.

응답 200:
```json
{
  "max_rows": 10000,
  "required_common": ["주소유형"],
  "recommended_jibun": ["시도", "시군구", "읍면동", "산구분", "본번", "부번"],
  "recommended_road": ["시도", "시군구", "도로명", "건물본번", "건물부번"],
  "alias_examples": {
    "시도": ["시도", "시/도"],
    "본번": ["본번", "지번본번"],
    "주소": ["주소", "소재지"]
  }
}
```

### GET `/bulk/template`
설명:
- 표준 양식 엑셀 파일(`autolv_bulk_template.xlsx`)을 다운로드한다.

응답 200:
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### POST `/bulk/jobs`
설명:
- 업로드 파일로 비동기 작업을 생성한다.

요청:
- `multipart/form-data`
  - `file`: `.xlsx`, `.xls`, `.csv`
  - `address_mode`: `auto | jibun | road` (기본값 `auto`)

응답 202:
```json
{
  "job_id": "8f31f6b1-5d7a-4b87-b4f6-75fb0d0d9a49",
  "status": "queued",
  "total_rows": 6500,
  "created_at": "2026-03-02T02:10:30Z"
}
```

### GET `/bulk/jobs`
설명:
- 사용자 작업 이력을 최신순으로 페이지 조회한다.

쿼리:
- `page`: 기본 1, 최소 1
- `page_size`: 기본 10, 최소 1, 최대 10

응답 200:
```json
{
  "page": 1,
  "page_size": 10,
  "total_count": 24,
  "total_pages": 3,
  "items": [
    {
      "job_id": "8f31f6b1-5d7a-4b87-b4f6-75fb0d0d9a49",
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
- 단일 작업 상태를 조회한다.

응답 200:
```json
{
  "job_id": "8f31f6b1-5d7a-4b87-b4f6-75fb0d0d9a49",
  "file_name": "sample.xlsx",
  "status": "completed",
  "total_rows": 6500,
  "processed_rows": 6500,
  "success_rows": 6300,
  "failed_rows": 200,
  "progress_percent": 100,
  "created_at": "2026-03-02T02:10:30Z",
  "updated_at": "2026-03-02T02:12:40Z",
  "error_message": null,
  "can_download": true
}
```

### GET `/bulk/jobs/{job_id}/download`
설명:
- 완료된 작업 결과 파일을 다운로드한다.

응답 200:
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### POST `/bulk/jobs/delete`
설명:
- 선택한 작업을 일괄 삭제한다.
- `processing` 상태 작업은 삭제 대상에서 제외된다.

요청:
```json
{
  "job_ids": ["job-id-1", "job-id-2"]
}
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

## 5. 오류 응답 형식
FastAPI 기본 `detail` 형식을 사용한다.

예시:
```json
{
  "detail": {
    "code": "VWORLD_KEY_MISSING",
    "message": "VWORLD_API_KEY 설정이 필요합니다."
  }
}
```

주요 오류 코드:
- `VWORLD_KEY_MISSING`
- `VWORLD_INVALID_KEY` 계열
- `ROAD_FILE_NOT_FOUND`
- `ROAD_GEOCODE_FAILED`
- `PARCEL_NOT_FOUND`
- `UNAUTHORIZED`
- `BULK_FILE_INVALID`
- `BULK_ROW_LIMIT_EXCEEDED`
- `BULK_JOB_NOT_FOUND`
- `BULK_JOB_NOT_READY`
