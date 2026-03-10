# 시스템 아키텍처 (2026-03-10 기준, v3.0 준비 중)

> 최신 안정 릴리즈는 `v2.2.1`이고, 현재 브랜치에는 건축물 지표와 휴리스틱 AI 보조 계층까지 반영돼 있다.

## 0. 제품 시스템 관점
- 필지랩은 `조회 웹사이트`보다 `정확도 중심 필지·구역 작업 시스템`에 가깝다.
- 현재 아키텍처는 다음 흐름을 안정적으로 연결하는 것을 목표로 한다.
  - 개별 필지 확인
  - 지도 기반 탐색
  - 구역 분석/검토
  - 파일 일괄 분석
  - 저장/이력/비교
- 모든 새 UI/워크플로우는 desktop, tablet, mobile을 함께 고려해야 하며, 모바일은 단순 표시가 아니라 usable 수준을 목표로 한다.

## 1. 아키텍처 개요
- Frontend(Web): Next.js 15 (App Router), TypeScript, Tailwind
- Frontend(App): Capacitor Android Wrapper (`apps/mobile`)
- Backend: FastAPI (Railway)
- Database: PostgreSQL (Neon/Railway), 로컬 SQLite
- Spatial: PostGIS (`geog`, `geom`)
- Cache/Queue: Redis (좌표->PNU 캐시, 토지 메타데이터 캐시, bulk queue)
- AI Assist:
  - 현재: 휴리스틱 추천 엔진 + 이상치 탐지 + 추천 피드백 저장
  - 예정: 경계 보정 알고리즘 + 경계 필지 추천 ML + 설명 LLM
- External API:
  - VWorld (주소/좌표/공시지가/토지특성)
  - Kakao Maps JS SDK (지도 렌더링)
- Web Edge Helper:
  - Next Route Handler 기반 same-origin VWorld proxy (`apps/web/app/api/vworld-proxy/route.ts`)
- Network Fallback: AWS EC2 고정 IP VWorld 프록시 (`infra/vworld-proxy`)
- Reference Data:
  - 법정동 코드: `apps/web/public/ld_codes.json`
  - 도로명 원본: `docs/TN_SPRD_RDNM.txt`

## 2. 런타임 구성
### 2.1 Web 계층
- 페이지
  - `/features` (비로그인 기본 랜딩)
  - `/search` (개별조회)
  - `/map` (지도조회, 기본조회는 비로그인 가능 / 구역조회는 로그인 필요)
  - `/files` (파일조회, 로그인 필요)
  - `/history` (조회기록, 로그인 필요)
  - `/mypage` (계정관리, 로그인 필요)
  - `/privacy`, `/account-deletion` (운영/스토어 정책 페이지)
- 인증 상태에 따라 상단 네비게이션 노출 범위가 달라진다.
- `/map`은 일반 콘텐츠 페이지가 아니라 map-first workspace로 동작하며, 검색/툴바/결과는 오버레이 UI로 노출된다.
- Web에는 `/api/vworld-proxy` 라우트가 있으며, same-origin 프록시가 필요할 때만 보조적으로 사용한다.

### 2.2 API 계층
- 인증/계정: `/api/v1/auth/*`
- 개별조회: `/api/v1/land/*`
- 파일조회: `/api/v1/bulk/*`
- 조회기록: `/api/v1/history/*`
- 지도조회: `/api/v1/map/*`
- 헬스체크: `/health`

### 2.3 저장 계층
- `users`: 계정/약관/연락처/프로필
- `email_verifications`: 이메일 인증 코드 수명주기
- `bulk_jobs`: 대량조회 작업 상태/결과 경로
- `query_logs`: 개별/지도 조회기록
- `parcels`: 지도 조회 캐시 + 공간 질의 기초 데이터
- `zone_analyses`, `zone_analysis_parcels`: 저장된 구역 분석 결과
- `building_register_caches`: 건축물대장 정규화 캐시
- `zone_ai_feedbacks`: AI 추천 대비 사용자 최종 결정 이력
- `raw / normalized / serving` 3계층은 현재 일부만 반영되었고, v3 단계에서 확장 예정
- 파일 스토리지
  - 업로드/결과: `apps/api/storage/bulk`
  - 프로필 이미지: `apps/api/storage/profile_images`

## 3. 핵심 데이터 흐름
### 3.1 회원가입/로그인
1. Web -> `/auth/email-availability`로 이메일 중복 확인
2. Web -> `/auth/recovery/send-code`로 회원가입 인증코드 발송
3. Web -> `/auth/register`로 가입 완료(약관 동의 포함)
4. Web -> `/auth/login` 성공 시 HttpOnly 쿠키 발급
5. Web -> `/auth/me`로 세션 검증

