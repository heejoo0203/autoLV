# v1 배포 가이드 (DB + 배포)

## 0. 릴리즈 기준
- 배포 스냅샷 태그: `v1.0.0`
- 릴리즈 날짜: `2026-03-02`
- 릴리즈 노트: `docs/07-release-notes-v1.0.0.md`

## 1. 배포 목표
v1 릴리스 범위(개별조회, 인증/계정관리, 파일조회)를 운영 환경에서 안정적으로 서비스한다.

## 2. 배포 범위 (v1)
- 개별조회(지번/도로명)
- 회원가입/로그인/로그아웃/내 정보 조회
- 회원정보 수정(사진/닉네임), 비밀번호 변경, 회원 탈퇴
- 파일조회(양식 다운로드, 업로드, 비동기 처리, 이력, 결과 다운로드)
- 조회기록(localStorage)

제외:
- 지도조회(2단계)
- 폴리곤 집계(2단계)

## 3. DB 전략
- 개발 로컬: SQLite (`sqlite:///./autolv.db`)
- 운영 배포: PostgreSQL (`postgresql+psycopg://...`)
- 스키마 관리: Alembic (`apps/api/alembic`)

초기 마이그레이션:
- `20260302_0001` (`users`, `bulk_jobs`)

## 4. 환경변수
### 4.1 API (`apps/api/.env`)
```env
CORS_ORIGINS=https://auto-lv.vercel.app
DATABASE_URL=postgresql+psycopg://autolv:your_password@db-host:5432/autolv
JWT_SECRET_KEY=replace-with-strong-secret
JWT_REFRESH_SECRET_KEY=replace-with-strong-refresh-secret
ACCESS_TOKEN_EXP_MINUTES=60
REFRESH_TOKEN_EXP_DAYS=14
COOKIE_SECURE=true
COOKIE_SAMESITE=none
VWORLD_API_BASE_URL=https://api.vworld.kr
VWORLD_API_DOMAIN=https://auto-lv.vercel.app
VWORLD_TIMEOUT_SECONDS=15
VWORLD_USER_AGENT=Mozilla/5.0
VWORLD_REFERER=https://auto-lv.vercel.app
VWORLD_API_KEY=your-real-key
VWORLD_PROXY_URL=http://<EC2_ELASTIC_IP>:8080/vworld-proxy
VWORLD_PROXY_TOKEN=replace-with-strong-shared-token
ROAD_NAME_FILE_PATH=
LD_CODE_FILE_PATH=
BULK_STORAGE_DIR=./storage/bulk
BULK_MAX_ROWS=10000
PROFILE_IMAGE_DIR=./storage/profile_images
```

참고:
- `DATABASE_URL`은 `postgresql://...` 형식으로 넣어도 서버에서 `postgresql+psycopg://...`로 자동 정규화한다.
- Railway DB 내부 주소(`*.railway.internal`)는 외부 실행 환경에서 사용할 수 없다.

