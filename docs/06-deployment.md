# v1 배포 가이드 (DB + 배포)

## 1. 배포 목표
v1 릴리스 범위(개별조회, 인증, 파일조회)를 운영 환경에서 안정적으로 서비스한다.

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
CORS_ORIGINS=https://autolv.example.com
DATABASE_URL=postgresql+psycopg://autolv:your_password@db-host:5432/autolv
JWT_SECRET_KEY=replace-with-strong-secret
JWT_REFRESH_SECRET_KEY=replace-with-strong-refresh-secret
ACCESS_TOKEN_EXP_MINUTES=60
REFRESH_TOKEN_EXP_DAYS=14
COOKIE_SECURE=true
COOKIE_SAMESITE=none
VWORLD_API_BASE_URL=https://api.vworld.kr
VWORLD_API_DOMAIN=api.autolv.example.com
VWORLD_TIMEOUT_SECONDS=15
VWORLD_API_KEY=your-real-key
ROAD_NAME_FILE_PATH=
LD_CODE_FILE_PATH=
BULK_STORAGE_DIR=./storage/bulk
BULK_MAX_ROWS=10000
PROFILE_IMAGE_DIR=./storage/profile_images
```

참고:
- `DATABASE_URL`은 `postgresql://...` 형식으로 입력해도 서버에서 `postgresql+psycopg://...`로 자동 정규화한다.

### 4.2 Web (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_BASE_URL=https://api.autolv.example.com
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
1. Vercel 프로젝트 생성 후 `apps/web`를 루트로 지정
2. Build Command: `npm run build`
3. 환경변수 `NEXT_PUBLIC_API_BASE_URL` 설정

### 6.2 API: Linux 서버(EC2/Lightsail/Render/Railway)
권장 절차:
1. 서버에 코드 배포
2. Python 가상환경 생성
3. `pip install -r apps/api/requirements.txt`
4. `apps/api/.env` 배치
5. `python scripts/run_migrations.py` 실행
6. Uvicorn(or Gunicorn+Uvicorn) 서비스 등록
7. Nginx 리버스 프록시 + HTTPS 구성

예시 실행 명령:
```bash
cd apps/api
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 7. Docker 스테이징 (선택)
로컬에서 Postgres + API 통합 확인:
```bash
cd infra/docker
docker compose -f docker-compose.v1.yml up --build
```

포트:
- API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

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
