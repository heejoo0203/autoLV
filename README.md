# Pilji-Lab

필지랩은 개별 필지 조회, 지도 기반 조회, 구역 분석, 파일 일괄 처리, 이용내역 재열람을 하나의 흐름으로 묶은 토지 작업 도구다. 현재 저장소 기준 운영 범위는 `web + api + mobile wrapper + vworld proxy`다.

기준일: `2026-03-16`

## What It Does
- 개별 조회: 지번/도로명 기반 공시지가 조회, 연도별 이력, 토지특성 확인
- 지도 조회: Kakao Maps 기반 클릭 조회, 주소 검색, 지적도 토글, CSV 내보내기
- 구역 분석: 폴리곤 분석, 포함/경계/제외 판정, 저장, 비교, 리뷰
- 파일 처리: 최대 `10,000행` 비동기 처리, 진행률 확인, 결과 다운로드
- 이용내역: 조회 기록 복원, 필터링, 정렬, 선택 삭제
- 계정 관리: 회원가입, 로그인, 비밀번호 변경, 탈퇴
- 모바일: Capacitor Android wrapper 제공

## Applications
- `apps/web`: Next.js 웹 애플리케이션
- `apps/api`: FastAPI API, Alembic, bulk worker 스크립트
- `apps/mobile`: Capacitor Android wrapper
- `infra/vworld-proxy`: VWorld 고정 IP 우회 프록시

## Stack
- Web: `Next.js 15`, `React 19`, `TypeScript`, `Tailwind CSS`
- API: `FastAPI`, `SQLAlchemy`, `Alembic`
- Data: `PostgreSQL`, `PostGIS`, `Redis`, local `SQLite`
- External: `VWorld`, `Kakao Maps`, 건축물대장 API
- Deploy: `Vercel`, `Railway`, `Neon`, `AWS EC2`

## Current Verification
- Web: `cd apps/web && npm run qa:smoke`
- API lookup smoke: `cd apps/api && python scripts/run_accuracy_golden_set.py`
- API zone smoke: `cd apps/api && python scripts/run_zone_flow_smoke.py`
- Zone benchmark: `cd apps/api && python scripts/benchmark_zone_analysis.py --preset mapo-small --runs 5 --warmup 2`

현재 운영 기준 검증 상태:
- Web `qa:smoke` 통과
- API 기본조회 골든셋 `7/7` 통과
- API 구역분석 smoke `6/6` 통과
- Railway `/health` `200`, 로그인/`/api/v1/auth/me` 확인

## Repository Layout
```text
Pilji-Lab/
  apps/
    api/
    web/
    mobile/
    worker/
  docs/
    assets/
    releases/
  infra/
    docker/
    vworld-proxy/
  packages/
    shared/
  README.md
```

주요 경로:
- API entry: `apps/api/app/main.py`
- 지도 화면: `apps/web/app/(main)/map/page.tsx`
- bulk worker: `apps/api/scripts/run_bulk_worker.py`
- 배포 설정: `apps/api/railway.json`
- 성능 benchmark: `apps/api/scripts/benchmark_zone_analysis.py`

## Local Setup
```bash
git clone https://github.com/heejoo0203/Pilji-Lab.git
cd Pilji-Lab
```

### 1. API
```bash
cp apps/api/.env.example apps/api/.env
cd apps/api
pip install -r requirements.txt
python scripts/run_migrations.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

필수 체크:
- 첫 운영 배포에서는 `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `ADMIN_SEED_NAME` 설정 필요
- 로컬 기본 DB는 `SQLite`, 구역분석 smoke와 benchmark는 `PostgreSQL/PostGIS` 기준

### 2. Web
```bash
cp apps/web/.env.example apps/web/.env.local
cd apps/web
npm install
npm run dev:clean
```

### 3. Bulk Worker
```bash
cd apps/api
python scripts/run_bulk_worker.py
```

### 4. Android Wrapper
```bash
cd apps/mobile
npm install
npx cap sync android
```

## Deployment
- Web: Vercel (`apps/web`)
- API: Railway (`apps/api`)
- Worker: Railway 별도 프로세스 (`apps/api/scripts/run_bulk_worker.py`)
- Database: Neon PostgreSQL + PostGIS
- Cache/Queue: Redis
- Proxy: AWS EC2 (`infra/vworld-proxy`)

배포 시 핵심 포인트:
- Railway API `Root Directory`: `apps/api`
- Railway Health Check: `/health`
- 관리자 시드는 첫 운영 배포에서 필수
- VWorld 직접 호출이 불안정하면 프록시 경로 사용

상세 배포 문서: [docs/06-deployment.md](docs/06-deployment.md)

## Operational Notes
- 인증은 HttpOnly 쿠키 기반 세션을 사용한다.
- 모바일 인증 안정화를 위해 same-origin API 프록시를 사용한다.
- 구역분석은 PostGIS 기반 공간 계산을 우선하고, AI는 보조 추천 계층으로만 사용한다.
- 최근 기준으로 구역분석 benchmark는 동일 `mapo-small` 시나리오에서 baseline 대비 median `10.01초 -> 4.64초`, p95 `15.37초 -> 5.91초` 개선을 확인했다.

## Documentation
- [Requirements](docs/01-requirements.md)
- [Architecture](docs/02-system-architecture.md)
- [API Spec](docs/03-api-spec.md)
- [DB Schema](docs/04-db-schema.md)
- [Folder Structure](docs/05-folder-structure.md)
- [Deployment](docs/06-deployment.md)
- [Latest Release](docs/releases/v2.2.1.md)

## Related Notes
- API 상세 실행: [apps/api/README.md](apps/api/README.md)
- Web 실행: [apps/web/README.md](apps/web/README.md)
- Mobile wrapper: [apps/mobile/README.md](apps/mobile/README.md)
