# 시스템 아키텍처

## 1. 현재 아키텍처 (AS-IS, v1.0.0)
- Frontend: Next.js 15 (App Router), TypeScript
- Backend: FastAPI (Railway)
- Database: PostgreSQL (운영), SQLite (로컬 개발)
- File Storage: API 로컬 스토리지(`apps/api/storage/bulk`, `apps/api/storage/profile_images`)
- External API: VWorld (주소 변환 + 개별공시지가)
- 안정화 구성: EC2 고정 IP VWorld 프록시(`infra/vworld-proxy`)
- Road Data: `docs/TN_SPRD_RDNM.txt` (도로명 자음/목록 필터링)
- Client History: 브라우저 `localStorage`(개별조회 기록)

## 2. 주요 데이터 흐름
### 2.1 인증
1. Web -> API `/api/v1/auth/*` 요청
2. API가 사용자 검증 후 쿠키(`access_token`, `refresh_token`) 발급
3. Web은 쿠키 기반으로 로그인 상태를 유지

### 2.2 개별조회(지번/도로명)
1. Web이 검색 조건을 `/api/v1/land/single`로 전송
2. API가 검색 유형별로 PNU를 생성/변환
3. API가 VWorld API를 직접 호출
4. 직접 호출 실패 시 EC2 프록시(`VWORLD_PROXY_URL`)로 자동 우회
5. API가 연도별 최신 데이터만 선별해 내림차순 반환
6. Web이 결과 테이블 렌더링, 로그인 사용자는 조회기록 저장

### 2.3 도로명 선택기
1. Web이 `/api/v1/land/road-initials`로 시/도, 시/군/구 요청
2. API가 `TN_SPRD_RDNM.txt`에서 해당 지역 도로명 초성 집합을 계산
3. Web이 선택한 초성으로 `/api/v1/land/road-names` 호출
4. API가 실제 존재하는 도로명 목록만 반환

### 2.4 파일조회(v1)
1. Web이 `/api/v1/bulk/template`, `/api/v1/bulk/guide`로 양식/안내를 조회
2. 사용자가 파일 업로드 시 `/api/v1/bulk/jobs`로 작업 생성
3. API가 파일 저장 후 BackgroundTasks로 처리 시작
4. 처리 중 진행도는 `bulk_jobs`에 누적
5. Web이 `/api/v1/bulk/jobs` 폴링으로 상태/이력 표시
6. 완료 시 `/api/v1/bulk/jobs/{job_id}/download`로 결과 다운로드
7. 이력 정리는 `/api/v1/bulk/jobs/delete`로 다중 삭제

### 2.5 VWorld 복원력(Resilience) 경로
1. 1차 시도: API -> VWorld 직접 호출
2. 실패 시: API -> EC2 Proxy -> VWorld
3. 둘 다 실패하면 API는 `VWORLD_DIRECT_AND_PROXY_FAILED` 오류와 함께 직접/프록시 실패 원인을 동시 반환

## 3. 아키텍처 다이어그램
현재 다이어그램은 사용자/프론트/백엔드의 흐름을 한눈에 볼 수 있도록 유지한다.

![시스템 아키텍처](./architecture.svg)

## 4. 배포 기준 아키텍처 (v1)
- Web: Vercel
- API: Railway
- DB: Railway PostgreSQL
- VWorld 우회: AWS EC2(Seoul) + Elastic IP + FastAPI Proxy
- API 환경변수로 VWorld 키/도메인/CORS/프록시를 제어
- 운영 DB는 PostgreSQL + Alembic 마이그레이션으로 관리
- 업로드/결과/프로필 이미지 저장 경로를 런타임에서 보존
- 헬스체크: `GET /health`

## 5. 다음 단계 (TO-BE)
- 지도조회 2단계: Kakao Map + PostgreSQL/PostGIS + Redis 캐시
- 공간 집계 2단계: 폴리곤 기반 집계 API(`/aggregate`)
- 조회기록 서버 영구 저장 전환(localStorage -> DB)
