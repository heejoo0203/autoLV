# 배포 가이드

기준일: `2026-03-11`

## 1. 배포 구성
- Web: Vercel (`apps/web`)
- API: Railway (`apps/api`)
- Worker: Railway 별도 프로세스 (`apps/api/scripts/run_bulk_worker.py`)
- Database: Neon PostgreSQL + PostGIS
- Cache/Queue: Redis
- Proxy: AWS EC2 (`infra/vworld-proxy`)

## 2. 배포 순서
1. PostgreSQL과 Redis를 준비한다.
2. API 환경변수를 설정하고 마이그레이션을 실행한다.
3. API 서비스를 배포한다.
4. bulk worker를 별도 프로세스로 배포한다.
5. 웹 환경변수를 설정하고 Vercel에 배포한다.
6. VWorld 직접 호출이 불안정하면 프록시를 배포한다.

## 3. 필수 환경변수
### 3.1 API
```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CORS_ORIGINS=https://auto-lv.vercel.app
JWT_SECRET_KEY=...
JWT_REFRESH_SECRET_KEY=...
VWORLD_API_KEY=...
VWORLD_API_DOMAIN=https://auto-lv.vercel.app
VWORLD_REFERER=https://auto-lv.vercel.app
BLD_HUB_SERVICE_KEY=...
MAIL_DELIVERY_MODE=smtp
MAIL_FROM=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
```

구역 분석과 bulk 처리:
```env
MAP_ZONE_OVERLAP_THRESHOLD=0.9
MAP_ZONE_MAX_VERTICES=100
MAP_ZONE_MAX_AREA_SQM=5000000
MAP_ZONE_AI_ENABLED=true
BULK_EXECUTION_MODE=queue
BULK_QUEUE_NAME=piljilab:bulk:jobs
BULK_QUEUE_PROCESSING_NAME=piljilab:bulk:jobs:processing
```

선택:
```env
VWORLD_PROXY_URL=http://<elastic-ip>:8080/vworld-proxy
VWORLD_PROXY_TOKEN=<shared-token>
```

### 3.2 Web
```env
NEXT_PUBLIC_API_BASE_URL=https://<railway-domain>
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=<kakao-js-key>
NEXT_PUBLIC_MAP_CENTER_LAT=37.5662952
NEXT_PUBLIC_MAP_CENTER_LNG=126.9779451
```

## 4. 마이그레이션
```bash
cd apps/api
pip install -r requirements.txt
python scripts/run_migrations.py
```

검증:
- `users`
- `email_verifications`
- `bulk_jobs`
- `query_logs`
- `parcels`
- `zone_analyses`
- `zone_analysis_parcels`
- `building_register_caches`
- `zone_ai_feedbacks`

## 5. 서비스별 배포 기준
### 5.1 Vercel
- Root Directory: `apps/web`
- Install Command: `npm install`
- Build Command: `npm run build`

### 5.2 Railway API
- Root Directory: `apps/api`
- Dockerfile: `apps/api/Dockerfile`
- Health Check: `/health`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### 5.3 Railway Worker
- Root Directory: `apps/api`
- Start Command: `python scripts/run_bulk_worker.py`

### 5.4 EC2 Proxy
- 경로: `infra/vworld-proxy`
- systemd 예시: `infra/vworld-proxy/deploy/autolv-vworld-proxy.service`

## 6. 배포 후 확인
### 6.1 Web
1. `/features`
2. `/search`
3. `/map`
4. `/files`
5. `/history`
6. `/mypage`
7. `/privacy`
8. `/account-deletion`

### 6.2 API
1. `GET /health`
2. `POST /api/v1/auth/login`
3. `POST /api/v1/land/single`
4. `POST /api/v1/map/click`
5. `POST /api/v1/map/zones/analyze`
6. `GET /api/v1/bulk/guide`

## 7. 롤백
1. 웹과 API를 직전 태그 또는 직전 커밋으로 되돌린다.
2. DB 장애가 원인이면 백업을 복원하고 `alembic_version`을 확인한다.
3. 핵심 시나리오를 다시 검증한다.
4. 구역 추천 계층이 원인이면 `MAP_ZONE_AI_ENABLED=false`로 비활성화한다.
