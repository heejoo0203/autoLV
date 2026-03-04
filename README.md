# autoLV

autoLV는 **개별공시지가 조회/분석 서비스**입니다.  
지번/도로명 단건 조회, 엑셀 대량 조회, 지도 기반 조회, 조회기록 관리 기능을 제공합니다.

## 릴리즈 상태
- 현재 기준 버전: **v2.1.0** (로컬/배포 기준 최신)
- 이전 안정 태그: `v1.0.0` (2026-03-02)
- v2 핵심 확장: **카카오 지도조회 + 지도조회 기록 연동 + 조회기록 고급 필터/정렬**
- v2.1 핵심 확장: **인증 UX 개선(이메일 중복확인, 약관 팝업, 아이디 저장, 이름/연락처 기반 아이디 찾기)**

## 주요 기능
### 1) 개별조회
- 지번 조회: `시/도 -> 시/군/구 -> 읍/면/동 -> 본번/부번`
- 도로명 조회: `시/도 -> 시/군/구 -> 초성 -> 도로명 -> 건물번호`
- VWorld API 연동 실데이터 조회
- 연도별 공시지가 결과 표시

### 2) 파일조회 (최대 10,000행)
- 표준 양식/가이드 제공
- 업로드 파일 헤더 자동 매핑 및 전처리
- 비동기 처리 + 진행률 표시
- 완료 시 결과 파일 다운로드
- 작업 이력 페이징/선택 삭제

### 3) 지도조회 (v2)
- Kakao Map 렌더링
- 지도 클릭 좌표 조회
- 주소 입력 조회(지도 내 검색)
- PNU 기반 조회, CSV 내보내기
- 상세 조회 API 연동:
  - 연도별 가격행 조회
  - 토지 상세정보 조회(면적/지목/용도지역/용도지구)
- 전체화면 모드 지원

### 4) 조회기록
- 로그인 사용자 기준 DB 영속 저장
- 단건/지도 조회 기록 통합 관리
- 기록 클릭 시 해당 페이지(`개별조회` 또는 `지도조회`)로 복원 이동
- 필터:
  - 유형
  - 시/도(선택형)
  - 시/군/구(선택형)
- 헤더 클릭 3단 정렬:
  - 내림차순 -> 오름차순 -> 기본
  - 적용 컬럼: 일시, 유형, 주소, 결과건수

### 5) 인증/계정
- 회원가입/로그인/로그아웃
- 회원가입 이메일 중복확인 + 이메일 인증코드 검증
- 회원가입 입력 확장: 이름 + 연락처 + 약관 팝업 동의
- 아이디 저장(localStorage) 지원
- 아이디 찾기(이름 + 연락처, 마스킹 이메일 응답)
- 비밀번호 표시 토글
- 프로필 수정(닉네임/이미지)
- 비밀번호 변경
- 회원 탈퇴
- HttpOnly 쿠키 기반 세션 처리

## 기술 스택
- Frontend: `Next.js 15`, `React 19`, `TypeScript`, `Tailwind CSS`
- Backend: `FastAPI`, `SQLAlchemy`, `Pydantic Settings`, `Alembic`
- Database: `PostgreSQL`(운영), `SQLite`(로컬), `PostGIS`(지도 확장 대비)
- Cache/Queue: `Redis`(캐시/비동기 처리)
- External API: `VWorld`, `Kakao Maps JS SDK`
- Deploy: `Vercel`(Web), `Railway`(API/Redis), `Neon(Postgres/PostGIS)`
- Network Fallback: `AWS EC2 고정 IP VWorld Proxy` (필요 시)

## 로컬 실행
## 1. 저장소
```bash
git clone https://github.com/heejoo0203/autoLV.git
cd autoLV
```

## 2. 환경변수
### API
```bash
copy apps\\api\\.env.example apps\\api\\.env
```

### Web
```bash
copy apps\\web\\.env.example apps\\web\\.env.local
```

필수 주요 키:
- API(`apps/api/.env`)
  - `DATABASE_URL`
  - `VWORLD_API_KEY`
  - `VWORLD_API_DOMAIN`
  - `CORS_ORIGINS`
  - `ROAD_NAME_FILE_PATH`
  - `MAIL_DELIVERY_MODE`, `MAIL_FROM`
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
  - (선택) `VWORLD_PROXY_URL`, `VWORLD_PROXY_TOKEN`
- Web(`apps/web/.env.local`)
  - `NEXT_PUBLIC_API_BASE_URL`
  - `NEXT_PUBLIC_KAKAO_MAP_APP_KEY`
  - `NEXT_PUBLIC_MAP_CENTER_LAT`
  - `NEXT_PUBLIC_MAP_CENTER_LNG`

## 3. API 실행
```bash
cd apps/api
pip install -r requirements.txt
python scripts/run_migrations.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 4. Web 실행
```bash
cd apps/web
npm install
npm run dev:clean
```

접속:
- Web: `http://localhost:3000`
- API: `http://127.0.0.1:8000`

## Android APK (Capacitor)
```bash
cd apps/mobile
npm install
npx cap sync android
npm run android:build:debug
```

상세 가이드:
- `apps/mobile/README.md`

## 관리자 시드
```bash
cd apps/api
python scripts/reset_db_and_seed_admin.py
```

기본 계정:
- 이메일: `admin@admin.com`
- 비밀번호: `admin1234`

## 배포 요약
- Web: Vercel (`apps/web`)
- API: Railway (`apps/api`)
- DB: Neon Postgres/PostGIS (또는 Railway Postgres)
- 상세 가이드: `docs/06-deployment.md`

## 문서
- 요구사항: `docs/01-requirements.md`
- 아키텍처: `docs/02-system-architecture.md`
- API 명세: `docs/03-api-spec.md`
- DB 스키마: `docs/04-db-schema.md`
- 폴더 구조: `docs/05-folder-structure.md`
- 배포 가이드: `docs/06-deployment.md`
- 릴리즈 노트(v1): `docs/07-release-notes-v1.0.0.md`
- 포트폴리오/운영 개선: `docs/08-portfolio-enhancement.md`
- 기능 상세: `docs/feature-spec.md`

## 레포 구조
```text
autoLV/
  apps/
    api/
    web/
  docs/
  infra/
  backend/   # legacy
  frontend/  # legacy
  crawler/   # legacy
```

## 기여 규칙
1. 기능 단위 커밋
2. Conventional Commits 사용
3. 코드 변경 시 문서 동기화

## 기여자
- heejoo0203