### 4.2 Web (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_BASE_URL=https://<your-railway-api-domain>
```

## 5. DB 마이그레이션 절차
운영 배포 시 API 실행 전에 반드시 수행:
```bash
cd apps/api
pip install -r requirements.txt
python scripts/run_migrations.py
```

직접 Alembic 명령 사용 시:
```bash
cd apps/api
alembic upgrade head
```

## 6. 권장 배포 구성
### 6.1 Web: Vercel
1. Vercel 프로젝트 생성 후 `apps/web`를 Root Directory로 지정
2. Build Command: `npm run build`
3. Install Command: `npm install`
4. 환경변수 `NEXT_PUBLIC_API_BASE_URL` 설정

### 6.2 API: Railway
1. Railway 프로젝트에 `apps/api` 배포
2. 환경변수(위 4.1) 입력
3. 배포 후 `GET /health` 확인
4. 마이그레이션 실행(배포 파이프라인 또는 One-off 실행)

### 6.3 DB: Railway PostgreSQL
1. Postgres 서비스 생성
2. API 서비스 환경변수에 `DATABASE_URL` 연결
3. DB 탭에서 테이블(`users`, `bulk_jobs`) 생성 여부 확인

## 7. 고정 IP 프록시 (권장)
Railway 환경에서 VWorld 직접 호출이 `502` 또는 연결 종료(`RemoteDisconnected`)로 불안정할 때 사용한다.

구현 위치:
- `infra/vworld-proxy`
- 실행 가이드: `infra/vworld-proxy/README.md`

요약 절차:
1. AWS EC2(Seoul) + Elastic IP 생성
2. `infra/vworld-proxy` 배포 및 systemd 등록
3. API env에 `VWORLD_PROXY_URL`, `VWORLD_PROXY_TOKEN` 반영
4. API 재배포 후 `/api/v1/land/single` 재검증
5. 필요 시 VWorld에 고정 IP 화이트리스트 요청

## 8. 운영 점검 절차 (배포 직후)
1. `GET /health` 200 확인
2. 회원가입/로그인/로그아웃 동작 확인
3. 프로필 수정/비밀번호 변경/회원 탈퇴 동작 확인
4. 개별조회(지번/도로명) 실데이터 응답 확인
5. 파일조회 테스트
  - 템플릿 다운로드
  - 샘플 업로드
  - 진행률 폴링
  - 결과 다운로드
  - 작업 삭제
6. CORS/쿠키 확인
  - Web 도메인에서 로그인 유지
  - `HttpOnly`, `Secure`, `SameSite=None` 확인

## 9. 백업/복구
운영 기준 핵심 보존 대상:
- PostgreSQL DB 덤프
- `apps/api/storage/bulk/`
- `apps/api/storage/profile_images/`

권장:
- 일 1회 정기 백업
- 배포 직전 수동 백업 1회

## 10. 롤백 전략
1. API/Web를 직전 태그로 롤백
2. 필요 시 DB를 직전 백업으로 복원
3. `/health`, 인증, 개별조회, 파일조회 시나리오 재검증

## 11. Redis 캐시 성능 비교(포트폴리오 증빙)
목표:
- 동일 주소를 연속 조회했을 때 캐시 미스/히트 응답시간 차이를 증빙한다.

사전 조건:
- Redis 연결이 활성화되어 있어야 한다.
- 측정 주소(지번/도로명) 1개를 고정한다.

권장 측정 방식:
1. 캐시 비우기(테스트 키 범위만) 또는 신규 주소 선택
2. 1차 요청(캐시 미스) 시간 기록
3. 동일 요청 2차 실행(캐시 히트) 시간 기록
4. 결과를 스크린샷으로 저장

예시(Bash):
```bash
curl -s -o /dev/null -w "first=%{time_total}s\n" \
  -X POST https://<api-domain>/api/v1/land/single \
  -H "content-type: application/json" \
  -d '{"search_type":"jibun","ld_code":"1168011800","san_type":"일반","main_no":"970","sub_no":"0"}'

curl -s -o /dev/null -w "second=%{time_total}s\n" \
  -X POST https://<api-domain>/api/v1/land/single \
  -H "content-type: application/json" \
  -d '{"search_type":"jibun","ld_code":"1168011800","san_type":"일반","main_no":"970","sub_no":"0"}'
```

README 반영 규칙:
- `docs/assets/perf-cache-compare.png`로 저장
- README에 아래 문구와 함께 이미지 첨부
  - `첫 조회: XXXms`
  - `두 번째 조회(캐시): YYYms`

## 12. 모니터링 구성 (운영형 포트폴리오)
권장 최소 구성:
1. 오류 추적: `Sentry` (API + Web)
2. API 접근 로그 집계: 에러율/외부 API 실패율/프록시 사용률
3. 주간 리포트: 숫자 요약 + 주요 장애 원인

핵심 지표 정의:
- `api_error_rate` = `5xx 응답 수 / 전체 API 요청 수 * 100`
- `vworld_direct_failure_rate` = `VWorld 직접 호출 실패 수 / VWorld 직접 호출 시도 수 * 100`
- `vworld_proxy_usage_rate` = `프록시 경유 호출 수 / 전체 VWorld 호출 수 * 100`

운영 체크:
- 지표가 특정 임계치 초과 시(예: 에러율 2%+) 알림 설정
- 배포 전/후 24시간 비교값 기록

## 13. 실제 사용 시나리오 문서화 가이드
문서 위치(권장):
- `docs/08-portfolio-enhancement.md`

필수 항목:
1. 사용자 페르소나(공인중개사/정비분석/투자자)
2. 문제 상황(왜 이 서비스가 필요한지)
3. 사용 흐름(단건조회/파일조회)
4. 산출물(의사결정에 어떤 근거를 주는지)
5. 기대 효과(시간 절감, 근거 데이터 확보)
