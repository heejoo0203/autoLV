# autoLV

autoLV는 지번/도로명 기반 개별공시지가 조회와 파일 대량조회(최대 10,000행)를 제공하는 웹 서비스입니다.

## 릴리즈 스냅샷
- 현재 정상 버전 태그: `v1.0.0` (2026-03-02)
- v1 배포 범위: 개별조회 + 인증/계정관리 + 파일조회
- 핵심 안정화: Railway 환경에서 VWorld 직접 호출 장애 시 EC2(서울) 고정 IP 프록시 우회 경로 적용
- 릴리즈 노트: `docs/07-release-notes-v1.0.0.md`

## 핵심 기능
- 개별조회
  - 지번 검색: `시/도 -> 시/군/구 -> 읍/면/동 -> 지번`
  - 도로명 검색: `시/도 -> 시/군/구 -> 자음 -> 도로명 -> 건물번호`
  - VWorld API 기반 실데이터 조회, 연도 내림차순 결과 제공
- 인증/계정관리
  - 회원가입/로그인/로그아웃/내 정보 조회
  - 프로필 수정(닉네임/사진), 비밀번호 변경, 회원 탈퇴
  - HttpOnly 쿠키(`access_token`, `refresh_token`) 기반 세션
- 조회기록
  - 로그인 사용자 기준 최신순 표시
  - 기록 클릭 시 개별조회 화면에서 결과 재열람
- 파일조회(v1)
  - 표준 양식 다운로드 + 업로드 가이드
  - 헤더 자동 매핑/전처리(열 순서 변경 허용)
  - 비동기 작업 처리, 진행률/성공/실패 수 표시
  - 원본 파일 유지 + 연도별 공시지가 컬럼 추가 결과 다운로드
  - 작업 이력 페이징(10개), 다중 선택 삭제

## 기술 스택
- Web: Next.js 15, React 19, TypeScript, Tailwind CSS
- API: FastAPI, SQLAlchemy, Pydantic Settings
- DB: SQLite(개발), PostgreSQL + Alembic(운영)
- External: VWorld API
- Infra: Vercel(Web), Railway(API/DB), AWS EC2 고정 IP 프록시(선택/권장)

## 로컬 실행
### 1) 저장소 클론
```bash
git clone https://github.com/heejoo0203/autoLV.git
cd autoLV
```

### 2) 환경변수 파일 준비
API:
```bash
copy apps\\api\\.env.example apps\\api\\.env
```

Web:
```bash
copy apps\\web\\.env.example apps\\web\\.env.local
```

필수 확인값:
- `apps/api/.env`: `VWORLD_API_KEY`, `VWORLD_API_DOMAIN`, `CORS_ORIGINS`
- `apps/web/.env.local`: `NEXT_PUBLIC_API_BASE_URL`

### 3) API 실행
```bash
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

운영 DB(PostgreSQL) 사용 시:
```bash
cd apps/api
python scripts/run_migrations.py
```

### 4) Web 실행
```bash
cd apps/web
npm install
npm run dev:clean
```

접속:
- Web: `http://localhost:3000`
- API: `http://127.0.0.1:8000`

## 관리자 계정 초기화
```bash
cd apps/api
python scripts/reset_db_and_seed_admin.py
```

기본 계정:
- 이메일: `admin@admin.com`
- 비밀번호: `admin1234`

## 문서
- 요구사항: `docs/01-requirements.md`
- 시스템 아키텍처: `docs/02-system-architecture.md`
- API 명세: `docs/03-api-spec.md`
- DB 스키마: `docs/04-db-schema.md`
- 폴더 구조: `docs/05-folder-structure.md`
- 배포 가이드: `docs/06-deployment.md`
- 릴리즈 노트(v1.0.0): `docs/07-release-notes-v1.0.0.md`
- 기능 상세: `docs/feature-spec.md`

## 배포 준비 상태
- `v1.0.0` 기준 문서/코드 동기화 완료
- VWorld 연결 장애 대응(직접 호출 -> 프록시 우회) 반영 완료
- v2(지도조회/폴리곤 집계)는 v1 안정화 이후 별도 릴리스

## 레포 구조(요약)
```text
autoLV/
  apps/
    api/
    web/
  docs/
  infra/
  backend/   # 레거시
  frontend/  # 레거시
  crawler/   # 레거시
```

## 기여 규칙
1. 기능 단위 커밋
2. Conventional Commit 메시지 사용
3. 기능 변경 시 관련 문서 동시 갱신

## 기여자
- heejoo0203