### 3.2 개별조회
1. 사용자 입력(지번/도로명) -> `/land/single`
2. API가 PNU 생성/변환 후 VWorld 조회
3. 실패 시 직접 호출 -> 프록시 호출 순으로 재시도
4. 연도별 행을 정규화/정렬 후 반환
5. 로그인 사용자는 `/history/query-logs`에 저장

### 3.3 파일조회
1. `/bulk/guide`, `/bulk/template`로 업로드 준비
2. `/bulk/jobs` 업로드(비동기 작업 생성)
3. 백그라운드 처리:
   - 헤더 자동 매핑/정규화
   - 유니크 주소 키 병렬 조회
   - 5행 단위 진행률 업데이트
   - 결과 파일 생성
   - Redis queue 사용 시 API와 worker 분리 실행
4. `/bulk/jobs` 폴링으로 상태/이력 확인
5. `/bulk/jobs/{id}/download`로 완료 작업 결과 다운로드

### 3.4 지도조회
1. Web에서 Kakao 지도 클릭 또는 주소 입력
2. `/map/click` 또는 `/map/search` 호출
3. API 내부 처리:
   - 좌표->PNU 역지오코딩
   - Redis PNU 캐시 활용
   - `parcels` 캐시 조회
   - 필요 시 VWorld 실시간 조회
   - 증감률/면적×단가/인근 평균(200m) 계산
4. 필요 시 `/map/price-rows`, `/map/land-details` 추가 조회
5. `/map/export` CSV 다운로드
6. 결과를 `/history/query-logs`(search_type=`map`)에 저장

### 3.5 구역조회(폴리곤)
1. 로그인 사용자가 지도조회 화면의 `구역 조회` 모드에서 폴리곤 꼭짓점을 선택
2. `/map/zones/analyze` 호출로 미리보기 분석 수행 (자동 저장 없음)
3. API 내부 처리:
   - 폴리곤 정규화/검증(`ST_IsValid`)
   - 면적 제한 검사(`ST_Area`)
   - VWorld 지적도 피처 조회(`/req/data`, `LP_PA_CBND_BUBUN`)
   - `parcels` 지오메트리 업서트
   - PostGIS 교차 계산(`ST_Intersection`)
   - 필지별 `overlap_area_sqm`, `overlap_ratio`, `centroid_in`, `adjacency_bonus` 계산
   - 규칙 기반 + 점수 기반 포함 판정
     - `overlap_ratio >= threshold` -> 확정 포함
     - `score >= 0.8` -> 자동 포함
     - `0.5 <= score < 0.8` -> 경계 후보
     - 그 외 -> 제외
   - 최신연도 기준 합계/면적 기반 금액 집계
     - 포함 필지 기준 총가치
     - 구역 내부(교집합) 기준 총가치
   - 건축물대장 API(`getBrTitleInfo`, 필요 시 `getBrRecapTitleInfo`) 조회
   - `building_register_caches` 캐시 적재
   - 노후도/총연면적/총대지면적/평균 용적률/과소필지 비율 계산
   - 휴리스틱 AI 추천(`included | uncertain | excluded`) 생성
   - AI 추천 사유/신뢰도/이상치 수준 계산
4. 사용자가 `구역 저장`을 누르면 `/map/zones` 호출로 `zone_analyses`, `zone_analysis_parcels`에 영속 저장
5. 프론트에서 요약 카드 + 필지 목록 + 선택 제외 + 저장 구역 사이드바 + CSV 다운로드 제공
6. 결과 화면에서는 사실값/계산값/추정값 구분 안내를 함께 제공한다.
7. 리뷰 워크플로우는 `확정 포함 / 경계 후보 / 제외 / 이상치`를 작업 큐처럼 검토할 수 있는 방향으로 발전시킨다.
8. 현재 레포에는 `apps/worker` placeholder가 있으나, 실제 bulk worker 런타임은 아직 `apps/api/scripts/run_bulk_worker.py`가 담당한다.

### 3.6 구역 정확도 향상 보조 계층 (현재)
1. 사용자가 폴리곤을 그리면 기본 PostGIS 분석이 먼저 실행된다.
2. 기본 포함 규칙(`overlap_ratio >= 0.9`)과 score 기반 규칙으로 1차 포함/경계/제외 필지를 분류한다.
3. 휴리스틱 AI 계층이 각 필지에 대해 `included | uncertain | excluded` 추천과 `ai_confidence_score`를 생성한다.
4. AI 계층은 추천 사유(`ai_reason_codes`, `ai_reason_text`)와 이상치 수준(`anomaly_level`)을 함께 계산한다.
5. 프론트는 `AI 추천 적용`, `선택 포함`, `선택 삭제` 액션으로 사용자가 최종 확정하도록 구성된다.
6. 사용자의 수동 반영 결과는 `zone_ai_feedbacks`에 저장된다.
7. 기능 플래그(`MAP_ZONE_AI_ENABLED`)로 AI 보조 계층을 즉시 비활성화할 수 있다.

