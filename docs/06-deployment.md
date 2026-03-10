# 배포 가이드 (2026-03-10 기준)

## 0. 현재 배포 상태
- 최신 안정 릴리즈 노트: `docs/10-release-notes-v2.2.1.md`
- 최신 안정 릴리즈: `v2.2.1` (`2026-03-07`)
- 현재 작업 브랜치 상태: `v3.0 준비 중`
- 현재 문서 기준 범위:
  - Web: 개별조회, 지도조회, 구역조회, 파일조회, 이용내역, 마이페이지, 정책 페이지
  - API: 인증, 조회, 파일 비동기 처리, 구역 저장/비교/리뷰, 건축물 지표, 휴리스틱 AI 보조
  - Mobile: Android wrapper(APK/AAB)

## 1. 배포 토폴로지
- Web: Vercel (`apps/web`)
- API: Railway (`apps/api`)
- DB: Neon PostgreSQL + PostGIS
- Cache/Queue: Redis
- VWorld 우회: AWS EC2 고정 IP 프록시 (`infra/vworld-proxy`)
- 선택 보조 경로: Vercel same-origin proxy (`apps/web/app/api/vworld-proxy/route.ts`)

## 2. 사전 준비
### 2.1 외부 키와 계정
- VWorld API Key
- Kakao Maps JavaScript Key
- 건축물대장 API 서비스 키
- SMTP 계정
- PostgreSQL(PostGIS) 연결 문자열
- Redis URL

### 2.2 도메인 등록
- 운영 웹 도메인: `https://auto-lv.vercel.app`
- Kakao 등록 도메인: `auto-lv.vercel.app`
- VWorld 등록 서비스 URL: `https://auto-lv.vercel.app`

## 3. 환경변수
### 3.1 API (`apps/api`)
필수 핵심:
```env
CORS_ORIGINS=https://auto-lv.vercel.app
DATABASE_URL=postgresql://...
JWT_SECRET_KEY=...
JWT_REFRESH_SECRET_KEY=...
COOKIE_SECURE=true
COOKIE_SAMESITE=none
VWORLD_API_KEY=...
VWORLD_API_DOMAIN=https://auto-lv.vercel.app
VWORLD_API_BASE_URL=https://api.vworld.kr
VWORLD_TIMEOUT_SECONDS=15
VWORLD_RETRY_COUNT=2
VWORLD_RETRY_BACKOFF_SECONDS=0.35
VWORLD_USER_AGENT=PiljiLab/1.0 (+https://auto-lv.vercel.app)
VWORLD_REFERER=https://auto-lv.vercel.app
ROAD_NAME_FILE_PATH=
LD_CODE_FILE_PATH=
REDIS_URL=redis://...
MAIL_DELIVERY_MODE=smtp
MAIL_FROM=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_USE_TLS=true
SMTP_USE_SSL=false
```

구역 분석/건축물/AI:
```env
BLD_HUB_API_BASE_URL=https://apis.data.go.kr/1613000/BldRgstHubService
BLD_HUB_SERVICE_KEY=...
BLD_HUB_TIMEOUT_SECONDS=20
BLD_HUB_RETRY_COUNT=2
BLD_HUB_RETRY_BACKOFF_SECONDS=0.3
MAP_NEARBY_RADIUS_M=200
REDIS_PNU_TTL_SECONDS=86400
MAP_PRICE_CACHE_TTL_SECONDS=86400
MAP_ZONE_OVERLAP_THRESHOLD=0.9
MAP_ZONE_MAX_VERTICES=100
MAP_ZONE_MAX_AREA_SQM=5000000
MAP_ZONE_QUERY_TIMEOUT_MS=30000
MAP_ZONE_VWORLD_PAGE_SIZE=1000
MAP_ZONE_VWORLD_MAX_PAGES=50
MAP_ZONE_MAX_INCLUDED_PARCELS=3000
MAP_ZONE_BBOX_SPLIT_MAX_DEPTH=4
MAP_ZONE_LAND_METADATA_SYNC_LIMIT=80
MAP_ZONE_LAND_METADATA_WORKERS=6
MAP_ZONE_AGED_BUILDING_YEARS=30
MAP_ZONE_UNDERSIZED_PARCEL_THRESHOLD_SQM=90
MAP_ZONE_BUILDING_CACHE_TTL_HOURS=720
MAP_ZONE_BUILDING_WORKERS=10
MAP_ZONE_AI_ENABLED=true
MAP_ZONE_AI_INCLUDE_THRESHOLD=0.82
MAP_ZONE_AI_UNCERTAIN_THRESHOLD=0.55
```

Bulk worker:
```env
BULK_EXECUTION_MODE=queue
BULK_QUEUE_NAME=piljilab:bulk:jobs
BULK_QUEUE_PROCESSING_NAME=piljilab:bulk:jobs:processing
BULK_WORKER_POLL_SECONDS=5
BULK_LOOKUP_WORKERS=6
BULK_PROGRESS_UPDATE_MIN_SECONDS=1.0
```

선택:
```env
VWORLD_PROXY_URL=http://<EC2_IP>:8080/vworld-proxy
VWORLD_PROXY_TOKEN=<shared-token>
PROFILE_IMAGE_DIR=./storage/profile_images
BULK_STORAGE_DIR=./storage/bulk
EMAIL_DEBUG_RETURN_CODE=false
```

비고:
- `DATABASE_URL`은 내부에서 `postgresql+psycopg://`로 정규화된다.
- `ROAD_NAME_FILE_PATH`, `LD_CODE_FILE_PATH`는 비워 두면 저장소 기준 자동 탐색한다.

