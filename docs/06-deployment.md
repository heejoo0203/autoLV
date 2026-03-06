# 배포 가이드 (v2.2.1)

## 0. 릴리스 기준
- 최신 릴리스 노트: `docs/10-release-notes-v2.2.1.md`
- 이전 안정 태그: `v2.2.0`
- 현재 문서 기준 범위:
  - Web v2.x (개별/지도/파일/조회기록/마이페이지/정책 페이지)
  - API v2.x (인증 확장 + 지도조회 + 파일조회 + 기록)
  - Android Wrapper(APK/AAB 배포)
  - 구역조회 미리보기/명시 저장 워크플로우

## 1. 배포 토폴로지
- Web: Vercel (`apps/web`)
- API: Railway (`apps/api`)
- DB: Neon PostgreSQL + PostGIS
- Cache: Redis (Railway)
- VWorld 우회: AWS EC2 고정 IP 프록시 (`infra/vworld-proxy`)

## 2. 사전 준비
### 2.1 외부 키/계정
- VWorld API Key
- Kakao Maps JavaScript Key (도메인 등록 포함)
- SMTP 계정(이메일 인증용)
- Neon(Postgres/PostGIS) DB URL
- Redis URL

### 2.2 도메인 등록
- Vercel 운영 도메인: `https://auto-lv.vercel.app`
- Kakao 도메인 등록: `auto-lv.vercel.app`
- VWorld 서비스 URL 등록: `https://auto-lv.vercel.app`

## 3. 환경변수
### 3.1 API (`apps/api`)
필수:
```env
CORS_ORIGINS=https://auto-lv.vercel.app
DATABASE_URL=postgresql://...           # 자동으로 postgresql+psycopg 변환
JWT_SECRET_KEY=...
JWT_REFRESH_SECRET_KEY=...
COOKIE_SECURE=true
COOKIE_SAMESITE=none
VWORLD_API_KEY=...
VWORLD_API_DOMAIN=https://auto-lv.vercel.app
VWORLD_API_BASE_URL=https://api.vworld.kr
VWORLD_TIMEOUT_SECONDS=15
VWORLD_USER_AGENT=Mozilla/5.0
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

선택(프록시 우회):
```env
VWORLD_PROXY_URL=http://<EC2_ELASTIC_IP>:8080/vworld-proxy
VWORLD_PROXY_TOKEN=<shared-token>
```

향후 v3.x 준비(건축물대장 분석):
```env
BUILDING_LEDGER_API_KEY=<public-data-service-key>
BUILDING_LEDGER_API_BASE_URL=https://apis.data.go.kr
BUILDING_LEDGER_TIMEOUT_SECONDS=15
```

### 3.2 Web (`apps/web`)
```env
NEXT_PUBLIC_API_BASE_URL=https://<railway-api-domain>
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=<kakao-js-key>
NEXT_PUBLIC_MAP_CENTER_LAT=37.5662952
NEXT_PUBLIC_MAP_CENTER_LNG=126.9779451
```

## 4. DB 마이그레이션
### 4.1 로컬/운영 공통
```bash
cd apps/api
pip install -r requirements.txt
python scripts/run_migrations.py
```

### 4.2 운영 권장
- Railway deploy command/startup에 마이그레이션 선실행 구성
- 또는 배포 직후 One-off command로 `python scripts/run_migrations.py` 실행

검증:
- `alembic_version` 존재
- `users`, `email_verifications`, `bulk_jobs`, `query_logs`, `parcels` 존재
- Neon에서 `SELECT postgis_version();` 성공

## 5. Vercel 배포
Root Directory: `apps/web`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: 기본값(비워둠)

배포 후 확인:
1. `/features` 로딩
2. `/search` 비로그인 조회
3. 로그인 후 `/map`, `/files`, `/history`, `/mypage`
4. `/privacy`, `/account-deletion` 접근

## 6. Railway API 배포
- 서비스 루트: `apps/api`
- Python 런타임 + `requirements.txt` 설치
- 헬스체크: `/health`

배포 후 확인:
1. `GET /health` 200
2. `/api/v1/auth/login` 정상
3. `/api/v1/land/single` 정상
4. `/api/v1/bulk/guide` 정상
5. `/api/v1/map/click` 정상

## 7. VWorld 우회 프록시(필요 시)
Railway -> VWorld 직접 호출이 차단/불안정할 때 적용한다.

구성:
1. AWS EC2(ap-northeast-2) + Elastic IP
2. `infra/vworld-proxy` 배포
3. systemd 서비스 등록 (`autolv-vworld-proxy.service`)
4. API env에 `VWORLD_PROXY_URL`, `VWORLD_PROXY_TOKEN` 설정

체크:
- EC2 내부: `curl http://127.0.0.1:8080/health`
- 외부 접근: `curl http://<ElasticIP>:8080/health`
- API에서 land/map 조회 시 프록시 fallback 동작

## 8. Android 배포 산출물
- APK(웹 다운로드 배포용):
  - `apps/web/public/downloads/autoLV-android-release-v2.2.0.apk`
- AAB(Play Console 업로드용):
  - `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`

앱 정책 페이지:
- 개인정보처리방침: `https://auto-lv.vercel.app/privacy`
- 계정삭제 안내: `https://auto-lv.vercel.app/account-deletion`

## 9. 운영 점검 체크리스트
1. 인증: 회원가입/로그인/로그아웃/아이디찾기/비밀번호재설정
2. 개별조회: 지번/도로명 조회
3. 지도조회: 지도 렌더링/클릭/주소검색/CSV/상세조회
4. 파일조회: 업로드/진행률/다운로드/삭제
5. 조회기록: 저장/필터/정렬/페이지 이동 복원/선택 삭제
6. 마이페이지: 이름/연락처/이미지 수정, 약관 확인, 탈퇴

## 10. 롤백 전략
1. Web/API를 이전 커밋 또는 태그로 롤백
2. DB 문제 시 백업 복원 후 `alembic_version` 정합성 점검
3. 핵심 시나리오(인증/조회/파일/지도) 재검증