비고:
- 최종 금액/면적 계산은 계속 PostGIS와 공식 공시지가 데이터가 담당한다.
- AI 계층은 추천과 설명만 수행하고, 최종 값 계산 엔진을 대체하지 않는다.

### 3.7 정확도 중심 데이터 계층 (TO-BE)
1. `raw`
   - VWorld 원문 응답 저장
   - 건축물대장 원문 응답 저장
2. `normalized`
   - PNU 패딩/정규화
   - 사용승인년도 숫자화
   - 세대수/용적률/주용도 표준화
3. `serving`
   - 화면 조회용 캐시
   - 집계/다운로드용 결과셋

비고:
- 운영 장애/이상치 분석과 재현성 확보를 위해 이 3계층 분리가 필요하다.

### 3.8 조회기록
1. `/history/query-logs`로 최신순 목록 조회
2. 유형/시도/시군구 필터 및 정렬(`created_at`, `address_summary`, `search_type`, `result_count`)
3. 다중 선택 삭제는 `/history/query-logs/delete`로 처리
4. 항목 클릭 시:
   - `jibun|road` -> `/search?recordId=...`
   - `map` -> `/map?recordId=...`

### 3.9 파일조회(품질 관리 워크플로우)
1. 업로드 후 단순 성공/실패만 보여주는 것이 아니라, 실패 원인을 사용자가 바로 재작업할 수 있는 수준으로 진단해야 한다.
2. 현재 구조는 `queue -> worker -> processor -> result writer`로 분리돼 있으며, 다음 단계에서 오류 유형 분류/중복 감지/실패 행 재처리 UX를 강화한다.
3. 모바일에서는 전체 업로드 작업을 수행하기보다 상태/성공률/실패 요약 확인이 중심이 된다.

### 3.10 저장/비교/재활용 흐름
1. 저장 구역과 조회기록은 일회성 로그가 아니라, 다시 불러와 비교하고 재검토할 수 있는 작업 결과로 다룬다.
2. 현재는 저장 구역/이용내역/비교 카드 수준까지 구현돼 있고, 장기적으로 프로젝트/워크스페이스 도메인으로 확장할 수 있게 구조를 유지한다.
3. 스냅샷 비교는 사용자에게 “이전 결과와 무엇이 달라졌는지”를 설명하는 방향으로 발전해야 한다.

## 4. 장애 복원력
- VWorld 직접 호출 실패 시 EC2 프록시 경유 재시도
- 에러 응답에 직접 호출/프록시 호출 실패 원인을 함께 반환
- `DATABASE_URL` 정규화(`postgresql://` -> `postgresql+psycopg://`)로 배포 환경 호환성 확보
- 도로명/법정동 파일 경로 자동 탐색 로직으로 monorepo/단독배포 모두 지원

## 5. 아키텍처 다이어그램
![시스템 아키텍처](./architecture.svg)

## 6. 다음 단계(TO-BE)
- 이번 주 우선순위:
  - 지도조회/구역조회 워크스페이스 완성도 향상
  - 파일조회 품질 진단 UX 강화
  - 이용내역/저장 결과의 작업 시스템화
  - 상태/오류/신뢰도 표현 정리
  - 모바일 usable 수준 강화
- 건축물대장 기반 사업성 분석 2차 고도화
  - 건축물 상세 팝업(사용승인일/구조/주용도/대지면적/연면적)
  - 주택접도율 계산 로직
  - 무허가건축물 포함 여부 데이터 연계
  - 토지이용계획 API와 결합한 법적 상한 용적률 비교
- 구역 정확도 향상 보조 계층 추가
  - 필지 경계 스냅/보정 서비스
  - 경계 필지 추천 ML 추론 서비스
  - 추천 피드백 저장 및 재학습 데이터셋 구성
  - 설명/리포트 전용 LLM 계층
- 구역조회 이력 페이지(구역명 검색/재열람/비교) 추가
- 프로젝트/작업 공간 계층 도입
  - 프로젝트 생성
  - 관련 필지/구역 묶기
  - 메모/검토 상태/버전 관리
- 운영 지표 수집(에러율, VWorld 실패율, 프록시 사용률, 구역분석 성공률)
- 정확도 검증 루프
  - 골든셋
  - 버전별 결과 비교
  - 추천 채택률/수정률
  - 오포함/누락 패턴 분석
- 소셜 로그인(네이버/카카오)