### 3.2 Web (`apps/web`)
필수:
```env
NEXT_PUBLIC_API_BASE_URL=https://<railway-api-domain>
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=<kakao-js-key>
NEXT_PUBLIC_MAP_CENTER_LAT=37.5662952
NEXT_PUBLIC_MAP_CENTER_LNG=126.9779451
```

선택: same-origin VWorld proxy route 사용 시
```env
VWORLD_API_BASE_URL=https://api.vworld.kr
VWORLD_API_DOMAIN=https://auto-lv.vercel.app
VWORLD_API_KEY=<vworld-key>
VWORLD_REFERER=https://auto-lv.vercel.app
VWORLD_PROXY_TOKEN=<shared-token>
```

비고:
- `apps/web/app/api/vworld-proxy/route.ts`는 Vercel 함수로 동작한다.
- 주된 조회 경로는 여전히 FastAPI 서버이며, Web proxy는 브라우저 same-origin 보조 경로다.

## 4. DB 마이그레이션
공통:
```bash
cd apps/api
pip install -r requirements.txt
python scripts/run_migrations.py
```

검증:
- `alembic_version` 존재
- `users`, `email_verifications`, `bulk_jobs`, `query_logs`, `parcels`, `zone_analyses`, `zone_analysis_parcels`, `building_register_caches`, `zone_ai_feedbacks` 존재
- Neon에서 `SELECT postgis_version();` 성공

## 5. Vercel 배포
- Root Directory: `apps/web`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: 기본값

배포 후 확인:
1. `/features` 로딩
2. `/search` 비로그인 조회
3. `/map` 비로그인 기본조회
4. 로그인 후 `/map` 구역조회, `/files`, `/history`, `/mypage`
5. `/privacy`, `/account-deletion` 접근

## 6. Railway API 배포
- 서비스 루트: `apps/api`
- 헬스체크: `/health`
- 시작 전에 마이그레이션 선실행 권장

배포 후 확인:
1. `GET /health`
2. `POST /api/v1/auth/login`
3. `POST /api/v1/land/single`
4. `GET /api/v1/bulk/guide`
5. `POST /api/v1/map/click`
6. `POST /api/v1/map/zones/analyze`
7. 구역 응답에 `geometry_assessed_total_price`, `total_building_count`, `undersized_parcel_ratio` 포함
8. 구역 응답에 `ai_model_version`, `ai_report_text`, `selection_origin`, `anomaly_level` 포함

## 6-1. Bulk Worker 배포
- 실제 실행 파일: `apps/api/scripts/run_bulk_worker.py`
- 운영에서는 API와 별도 프로세스 권장

예시:
```bash
cd apps/api
python scripts/run_bulk_worker.py
```

운영 체크:
1. 업로드 직후 `queued`
2. 워커 수신 후 `processing`
3. 완료 시 `completed`와 `result_path` 기록
4. 재시작 후 processing 큐 복구 동작 확인

## 7. VWorld 우회 프록시
적용 조건:
- Railway에서 VWorld 직접 호출이 차단되거나 응답이 불안정한 경우

구성:
1. AWS EC2 + Elastic IP 준비
2. `infra/vworld-proxy` 배포
3. `deploy/autolv-vworld-proxy.service` 등록
4. API 환경변수에 `VWORLD_PROXY_URL`, `VWORLD_PROXY_TOKEN` 설정
5. `ALLOWED_PATH_PREFIXES`에 `/req/data` 포함

권장값:
```env
ALLOWED_PATH_PREFIXES=/ned,/req/address,/req/data
```

검증:
- `curl http://127.0.0.1:8080/health`
- `curl http://<ElasticIP>:8080/health`
- land/map/zone 조회에서 direct 실패 후 proxy fallback 동작

## 8. Android 배포 산출물
- 고정 다운로드 alias:
  - `apps/web/public/downloads/autoLV-android-release.apk`
- 버전 고정 APK:
  - `apps/web/public/downloads/autoLV-android-release-v2.2.0.apk`
- AAB:
  - `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`

앱 정책 페이지:
- 개인정보처리방침: `https://auto-lv.vercel.app/privacy`
- 계정삭제 안내: `https://auto-lv.vercel.app/account-deletion`

## 9. 배포 제외 또는 미사용 디렉터리
- `apps/worker`: 현재 배포 경로 아님
- `packages`: 현재 미사용
- `infra/scripts`, `infra/sql`: 현재 비어 있음
- `backend`, `frontend`, `crawler`: 레거시 보관용

## 10. 운영 점검 체크리스트
1. 인증: 회원가입, 로그인, 로그아웃, 아이디 찾기, 비밀번호 재설정
2. 개별조회: 지번, 도로명 조회
3. 지도조회: 지도 렌더링, 지적도 토글, 클릭조회, 주소검색, 연도별 상세, CSV
4. 구역조회: 폴리곤 분석, 저장, 비교, 리뷰 큐, CSV
5. 사업성 지표: 건축물 수, 노후도, 평균 사용승인년도, 평균 용적률, 과소필지 비율
6. 파일조회: 업로드, 진행률, 결과 다운로드, 선택 삭제, 실패 요약
7. 조회기록: 저장, 필터, 정렬, 복원 이동, 선택 삭제
8. 마이페이지: 이름, 연락처, 이미지 수정, 약관 조회, 탈퇴
9. 모바일 usable: 기본조회, 저장 구역 열람, 파일 상태 확인, 이용내역 재열람

## 11. 롤백 전략
1. Web/API를 이전 태그 또는 커밋으로 롤백
2. DB 문제 시 백업 복원 후 `alembic_version` 정합성 확인
3. 핵심 시나리오 재검증
4. AI 기능 문제가 원인이면 `MAP_ZONE_AI_ENABLED=false`로 우선 비활성화
