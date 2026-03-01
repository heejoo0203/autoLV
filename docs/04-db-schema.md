# 데이터 저장 구조 (v1 구현 기준)

## 1. 서버 DB (SQLite)
현재 서버 DB는 SQLite(`apps/api/autolv.db`)를 사용한다.

### 1.1 users
- `id` (String(36), PK)
- `email` (String(255), UNIQUE, NOT NULL, INDEX)
- `password_hash` (String(255), NOT NULL)
- `full_name` (String(100), NULL)
- `role` (String(20), NOT NULL, 기본값 `user`)
- `auth_provider` (String(20), NOT NULL, 기본값 `local`)
- `created_at` (DateTime(timezone=True), NOT NULL)
- `updated_at` (DateTime(timezone=True), NOT NULL)

### 1.2 bulk_jobs
- `id` (String(36), PK)
- `user_id` (String(36), FK -> `users.id`, NOT NULL, INDEX)
- `file_name` (String(255), NOT NULL)
- `upload_path` (String(500), NOT NULL)
- `result_path` (String(500), NULL)
- `status` (String(20), NOT NULL, INDEX)
- `total_rows` (Integer, NOT NULL, 기본값 0)
- `processed_rows` (Integer, NOT NULL, 기본값 0)
- `success_rows` (Integer, NOT NULL, 기본값 0)
- `failed_rows` (Integer, NOT NULL, 기본값 0)
- `error_message` (Text, NULL)
- `created_at` (DateTime(timezone=True), NOT NULL)
- `updated_at` (DateTime(timezone=True), NOT NULL)

상태 값:
- `queued`
- `processing`
- `completed`
- `failed`

비고:
- 업로드 파일/결과 파일은 DB BLOB이 아닌 파일 경로로 관리한다.
- API 시작 시 `Base.metadata.create_all()`로 테이블을 생성한다.

## 2. 클라이언트 저장소
개별조회 기록은 현재 서버 DB가 아니라 브라우저 `localStorage`를 사용한다.

키:
- `autolv_search_history_v1`

구조:
```json
[
  {
    "id": "1700000000000-ab12cd",
    "ownerKey": "user@example.com",
    "시각": "2026-03-02T10:20:30.000Z",
    "유형": "지번",
    "주소요약": "서울특별시 강남구 도곡동 970",
    "결과": [
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
]
```

## 3. 파일 저장소
- 기본 경로: `apps/api/storage/bulk`
- 업로드 파일: `uploads/{job_id}_{원본파일명}`
- 결과 파일: `results/{job_id}_{원본파일명}_result.xlsx`

## 4. 초기화/시드
명령:
```bash
cd apps/api
python scripts/reset_db_and_seed_admin.py
```

효과:
- DB 초기화(drop/create)
- 관리자 계정 생성
  - 이메일: `admin@admin.com`
  - 비밀번호: `admin1234`

## 5. 다음 단계 (TO-BE)
- 조회기록 서버 영구 저장 테이블 추가
- PostgreSQL/PostGIS 전환(`parcels`, 공간 인덱스)
- Redis 캐시 도입(PNU/지도 조회 성능 최적화)
