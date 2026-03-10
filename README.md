# 필지랩

필지랩은 **필지·구역 단위 토지 분석 서비스**입니다.  
지번/도로명 단건 조회, 지도 기반 필지 분석, 구역 집계, 엑셀 대량 분석, 조회기록 관리 기능을 제공합니다.

## 릴리즈 상태
- 현재 기준 버전: **v3.0 준비 중**
- 이전 안정 태그: `v1.0.0` (2026-03-02)
- v2 핵심 확장: **카카오 지도조회 + 지도조회 기록 연동 + 조회기록 고급 필터/정렬**
- v2.1 핵심 확장: **인증 UX 개선(이메일 중복확인, 약관 팝업, 아이디 저장, 이름/연락처 기반 아이디 찾기)**
- v2.2 핵심 확장: **지도조회 완성도 강화 + 정책 페이지 + Android Wrapper 배포 정리**
- 최신 확장: **구역조회 정확도 고도화 2차(AI 추천/이상치/피드백 저장)**

## 주요 기능
### 1) 개별조회
- 지번 조회: `시/도 -> 시/군/구 -> 읍/면/동 -> 본번/부번`
- 도로명 조회: `시/도 -> 시/군/구 -> 초성 -> 도로명 -> 건물번호`
- VWorld API 연동 실데이터 조회
- 연도별 공시지가 결과 표시

### 2) 파일조회 (최대 10,000행)
- 표준 양식/가이드 제공
- 업로드 파일 헤더 자동 매핑 및 전처리
- Redis 큐 + 워커 분리형 비동기 처리 + 진행률 표시
- 완료 시 결과 파일 다운로드
- 작업 이력 페이징/선택 삭제

### 3) 지도조회 (v2)
- Kakao Map 렌더링
- 지도 클릭 좌표 조회
- 주소 입력 조회(지도 내 검색)
- PNU 기반 조회, CSV 내보내기
- 비로그인 기본조회 지원
- 로그인 구역조회 지원
- 구역조회 결과에 건축 지표 요약 제공:
  - 건축물 수 / 노후 건축물 수 / 노후도(%)
  - 평균 사용승인년도
  - 총대지면적 / 총연면적 / 평균 용적률
  - 과소필지 비율(기본 90㎡ 미만)
- 구역 정확도 요약 제공:
  - 확정 포함 / 경계 후보 / 제외
  - 포함 필지 기준 총가치
  - 구역 내부 기준 총가치
  - 필지별 `overlap_ratio`, `confidence_score`, `inclusion_mode`
  - 필지별 `ai_recommendation`, `ai_confidence_score`, `selection_origin`
  - 구역 요약 `AI 추천 포함 수`, `AI 검토 필요 수`, `AI 요약 리포트`
  - 규칙 기반 이상치 검토(`anomaly_level`)
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
  - `REDIS_URL`
  - `BULK_EXECUTION_MODE`, `BULK_QUEUE_NAME`, `BULK_QUEUE_PROCESSING_NAME`, `BULK_WORKER_POLL_SECONDS`
  - `MAIL_DELIVERY_MODE`, `MAIL_FROM`
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
  - (선택) `VWORLD_PROXY_URL`, `VWORLD_PROXY_TOKEN`
  - `MAP_ZONE_AI_ENABLED`, `MAP_ZONE_AI_INCLUDE_THRESHOLD`, `MAP_ZONE_AI_UNCERTAIN_THRESHOLD`
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

## 3-1. Bulk Worker 실행
```bash
cd apps/api
python scripts/run_bulk_worker.py
```

- 운영 환경에서는 API 프로세스와 별도 서비스로 실행하는 것을 권장합니다.
- `REDIS_URL`이 없거나 `BULK_EXECUTION_MODE=background`이면 기존 `BackgroundTasks` fallback으로 동작합니다.

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

필지랩 APK 다운로드:
- 운영 URL: [`https://auto-lv.vercel.app/downloads/autoLV-android-release-v2.2.0.apk`](https://auto-lv.vercel.app/downloads/autoLV-android-release-v2.2.0.apk)
- 저장소 파일: [`apps/web/public/downloads/autoLV-android-release-v2.2.0.apk`](apps/web/public/downloads/autoLV-android-release-v2.2.0.apk)
- Play Console 업로드용 AAB: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`

상세 가이드:
- `apps/mobile/README.md`

## 관리자 시드
```bash
cd apps/api
set ADMIN_SEED_EMAIL=your-admin-email@example.com
set ADMIN_SEED_PASSWORD=your-strong-password
set ADMIN_SEED_NAME=관리자
python scripts/reset_db_and_seed_admin.py
```

또는 마이그레이션 실행 전에 동일한 환경변수를 설정하면 초기 관리자 계정을 함께 생성할 수 있습니다.

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
- 구역 정확도 향상 설계안(v3): `docs/11-ai-zone-accuracy-plan.md`
- 릴리즈 노트(v1, 아카이브): `docs/07-release-notes-v1.0.0.md`
- 릴리즈 노트(최신): `docs/09-release-notes-v2.2.0.md`
- 포트폴리오/운영 개선: `docs/08-portfolio-enhancement.md`
- 기능 상세: `docs/feature-spec.md`
- 개인정보처리방침: `https://auto-lv.vercel.app/privacy`
- 계정삭제 안내(Play Console 제출용): `https://auto-lv.vercel.app/account-deletion`

## 레포 구조
```text
autoLV/
  apps/
    api/      # 현재 운영 API
    web/      # 현재 운영 웹
    mobile/   # Android wrapper
  docs/
  infra/
  backend/   # legacy (보관용)
  frontend/  # legacy (보관용)
  crawler/   # legacy (보관용)
```

## 기여 규칙
1. 기능 단위 커밋
2. Conventional Commits 사용
3. 코드 변경 시 문서 동기화

## 기여자
- heejoo0203
